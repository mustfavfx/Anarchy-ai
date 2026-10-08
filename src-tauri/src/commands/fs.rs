use std::path::Path;
use tauri::Manager;

pub fn get_existing_parent_canonical(mut path: &Path) -> Result<std::path::PathBuf, String> {
    while !path.exists() {
        if let Some(parent) = path.parent() {
            path = parent;
        } else {
            return Err("Path has no existing parent directory".to_string());
        }
    }
    path.canonicalize().map_err(|e| format!("Failed to canonicalize parent: {}", e))
}

pub fn is_path_safe(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);

    // Check if path is absolute
    if !path.is_absolute() {
        return Err("Relative paths are not allowed. Paths must be absolute.".to_string());
    }

    // Get the nearest existing parent or the path itself if it exists
    let canonical_base = get_existing_parent_canonical(path)?;

    // Prevent writing to Windows system folders to protect operating system files
    #[cfg(target_os = "windows")]
    {
        let win_dir = std::env::var("windir")
            .or_else(|_| std::env::var("SystemRoot"))
            .unwrap_or_else(|_| "C:\\Windows".to_string());
        if let Ok(win_path) = Path::new(&win_dir).canonicalize() {
            if canonical_base.starts_with(&win_path) {
                return Err("Access denied. System folder access is not allowed.".to_string());
            }
        }
    }

    #[cfg(unix)]
    {
        let system_prefixes = [
            "/etc", "/bin", "/sbin", "/var", "/usr", "/System", "/private", "/boot", "/sys", "/proc", "/dev"
        ];
        for prefix in &system_prefixes {
            let pref_path = Path::new(prefix);
            if let Ok(pref_canon) = pref_path.canonicalize() {
                if canonical_base.starts_with(&pref_canon) {
                    return Err(format!("Access denied. System folder access to {} is not allowed.", prefix));
                }
            } else if canonical_base.starts_with(pref_path) {
                return Err(format!("Access denied. System folder access to {} is not allowed.", prefix));
            }
        }
    }

    Ok(())
}

/// Write a string to a file (for saving workflows)
#[tauri::command]
pub async fn save_file(path: String, contents: String) -> Result<(), String> {
    is_path_safe(&path)?;
    std::fs::write(&path, &contents).map_err(|e| format!("Failed to save file: {}", e))
}

/// Read a file's contents as string (for loading workflows)
#[tauri::command]
pub async fn load_file(path: String) -> Result<String, String> {
    is_path_safe(&path)?;
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to load file: {}", e))
}

/// List files in a directory (returns Vec of full paths)
#[tauri::command]
pub async fn list_dir(path: String, extension: Option<String>) -> Result<Vec<String>, String> {
    is_path_safe(&path)?;
    let entries = std::fs::read_dir(&path).map_err(|e| format!("Failed to read dir: {}", e))?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_file() {
            if let Some(ref ext) = extension {
                if p.extension().and_then(|e| e.to_str()) == Some(ext.as_str()) {
                    files.push(p.to_string_lossy().to_string());
                }
            } else {
                files.push(p.to_string_lossy().to_string());
            }
        }
    }
    Ok(files)
}

/// Delete a file
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    is_path_safe(&path)?;
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))
}

/// Ensure a directory exists (create if not)
#[tauri::command]
pub async fn ensure_dir(path: String) -> Result<(), String> {
    is_path_safe(&path)?;
    std::fs::create_dir_all(&path).map_err(|e| format!("Failed to create dir: {}", e))
}

/// Get the app data directory path
#[tauri::command]
pub fn get_app_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}
