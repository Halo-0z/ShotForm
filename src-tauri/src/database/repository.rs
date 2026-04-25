use anyhow::{bail, Result};
use sqlx::{Row, SqlitePool};
use tauri::Manager;

use super::models::{DbAnalysisHistory, DbPlayerTemplate};
use crate::analysis::get_default_player_templates;
use crate::models::{
    AnalysisHistory, ComparisonDetailPayload, ComparisonLearningBridge, ComparisonLearningGap,
    ComparisonMode, ComparisonResult, ComparisonSummary, ComparisonWorkbenchSnapshot,
    CorrectionSuggestion, PlayerTemplate, ShotAnalysis, VideoShotAnalysis,
};
use std::collections::BTreeMap;

const LEGACY_HISTORY_KEY_PREFIX: &str = "legacy-history-";
const LEGACY_PLAYER_KEY_PREFIX: &str = "legacy-player-";

pub async fn init_database(app_handle: &tauri::AppHandle) -> Result<()> {
    let app_dir = app_handle.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("basketball_analyzer.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePool::connect(&db_url).await?;

    initialize_database_schema(&pool).await?;
    seed_default_player_templates_if_empty(&pool).await?;
    app_handle.manage(pool);

    Ok(())
}

async fn initialize_database_schema(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS player_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            team TEXT NOT NULL,
            description TEXT,
            pose_data_json TEXT NOT NULL,
            angles_json TEXT NOT NULL,
            profile_json TEXT
        )
        "#,
    )
    .execute(pool)
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
    .execute(pool)
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
    ensure_analysis_history_column(
        &pool,
        "ALTER TABLE analysis_history ADD COLUMN source_identifier TEXT",
    )
    .await?;
    ensure_analysis_history_column(
        &pool,
        "ALTER TABLE analysis_history ADD COLUMN video_analysis_json TEXT",
    )
    .await?;
    ensure_database_column(
        &pool,
        "ALTER TABLE player_templates ADD COLUMN profile_json TEXT",
    )
    .await?;

    Ok(())
}

async fn seed_default_player_templates_if_empty(pool: &SqlitePool) -> Result<()> {
    let defaults = get_default_player_templates();
    get_or_seed_player_templates(pool, &defaults).await?;
    Ok(())
}

async fn ensure_analysis_history_column(pool: &SqlitePool, statement: &str) -> Result<()> {
    ensure_database_column(pool, statement).await
}

async fn ensure_database_column(pool: &SqlitePool, statement: &str) -> Result<()> {
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

async fn table_has_column(pool: &SqlitePool, table: &str, column: &str) -> Result<bool> {
    let pragma = format!("PRAGMA table_info({table})");
    let rows = sqlx::query(&pragma).fetch_all(pool).await?;

    Ok(rows.into_iter().any(|row| {
        row.try_get::<String, _>("name")
            .map(|name| name == column)
            .unwrap_or(false)
    }))
}

async fn count_player_templates(pool: &SqlitePool) -> Result<i64> {
    let row = sqlx::query("SELECT COUNT(1) AS count FROM player_templates")
        .fetch_one(pool)
        .await?;

    Ok(row.try_get::<i64, _>("count").unwrap_or(0))
}

pub async fn get_player_templates(pool: &SqlitePool) -> Result<Vec<PlayerTemplate>> {
    let has_profile_json = table_has_column(pool, "player_templates", "profile_json").await?;
    let query = if has_profile_json {
        "SELECT id, name, team, description, pose_data_json, angles_json, profile_json FROM player_templates"
    } else {
        "SELECT id, name, team, description, pose_data_json, angles_json, NULL AS profile_json FROM player_templates"
    };

    let rows = sqlx::query_as::<_, DbPlayerTemplate>(query)
        .fetch_all(pool)
        .await?;

    let templates = rows
        .into_iter()
        .map(|row| {
            let pose_data = serde_json::from_str(&row.pose_data_json).unwrap_or_default();
            let angles = serde_json::from_str(&row.angles_json).unwrap_or_default();
            let template_profile = row
                .profile_json
                .as_deref()
                .and_then(|json| serde_json::from_str(json).ok());

            PlayerTemplate {
                id: row.id,
                name: row.name,
                team: row.team,
                description: row.description,
                pose_data,
                angles,
                template_profile,
            }
        })
        .collect();

    Ok(templates)
}

pub async fn get_or_seed_player_templates(
    pool: &SqlitePool,
    defaults: &[PlayerTemplate],
) -> Result<Vec<PlayerTemplate>> {
    let existing_count = count_player_templates(pool).await?;
    if existing_count > 0 || defaults.is_empty() {
        return get_player_templates(pool).await;
    }

    for template in defaults {
        let pose_data_json = serde_json::to_string(&template.pose_data)?;
        let angles_json = serde_json::to_string(&template.angles)?;
        let profile_json = template
            .template_profile
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        sqlx::query(
            r#"
            INSERT INTO player_templates (id, name, team, description, pose_data_json, angles_json, profile_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(template.id)
        .bind(&template.name)
        .bind(&template.team)
        .bind(&template.description)
        .bind(&pose_data_json)
        .bind(&angles_json)
        .bind(&profile_json)
        .execute(pool)
        .await?;
    }

    get_player_templates(pool).await
}

pub async fn save_player_template(pool: &SqlitePool, template: &PlayerTemplate) -> Result<i64> {
    let pose_data_json = serde_json::to_string(&template.pose_data)?;
    let angles_json = serde_json::to_string(&template.angles)?;
    let profile_json = template
        .template_profile
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;

    let result = sqlx::query(
        r#"
        INSERT INTO player_templates (name, team, description, pose_data_json, angles_json, profile_json)
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&template.name)
    .bind(&template.team)
    .bind(&template.description)
    .bind(&pose_data_json)
    .bind(&angles_json)
    .bind(&profile_json)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn update_player_template_metadata(
    pool: &SqlitePool,
    id: i64,
    name: &str,
    team: &str,
    description: &str,
) -> Result<()> {
    let trimmed_name = name.trim();
    let trimmed_team = team.trim();
    let trimmed_description = description.trim();

    if id <= 0 {
        bail!("template id must be positive");
    }

    if trimmed_name.is_empty() {
        bail!("template name cannot be empty");
    }

    if trimmed_team.is_empty() {
        bail!("template team cannot be empty");
    }

    let result = sqlx::query(
        r#"
        UPDATE player_templates
        SET name = ?, team = ?, description = ?
        WHERE id = ?
        "#,
    )
    .bind(trimmed_name)
    .bind(trimmed_team)
    .bind(trimmed_description)
    .bind(id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        bail!("player template not found: {}", id);
    }

    Ok(())
}

pub async fn update_player_template(pool: &SqlitePool, template: &PlayerTemplate) -> Result<()> {
    update_player_template_metadata(
        pool,
        template.id,
        &template.name,
        &template.team,
        &template.description,
    )
    .await
}

pub async fn delete_player_template(pool: &SqlitePool, id: i64) -> Result<()> {
    if id <= 0 {
        bail!("模板编号必须为正数");
    }

    let result = sqlx::query("DELETE FROM player_templates WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        bail!("未找到要删除的球星模板：{}", id);
    }

    Ok(())
}

pub async fn save_analysis_history(
    pool: &SqlitePool,
    image_path: &str,
    annotated_image_path: &str,
    analysis: &ShotAnalysis,
    comparison: Option<&ComparisonWorkbenchSnapshot>,
    suggestions: &[CorrectionSuggestion],
    ai_coaching_summary: Option<&str>,
    ai_coaching_suggestions: Option<&[CorrectionSuggestion]>,
    source_identifier: Option<&str>,
    video_analysis: Option<&VideoShotAnalysis>,
) -> Result<i64> {
    let analysis_json = serde_json::to_string(analysis)?;
    let comparison_json = comparison.map(|c| serde_json::to_string(c)).transpose()?;
    let suggestions_json = serde_json::to_string(suggestions)?;
    let ai_coaching_suggestions_json = ai_coaching_suggestions
        .map(serde_json::to_string)
        .transpose()?;
    let video_analysis_json = video_analysis
        .map(serde_json::to_string)
        .transpose()?;
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

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
            source_identifier,
            video_analysis_json,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(image_path)
    .bind(annotated_image_path)
    .bind(&analysis_json)
    .bind(&comparison_json)
    .bind(&suggestions_json)
    .bind(ai_coaching_summary)
    .bind(&ai_coaching_suggestions_json)
    .bind(source_identifier)
    .bind(&video_analysis_json)
    .bind(created_at)
    .execute(pool)
    .await?;

    let history_id = result.last_insert_rowid();

    if let Some(snapshot) = comparison {
        let rebound_snapshot = rebind_legacy_snapshot(snapshot, history_id);
        if rebound_snapshot.analysis_key != snapshot.analysis_key {
            let rebound_json = serde_json::to_string(&rebound_snapshot)?;
            sqlx::query(
                r#"
                UPDATE analysis_history
                SET comparison_json = ?
                WHERE id = ?
                "#,
            )
            .bind(rebound_json)
            .bind(history_id)
            .execute(pool)
            .await?;
        }
    }

    Ok(history_id)
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
    comparison: Option<&ComparisonWorkbenchSnapshot>,
) -> Result<()> {
    let comparison_json = comparison
        .map(|snapshot| rebind_legacy_snapshot(snapshot, id))
        .map(|snapshot| serde_json::to_string(&snapshot))
        .transpose()?;

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
                .as_deref()
                .and_then(|json| deserialize_comparison_snapshot(json, row.id));
            let suggestions = serde_json::from_str(&row.suggestions_json).unwrap_or_default();
            let ai_coaching_suggestions = row
                .ai_coaching_suggestions_json
                .and_then(|json| serde_json::from_str(&json).ok());
            let video_analysis = row
                .video_analysis_json
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
                source_identifier: row.source_identifier,
                video_analysis,
                created_at: row.created_at as u64,
            }
        })
        .collect();

    Ok(history)
}

fn deserialize_comparison_snapshot(
    json: &str,
    history_id: i64,
) -> Option<ComparisonWorkbenchSnapshot> {
    serde_json::from_str::<ComparisonWorkbenchSnapshot>(json)
        .ok()
        .or_else(|| {
            serde_json::from_str::<ComparisonResult>(json)
                .ok()
                .map(|result| wrap_legacy_comparison_result(result, history_id))
        })
}

fn wrap_legacy_comparison_result(
    result: ComparisonResult,
    history_id: i64,
) -> ComparisonWorkbenchSnapshot {
    let player_id = result.player.id;
    let top_differences = legacy_top_differences(&result);
    let summary = ComparisonSummary {
        player: result.player.clone(),
        similarity: result.similarity,
        top_differences,
        match_reason: format!(
            "{} was restored from legacy comparison history.",
            result.player.name
        ),
        shot_type_alignment: None,
        comparison_mode: ComparisonMode::SingleFrameFallback,
    };
    let detail = ComparisonDetailPayload {
        result,
        learning_bridge: legacy_learning_bridge(&summary),
    };
    let mut details_by_player_id = BTreeMap::new();
    details_by_player_id.insert(player_id, detail.clone());

    ComparisonWorkbenchSnapshot {
        analysis_key: format!("legacy-history-{}-player-{}", history_id, player_id),
        summaries: vec![summary],
        details_by_player_id,
        selected_player_id: Some(player_id),
        selected_detail: Some(detail),
    }
}

fn is_legacy_analysis_key(analysis_key: &str) -> bool {
    analysis_key.starts_with(LEGACY_HISTORY_KEY_PREFIX)
        || analysis_key.starts_with(LEGACY_PLAYER_KEY_PREFIX)
}

fn build_legacy_analysis_key(player_id: i64, history_id: Option<i64>) -> String {
    match history_id {
        Some(history_id) => format!("legacy-history-{}-player-{}", history_id, player_id),
        None => format!("legacy-player-{}", player_id),
    }
}

fn rebind_legacy_snapshot(
    snapshot: &ComparisonWorkbenchSnapshot,
    history_id: i64,
) -> ComparisonWorkbenchSnapshot {
    if !is_legacy_analysis_key(&snapshot.analysis_key) {
        return snapshot.clone();
    }

    let player_id = snapshot
        .selected_player_id
        .or_else(|| {
            snapshot
                .selected_detail
                .as_ref()
                .map(|detail| detail.result.player.id)
        })
        .or_else(|| snapshot.summaries.first().map(|summary| summary.player.id));

    match player_id {
        Some(player_id) => ComparisonWorkbenchSnapshot {
            analysis_key: build_legacy_analysis_key(player_id, Some(history_id)),
            ..snapshot.clone()
        },
        None => snapshot.clone(),
    }
}

fn legacy_top_differences(result: &ComparisonResult) -> Vec<crate::models::AngleDifference> {
    let mut differences = result.angle_differences.clone();
    differences.sort_by(|left, right| {
        right
            .difference
            .abs()
            .partial_cmp(&left.difference.abs())
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.name.cmp(&right.name))
    });
    differences.truncate(3);
    differences
}

fn legacy_learning_bridge(summary: &ComparisonSummary) -> ComparisonLearningBridge {
    let gaps = if summary.top_differences.is_empty() {
        vec![ComparisonLearningGap {
            title: "Legacy comparison detail".to_string(),
            detail: "Review the restored selected player's stored comparison result.".to_string(),
        }]
    } else {
        summary
            .top_differences
            .iter()
            .map(|difference| ComparisonLearningGap {
                title: format!(
                    "{} differs by {:.1} degrees",
                    difference.name,
                    difference.difference.abs()
                ),
                detail: "Use this restored angle gap as the first correction checkpoint."
                    .to_string(),
            })
            .collect()
    };

    ComparisonLearningBridge {
        intro: format!(
            "This comparison was restored from legacy history for {}.",
            summary.player.name
        ),
        gaps,
    }
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
    use crate::models::{
        AngleDifference, CanonicalAngleProfile, ComparisonDetailPayload, ComparisonLearningBridge,
        ComparisonLearningGap, ComparisonMode, ComparisonSummary, ComparisonWorkbenchSnapshot,
        JointAngle, PhaseAngleProfile, PlayerTemplateProfile, PoseData, ShotType,
    };
    use std::collections::BTreeMap;

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
                angles_json TEXT NOT NULL,
                profile_json TEXT
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
                source_identifier TEXT,
                video_analysis_json TEXT,
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
                template_profile: None,
            },
            similarity: 0.91,
            angle_differences: vec![AngleDifference {
                name: "right_elbow_angle".to_string(),
                user_value: 90.0,
                player_value: 88.0,
                difference: 2.0,
            }],
            comparison_mode: ComparisonMode::SingleFrameFallback,
        }
    }

    fn sample_snapshot() -> ComparisonWorkbenchSnapshot {
        let result = sample_comparison();
        let player_id = result.player.id;
        let summary = ComparisonSummary {
            player: result.player.clone(),
            similarity: result.similarity,
            top_differences: result.angle_differences.clone(),
            match_reason: "Template is the closest restored match.".to_string(),
            shot_type_alignment: None,
            comparison_mode: ComparisonMode::SingleFrameFallback,
        };
        let detail = ComparisonDetailPayload {
            result,
            learning_bridge: ComparisonLearningBridge {
                intro: "Use the closest template as a focused reference.".to_string(),
                gaps: vec![ComparisonLearningGap {
                    title: "right_elbow_angle gap".to_string(),
                    detail: "Rebuild this gap from persisted comparison detail.".to_string(),
                }],
            },
        };
        let mut details_by_player_id = BTreeMap::new();
        details_by_player_id.insert(player_id, detail.clone());

        ComparisonWorkbenchSnapshot {
            analysis_key: "analysis-key-1".to_string(),
            summaries: vec![summary],
            details_by_player_id,
            selected_player_id: Some(player_id),
            selected_detail: Some(detail),
        }
    }

    fn sample_stale_legacy_snapshot(old_history_id: i64) -> ComparisonWorkbenchSnapshot {
        let mut snapshot = sample_snapshot();
        snapshot.analysis_key = format!("legacy-history-{}-player-1", old_history_id);
        snapshot
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
            None,
            None,
        )
        .await
        .expect("insert analysis history")
    }

    async fn insert_history_row_with_legacy_comparison(pool: &SqlitePool) -> i64 {
        let history_id = insert_history_row(pool).await;
        let legacy_json = serde_json::to_string(&sample_comparison()).expect("serialize legacy");

        sqlx::query(
            r#"
            UPDATE analysis_history
            SET comparison_json = ?
            WHERE id = ?
            "#,
        )
        .bind(legacy_json)
        .bind(history_id)
        .execute(pool)
        .await
        .expect("update legacy comparison json");

        history_id
    }

    async fn insert_history_row_with_legacy_comparison_and_source(pool: &SqlitePool) -> i64 {
        let history_id = insert_history_row(pool).await;
        let legacy_json = serde_json::to_string(&sample_comparison()).expect("serialize legacy");

        sqlx::query(
            r#"
            UPDATE analysis_history
            SET comparison_json = ?, source_identifier = ?
            WHERE id = ?
            "#,
        )
        .bind(legacy_json)
        .bind("test-source")
        .bind(history_id)
        .execute(pool)
        .await
        .expect("update legacy comparison json with source");

        history_id
    }

    #[tokio::test]
    async fn get_player_templates_returns_empty_when_table_is_empty() {
        let pool = setup_in_memory_pool().await;

        let templates = get_player_templates(&pool).await.expect("query templates");

        assert!(templates.is_empty());
    }

    #[tokio::test]
    async fn get_player_templates_reads_legacy_schema_without_profile_column() {
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
        .expect("create legacy player_templates");

        sqlx::query(
            r#"
            INSERT INTO player_templates (id, name, team, description, pose_data_json, angles_json)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(1_i64)
        .bind("Legacy Curry")
        .bind("Warriors")
        .bind("legacy row")
        .bind("{}")
        .bind("[]")
        .execute(&pool)
        .await
        .expect("insert legacy row");

        let templates = get_player_templates(&pool)
            .await
            .expect("load templates from legacy schema");

        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "Legacy Curry");
        assert!(templates[0].template_profile.is_none());
    }

    #[tokio::test]
    async fn seed_default_player_templates_if_empty_inserts_builtin_templates() {
        let pool = setup_in_memory_pool().await;

        seed_default_player_templates_if_empty(&pool)
            .await
            .expect("seed default templates");

        let templates = get_player_templates(&pool)
            .await
            .expect("query templates after seeding");

        assert!(!templates.is_empty());
        assert!(templates.iter().any(|template| !template.name.is_empty()));
    }

    #[tokio::test]
    async fn seed_default_player_templates_if_empty_preserves_existing_templates() {
        let pool = setup_in_memory_pool().await;

        let custom_template = PlayerTemplate {
            id: 0,
            name: "Custom".to_string(),
            team: "Team".to_string(),
            description: "desc".to_string(),
            pose_data: PoseData::default(),
            angles: Vec::new(),
            template_profile: None,
        };

        save_player_template(&pool, &custom_template)
            .await
            .expect("save custom template");

        seed_default_player_templates_if_empty(&pool)
            .await
            .expect("seed default templates");

        let templates = get_player_templates(&pool)
            .await
            .expect("query templates after seeding existing rows");

        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "Custom");
    }

    #[tokio::test]
    async fn seed_default_player_templates_if_empty_respects_existing_legacy_rows() {
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
        .expect("create legacy player_templates");

        sqlx::query(
            r#"
            INSERT INTO player_templates (id, name, team, description, pose_data_json, angles_json)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(1_i64)
        .bind("Existing Legacy")
        .bind("Legacy Team")
        .bind("legacy row")
        .bind("{}")
        .bind("[]")
        .execute(&pool)
        .await
        .expect("insert existing legacy row");

        seed_default_player_templates_if_empty(&pool)
            .await
            .expect("seed should skip existing legacy rows");

        let count = count_player_templates(&pool)
            .await
            .expect("count templates after seed");

        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn update_player_template_updates_only_template_metadata() {
        let pool = setup_in_memory_pool().await;

        let template = PlayerTemplate {
            id: 0,
            name: "Stephen Curry".to_string(),
            team: "Warriors".to_string(),
            description: "original".to_string(),
            pose_data: PoseData::default(),
            angles: vec![JointAngle {
                name: "right_elbow_angle".to_string(),
                value: 91.0,
                normal_range: (0.0, 180.0),
                status: "normal".to_string(),
                confidence: 1.0,
            }],
            template_profile: None,
        };

        let template_id = save_player_template(&pool, &template)
            .await
            .expect("save template");

        update_player_template(
            &pool,
            &PlayerTemplate {
                id: template_id,
                name: "Stephen Curry Finals".to_string(),
                team: "USA Basketball".to_string(),
                description: "updated".to_string(),
                ..template.clone()
            },
        )
        .await
        .expect("update template metadata");

        let templates = get_player_templates(&pool)
            .await
            .expect("query templates after update");
        let updated = templates
            .into_iter()
            .find(|entry| entry.id == template_id)
            .expect("updated template");

        assert_eq!(updated.name, "Stephen Curry Finals");
        assert_eq!(updated.team, "USA Basketball");
        assert_eq!(updated.description, "updated");
        assert_eq!(updated.angles.len(), 1);
        assert_eq!(updated.angles[0].name, "right_elbow_angle");
    }

    #[tokio::test]
    async fn update_player_template_metadata_preserves_pose_and_angles() {
        let pool = setup_in_memory_pool().await;
        let custom_template = PlayerTemplate {
            id: 0,
            name: "Original".to_string(),
            team: "Original Team".to_string(),
            description: "original description".to_string(),
            pose_data: PoseData::default(),
            angles: vec![JointAngle {
                name: "right_elbow_angle".to_string(),
                value: 91.0,
                normal_range: (0.0, 180.0),
                status: "normal".to_string(),
                confidence: 0.95,
            }],
            template_profile: None,
        };
        let template_id = save_player_template(&pool, &custom_template)
            .await
            .expect("save custom template");

        update_player_template_metadata(
            &pool,
            template_id,
            "Edited Curry",
            "Golden State",
            "release phase reference",
        )
        .await
        .expect("update template metadata");

        let templates = get_player_templates(&pool)
            .await
            .expect("query templates after metadata update");

        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "Edited Curry");
        assert_eq!(templates[0].team, "Golden State");
        assert_eq!(templates[0].description, "release phase reference");
        assert_eq!(templates[0].pose_data.keypoints.len(), 0);
        assert_eq!(templates[0].angles.len(), 1);
        assert_eq!(templates[0].angles[0].name, "right_elbow_angle");
        assert_eq!(templates[0].angles[0].value, 91.0);
    }

    #[tokio::test]
    async fn delete_player_template_removes_only_selected_template() {
        let pool = setup_in_memory_pool().await;
        let first_id = save_player_template(
            &pool,
            &PlayerTemplate {
                id: 0,
                name: "Delete Me".to_string(),
                team: "Team A".to_string(),
                description: "delete".to_string(),
                pose_data: PoseData::default(),
                angles: Vec::new(),
                template_profile: None,
            },
        )
        .await
        .expect("save first template");
        let second_id = save_player_template(
            &pool,
            &PlayerTemplate {
                id: 0,
                name: "Keep Me".to_string(),
                team: "Team B".to_string(),
                description: "keep".to_string(),
                pose_data: PoseData::default(),
                angles: Vec::new(),
                template_profile: None,
            },
        )
        .await
        .expect("save second template");

        delete_player_template(&pool, first_id)
            .await
            .expect("delete selected template");

        let templates = get_player_templates(&pool)
            .await
            .expect("query templates after delete");

        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].id, second_id);
        assert_eq!(templates[0].name, "Keep Me");
    }

    #[tokio::test]
    async fn saves_and_restores_player_template_profile() {
        let pool = setup_in_memory_pool().await;
        let mut phase_profiles = BTreeMap::new();
        phase_profiles.insert(
            "release".to_string(),
            PhaseAngleProfile {
                phase: "release".to_string(),
                sample_count: 2,
                coverage: 1.0,
                angles: vec![CanonicalAngleProfile {
                    name: "shooting_elbow_angle".to_string(),
                    value: 88.5,
                    confidence: 0.94,
                }],
            },
        );
        let template = PlayerTemplate {
            id: 0,
            name: "Video Curry".to_string(),
            team: "Golden State".to_string(),
            description: "whole-shot profile".to_string(),
            pose_data: PoseData::default(),
            angles: Vec::new(),
            template_profile: Some(PlayerTemplateProfile {
                version: 1,
                source_kind: "video".to_string(),
                overall_shot_type: "one_motion".to_string(),
                representative_frame_index: Some(3),
                representative_timestamp_ms: Some(120),
                samples_used: 5,
                coverage: 0.8,
                phase_profiles,
            }),
        };

        save_player_template(&pool, &template)
            .await
            .expect("save profiled template");

        let templates = get_player_templates(&pool)
            .await
            .expect("query profiled templates");
        let restored = templates
            .into_iter()
            .find(|entry| entry.name == "Video Curry")
            .expect("restored template");
        let profile = restored
            .template_profile
            .expect("profile should survive database round trip");
        let release = profile
            .phase_profiles
            .get("release")
            .expect("release phase");

        assert_eq!(profile.source_kind, "video");
        assert_eq!(profile.samples_used, 5);
        assert_eq!(release.sample_count, 2);
        assert_eq!(release.angles[0].name, "shooting_elbow_angle");
        assert_eq!(release.angles[0].value, 88.5);
    }

    #[tokio::test]
    async fn updates_analysis_history_comparison_json() {
        let pool = setup_in_memory_pool().await;
        let history_id = insert_history_row(&pool).await;

        update_analysis_history_comparison(&pool, history_id, Some(&sample_snapshot()))
            .await
            .expect("update comparison json");

        let rows = get_analysis_history(&pool).await.expect("fetch history");

        assert_eq!(rows.len(), 1);
        assert!(rows[0].comparison.is_some());
        assert_eq!(
            rows[0]
                .comparison
                .as_ref()
                .unwrap()
                .selected_detail
                .as_ref()
                .unwrap()
                .result
                .player
                .name,
            "Template"
        );
    }

    #[tokio::test]
    async fn saves_and_restores_full_compare_snapshot_json() {
        let pool = setup_in_memory_pool().await;
        let history_id = insert_history_row(&pool).await;

        update_analysis_history_comparison(&pool, history_id, Some(&sample_snapshot()))
            .await
            .expect("update comparison snapshot json");

        let rows = get_analysis_history(&pool).await.expect("fetch history");
        let snapshot = rows[0].comparison.as_ref().expect("comparison snapshot");

        assert_eq!(snapshot.analysis_key, "analysis-key-1");
        assert_eq!(snapshot.selected_player_id, Some(1));
        assert_eq!(snapshot.summaries.len(), 1);
        assert_eq!(snapshot.details_by_player_id.len(), 1);
        assert_eq!(
            snapshot
                .selected_detail
                .as_ref()
                .unwrap()
                .learning_bridge
                .gaps[0]
                .title,
            "right_elbow_angle gap"
        );
    }

    #[tokio::test]
    async fn wraps_legacy_comparison_result_rows_into_snapshot_shape() {
        let pool = setup_in_memory_pool().await;
        let history_id = insert_history_row_with_legacy_comparison(&pool).await;

        let rows = get_analysis_history(&pool).await.expect("fetch history");
        let snapshot = rows
            .into_iter()
            .find(|row| row.id == history_id)
            .expect("history row")
            .comparison
            .expect("comparison snapshot");
        let selected_detail = snapshot
            .selected_detail
            .as_ref()
            .expect("selected detail fallback");

        assert_eq!(
            snapshot.selected_player_id,
            Some(selected_detail.result.player.id)
        );
        assert_eq!(
            snapshot.analysis_key,
            format!("legacy-history-{}-player-1", history_id)
        );
        assert_eq!(selected_detail.result.player.name, "Template");
        assert!(!snapshot.summaries.is_empty());
        assert!(!snapshot.summaries[0].match_reason.is_empty());
        assert!(!selected_detail.learning_bridge.intro.is_empty());
        assert!(!selected_detail.learning_bridge.gaps.is_empty());
    }

    #[tokio::test]
    async fn wraps_legacy_rows_with_history_specific_keys_even_for_same_player() {
        let pool = setup_in_memory_pool().await;
        let first_history_id = insert_history_row_with_legacy_comparison(&pool).await;
        let second_history_id = insert_history_row_with_legacy_comparison(&pool).await;

        let rows = get_analysis_history(&pool).await.expect("fetch history");
        let first_snapshot = rows
            .iter()
            .find(|row| row.id == first_history_id)
            .and_then(|row| row.comparison.as_ref())
            .expect("first legacy snapshot");
        let second_snapshot = rows
            .iter()
            .find(|row| row.id == second_history_id)
            .and_then(|row| row.comparison.as_ref())
            .expect("second legacy snapshot");

        assert_ne!(first_snapshot.analysis_key, second_snapshot.analysis_key);
        assert_eq!(
            first_snapshot.analysis_key,
            format!("legacy-history-{}-player-1", first_history_id)
        );
        assert_eq!(
            second_snapshot.analysis_key,
            format!("legacy-history-{}-player-1", second_history_id)
        );
    }

    #[tokio::test]
    async fn save_analysis_history_rebinds_stale_legacy_snapshot_to_inserted_row_id() {
        let pool = setup_in_memory_pool().await;
        let history_id = save_analysis_history(
            &pool,
            "image.png",
            "annotated.png",
            &sample_analysis(),
            Some(&sample_stale_legacy_snapshot(3)),
            &[],
            None,
            None,
            Some("test-source"),
            None,
        )
        .await
        .expect("save history with stale legacy snapshot");

        let rows = get_analysis_history(&pool).await.expect("fetch history");
        let snapshot = rows[0].comparison.as_ref().expect("comparison snapshot");

        assert_eq!(
            snapshot.analysis_key,
            format!("legacy-history-{}-player-1", history_id)
        );
    }

    #[tokio::test]
    async fn update_analysis_history_comparison_rebinds_stale_legacy_snapshot_to_target_row_id() {
        let pool = setup_in_memory_pool().await;
        let history_id = insert_history_row(&pool).await;

        update_analysis_history_comparison(
            &pool,
            history_id,
            Some(&sample_stale_legacy_snapshot(4)),
        )
        .await
        .expect("update stale legacy snapshot");

        let rows = get_analysis_history(&pool).await.expect("fetch history");
        let snapshot = rows[0].comparison.as_ref().expect("comparison snapshot");

        assert_eq!(
            snapshot.analysis_key,
            format!("legacy-history-{}-player-1", history_id)
        );
    }
}
