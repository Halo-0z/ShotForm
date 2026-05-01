pub mod ai;
pub mod analysis;
pub mod commands;
pub mod database;
pub mod image;
pub mod models;
pub mod pose;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(
                async move { database::init_database(&app_handle).await },
            )
            .map_err(|error| -> Box<dyn std::error::Error> {
                eprintln!("Failed to initialize database: {}", error);
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    error.to_string(),
                ))
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_shot,
            commands::analyze_video,
            commands::get_player_templates,
            commands::get_player_templates_db,
            commands::add_player_template,
            commands::update_player_template,
            commands::update_player_template_metadata,
            commands::delete_player_template,
            commands::compare_with_player,
            commands::compare_against_all_players,
            commands::build_compare_workbench,
            commands::get_correction_suggestions,
            commands::get_ai_shot_review,
            commands::get_ai_correction_suggestions,
            commands::build_ai_analysis_payload,
            commands::save_analysis_history,
            commands::update_analysis_history_ai_coaching,
            commands::update_analysis_history_comparison,
            commands::get_analysis_history,
            commands::get_analysis_history_page,
            commands::delete_analysis_history,
            commands::process_image,
            commands::draw_pose_on_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
