use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbPlayerTemplate {
    pub id: i64,
    pub name: String,
    pub team: String,
    pub description: String,
    pub pose_data_json: String,
    pub angles_json: String,
    pub profile_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbAnalysisHistory {
    pub id: i64,
    pub image_path: String,
    pub annotated_image_path: String,
    pub analysis_json: String,
    pub comparison_json: Option<String>,
    pub suggestions_json: String,
    pub ai_coaching_summary: Option<String>,
    pub ai_coaching_suggestions_json: Option<String>,
    pub source_identifier: Option<String>,
    pub video_analysis_json: Option<String>,
    pub created_at: i64,
}
