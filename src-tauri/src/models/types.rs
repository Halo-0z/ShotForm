use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Keypoint {
    pub id: u32,
    pub name: String,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub visibility: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PoseData {
    pub keypoints: Vec<Keypoint>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct JointAngle {
    pub name: String,
    pub value: f32,
    pub normal_range: (f32, f32),
    pub status: String,
    #[serde(default)]
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum ShotType {
    #[serde(alias = "one_motion")]
    OneMotion,
    #[serde(alias = "one_point_five_motion")]
    OnePointFiveMotion,
    #[serde(alias = "two_motion")]
    TwoMotion,
    #[default]
    #[serde(alias = "unknown")]
    Unknown,
}

impl ShotType {
    pub fn to_chinese(&self) -> &'static str {
        match self {
            ShotType::OneMotion => "一段式投篮",
            ShotType::OnePointFiveMotion => "1.5 段式投篮",
            ShotType::TwoMotion => "二段式投篮",
            ShotType::Unknown => "分型待确认",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ShotAnalysis {
    pub pose_data: PoseData,
    pub angles: Vec<JointAngle>,
    pub shot_type: ShotType,
    pub shot_type_confidence: f32,
    pub shot_type_reasons: Vec<String>,
    #[serde(default)]
    pub ai_review: Option<AiShotReview>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoAnalysisFrame {
    pub index: u32,
    pub timestamp_ms: u32,
    pub image_data: String,
    pub annotated_image_data: String,
    pub analysis: ShotAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoShotAnalysis {
    pub video_path: String,
    pub duration_ms: u32,
    pub trim_start_ms: u32,
    pub trim_end_ms: u32,
    pub fps: f32,
    pub total_frames: u32,
    pub frames_analyzed: usize,
    pub frames: Vec<VideoAnalysisFrame>,
    pub best_frame_index: usize,
    pub overall_shot_type: ShotType,
    pub overall_shot_type_confidence: f32,
    pub overall_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiShotReview {
    pub source: String,
    pub phase: String,
    pub phase_confidence: f32,
    pub decision_mode: String,
    pub shot_type: ShotType,
    pub shot_type_confidence: f32,
    pub title: String,
    pub summary: String,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAnglePayloadItem {
    pub name: String,
    pub display_name: String,
    pub value: f32,
    pub normal_range: (f32, f32),
    pub status: String,
    pub confidence: f32,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiShotContext {
    pub source: String,
    pub suspected_shooting_hand: String,
    pub shot_phase: String,
    pub shot_type: String,
    pub shot_type_confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPayloadFlags {
    pub prefer_business_angles: bool,
    pub ignore_raw_side_angles_when_conflict_with_shooting_angles: bool,
    pub skip_low_confidence_angles: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAnalysisPayload {
    pub shot_context: AiShotContext,
    pub primary_angles: Vec<AiAnglePayloadItem>,
    pub reference_angles: Vec<AiAnglePayloadItem>,
    pub low_confidence_angles: Vec<String>,
    pub shot_type_reasons: Vec<String>,
    pub flags: AiPayloadFlags,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerTemplate {
    pub id: i64,
    pub name: String,
    pub team: String,
    pub description: String,
    pub pose_data: PoseData,
    pub angles: Vec<JointAngle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AngleDifference {
    pub name: String,
    pub user_value: f32,
    pub player_value: f32,
    pub difference: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonResult {
    pub player: PlayerTemplate,
    pub similarity: f32,
    pub angle_differences: Vec<AngleDifference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionSuggestion {
    pub body_part: String,
    pub issue: String,
    pub suggestion: String,
    #[serde(default = "default_correction_priority")]
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiCoachingResponse {
    pub summary: String,
    pub suggestions: Vec<CorrectionSuggestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisHistory {
    pub id: i64,
    pub image_path: String,
    pub annotated_image_path: String,
    pub analysis: ShotAnalysis,
    pub comparison: Option<ComparisonResult>,
    pub suggestions: Vec<CorrectionSuggestion>,
    #[serde(default)]
    pub ai_coaching_summary: Option<String>,
    #[serde(default)]
    pub ai_coaching_suggestions: Option<Vec<CorrectionSuggestion>>,
    pub created_at: u64,
}

pub const KEYPOINT_NAMES: [&str; 33] = [
    "nose",
    "left_eye_inner",
    "left_eye",
    "left_eye_outer",
    "right_eye_inner",
    "right_eye",
    "right_eye_outer",
    "left_ear",
    "right_ear",
    "mouth_left",
    "mouth_right",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_pinky",
    "right_pinky",
    "left_index",
    "right_index",
    "left_thumb",
    "right_thumb",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
    "left_heel",
    "right_heel",
    "left_foot_index",
    "right_foot_index",
];

pub fn get_keypoint_name(id: u32) -> &'static str {
    KEYPOINT_NAMES.get(id as usize).unwrap_or(&"unknown")
}

fn default_correction_priority() -> String {
    "medium".to_string()
}

#[cfg(test)]
mod tests {
    use super::AnalysisHistory;

    #[test]
    fn analysis_history_deserializes_without_ai_coaching_fields() {
        let json = r#"{
            "id": 1,
            "imagePath": "a",
            "annotatedImagePath": "b",
            "analysis": {
                "poseData": {"keypoints": [], "width": 0, "height": 0},
                "angles": [],
                "shotType": "unknown",
                "shotTypeConfidence": 0.0,
                "shotTypeReasons": [],
                "timestamp": 0
            },
            "suggestions": [],
            "createdAt": 0
        }"#;

        let parsed: AnalysisHistory = serde_json::from_str(json).unwrap();
        assert!(parsed.ai_coaching_summary.is_none());
        assert!(parsed.ai_coaching_suggestions.is_none());
    }
}
