pub mod ai;
pub mod analysis;
pub mod commands;
pub mod database;
pub mod image;
pub mod models;
pub mod pose;

use std::sync::atomic::{AtomicI64, Ordering};
use std::time::UNIX_EPOCH;

use tauri::Manager;

const TRAY_WINDOW_LABEL: &str = "tray-menu";
const TRAY_WINDOW_WIDTH: f64 = 376.0;
const TRAY_WINDOW_HEIGHT: f64 = 492.0;
const TRAY_DEBOUNCE_MS: i64 = 400;

static TRAY_LAST_CLICK_MS: AtomicI64 = AtomicI64::new(0);

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_tray_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(TRAY_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

fn position_tray_window(window: &tauri::WebviewWindow, rect: &tauri::Rect) -> tauri::Result<()> {
    let (tray_x, tray_y) = match rect.position {
        tauri::Position::Physical(position) => (position.x as f64, position.y as f64),
        tauri::Position::Logical(position) => (position.x, position.y),
    };
    let (tray_width, tray_height) = match rect.size {
        tauri::Size::Physical(size) => (size.width as f64, size.height as f64),
        tauri::Size::Logical(size) => (size.width, size.height),
    };
    let x = (tray_x + tray_width - TRAY_WINDOW_WIDTH - 8.0).max(8.0);
    let above_y = tray_y - TRAY_WINDOW_HEIGHT - 10.0;
    let y = if above_y > 8.0 {
        above_y
    } else {
        tray_y + tray_height + 10.0
    };

    window.set_position(tauri::PhysicalPosition::new(
        x.round() as i32,
        y.round() as i32,
    ))
}

fn show_tray_window(app: &tauri::AppHandle, rect: &tauri::Rect) {
    let now_ms = UNIX_EPOCH
        .elapsed()
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let prev = TRAY_LAST_CLICK_MS.swap(now_ms, Ordering::SeqCst);
    if now_ms - prev < TRAY_DEBOUNCE_MS {
        return;
    }

    if let Some(window) = app.get_webview_window(TRAY_WINDOW_LABEL) {
        let _ = position_tray_window(&window, rect);
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn tray_show_main(app: tauri::AppHandle) {
    hide_tray_window(&app);
    show_main_window(&app);
}

#[tauri::command]
fn tray_hide_panel(app: tauri::AppHandle) {
    hide_tray_window(&app);
}

#[tauri::command]
fn tray_open_route(app: tauri::AppHandle, path: String) {
    hide_tray_window(&app);
    show_main_window(&app);
    if let Some(window) = app.get_webview_window("main") {
        let js = format!(
            "window.history.pushState({{v: Date.now()}}, '', '{}'); window.dispatchEvent(new PopStateEvent('popstate'))",
            path
        );
        let _ = window.eval(&js);
    }
}

#[tauri::command]
fn tray_quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            let tray_window = tauri::WebviewWindowBuilder::new(
                app,
                TRAY_WINDOW_LABEL,
                tauri::WebviewUrl::App("index.html?surface=tray".into()),
            )
            .title("ShotForm")
            .inner_size(TRAY_WINDOW_WIDTH, TRAY_WINDOW_HEIGHT)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .effects(
                tauri::window::EffectsBuilder::new()
                    .effect(tauri::window::Effect::Acrylic)
                    .color(tauri::utils::config::Color(246, 242, 235, 184))
                    .build(),
            )
            .build()?;

            let tray_window_clone = tray_window.clone();
            tray_window.on_window_event(move |event| match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = tray_window_clone.hide();
                }
                _ => {}
            });

            let mut tray_builder = tauri::tray::TrayIconBuilder::new()
                .tooltip("ShotForm 篮球投篮姿势分析")
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    match event {
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        } => {
                            hide_tray_window(app);
                            show_main_window(app);
                        }
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Right,
                            rect,
                            ..
                        } => {
                            show_tray_window(app, &rect);
                        }
                        _ => {}
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder.build(app)?;

            tauri::async_runtime::block_on(async { database::init_database(&app_handle).await })
                .map_err(|error| -> Box<dyn std::error::Error> {
                    eprintln!("Failed to initialize database: {}", error);
                    Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        error.to_string(),
                    ))
                })?;

            #[cfg(desktop)]
            {
                let window = app_handle.get_webview_window("main").ok_or_else(|| {
                    Box::new(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "main window not found",
                    )) as Box<dyn std::error::Error>
                })?;
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

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
            tray_show_main,
            tray_hide_panel,
            tray_open_route,
            tray_quit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
