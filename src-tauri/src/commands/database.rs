use crate::database::{
    delete_analysis_history as db_delete_history, delete_player_template as db_delete_player,
    get_analysis_history as db_get_history,
    get_analysis_history_paginated as db_get_history_paginated,
    get_player_templates as db_get_players, save_analysis_history as db_save_history,
    save_player_template as db_save_player,
    update_analysis_history_ai_coaching as db_update_history_ai,
    update_analysis_history_comparison as db_update_history_comparison,
    update_player_template as db_update_player,
    update_player_template_metadata as db_update_player_metadata,
};
use crate::models::{
    AnalysisHistory, ComparisonWorkbenchSnapshot, CorrectionSuggestion, PlayerTemplate,
    PlayerTemplateMetadataUpdate, ShotAnalysis, VideoShotAnalysis,
};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn save_analysis_history(
    pool: State<'_, SqlitePool>,
    image_path: String,
    annotated_image_path: String,
    analysis: ShotAnalysis,
    comparison: Option<ComparisonWorkbenchSnapshot>,
    suggestions: Vec<CorrectionSuggestion>,
    ai_coaching_summary: Option<String>,
    ai_coaching_suggestions: Option<Vec<CorrectionSuggestion>>,
    source_identifier: Option<String>,
    video_analysis: Option<VideoShotAnalysis>,
) -> Result<i64, String> {
    db_save_history(
        &pool,
        &image_path,
        &annotated_image_path,
        &analysis,
        comparison.as_ref(),
        &suggestions,
        ai_coaching_summary.as_deref(),
        ai_coaching_suggestions.as_deref(),
        source_identifier.as_deref(),
        video_analysis.as_ref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_analysis_history_ai_coaching(
    pool: State<'_, SqlitePool>,
    id: i64,
    ai_coaching_summary: String,
    ai_coaching_suggestions: Vec<CorrectionSuggestion>,
) -> Result<(), String> {
    db_update_history_ai(&pool, id, &ai_coaching_summary, &ai_coaching_suggestions)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_analysis_history_comparison(
    pool: State<'_, SqlitePool>,
    id: i64,
    comparison: Option<ComparisonWorkbenchSnapshot>,
) -> Result<(), String> {
    db_update_history_comparison(&pool, id, comparison.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analysis_history(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AnalysisHistory>, String> {
    db_get_history(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analysis_history_page(
    pool: State<'_, SqlitePool>,
    limit: i64,
    offset: i64,
) -> Result<Vec<AnalysisHistory>, String> {
    db_get_history_paginated(&pool, Some(limit), Some(offset))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_analysis_history(pool: State<'_, SqlitePool>, id: i64) -> Result<(), String> {
    db_delete_history(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_player_templates_db(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<PlayerTemplate>, String> {
    db_get_players(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_player_template(
    pool: State<'_, SqlitePool>,
    template: PlayerTemplate,
) -> Result<i64, String> {
    validate_player_template_for_creation(&template)?;

    db_save_player(&pool, &template)
        .await
        .map_err(|e| e.to_string())
}

fn validate_player_template_for_creation(template: &PlayerTemplate) -> Result<(), String> {
    let Some(profile) = template.template_profile.as_ref() else {
        return Err("球星模板必须来自完整投篮视频分析，不能保存单帧截图模板。".to_string());
    };

    if profile.source_kind != "video"
        || profile.samples_used == 0
        || profile.phase_profiles.is_empty()
    {
        return Err("球星模板的视频动作画像不完整，请重新上传投篮视频并完成分析。".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn update_player_template(
    pool: State<'_, SqlitePool>,
    template: PlayerTemplate,
) -> Result<(), String> {
    db_update_player(&pool, &template)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_player_template_metadata(
    pool: State<'_, SqlitePool>,
    template: PlayerTemplateMetadataUpdate,
) -> Result<(), String> {
    db_update_player_metadata(
        &pool,
        template.id,
        &template.name,
        &template.team,
        &template.description,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_player_template(pool: State<'_, SqlitePool>, id: i64) -> Result<(), String> {
    db_delete_player(&pool, id).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_single_frame_player_template_creation() {
        let template = PlayerTemplate {
            id: 0,
            name: "Single Frame Curry".to_string(),
            team: "Golden State".to_string(),
            description: "single frame".to_string(),
            pose_data: Default::default(),
            angles: Vec::new(),
            template_profile: None,
        };

        let result = validate_player_template_for_creation(&template);

        assert_eq!(
            result,
            Err("球星模板必须来自完整投篮视频分析，不能保存单帧截图模板。".to_string())
        );
    }
}
