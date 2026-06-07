// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use reqwest::multipart;
use base64::Engine as _;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Clone, serde::Serialize)]
struct ExternalImagePayload {
    image: String,
    source: String,
}

#[derive(serde::Deserialize)]
struct UploadViewPayload {
    image: String,
    #[serde(default)]
    source: String,
}

#[derive(Clone, serde::Serialize)]
struct AutodeskInstall {
    version: String,
    path: String,
}

#[tauri::command]
async fn http_post(
    url: String,
    headers: HashMap<String, String>,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut req = client.post(&url).json(&body);
    for (k, v) in &headers {
        req = req.header(k.as_str(), v.as_str());
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(serde_json::to_string(&json).unwrap_or_else(|_| status.to_string()));
    }
    Ok(json)
}

#[tauri::command]
async fn http_get(
    url: String,
    headers: HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    for (k, v) in &headers {
        req = req.header(k.as_str(), v.as_str());
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(serde_json::to_string(&json).unwrap_or_else(|_| status.to_string()));
    }
    Ok(json)
}

#[tauri::command]
async fn analyze_floor_plan(image_base64: String) -> Result<String, String> {
    let b64 = if image_base64.contains(',') {
        image_base64.splitn(2, ',').nth(1).ok_or("Invalid base64 image data")?
    } else {
        &image_base64
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let part = multipart::Part::bytes(bytes)
        .file_name("plan.png")
        .mime_str("image/png")
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new().part("image", part);

    let client = reqwest::Client::new();
    let resp = client
        .post("http://127.0.0.1:8000/analyze-plan")
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Could not reach Image2CAD backend server. Make sure it is running on port 8000. Error details: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("Server returned error ({}): {}", status, text));
    }

    Ok(text)
}

/// Download an image from URL and return as base64 data URI
#[tauri::command]
async fn url_to_base64(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AnarchyAI/1.0")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e: reqwest::Error| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e: reqwest::Error| format!("Failed to download image: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("Download failed with status: {}", status));
    }

    // Get content type from headers (clone to owned String before consuming resp)
    let content_type: String = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = resp
        .bytes()
        .await
        .map_err(|e: reqwest::Error| format!("Failed to read image bytes: {}", e))?;

    // Convert to base64
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    // Determine mime type
    let mime = if content_type.contains("png") {
        "image/png"
    } else if content_type.contains("webp") {
        "image/webp"
    } else if content_type.contains("gif") {
        "image/gif"
    } else {
        "image/jpeg"
    };

    let data_uri = format!("data:{};base64,{}", mime, b64);
    Ok(data_uri)
}

/// Upload image to Replicate Files API and return serving URL
/// Accepts base64 string (not bytes) to avoid huge IPC serialization overhead
#[tauri::command]
async fn upload_to_replicate(
    api_key: String,
    b64_data: String,
    filename: String,
    content_type: String,
) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};

    let image_bytes = general_purpose::STANDARD
        .decode(&b64_data)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    let client = reqwest::Client::builder()
        .user_agent("AnarchyAI/1.0")
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let part = multipart::Part::bytes(image_bytes)
        .file_name(filename)
        .mime_str(&content_type)
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new().part("content", part);

    let resp = client
        .post("https://api.replicate.com/v1/files")
        .header("Authorization", format!("Token {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Replicate upload failed: {}", e))?;

    let status = resp.status();
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("Replicate upload error {}: {}", status, body));
    }

    // Return the serving URL
    let url = body["urls"]["get"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    if url.is_empty() {
        return Err(format!("No URL in Replicate response: {}", body));
    }

    Ok(url)
}

/// Upload a base64-encoded image to imgbb and return the direct URL
#[tauri::command]
async fn upload_image(
    _api_key: String,  // kept for API compatibility
    data_uri: String,
) -> Result<String, String> {
    // Parse data URI: "data:image/png;base64,<data>"
    let comma_pos = data_uri.find(',').ok_or("Invalid data URI")?;
    let meta = &data_uri[..comma_pos];
    let b64  = &data_uri[comma_pos + 1..];

    let mime = if meta.contains("png") { "image/png" }
               else if meta.contains("webp") { "image/webp" }
               else { "image/jpeg" };

    let bytes: Vec<u8> = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e: base64::DecodeError| e.to_string())?;

    let ext = if mime == "image/png" { "png" }
              else if mime == "image/webp" { "webp" }
              else { "jpg" };

    // Build reusable client with proper UA
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AnarchyAI/1.0")
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e: reqwest::Error| e.to_string())?;

    let bytes_clone = bytes.clone();

    // Try 0x0.st first (simplest, most reliable, no API key, returns plain URL)
    let part_0x0 = multipart::Part::bytes(bytes_clone)
        .file_name(format!("image.{}", ext))
        .mime_str(mime)
        .map_err(|e: reqwest::Error| e.to_string())?;

    let form_0x0 = multipart::Form::new().part("file", part_0x0);

    let resp_0x0 = client
        .post("https://0x0.st")
        .multipart(form_0x0)
        .send()
        .await;

    if let Ok(resp) = resp_0x0 {
        let status = resp.status();
        if let Ok(body_text) = resp.text().await {
            let url = body_text.trim().to_string();
            if status.is_success() && url.starts_with("https://") {
                return Ok(url);
            }
        }
    }

    // Fallback: catbox.moe
    let part_cb = multipart::Part::bytes(bytes)
        .file_name(format!("image.{}", ext))
        .mime_str(mime)
        .map_err(|e: reqwest::Error| e.to_string())?;

    let form_cb = multipart::Form::new()
        .text("reqtype", "fileupload")
        .part("fileToUpload", part_cb);

    let resp = client
        .post("https://catbox.moe/user/api.php")
        .multipart(form_cb)
        .send()
        .await
        .map_err(|e: reqwest::Error| format!("Upload failed: {}", e))?;

    let status = resp.status();
    let body_text = resp.text().await.map_err(|e: reqwest::Error| e.to_string())?;

    if !status.is_success() {
        return Err(format!("Upload error {}: {}", status, body_text));
    }

    let url = body_text.trim().to_string();
    if !url.starts_with("https://") {
        return Err(format!("Invalid upload response: {}", body_text));
    }

    Ok(url)
}

fn get_existing_parent_canonical(mut path: &std::path::Path) -> Result<std::path::PathBuf, String> {
    while !path.exists() {
        if let Some(parent) = path.parent() {
            path = parent;
        } else {
            return Err("Path has no existing parent directory".to_string());
        }
    }
    path.canonicalize().map_err(|e| format!("Failed to canonicalize parent: {}", e))
}

fn is_path_safe(path_str: &str) -> Result<(), String> {
    use std::path::Path;
    
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
                return Err("Access denied. Writing to system folders is not allowed.".to_string());
            }
        }
    }

    Ok(())
}

/// Write a string to a file (for saving workflows)
#[tauri::command]
async fn save_file(path: String, contents: String) -> Result<(), String> {
    is_path_safe(&path)?;
    std::fs::write(&path, &contents).map_err(|e| format!("Failed to save file: {}", e))
}

/// Read a file's contents as string (for loading workflows)
#[tauri::command]
async fn load_file(path: String) -> Result<String, String> {
    is_path_safe(&path)?;
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to load file: {}", e))
}

/// List files in a directory (returns Vec of full paths)
#[tauri::command]
async fn list_dir(path: String, extension: Option<String>) -> Result<Vec<String>, String> {
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
async fn delete_file(path: String) -> Result<(), String> {
    is_path_safe(&path)?;
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))
}

/// Ensure a directory exists (create if not)
#[tauri::command]
async fn ensure_dir(path: String) -> Result<(), String> {
    is_path_safe(&path)?;
    std::fs::create_dir_all(&path).map_err(|e| format!("Failed to create dir: {}", e))
}

#[tauri::command]
fn detect_3dsmax_installs() -> Vec<AutodeskInstall> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_default();
    let max_root = std::path::Path::new(&local_app_data).join("Autodesk").join("3dsMax");

    if !max_root.exists() {
        return Vec::new();
    }

    let mut installs = Vec::new();
    let Ok(entries) = std::fs::read_dir(&max_root) else {
        return installs;
    };

    for entry in entries.flatten() {
        let profile = entry.path();
        if !profile.is_dir() {
            continue;
        }

        let Some(name) = profile.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        if !name.chars().any(|c| c.is_ascii_digit()) {
            continue;
        }

        let version = name
            .split_whitespace()
            .next()
            .unwrap_or(name)
            .to_string();

        if matches!(version.as_str(), "2022" | "2023" | "2024" | "2025" | "2026" | "2027") {
            installs.push(AutodeskInstall {
                version,
                path: profile.to_string_lossy().to_string(),
            });
        }
    }

    installs.sort_by(|a, b| a.version.cmp(&b.version));
    installs.dedup_by(|a, b| a.version == b.version);
    installs
}

fn detect_revit_installs() -> Vec<AutodeskInstall> {
    let mut installs = Vec::new();
    let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let autodesk_root = std::path::Path::new(&program_files).join("Autodesk");

    if let Ok(entries) = std::fs::read_dir(&autodesk_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !name.starts_with("Revit ") {
                continue;
            }
            let version = name.trim_start_matches("Revit ").to_string();
            if matches!(version.as_str(), "2022" | "2023" | "2024" | "2025" | "2026" | "2027") {
                let api_dll = path.join("RevitAPI.dll");
                if api_dll.exists() {
                    installs.push(AutodeskInstall {
                        version,
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    installs.sort_by(|a, b| a.version.cmp(&b.version));
    installs.dedup_by(|a, b| a.version == b.version);
    installs
}

fn detect_autocad_installs() -> Vec<AutodeskInstall> {
    let mut installs = Vec::new();
    let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let autodesk_root = std::path::Path::new(&program_files).join("Autodesk");

    if let Ok(entries) = std::fs::read_dir(&autodesk_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            // Check for AutoCAD folder with various patterns
            let is_autocad = name.starts_with("AutoCAD ") || name == "AutoCAD";
            if !is_autocad {
                continue;
            }
            
            // Extract version from folder name
            let version = if name == "AutoCAD" {
                // If folder is just "AutoCAD", try to find version from subfolder
                if let Ok(sub_entries) = std::fs::read_dir(&path) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_name = sub_entry.file_name().to_string_lossy().to_string();
                        if sub_name.starts_with("AutoCAD ") {
                            let v = sub_name.trim_start_matches("AutoCAD ").to_string();
                            if matches!(v.as_str(), "2022" | "2023" | "2024" | "2025" | "2026" | "2027") {
                                let sub_path = sub_entry.path();
                                if check_autocad_dlls(&sub_path) {
                                    installs.push(AutodeskInstall {
                                        version: v,
                                        path: sub_path.to_string_lossy().to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
                continue;
            } else {
                name.trim_start_matches("AutoCAD ").to_string()
            };

            if matches!(version.as_str(), "2022" | "2023" | "2024" | "2025" | "2026" | "2027") {
                if check_autocad_dlls(&path) {
                    installs.push(AutodeskInstall {
                        version,
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    installs.sort_by(|a, b| a.version.cmp(&b.version));
    installs.dedup_by(|a, b| a.version == b.version);
    installs
}

fn check_autocad_dlls(path: &std::path::Path) -> bool {
    // Check for acmgd.dll in the main folder or common subfolders
    let dlls = ["acmgd.dll", "accoremgd.dll", "acdbmgd.dll"];
    
    // Check direct path first
    let all_direct = dlls.iter().all(|dll| path.join(dll).exists());
    if all_direct {
        return true;
    }
    
    // Check common subfolders
    let subfolders = ["", "Program Files\\Autodesk\\AutoCAD", "acmgd"];
    for sub in subfolders {
        let sub_path = path.join(sub);
        if sub_path.exists() && dlls.iter().all(|dll| sub_path.join(dll).exists()) {
            return true;
        }
    }
    
    false
}

fn find_autocad_dll(base_path: &std::path::Path, dll_name: &str) -> Option<std::path::PathBuf> {
    // Check direct path first
    let direct = base_path.join(dll_name);
    if direct.exists() {
        return Some(direct);
    }
    
    // Check common subfolders
    let subfolders = ["", "Program Files\\Autodesk\\AutoCAD", "acmgd"];
    for sub in subfolders {
        let sub_path = base_path.join(sub).join(dll_name);
        if sub_path.exists() {
            return Some(sub_path);
        }
    }
    
    None
}

#[tauri::command]
async fn detect_autodesk_installs(target: String) -> Result<Vec<AutodeskInstall>, String> {
    match target.as_str() {
        "3dsmax" => Ok(detect_3dsmax_installs()),
        "revit" => Ok(detect_revit_installs()),
        "autocad" => Ok(detect_autocad_installs()),
        _ => Err("Unsupported Autodesk target".to_string()),
    }
}

#[tauri::command]
async fn install_3dsmax_plugin(script: String, versions: Option<Vec<String>>) -> Result<Vec<String>, String> {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let max_root = std::path::Path::new(&local_app_data).join("Autodesk").join("3dsMax");

    // Collect all candidate installs: auto-detected + manually requested versions
    let detected = detect_3dsmax_installs();
    let selected_versions = versions.unwrap_or_else(|| detected.iter().map(|i| i.version.clone()).collect());

    if selected_versions.is_empty() {
        return Err("No 3ds Max versions selected for installation.".to_string());
    }

    // Build a map of version -> path from detected installs
    let detected_map: std::collections::HashMap<String, String> =
        detected.into_iter().map(|i| (i.version, i.path)).collect();

    let mut installed_paths = Vec::new();

    for version in &selected_versions {
        // Prefer detected path, otherwise try common profile folder patterns
        let profile_path = if let Some(p) = detected_map.get(version) {
            std::path::PathBuf::from(p)
        } else {
            // Try standard profile folder name patterns
            let candidates = [
                format!("{} - 64bit", version),
                format!("{}", version),
                format!("{} - 64-bit", version),
            ];
            let mut found = None;
            for candidate in &candidates {
                let p = max_root.join(candidate);
                if p.exists() {
                    found = Some(p);
                    break;
                }
            }
            match found {
                Some(p) => p,
                None => {
                    // Create profile directory so user can run 3ds Max and it will be used
                    let default_name = format!("{} - 64bit", version);
                    let p = max_root.join(&default_name);
                    if std::fs::create_dir_all(&p).is_ok() { p } else { continue; }
                }
            }
        };

        let startup_dir = profile_path.join("ENU").join("scripts").join("startup");
        let usermacros_dir = profile_path.join("ENU").join("usermacros");
        std::fs::create_dir_all(&startup_dir)
            .map_err(|e| format!("Failed to create startup folder: {}", e))?;
        std::fs::create_dir_all(&usermacros_dir)
            .map_err(|e| format!("Failed to create usermacros folder: {}", e))?;

        let script_path = startup_dir.join("AnarchyConnector.ms");
        std::fs::write(&script_path, &script)
            .map_err(|e| format!("Failed to write plugin script: {}", e))?;
        installed_paths.push(script_path.to_string_lossy().to_string());

        let macro_path = usermacros_dir.join("Anarchy-AnarchySync.mcr");
        std::fs::write(&macro_path, &script)
            .map_err(|e| format!("Failed to write plugin macro: {}", e))?;
        installed_paths.push(macro_path.to_string_lossy().to_string());

        let usericons_dir = profile_path.join("ENU").join("usericons");
        let _ = std::fs::create_dir_all(&usericons_dir);
        const ICON_24I: &[u8] = include_bytes!("../resources/maxicons/AnarchyLogo_24i.bmp");
        const ICON_24A: &[u8] = include_bytes!("../resources/maxicons/AnarchyLogo_24a.bmp");
        const ICON_16I: &[u8] = include_bytes!("../resources/maxicons/AnarchyLogo_16i.bmp");
        const ICON_16A: &[u8] = include_bytes!("../resources/maxicons/AnarchyLogo_16a.bmp");
        for (name, bytes) in [
            ("AnarchyLogo_24i.bmp", ICON_24I),
            ("AnarchyLogo_24a.bmp", ICON_24A),
            ("AnarchyLogo_16i.bmp", ICON_16I),
            ("AnarchyLogo_16a.bmp", ICON_16A),
        ] {
            let icon_path = usericons_dir.join(name);
            if std::fs::write(&icon_path, bytes).is_ok() {
                installed_paths.push(icon_path.to_string_lossy().to_string());
            }
        }
    }

    if installed_paths.is_empty() {
        return Err("No 3ds Max profiles could be written. Ensure the selected versions are installed and run at least once.".to_string());
    }

    Ok(installed_paths)
}

fn find_csc_exe() -> Option<std::path::PathBuf> {
    let win_dir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
    let candidates = [
        "Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe",
        "Microsoft.NET\\Framework\\v4.0.30319\\csc.exe",
    ];
    for c in candidates {
        let p = std::path::Path::new(&win_dir).join(c);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

fn find_wpf_assembly(name: &str) -> Option<std::path::PathBuf> {
    let win_dir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
    let program_files_x86 = std::env::var("ProgramFiles(x86)")
        .unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());

    // Check WPF folder in Framework64 first (most common for 64-bit)
    for fw in ["Framework64", "Framework"] {
        let wpf = std::path::Path::new(&win_dir)
            .join("Microsoft.NET").join(fw).join("v4.0.30319").join("WPF").join(name);
        if wpf.exists() {
            return Some(wpf);
        }
    }

    // Check Reference Assemblies - only check most recent versions first
    for ver in ["v4.8", "v4.7.2", "v4.8.1"] {
        let ref_asm = std::path::Path::new(&program_files_x86)
            .join("Reference Assemblies").join("Microsoft").join("Framework").join(".NETFramework").join(ver).join(name);
        if ref_asm.exists() {
            return Some(ref_asm);
        }
    }

    None
}

#[tauri::command]
async fn install_revit_plugin(versions: Option<Vec<String>>) -> Result<Vec<String>, String> {
    let detected = detect_revit_installs();
    let selected = versions.unwrap_or_else(|| detected.iter().map(|i| i.version.clone()).collect());

    if selected.is_empty() {
        return Err("No Revit versions selected for installation.".to_string());
    }

    // Build map of version -> program path from detected installs
    let detected_map: std::collections::HashMap<String, std::path::PathBuf> =
        detected.into_iter().map(|i| (i.version, std::path::PathBuf::from(i.path))).collect();

    let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let autodesk_root = std::path::Path::new(&program_files).join("Autodesk");

    let csc = find_csc_exe()
        .ok_or_else(|| "csc.exe (.NET Framework 4.x compiler) not found. Please install .NET Framework 4.x.".to_string())?;

    // Embedded C# source code for Revit plugin
    const CS_SOURCE: &str = include_str!("../resources/revit-plugin/AnarchyRevit.cs");
    const ADDIN_TEMPLATE: &str = include_str!("../resources/revit-plugin/Anarchy.addin.template");
    const ICON_32: &[u8] = include_bytes!("../resources/revit-plugin/AnarchyLogo_32.png");
    const ICON_16: &[u8] = include_bytes!("../resources/revit-plugin/AnarchyLogo_16.png");

    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA env var not found".to_string())?;

    let mut installed = Vec::new();

    for version in &selected {
        // Find the Revit installation directory
        let revit_dir = if let Some(p) = detected_map.get(version) {
            p.clone()
        } else {
            // Try standard installation path
            let p = autodesk_root.join(format!("Revit {}", version));
            if !p.exists() {
                // Log skip but don't fail — user may have non-standard install
                continue;
            }
            p
        };

        let api_dll = revit_dir.join("RevitAPI.dll");
        let api_ui_dll = revit_dir.join("RevitAPIUI.dll");
        if !api_dll.exists() || !api_ui_dll.exists() {
            // RevitAPI.dll not found in this path — skip
            continue;
        }

        let addins_dir = std::path::PathBuf::from(&app_data)
            .join("Autodesk").join("Revit").join("Addins").join(version);
        std::fs::create_dir_all(&addins_dir)
            .map_err(|e| format!("Failed to create addins folder: {}", e))?;

        let plugin_dir = addins_dir.join("AnarchyRevit");
        std::fs::create_dir_all(&plugin_dir)
            .map_err(|e| format!("Failed to create plugin folder: {}", e))?;

        let cs_path = plugin_dir.join("AnarchyRevit.cs");
        std::fs::write(&cs_path, CS_SOURCE)
            .map_err(|e| format!("Failed to write C# source: {}", e))?;

        let icon32_path = plugin_dir.join("AnarchyLogo_32.png");
        let icon16_path = plugin_dir.join("AnarchyLogo_16.png");
        let _ = std::fs::write(&icon32_path, ICON_32);
        let _ = std::fs::write(&icon16_path, ICON_16);

        let dll_path = plugin_dir.join("AnarchyRevit.dll");
        if dll_path.exists() {
            let _ = std::fs::remove_file(&dll_path);
        }

        let presentation_core = find_wpf_assembly("PresentationCore.dll")
            .ok_or_else(|| "PresentationCore.dll not found on system".to_string())?;
        let windows_base = find_wpf_assembly("WindowsBase.dll")
            .ok_or_else(|| "WindowsBase.dll not found on system".to_string())?;
        let system_xaml = find_wpf_assembly("System.Xaml.dll")
            .ok_or_else(|| "System.Xaml.dll not found on system".to_string())?;

        let output = std::process::Command::new(&csc)
            .arg("/target:library")
            .arg("/nologo")
            .arg("/platform:x64")
            .arg(format!("/out:{}", dll_path.display()))
            .arg(format!("/reference:{}", api_dll.display()))
            .arg(format!("/reference:{}", api_ui_dll.display()))
            .arg(format!("/reference:{}", presentation_core.display()))
            .arg(format!("/reference:{}", windows_base.display()))
            .arg(format!("/reference:{}", system_xaml.display()))
            .arg("/reference:System.dll")
            .arg("/reference:System.Core.dll")
            .arg("/reference:System.Drawing.dll")
            .arg(&cs_path)
            .output()
            .map_err(|e| format!("Failed to invoke csc.exe: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!(
                "Compilation failed for Revit {}:\n{}\n{}",
                version, stdout, stderr
            ));
        }

        let addin_content = ADDIN_TEMPLATE.replace(
            "{{ASSEMBLY_PATH}}",
            &dll_path.to_string_lossy().replace('\\', "\\"),
        );
        let addin_path = addins_dir.join("Anarchy.addin");
        std::fs::write(&addin_path, addin_content)
            .map_err(|e| format!("Failed to write .addin manifest: {}", e))?;

        installed.push(dll_path.to_string_lossy().to_string());
        installed.push(addin_path.to_string_lossy().to_string());
    }

    if installed.is_empty() {
        return Err(format!(
            "No selected Revit versions could be found under {}\\Autodesk\\Revit <version>. Ensure Revit is installed and try again.",
            program_files
        ));
    }

    Ok(installed)
}

fn autocad_version_to_series(version: &str) -> Option<&'static str> {
    match version {
        "2022" => Some("R24.1"),
        "2023" => Some("R24.2"),
        "2024" => Some("R24.3"),
        "2025" => Some("R25.0"),
        "2026" => Some("R25.1"),
        "2027" => Some("R25.2"),
        _ => None,
    }
}

fn is_autocad_net8(version: &str) -> bool {
    matches!(version, "2025" | "2026" | "2027")
}

fn find_dotnet_sdk() -> Option<std::path::PathBuf> {
    // Check common dotnet locations
    let candidates = [
        r"C:\Program Files\dotnet\dotnet.exe",
        r"C:\Program Files (x86)\dotnet\dotnet.exe",
    ];
    for c in &candidates {
        let p = std::path::Path::new(c);
        if p.exists() {
            // Verify it has an SDK (not just runtime) by checking sdk folder
            let sdk_dir = p.parent().unwrap().join("sdk");
            if sdk_dir.exists() {
                return Some(p.to_path_buf());
            }
        }
    }
    // Try PATH
    if let Ok(out) = std::process::Command::new("dotnet").arg("--list-sdks").output() {
        if out.status.success() && !out.stdout.is_empty() {
            return Some(std::path::PathBuf::from("dotnet"));
        }
    }
    None
}

#[tauri::command]
async fn install_autocad_plugin(versions: Option<Vec<String>>) -> Result<Vec<String>, String> {
    let installs = detect_autocad_installs();
    if installs.is_empty() {
        return Err("No AutoCAD installation was found under Program Files\\Autodesk.".to_string());
    }

    let selected = versions.unwrap_or_else(|| installs.iter().map(|i| i.version.clone()).collect());

    let compat_installs: Vec<&AutodeskInstall> = installs.iter()
        .filter(|i| selected.contains(&i.version))
        .filter(|i| matches!(i.version.as_str(), "2022" | "2023" | "2024" | "2025" | "2026" | "2027"))
        .collect();

    if compat_installs.is_empty() {
        return Err("No compatible AutoCAD version found in selection.".to_string());
    }

    const PKG_TEMPLATE: &str = include_str!("../resources/autocad-plugin/PackageContents.xml.template");
    const ICON_32: &[u8] = include_bytes!("../resources/autocad-plugin/AnarchyLogo_32.png");
    const ICON_16: &[u8] = include_bytes!("../resources/autocad-plugin/AnarchyLogo_16.png");

    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA env var not found".to_string())?;

    let bundle_dir = std::path::PathBuf::from(&app_data)
        .join("Autodesk").join("ApplicationPlugins").join("AnarchyAutoCAD.bundle");
    let contents_dir = bundle_dir.join("Contents");
    std::fs::create_dir_all(&contents_dir)
        .map_err(|e| format!("Failed to create bundle folder: {}", e))?;

    let first = compat_installs[0];
    let acad_dir = std::path::PathBuf::from(&first.path);
    let use_net8 = is_autocad_net8(&first.version);

    let accoremgd = find_autocad_dll(&acad_dir, "accoremgd.dll")
        .ok_or_else(|| format!("accoremgd.dll not found in {}", acad_dir.display()))?;
    let acmgd = find_autocad_dll(&acad_dir, "acmgd.dll")
        .ok_or_else(|| format!("acmgd.dll not found in {}", acad_dir.display()))?;
    let acdbmgd = find_autocad_dll(&acad_dir, "acdbmgd.dll")
        .ok_or_else(|| format!("acdbmgd.dll not found in {}", acad_dir.display()))?;
    let adwindows = find_autocad_dll(&acad_dir, "AdWindows.dll")
        .ok_or_else(|| format!("AdWindows.dll not found in {}", acad_dir.display()))?;

    let _ = std::fs::write(contents_dir.join("AnarchyLogo_32.png"), ICON_32);
    let _ = std::fs::write(contents_dir.join("AnarchyLogo_16.png"), ICON_16);

    let dll_path = contents_dir.join("AnarchyAutoCad.dll");
    if dll_path.exists() {
        let _ = std::fs::remove_file(&dll_path);
    }

    if use_net8 {
        // AutoCAD 2025+: needs .NET 8 SDK - use dotnet publish
        const CS_SOURCE_2025: &str = include_str!("../resources/autocad-plugin/AnarchyAutoCad2025.cs");
        const CSPROJ_TEMPLATE: &str = include_str!("../resources/autocad-plugin/AnarchyAutoCad2025.csproj.template");

        let dotnet = find_dotnet_sdk().ok_or_else(|| {
            ".NET 8 SDK not found. AutoCAD 2025 requires the .NET 8 SDK to build the plugin.\nDownload from: https://dotnet.microsoft.com/download/dotnet/8.0".to_string()
        })?;

        let build_dir = std::env::temp_dir().join("AnarchyAutoCad2025Build");
        let _ = std::fs::remove_dir_all(&build_dir);
        std::fs::create_dir_all(&build_dir)
            .map_err(|e| format!("Failed to create build dir: {}", e))?;

        std::fs::write(build_dir.join("AnarchyAutoCad.cs"), CS_SOURCE_2025)
            .map_err(|e| format!("Failed to write C# source: {}", e))?;

        let csproj = CSPROJ_TEMPLATE
            .replace("{{ACAD_DIR}}", &acad_dir.to_string_lossy());
        std::fs::write(build_dir.join("AnarchyAutoCad.csproj"), csproj)
            .map_err(|e| format!("Failed to write csproj: {}", e))?;

        // Build to a separate temp output dir to avoid locking issues with running AutoCAD
        let build_out_dir = std::env::temp_dir().join("AnarchyAutoCad2025Out");
        let _ = std::fs::remove_dir_all(&build_out_dir);
        std::fs::create_dir_all(&build_out_dir)
            .map_err(|e| format!("Failed to create build output dir: {}", e))?;

        let output = std::process::Command::new(&dotnet)
            .args(["publish", "--nologo", "-c", "Release", "-r", "win-x64",
                   "--self-contained", "false", "-o"])
            .arg(&build_out_dir)
            .current_dir(&build_dir)
            .output()
            .map_err(|e| format!("Failed to invoke dotnet publish: {}", e))?;

        let _ = std::fs::remove_dir_all(&build_dir);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let _ = std::fs::remove_dir_all(&build_out_dir);
            return Err(format!("AutoCAD 2025 build failed:\n{}\n{}", stdout, stderr));
        }

        // Copy built DLL to bundle contents dir - will fail if AutoCAD is running
        std::fs::create_dir_all(&contents_dir)
            .map_err(|e| format!("Failed to create contents dir: {}", e))?;

        for entry in std::fs::read_dir(&build_out_dir)
            .map_err(|e| format!("Failed to read build output: {}", e))?
        {
            let entry = entry.map_err(|e| e.to_string())?;
            let dest = contents_dir.join(entry.file_name());
            if let Err(e) = std::fs::copy(entry.path(), &dest) {
                let _ = std::fs::remove_dir_all(&build_out_dir);
                if e.to_string().contains("being used by another process") {
                    return Err("AutoCAD is currently running.\n\nPlease close AutoCAD completely, then click Reinstall again.".to_string());
                }
                return Err(format!("Failed to copy plugin file: {}", e));
            }
        }
        let _ = std::fs::remove_dir_all(&build_out_dir);
    } else {
        // AutoCAD 2022-2024: compile with csc.exe (.NET Framework 4.x)
        const CS_SOURCE: &str = include_str!("../resources/autocad-plugin/AnarchyAutoCad.cs");

        let csc = find_csc_exe()
            .ok_or_else(|| "csc.exe (.NET Framework 4.x compiler) not found.".to_string())?;

        let presentation_core = find_wpf_assembly("PresentationCore.dll")
            .ok_or_else(|| "PresentationCore.dll not found".to_string())?;
        let presentation_framework = find_wpf_assembly("PresentationFramework.dll")
            .ok_or_else(|| "PresentationFramework.dll not found".to_string())?;
        let windows_base = find_wpf_assembly("WindowsBase.dll")
            .ok_or_else(|| "WindowsBase.dll not found".to_string())?;
        let cs_path = contents_dir.join("AnarchyAutoCad.cs");
        std::fs::write(&cs_path, CS_SOURCE)
            .map_err(|e| format!("Failed to write C# source: {}", e))?;

        let output = std::process::Command::new(&csc)
            .arg("/target:library")
            .arg("/nologo")
            .arg("/platform:x64")
            .arg(format!("/out:{}", dll_path.display()))
            .arg(format!("/reference:{}", accoremgd.display()))
            .arg(format!("/reference:{}", acmgd.display()))
            .arg(format!("/reference:{}", acdbmgd.display()))
            .arg(format!("/reference:{}", adwindows.display()))
            .arg(format!("/reference:{}", presentation_core.display()))
            .arg(format!("/reference:{}", presentation_framework.display()))
            .arg(format!("/reference:{}", windows_base.display()))
            .arg("/reference:System.dll")
            .arg("/reference:System.Core.dll")
            .arg("/reference:System.Drawing.dll")
            .arg("/reference:System.Net.dll")
            .arg("/reference:System.Xml.dll")
            .arg(&cs_path)
            .output()
            .map_err(|e| format!("Failed to invoke csc.exe: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!("AutoCAD compilation failed:\n{}\n{}", stdout, stderr));
        }
    }

    let series: Vec<&str> = compat_installs.iter()
        .filter_map(|i| autocad_version_to_series(&i.version))
        .collect();
    let series_min = series.iter().min().copied().unwrap_or("R24.1");
    let series_max = series.iter().max().copied().unwrap_or("R25.0");

    let pkg_content = PKG_TEMPLATE
        .replace("{{SERIES_MIN}}", series_min)
        .replace("{{SERIES_MAX}}", series_max);
    let pkg_path = bundle_dir.join("PackageContents.xml");
    std::fs::write(&pkg_path, pkg_content)
        .map_err(|e| format!("Failed to write PackageContents.xml: {}", e))?;

    Ok(vec![
        dll_path.to_string_lossy().to_string(),
        pkg_path.to_string_lossy().to_string(),
    ])
}

fn remove_matching_files(root: &std::path::Path, needles: &[&str], removed: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let lower = name.to_ascii_lowercase();
        let matches = needles.iter().any(|needle| lower.contains(needle));

        if path.is_dir() {
            if matches {
                if std::fs::remove_dir_all(&path).is_ok() {
                    removed.push(path.to_string_lossy().to_string());
                    continue;
                }
            }
            remove_matching_files(&path, needles, removed);
            continue;
        }

        if matches {
            if std::fs::remove_file(&path).is_ok() {
                removed.push(path.to_string_lossy().to_string());
            }
        }
    }
}

#[tauri::command]
async fn is_plugin_installed(target: String) -> bool {
    let app_data = std::env::var("APPDATA").unwrap_or_default();
    match target.as_str() {
        "3dsmax" => {
            let installs = detect_3dsmax_installs();
            if installs.is_empty() {
                return false;
            }
            for install in installs {
                let profile = std::path::PathBuf::from(&install.path);
                let script_path = profile.join("ENU").join("scripts").join("startup").join("AnarchyConnector.ms");
                if script_path.exists() {
                    return true;
                }
            }
            false
        }
        "revit" => {
            let installs = detect_revit_installs();
            if installs.is_empty() {
                return false;
            }
            for install in installs {
                let addins_dir = std::path::PathBuf::from(&app_data)
                    .join("Autodesk").join("Revit").join("Addins").join(&install.version);
                let addin_file = addins_dir.join("Anarchy.addin");
                if addin_file.exists() {
                    return true;
                }
            }
            false
        }
        "autocad" => {
            let bundle_dir = std::path::PathBuf::from(&app_data)
                .join("Autodesk").join("ApplicationPlugins").join("AnarchyAutoCAD.bundle");
            let pkg_path = bundle_dir.join("PackageContents.xml");
            let dll_path = bundle_dir.join("Contents").join("AnarchyAutoCad.dll");
            pkg_path.exists() && dll_path.exists()
        }
        _ => false,
    }
}

#[tauri::command]
async fn remove_old_autodesk_plugins(target: String) -> Result<Vec<String>, String> {
    let mut removed = Vec::new();
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let app_data = std::env::var("APPDATA").unwrap_or_default();
    let program_data = std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".to_string());

    match target.as_str() {
        "3dsmax" => {
            let roots = [
                std::path::PathBuf::from(&local_app_data).join("Autodesk").join("3dsMax"),
                std::path::PathBuf::from(&app_data).join("Autodesk").join("3ds Max"),
                std::path::PathBuf::from(&program_data).join("Autodesk").join("ApplicationPlugins"),
            ];
            let needles = [
                "anarchyconnector",
                "anarchyicons",
                "anarchylogo",
                "anarchy",
            ];

            for root in roots {
                if root.exists() {
                    remove_matching_files(&root, &needles, &mut removed);
                }
            }
        }
        "revit" => {
            let roots = [
                std::path::PathBuf::from(&app_data).join("Autodesk").join("Revit").join("Addins"),
                std::path::PathBuf::from(&program_data).join("Autodesk").join("Revit").join("Addins"),
                std::path::PathBuf::from(&program_data).join("Autodesk").join("ApplicationPlugins"),
            ];
            let needles = [
                "anarchy",
                "anarchyai",
                "anarchy-ai",
            ];

            for root in roots {
                if root.exists() {
                    remove_matching_files(&root, &needles, &mut removed);
                }
            }
        }
        "autocad" => {
            let roots = [
                std::path::PathBuf::from(&app_data).join("Autodesk").join("ApplicationPlugins"),
                std::path::PathBuf::from(&program_data).join("Autodesk").join("ApplicationPlugins"),
            ];
            let needles = [
                "anarchy",
                "anarchyautocad",
            ];

            for root in roots {
                if root.exists() {
                    remove_matching_files(&root, &needles, &mut removed);
                }
            }
        }
        _ => return Err("Unsupported Autodesk plugin target".to_string()),
    }

    Ok(removed)
}

/// Get the app data directory path
#[tauri::command]
fn get_app_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

async fn start_anarchy_viewport_server(app_handle: tauri::AppHandle) {
    let listener = match TcpListener::bind("127.0.0.1:14400").await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("Anarchy viewport server failed to bind: {}", error);
            return;
        }
    };

    loop {
        let Ok((mut socket, _)) = listener.accept().await else {
            continue;
        };

        let app = app_handle.clone();
        tokio::spawn(async move {
            let mut buffer = Vec::new();
            let mut chunk = [0_u8; 8192];
            let mut header_end = None;
            let mut content_length = 0_usize;

            loop {
                let Ok(bytes_read) = socket.read(&mut chunk).await else {
                    return;
                };
                if bytes_read == 0 {
                    break;
                }

                buffer.extend_from_slice(&chunk[..bytes_read]);

                if header_end.is_none() {
                    header_end = buffer.windows(4).position(|window| window == b"\r\n\r\n").map(|index| index + 4);
                    if let Some(end) = header_end {
                        let headers_text = String::from_utf8_lossy(&buffer[..end]);
                        content_length = headers_text
                            .lines()
                            .find_map(|line| {
                                let (name, value) = line.split_once(':')?;
                                if name.eq_ignore_ascii_case("content-length") {
                                    value.trim().parse::<usize>().ok()
                                } else {
                                    None
                                }
                            })
                            .unwrap_or(0);
                    }
                }

                if let Some(end) = header_end {
                    if buffer.len().saturating_sub(end) >= content_length {
                        break;
                    }
                }

                if buffer.len() > 1024 * 1024 * 80 {
                    break;
                }
            }

            let Some(end) = header_end else {
                return;
            };

            let headers = String::from_utf8_lossy(&buffer[..end]);
            let body = String::from_utf8_lossy(&buffer[end..]);

            let is_upload_view = headers.starts_with("POST /upload-view ");
            let status = if is_upload_view {
                match serde_json::from_str::<UploadViewPayload>(&body) {
                    Ok(payload) if payload.image.starts_with("data:image/") => {
                        let source = if payload.source.is_empty() { "3ds Max".to_string() } else { payload.source.clone() };
                        let _ = app.emit("anarchy://external-image", ExternalImagePayload {
                            image: payload.image,
                            source,
                        });
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":true}"
                    }
                    _ => "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":false}"
                }
            } else {
                "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":false}"
            };

            let _ = socket.write_all(status.as_bytes()).await;
        });
    }
}

#[tauri::command]
async fn save_image_to_documents(data_uri: String, file_name: String) -> Result<String, String> {
    // Strip data URI prefix: "data:image/png;base64,..."
    let b64 = data_uri
        .splitn(2, ',')
        .nth(1)
        .ok_or("Invalid data URI")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    // Resolve Documents/Anarchy AI folder
    let docs = dirs::document_dir()
        .ok_or("Cannot locate Documents folder")?;
    let save_dir = docs.join("Anarchy AI");
    std::fs::create_dir_all(&save_dir)
        .map_err(|e| format!("Cannot create save folder: {}", e))?;

    let out_path = save_dir.join(&file_name);
    std::fs::write(&out_path, &bytes)
        .map_err(|e| format!("Write error: {}", e))?;

    Ok(out_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_image_to_path(path: String, data_uri: String) -> Result<(), String> {
    let b64 = data_uri
        .splitn(2, ',')
        .nth(1)
        .ok_or("Invalid data URI")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Write error: {}", e))
}

#[derive(Clone, serde::Serialize)]
struct UpdateInfo {
    version: String,
    body: Option<String>,
    date: Option<String>,
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
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

/// Read an image from the Windows clipboard and return it as a base64 PNG data URI
#[tauri::command]
fn read_clipboard_image() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::c_void;

        extern "system" {
            fn OpenClipboard(hwnd: *mut c_void) -> i32;
            fn CloseClipboard() -> i32;
            fn GetClipboardData(format: u32) -> *mut c_void;
            fn GlobalLock(hmem: *mut c_void) -> *mut c_void;
            fn GlobalUnlock(hmem: *mut c_void) -> i32;
            fn GlobalSize(hmem: *mut c_void) -> usize;
            fn IsClipboardFormatAvailable(format: u32) -> i32;
        }

        const CF_BITMAP: u32 = 2;
        const CF_DIB: u32 = 8;
        const CF_DIBV5: u32 = 17;
        const CF_PNG: u32 = 49161; // Registered clipboard format for PNG

        unsafe {
            // Check if any supported image format is available
            let has_dibv5 = IsClipboardFormatAvailable(CF_DIBV5) != 0;
            let has_dib = IsClipboardFormatAvailable(CF_DIB) != 0;
            let has_bitmap = IsClipboardFormatAvailable(CF_BITMAP) != 0;
            let has_png = IsClipboardFormatAvailable(CF_PNG) != 0;

            if !has_dibv5 && !has_dib && !has_bitmap && !has_png {
                return Err("No image in clipboard".to_string());
            }

            if OpenClipboard(std::ptr::null_mut()) == 0 {
                return Err("Failed to open clipboard".to_string());
            }

            // Prefer PNG > DIBv5 > DIB (PNG is usually best quality from modern apps)
            let mut fmt: u32;
            if has_png {
                fmt = CF_PNG;
            } else if has_dibv5 {
                fmt = CF_DIBV5;
            } else if has_dib {
                fmt = CF_DIB;
            } else {
                fmt = CF_DIB; // fallback
            }

            // If PNG is available, try to use it directly
            if fmt == CF_PNG {
                let handle = GetClipboardData(CF_PNG);
                if !handle.is_null() {
                    let ptr = GlobalLock(handle);
                    if !ptr.is_null() {
                        let size = GlobalSize(handle);
                        let png_bytes: Vec<u8> = std::slice::from_raw_parts(ptr as *const u8, size).to_vec();
                        GlobalUnlock(handle);
                        CloseClipboard();
                        // Validate PNG and encode as base64
                        if png_bytes.len() > 8 && &png_bytes[0..8] == &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
                            let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
                            return Ok(format!("data:image/png;base64, {}", b64));
                        }
                        // PNG bytes invalid, fall through to try other formats
                        if !has_dibv5 && !has_dib && !has_bitmap {
                            return Err("PNG in clipboard but invalid data".to_string());
                        }
                        // Re-open clipboard to try other formats
                        if OpenClipboard(std::ptr::null_mut()) == 0 {
                            return Err("Failed to reopen clipboard".to_string());
                        }
                        fmt = if has_dibv5 { CF_DIBV5 } else { CF_DIB };
                    } else {
                        GlobalUnlock(handle);
                    }
                }
            }

            let handle = GetClipboardData(fmt);
            if handle.is_null() {
                CloseClipboard();
                return Err("Failed to get clipboard data".to_string());
            }

            let ptr = GlobalLock(handle);
            if ptr.is_null() {
                CloseClipboard();
                return Err("Failed to lock clipboard memory".to_string());
            }

            let size = GlobalSize(handle);
            let dib_bytes: Vec<u8> = std::slice::from_raw_parts(ptr as *const u8, size).to_vec();
            GlobalUnlock(handle);
            CloseClipboard();

            // DIB starts with BITMAPINFOHEADER - convert to PNG via BMP file format
            // BMP file = 14-byte file header + DIB data
            let file_size = (14 + dib_bytes.len()) as u32;
            // Read pixel data offset from DIB header (header size + color table)
            let header_size = u32::from_le_bytes([dib_bytes[0], dib_bytes[1], dib_bytes[2], dib_bytes[3]]);
            let bit_count = u16::from_le_bytes([dib_bytes[14], dib_bytes[15]]);
            let compression = u32::from_le_bytes([dib_bytes[16], dib_bytes[17], dib_bytes[18], dib_bytes[19]]);
            let clr_used = u32::from_le_bytes([dib_bytes[36], dib_bytes[37], dib_bytes[38], dib_bytes[39]]);

            let color_table_size = if bit_count <= 8 {
                let entries = if clr_used > 0 { clr_used } else { 1u32 << bit_count };
                entries * 4
            } else if compression == 3 || compression == 6 {
                // BI_BITFIELDS or BI_ALPHABITFIELDS
                if fmt == CF_DIBV5 { 0u32 } else { 12u32 }
            } else {
                0u32
            };

            let pixel_offset: u32 = 14 + header_size + color_table_size;

            let mut bmp: Vec<u8> = Vec::with_capacity(14 + dib_bytes.len());
            // BMP signature
            bmp.push(b'B'); bmp.push(b'M');
            bmp.extend_from_slice(&file_size.to_le_bytes());
            bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved1
            bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved2
            bmp.extend_from_slice(&pixel_offset.to_le_bytes());
            bmp.extend_from_slice(&dib_bytes);

            // Use image crate to decode BMP and re-encode as PNG
            match image::load_from_memory_with_format(&bmp, image::ImageFormat::Bmp) {
                Ok(img) => {
                    let mut png_bytes: Vec<u8> = Vec::new();
                    img.write_to(&mut std::io::Cursor::new(&mut png_bytes), image::ImageFormat::Png)
                        .map_err(|e| format!("Failed to encode PNG: {}", e))?;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
                    Ok(format!("data:image/png;base64,{}", b64))
                }
                Err(e) => Err(format!("Failed to decode clipboard BMP: {}", e)),
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Clipboard image reading not supported on this platform".to_string())
    }
}

/// Read a local image file from disk and return it as a base64 data URI
#[tauri::command]
async fn read_local_image(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;

    let lower = path.to_lowercase();
    let mime = if lower.ends_with(".png") { "image/png" }
               else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") { "image/jpeg" }
               else if lower.ends_with(".webp") { "image/webp" }
               else if lower.ends_with(".gif") { "image/gif" }
               else if lower.ends_with(".bmp") { "image/bmp" }
               else if lower.ends_with(".tiff") || lower.ends_with(".tif") { "image/tiff" }
               else { "image/jpeg" };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
async fn show_in_explorer(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", p.to_string_lossy()))
            .spawn()
            .map_err(|e| format!("Failed to spawn explorer: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(p.as_os_str())
            .spawn()
            .map_err(|e| format!("Failed to spawn open: {}", e))?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Some(parent) = p.parent() {
            open::that(parent).map_err(|e| format!("Failed to open directory: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn open_images_folder() -> Result<(), String> {
    let docs = dirs::document_dir()
        .ok_or("Cannot locate Documents folder")?;
    let save_dir = docs.join("Anarchy AI");
    std::fs::create_dir_all(&save_dir)
        .map_err(|e| format!("Cannot create folder: {}", e))?;
    open::that(&save_dir).map_err(|e| format!("Failed to open folder: {}", e))
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    app.restart();
    #[allow(unreachable_code)]
    Ok(())
}

use std::sync::Mutex;

struct StartupState {
    file_path: Mutex<Option<String>>,
    deep_link: Mutex<Option<String>>,
}

#[tauri::command]
fn get_startup_file(state: tauri::State<'_, StartupState>) -> Option<String> {
    let mut lock = state.file_path.lock().unwrap();
    lock.take()
}

#[tauri::command]
fn get_deep_link(state: tauri::State<'_, StartupState>) -> Option<String> {
    let mut lock = state.deep_link.lock().unwrap();
    lock.take()
}

fn main() {
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
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(start_anarchy_viewport_server(app_handle));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            http_post, http_get, upload_image, upload_to_replicate, url_to_base64,
            save_file, load_file, list_dir, delete_file, ensure_dir,
            detect_autodesk_installs, install_3dsmax_plugin, install_revit_plugin, install_autocad_plugin,
            remove_old_autodesk_plugins, get_app_data_dir, is_plugin_installed,
            save_image_to_documents, save_image_to_path, read_local_image, read_clipboard_image,
            check_update, install_update, restart_app,
            open_url, get_startup_file, get_deep_link, analyze_floor_plan, open_images_folder, show_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
