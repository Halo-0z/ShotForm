use anyhow::Result;
use sqlx::SqlitePool;
use tauri::Manager;

use super::models::{DbAnalysisHistory, DbPlayerTemplate};
use crate::models::{
    AnalysisHistory, ComparisonResult, CorrectionSuggestion, PlayerTemplate, ShotAnalysis,
};

pub async fn init_database(app_handle: &tauri::AppHandle) -> Result<()> {
    let app_dir = app_handle.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("basketball_analyzer.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePool::connect(&db_url).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS player_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            team TEXT NOT NULL,
            description TEXT,
            pose_data_json TEXT NOT NULL,
            angles_json TEXT NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT NOT NULL,
            annotated_image_path TEXT NOT NULL,
            analysis_json TEXT NOT NULL,
            comparison_json TEXT,
            suggestions_json TEXT NOT NULL,
            ai_coaching_summary TEXT,
            ai_coaching_suggestions_json TEXT,
            created_at INTEGER NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await?;

    ensure_analysis_history_column(
        &pool,
        "ALTER TABLE analysis_history ADD COLUMN ai_coaching_summary TEXT",
    )
    .await?;
    ensure_analysis_history_column(
        &pool,
        "ALTER TABLE analysis_history ADD COLUMN ai_coaching_suggestions_json TEXT",
    )
    .await?;

    app_handle.manage(pool);

    Ok(())
}

async fn ensure_analysis_history_column(pool: &SqlitePool, statement: &str) -> Result<()> {
    match sqlx::query(statement).execute(pool).await {
        Ok(_) => Ok(()),
        Err(error) => {
            let message = error.to_string();
            if message.contains("duplicate column name") {
                Ok(())
            } else {
                Err(error.into())
            }
        }
    }
}

pub async fn get_player_templates(pool: &SqlitePool) -> Result<Vec<PlayerTemplate>> {
    let rows = sqlx::query_as::<_, DbPlayerTemplate>("SELECT * FROM player_templates")
        .fetch_all(pool)
        .await?;

    let templates = rows
        .into_iter()
        .map(|row| {
            let pose_data = serde_json::from_str(&row.pose_data_json).unwrap_or_default();
            let angles = serde_json::from_str(&row.angles_json).unwrap_or_default();

            PlayerTemplate {
                id: row.id,
                name: row.name,
                team: row.team,
                description: row.description,
                pose_data,
                angles,
            }
        })
        .collect();

    Ok(templates)
}

pub async fn save_player_template(pool: &SqlitePool, template: &PlayerTemplate) -> Result<i64> {
    let pose_data_json = serde_json::to_string(&template.pose_data)?;
    let angles_json = serde_json::to_string(&template.angles)?;

    let result = sqlx::query(
        r#"
        INSERT INTO player_templates (name, team, description, pose_data_json, angles_json)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&template.name)
    .bind(&template.team)
    .bind(&template.description)
    .bind(&pose_data_json)
    .bind(&angles_json)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn save_analysis_history(
    pool: &SqlitePool,
    image_path: &str,
    annotated_image_path: &str,
    analysis: &ShotAnalysis,
    comparison: Option<&ComparisonResult>,
    suggestions: &[CorrectionSuggestion],
    ai_coaching_summary: Option<&str>,
    ai_coaching_suggestions: Option<&[CorrectionSuggestion]>,
) -> Result<i64> {
    let analysis_json = serde_json::to_string(analysis)?;
    let comparison_json = comparison.map(|c| serde_json::to_string(c)).transpose()?;
    let suggestions_json = serde_json::to_string(suggestions)?;
    let ai_coaching_suggestions_json = ai_coaching_suggestions
        .map(serde_json::to_string)
        .transpose()?;
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let result = sqlx::query(
        r#"
        INSERT INTO analysis_history 
        (
            image_path,
            annotated_image_path,
            analysis_json,
            comparison_json,
            suggestions_json,
            ai_coaching_summary,
            ai_coaching_suggestions_json,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(image_path)
    .bind(annotated_image_path)
    .bind(&analysis_json)
    .bind(&comparison_json)
    .bind(&suggestions_json)
    .bind(ai_coaching_summary)
    .bind(&ai_coaching_suggestions_json)
    .bind(created_at)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}


pub async fn update_analysis_history_ai_coaching(
    pool: &SqlitePool,
    id: i64,
    ai_coaching_summary: &str,
    ai_coaching_suggestions: &[CorrectionSuggestion],
) -> Result<()> {
    let ai_coaching_suggestions_json = serde_json::to_string(ai_coaching_suggestions)?;

    sqlx::query(
        r#"
        UPDATE analysis_history
        SET ai_coaching_summary = ?, ai_coaching_suggestions_json = ?
        WHERE id = ?
        "#,
    )
    .bind(ai_coaching_summary)
    .bind(&ai_coaching_suggestions_json)
    .bind(id)
    .execute(pool)
    .await?;

    Ok(())
}
pub async fn get_analysis_history(pool: &SqlitePool) -> Result<Vec<AnalysisHistory>> {
    let rows = sqlx::query_as::<_, DbAnalysisHistory>(
        "SELECT * FROM analysis_history ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let history = rows
        .into_iter()
        .map(|row| {
            let analysis = serde_json::from_str(&row.analysis_json).unwrap_or_default();
            let comparison = row
                .comparison_json
                .and_then(|json| serde_json::from_str(&json).ok());
            let suggestions = serde_json::from_str(&row.suggestions_json).unwrap_or_default();
            let ai_coaching_suggestions = row
                .ai_coaching_suggestions_json
                .and_then(|json| serde_json::from_str(&json).ok());

            AnalysisHistory {
                id: row.id,
                image_path: row.image_path,
                annotated_image_path: row.annotated_image_path,
                analysis,
                comparison,
                suggestions,
                ai_coaching_summary: row.ai_coaching_summary,
                ai_coaching_suggestions,
                created_at: row.created_at as u64,
            }
        })
        .collect();

    Ok(history)
}

pub async fn delete_analysis_history(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("DELETE FROM analysis_history WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

