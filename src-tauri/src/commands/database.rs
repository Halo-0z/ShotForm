use crate::database::{
    delete_analysis_history as db_delete_history, get_analysis_history as db_get_history,
    get_player_templates as db_get_players, save_analysis_history as db_save_history,
    save_player_template as db_save_player, update_analysis_history_ai_coaching as db_update_history_ai,
};
use crate::models::{
    AnalysisHistory, ComparisonResult, CorrectionSuggestion, PlayerTemplate, ShotAnalysis,
};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn save_analysis_history(
    pool: State<'_, SqlitePool>,
    image_path: String,
    annotated_image_path: String,
    analysis: ShotAnalysis,
    comparison: Option<ComparisonResult>,
    suggestions: Vec<CorrectionSuggestion>,
    ai_coaching_summary: Option<String>,
    ai_coaching_suggestions: Option<Vec<CorrectionSuggestion>>,
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
    db_update_history_ai(
        &pool,
        id,
        &ai_coaching_summary,
        &ai_coaching_suggestions,
    )
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
    db_save_player(&pool, &template)
        .await
        .map_err(|e| e.to_string())
}
