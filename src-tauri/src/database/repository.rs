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

pub async fn get_or_seed_player_templates(
    pool: &SqlitePool,
    defaults: &[PlayerTemplate],
) -> Result<Vec<PlayerTemplate>> {
    let existing = get_player_templates(pool).await?;
    if !existing.is_empty() || defaults.is_empty() {
        return Ok(existing);
    }

    for template in defaults {
        let pose_data_json = serde_json::to_string(&template.pose_data)?;
        let angles_json = serde_json::to_string(&template.angles)?;

        sqlx::query(
            r#"
            INSERT INTO player_templates (id, name, team, description, pose_data_json, angles_json)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(template.id)
        .bind(&template.name)
        .bind(&template.team)
        .bind(&template.description)
        .bind(&pose_data_json)
        .bind(&angles_json)
        .execute(pool)
        .await?;
    }

    get_player_templates(pool).await
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

pub async fn update_analysis_history_comparison(
    pool: &SqlitePool,
    id: i64,
    comparison: Option<&ComparisonResult>,
) -> Result<()> {
    let comparison_json = comparison.map(serde_json::to_string).transpose()?;

    sqlx::query(
        r#"
        UPDATE analysis_history
        SET comparison_json = ?
        WHERE id = ?
        "#,
    )
    .bind(&comparison_json)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::get_default_player_templates;
    use crate::models::{AngleDifference, JointAngle, PoseData, ShotType};

    async fn setup_in_memory_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory sqlite pool");

        sqlx::query(
            r#"
            CREATE TABLE player_templates (
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
        .await
        .expect("create player_templates");

        sqlx::query(
            r#"
            CREATE TABLE analysis_history (
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
        .await
        .expect("create analysis_history");

        pool
    }

    fn sample_analysis() -> ShotAnalysis {
        ShotAnalysis {
            pose_data: PoseData::default(),
            angles: vec![JointAngle {
                name: "right_elbow_angle".to_string(),
                value: 90.0,
                normal_range: (0.0, 180.0),
                status: "normal".to_string(),
                confidence: 1.0,
            }],
            shot_type: ShotType::Unknown,
            shot_type_confidence: 0.0,
            shot_type_reasons: Vec::new(),
            ai_review: None,
            timestamp: 0,
        }
    }

    fn sample_comparison() -> ComparisonResult {
        ComparisonResult {
            player: PlayerTemplate {
                id: 1,
                name: "Template".to_string(),
                team: "Team".to_string(),
                description: "desc".to_string(),
                pose_data: PoseData::default(),
                angles: Vec::new(),
            },
            similarity: 0.91,
            angle_differences: vec![AngleDifference {
                name: "right_elbow_angle".to_string(),
                user_value: 90.0,
                player_value: 88.0,
                difference: 2.0,
            }],
        }
    }

    async fn insert_history_row(pool: &SqlitePool) -> i64 {
        save_analysis_history(
            pool,
            "image.png",
            "annotated.png",
            &sample_analysis(),
            None,
            &[],
            None,
            None,
        )
        .await
        .expect("insert analysis history")
    }

    #[tokio::test]
    async fn seeds_default_player_templates_when_table_is_empty() {
        let pool = setup_in_memory_pool().await;

        let templates = get_or_seed_player_templates(&pool, &get_default_player_templates())
            .await
            .expect("seed templates");

        assert!(!templates.is_empty());
        assert_eq!(templates.len(), get_default_player_templates().len());
    }

    #[tokio::test]
    async fn updates_analysis_history_comparison_json() {
        let pool = setup_in_memory_pool().await;
        let history_id = insert_history_row(&pool).await;

        update_analysis_history_comparison(&pool, history_id, Some(&sample_comparison()))
            .await
            .expect("update comparison json");

        let rows = get_analysis_history(&pool).await.expect("fetch history");

        assert_eq!(rows.len(), 1);
        assert!(rows[0].comparison.is_some());
        assert_eq!(rows[0].comparison.as_ref().unwrap().player.name, "Template");
    }
}

