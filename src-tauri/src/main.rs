// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod server;

use std::sync::Mutex;
use tauri::{Emitter, Manager};
use commands::*;
use server::start_anarchy_viewport_server;

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let message = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown rust panic".to_string()
        };
        let location = info.location().map(|l| (l.file().to_string(), l.line()));
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let panic_info = serde_json::json!({
            "message": message,
            "file": location.as_ref().map(|l| &l.0),
            "line": location.as_ref().map(|l| l.1),
            "timestamp": timestamp
        });

        if let Some(cache_dir) = dirs::cache_dir() {
            let panic_dir = cache_dir.join("anarchy-ai");
            let _ = std::fs::create_dir_all(&panic_dir);
            let _ = std::fs::write(
                panic_dir.join(".panic"),
                serde_json::to_string(&panic_info).unwrap_or_default(),
            );
        }
    }));

    let mut startup_file = None;
    let mut deep_link = None;
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let path = &args[1];
        if path.ends_with(".ana") {
            startup_file = Some(path.clone());
        } else if path.starts_with("anarchy-ai://") {
            deep_link = Some(path.clone());
        }
    }

    tauri::Builder::default()
        .manage(StartupState {
            file_path: Mutex::new(startup_file),
            deep_link: Mutex::new(deep_link),
        })
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let found_link = args.iter().find(|arg| arg.starts_with("anarchy-ai://"));
            if let Some(link) = found_link {
                let _ = app.emit("deep-link", link);
            }
            let found_file = args.iter().find(|arg| arg.ends_with(".ana"));
            if let Some(file_path) = found_file {
                let _ = app.emit("open-file", file_path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Auto-fix .ana file icon registry for all Windows users on every launch
            fix_ana_file_association();
            // Auto-synchronize latest Autodesk 3ds Max connectors and PymxsTools
            auto_sync_autodesk_connectors();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(start_anarchy_viewport_server(app_handle));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            http_post, http_get, upload_image, upload_to_replicate, url_to_base64,
            save_file, load_file, list_dir, delete_file, ensure_dir,
            detect_autodesk_installs, detect_sketchup_installs, install_3dsmax_plugin, install_revit_plugin, install_autocad_plugin, install_sketchup_plugin,
            remove_old_autodesk_plugins, get_app_data_dir, is_plugin_installed, validate_custom_autodesk_path,
            save_image_to_documents, save_image_to_path, read_local_image, read_clipboard_image,
            check_update, install_update, restart_app,
            open_url, open_checkout_window, get_startup_file, get_deep_link, exit_app, analyze_floor_plan, open_images_folder, show_in_explorer,
            save_secure_key, load_secure_key, delete_secure_key, get_tauri_panic,
            cua_get_screen_metrics, cua_get_active_windows, cua_focus_window, cua_capture_screen,
            cua_mouse_click, cua_mouse_move, cua_mouse_scroll, cua_mouse_drag, cua_send_keys,
            cua_dispatch_autodesk_command, cua_launch_app,
            cua_is_connector_online, cua_wait_for_connector
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
