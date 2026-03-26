use crate::models::{JointAngle, Keypoint};
use nalgebra::{Vector2, Vector3};

pub fn calculate_angle(p1: &Keypoint, p2: &Keypoint, p3: &Keypoint) -> f32 {
    let v1 = Vector2::new(p1.x - p2.x, p1.y - p2.y);
    let v2 = Vector2::new(p3.x - p2.x, p3.y - p2.y);

    let dot = v1.dot(&v2);
    let mag1 = v1.magnitude();
    let mag2 = v2.magnitude();

    if mag1 == 0.0 || mag2 == 0.0 {
        return 0.0;
    }

    let cos_angle = (dot / (mag1 * mag2)).clamp(-1.0, 1.0);
    cos_angle.acos().to_degrees()
}

pub fn calculate_3d_angle(p1: &Keypoint, p2: &Keypoint, p3: &Keypoint) -> f32 {
    let v1 = Vector3::new(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
    let v2 = Vector3::new(p3.x - p2.x, p3.y - p2.y, p3.z - p2.z);

    let dot = v1.dot(&v2);
    let mag1 = v1.magnitude();
    let mag2 = v2.magnitude();

    if mag1 == 0.0 || mag2 == 0.0 {
        return 0.0;
    }

    let cos_angle = (dot / (mag1 * mag2)).clamp(-1.0, 1.0);
    cos_angle.acos().to_degrees()
}

pub fn calculate_all_angles(keypoints: &[Keypoint]) -> Vec<JointAngle> {
    let mut angles = Vec::new();

    let get_kp = |id: u32| keypoints.iter().find(|k| k.id == id);
    let leg_overlap = detect_leg_overlap(keypoints);

    push_angle(
        &mut angles,
        "left_elbow_angle",
        get_kp(11),
        get_kp(13),
        get_kp(15),
        (90.0, 130.0),
        0.45,
        false,
    );
    push_angle(
        &mut angles,
        "right_elbow_angle",
        get_kp(12),
        get_kp(14),
        get_kp(16),
        (90.0, 130.0),
        0.45,
        false,
    );
    push_angle(
        &mut angles,
        "left_shoulder_angle",
        get_kp(23),
        get_kp(11),
        get_kp(13),
        (30.0, 90.0),
        0.45,
        false,
    );
    push_angle(
        &mut angles,
        "right_shoulder_angle",
        get_kp(24),
        get_kp(12),
        get_kp(14),
        (30.0, 90.0),
        0.45,
        false,
    );
    push_angle(
        &mut angles,
        "left_knee_angle",
        get_kp(23),
        get_kp(25),
        get_kp(27),
        (140.0, 170.0),
        0.55,
        leg_overlap.left_leg_unreliable,
    );
    push_angle(
        &mut angles,
        "right_knee_angle",
        get_kp(24),
        get_kp(26),
        get_kp(28),
        (140.0, 170.0),
        0.55,
        leg_overlap.right_leg_unreliable,
    );
    push_angle(
        &mut angles,
        "left_hip_angle",
        get_kp(11),
        get_kp(23),
        get_kp(25),
        (160.0, 180.0),
        0.55,
        leg_overlap.left_leg_unreliable,
    );
    push_angle(
        &mut angles,
        "right_hip_angle",
        get_kp(12),
        get_kp(24),
        get_kp(26),
        (160.0, 180.0),
        0.55,
        leg_overlap.right_leg_unreliable,
    );

    if let (Some(left_shoulder), Some(right_shoulder)) = (get_kp(11), get_kp(12)) {
        let shoulder_tilt = ((left_shoulder.y - right_shoulder.y).abs()
            / (left_shoulder.x - right_shoulder.x).abs().max(1.0))
        .atan()
        .to_degrees();
        angles.push(make_angle(
            "shoulder_tilt",
            shoulder_tilt,
            (0.0, 10.0),
            joint_confidence(&[left_shoulder, right_shoulder], 0.4),
            false,
        ));
    }

    if let (Some(nose), Some(left_shoulder), Some(right_shoulder)) =
        (get_kp(0), get_kp(11), get_kp(12))
    {
        let mid_shoulder_x = (left_shoulder.x + right_shoulder.x) / 2.0;
        let mid_shoulder_y = (left_shoulder.y + right_shoulder.y) / 2.0;

        let trunk_vector = Vector2::new(nose.x - mid_shoulder_x, nose.y - mid_shoulder_y);
        let trunk_length = trunk_vector.magnitude();
        let trunk_angle = if trunk_length == 0.0 {
            0.0
        } else {
            let vertical_up = Vector2::new(0.0, -1.0);
            let cos_angle = (trunk_vector.dot(&vertical_up) / trunk_length).clamp(-1.0, 1.0);
            cos_angle.acos().to_degrees()
        };

        angles.push(make_angle(
            "trunk_tilt",
            trunk_angle,
            (0.0, 15.0),
            joint_confidence(&[nose, left_shoulder, right_shoulder], 0.4),
            false,
        ));
    }

    angles
}

fn push_angle(
    angles: &mut Vec<JointAngle>,
    name: &str,
    p1: Option<&Keypoint>,
    p2: Option<&Keypoint>,
    p3: Option<&Keypoint>,
    normal_range: (f32, f32),
    min_confidence: f32,
    unreliable: bool,
) {
    if let (Some(p1), Some(p2), Some(p3)) = (p1, p2, p3) {
        let confidence = joint_confidence(&[p1, p2, p3], min_confidence);
        let value = calculate_angle(p1, p2, p3);
        angles.push(make_angle(
            name,
            value,
            normal_range,
            confidence,
            unreliable,
        ));
    }
}

fn make_angle(
    name: &str,
    value: f32,
    normal_range: (f32, f32),
    confidence: f32,
    unreliable: bool,
) -> JointAngle {
    let status = if unreliable || confidence < 0.55 {
        "low_confidence".to_string()
    } else {
        get_angle_status(value, normal_range)
    };

    JointAngle {
        name: name.to_string(),
        value,
        normal_range,
        status,
        confidence,
    }
}

fn joint_confidence(points: &[&Keypoint], min_confidence: f32) -> f32 {
    let visibility = points.iter().map(|point| point.visibility).sum::<f32>() / points.len() as f32;
    visibility.clamp(min_confidence, 1.0)
}

fn get_angle_status(angle: f32, normal_range: (f32, f32)) -> String {
    let (min, max) = normal_range;
    let tolerance = (max - min) * 0.2;

    if angle >= min - tolerance && angle <= max + tolerance {
        "normal".to_string()
    } else if angle >= min - tolerance * 2.0 && angle <= max + tolerance * 2.0 {
        "warning".to_string()
    } else {
        "error".to_string()
    }
}

#[derive(Default)]
struct LegOverlapInfo {
    left_leg_unreliable: bool,
    right_leg_unreliable: bool,
}

fn detect_leg_overlap(keypoints: &[Keypoint]) -> LegOverlapInfo {
    let get_kp = |id: u32| keypoints.iter().find(|k| k.id == id);

    let (
        Some(left_hip),
        Some(right_hip),
        Some(left_knee),
        Some(right_knee),
        Some(left_ankle),
        Some(right_ankle),
    ) = (
        get_kp(23),
        get_kp(24),
        get_kp(25),
        get_kp(26),
        get_kp(27),
        get_kp(28),
    )
    else {
        return LegOverlapInfo::default();
    };

    let hip_width = (left_hip.x - right_hip.x).abs().max(1.0);
    let knee_gap = (left_knee.x - right_knee.x).abs() / hip_width;
    let ankle_gap = (left_ankle.x - right_ankle.x).abs() / hip_width;

    let left_leg_conf = joint_confidence(&[left_hip, left_knee, left_ankle], 0.0);
    let right_leg_conf = joint_confidence(&[right_hip, right_knee, right_ankle], 0.0);
    let legs_overlap = knee_gap < 0.22 || ankle_gap < 0.18;

    if !legs_overlap {
        return LegOverlapInfo::default();
    }

    if left_leg_conf > right_leg_conf + 0.08 {
        LegOverlapInfo {
            left_leg_unreliable: false,
            right_leg_unreliable: true,
        }
    } else if right_leg_conf > left_leg_conf + 0.08 {
        LegOverlapInfo {
            left_leg_unreliable: true,
            right_leg_unreliable: false,
        }
    } else {
        LegOverlapInfo {
            left_leg_unreliable: true,
            right_leg_unreliable: true,
        }
    }
}

pub fn get_shooting_arm_angles(keypoints: &[Keypoint], is_right_handed: bool) -> Vec<JointAngle> {
    let mut angles = Vec::new();

    let (shoulder_id, elbow_id, wrist_id) = if is_right_handed {
        (12, 14, 16)
    } else {
        (11, 13, 15)
    };

    let get_kp = |id: u32| keypoints.iter().find(|k| k.id == id);

    if let (Some(shoulder), Some(elbow), Some(wrist)) =
        (get_kp(shoulder_id), get_kp(elbow_id), get_kp(wrist_id))
    {
        let confidence = joint_confidence(&[shoulder, elbow, wrist], 0.45);
        let elbow_angle = calculate_angle(shoulder, elbow, wrist);
        angles.push(make_angle(
            "shooting_elbow_angle",
            elbow_angle,
            (90.0, 130.0),
            confidence,
            false,
        ));

        let release_angle = calculate_release_angle(shoulder, wrist);
        angles.push(make_angle(
            "release_angle",
            release_angle,
            (45.0, 60.0),
            confidence,
            false,
        ));
    }

    angles
}

pub fn calculate_release_angle(shoulder: &Keypoint, wrist: &Keypoint) -> f32 {
    let arm_vector = Vector2::new(wrist.x - shoulder.x, wrist.y - shoulder.y);
    let mag = arm_vector.magnitude();

    if mag == 0.0 {
        return 0.0;
    }

    let cos_angle = (arm_vector.x.abs() / mag).clamp(-1.0, 1.0);
    cos_angle.acos().to_degrees()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keypoint(id: u32, name: &str, x: f32, y: f32) -> Keypoint {
        Keypoint {
            id,
            name: name.to_string(),
            x,
            y,
            z: 0.0,
            visibility: 1.0,
        }
    }

    #[test]
    fn release_angle_is_mirror_invariant() {
        let shoulder = keypoint(12, "shoulder", 0.0, 0.0);
        let right_wrist = keypoint(16, "right_wrist", 10.0, -10.0);
        let left_wrist = keypoint(15, "left_wrist", -10.0, -10.0);

        let right_angle = calculate_release_angle(&shoulder, &right_wrist);
        let left_angle = calculate_release_angle(&shoulder, &left_wrist);

        assert!((right_angle - 45.0).abs() < 0.01);
        assert!((left_angle - 45.0).abs() < 0.01);
    }

    #[test]
    fn trunk_angle_is_zero_when_head_is_directly_above_shoulders() {
        let keypoints = vec![
            keypoint(0, "nose", 0.0, -10.0),
            keypoint(11, "left_shoulder", -10.0, 0.0),
            keypoint(12, "right_shoulder", 10.0, 0.0),
        ];

        let trunk_angle = calculate_all_angles(&keypoints)
            .into_iter()
            .find(|angle| angle.name == "trunk_tilt")
            .map(|angle| angle.value)
            .expect("expected trunk angle");

        assert!(trunk_angle.abs() < 0.01);
    }

    #[test]
    fn marks_overlapping_right_leg_as_low_confidence() {
        let keypoints = vec![
            keypoint(23, "left_hip", -20.0, 0.0),
            keypoint(24, "right_hip", 20.0, 0.0),
            keypoint(25, "left_knee", -10.0, 80.0),
            keypoint(26, "right_knee", -8.0, 82.0),
            keypoint(27, "left_ankle", -5.0, 160.0),
            keypoint(28, "right_ankle", -3.0, 162.0),
        ];

        let right_knee_angle = calculate_all_angles(&keypoints)
            .into_iter()
            .find(|angle| angle.name == "right_knee_angle")
            .expect("expected right knee angle");

        assert_eq!(right_knee_angle.status, "low_confidence");
    }
}
