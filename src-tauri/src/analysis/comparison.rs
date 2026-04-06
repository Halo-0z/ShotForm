use std::{cmp::Ordering, collections::HashMap};

use crate::models::{
    AngleDifference, ComparisonResult, ComparisonSummary, JointAngle, Keypoint, PlayerTemplate,
    PoseData, ShotAnalysis, ShotType,
};

pub struct PoseComparator;

impl PoseComparator {
    pub fn new() -> Self {
        Self
    }

    pub fn compare(&self, analysis: &ShotAnalysis, player: &PlayerTemplate) -> ComparisonResult {
        let dominant_side = self.detect_shooting_side(analysis);
        let angle_differences =
            self.calculate_angle_differences(&analysis.angles, &player.angles, dominant_side);
        let similarity = self.calculate_weighted_similarity(&angle_differences, &comparison_weights());

        ComparisonResult {
            player: player.clone(),
            similarity,
            angle_differences,
        }
    }

    pub fn rank_players(
        &self,
        analysis: &ShotAnalysis,
        players: &[PlayerTemplate],
    ) -> Vec<ComparisonSummary> {
        let dominant_side = self.detect_shooting_side(analysis);
        let weights = comparison_weights();
        let mut summaries: Vec<_> = players
            .iter()
            .map(|player| {
                let angle_differences =
                    self.calculate_angle_differences(&analysis.angles, &player.angles, dominant_side);
                let similarity = self.calculate_weighted_similarity(&angle_differences, &weights);
                let top_differences = self.top_differences(&angle_differences, &weights);
                let shot_type_alignment = self.shot_type_alignment(analysis, player);
                let match_reason =
                    self.build_match_reason(analysis, player, &angle_differences, &weights);

                ComparisonSummary {
                    player: player.clone(),
                    similarity,
                    top_differences,
                    match_reason,
                    shot_type_alignment,
                }
            })
            .collect();

        summaries.sort_by(|left, right| {
            right
                .similarity
                .partial_cmp(&left.similarity)
                .unwrap_or(Ordering::Equal)
                .then_with(|| left.player.id.cmp(&right.player.id))
        });

        summaries
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
        player: &PlayerTemplate,
        differences: &[AngleDifference],
        weights: &[(String, f32)],
    ) -> String {
        let mut reasons = Vec::new();

        if let Some(alignment) = self.shot_type_alignment(analysis, player) {
            reasons.push(alignment);
        }

        let closest_signals = self.closest_alignment_names(differences, weights);
        if !closest_signals.is_empty() {
            reasons.push(format!(
                "closest mechanical overlap at {}",
                self.join_labels(&closest_signals)
            ));
        }

        if let Some(balance_signal) = differences.iter().find(|difference| {
            matches!(
                difference.name.as_str(),
                "trunk_tilt" | "right_knee_angle" | "left_knee_angle" | "right_hip_angle" | "left_hip_angle"
            ) && difference.difference.abs() <= 10.0
        }) {
            reasons.push(format!(
                "loading stays controlled through {}",
                self.angle_label(&balance_signal.name)
            ));
        }

        if reasons.is_empty() {
            format!("{} is the closest weighted mechanics match.", player.name)
        } else {
            format!("{} ranks highly because {}.", player.name, reasons.join(", "))
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
                "shot type aligns with a {} profile",
                self.shot_type_label(&player_shot_type)
            ))
        } else {
            Some(format!(
                "mechanics still translate across {} and {} shot shapes",
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
            ShotType::OneMotion => "one-motion",
            ShotType::OnePointFiveMotion => "one-point-five-motion",
            ShotType::TwoMotion => "two-motion",
            ShotType::Unknown => "unknown",
        }
    }

    fn angle_label(&self, name: &str) -> String {
        match name {
            "left_elbow_angle" | "right_elbow_angle" | "shooting_elbow_angle" => {
                "elbow angle".to_string()
            }
            "left_shoulder_angle" | "right_shoulder_angle" | "release_angle" => {
                "shoulder and release line".to_string()
            }
            "left_knee_angle" | "right_knee_angle" => "knee load".to_string(),
            "left_hip_angle" | "right_hip_angle" => "hip stack".to_string(),
            "trunk_tilt" => "trunk tilt".to_string(),
            "shoulder_tilt" => "shoulder tilt".to_string(),
            _ => name.replace('_', " "),
        }
    }

    fn join_labels(&self, labels: &[String]) -> String {
        match labels {
            [] => String::new(),
            [single] => single.clone(),
            [first, second] => format!("{first} and {second}"),
            _ => {
                let mut joined = labels[..labels.len() - 1].join(", ");
                joined.push_str(", and ");
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
        assert!(ranked[0].top_differences.len() <= 3);
    }
}
