use crate::models::{JointAngle, ShotType, VideoAnalysisFrame};

#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum TemporalPhase {
    Gather,
    SetPoint,
    Release,
    FollowThrough,
    Unknown,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemporalFeatures {
    pub set_point_ratio: f32,
    pub knee_elbow_lead_ratio: f32,
    pub plateau_sharpness: f32,
    pub phase_sequence_valid: bool,
    pub confidence: f32,
}

struct TemporalThreshold {
    set_point_ratio: (f32, f32),
    knee_elbow_lead_ratio: (f32, f32),
    plateau_sharpness: (f32, f32),
}

const ONE_MOTION_TEMPORAL: TemporalThreshold = TemporalThreshold {
    set_point_ratio: (0.05, 0.20),
    knee_elbow_lead_ratio: (0.00, 0.08),
    plateau_sharpness: (0.00, 0.25),
};

const ONE_POINT_FIVE_TEMPORAL: TemporalThreshold = TemporalThreshold {
    set_point_ratio: (0.12, 0.32),
    knee_elbow_lead_ratio: (0.06, 0.20),
    plateau_sharpness: (0.20, 0.55),
};

const TWO_MOTION_TEMPORAL: TemporalThreshold = TemporalThreshold {
    set_point_ratio: (0.25, 0.50),
    knee_elbow_lead_ratio: (0.15, 0.40),
    plateau_sharpness: (0.50, 0.95),
};

pub fn compute_temporal_features(frames: &[VideoAnalysisFrame]) -> TemporalFeatures {
    if frames.len() < 3 {
        return TemporalFeatures {
            set_point_ratio: 0.0,
            knee_elbow_lead_ratio: 0.0,
            plateau_sharpness: 0.0,
            phase_sequence_valid: false,
            confidence: 0.0,
        };
    }

    let phases: Vec<TemporalPhase> = frames.iter().map(|f| label_frame_phase(&f.analysis)).collect();

    let set_point_ratio = compute_set_point_ratio(&phases);
    let knee_elbow_lead_ratio = compute_knee_elbow_lead(frames, &phases);
    let plateau_sharpness = compute_plateau_sharpness(frames, &phases);
    let phase_sequence_valid = validate_phase_sequence(&phases);
    let confidence = compute_temporal_confidence(&phases, frames.len());

    TemporalFeatures {
        set_point_ratio,
        knee_elbow_lead_ratio,
        plateau_sharpness,
        phase_sequence_valid,
        confidence,
    }
}

pub fn classify_by_temporal(features: &TemporalFeatures) -> (ShotType, f32) {
    if features.confidence < 0.3 {
        return (ShotType::Unknown, features.confidence * 0.5);
    }

    let one_motion_score = temporal_match_score(features, &ONE_MOTION_TEMPORAL);
    let one_point_five_score = temporal_match_score(features, &ONE_POINT_FIVE_TEMPORAL);
    let two_motion_score = temporal_match_score(features, &TWO_MOTION_TEMPORAL);

    let scores = [
        (ShotType::OneMotion, one_motion_score),
        (ShotType::OnePointFiveMotion, one_point_five_score),
        (ShotType::TwoMotion, two_motion_score),
    ];

    let (best_type, best_score) = scores
        .iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(t, s)| (t.clone(), *s))
        .unwrap_or((ShotType::Unknown, 0.0));

    let second_score = scores
        .iter()
        .filter(|(t, _)| *t != best_type)
        .map(|(_, s)| *s)
        .fold(0.0_f32, f32::max);

    let margin = best_score - second_score;
    let confidence = (best_score * 0.6 + margin * 0.4).clamp(0.2, 0.85) * features.confidence;

    (best_type, confidence)
}

pub fn fuse_results(
    vote_result: ShotType,
    vote_confidence: f32,
    temporal_result: ShotType,
    temporal_confidence: f32,
    features: &TemporalFeatures,
) -> (ShotType, f32, Vec<String>) {
    let mut reasons = Vec::new();

    if features.confidence < 0.3 {
        reasons.push("关键帧不足或阶段序列不完整，时序节奏分析暂不可用，结果基于单帧投票。".to_string());
        return (vote_result, vote_confidence * 0.9, reasons);
    }

    if vote_result == temporal_result {
        let boosted = (vote_confidence * 0.6 + temporal_confidence * 0.4).clamp(0.28, 0.96);
        reasons.push(format!(
            "单帧分型与时序节奏分析均指向{}，判断更可靠。",
            vote_result.to_chinese()
        ));
        (vote_result, boosted, reasons)
    } else {
        let fused_confidence = (temporal_confidence * 0.65 + vote_confidence * 0.35).clamp(0.25, 0.88);
        reasons.push(format!(
            "单帧投票倾向{}，但时序节奏分析指向{}。节奏特征更能反映一段式/二段式的本质区别，以时序结果为准。",
            vote_result.to_chinese(),
            temporal_result.to_chinese()
        ));
        (temporal_result, fused_confidence, reasons)
    }
}

fn label_frame_phase(analysis: &crate::models::ShotAnalysis) -> TemporalPhase {
    let elbow_angle = find_angle_value(&analysis.angles, "shooting_elbow_angle")
        .or_else(|| find_angle_value(&analysis.angles, "right_elbow_angle"))
        .unwrap_or(0.0);

    let release_angle = find_angle_value(&analysis.angles, "release_angle").unwrap_or(0.0);

    let shoulder_angle = find_angle_value(&analysis.angles, "right_shoulder_angle")
        .or_else(|| find_angle_value(&analysis.angles, "left_shoulder_angle"))
        .unwrap_or(0.0);

    let set_point_height = estimate_set_point_height(&analysis);

    let has_sph = set_point_height > 0.0;

    if elbow_angle >= 154.0 && release_angle >= 72.0 && (!has_sph || set_point_height >= 0.72) {
        TemporalPhase::FollowThrough
    } else if elbow_angle >= 128.0 && release_angle >= 62.0 && (!has_sph || set_point_height >= 0.48) {
        TemporalPhase::Release
    } else if has_sph && set_point_height >= 0.22 && shoulder_angle >= 64.0 {
        TemporalPhase::SetPoint
    } else if !has_sph && shoulder_angle >= 64.0 && elbow_angle >= 90.0 && release_angle >= 50.0 {
        TemporalPhase::SetPoint
    } else {
        TemporalPhase::Gather
    }
}

fn estimate_set_point_height(analysis: &crate::models::ShotAnalysis) -> f32 {
    let get_kp = |id: u32| analysis.pose_data.keypoints.iter().find(|k| k.id == id);

    let (shoulder, wrist, hip) = if let (Some(rs), Some(rw), Some(rh)) = (get_kp(12), get_kp(16), get_kp(24)) {
        (rs, rw, rh)
    } else if let (Some(ls), Some(lw), Some(lh)) = (get_kp(11), get_kp(15), get_kp(23)) {
        (ls, lw, lh)
    } else {
        return 0.0;
    };

    let torso_length = ((hip.y - shoulder.y).abs()).max(1.0);
    ((shoulder.y - wrist.y) / torso_length).max(-0.5)
}

fn compute_set_point_ratio(phases: &[TemporalPhase]) -> f32 {
    let valid_count = phases
        .iter()
        .filter(|p| !matches!(p, TemporalPhase::Unknown))
        .count()
        .max(1);

    let set_point_count = phases
        .iter()
        .filter(|p| matches!(p, TemporalPhase::SetPoint))
        .count();

    set_point_count as f32 / valid_count as f32
}

fn compute_knee_elbow_lead(frames: &[VideoAnalysisFrame], phases: &[TemporalPhase]) -> f32 {
    let transition_start = phases.iter().position(|p| matches!(p, TemporalPhase::Gather));
    let transition_end = phases
        .iter()
        .position(|p| matches!(p, TemporalPhase::Release | TemporalPhase::FollowThrough));

    let (Some(start), Some(end)) = (transition_start, transition_end) else {
        return 0.0;
    };

    if end <= start {
        return 0.0;
    }

    let transition_len = (end - start).max(1);

    let knee_angles: Vec<f32> = frames
        .iter()
        .map(|f| {
            find_angle_value(&f.analysis.angles, "right_knee_angle")
                .or_else(|| find_angle_value(&f.analysis.angles, "left_knee_angle"))
                .unwrap_or(0.0)
        })
        .collect();

    let elbow_angles: Vec<f32> = frames
        .iter()
        .map(|f| {
            find_angle_value(&f.analysis.angles, "shooting_elbow_angle")
                .or_else(|| find_angle_value(&f.analysis.angles, "right_elbow_angle"))
                .or_else(|| find_angle_value(&f.analysis.angles, "left_elbow_angle"))
                .unwrap_or(0.0)
        })
        .collect();

    let knee_start = find_significant_increase_start(&knee_angles, start, end);
    let elbow_start = find_significant_increase_start(&elbow_angles, start, end);

    match (knee_start, elbow_start) {
        (Some(ks), Some(es)) => {
            if es >= ks {
                (es - ks) as f32 / transition_len as f32
            } else {
                0.0
            }
        }
        _ => 0.0,
    }
}

fn find_significant_increase_start(angles: &[f32], start: usize, end: usize) -> Option<usize> {
    if end <= start + 1 || angles.len() <= end {
        return None;
    }

    let window = ((end - start) / 3).max(2).min(4);
    let mut max_rate = 0.0_f32;

    for i in start..end.saturating_sub(window).min(angles.len().saturating_sub(window)) {
        if i + window < angles.len() {
            let rate = (angles[i + window] - angles[i]).abs() / window as f32;
            max_rate = max_rate.max(rate);
        }
    }

    if max_rate < 0.5 {
        return None;
    }

    let threshold = max_rate * 0.3;

    for i in start..end.saturating_sub(1).min(angles.len().saturating_sub(2)) {
        let next = (i + window).min(angles.len() - 1);
        let rate = (angles[next] - angles[i]).abs() / (next - i).max(1) as f32;
        if rate >= threshold {
            return Some(i);
        }
    }

    None
}

fn compute_plateau_sharpness(frames: &[VideoAnalysisFrame], phases: &[TemporalPhase]) -> f32 {
    let set_point_indices: Vec<usize> = phases
        .iter()
        .enumerate()
        .filter(|(_, p)| matches!(p, TemporalPhase::SetPoint))
        .map(|(i, _)| i)
        .collect();

    if set_point_indices.len() < 2 {
        return 0.0;
    }

    let gather_indices: Vec<usize> = phases
        .iter()
        .enumerate()
        .filter(|(_, p)| matches!(p, TemporalPhase::Gather))
        .map(|(i, _)| i)
        .collect();

    let elbow_angles: Vec<f32> = frames
        .iter()
        .map(|f| {
            find_angle_value(&f.analysis.angles, "shooting_elbow_angle")
                .or_else(|| find_angle_value(&f.analysis.angles, "right_elbow_angle"))
                .or_else(|| find_angle_value(&f.analysis.angles, "left_elbow_angle"))
                .unwrap_or(0.0)
        })
        .collect();

    let sp_change_rate = mean_abs_change_rate(&elbow_angles, &set_point_indices);

    let ref_change_rate = if gather_indices.len() >= 2 {
        mean_abs_change_rate(&elbow_angles, &gather_indices)
    } else {
        let all_indices: Vec<usize> = (0..frames.len()).collect();
        mean_abs_change_rate(&elbow_angles, &all_indices)
    };

    if ref_change_rate < 0.01 {
        return if sp_change_rate < 0.01 { 0.5 } else { 0.0 };
    }

    let ratio = (sp_change_rate / ref_change_rate).min(2.0);
    (1.0 - ratio).max(0.0).min(1.0)
}

fn mean_abs_change_rate(values: &[f32], indices: &[usize]) -> f32 {
    if indices.len() < 2 {
        return 0.0;
    }

    let sorted: Vec<usize> = {
        let mut s = indices.to_vec();
        s.sort();
        s
    };

    let mut total_change = 0.0_f32;
    let mut count = 0_usize;

    for window in sorted.windows(2) {
        let (a, b) = (window[0], window[1]);
        if a < values.len() && b < values.len() && b > a {
            total_change += (values[b] - values[a]).abs();
            count += b - a;
        }
    }

    if count == 0 {
        0.0
    } else {
        total_change / count as f32
    }
}

fn validate_phase_sequence(phases: &[TemporalPhase]) -> bool {
    let mut last_ordinal: usize = 0;
    let mut seen_phases = 0_usize;

    for phase in phases {
        let ordinal = match phase {
            TemporalPhase::Gather => 1,
            TemporalPhase::SetPoint => 2,
            TemporalPhase::Release => 3,
            TemporalPhase::FollowThrough => 4,
            TemporalPhase::Unknown => continue,
        };
        seen_phases += 1;

        if ordinal < last_ordinal.saturating_sub(1) {
            return false;
        }
        last_ordinal = ordinal.max(last_ordinal);
    }

    seen_phases >= 3
}

fn compute_temporal_confidence(phases: &[TemporalPhase], total_frames: usize) -> f32 {
    let valid_count = phases
        .iter()
        .filter(|p| !matches!(p, TemporalPhase::Unknown))
        .count();

    let density_score = (valid_count as f32 / total_frames.max(1) as f32).min(1.0);

    let distinct_phases = {
        let mut seen = [false; 5];
        for phase in phases {
            let idx = match phase {
                TemporalPhase::Gather => 0,
                TemporalPhase::SetPoint => 1,
                TemporalPhase::Release => 2,
                TemporalPhase::FollowThrough => 3,
                TemporalPhase::Unknown => 4,
            };
            seen[idx] = true;
        }
        seen[0..4].iter().filter(|&&v| v).count()
    };

    let phase_score = (distinct_phases as f32 / 4.0).min(1.0);

    let frame_score = if total_frames >= 8 {
        1.0
    } else if total_frames >= 5 {
        0.7
    } else if total_frames >= 3 {
        0.4
    } else {
        0.1
    };

    (density_score * 0.3 + phase_score * 0.4 + frame_score * 0.3).clamp(0.0, 1.0)
}

fn temporal_match_score(features: &TemporalFeatures, threshold: &TemporalThreshold) -> f32 {
    let sp_score = range_score(features.set_point_ratio, threshold.set_point_ratio, 0.12);
    let lead_score = range_score(features.knee_elbow_lead_ratio, threshold.knee_elbow_lead_ratio, 0.10);
    let plateau_score = range_score(features.plateau_sharpness, threshold.plateau_sharpness, 0.18);

    sp_score * 0.35 + lead_score * 0.40 + plateau_score * 0.25
}

fn range_score(value: f32, range: (f32, f32), softness: f32) -> f32 {
    let (min, max) = range;
    if value >= min && value <= max {
        return 1.0;
    }

    let edge = if value < min { min } else { max };
    let diff = value - edge;
    (-diff * diff / (2.0 * softness * softness)).exp()
}

fn find_angle_value(angles: &[JointAngle], name: &str) -> Option<f32> {
    angles
        .iter()
        .find(|a| a.name == name && a.status != "low_confidence")
        .map(|a| a.value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{JointAngle, PoseData, ShotAnalysis, ShotType};

    fn joint_angle(name: &str, value: f32) -> JointAngle {
        JointAngle {
            name: name.to_string(),
            value,
            normal_range: (0.0, 180.0),
            status: "normal".to_string(),
            confidence: 1.0,
        }
    }

    fn make_frame(index: u32, timestamp_ms: u32, angles: Vec<JointAngle>) -> VideoAnalysisFrame {
        VideoAnalysisFrame {
            index,
            timestamp_ms,
            image_data: String::new(),
            annotated_image_data: String::new(),
            analysis: ShotAnalysis {
                pose_data: PoseData::default(),
                angles,
                shot_type: ShotType::Unknown,
                shot_type_confidence: 0.5,
                shot_type_reasons: vec![],
                ai_review: None,
                timestamp: timestamp_ms as u64,
            },
        }
    }

    fn gather_angles() -> Vec<JointAngle> {
        vec![
            joint_angle("shooting_elbow_angle", 85.0),
            joint_angle("release_angle", 40.0),
            joint_angle("right_shoulder_angle", 55.0),
        ]
    }

    fn set_point_angles() -> Vec<JointAngle> {
        vec![
            joint_angle("shooting_elbow_angle", 100.0),
            joint_angle("release_angle", 58.0),
            joint_angle("right_shoulder_angle", 80.0),
        ]
    }

    fn release_angles() -> Vec<JointAngle> {
        vec![
            joint_angle("shooting_elbow_angle", 140.0),
            joint_angle("release_angle", 68.0),
            joint_angle("right_shoulder_angle", 95.0),
        ]
    }

    fn follow_through_angles() -> Vec<JointAngle> {
        vec![
            joint_angle("shooting_elbow_angle", 165.0),
            joint_angle("release_angle", 78.0),
            joint_angle("right_shoulder_angle", 110.0),
        ]
    }

    #[test]
    fn one_motion_sequence_has_low_set_point_ratio() {
        let frames = vec![
            make_frame(0, 0, gather_angles()),
            make_frame(1, 50, gather_angles()),
            make_frame(2, 100, gather_angles()),
            make_frame(3, 150, gather_angles()),
            make_frame(4, 200, set_point_angles()),
            make_frame(5, 250, release_angles()),
            make_frame(6, 300, release_angles()),
            make_frame(7, 350, release_angles()),
            make_frame(8, 400, follow_through_angles()),
            make_frame(9, 450, follow_through_angles()),
        ];

        let features = compute_temporal_features(&frames);

        assert!(features.set_point_ratio < 0.25, "one-motion set_point_ratio should be low, got {}", features.set_point_ratio);
        assert!(features.phase_sequence_valid);
        assert!(features.confidence > 0.3);
    }

    #[test]
    fn two_motion_sequence_has_high_set_point_ratio() {
        let frames = vec![
            make_frame(0, 0, gather_angles()),
            make_frame(1, 50, gather_angles()),
            make_frame(2, 100, set_point_angles()),
            make_frame(3, 150, set_point_angles()),
            make_frame(4, 200, set_point_angles()),
            make_frame(5, 250, set_point_angles()),
            make_frame(6, 300, set_point_angles()),
            make_frame(7, 350, release_angles()),
            make_frame(8, 400, release_angles()),
            make_frame(9, 450, follow_through_angles()),
        ];

        let features = compute_temporal_features(&frames);

        assert!(features.set_point_ratio > 0.25, "two-motion set_point_ratio should be high, got {}", features.set_point_ratio);
        assert!(features.phase_sequence_valid);
    }

    #[test]
    fn slow_motion_preserves_ratios() {
        let normal = vec![
            make_frame(0, 0, gather_angles()),
            make_frame(1, 50, gather_angles()),
            make_frame(2, 100, set_point_angles()),
            make_frame(3, 150, release_angles()),
            make_frame(4, 200, follow_through_angles()),
        ];

        let slow = vec![
            make_frame(0, 0, gather_angles()),
            make_frame(1, 100, gather_angles()),
            make_frame(2, 200, gather_angles()),
            make_frame(3, 300, set_point_angles()),
            make_frame(4, 400, set_point_angles()),
            make_frame(5, 500, release_angles()),
            make_frame(6, 600, release_angles()),
            make_frame(7, 700, follow_through_angles()),
            make_frame(8, 800, follow_through_angles()),
        ];

        let normal_features = compute_temporal_features(&normal);
        let slow_features = compute_temporal_features(&slow);

        let ratio_diff = (normal_features.set_point_ratio - slow_features.set_point_ratio).abs();
        assert!(ratio_diff < 0.15, "slow motion should preserve set_point_ratio, diff={}", ratio_diff);
    }

    #[test]
    fn insufficient_frames_give_low_confidence() {
        let frames = vec![make_frame(0, 0, gather_angles())];

        let features = compute_temporal_features(&frames);

        assert!(features.confidence < 0.3);
    }

    #[test]
    fn phase_regression_invalidates_sequence() {
        let frames = vec![
            make_frame(0, 0, release_angles()),
            make_frame(1, 50, gather_angles()),
            make_frame(2, 100, release_angles()),
            make_frame(3, 150, gather_angles()),
            make_frame(4, 200, follow_through_angles()),
        ];

        let features = compute_temporal_features(&frames);

        assert!(!features.phase_sequence_valid);
    }

    #[test]
    fn temporal_classify_one_motion() {
        let features = TemporalFeatures {
            set_point_ratio: 0.10,
            knee_elbow_lead_ratio: 0.03,
            plateau_sharpness: 0.10,
            phase_sequence_valid: true,
            confidence: 0.8,
        };

        let (shot_type, confidence) = classify_by_temporal(&features);

        assert_eq!(shot_type, ShotType::OneMotion);
        assert!(confidence > 0.3);
    }

    #[test]
    fn temporal_classify_two_motion() {
        let features = TemporalFeatures {
            set_point_ratio: 0.38,
            knee_elbow_lead_ratio: 0.25,
            plateau_sharpness: 0.70,
            phase_sequence_valid: true,
            confidence: 0.8,
        };

        let (shot_type, confidence) = classify_by_temporal(&features);

        assert_eq!(shot_type, ShotType::TwoMotion);
        assert!(confidence > 0.3);
    }

    #[test]
    fn fuse_agrees_boosts_confidence() {
        let features = TemporalFeatures {
            set_point_ratio: 0.10,
            knee_elbow_lead_ratio: 0.03,
            plateau_sharpness: 0.10,
            phase_sequence_valid: true,
            confidence: 0.8,
        };

        let (result, confidence, _) = fuse_results(
            ShotType::OneMotion,
            0.75,
            ShotType::OneMotion,
            0.65,
            &features,
        );

        assert_eq!(result, ShotType::OneMotion);
        assert!(confidence > 0.65, "fused confidence should exceed temporal confidence when agreeing, got {}", confidence);
    }

    #[test]
    fn fuse_conflict_prefers_temporal() {
        let features = TemporalFeatures {
            set_point_ratio: 0.10,
            knee_elbow_lead_ratio: 0.03,
            plateau_sharpness: 0.10,
            phase_sequence_valid: true,
            confidence: 0.8,
        };

        let (result, _, reasons) = fuse_results(
            ShotType::TwoMotion,
            0.70,
            ShotType::OneMotion,
            0.60,
            &features,
        );

        assert_eq!(result, ShotType::OneMotion);
        assert!(reasons.iter().any(|r| r.contains("时序节奏")));
    }

    #[test]
    fn fuse_low_confidence_falls_back_to_vote() {
        let features = TemporalFeatures {
            set_point_ratio: 0.10,
            knee_elbow_lead_ratio: 0.03,
            plateau_sharpness: 0.10,
            phase_sequence_valid: false,
            confidence: 0.15,
        };

        let (result, _, reasons) = fuse_results(
            ShotType::TwoMotion,
            0.70,
            ShotType::OneMotion,
            0.30,
            &features,
        );

        assert_eq!(result, ShotType::TwoMotion);
        assert!(reasons.iter().any(|r| r.contains("单帧投票")));
    }
}
