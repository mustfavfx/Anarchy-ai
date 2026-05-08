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

/// Write a string to a file (for saving workflows)
#[tauri::command]
async fn save_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, &contents).map_err(|e| format!("Failed to save file: {}", e))
}

/// Read a file's contents as string (for loading workflows)
#[tauri::command]
async fn load_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to load file: {}", e))
}

/// List files in a directory (returns Vec of full paths)
#[tauri::command]
async fn list_dir(path: String, extension: Option<String>) -> Result<Vec<String>, String> {
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
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))
}

/// Ensure a directory exists (create if not)
#[tauri::command]
async fn ensure_dir(path: String) -> Result<(), String> {
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
    let installs = detect_3dsmax_installs();

    if installs.is_empty() {
        return Err("No 3ds Max user profile was found. Open 3ds Max once, then install again.".to_string());
    }

    let selected_versions = versions.unwrap_or_else(|| installs.iter().map(|install| install.version.clone()).collect());
    let mut installed_paths = Vec::new();

    for install in installs {
        if !selected_versions.iter().any(|version| version == &install.version) {
            continue;
        }

        let profile = std::path::PathBuf::from(&install.path);
        let startup_dir = profile.join("ENU").join("scripts").join("startup");
        let usermacros_dir = profile.join("ENU").join("usermacros");
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

        let usericons_dir = profile.join("ENU").join("usericons");
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
        return Err("No selected compatible 3ds Max versions were found.".to_string());
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
    let installs = detect_revit_installs();
    if installs.is_empty() {
        return Err("No Revit installation was found under Program Files\\Autodesk.".to_string());
    }

    let selected = versions.unwrap_or_else(|| installs.iter().map(|i| i.version.clone()).collect());

    let csc = find_csc_exe()
        .ok_or_else(|| "csc.exe (.NET Framework 4.x compiler) not found. Revit 2022-2024 require it.".to_string())?;

    const CS_SOURCE: &str = include_str!("../resources/revit-plugin/AnarchyRevit.cs");
    const ADDIN_TEMPLATE: &str = include_str!("../resources/revit-plugin/Anarchy.addin.template");
    const ICON_32: &[u8] = include_bytes!("../resources/revit-plugin/AnarchyLogo_32.png");
    const ICON_16: &[u8] = include_bytes!("../resources/revit-plugin/AnarchyLogo_16.png");

    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA env var not found".to_string())?;

    let mut installed = Vec::new();

    for install in installs {
        if !selected.contains(&install.version) {
            continue;
        }

        let revit_dir = std::path::PathBuf::from(&install.path);
        let api_dll = revit_dir.join("RevitAPI.dll");
        let api_ui_dll = revit_dir.join("RevitAPIUI.dll");
        if !api_dll.exists() || !api_ui_dll.exists() {
            continue;
        }

        let addins_dir = std::path::PathBuf::from(&app_data)
            .join("Autodesk").join("Revit").join("Addins").join(&install.version);
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
                install.version, stdout, stderr
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
        return Err("No selected compatible Revit versions were installed.".to_string());
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

        let output = std::process::Command::new(&dotnet)
            .args(["publish", "-c", "Release", "-r", "win-x64",
                   "--self-contained", "false", "-o"])
            .arg(&contents_dir)
            .arg("--nologo")
            .current_dir(&build_dir)
            .output()
            .map_err(|e| format!("Failed to invoke dotnet publish: {}", e))?;

        let _ = std::fs::remove_dir_all(&build_dir);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!("AutoCAD 2025 build failed:\n{}\n{}", stdout, stderr));
        }
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

                if buffer.len() > 1024 * 1024 * 30 {
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
                        let _ = app.emit("anarchy://external-image", ExternalImagePayload {
                            image: payload.image,
                            source: "3ds Max".to_string(),
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

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(start_anarchy_viewport_server(app_handle));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            http_post, http_get, upload_image, url_to_base64,
            save_file, load_file, list_dir, delete_file, ensure_dir,
            detect_autodesk_installs, install_3dsmax_plugin, install_revit_plugin, install_autocad_plugin,
            remove_old_autodesk_plugins, get_app_data_dir,
            save_image_to_documents,
            check_update, install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
