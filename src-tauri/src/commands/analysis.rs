use crate::ai::hunyuan;
use crate::analysis::{
    build_workbench_snapshot, build_workbench_snapshot_from_ranked_results, calculate_all_angles,
    classify_by_temporal, compute_temporal_features, fuse_results, generate_suggestion,
    get_shooting_arm_angles, rank_comparison_results, PoseComparator, ShotTypeClassifier,
};
use crate::database::get_player_templates as get_player_templates_from_db;
use crate::image::{ImageProcessor, PoseVisualizer};
use crate::models::{
    AiAnalysisPayload, AiAnglePayloadItem, AiCoachingResponse, AiPayloadFlags, AiShotContext,
    AiShotReview, CanonicalAngleProfile, ComparisonResult, ComparisonWorkbenchResult,
    ComparisonWorkbenchSnapshot, CorrectionSuggestion, Keypoint, PhaseAngleProfile, PlayerTemplate,
    PlayerTemplateProfile, PoseData, ShotAnalysis, ShotType, VideoAnalysisFrame, VideoShotAnalysis,
};
use crate::pose::PoseDetector;
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;

#[derive(Clone, serde::Serialize)]
struct AnalysisProgress {
    stage: String,
    progress: u8,
    message: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareProgressEvent {
    request_id: String,
    analysis_key: String,
    stage: String,
    percent: u8,
    message: String,
}

struct CompareWorkbenchProgressStage {
    stage: &'static str,
    percent: u8,
    message: &'static str,
}

fn emit_analysis_progress(app_handle: &AppHandle, stage: &str, progress: u8, message: &str) {
    let _ = app_handle.emit(
        "analysis-progress",
        AnalysisProgress {
            stage: stage.to_string(),
            progress,
            message: message.to_string(),
        },
    );
}

fn emit_compare_progress(
    app_handle: &AppHandle,
    request_id: &str,
    analysis_key: &str,
    stage: &str,
    percent: u8,
    message: &str,
) {
    let _ = app_handle.emit(
        "compare-progress",
        CompareProgressEvent {
            request_id: request_id.to_string(),
            analysis_key: analysis_key.to_string(),
            stage: stage.to_string(),
            percent,
            message: message.to_string(),
        },
    );
}

fn compare_workbench_progress_plan(
    has_templates: bool,
    has_default_detail: bool,
) -> Vec<CompareWorkbenchProgressStage> {
    let mut stages = vec![
        CompareWorkbenchProgressStage {
            stage: "preparing",
            percent: 5,
            message: "正在准备球星对比工作台...",
        },
        CompareWorkbenchProgressStage {
            stage: "loading_templates",
            percent: 25,
            message: "正在加载球星模板...",
        },
        CompareWorkbenchProgressStage {
            stage: "validating_templates",
            percent: 45,
            message: "正在校验模板数据...",
        },
    ];

    if has_templates {
        stages.push(CompareWorkbenchProgressStage {
            stage: "ranking_players",
            percent: 68,
            message: "正在计算球星相似度排序...",
        });
        stages.push(CompareWorkbenchProgressStage {
            stage: "building_default_detail",
            percent: 88,
            message: "正在构建默认球星对比详情...",
        });
    } else {
        stages.push(CompareWorkbenchProgressStage {
            stage: "ranking_players",
            percent: 68,
            message: "无可用模板，跳过排序阶段。",
        });
        stages.push(CompareWorkbenchProgressStage {
            stage: "building_default_detail",
            percent: 88,
            message: "无可用模板，跳过默认详情构建。",
        });
    }

    stages.push(if has_default_detail {
        CompareWorkbenchProgressStage {
            stage: "ready",
            percent: 100,
            message: "球星对比工作台已准备完成。",
        }
    } else {
        CompareWorkbenchProgressStage {
            stage: "empty",
            percent: 100,
            message: if has_templates {
                "当前没有可展示的默认对比详情。"
            } else {
                "当前没有可用模板，工作台已返回空状态。"
            },
        }
    });

    stages
}

fn current_timestamp_ms() -> Result<u64, String> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())
        .map(|duration| duration.as_millis() as u64)
}

async fn load_player_templates(app_handle: &AppHandle) -> Result<Vec<PlayerTemplate>, String> {
    let Some(pool) = app_handle.try_state::<SqlitePool>() else {
        return Err("数据库未就绪，暂时无法加载球星模板。".to_string());
    };

    get_player_templates_from_db(&pool).await.map_err(|error| {
        eprintln!("Failed to load player templates from database: {error}");
        format!("加载球星模板失败：{error}")
    })
}

fn analyze_pose_frame(pose_data: PoseData, timestamp: u64) -> ShotAnalysis {
    let mut angles = calculate_all_angles(&pose_data.keypoints);
    append_shooting_arm_angles(&pose_data.keypoints, &mut angles);

    let classifier = ShotTypeClassifier::new();
    let (shot_type, confidence, reasons) = classifier.classify(&pose_data.keypoints, &angles);

    ShotAnalysis {
        pose_data,
        angles,
        shot_type,
        shot_type_confidence: confidence,
        shot_type_reasons: reasons,
        ai_review: None,
        timestamp,
    }
}

fn annotate_pose_image(image_data: &str, pose_data: &PoseData) -> Result<String, String> {
    let processor = ImageProcessor::new();
    let visualizer = PoseVisualizer::new();

    let image = processor
        .decode_from_base64(image_data)
        .map_err(|error| error.to_string())?;
    let annotated = visualizer
        .draw_keypoints(&image, pose_data)
        .map_err(|error| error.to_string())?;

    processor
        .encode_to_base64(&annotated)
        .map_err(|error| error.to_string())
}

fn choose_best_frame_index(frames: &[VideoAnalysisFrame]) -> usize {
    let preferred = frames
        .iter()
        .enumerate()
        .filter(|(_, frame)| frame.analysis.shot_type != ShotType::Unknown)
        .max_by(|(_, left), (_, right)| {
            left.analysis
                .shot_type_confidence
                .partial_cmp(&right.analysis.shot_type_confidence)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(index, _)| index);

    preferred.unwrap_or_else(|| {
        frames
            .iter()
            .enumerate()
            .max_by(|(_, left), (_, right)| {
                left.analysis
                    .shot_type_confidence
                    .partial_cmp(&right.analysis.shot_type_confidence)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|(index, _)| index)
            .unwrap_or(0)
    })
}

const CANONICAL_TEMPLATE_ANGLES: [&str; 7] = [
    "right_elbow_angle",
    "shooting_elbow_angle",
    "release_angle",
    "right_shoulder_angle",
    "shoulder_tilt",
    "trunk_tilt",
    "right_knee_angle",
];

fn normalize_video_phase(frame_index: usize, total_frames: usize) -> &'static str {
    if total_frames <= 1 {
        return "release";
    }

    let normalized = frame_index as f32 / (total_frames.saturating_sub(1).max(1) as f32);
    if normalized < 0.34 {
        "setup"
    } else if normalized < 0.67 {
        "release"
    } else {
        "follow_through"
    }
}

fn build_template_profile_from_video_frames(
    frames: &[VideoAnalysisFrame],
) -> Option<PlayerTemplateProfile> {
    if frames.is_empty() {
        return None;
    }

    let mut phase_profiles = std::collections::BTreeMap::new();

    for (position, frame) in frames.iter().enumerate() {
        let phase = normalize_video_phase(position, frames.len()).to_string();
        let entry = phase_profiles
            .entry(phase.clone())
            .or_insert_with(|| PhaseAngleProfile {
                phase,
                sample_count: 0,
                coverage: 0.0,
                angles: Vec::new(),
            });

        entry.sample_count += 1;

        for angle_name in CANONICAL_TEMPLATE_ANGLES {
            if let Some(source_angle) = frame
                .analysis
                .angles
                .iter()
                .find(|angle| angle.name == angle_name && angle.status != "low_confidence")
            {
                if let Some(existing) = entry
                    .angles
                    .iter_mut()
                    .find(|angle| angle.name == source_angle.name)
                {
                    let sample_count = entry.sample_count as f32;
                    let previous_count = (entry.sample_count - 1) as f32;
                    existing.value =
                        ((existing.value * previous_count) + source_angle.value) / sample_count;
                    existing.confidence = ((existing.confidence * previous_count)
                        + source_angle.confidence)
                        / sample_count;
                } else {
                    entry.angles.push(CanonicalAngleProfile {
                        name: source_angle.name.clone(),
                        value: source_angle.value,
                        confidence: source_angle.confidence,
                    });
                }
            }
        }

        entry.coverage = entry.angles.len() as f32 / CANONICAL_TEMPLATE_ANGLES.len() as f32;
    }

    let representative_frame_index = Some(choose_best_frame_index(frames));
    let representative_timestamp_ms = representative_frame_index
        .and_then(|index| frames.get(index))
        .map(|frame| frame.timestamp_ms as u64);
    let total_phase_count = phase_profiles.len().max(1) as f32;
    let coverage = phase_profiles
        .values()
        .map(|phase| phase.coverage)
        .sum::<f32>()
        / total_phase_count;

    Some(PlayerTemplateProfile {
        version: 1,
        source_kind: "video".to_string(),
        overall_shot_type: shot_type_key(
            &frames[representative_frame_index.unwrap_or(0)]
                .analysis
                .shot_type,
        )
        .to_string(),
        representative_frame_index,
        representative_timestamp_ms,
        samples_used: frames.len(),
        coverage,
        phase_profiles,
    })
}

fn aggregate_video_result(
    frames: &[VideoAnalysisFrame],
    trim_start_ms: u32,
    trim_end_ms: u32,
) -> (ShotType, f32, Vec<String>, Option<crate::analysis::temporal::TemporalFeatures>) {
    if frames.is_empty() {
        return (
            ShotType::Unknown,
            0.2,
            vec!["未能从裁剪片段中提取到可用的姿态关键帧。".to_string()],
            None,
        );
    }

    let mut weights = [0.0_f32; 4];
    for frame in frames {
        let weight = frame.analysis.shot_type_confidence.max(0.05);
        let index = match frame.analysis.shot_type {
            ShotType::OneMotion => 0,
            ShotType::OnePointFiveMotion => 1,
            ShotType::TwoMotion => 2,
            ShotType::Unknown => 3,
        };
        weights[index] += weight;
    }

    let motion_total = weights[0] + weights[1] + weights[2];
    let best_motion_index = [0_usize, 1, 2]
        .into_iter()
        .max_by(|left, right| {
            weights[*left]
                .partial_cmp(&weights[*right])
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .unwrap_or(0);

    let vote_shot_type = if motion_total > 0.0 {
        match best_motion_index {
            0 => ShotType::OneMotion,
            1 => ShotType::OnePointFiveMotion,
            _ => ShotType::TwoMotion,
        }
    } else {
        ShotType::Unknown
    };

    let best_frame_index = choose_best_frame_index(frames);
    let best_frame = &frames[best_frame_index];
    let dominant_weight = if vote_shot_type == ShotType::Unknown {
        weights[3]
    } else {
        weights[best_motion_index]
    };
    let weight_total = if vote_shot_type == ShotType::Unknown {
        weights.iter().sum::<f32>()
    } else {
        motion_total
    }
    .max(0.0001);

    let agreement = (dominant_weight / weight_total).clamp(0.0, 1.0);
    let vote_confidence = if vote_shot_type == ShotType::Unknown {
        (best_frame.analysis.shot_type_confidence * 0.75).clamp(0.18, 0.55)
    } else {
        (agreement * 0.55 + best_frame.analysis.shot_type_confidence * 0.45).clamp(0.28, 0.94)
    };

    let temporal_features = compute_temporal_features(frames);
    let (temporal_shot_type, temporal_confidence) = classify_by_temporal(&temporal_features);

    let (overall_shot_type, overall_confidence, fuse_reasons) = fuse_results(
        vote_shot_type,
        vote_confidence,
        temporal_shot_type,
        temporal_confidence,
        &temporal_features,
    );

    let mut reasons = vec![format!(
        "已对裁剪片段 {:.2}s - {:.2}s 进行 {} 个关键帧抽样。",
        trim_start_ms as f32 / 1000.0,
        trim_end_ms as f32 / 1000.0,
        frames.len()
    )];
    reasons.push(format!(
        "最佳关键帧出现在 {:.2}s 附近，作为当前主分析画面。",
        best_frame.timestamp_ms as f32 / 1000.0
    ));

    if overall_shot_type == ShotType::Unknown {
        reasons.push(
            "当前片段里可用帧存在，但动作阶段和分型证据还不够稳定，先保留为待确认。".to_string(),
        );
    } else {
        reasons.push(format!(
            "多数有效关键帧更偏向 {}，说明这不是单帧偶然判断。",
            overall_shot_type.to_chinese()
        ));
    }

    reasons.extend(fuse_reasons);

    (overall_shot_type, overall_confidence, reasons, Some(temporal_features))
}

#[tauri::command]
pub async fn analyze_shot(
    image_data: String,
    app_handle: AppHandle,
) -> Result<ShotAnalysis, String> {
    emit_analysis_progress(&app_handle, "detecting", 30, "正在检测人体姿态...");

    let detector = PoseDetector::new();
    let pose_data = detect_pose_with_fallbacks(&detector, &image_data)
        .map_err(|error| format_pose_error(&error))?;

    emit_analysis_progress(&app_handle, "analyzing", 70, "正在计算关节角度...");
    let analysis = analyze_pose_frame(pose_data, current_timestamp_ms()?);

    emit_analysis_progress(&app_handle, "complete", 100, "分析完成");
    Ok(analysis)
}

#[tauri::command]
pub async fn analyze_video(
    file_path: String,
    trim_start_ms: u32,
    trim_end_ms: u32,
    app_handle: AppHandle,
) -> Result<VideoShotAnalysis, String> {
    if file_path.trim().is_empty() {
        return Err("请选择要分析的视频文件。".to_string());
    }

    emit_analysis_progress(&app_handle, "sampling", 20, "正在抽取视频关键帧...");

    let detector = PoseDetector::new();
    let video_result = detector
        .analyze_video_file(&file_path, trim_start_ms, trim_end_ms, 16)
        .map_err(|error| format!("视频姿态分析失败: {error}"))?;

    if video_result.frames.is_empty() {
        return Err("所选视频片段中没有检测到可用的投篮姿态关键帧。".to_string());
    }

    let timestamp_base = current_timestamp_ms()?;
    let frame_total = video_result.frames.len().max(1);
    let mut analyzed_frames = Vec::with_capacity(video_result.frames.len());

    for (position, frame) in video_result.frames.iter().enumerate() {
        let progress = 35 + ((position + 1) * 45 / frame_total) as u8;
        emit_analysis_progress(
            &app_handle,
            "analyzing",
            progress,
            "正在逐帧计算骨骼点和角度...",
        );

        let pose_data = PoseData {
            keypoints: frame.keypoints.clone(),
            width: frame.width,
            height: frame.height,
        };
        let analysis = analyze_pose_frame(
            pose_data.clone(),
            timestamp_base + u64::from(frame.timestamp_ms),
        );
        let annotated_image_data = annotate_pose_image(&frame.image_data, &pose_data)?;

        analyzed_frames.push(VideoAnalysisFrame {
            index: frame.index,
            timestamp_ms: frame.timestamp_ms,
            image_data: frame.image_data.clone(),
            annotated_image_data,
            analysis,
        });
    }

    emit_analysis_progress(
        &app_handle,
        "summarizing",
        88,
        "正在汇总整段视频的投篮分型...",
    );

    let best_frame_index = choose_best_frame_index(&analyzed_frames);
    let (overall_shot_type, overall_shot_type_confidence, overall_reasons, temporal_features) = aggregate_video_result(
        &analyzed_frames,
        video_result.trim_start_ms,
        video_result.trim_end_ms,
    );
    let template_profile = build_template_profile_from_video_frames(&analyzed_frames);

    emit_analysis_progress(&app_handle, "complete", 100, "视频分析完成");

    Ok(VideoShotAnalysis {
        video_path: file_path,
        duration_ms: video_result.duration_ms,
        trim_start_ms: video_result.trim_start_ms,
        trim_end_ms: video_result.trim_end_ms,
        fps: video_result.fps,
        total_frames: video_result.total_frames,
        frames_analyzed: analyzed_frames.len(),
        frames: analyzed_frames,
        best_frame_index,
        overall_shot_type,
        overall_shot_type_confidence,
        overall_reasons,
        template_profile,
        temporal_features,
    })
}

fn detect_pose_with_fallbacks(
    detector: &PoseDetector,
    image_data: &str,
) -> Result<crate::models::PoseData, String> {
    let mut last_error = match detector.detect_from_base64(image_data) {
        Ok(result) => return Ok(result),
        Err(error) => error.to_string(),
    };

    let processor = ImageProcessor::new();
    let image = processor
        .decode_from_base64(image_data)
        .map_err(|error| error.to_string())?;

    for candidate in build_pose_detection_candidates(&processor, &image) {
        match detector.detect_from_base64(&candidate) {
            Ok(result) => return Ok(result),
            Err(error) => last_error = error.to_string(),
        }
    }

    Err(last_error)
}

fn build_pose_detection_candidates(
    processor: &ImageProcessor,
    image: &image::DynamicImage,
) -> Vec<String> {
    let width = image.width();
    let height = image.height();
    let mut candidates = Vec::new();

    if let Ok(encoded) = processor
        .adjust_brightness(image, 1.12)
        .and_then(|img| processor.adjust_contrast(&img, 12.0))
        .and_then(|img| processor.encode_to_base64(&img))
    {
        candidates.push(encoded);
    }

    let crop_specs = [
        (0.10, 0.02, 0.80, 0.96),
        (0.18, 0.00, 0.64, 0.88),
        (0.22, 0.08, 0.56, 0.82),
    ];

    for (x_ratio, y_ratio, width_ratio, height_ratio) in crop_specs {
        let x = (width as f32 * x_ratio).round() as u32;
        let y = (height as f32 * y_ratio).round() as u32;
        let crop_width = ((width as f32 * width_ratio).round() as u32).max(1);
        let crop_height = ((height as f32 * height_ratio).round() as u32).max(1);
        let safe_width = crop_width.min(width.saturating_sub(x)).max(1);
        let safe_height = crop_height.min(height.saturating_sub(y)).max(1);

        if let Ok(cropped) = processor.crop(image, x, y, safe_width, safe_height) {
            if let Ok(encoded) = processor.encode_to_base64(&cropped) {
                candidates.push(encoded);
            }

            if let Ok(boosted) = processor
                .adjust_brightness(&cropped, 1.08)
                .and_then(|img| processor.adjust_contrast(&img, 10.0))
                .and_then(|img| processor.encode_to_base64(&img))
            {
                candidates.push(boosted);
            }
        }
    }

    candidates
}

fn format_pose_error(error: &str) -> String {
    if error.contains("No pose detected") {
        return "未检测到可用人体骨骼点。请尽量上传单人、全身、主体更大、遮挡更少的投篮画面；如果是比赛截图，建议先裁掉观众和防守人后再试。".to_string();
    }

    format!("姿态分析失败: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{JointAngle, PoseData, ShotType};

    #[test]
    fn rewrites_no_pose_detected_error_to_actionable_message() {
        let message = format_pose_error("Pose detection error: No pose detected");
        assert!(message.contains("未检测到可用人体骨骼点"));
        assert!(message.contains("裁掉观众和防守人"));
    }

    #[test]
    fn builds_multiple_detection_candidates() {
        let processor = ImageProcessor::new();
        let image = image::DynamicImage::new_rgb8(800, 1200);

        let candidates = build_pose_detection_candidates(&processor, &image);

        assert!(candidates.len() >= 4);
        assert!(candidates
            .iter()
            .all(|candidate| candidate.starts_with("data:image/png;base64,")));
    }

    fn keypoint(id: u32, x: f32, y: f32) -> Keypoint {
        Keypoint {
            id,
            name: format!("kp_{id}"),
            x,
            y,
            z: 0.0,
            visibility: 1.0,
        }
    }

    fn right_handed_keypoints() -> Vec<Keypoint> {
        vec![
            keypoint(0, 0.0, -40.0),
            keypoint(11, -20.0, 0.0),
            keypoint(13, -40.0, 30.0),
            keypoint(15, -50.0, 80.0),
            keypoint(12, 20.0, 0.0),
            keypoint(14, 45.0, -15.0),
            keypoint(16, 70.0, -65.0),
            keypoint(23, -20.0, 100.0),
            keypoint(24, 20.0, 100.0),
            keypoint(25, -15.0, 190.0),
            keypoint(26, 25.0, 185.0),
            keypoint(27, -10.0, 280.0),
            keypoint(28, 30.0, 275.0),
        ]
    }

    fn joint_angle(name: &str, value: f32) -> JointAngle {
        JointAngle {
            name: name.to_string(),
            value,
            normal_range: (0.0, 180.0),
            status: "normal".to_string(),
            confidence: 0.95,
        }
    }

    #[test]
    fn appends_shooting_arm_angles_without_duplicates() {
        let keypoints = right_handed_keypoints();
        let mut angles = calculate_all_angles(&keypoints);

        append_shooting_arm_angles(&keypoints, &mut angles);
        append_shooting_arm_angles(&keypoints, &mut angles);

        assert_eq!(
            angles
                .iter()
                .filter(|angle| angle.name == "shooting_elbow_angle")
                .count(),
            1
        );
        assert_eq!(
            angles
                .iter()
                .filter(|angle| angle.name == "release_angle")
                .count(),
            1
        );
    }

    #[tokio::test]
    async fn ai_payload_includes_shooting_arm_angles_even_when_analysis_lacks_them() {
        let keypoints = right_handed_keypoints();
        let analysis = ShotAnalysis {
            pose_data: PoseData {
                keypoints: keypoints.clone(),
                width: 800,
                height: 1200,
            },
            angles: calculate_all_angles(&keypoints),
            shot_type: ShotType::Unknown,
            shot_type_confidence: 0.0,
            shot_type_reasons: Vec::new(),
            ai_review: None,
            timestamp: 0,
        };

        let payload = build_ai_analysis_payload(analysis)
            .await
            .expect("expected payload");

        assert!(payload
            .primary_angles
            .iter()
            .any(|angle| angle.name == "shooting_elbow_angle"));
        assert!(payload
            .primary_angles
            .iter()
            .any(|angle| angle.name == "release_angle"));
    }

    #[test]
    fn compare_progress_event_serializes_request_identity_and_percent() {
        let value = serde_json::to_value(CompareProgressEvent {
            request_id: "request-1".to_string(),
            analysis_key: "analysis-1".to_string(),
            stage: "ranking_players".to_string(),
            percent: 68,
            message: "loading".to_string(),
        })
        .expect("compare progress event json");

        assert_eq!(value["requestId"], "request-1");
        assert_eq!(value["analysisKey"], "analysis-1");
        assert_eq!(value["stage"], "ranking_players");
        assert_eq!(value["percent"], 68);
        assert_eq!(value["message"], "loading");
        assert!(value.get("progress").is_none());
    }

    #[test]
    fn empty_compare_workbench_progress_keeps_full_stage_chain() {
        let stages = compare_workbench_progress_plan(false, false);

        assert_eq!(
            stages.iter().map(|stage| stage.stage).collect::<Vec<_>>(),
            vec![
                "preparing",
                "loading_templates",
                "validating_templates",
                "ranking_players",
                "building_default_detail",
                "empty",
            ]
        );
        assert!(stages[3].message.contains("跳过排序"));
        assert!(stages[4].message.contains("跳过默认详情"));
    }

    #[test]
    fn builds_template_profile_from_video_frames() {
        let frames = vec![
            VideoAnalysisFrame {
                index: 0,
                timestamp_ms: 0,
                image_data: String::new(),
                annotated_image_data: String::new(),
                analysis: ShotAnalysis {
                    pose_data: PoseData::default(),
                    angles: vec![
                        joint_angle("right_elbow_angle", 82.0),
                        joint_angle("right_knee_angle", 132.0),
                    ],
                    shot_type: ShotType::OneMotion,
                    shot_type_confidence: 0.8,
                    shot_type_reasons: vec![],
                    ai_review: None,
                    timestamp: 0,
                },
            },
            VideoAnalysisFrame {
                index: 1,
                timestamp_ms: 120,
                image_data: String::new(),
                annotated_image_data: String::new(),
                analysis: ShotAnalysis {
                    pose_data: PoseData::default(),
                    angles: vec![
                        joint_angle("right_elbow_angle", 90.0),
                        joint_angle("release_angle", 74.0),
                    ],
                    shot_type: ShotType::OneMotion,
                    shot_type_confidence: 0.92,
                    shot_type_reasons: vec![],
                    ai_review: None,
                    timestamp: 120,
                },
            },
            VideoAnalysisFrame {
                index: 2,
                timestamp_ms: 240,
                image_data: String::new(),
                annotated_image_data: String::new(),
                analysis: ShotAnalysis {
                    pose_data: PoseData::default(),
                    angles: vec![
                        joint_angle("right_elbow_angle", 166.0),
                        joint_angle("trunk_tilt", 7.0),
                    ],
                    shot_type: ShotType::OneMotion,
                    shot_type_confidence: 0.7,
                    shot_type_reasons: vec![],
                    ai_review: None,
                    timestamp: 240,
                },
            },
        ];

        let profile = build_template_profile_from_video_frames(&frames)
            .expect("profile should be built from video frames");

        assert_eq!(profile.source_kind, "video");
        assert_eq!(profile.samples_used, 3);
        assert!(profile.phase_profiles.contains_key("setup"));
        assert!(profile.phase_profiles.contains_key("release"));
        assert!(profile.phase_profiles.contains_key("follow_through"));
        assert_eq!(profile.phase_profiles["release"].sample_count, 1);
        assert!(profile.phase_profiles["release"]
            .angles
            .iter()
            .any(|angle| angle.name == "right_elbow_angle"));
    }

    #[test]
    fn canonical_template_angles_only_include_generated_angle_names() {
        assert!(!CANONICAL_TEMPLATE_ANGLES.contains(&"hip_alignment"));
    }
}

#[tauri::command]
pub async fn get_player_templates(app_handle: AppHandle) -> Result<Vec<PlayerTemplate>, String> {
    load_player_templates(&app_handle).await
}

#[tauri::command]
pub async fn compare_with_player(
    app_handle: AppHandle,
    analysis: ShotAnalysis,
    player_id: i64,
) -> Result<ComparisonResult, String> {
    let templates = load_player_templates(&app_handle).await?;

    let player = templates
        .into_iter()
        .find(|template| template.id == player_id)
        .ok_or_else(|| "Player template not found".to_string())?;

    let comparator = PoseComparator::new();
    let result = comparator.compare(&analysis, &player);

    Ok(result)
}

#[tauri::command]
pub async fn compare_against_all_players(
    app_handle: AppHandle,
    analysis: ShotAnalysis,
) -> Result<ComparisonWorkbenchResult, String> {
    let templates = load_player_templates(&app_handle).await?;
    let comparator = PoseComparator::new();
    let summaries = comparator.rank_players(&analysis, &templates);
    let selected_comparison = summaries
        .first()
        .map(|summary| comparator.compare(&analysis, &summary.player));

    Ok(ComparisonWorkbenchResult {
        summaries,
        selected_comparison,
    })
}

#[tauri::command]
pub async fn build_compare_workbench(
    app_handle: AppHandle,
    request_id: String,
    analysis_key: String,
    analysis: ShotAnalysis,
    analysis_profile: Option<PlayerTemplateProfile>,
) -> Result<ComparisonWorkbenchSnapshot, String> {
    let preparing_and_loading = compare_workbench_progress_plan(true, false);
    for stage in preparing_and_loading.into_iter().take(2) {
        emit_compare_progress(
            &app_handle,
            &request_id,
            &analysis_key,
            stage.stage,
            stage.percent,
            stage.message,
        );
    }

    let templates = match load_player_templates(&app_handle).await {
        Ok(templates) => templates,
        Err(error) => {
            emit_compare_progress(
                &app_handle,
                &request_id,
                &analysis_key,
                "failed",
                25,
                &error,
            );
            return Err(error);
        }
    };

    let has_templates = !templates.is_empty();
    let progress_plan = compare_workbench_progress_plan(has_templates, false);
    emit_compare_progress(
        &app_handle,
        &request_id,
        &analysis_key,
        progress_plan[2].stage,
        progress_plan[2].percent,
        progress_plan[2].message,
    );

    if !has_templates {
        let snapshot = build_workbench_snapshot(
            analysis_key.clone(),
            &analysis,
            analysis_profile.as_ref(),
            &templates,
        );
        for stage in progress_plan.into_iter().skip(3) {
            emit_compare_progress(
                &app_handle,
                &request_id,
                &analysis_key,
                stage.stage,
                stage.percent,
                stage.message,
            );
        }

        return Ok(snapshot);
    }

    emit_compare_progress(
        &app_handle,
        &request_id,
        &analysis_key,
        progress_plan[3].stage,
        progress_plan[3].percent,
        progress_plan[3].message,
    );

    let comparator = PoseComparator::new();
    let ranked_results = rank_comparison_results(
        &comparator,
        &analysis,
        analysis_profile.as_ref(),
        &templates,
    );

    emit_compare_progress(
        &app_handle,
        &request_id,
        &analysis_key,
        progress_plan[4].stage,
        progress_plan[4].percent,
        progress_plan[4].message,
    );

    let snapshot = build_workbench_snapshot_from_ranked_results(
        analysis_key.clone(),
        &analysis,
        ranked_results,
    );
    let terminal_plan = compare_workbench_progress_plan(true, snapshot.selected_detail.is_some());
    for stage in terminal_plan.into_iter().skip(5) {
        emit_compare_progress(
            &app_handle,
            &request_id,
            &analysis_key,
            stage.stage,
            stage.percent,
            stage.message,
        );
    }

    Ok(snapshot)
}

#[tauri::command]
pub async fn get_correction_suggestions(
    analysis: ShotAnalysis,
) -> Result<Vec<CorrectionSuggestion>, String> {
    let mut suggestions = Vec::new();

    for angle in &analysis.angles {
        if angle.status == "warning" || angle.status == "error" {
            if let Some(suggestion) = generate_suggestion(angle) {
                suggestions.push(suggestion);
            }
        }
    }

    suggestions.sort_by(|a, b| {
        let priority_order = |priority: &str| match priority {
            "high" => 0,
            "medium" => 1,
            _ => 2,
        };
        priority_order(&a.priority).cmp(&priority_order(&b.priority))
    });

    Ok(suggestions)
}

#[tauri::command]
pub async fn get_ai_correction_suggestions(
    analysis: ShotAnalysis,
    image_data: Option<String>,
    annotated_image_data: Option<String>,
) -> Result<AiCoachingResponse, String> {
    let payload = build_ai_analysis_payload(analysis).await?;
    let preferred_image = annotated_image_data
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            image_data
                .as_deref()
                .filter(|value| !value.trim().is_empty())
        });

    match hunyuan::generate_correction_suggestions(&payload, preferred_image).await {
        Ok(suggestions) => Ok(suggestions),
        Err(error) => {
            eprintln!("Hunyuan suggestion generation failed: {error}");
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn get_ai_shot_review(
    analysis: ShotAnalysis,
    image_data: Option<String>,
    annotated_image_data: Option<String>,
) -> Result<AiShotReview, String> {
    let payload = build_ai_analysis_payload(analysis).await?;
    let preferred_image = annotated_image_data
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            image_data
                .as_deref()
                .filter(|value| !value.trim().is_empty())
        });

    match hunyuan::generate_shot_review(&payload, preferred_image).await {
        Ok(review) => Ok(review),
        Err(error) => {
            eprintln!("Hunyuan shot review generation failed: {error}");
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn build_ai_analysis_payload(
    analysis: ShotAnalysis,
) -> Result<AiAnalysisPayload, String> {
    let mut analysis = analysis;
    append_shooting_arm_angles(&analysis.pose_data.keypoints, &mut analysis.angles);

    let dominant_hand = detect_shooting_hand(&analysis.pose_data.keypoints);
    let local_shot_phase = detect_shot_phase(&analysis.pose_data.keypoints);
    let ai_review = analysis.ai_review.as_ref();
    let shot_phase = ai_review
        .map(|review| normalize_ai_phase(&review.phase))
        .unwrap_or_else(|| local_shot_phase.clone());
    let (shot_type, shot_type_confidence) = ai_review
        .filter(|review| {
            review.decision_mode != "insufficient" && review.shot_type != ShotType::Unknown
        })
        .map(|review| (&review.shot_type, review.shot_type_confidence))
        .unwrap_or((&analysis.shot_type, analysis.shot_type_confidence));

    let (primary_angles, reference_angles): (Vec<_>, Vec<_>) = analysis
        .angles
        .iter()
        .map(to_ai_angle_payload_item)
        .partition(|angle| is_primary_angle(&angle.name));

    let low_confidence_angles = analysis
        .angles
        .iter()
        .filter(|angle| angle.status == "low_confidence")
        .map(|angle| angle.name.clone())
        .collect();

    Ok(AiAnalysisPayload {
        shot_context: AiShotContext {
            source: "single_frame".to_string(),
            suspected_shooting_hand: dominant_hand,
            shot_phase,
            shot_type: shot_type_key(shot_type).to_string(),
            shot_type_confidence,
        },
        primary_angles,
        reference_angles,
        low_confidence_angles,
        shot_type_reasons: analysis.shot_type_reasons,
        flags: AiPayloadFlags {
            prefer_business_angles: true,
            ignore_raw_side_angles_when_conflict_with_shooting_angles: true,
            skip_low_confidence_angles: true,
        },
    })
}

fn append_shooting_arm_angles(keypoints: &[Keypoint], angles: &mut Vec<crate::models::JointAngle>) {
    let is_right_handed = detect_shooting_hand(keypoints).contains("right");

    for angle in get_shooting_arm_angles(keypoints, is_right_handed) {
        if let Some(existing) = angles
            .iter_mut()
            .find(|existing| existing.name == angle.name)
        {
            *existing = angle;
        } else {
            angles.push(angle);
        }
    }
}

fn to_ai_angle_payload_item(angle: &crate::models::JointAngle) -> AiAnglePayloadItem {
    AiAnglePayloadItem {
        name: angle.name.clone(),
        display_name: angle_display_name(&angle.name),
        value: angle.value,
        normal_range: angle.normal_range,
        status: angle.status.clone(),
        confidence: angle.confidence,
        definition: angle_definition(&angle.name),
    }
}

fn angle_display_name(name: &str) -> String {
    match name {
        "left_elbow_angle" => "左肘角".to_string(),
        "right_elbow_angle" => "右肘角".to_string(),
        "left_shoulder_angle" => "左肩角".to_string(),
        "right_shoulder_angle" => "右肩角".to_string(),
        "left_knee_angle" => "左膝角".to_string(),
        "right_knee_angle" => "右膝角".to_string(),
        "left_hip_angle" => "左髋角".to_string(),
        "right_hip_angle" => "右髋角".to_string(),
        "shoulder_tilt" => "肩线倾斜".to_string(),
        "trunk_tilt" => "躯干倾斜".to_string(),
        "shooting_elbow_angle" => "投篮肘角".to_string(),
        "release_angle" => "出手角".to_string(),
        _ => name.to_string(),
    }
}

fn angle_definition(name: &str) -> String {
    match name {
        "left_elbow_angle" => "left shoulder-left elbow-left wrist".to_string(),
        "right_elbow_angle" => "right shoulder-right elbow-right wrist".to_string(),
        "left_shoulder_angle" => "left hip-left shoulder-left elbow".to_string(),
        "right_shoulder_angle" => "right hip-right shoulder-right elbow".to_string(),
        "left_knee_angle" => "left hip-left knee-left ankle".to_string(),
        "right_knee_angle" => "right hip-right knee-right ankle".to_string(),
        "left_hip_angle" => "left shoulder-left hip-left knee".to_string(),
        "right_hip_angle" => "right shoulder-right hip-right knee".to_string(),
        "shoulder_tilt" => {
            "line between left and right shoulder relative to horizontal".to_string()
        }
        "trunk_tilt" => "mid shoulder to nose relative to vertical".to_string(),
        "shooting_elbow_angle" => "shooting shoulder-elbow-wrist".to_string(),
        "release_angle" => "shooting shoulder-wrist relative to horizontal".to_string(),
        _ => "custom angle".to_string(),
    }
}

fn is_primary_angle(name: &str) -> bool {
    matches!(
        name,
        "shooting_elbow_angle"
            | "release_angle"
            | "trunk_tilt"
            | "shoulder_tilt"
            | "left_shoulder_angle"
            | "right_shoulder_angle"
            | "left_knee_angle"
            | "right_knee_angle"
    )
}

fn shot_type_key(shot_type: &ShotType) -> &'static str {
    match shot_type {
        ShotType::OneMotion => "one_motion",
        ShotType::OnePointFiveMotion => "one_point_five_motion",
        ShotType::TwoMotion => "two_motion",
        ShotType::Unknown => "unknown",
    }
}

fn normalize_ai_phase(phase: &str) -> String {
    match phase {
        "gather" | "set_point" | "release" | "follow_through" | "unknown" => phase.to_string(),
        "late_release" => "release".to_string(),
        _ => "unknown".to_string(),
    }
}

fn detect_shooting_hand(keypoints: &[Keypoint]) -> String {
    let left_score = side_score(keypoints, 11, 15, 23);
    let right_score = side_score(keypoints, 12, 16, 24);

    if (left_score - right_score).abs() < 0.08 {
        if left_score >= right_score {
            "suspected_left".to_string()
        } else {
            "suspected_right".to_string()
        }
    } else if left_score > right_score {
        "left".to_string()
    } else {
        "right".to_string()
    }
}

fn side_score(keypoints: &[Keypoint], shoulder_id: u32, wrist_id: u32, hip_id: u32) -> f32 {
    let get_kp = |id| keypoints.iter().find(|keypoint| keypoint.id == id);

    match (get_kp(shoulder_id), get_kp(wrist_id), get_kp(hip_id)) {
        (Some(shoulder), Some(wrist), Some(hip)) => {
            let torso_height = (hip.y - shoulder.y).abs().max(1.0);
            let wrist_lift = ((shoulder.y - wrist.y) / torso_height).max(0.0);
            wrist_lift + (shoulder.visibility + wrist.visibility + hip.visibility) / 3.0 * 0.1
        }
        _ => 0.0,
    }
}

fn detect_shot_phase(keypoints: &[Keypoint]) -> String {
    let dominant_is_right = detect_shooting_hand(keypoints).contains("right");
    let (shoulder_id, elbow_id, wrist_id, hip_id) = if dominant_is_right {
        (12, 14, 16, 24)
    } else {
        (11, 13, 15, 23)
    };

    let get_kp = |id| keypoints.iter().find(|keypoint| keypoint.id == id);
    let (Some(shoulder), Some(elbow), Some(wrist), Some(hip)) = (
        get_kp(shoulder_id),
        get_kp(elbow_id),
        get_kp(wrist_id),
        get_kp(hip_id),
    ) else {
        return "unknown".to_string();
    };

    let elbow_angle = calculate_simple_angle(shoulder, elbow, wrist);
    let release_angle = calculate_release_from_keypoints(shoulder, wrist);
    let torso_height = (hip.y - shoulder.y).abs().max(1.0);
    let wrist_lift = (shoulder.y - wrist.y) / torso_height;

    if elbow_angle >= 154.0 && release_angle >= 72.0 && wrist_lift >= 0.72 {
        "follow_through".to_string()
    } else if elbow_angle >= 128.0 && release_angle >= 62.0 && wrist_lift >= 0.48 {
        "late_release".to_string()
    } else if wrist_lift >= 0.22 {
        "set_point".to_string()
    } else {
        "gather".to_string()
    }
}

fn calculate_simple_angle(p1: &Keypoint, p2: &Keypoint, p3: &Keypoint) -> f32 {
    let v1x = p1.x - p2.x;
    let v1y = p1.y - p2.y;
    let v2x = p3.x - p2.x;
    let v2y = p3.y - p2.y;

    let dot = v1x * v2x + v1y * v2y;
    let mag1 = (v1x * v1x + v1y * v1y).sqrt();
    let mag2 = (v2x * v2x + v2y * v2y).sqrt();

    if mag1 == 0.0 || mag2 == 0.0 {
        return 0.0;
    }

    let cos_angle = (dot / (mag1 * mag2)).clamp(-1.0, 1.0);
    cos_angle.acos().to_degrees()
}

fn calculate_release_from_keypoints(shoulder: &Keypoint, wrist: &Keypoint) -> f32 {
    let arm_x = wrist.x - shoulder.x;
    let arm_y = wrist.y - shoulder.y;
    let mag = (arm_x * arm_x + arm_y * arm_y).sqrt();

    if mag == 0.0 {
        return 0.0;
    }

    let cos_angle = (arm_x.abs() / mag).clamp(-1.0, 1.0);
    cos_angle.acos().to_degrees()
}
