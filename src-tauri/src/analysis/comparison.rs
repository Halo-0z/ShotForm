use std::{
    cmp::Ordering,
    collections::{BTreeMap, HashMap},
};

use crate::models::{
    AngleDifference, CanonicalAngleProfile, ComparisonDetailPayload, ComparisonLearningBridge,
    ComparisonMode, ComparisonResult, ComparisonSummary, ComparisonWorkbenchSnapshot, JointAngle,
    Keypoint, PhaseAngleProfile, PlayerTemplate, PlayerTemplateProfile, PoseData, ShotAnalysis,
    ShotType,
};

pub struct PoseComparator;

const PROFILE_PHASE_WEIGHTS: [(&str, f32); 3] =
    [("setup", 0.24), ("release", 0.48), ("follow_through", 0.28)];

impl PoseComparator {
    pub fn new() -> Self {
        Self
    }

    pub fn compare(&self, analysis: &ShotAnalysis, player: &PlayerTemplate) -> ComparisonResult {
        self.compare_with_profile(analysis, None, player)
    }

    pub fn compare_with_profile(
        &self,
        analysis: &ShotAnalysis,
        analysis_profile: Option<&PlayerTemplateProfile>,
        player: &PlayerTemplate,
    ) -> ComparisonResult {
        let dominant_side = self.detect_shooting_side(analysis);
        if let (Some(user_profile), Some(player_profile)) =
            (analysis_profile, player.template_profile.as_ref())
        {
            if let Some((similarity, angle_differences)) =
                self.compare_video_profiles(user_profile, player_profile, dominant_side)
            {
                return ComparisonResult {
                    player: player.clone(),
                    similarity,
                    angle_differences,
                    comparison_mode: ComparisonMode::VideoLevel,
                };
            }
        }

        let angle_differences =
            self.calculate_angle_differences(&analysis.angles, &player.angles, dominant_side);
        let similarity =
            self.calculate_weighted_similarity(&angle_differences, &comparison_weights());

        ComparisonResult {
            player: player.clone(),
            similarity,
            angle_differences,
            comparison_mode: ComparisonMode::SingleFrameFallback,
        }
    }

    pub fn rank_players(
        &self,
        analysis: &ShotAnalysis,
        players: &[PlayerTemplate],
    ) -> Vec<ComparisonSummary> {
        self.rank_players_with_profile(analysis, None, players)
    }

    pub fn rank_players_with_profile(
        &self,
        analysis: &ShotAnalysis,
        analysis_profile: Option<&PlayerTemplateProfile>,
        players: &[PlayerTemplate],
    ) -> Vec<ComparisonSummary> {
        let ranked_results = rank_comparison_results(self, analysis, analysis_profile, players);
        ranked_results
            .iter()
            .map(|result| build_summary_from_result(analysis, result))
            .collect()
    }

    fn calculate_angle_differences(
        &self,
        user_angles: &[JointAngle],
        player_angles: &[JointAngle],
        dominant_side: ShootingSide,
    ) -> Vec<AngleDifference> {
        user_angles
            .iter()
            .filter_map(|user_angle| {
                let canonical_name = self.canonical_angle_name(&user_angle.name, dominant_side);
                player_angles
                    .iter()
                    .find(|pa| pa.name == canonical_name)
                    .map(|player_angle| AngleDifference {
                        name: canonical_name.to_string(),
                        user_value: user_angle.value,
                        player_value: player_angle.value,
                        difference: user_angle.value - player_angle.value,
                    })
            })
            .collect()
    }

    fn detect_shooting_side(&self, analysis: &ShotAnalysis) -> ShootingSide {
        let get_kp = |id: u32| {
            analysis
                .pose_data
                .keypoints
                .iter()
                .find(|keypoint| keypoint.id == id)
        };

        let left_score = self.side_score(get_kp(11), get_kp(15), get_kp(23));
        let right_score = self.side_score(get_kp(12), get_kp(16), get_kp(24));

        if left_score > right_score {
            ShootingSide::Left
        } else {
            ShootingSide::Right
        }
    }

    fn side_score(
        &self,
        shoulder: Option<&Keypoint>,
        wrist: Option<&Keypoint>,
        hip: Option<&Keypoint>,
    ) -> f32 {
        match (shoulder, wrist, hip) {
            (Some(shoulder), Some(wrist), Some(hip)) => {
                let torso_height = (hip.y - shoulder.y).abs().max(1.0);
                let wrist_lift = ((shoulder.y - wrist.y) / torso_height).max(0.0);
                wrist_lift + (shoulder.visibility + wrist.visibility + hip.visibility) / 3.0 * 0.1
            }
            _ => 0.0,
        }
    }

    fn canonical_angle_name<'a>(&self, name: &'a str, dominant_side: ShootingSide) -> &'a str {
        if dominant_side == ShootingSide::Right {
            return name;
        }

        match name {
            "left_elbow_angle" => "right_elbow_angle",
            "left_shoulder_angle" => "right_shoulder_angle",
            "left_knee_angle" => "right_knee_angle",
            "left_hip_angle" => "right_hip_angle",
            _ => name,
        }
    }

    pub fn calculate_weighted_similarity(
        &self,
        differences: &[AngleDifference],
        weights: &[(String, f32)],
    ) -> f32 {
        if differences.is_empty() {
            return 0.0;
        }

        let weight_map: std::collections::HashMap<String, f32> = weights
            .iter()
            .map(|(name, weight)| (name.clone(), *weight))
            .collect();

        let total_weight: f32 = differences
            .iter()
            .map(|difference| weight_map.get(&difference.name).unwrap_or(&1.0))
            .sum();

        let weighted_diff: f32 = differences
            .iter()
            .map(|difference| {
                let weight = weight_map.get(&difference.name).unwrap_or(&1.0);
                let normalized_diff = difference.difference.abs() / 180.0;
                weight * normalized_diff * normalized_diff
            })
            .sum();

        if total_weight == 0.0 {
            return 0.0;
        }

        let rmse = (weighted_diff / total_weight).sqrt();
        (1.0 - rmse).max(0.0)
    }

    fn compare_video_profiles(
        &self,
        user_profile: &PlayerTemplateProfile,
        player_profile: &PlayerTemplateProfile,
        dominant_side: ShootingSide,
    ) -> Option<(f32, Vec<AngleDifference>)> {
        let mut weighted_similarity = 0.0;
        let mut matched_phase_weight = 0.0;
        let mut rolled_up = BTreeMap::<String, (f32, f32, f32)>::new();
        let weights = comparison_weights();

        for (phase_name, phase_weight) in PROFILE_PHASE_WEIGHTS {
            let Some(user_phase) = user_profile.phase_profiles.get(phase_name) else {
                continue;
            };
            let Some(player_phase) = player_profile.phase_profiles.get(phase_name) else {
                continue;
            };

            let phase_differences =
                self.calculate_phase_angle_differences(user_phase, player_phase, dominant_side);
            if phase_differences.is_empty() {
                continue;
            }

            let effective_weight = phase_weight;
            let phase_similarity = self.calculate_weighted_similarity(&phase_differences, &weights);

            weighted_similarity += phase_similarity * effective_weight;
            matched_phase_weight += effective_weight;

            for difference in phase_differences {
                let entry = rolled_up
                    .entry(difference.name.clone())
                    .or_insert((0.0, 0.0, 0.0));
                entry.0 += difference.user_value * effective_weight;
                entry.1 += difference.player_value * effective_weight;
                entry.2 += effective_weight;
            }
        }

        if matched_phase_weight == 0.0 || rolled_up.is_empty() {
            return None;
        }

        let mut angle_differences = rolled_up
            .into_iter()
            .filter_map(|(name, (user_sum, player_sum, weight_sum))| {
                if weight_sum <= 0.0 {
                    return None;
                }

                let user_value = user_sum / weight_sum;
                let player_value = player_sum / weight_sum;
                Some(AngleDifference {
                    name,
                    user_value,
                    player_value,
                    difference: user_value - player_value,
                })
            })
            .collect::<Vec<_>>();

        angle_differences.sort_by(|left, right| left.name.cmp(&right.name));

        let total_expected_weight = PROFILE_PHASE_WEIGHTS
            .iter()
            .map(|(_, weight)| *weight)
            .sum::<f32>()
            .max(0.0001);
        let phase_completeness = (matched_phase_weight / total_expected_weight).clamp(0.0, 1.0);
        let base_similarity = weighted_similarity / matched_phase_weight.max(0.0001);
        let similarity = (base_similarity * phase_completeness).clamp(0.0, 1.0);

        Some((similarity, angle_differences))
    }

    fn calculate_phase_angle_differences(
        &self,
        user_phase: &PhaseAngleProfile,
        player_phase: &PhaseAngleProfile,
        dominant_side: ShootingSide,
    ) -> Vec<AngleDifference> {
        let player_angles = self.profile_angle_map(&player_phase.angles, dominant_side);

        user_phase
            .angles
            .iter()
            .filter_map(|user_angle| {
                let canonical_name = self
                    .canonical_angle_name(&user_angle.name, dominant_side)
                    .to_string();
                player_angles
                    .get(&canonical_name)
                    .map(|player_angle| AngleDifference {
                        name: canonical_name,
                        user_value: user_angle.value,
                        player_value: player_angle.value,
                        difference: user_angle.value - player_angle.value,
                    })
            })
            .collect()
    }

    fn profile_angle_map(
        &self,
        angles: &[CanonicalAngleProfile],
        dominant_side: ShootingSide,
    ) -> BTreeMap<String, CanonicalAngleProfile> {
        angles
            .iter()
            .map(|angle| {
                (
                    self.canonical_angle_name(&angle.name, dominant_side)
                        .to_string(),
                    angle.clone(),
                )
            })
            .collect()
    }

    fn top_differences(
        &self,
        differences: &[AngleDifference],
        weights: &[(String, f32)],
    ) -> Vec<AngleDifference> {
        let weight_map = self.weight_map(weights);
        let mut ranked = differences.to_vec();
        ranked.sort_by(|left, right| {
            let left_weighted_gap =
                self.difference_weight(&weight_map, &left.name) * left.difference.abs();
            let right_weighted_gap =
                self.difference_weight(&weight_map, &right.name) * right.difference.abs();

            right_weighted_gap
                .partial_cmp(&left_weighted_gap)
                .unwrap_or(Ordering::Equal)
                .then_with(|| {
                    right
                        .difference
                        .abs()
                        .partial_cmp(&left.difference.abs())
                        .unwrap_or(Ordering::Equal)
                })
                .then_with(|| left.name.cmp(&right.name))
        });
        ranked.truncate(3);
        ranked
    }

    fn build_match_reason(
        &self,
        analysis: &ShotAnalysis,
        result: &ComparisonResult,
        differences: &[AngleDifference],
        weights: &[(String, f32)],
    ) -> String {
        let mut reasons = Vec::new();
        let player = &result.player;

        if let Some(alignment) = self.shot_type_alignment(analysis, player) {
            reasons.push(alignment);
        }

        let closest_signals = self.closest_alignment_names(differences, weights);
        if !closest_signals.is_empty() {
            reasons.push(format!(
                "最接近的动作重合点在{}",
                self.join_labels(&closest_signals)
            ));
        }

        if let Some(balance_signal) = differences.iter().find(|difference| {
            matches!(
                difference.name.as_str(),
                "trunk_tilt"
                    | "right_knee_angle"
                    | "left_knee_angle"
                    | "right_hip_angle"
                    | "left_hip_angle"
            ) && difference.difference.abs() <= 10.0
        }) {
            reasons.push(format!(
                "{}的发力控制比较接近",
                self.angle_label(&balance_signal.name)
            ));
        }

        if reasons.is_empty() {
            if result.comparison_mode == ComparisonMode::VideoLevel {
                format!("{} 在完整投篮节奏上最接近你。", player.name)
            } else {
                format!("{} 是当前加权动作特征最接近的模板。", player.name)
            }
        } else if result.comparison_mode == ComparisonMode::VideoLevel {
            format!(
                "{} 在整段投篮节奏上接近你，因为{}。",
                player.name,
                reasons.join("，")
            )
        } else {
            format!("{} 排名靠前，因为{}。", player.name, reasons.join("，"))
        }
    }

    fn closest_alignment_names(
        &self,
        differences: &[AngleDifference],
        weights: &[(String, f32)],
    ) -> Vec<String> {
        let weight_map = self.weight_map(weights);
        let mut closest: Vec<_> = differences.iter().collect();
        closest.sort_by(|left, right| {
            let left_weighted_gap =
                self.difference_weight(&weight_map, &left.name) * left.difference.abs();
            let right_weighted_gap =
                self.difference_weight(&weight_map, &right.name) * right.difference.abs();

            left_weighted_gap
                .partial_cmp(&right_weighted_gap)
                .unwrap_or(Ordering::Equal)
                .then_with(|| {
                    left.difference
                        .abs()
                        .partial_cmp(&right.difference.abs())
                        .unwrap_or(Ordering::Equal)
                })
                .then_with(|| left.name.cmp(&right.name))
        });

        closest
            .into_iter()
            .take(2)
            .map(|difference| self.angle_label(&difference.name))
            .collect()
    }

    fn shot_type_alignment(
        &self,
        analysis: &ShotAnalysis,
        player: &PlayerTemplate,
    ) -> Option<String> {
        if analysis.shot_type == ShotType::Unknown {
            return None;
        }

        let player_shot_type = self.infer_player_shot_type(player)?;
        if player_shot_type == analysis.shot_type {
            Some(format!(
                "投篮类型与{}模板一致",
                self.shot_type_label(&player_shot_type)
            ))
        } else {
            Some(format!(
                "{}和{}虽然投篮分型不同，但关键动作仍有可迁移的相似点",
                self.shot_type_label(&analysis.shot_type),
                self.shot_type_label(&player_shot_type)
            ))
        }
    }

    fn infer_player_shot_type(&self, player: &PlayerTemplate) -> Option<ShotType> {
        let description = player.description.to_ascii_lowercase();

        if description.contains("1.5") || description.contains("one point five") {
            Some(ShotType::OnePointFiveMotion)
        } else if description.contains("two-motion") || description.contains("2") {
            Some(ShotType::TwoMotion)
        } else if description.contains("one-motion") || description.contains("1") {
            Some(ShotType::OneMotion)
        } else {
            None
        }
    }

    fn shot_type_label(&self, shot_type: &ShotType) -> &'static str {
        match shot_type {
            ShotType::OneMotion => "一段式",
            ShotType::OnePointFiveMotion => "一点五段式",
            ShotType::TwoMotion => "二段式",
            ShotType::Unknown => "未知",
        }
    }

    fn angle_label(&self, name: &str) -> String {
        match name {
            "left_elbow_angle" | "right_elbow_angle" | "shooting_elbow_angle" => {
                "出手肘角".to_string()
            }
            "left_shoulder_angle" | "right_shoulder_angle" | "release_angle" => {
                "肩部与出手线路".to_string()
            }
            "left_knee_angle" | "right_knee_angle" => "膝部蓄力".to_string(),
            "left_hip_angle" | "right_hip_angle" => "髋部支撑".to_string(),
            "trunk_tilt" => "躯干倾角".to_string(),
            "shoulder_tilt" => "肩线倾角".to_string(),
            _ => name.replace('_', " "),
        }
    }

    fn join_labels(&self, labels: &[String]) -> String {
        match labels {
            [] => String::new(),
            [single] => single.clone(),
            [first, second] => format!("{first}和{second}"),
            _ => {
                let mut joined = labels[..labels.len() - 1].join("、");
                joined.push_str("和");
                joined.push_str(labels.last().unwrap());
                joined
            }
        }
    }

    fn weight_map<'a>(&self, weights: &'a [(String, f32)]) -> HashMap<&'a str, f32> {
        weights
            .iter()
            .map(|(name, weight)| (name.as_str(), *weight))
            .collect()
    }

    fn difference_weight(&self, weight_map: &HashMap<&str, f32>, name: &str) -> f32 {
        *weight_map.get(name).unwrap_or(&1.0)
    }
}

impl Default for PoseComparator {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum ShootingSide {
    Left,
    Right,
}

pub fn comparison_weights() -> Vec<(String, f32)> {
    vec![
        ("shooting_elbow_angle".to_string(), 2.6),
        ("right_elbow_angle".to_string(), 2.4),
        ("left_elbow_angle".to_string(), 2.4),
        ("release_angle".to_string(), 2.3),
        ("right_shoulder_angle".to_string(), 2.1),
        ("left_shoulder_angle".to_string(), 2.1),
        ("trunk_tilt".to_string(), 1.6),
        ("right_hip_angle".to_string(), 1.4),
        ("left_hip_angle".to_string(), 1.4),
        ("right_knee_angle".to_string(), 1.3),
        ("left_knee_angle".to_string(), 1.3),
        ("shoulder_tilt".to_string(), 1.1),
    ]
}

pub fn get_default_player_templates() -> Vec<PlayerTemplate> {
    vec![
        PlayerTemplate {
            id: 1,
            name: "斯蒂芬·库里".to_string(),
            team: "金州勇士".to_string(),
            description: "NBA 历史级射手，典型 1 段式投篮代表。".to_string(),
            pose_data: PoseData {
                keypoints: vec![],
                width: 640,
                height: 480,
            },
            angles: vec![
                JointAngle {
                    name: "right_elbow_angle".to_string(),
                    value: 85.0,
                    normal_range: (70.0, 100.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_knee_angle".to_string(),
                    value: 140.0,
                    normal_range: (130.0, 150.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_shoulder_angle".to_string(),
                    value: 45.0,
                    normal_range: (30.0, 60.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "trunk_tilt".to_string(),
                    value: 5.0,
                    normal_range: (0.0, 10.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
            ],
            template_profile: None,
        },
        PlayerTemplate {
            id: 2,
            name: "科比·布莱恩特".to_string(),
            team: "洛杉矶湖人".to_string(),
            description: "NBA 传奇球星，典型 2 段式投篮代表。".to_string(),
            pose_data: PoseData {
                keypoints: vec![],
                width: 640,
                height: 480,
            },
            angles: vec![
                JointAngle {
                    name: "right_elbow_angle".to_string(),
                    value: 100.0,
                    normal_range: (90.0, 110.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_knee_angle".to_string(),
                    value: 160.0,
                    normal_range: (150.0, 170.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_shoulder_angle".to_string(),
                    value: 65.0,
                    normal_range: (50.0, 80.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "trunk_tilt".to_string(),
                    value: 8.0,
                    normal_range: (0.0, 15.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
            ],
            template_profile: None,
        },
        PlayerTemplate {
            id: 3,
            name: "迈克尔·乔丹".to_string(),
            team: "芝加哥公牛".to_string(),
            description: "篮球之神，经典后仰与中距离投篮代表。".to_string(),
            pose_data: PoseData {
                keypoints: vec![],
                width: 640,
                height: 480,
            },
            angles: vec![
                JointAngle {
                    name: "right_elbow_angle".to_string(),
                    value: 95.0,
                    normal_range: (85.0, 105.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_knee_angle".to_string(),
                    value: 155.0,
                    normal_range: (145.0, 165.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_shoulder_angle".to_string(),
                    value: 60.0,
                    normal_range: (45.0, 75.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "trunk_tilt".to_string(),
                    value: 10.0,
                    normal_range: (0.0, 15.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
            ],
            template_profile: None,
        },
        PlayerTemplate {
            id: 4,
            name: "克莱·汤普森".to_string(),
            team: "金州勇士".to_string(),
            description: "顶级 3D 球员，典型 1.5 段式投篮代表。".to_string(),
            pose_data: PoseData {
                keypoints: vec![],
                width: 640,
                height: 480,
            },
            angles: vec![
                JointAngle {
                    name: "right_elbow_angle".to_string(),
                    value: 90.0,
                    normal_range: (80.0, 100.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_knee_angle".to_string(),
                    value: 150.0,
                    normal_range: (140.0, 160.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "right_shoulder_angle".to_string(),
                    value: 55.0,
                    normal_range: (40.0, 70.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
                JointAngle {
                    name: "trunk_tilt".to_string(),
                    value: 6.0,
                    normal_range: (0.0, 12.0),
                    status: "normal".to_string(),
                    confidence: 1.0,
                },
            ],
            template_profile: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

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

    fn joint_angle(name: &str, value: f32) -> JointAngle {
        JointAngle {
            name: name.to_string(),
            value,
            normal_range: (0.0, 180.0),
            status: "normal".to_string(),
            confidence: 1.0,
        }
    }

    fn profile_angle(name: &str, value: f32) -> CanonicalAngleProfile {
        CanonicalAngleProfile {
            name: name.to_string(),
            value,
            confidence: 1.0,
        }
    }

    fn phase_profile(phase: &str, angles: Vec<CanonicalAngleProfile>) -> PhaseAngleProfile {
        PhaseAngleProfile {
            phase: phase.to_string(),
            sample_count: angles.len().max(1),
            coverage: if angles.is_empty() { 0.0 } else { 1.0 },
            angles,
        }
    }

    fn video_profile(phases: Vec<(&str, Vec<CanonicalAngleProfile>)>) -> PlayerTemplateProfile {
        let phase_profiles = phases
            .into_iter()
            .map(|(phase, angles)| (phase.to_string(), phase_profile(phase, angles)))
            .collect::<BTreeMap<_, _>>();

        PlayerTemplateProfile {
            version: 1,
            source_kind: "video".to_string(),
            overall_shot_type: "one_motion".to_string(),
            representative_frame_index: Some(1),
            representative_timestamp_ms: Some(120),
            samples_used: phase_profiles.len(),
            coverage: 1.0,
            phase_profiles,
        }
    }

    fn sample_analysis() -> ShotAnalysis {
        ShotAnalysis {
            pose_data: PoseData {
                keypoints: vec![
                    keypoint(11, -20.0, 0.0),
                    keypoint(15, -35.0, 20.0),
                    keypoint(23, -20.0, 100.0),
                    keypoint(12, 20.0, 0.0),
                    keypoint(16, 35.0, -30.0),
                    keypoint(24, 20.0, 100.0),
                ],
                width: 640,
                height: 480,
            },
            angles: vec![
                joint_angle("right_elbow_angle", 90.0),
                joint_angle("right_shoulder_angle", 48.0),
                joint_angle("right_knee_angle", 145.0),
                joint_angle("trunk_tilt", 5.0),
            ],
            shot_type: ShotType::OneMotion,
            shot_type_confidence: 0.88,
            shot_type_reasons: vec![],
            ai_review: None,
            timestamp: 0,
        }
    }

    fn closer_player() -> PlayerTemplate {
        PlayerTemplate {
            id: 10,
            name: "Closer".to_string(),
            team: "A".to_string(),
            description: "compact one-motion release".to_string(),
            pose_data: PoseData::default(),
            angles: vec![
                joint_angle("right_elbow_angle", 91.0),
                joint_angle("right_shoulder_angle", 50.0),
                joint_angle("right_knee_angle", 144.0),
                joint_angle("trunk_tilt", 4.0),
            ],
            template_profile: None,
        }
    }

    fn farther_player() -> PlayerTemplate {
        PlayerTemplate {
            id: 11,
            name: "Farther".to_string(),
            team: "B".to_string(),
            description: "tall two-motion release".to_string(),
            pose_data: PoseData::default(),
            angles: vec![
                joint_angle("right_elbow_angle", 120.0),
                joint_angle("right_shoulder_angle", 80.0),
                joint_angle("right_knee_angle", 170.0),
                joint_angle("trunk_tilt", 16.0),
            ],
            template_profile: None,
        }
    }

    #[test]
    fn matches_left_handed_user_angles_to_right_handed_template() {
        let comparator = PoseComparator::new();
        let analysis = ShotAnalysis {
            pose_data: PoseData {
                keypoints: vec![
                    keypoint(11, -20.0, 0.0),
                    keypoint(15, -35.0, -30.0),
                    keypoint(23, -20.0, 100.0),
                    keypoint(12, 20.0, 0.0),
                    keypoint(16, 35.0, 40.0),
                    keypoint(24, 20.0, 100.0),
                ],
                width: 640,
                height: 480,
            },
            angles: vec![
                joint_angle("left_elbow_angle", 88.0),
                joint_angle("left_knee_angle", 148.0),
                joint_angle("left_shoulder_angle", 52.0),
                joint_angle("trunk_tilt", 6.0),
            ],
            shot_type: ShotType::Unknown,
            shot_type_confidence: 0.0,
            shot_type_reasons: vec![],
            ai_review: None,
            timestamp: 0,
        };
        let player = PlayerTemplate {
            id: 1,
            name: "template".to_string(),
            team: "team".to_string(),
            description: "desc".to_string(),
            pose_data: PoseData::default(),
            angles: vec![
                joint_angle("right_elbow_angle", 85.0),
                joint_angle("right_knee_angle", 150.0),
                joint_angle("right_shoulder_angle", 55.0),
                joint_angle("trunk_tilt", 5.0),
            ],
            template_profile: None,
        };

        let result = comparator.compare(&analysis, &player);

        assert_eq!(result.angle_differences.len(), 4);
        assert!(result.similarity > 0.95);
        assert!(result
            .angle_differences
            .iter()
            .any(|difference| difference.name == "right_elbow_angle"));
    }

    #[test]
    fn ranks_players_by_weighted_similarity_and_builds_match_reason() {
        let comparator = PoseComparator::new();
        let analysis = sample_analysis();
        let players = vec![farther_player(), closer_player()];

        let ranked = comparator.rank_players(&analysis, &players);

        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].player.name, "Closer");
        assert!(ranked[0].similarity > ranked[1].similarity);
        assert!(!ranked[0].match_reason.trim().is_empty());
        assert!(ranked[0].match_reason.contains("排名靠前"));
        assert!(!ranked[0].match_reason.contains("ranks highly"));
        assert!(!ranked[0].match_reason.contains("mechanical overlap"));
        assert!(ranked[0].top_differences.len() <= 3);
    }

    #[test]
    fn build_detail_payload_matches_learning_bridge_parity_baseline() {
        let payload = build_detail_payload(ComparisonResult {
            player: PlayerTemplate {
                id: 30,
                name: "Parity Player".to_string(),
                team: "Parity".to_string(),
                description: "template".to_string(),
                pose_data: PoseData::default(),
                angles: Vec::new(),
                template_profile: None,
            },
            similarity: 0.92,
            angle_differences: vec![
                AngleDifference {
                    name: "release_angle".to_string(),
                    user_value: 74.0,
                    player_value: 62.0,
                    difference: 12.0,
                },
                AngleDifference {
                    name: "right_knee_angle".to_string(),
                    user_value: 132.0,
                    player_value: 140.0,
                    difference: -8.0,
                },
                AngleDifference {
                    name: "trunk_tilt".to_string(),
                    user_value: 13.0,
                    player_value: 8.0,
                    difference: 5.0,
                },
                AngleDifference {
                    name: "right_elbow_angle".to_string(),
                    user_value: 96.0,
                    player_value: 94.0,
                    difference: 2.0,
                },
            ],
            comparison_mode: ComparisonMode::SingleFrameFallback,
        });

        assert_eq!(payload.result.player.id, 30);
        assert_eq!(
            payload.learning_bridge.intro,
            "先从 Parity Player 身上最不像的一到两个关节开始修正，再回看建议区验证动作是否更接近模板。"
        );
        assert_eq!(payload.learning_bridge.gaps.len(), 3);
        assert_eq!(payload.learning_bridge.gaps[0].title, "出手角偏大 12.0°");
        assert_eq!(
            payload.learning_bridge.gaps[0].detail,
            "优先对齐出手肘部和抬手线路，让出手轨迹先稳定下来。"
        );
        assert_eq!(payload.learning_bridge.gaps[1].title, "右膝角偏小 8.0°");
        assert_eq!(
            payload.learning_bridge.gaps[1].detail,
            "先调整下肢加载深度和蹬伸节奏，让力量链条更接近模板。"
        );
        assert_eq!(payload.learning_bridge.gaps[2].title, "躯干倾斜偏大 5.0°");
        assert_eq!(
            payload.learning_bridge.gaps[2].detail,
            "先控制躯干和整体平衡，让发力链条保持在同一条线上。"
        );
    }

    #[test]
    fn build_workbench_snapshot_returns_default_selected_detail_for_top_ranked_player() {
        let analysis = sample_analysis();
        let snapshot = build_workbench_snapshot(
            "analysis-1",
            &analysis,
            None,
            &[farther_player(), closer_player()],
        );

        assert_eq!(snapshot.analysis_key, "analysis-1");
        assert_eq!(snapshot.summaries.len(), 2);
        assert_eq!(snapshot.summaries[0].player.id, 10);
        assert_eq!(
            snapshot.summaries[0]
                .top_differences
                .iter()
                .map(|difference| difference.name.as_str())
                .collect::<Vec<_>>(),
            vec!["right_shoulder_angle", "right_elbow_angle", "trunk_tilt"]
        );
        assert_eq!(
            snapshot.summaries[0].comparison_mode,
            ComparisonMode::SingleFrameFallback
        );
        assert!(snapshot.summaries[0].match_reason.contains("Closer"));
        assert_eq!(snapshot.selected_player_id, Some(10));
        assert_eq!(snapshot.details_by_player_id.len(), 2);
        assert!(snapshot.details_by_player_id.contains_key(&10));
        assert!(snapshot.details_by_player_id.contains_key(&11));

        let selected_detail = snapshot.selected_detail.expect("selected detail");
        assert_eq!(selected_detail.result.player.id, 10);
        assert_eq!(
            snapshot
                .details_by_player_id
                .get(&10)
                .expect("selected player detail")
                .result
                .player
                .id,
            10
        );
        assert_eq!(
            snapshot
                .details_by_player_id
                .get(&11)
                .expect("precomputed fallback detail")
                .result
                .player
                .id,
            11
        );
        assert_eq!(selected_detail.learning_bridge.gaps.len(), 3);
    }

    #[test]
    fn build_workbench_snapshot_returns_empty_snapshot_when_templates_are_missing() {
        let analysis = sample_analysis();

        let snapshot = build_workbench_snapshot("analysis-empty", &analysis, None, &[]);

        assert_eq!(snapshot.analysis_key, "analysis-empty");
        assert!(snapshot.summaries.is_empty());
        assert!(snapshot.details_by_player_id.is_empty());
        assert_eq!(snapshot.selected_player_id, None);
        assert!(snapshot.selected_detail.is_none());
    }

    #[test]
    fn video_profile_match_outranks_partial_single_frame_overlap() {
        let comparator = PoseComparator::new();
        let analysis = sample_analysis();
        let analysis_profile = video_profile(vec![
            (
                "setup",
                vec![
                    profile_angle("right_elbow_angle", 92.0),
                    profile_angle("release_angle", 48.0),
                    profile_angle("right_knee_angle", 146.0),
                ],
            ),
            (
                "release",
                vec![
                    profile_angle("right_elbow_angle", 88.0),
                    profile_angle("release_angle", 56.0),
                    profile_angle("right_shoulder_angle", 44.0),
                ],
            ),
            (
                "follow_through",
                vec![
                    profile_angle("right_elbow_angle", 162.0),
                    profile_angle("release_angle", 68.0),
                    profile_angle("trunk_tilt", 7.0),
                ],
            ),
        ]);

        let curry = PlayerTemplate {
            id: 23,
            name: "Curry".to_string(),
            team: "Warriors".to_string(),
            description: "one-motion sniper".to_string(),
            pose_data: PoseData::default(),
            angles: vec![
                joint_angle("right_elbow_angle", 110.0),
                joint_angle("right_shoulder_angle", 60.0),
                joint_angle("right_knee_angle", 152.0),
                joint_angle("trunk_tilt", 10.0),
            ],
            template_profile: Some(video_profile(vec![
                (
                    "setup",
                    vec![
                        profile_angle("right_elbow_angle", 91.0),
                        profile_angle("release_angle", 47.0),
                        profile_angle("right_knee_angle", 145.0),
                    ],
                ),
                (
                    "release",
                    vec![
                        profile_angle("right_elbow_angle", 89.0),
                        profile_angle("release_angle", 55.0),
                        profile_angle("right_shoulder_angle", 45.0),
                    ],
                ),
                (
                    "follow_through",
                    vec![
                        profile_angle("right_elbow_angle", 160.0),
                        profile_angle("release_angle", 67.0),
                        profile_angle("trunk_tilt", 8.0),
                    ],
                ),
            ])),
        };

        let kobe = PlayerTemplate {
            id: 24,
            name: "Kobe".to_string(),
            team: "Lakers".to_string(),
            description: "two-motion scorer".to_string(),
            pose_data: PoseData::default(),
            angles: vec![
                joint_angle("right_elbow_angle", 90.0),
                joint_angle("right_shoulder_angle", 48.0),
                joint_angle("right_knee_angle", 145.0),
                joint_angle("trunk_tilt", 5.0),
            ],
            template_profile: Some(video_profile(vec![
                (
                    "setup",
                    vec![
                        profile_angle("right_elbow_angle", 102.0),
                        profile_angle("release_angle", 41.0),
                        profile_angle("right_knee_angle", 154.0),
                    ],
                ),
                (
                    "release",
                    vec![
                        profile_angle("right_elbow_angle", 110.0),
                        profile_angle("release_angle", 70.0),
                        profile_angle("right_shoulder_angle", 68.0),
                    ],
                ),
                (
                    "follow_through",
                    vec![
                        profile_angle("right_elbow_angle", 142.0),
                        profile_angle("release_angle", 81.0),
                        profile_angle("trunk_tilt", 13.0),
                    ],
                ),
            ])),
        };

        let ranked = rank_comparison_results(
            &comparator,
            &analysis,
            Some(&analysis_profile),
            &[kobe, curry],
        );

        assert_eq!(ranked[0].player.name, "Curry");
        assert_eq!(ranked[0].comparison_mode, ComparisonMode::VideoLevel);
        assert_eq!(ranked[1].comparison_mode, ComparisonMode::VideoLevel);
        assert!(ranked[0].similarity > ranked[1].similarity);
        assert!(ranked[0].similarity > 0.9);
    }

    #[test]
    fn identical_video_profiles_score_near_perfect_even_with_partial_angle_coverage() {
        let comparator = PoseComparator::new();
        let analysis = sample_analysis();
        let mut profile = video_profile(vec![
            (
                "setup",
                vec![
                    profile_angle("right_elbow_angle", 92.0),
                    profile_angle("release_angle", 48.0),
                    profile_angle("right_knee_angle", 146.0),
                ],
            ),
            (
                "release",
                vec![
                    profile_angle("right_elbow_angle", 88.0),
                    profile_angle("release_angle", 56.0),
                    profile_angle("right_shoulder_angle", 44.0),
                ],
            ),
            (
                "follow_through",
                vec![
                    profile_angle("right_elbow_angle", 162.0),
                    profile_angle("release_angle", 68.0),
                    profile_angle("trunk_tilt", 7.0),
                ],
            ),
        ]);
        profile.coverage = 0.875;
        for phase in profile.phase_profiles.values_mut() {
            phase.coverage = 0.875;
        }

        let player = PlayerTemplate {
            id: 30,
            name: "Same Source".to_string(),
            team: "Same Team".to_string(),
            description: "same video profile".to_string(),
            pose_data: PoseData::default(),
            angles: Vec::new(),
            template_profile: Some(profile.clone()),
        };

        let result = comparator.compare_with_profile(&analysis, Some(&profile), &player);

        assert_eq!(result.comparison_mode, ComparisonMode::VideoLevel);
        assert!(
            result.similarity >= 0.98,
            "identical video profiles should not be capped by coverage, got {}",
            result.similarity
        );
    }
}

pub fn build_learning_bridge(result: &ComparisonResult) -> ComparisonLearningBridge {
    let gaps = sort_differences_by_gap(&result.angle_differences)
        .into_iter()
        .take(3)
        .map(|difference| {
            let direction = if difference.difference > 0.0 {
                "偏大"
            } else {
                "偏小"
            };

            crate::models::ComparisonLearningGap {
                title: format!(
                    "{}{} {:.1}°",
                    angle_display_name(&difference.name),
                    direction,
                    difference.difference.abs()
                ),
                detail: gap_guidance(&difference.name).to_string(),
            }
        })
        .collect();

    ComparisonLearningBridge {
        intro: format!(
            "先从 {} 身上最不像的一到两个关节开始修正，再回看建议区验证动作是否更接近模板。",
            result.player.name
        ),
        gaps,
    }
}

pub fn build_detail_payload(result: ComparisonResult) -> ComparisonDetailPayload {
    let learning_bridge = build_learning_bridge(&result);
    ComparisonDetailPayload {
        result,
        learning_bridge,
    }
}

pub fn build_workbench_snapshot(
    analysis_key: impl Into<String>,
    analysis: &ShotAnalysis,
    analysis_profile: Option<&PlayerTemplateProfile>,
    players: &[PlayerTemplate],
) -> ComparisonWorkbenchSnapshot {
    let comparator = PoseComparator::new();
    let ranked_results = rank_comparison_results(&comparator, analysis, analysis_profile, players);
    build_workbench_snapshot_from_ranked_results(analysis_key, analysis, ranked_results)
}

pub fn build_workbench_snapshot_from_ranked_results(
    analysis_key: impl Into<String>,
    analysis: &ShotAnalysis,
    ranked_results: Vec<ComparisonResult>,
) -> ComparisonWorkbenchSnapshot {
    let analysis_key = analysis_key.into();
    let summaries = ranked_results
        .iter()
        .map(|result| build_summary_from_result(analysis, result))
        .collect::<Vec<_>>();
    let Some(selected_result) = ranked_results.first().cloned() else {
        return ComparisonWorkbenchSnapshot {
            analysis_key,
            summaries,
            details_by_player_id: BTreeMap::new(),
            selected_player_id: None,
            selected_detail: None,
        };
    };

    let selected_player_id = selected_result.player.id;
    let details_by_player_id = ranked_results
        .into_iter()
        .map(|result| (result.player.id, build_detail_payload(result)))
        .collect::<BTreeMap<_, _>>();
    let selected_detail = details_by_player_id.get(&selected_player_id).cloned();

    ComparisonWorkbenchSnapshot {
        analysis_key,
        summaries,
        details_by_player_id,
        selected_player_id: Some(selected_player_id),
        selected_detail,
    }
}

pub fn rank_comparison_results(
    comparator: &PoseComparator,
    analysis: &ShotAnalysis,
    analysis_profile: Option<&PlayerTemplateProfile>,
    players: &[PlayerTemplate],
) -> Vec<ComparisonResult> {
    let mut ranked_results = players
        .iter()
        .map(|player| comparator.compare_with_profile(analysis, analysis_profile, player))
        .collect::<Vec<_>>();

    ranked_results.sort_by(|left, right| {
        right
            .similarity
            .partial_cmp(&left.similarity)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.player.id.cmp(&right.player.id))
    });

    ranked_results
}

fn build_summary_from_result(
    analysis: &ShotAnalysis,
    result: &ComparisonResult,
) -> ComparisonSummary {
    let comparator = PoseComparator::new();
    let weights = comparison_weights();

    ComparisonSummary {
        player: result.player.clone(),
        similarity: result.similarity,
        top_differences: comparator.top_differences(&result.angle_differences, &weights),
        match_reason: comparator.build_match_reason(
            analysis,
            result,
            &result.angle_differences,
            &weights,
        ),
        shot_type_alignment: comparator.shot_type_alignment(analysis, &result.player),
        comparison_mode: result.comparison_mode,
    }
}

fn sort_differences_by_gap(differences: &[AngleDifference]) -> Vec<AngleDifference> {
    let mut sorted = differences.to_vec();
    sorted.sort_by(|left, right| {
        right
            .difference
            .abs()
            .partial_cmp(&left.difference.abs())
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.name.cmp(&right.name))
    });
    sorted
}

fn gap_guidance(name: &str) -> &'static str {
    if name.contains("elbow") || name.contains("release") || name.contains("shoulder") {
        "优先对齐出手肘部和抬手线路，让出手轨迹先稳定下来。"
    } else if name.contains("knee") || name.contains("hip") {
        "先调整下肢加载深度和蹬伸节奏，让力量链条更接近模板。"
    } else {
        "先控制躯干和整体平衡，让发力链条保持在同一条线上。"
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
