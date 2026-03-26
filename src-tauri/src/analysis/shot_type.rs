use crate::models::{JointAngle, Keypoint, ShotType};

use super::angles::{calculate_angle, calculate_release_angle};

pub struct ShotTypeClassifier {
    one_motion_threshold: ShotTypeThreshold,
    one_point_five_threshold: ShotTypeThreshold,
    two_motion_threshold: ShotTypeThreshold,
}

#[derive(Clone, Copy)]
struct ShotTypeThreshold {
    elbow_angle_range: (f32, f32),
    knee_angle_range: (f32, f32),
    shoulder_angle_range: (f32, f32),
    release_angle_range: (f32, f32),
    set_point_height_range: (f32, f32),
}

#[derive(Clone, Copy)]
enum ArmSide {
    Left,
    Right,
}

#[derive(Clone, Copy)]
enum ShotPhase {
    Gather,
    SetPoint,
    Release,
    FollowThrough,
}

#[derive(Clone, Copy)]
struct ShotMetrics {
    shooting_side: ArmSide,
    side_confidence: f32,
    elbow_angle: f32,
    knee_angle: f32,
    shoulder_angle: f32,
    release_angle: f32,
    set_point_height: f32,
    selection_score: f32,
    visibility: f32,
}

impl ShotTypeClassifier {
    pub fn new() -> Self {
        Self {
            one_motion_threshold: ShotTypeThreshold {
                elbow_angle_range: (72.0, 112.0),
                knee_angle_range: (125.0, 158.0),
                shoulder_angle_range: (42.0, 100.0),
                release_angle_range: (48.0, 76.0),
                set_point_height_range: (0.10, 0.72),
            },
            one_point_five_threshold: ShotTypeThreshold {
                elbow_angle_range: (84.0, 124.0),
                knee_angle_range: (136.0, 168.0),
                shoulder_angle_range: (60.0, 124.0),
                release_angle_range: (56.0, 86.0),
                set_point_height_range: (0.28, 1.02),
            },
            two_motion_threshold: ShotTypeThreshold {
                elbow_angle_range: (96.0, 142.0),
                knee_angle_range: (146.0, 178.0),
                shoulder_angle_range: (82.0, 150.0),
                release_angle_range: (68.0, 100.0),
                set_point_height_range: (0.48, 1.35),
            },
        }
    }

    pub fn classify(
        &self,
        keypoints: &[Keypoint],
        angles: &[JointAngle],
    ) -> (ShotType, f32, Vec<String>) {
        let mut reasons = Vec::new();

        let Some(metrics) = self.extract_shot_metrics(keypoints, angles) else {
            reasons.push("\u{5173}\u{952e}\u{70b9}\u{4e0d}\u{8db3}\u{ff0c}\u{65e0}\u{6cd5}\u{7a33}\u{5b9a}\u{8bc6}\u{522b}\u{6295}\u{7bee}\u{624b}\u{548c}\u{4e3b}\u{8981}\u{5173}\u{8282}\u{3002}".to_string());
            return (ShotType::Unknown, 0.2, reasons);
        };

        let phase = self.detect_phase(metrics);
        let mut scores = [
            self.calculate_profile_score(metrics, self.one_motion_threshold, phase),
            self.calculate_profile_score(metrics, self.one_point_five_threshold, phase),
            self.calculate_profile_score(metrics, self.two_motion_threshold, phase),
        ];
        self.apply_phase_bias(&mut scores, phase);

        let total: f32 = scores.iter().sum();
        let (best_index, best_score) = scores
            .iter()
            .copied()
            .enumerate()
            .max_by(|(_, left), (_, right)| left.partial_cmp(right).unwrap())
            .unwrap_or((1, 0.0));

        let second_score = scores
            .iter()
            .copied()
            .enumerate()
            .filter(|(index, _)| *index != best_index)
            .map(|(_, score)| score)
            .fold(0.0, f32::max);

        let shot_type = match best_index {
            0 => ShotType::OneMotion,
            1 => ShotType::OnePointFiveMotion,
            _ => ShotType::TwoMotion,
        };

        reasons.push(format!(
            "\u{63a8}\u{65ad}\u{6295}\u{7bee}\u{624b}: {}",
            self.arm_side_label(metrics.shooting_side, metrics.side_confidence)
        ));
        reasons.push(format!("\u{5f53}\u{524d}\u{52a8}\u{4f5c}\u{9636}\u{6bb5}: {}", self.phase_label(phase)));
        reasons.push(format!("\u{6295}\u{7bee}\u{8098}\u{89d2}: {:.1}\u{b0}", metrics.elbow_angle));
        reasons.push(format!("\u{540c}\u{4fa7}\u{819d}\u{89d2}: {:.1}\u{b0}", metrics.knee_angle));
        reasons.push(format!("\u{6295}\u{7bee}\u{80a9}\u{89d2}: {:.1}\u{b0}", metrics.shoulder_angle));
        reasons.push(format!("\u{51fa}\u{624b}\u{89d2}: {:.1}\u{b0}", metrics.release_angle));
        reasons.push(format!("\u{624b}\u{8155}\u{9ad8}\u{4e8e}\u{80a9}\u{90e8}: {:.2}", metrics.set_point_height));

        if metrics.side_confidence < 0.12 {
            reasons.push("\u{5de6}\u{53f3}\u{624b}\u{5173}\u{952e}\u{70b9}\u{8868}\u{73b0}\u{63a5}\u{8fd1}\u{ff0c}\u{6295}\u{7bee}\u{624b}\u{4ecd}\u{7136}\u{662f}\u{6700}\u{4f73}\u{731c}\u{6d4b}\u{3002}".to_string());
        }

        if metrics.visibility < 0.6 {
            reasons.push("\u{90e8}\u{5206}\u{5173}\u{952e}\u{70b9}\u{5b58}\u{5728}\u{906e}\u{6321}\u{ff0c}\u{7ed3}\u{679c}\u{57fa}\u{4e8e}\u{53ef}\u{89c1}\u{5173}\u{8282}\u{4f30}\u{8ba1}\u{3002}".to_string());
        }

        if let Some(reason) =
            self.defer_reason(&shot_type, phase, metrics, best_score, second_score)
        {
            reasons.push(reason.to_string());

            if self.should_show_tendency_hint(
                phase,
                best_score,
                second_score,
                metrics.side_confidence,
            ) {
                reasons.push(format!(
                    "\u{5f53}\u{524d}\u{66f4}\u{503e}\u{5411} {}\u{ff0c}\u{4f46}\u{66f4}\u{5efa}\u{8bae}\u{7528}\u{4e3e}\u{7403}\u{5230}\u{51c6}\u{5907}\u{51fa}\u{624b}\u{524d}\u{505c}\u{7403}\u{4f4d}\u{7f6e}\u{9644}\u{8fd1}\u{7684}\u{753b}\u{9762}\u{505a}\u{6700}\u{7ec8}\u{5206}\u{578b}\u{3002}",
                    self.shot_type_label(&shot_type)
                ));
            } else {
                reasons.push(
                    "\u{66f4}\u{5efa}\u{8bae}\u{4f7f}\u{7528}\u{4e3e}\u{7403}\u{5230}\u{51c6}\u{5907}\u{51fa}\u{624b}\u{524d}\u{505c}\u{7403}\u{4f4d}\u{7f6e}\u{9644}\u{8fd1}\u{7684}\u{753b}\u{9762}\u{ff0c}\u{6216}\u{8fde}\u{7eed}\u{5e27}/\u{77ed}\u{89c6}\u{9891}\u{505a}\u{6700}\u{7ec8}\u{5206}\u{578b}\u{3002}"
                        .to_string(),
                );
            }

            let confidence = self.calculate_deferred_confidence(
                best_score,
                second_score,
                metrics.side_confidence,
                metrics.visibility,
                phase,
            );

            return (ShotType::Unknown, confidence, reasons);
        }

        if best_score < 0.22 {
            reasons.push("\u{5f53}\u{524d}\u{59ff}\u{6001}\u{4e0e}\u{5404}\u{7c7b}\u{5206}\u{578b}\u{90fd}\u{4e0d}\u{591f}\u{8d34}\u{5408}\u{ff0c}\u{6682}\u{65f6}\u{65e0}\u{6cd5}\u{7ed9}\u{51fa}\u{53ef}\u{9760}\u{7684}\u{52a8}\u{4f5c}\u{5206}\u{578b}\u{3002}".to_string());

            let confidence = self.calculate_deferred_confidence(
                best_score,
                second_score,
                metrics.side_confidence,
                metrics.visibility,
                phase,
            );

            return (ShotType::Unknown, confidence, reasons);
        }

        if second_score + 0.0001 >= best_score {
            reasons.push("\u{5404}\u{7c7b}\u{578b}\u{5f97}\u{5206}\u{63a5}\u{8fd1}\u{ff0c}\u{672c}\u{6b21}\u{7ed3}\u{679c}\u{662f}\u{6700}\u{53ef}\u{80fd}\u{7684}\u{5206}\u{578b}\u{3002}".to_string());
        } else {
            reasons.push(self.type_reason(&shot_type, phase).to_string());
        }

        let confidence = self.calculate_confidence(
            total,
            best_score,
            second_score,
            metrics.side_confidence,
            metrics.visibility,
            phase,
        );

        (shot_type, confidence, reasons)
    }

    fn extract_shot_metrics(
        &self,
        keypoints: &[Keypoint],
        angles: &[JointAngle],
    ) -> Option<ShotMetrics> {
        let left_metrics = self.build_side_metrics(keypoints, ArmSide::Left);
        let right_metrics = self.build_side_metrics(keypoints, ArmSide::Right);

        match (left_metrics, right_metrics) {
            (Some(left), Some(right)) => {
                let total = (left.selection_score + right.selection_score).max(0.0001);
                let side_confidence =
                    ((left.selection_score - right.selection_score).abs() / total).clamp(0.0, 1.0);
                let mut selected = if left.selection_score >= right.selection_score {
                    left
                } else {
                    right
                };
                selected.side_confidence = side_confidence;
                Some(self.override_metrics_from_angles(selected, angles))
            }
            (Some(mut left), None) => {
                left.side_confidence = 1.0;
                Some(self.override_metrics_from_angles(left, angles))
            }
            (None, Some(mut right)) => {
                right.side_confidence = 1.0;
                Some(self.override_metrics_from_angles(right, angles))
            }
            (None, None) => None,
        }
    }

    fn override_metrics_from_angles(
        &self,
        mut metrics: ShotMetrics,
        angles: &[JointAngle],
    ) -> ShotMetrics {
        if let Some(value) = self.preferred_angle_value(angles, "shooting_elbow_angle") {
            metrics.elbow_angle = value;
        }

        if let Some(value) = self.preferred_angle_value(angles, "release_angle") {
            metrics.release_angle = value;
        }

        let (shoulder_name, knee_name) = match metrics.shooting_side {
            ArmSide::Left => ("left_shoulder_angle", "left_knee_angle"),
            ArmSide::Right => ("right_shoulder_angle", "right_knee_angle"),
        };

        if let Some(value) = self.preferred_angle_value(angles, shoulder_name) {
            metrics.shoulder_angle = value;
        }

        if let Some(value) = self.preferred_angle_value(angles, knee_name) {
            metrics.knee_angle = value;
        }

        metrics
    }

    fn preferred_angle_value(&self, angles: &[JointAngle], name: &str) -> Option<f32> {
        angles
            .iter()
            .find(|angle| angle.name == name && angle.status != "low_confidence")
            .map(|angle| angle.value)
    }

    fn build_side_metrics(&self, keypoints: &[Keypoint], side: ArmSide) -> Option<ShotMetrics> {
        let get_kp = |id: u32| keypoints.iter().find(|k| k.id == id);
        let (shoulder_id, elbow_id, wrist_id, hip_id, knee_id, ankle_id) = match side {
            ArmSide::Left => (11, 13, 15, 23, 25, 27),
            ArmSide::Right => (12, 14, 16, 24, 26, 28),
        };

        let shoulder = get_kp(shoulder_id)?;
        let elbow = get_kp(elbow_id)?;
        let wrist = get_kp(wrist_id)?;
        let hip = get_kp(hip_id)?;
        let knee = get_kp(knee_id)?;
        let ankle = get_kp(ankle_id)?;

        let visibility = [
            shoulder.visibility,
            elbow.visibility,
            wrist.visibility,
            hip.visibility,
            knee.visibility,
            ankle.visibility,
        ]
        .iter()
        .copied()
        .sum::<f32>()
            / 6.0;

        if visibility < 0.3 {
            return None;
        }

        let elbow_angle = calculate_angle(shoulder, elbow, wrist);
        let knee_angle = calculate_angle(hip, knee, ankle);
        let shoulder_angle = calculate_angle(hip, shoulder, elbow);
        let release_angle = calculate_release_angle(shoulder, wrist);
        let torso_length = self.distance(shoulder, hip).max(1.0);
        let arm_extension = (self.distance(shoulder, wrist) / torso_length).clamp(0.0, 2.0) / 2.0;
        let wrist_lift = ((shoulder.y - wrist.y) / torso_length).clamp(-0.5, 1.5);
        let set_point_height = wrist_lift.max(-0.5);
        let elbow_extension = (elbow_angle / 180.0).clamp(0.0, 1.0);
        let side_bias = self.side_bias(keypoints, side, shoulder, wrist, torso_length);

        let selection_score = wrist_lift.max(0.0) * 0.38
            + arm_extension * 0.2
            + elbow_extension * 0.14
            + visibility * 0.12
            + side_bias * 0.16;

        Some(ShotMetrics {
            shooting_side: side,
            side_confidence: 0.0,
            elbow_angle,
            knee_angle,
            shoulder_angle,
            release_angle,
            set_point_height,
            selection_score,
            visibility,
        })
    }

    fn side_bias(
        &self,
        keypoints: &[Keypoint],
        side: ArmSide,
        shoulder: &Keypoint,
        wrist: &Keypoint,
        torso_length: f32,
    ) -> f32 {
        let other_shoulder_id = match side {
            ArmSide::Left => 12,
            ArmSide::Right => 11,
        };

        let Some(other_shoulder) = keypoints
            .iter()
            .find(|keypoint| keypoint.id == other_shoulder_id)
        else {
            return 0.0;
        };

        let midline_x = (shoulder.x + other_shoulder.x) / 2.0;
        let horizontal_offset = match side {
            ArmSide::Left => (midline_x - wrist.x) / torso_length,
            ArmSide::Right => (wrist.x - midline_x) / torso_length,
        };

        horizontal_offset.clamp(-0.2, 0.8).max(0.0)
    }

    fn detect_phase(&self, metrics: ShotMetrics) -> ShotPhase {
        if metrics.elbow_angle >= 154.0
            && metrics.release_angle >= 72.0
            && metrics.set_point_height >= 0.72
        {
            ShotPhase::FollowThrough
        } else if metrics.elbow_angle >= 128.0
            && metrics.release_angle >= 62.0
            && metrics.set_point_height >= 0.48
        {
            ShotPhase::Release
        } else if metrics.set_point_height >= 0.22 && metrics.shoulder_angle >= 64.0 {
            ShotPhase::SetPoint
        } else {
            ShotPhase::Gather
        }
    }

    fn apply_phase_bias(&self, scores: &mut [f32; 3], phase: ShotPhase) {
        match phase {
            ShotPhase::Gather => {
                scores[0] += 0.06;
                scores[1] += 0.03;
            }
            ShotPhase::SetPoint => {
                scores[1] += 0.04;
                scores[2] += 0.06;
            }
            ShotPhase::Release => {
                scores[0] += 0.05;
                scores[1] += 0.04;
                scores[2] -= 0.04;
            }
            ShotPhase::FollowThrough => {
                scores[0] += 0.03;
                scores[1] += 0.02;
                scores[2] -= 0.08;
            }
        }

        for score in scores.iter_mut() {
            *score = score.max(0.0);
        }
    }

    fn calculate_profile_score(
        &self,
        metrics: ShotMetrics,
        threshold: ShotTypeThreshold,
        phase: ShotPhase,
    ) -> f32 {
        let elbow_score = self.range_score(metrics.elbow_angle, threshold.elbow_angle_range, 14.0);
        let knee_score = self.range_score(metrics.knee_angle, threshold.knee_angle_range, 14.0);
        let shoulder_score =
            self.range_score(metrics.shoulder_angle, threshold.shoulder_angle_range, 18.0);
        let release_score =
            self.range_score(metrics.release_angle, threshold.release_angle_range, 12.0);
        let set_point_score = self.range_score(
            metrics.set_point_height,
            threshold.set_point_height_range,
            0.22,
        );

        let (elbow_weight, knee_weight, shoulder_weight, release_weight, set_point_weight) =
            match phase {
                ShotPhase::Gather => (0.30, 0.20, 0.22, 0.12, 0.16),
                ShotPhase::SetPoint => (0.28, 0.18, 0.22, 0.16, 0.16),
                ShotPhase::Release => (0.34, 0.20, 0.16, 0.12, 0.18),
                ShotPhase::FollowThrough => (0.36, 0.22, 0.14, 0.10, 0.18),
            };

        elbow_score * elbow_weight
            + knee_score * knee_weight
            + shoulder_score * shoulder_weight
            + release_score * release_weight
            + set_point_score * set_point_weight
    }

    fn calculate_confidence(
        &self,
        total: f32,
        best_score: f32,
        second_score: f32,
        side_confidence: f32,
        visibility: f32,
        phase: ShotPhase,
    ) -> f32 {
        let normalized = if total > 0.0 {
            best_score / total
        } else {
            0.34
        };
        let margin = (best_score - second_score).max(0.0);
        let phase_factor = match phase {
            ShotPhase::SetPoint => 1.0,
            ShotPhase::Release => 0.94,
            ShotPhase::Gather => 0.9,
            ShotPhase::FollowThrough => 0.88,
        };

        (normalized * 0.48
            + best_score * 0.27
            + margin * 1.2 * 0.1
            + side_confidence * 0.08
            + visibility * 0.07)
            .mul_add(phase_factor, 0.0)
            .clamp(0.2, 0.93)
    }

    fn calculate_deferred_confidence(
        &self,
        best_score: f32,
        second_score: f32,
        side_confidence: f32,
        visibility: f32,
        phase: ShotPhase,
    ) -> f32 {
        let phase_base = match phase {
            ShotPhase::Gather => 0.3,
            ShotPhase::SetPoint => 0.36,
            ShotPhase::Release => 0.18,
            ShotPhase::FollowThrough => 0.12,
        };
        let margin = (best_score - second_score).max(0.0);

        (phase_base + best_score * 0.1 + margin * 0.05 + side_confidence * 0.05 + visibility * 0.06)
            .clamp(0.12, 0.52)
    }

    fn range_score(&self, value: f32, range: (f32, f32), softness: f32) -> f32 {
        let (min, max) = range;
        if value >= min && value <= max {
            return 1.0;
        }

        let edge = if value < min { min } else { max };
        let diff = value - edge;
        (-diff * diff / (2.0 * softness * softness)).exp()
    }

    fn distance(&self, a: &Keypoint, b: &Keypoint) -> f32 {
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        (dx * dx + dy * dy).sqrt()
    }

    fn arm_side_label(&self, side: ArmSide, side_confidence: f32) -> &'static str {
        if side_confidence < 0.12 {
            match side {
                ArmSide::Left => "\u{7591}\u{4f3c}\u{5de6}\u{624b}",
                ArmSide::Right => "\u{7591}\u{4f3c}\u{53f3}\u{624b}",
            }
        } else {
            match side {
                ArmSide::Left => "\u{5de6}\u{624b}",
                ArmSide::Right => "\u{53f3}\u{624b}",
            }
        }
    }

    fn phase_label(&self, phase: ShotPhase) -> &'static str {
        match phase {
            ShotPhase::Gather => "\u{4e3e}\u{7403}/\u{53d1}\u{529b}\u{524d}\u{6bb5}",
            ShotPhase::SetPoint => "\u{51c6}\u{5907}\u{51fa}\u{624b}\u{524d}\u{505c}\u{7403}\u{4f4d}\u{7f6e}\u{9644}\u{8fd1}",
            ShotPhase::Release => "\u{51fa}\u{624b}\u{77ac}\u{95f4}",
            ShotPhase::FollowThrough => "\u{51fa}\u{624b}\u{540e}\u{6bb5}",
        }
    }

    fn type_reason(&self, shot_type: &ShotType, phase: ShotPhase) -> &'static str {
        match (shot_type, phase) {
            (
                ShotType::OneMotion,
                ShotPhase::Gather | ShotPhase::Release | ShotPhase::FollowThrough,
            ) => "\u{5224}\u{5b9a}\u{4f9d}\u{636e}: \u{4e0a}\u{4e0b}\u{80a2}\u{8854}\u{63a5}\u{66f4}\u{8fde}\u{8d2f}\u{ff0c}\u{51fa}\u{624b}\u{8def}\u{5f84}\u{66f4}\u{50cf} 1 \u{6bb5}\u{5f0f}\u{3002}",
            (ShotType::OneMotion, _) => "\u{5224}\u{5b9a}\u{4f9d}\u{636e}: \u{4e3e}\u{7403}\u{5230}\u{51fa}\u{624b}\u{8854}\u{63a5}\u{8f83}\u{7d27}\u{ff0c}\u{6574}\u{4f53}\u{66f4}\u{50cf} 1 \u{6bb5}\u{5f0f}\u{3002}",
            (ShotType::OnePointFiveMotion, _) => {
                "\u{5224}\u{5b9a}\u{4f9d}\u{636e}: \u{8282}\u{594f}\u{4ecb}\u{4e8e}\u{8fde}\u{7eed}\u{53d1}\u{529b}\u{548c}\u{660e}\u{663e}\u{505c}\u{987f}\u{4e4b}\u{95f4}\u{ff0c}\u{66f4}\u{50cf} 1.5 \u{6bb5}\u{5f0f}\u{3002}"
            }
            (ShotType::TwoMotion, ShotPhase::SetPoint | ShotPhase::Release) => {
                "\u{5224}\u{5b9a}\u{4f9d}\u{636e}: \u{51c6}\u{5907}\u{51fa}\u{624b}\u{524d}\u{505c}\u{7403}\u{4f4d}\u{7f6e}\u{66f4}\u{9ad8}\u{ff0c}\u{80a9}\u{8098}\u{5c55}\u{5f00}\u{66f4}\u{660e}\u{663e}\u{ff0c}\u{66f4}\u{50cf} 2 \u{6bb5}\u{5f0f}\u{3002}"
            }
            (ShotType::TwoMotion, _) => "\u{5224}\u{5b9a}\u{4f9d}\u{636e}: \u{4e0a}\u{81c2}\u{4e3e}\u{7403}\u{66f4}\u{9ad8}\u{3001}\u{52a8}\u{4f5c}\u{66f4}\u{5206}\u{6bb5}\u{ff0c}\u{66f4}\u{50cf} 2 \u{6bb5}\u{5f0f}\u{3002}",
            (ShotType::Unknown, _) => "\u{5173}\u{952e}\u{70b9}\u{4e0d}\u{8db3}\u{ff0c}\u{65e0}\u{6cd5}\u{5224}\u{65ad}\u{3002}",
        }
    }

    fn defer_reason(
        &self,
        shot_type: &ShotType,
        phase: ShotPhase,
        metrics: ShotMetrics,
        best_score: f32,
        second_score: f32,
    ) -> Option<&'static str> {
        let margin = best_score - second_score;

        if matches!(phase, ShotPhase::FollowThrough) {
            return Some(
                "\u{5f53}\u{524d}\u{753b}\u{9762}\u{5df2}\u{7ecf}\u{8fdb}\u{5165}\u{51fa}\u{624b}\u{540e}\u{6bb5}\u{ff0c}\u{66f4}\u{9002}\u{5408}\u{770b}\u{51fa}\u{624b}\u{59ff}\u{6001}\u{ff0c}\u{4e0d}\u{9002}\u{5408}\u{53ea}\u{51ed}\u{8fd9}\u{4e00}\u{5e27}\u{5224}\u{65ad}\u{5b8c}\u{6574}\u{52a8}\u{4f5c}\u{5206}\u{578b}\u{3002}",
            );
        }

        if matches!(phase, ShotPhase::Release) && margin < 0.12 {
            return Some(
                "\u{5f53}\u{524d}\u{753b}\u{9762}\u{5904}\u{4e8e}\u{51fa}\u{624b}\u{77ac}\u{95f4}\u{ff0c}\u{5404}\u{7c7b}\u{5206}\u{578b}\u{5728}\u{8fd9}\u{4e00}\u{9636}\u{6bb5}\u{4f1a}\u{975e}\u{5e38}\u{63a5}\u{8fd1}\u{ff0c}\u{5355}\u{5e27}\u{5224}\u{65ad}\u{5bb9}\u{6613}\u{628a} 1 \u{6bb5}\u{5f0f}\u{548c} 2 \u{6bb5}\u{5f0f}\u{6df7}\u{6dc6}\u{3002}",
            );
        }

        if matches!(phase, ShotPhase::Release)
            && matches!(shot_type, ShotType::TwoMotion)
            && margin < 0.22
            && (metrics.elbow_angle >= 150.0 || metrics.release_angle >= 72.0)
        {
            return Some(
                "\u{5f53}\u{524d}\u{753b}\u{9762}\u{5df2}\u{7ecf}\u{63a5}\u{8fd1}\u{51fa}\u{624b}\u{672b}\u{6bb5}\u{ff0c}\u{62ac}\u{8098}\u{548c}\u{9ad8}\u{51fa}\u{624b}\u{4f1a}\u{653e}\u{5927}\u{4e8c}\u{6bb5}\u{5f0f}\u{5916}\u{89c2}\u{ff0c}\u{5355}\u{5e27}\u{4e0d}\u{8db3}\u{4ee5}\u{7a33}\u{5b9a}\u{5224}\u{6210} 2 \u{6bb5}\u{5f0f}\u{3002}",
            );
        }

        if metrics.side_confidence < 0.08 && !matches!(phase, ShotPhase::SetPoint) {
            return Some(
                "\u{5f53}\u{524d}\u{753b}\u{9762}\u{5de6}\u{53f3}\u{624b}\u{8bc6}\u{522b}\u{4ecd}\u{7136}\u{504f}\u{6a21}\u{7cca}\u{ff0c}\u{6295}\u{7bee}\u{624b}\u{4e0d}\u{591f}\u{7a33}\u{5b9a}\u{ff0c}\u{52a8}\u{4f5c}\u{5206}\u{578b}\u{7684}\u{53c2}\u{8003}\u{4ef7}\u{503c}\u{4f1a}\u{660e}\u{663e}\u{4e0b}\u{964d}\u{3002}",
            );
        }

        None
    }

    fn should_show_tendency_hint(
        &self,
        phase: ShotPhase,
        best_score: f32,
        second_score: f32,
        side_confidence: f32,
    ) -> bool {
        let margin = best_score - second_score;

        matches!(phase, ShotPhase::Gather | ShotPhase::SetPoint)
            && margin >= 0.12
            && side_confidence >= 0.12
    }

    fn shot_type_label(&self, shot_type: &ShotType) -> &'static str {
        match shot_type {
            ShotType::OneMotion => "1 \u{6bb5}\u{5f0f}",
            ShotType::OnePointFiveMotion => "1.5 \u{6bb5}\u{5f0f}",
            ShotType::TwoMotion => "2 \u{6bb5}\u{5f0f}",
            ShotType::Unknown => "\u{672a}\u{77e5}",
        }
    }
}

impl Default for ShotTypeClassifier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

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

    fn angle(name: &str, value: f32) -> JointAngle {
        JointAngle {
            name: name.to_string(),
            value,
            normal_range: (0.0, 180.0),
            status: "normal".to_string(),
            confidence: 1.0,
        }
    }

    #[derive(Deserialize)]
    struct RegressionFixture {
        id: String,
        player: String,
        #[serde(rename = "sourceImage")]
        source_image: String,
        scenario: String,
        #[serde(rename = "expectedShotType")]
        expected_shot_type: ShotType,
        #[serde(rename = "minConfidence")]
        min_confidence: f32,
        #[serde(rename = "maxConfidence")]
        max_confidence: f32,
        keypoints: Vec<FixtureKeypoint>,
        angles: Vec<FixtureAngle>,
    }

    #[derive(Deserialize)]
    struct FixtureKeypoint {
        id: u32,
        x: f32,
        y: f32,
    }

    #[derive(Deserialize)]
    struct FixtureAngle {
        name: String,
        value: f32,
    }

    fn load_regression_fixtures() -> Vec<RegressionFixture> {
        serde_json::from_str(include_str!(
            "../../testdata/shot_type_regression_samples.json"
        ))
        .expect("expected valid regression fixtures")
    }

    #[test]
    fn prefers_the_raised_shooting_side_over_the_guide_side() {
        let classifier = ShotTypeClassifier::new();
        let keypoints = vec![
            keypoint(11, -20.0, 0.0),
            keypoint(13, -40.0, 30.0),
            keypoint(15, -50.0, 80.0),
            keypoint(23, -20.0, 100.0),
            keypoint(25, -20.0, 200.0),
            keypoint(27, -20.0, 300.0),
            keypoint(12, 20.0, 0.0),
            keypoint(14, 40.0, -20.0),
            keypoint(16, 50.0, -60.0),
            keypoint(24, 20.0, 100.0),
            keypoint(26, 20.0, 200.0),
            keypoint(28, 10.0, 300.0),
        ];

        let metrics = classifier
            .extract_shot_metrics(&keypoints, &[])
            .expect("expected side metrics");

        assert!(matches!(metrics.shooting_side, ArmSide::Right));
        assert!(metrics.side_confidence > 0.12);
    }

    #[test]
    fn returns_unknown_for_follow_through_frames() {
        let classifier = ShotTypeClassifier::new();
        let keypoints = vec![
            keypoint(12, 0.0, 0.0),
            keypoint(14, 10.0, -50.0),
            keypoint(16, 20.0, -100.0),
            keypoint(24, 0.0, 100.0),
            keypoint(26, 0.0, 200.0),
            keypoint(28, 5.0, 300.0),
        ];

        let (shot_type, confidence, reasons) = classifier.classify(&keypoints, &[]);

        assert_eq!(shot_type, ShotType::Unknown);
        assert!(confidence < 0.45);
        assert!(reasons
            .iter()
            .any(|reason| reason.contains("\u{5f53}\u{524d}\u{52a8}\u{4f5c}\u{9636}\u{6bb5}")));
    }

    #[test]
    fn returns_unknown_when_shooting_side_is_ambiguous() {
        let classifier = ShotTypeClassifier::new();
        let keypoints = vec![
            keypoint(11, -20.0, 0.0),
            keypoint(13, -40.0, -20.0),
            keypoint(15, -50.0, -60.0),
            keypoint(23, -20.0, 100.0),
            keypoint(25, -20.0, 200.0),
            keypoint(27, -10.0, 300.0),
            keypoint(12, 20.0, 0.0),
            keypoint(14, 40.0, -20.0),
            keypoint(16, 50.0, -60.0),
            keypoint(24, 20.0, 100.0),
            keypoint(26, 20.0, 200.0),
            keypoint(28, 10.0, 300.0),
        ];

        let (shot_type, confidence, reasons) = classifier.classify(&keypoints, &[]);

        assert_eq!(shot_type, ShotType::Unknown);
        assert!(confidence < 0.45);
        assert!(reasons
            .iter()
            .any(|reason| reason.contains("\u{6700}\u{4f73}\u{731c}\u{6d4b}")));
    }

    #[test]
    fn uses_shooting_arm_angles_when_available() {
        let classifier = ShotTypeClassifier::new();
        let keypoints = vec![
            keypoint(11, -20.0, 0.0),
            keypoint(13, -40.0, 30.0),
            keypoint(15, -50.0, 80.0),
            keypoint(23, -20.0, 100.0),
            keypoint(25, -20.0, 200.0),
            keypoint(27, -20.0, 300.0),
            keypoint(12, 20.0, 0.0),
            keypoint(14, 45.0, -15.0),
            keypoint(16, 70.0, -65.0),
            keypoint(24, 20.0, 100.0),
            keypoint(26, 25.0, 185.0),
            keypoint(28, 30.0, 275.0),
        ];

        let metrics = classifier
            .extract_shot_metrics(
                &keypoints,
                &[
                    angle("shooting_elbow_angle", 101.0),
                    angle("release_angle", 58.0),
                    angle("right_shoulder_angle", 88.0),
                    angle("right_knee_angle", 152.0),
                ],
            )
            .expect("expected metrics");

        assert!((metrics.elbow_angle - 101.0).abs() < 0.01);
        assert!((metrics.release_angle - 58.0).abs() < 0.01);
        assert!((metrics.shoulder_angle - 88.0).abs() < 0.01);
        assert!((metrics.knee_angle - 152.0).abs() < 0.01);
    }

    #[test]
    fn returns_unknown_for_upright_release_frame_that_only_loosely_matches_two_motion() {
        let classifier = ShotTypeClassifier::new();
        let keypoints = vec![
            keypoint(11, -25.0, 0.0),
            keypoint(12, 0.0, 0.0),
            keypoint(14, 20.0, -40.0),
            keypoint(16, 40.0, -80.0),
            keypoint(24, 0.0, 100.0),
            keypoint(26, 0.0, 200.0),
            keypoint(28, 5.0, 300.0),
        ];

        let (shot_type, confidence, reasons) = classifier.classify(&keypoints, &[]);

        assert_eq!(shot_type, ShotType::Unknown);
        assert!(confidence <= 0.52);
        assert!(reasons.iter().any(|reason| {
            reason.contains("\u{4e8c}\u{6bb5}\u{5f0f}\u{5916}\u{89c2}")
                || reason.contains("\u{5f53}\u{524d}\u{52a8}\u{4f5c}\u{9636}\u{6bb5}")
        }));
    }

    #[test]
    fn compact_one_motion_setup_stays_in_one_motion_bucket() {
        let classifier = ShotTypeClassifier::new();
        let keypoints = vec![
            keypoint(11, -20.0, 0.0),
            keypoint(12, 20.0, 0.0),
            keypoint(14, 40.0, -10.0),
            keypoint(16, 55.0, -18.0),
            keypoint(24, 20.0, 100.0),
            keypoint(26, 24.0, 190.0),
            keypoint(28, 28.0, 280.0),
        ];

        let (shot_type, confidence, _) = classifier.classify(
            &keypoints,
            &[
                angle("shooting_elbow_angle", 90.0),
                angle("release_angle", 51.0),
                angle("right_shoulder_angle", 66.0),
                angle("right_knee_angle", 144.0),
            ],
        );

        assert_eq!(shot_type, ShotType::OneMotion);
        assert!(confidence >= 0.45);
    }

    #[test]
    fn high_set_point_frame_prefers_two_motion() {
        let classifier = ShotTypeClassifier::new();
        let keypoints = vec![
            keypoint(11, -20.0, 0.0),
            keypoint(12, 20.0, 0.0),
            keypoint(14, 42.0, -32.0),
            keypoint(16, 48.0, -70.0),
            keypoint(24, 20.0, 100.0),
            keypoint(26, 22.0, 190.0),
            keypoint(28, 26.0, 280.0),
        ];

        let (shot_type, confidence, _) = classifier.classify(
            &keypoints,
            &[
                angle("shooting_elbow_angle", 118.0),
                angle("release_angle", 72.0),
                angle("right_shoulder_angle", 108.0),
                angle("right_knee_angle", 166.0),
            ],
        );

        assert_eq!(shot_type, ShotType::TwoMotion);
        assert!(confidence >= 0.45);
    }

    #[test]
    fn regression_samples_match_expected_shot_types() {
        let classifier = ShotTypeClassifier::new();

        for fixture in load_regression_fixtures() {
            let keypoints = fixture
                .keypoints
                .iter()
                .map(|point| keypoint(point.id, point.x, point.y))
                .collect::<Vec<_>>();
            let angles = fixture
                .angles
                .iter()
                .map(|item| angle(&item.name, item.value))
                .collect::<Vec<_>>();

            let (shot_type, confidence, reasons) = classifier.classify(&keypoints, &angles);

            assert_eq!(
                shot_type,
                fixture.expected_shot_type,
                "fixture `{}` for {} ({}) from {} classified as {:?} with reasons {:?}",
                fixture.id,
                fixture.player,
                fixture.scenario,
                fixture.source_image,
                shot_type,
                reasons
            );
            assert!(
                confidence >= fixture.min_confidence && confidence <= fixture.max_confidence,
                "fixture `{}` confidence {} outside [{}, {}]",
                fixture.id,
                confidence,
                fixture.min_confidence,
                fixture.max_confidence
            );
        }
    }
}


