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
            tauri::async_runtime::spawn(async move {
                if let Err(e) = database::init_database(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_shot,
            commands::analyze_video,
            commands::get_player_templates,
            commands::compare_with_player,
            commands::get_correction_suggestions,
            commands::get_ai_shot_review,
            commands::get_ai_correction_suggestions,
            commands::build_ai_analysis_payload,
            commands::save_analysis_history,
            commands::update_analysis_history_ai_coaching,
            commands::get_analysis_history,
            commands::delete_analysis_history,
            commands::process_image,
            commands::draw_pose_on_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



