use std::sync::Mutex;

#[derive(Clone, serde::Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[tauri::command]
pub async fn check_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            version: update.version.clone(),
            body: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    app.restart();
    #[allow(unreachable_code)]
    Ok(())
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Access denied. Only http:// and https:// URLs are allowed.".to_string());
    }
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

#[tauri::command]
pub async fn open_checkout_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Access denied. Only http:// and https:// URLs are allowed.".to_string());
    }
    let parsed_url = url.parse::<tauri::Url>().map_err(|e| format!("Invalid URL: {}", e))?;
    
    // Create checkout window
    let _window = tauri::webview::WebviewWindowBuilder::new(
        &app,
        "stripe-checkout",
        tauri::WebviewUrl::External(parsed_url),
    )
    .title("Secure Checkout - Anarchy AI")
    .inner_size(1000.0, 750.0)
    .center()
    .resizable(true)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn save_secure_key(service: String, key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(&service, "default_user")
        .map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_secure_key(service: String) -> Result<String, String> {
    let entry = keyring::Entry::new(&service, "default_user")
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pass) => Ok(pass),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err::<String, String>(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_secure_key(service: String) -> Result<(), String> {
    let entry = keyring::Entry::new(&service, "default_user")
        .map_err(|e| e.to_string())?;
    match entry.delete_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err::<(), String>(e.to_string()),
    }
}

pub struct StartupState {
    pub file_path: Mutex<Option<String>>,
    pub deep_link: Mutex<Option<String>>,
}

/// Automatically fixes the .ana file icon association in the Windows registry.
/// This runs on every startup so that users who installed older versions also
/// get the correct icon without needing to reinstall.
#[cfg(target_os = "windows")]
pub fn fix_ana_file_association() {
    use std::os::windows::process::CommandExt;

    // Determine the path where the executable currently lives
    let exe_path = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };
    let install_dir = match exe_path.parent() {
        Some(p) => p.to_path_buf(),
        None => return,
    };

    // Expected icon path relative to the executable (handling both production and dev paths)
    let mut icon_path = install_dir.join("resources").join("icons").join("ana-file.ico");
    if !icon_path.exists() {
        icon_path = install_dir.join("icons").join("ana-file.ico");
    }
    let icon_str = icon_path.to_str().map(|s| s.to_string());
    let icon_exists = icon_path.exists() && icon_str.is_some();

    let exe_str = match exe_path.to_str() {
        Some(s) => s.to_string(),
        None => return,
    };

    // Helper: open or create a registry key under HKCU\Software\Classes
    fn set_reg_value(subkey: &str, value: &str) {
        let _ = std::process::Command::new("reg")
            .args(["add", subkey, "/ve", "/d", value, "/f"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }

    // 1. Ensure .ana maps to our ProgID
    set_reg_value("HKCU\\Software\\Classes\\.ana", "AnarchyAI.ana");

    // 2. Set the human-readable type name
    set_reg_value("HKCU\\Software\\Classes\\AnarchyAI.ana", "Anarchy AI Project File");

    // 3. Set the correct icon path if it exists
    if icon_exists {
        if let Some(ref icon) = icon_str {
            set_reg_value("HKCU\\Software\\Classes\\AnarchyAI.ana\\DefaultIcon", icon);
        }
    }

    // 4. Set the open command
    let open_cmd = format!("\"{}\" \"%1\"", exe_str);
    set_reg_value("HKCU\\Software\\Classes\\AnarchyAI.ana\\shell\\open\\command", &open_cmd);

    // 5. Windows 10/11 SystemFileAssociations (modern icon engine)
    set_reg_value("HKCU\\Software\\Classes\\SystemFileAssociations\\.ana", "Anarchy AI Project File");
    if icon_exists {
        if let Some(ref icon) = icon_str {
            set_reg_value("HKCU\\Software\\Classes\\SystemFileAssociations\\.ana\\DefaultIcon", icon);
        }
    }
    set_reg_value("HKCU\\Software\\Classes\\SystemFileAssociations\\.ana\\shell\\open\\command", &open_cmd);

    // 6. Notify the Windows Shell to refresh icon cache immediately
    // SHChangeNotify(SHCNE_ASSOCCHANGED=0x08000000, SHCNF_IDLIST=0, 0, 0)
    #[link(name = "shell32")]
    extern "system" {
        fn SHChangeNotify(we: i32, ui: u32, item1: *mut std::ffi::c_void, item2: *mut std::ffi::c_void);
    }
    unsafe {
        SHChangeNotify(0x08000000i32, 0u32, std::ptr::null_mut(), std::ptr::null_mut());
    }

    // 7. Register anarchy-ai:// URI Scheme Protocol Handler
    set_reg_value("HKCU\\Software\\Classes\\anarchy-ai", "URL:anarchy-ai Protocol");
    let _ = std::process::Command::new("reg")
        .args(["add", "HKCU\\Software\\Classes\\anarchy-ai", "/v", "URL Protocol", "/d", "", "/f"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();
    set_reg_value("HKCU\\Software\\Classes\\anarchy-ai\\shell\\open\\command", &open_cmd);
}

#[cfg(not(target_os = "windows"))]
pub fn fix_ana_file_association() {
    // No-op on macOS / Linux — file associations handled by the OS bundle
}

#[tauri::command]
pub fn get_startup_file(state: tauri::State<'_, StartupState>) -> Option<String> {
    let mut lock = state.file_path.lock().unwrap();
    lock.take()
}

#[tauri::command]
pub fn get_deep_link(state: tauri::State<'_, StartupState>) -> Option<String> {
    let mut lock = state.deep_link.lock().unwrap();
    lock.take()
}

#[tauri::command]
pub fn get_tauri_panic() -> Option<String> {
    if let Some(cache_dir) = dirs::cache_dir() {
        let panic_path = cache_dir.join("anarchy-ai").join(".panic");
        if panic_path.exists() {
            if let Ok(contents) = std::fs::read_to_string(&panic_path) {
                let _ = std::fs::remove_file(&panic_path); // Clear it
                return Some(contents);
            }
        }
    }
    None
}
