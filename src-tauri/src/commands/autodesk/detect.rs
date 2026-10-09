use super::types::AutodeskInstall;
use crate::commands::fs::is_path_safe;

pub fn get_autodesk_search_roots() -> Vec<std::path::PathBuf> {
    let mut roots = Vec::new();
    let drives = ["C", "D", "E", "F", "G"];
    for d in drives {
        let pf = format!("{}:\\Program Files\\Autodesk", d);
        let p = std::path::PathBuf::from(&pf);
        if p.exists() {
            roots.push(p);
        }
        let direct = format!("{}:\\Autodesk", d);
        let p2 = std::path::PathBuf::from(&direct);
        if p2.exists() {
            roots.push(p2);
        }
    }
    roots
}

pub fn is_process_running(proc_name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new("tasklist");
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.args(["/FI", &format!("IMAGENAME eq {}", proc_name), "/NH"]);
        if let Ok(output) = cmd.output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let target = proc_name.to_lowercase();
            return stdout.lines().any(|line| {
                let l = line.to_lowercase();
                l.starts_with(&target) || l.contains(&format!(" {}", target))
            });
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = proc_name;
    }
    false
}

#[tauri::command]
pub fn detect_3dsmax_installs() -> Vec<AutodeskInstall> {
    let mut installs = Vec::new();
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let max_root = std::path::Path::new(&local_app_data).join("Autodesk").join("3dsMax");

    let autodesk_roots = get_autodesk_search_roots();

    // 1. Check all installed 3ds Max directories across drives
    for root in &autodesk_roots {
        if let Ok(entries) = std::fs::read_dir(root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue; };
                if name.starts_with("3ds Max ") || name == "3ds Max" || name.starts_with("3dsMax") {
                    if path.join("3dsmax.exe").exists() {
                        let version = name
                            .chars()
                            .filter(|c| c.is_ascii_digit())
                            .collect::<String>();
                        if matches!(version.as_str(), "2020" | "2021" | "2022" | "2023" | "2024" | "2025" | "2026" | "2027" | "2028") {
                            installs.push(AutodeskInstall {
                                version,
                                path: path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. Check local app data profiles (e.g. 2024 - 64bit, 2027 - 64bit)
    if max_root.exists() {
        if let Ok(entries) = std::fs::read_dir(&max_root) {
            for entry in entries.flatten() {
                let profile = entry.path();
                if !profile.is_dir() { continue; }
                let Some(name) = profile.file_name().and_then(|n| n.to_str()) else { continue; };
                let version = name
                    .split_whitespace()
                    .next()
                    .unwrap_or(name)
                    .chars()
                    .filter(|c| c.is_ascii_digit())
                    .collect::<String>();
                if matches!(version.as_str(), "2020" | "2021" | "2022" | "2023" | "2024" | "2025" | "2026" | "2027" | "2028") {
                    if !installs.iter().any(|i| i.version == version) {
                        installs.push(AutodeskInstall {
                            version,
                            path: profile.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }
    }

    installs.sort_by(|a, b| a.version.cmp(&b.version));
    installs.dedup_by(|a, b| a.version == b.version);
    installs
}

pub fn detect_revit_installs() -> Vec<AutodeskInstall> {
    let mut installs = Vec::new();
    let autodesk_roots = get_autodesk_search_roots();

    // 1. Scan Autodesk root folders across drives for Revit installations
    for root in &autodesk_roots {
        if let Ok(entries) = std::fs::read_dir(root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue; };
                if name.starts_with("Revit ") || name == "Revit" {
                    let version = name
                        .chars()
                        .filter(|c| c.is_ascii_digit())
                        .collect::<String>();
                    if matches!(version.as_str(), "2020" | "2021" | "2022" | "2023" | "2024" | "2025" | "2026" | "2027" | "2028") {
                        if path.join("RevitAPI.dll").exists() || path.join("Revit.exe").exists() {
                            installs.push(AutodeskInstall {
                                version,
                                path: path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. Scan Addins directories in APPDATA and PROGRAMDATA
    let app_data = std::env::var("APPDATA").unwrap_or_default();
    let prog_data = std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    for base in [&app_data, &prog_data] {
        let addins_dir = std::path::PathBuf::from(base).join("Autodesk").join("Revit").join("Addins");
        if addins_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&addins_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if !p.is_dir() { continue; }
                    if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                        let version = name.trim().to_string();
                        if matches!(version.as_str(), "2020" | "2021" | "2022" | "2023" | "2024" | "2025" | "2026" | "2027" | "2028") {
                            if !installs.iter().any(|i| i.version == version) {
                                installs.push(AutodeskInstall {
                                    version,
                                    path: p.to_string_lossy().to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    installs.sort_by(|a, b| a.version.cmp(&b.version));
    installs.dedup_by(|a, b| a.version == b.version);
    installs
}

pub fn detect_autocad_installs() -> Vec<AutodeskInstall> {
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

pub fn check_autocad_dlls(path: &std::path::Path) -> bool {
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

pub fn find_autocad_dll(base_path: &std::path::Path, dll_name: &str) -> Option<std::path::PathBuf> {
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
pub fn detect_sketchup_installs() -> Vec<AutodeskInstall> {
    let mut installs = Vec::new();
    let app_data = std::env::var("APPDATA").unwrap_or_default();
    let sketchup_appdata = std::path::Path::new(&app_data).join("SketchUp");

    // 1. Check %APPDATA%\SketchUp\SketchUp {YEAR}
    if sketchup_appdata.exists() {
        if let Ok(entries) = std::fs::read_dir(&sketchup_appdata) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue; };
                let digits: String = name.chars().filter(|c| c.is_ascii_digit()).collect();
                if matches!(digits.as_str(), "2019" | "2020" | "2021" | "2022" | "2023" | "2024" | "2025" | "2026" | "2027" | "2028") {
                    let plugins_dir = path.join("SketchUp").join("Plugins");
                    installs.push(AutodeskInstall {
                        version: digits,
                        path: plugins_dir.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    // 2. Check Program Files across drives (C, D, E, F)
    let drives = ["C", "D", "E", "F", "G"];
    for d in drives {
        let pf1 = format!("{}:\\Program Files\\SketchUp", d);
        let pf2 = format!("{}:\\Program Files\\Trimble", d);
        for base in [pf1, pf2] {
            let p = std::path::PathBuf::from(&base);
            if p.exists() {
                if let Ok(entries) = std::fs::read_dir(&p) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if !path.is_dir() { continue; }
                        let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue; };
                        let digits: String = name.chars().filter(|c| c.is_ascii_digit()).collect();
                        if matches!(digits.as_str(), "2019" | "2020" | "2021" | "2022" | "2023" | "2024" | "2025" | "2026" | "2027" | "2028") {
                            if path.join("SketchUp.exe").exists() && !installs.iter().any(|i| i.version == digits) {
                                let plugins_dir = std::path::Path::new(&app_data)
                                    .join("SketchUp")
                                    .join(format!("SketchUp {}", digits))
                                    .join("SketchUp")
                                    .join("Plugins");
                                installs.push(AutodeskInstall {
                                    version: digits,
                                    path: plugins_dir.to_string_lossy().to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    installs.sort_by(|a, b| b.version.cmp(&a.version));
    installs.dedup_by(|a, b| a.version == b.version);
    installs
}

#[tauri::command]
pub async fn detect_autodesk_installs(target: String) -> Result<Vec<AutodeskInstall>, String> {
    match target.as_str() {
        "3dsmax" => Ok(detect_3dsmax_installs()),
        "revit" => Ok(detect_revit_installs()),
        "autocad" => Ok(detect_autocad_installs()),
        "sketchup" => Ok(detect_sketchup_installs()),
        _ => Err("Unsupported target".to_string()),
    }
}

#[tauri::command]
pub async fn validate_custom_autodesk_path(target: String, path: String) -> Result<AutodeskInstall, String> {
    is_path_safe(&path)?;
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("The selected path does not exist: {}", path));
    }

    match target.as_str() {
        "3dsmax" => {
            let full_str = path.to_lowercase();
            let mut detected_ver = "2024".to_string();
            for v in ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"] {
                if full_str.contains(v) {
                    detected_ver = v.to_string();
                    break;
                }
            }

            let install_dir = if p.is_file() {
                p.parent().unwrap_or(&p).to_path_buf()
            } else {
                p
            };

            Ok(AutodeskInstall {
                version: detected_ver,
                path: install_dir.to_string_lossy().to_string(),
            })
        }
        "revit" => {
            let full_str = path.to_lowercase();
            let mut detected_ver = "2024".to_string();
            for v in ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"] {
                if full_str.contains(v) {
                    detected_ver = v.to_string();
                    break;
                }
            }

            let install_dir = if p.is_file() {
                p.parent().unwrap_or(&p).to_path_buf()
            } else {
                p
            };

            Ok(AutodeskInstall {
                version: detected_ver,
                path: install_dir.to_string_lossy().to_string(),
            })
        }
        "sketchup" => {
            let full_str = path.to_lowercase();
            let mut detected_ver = "2024".to_string();
            for v in ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"] {
                if full_str.contains(v) {
                    detected_ver = v.to_string();
                    break;
                }
            }

            let install_dir = if p.is_file() {
                p.parent().unwrap_or(&p).to_path_buf()
            } else {
                p
            };

            Ok(AutodeskInstall {
                version: detected_ver,
                path: install_dir.to_string_lossy().to_string(),
            })
        }
        _ => Err("Unsupported target".to_string()),
    }
}

#[tauri::command]
pub async fn is_plugin_installed(target: String) -> bool {
    let app_data = std::env::var("APPDATA").unwrap_or_default();
    let prog_data = std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    match target.as_str() {
        "3dsmax" => {
            let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
            let max_root = std::path::Path::new(&local_app_data).join("Autodesk").join("3dsMax");
            let languages = ["ENU", "DEU", "FRA", "JPN", "CHS", "KOR", "PTB"];
            if max_root.exists() {
                if let Ok(entries) = std::fs::read_dir(&max_root) {
                    for entry in entries.flatten() {
                        let profile = entry.path();
                        if !profile.is_dir() { continue; }
                        for lang in &languages {
                            let script_path = profile.join(lang).join("scripts").join("startup").join("AnarchyConnector.ms");
                            let macro_path = profile.join(lang).join("usermacros").join("Anarchy-AnarchySync.mcr");
                            if script_path.exists() || macro_path.exists() {
                                return true;
                            }
                        }
                        if profile.join("scripts").join("startup").join("AnarchyConnector.ms").exists() {
                            return true;
                        }
                    }
                }
            }
            false
        }
        "revit" => {
            for base in [&app_data, &prog_data] {
                let addins_dir = std::path::PathBuf::from(base).join("Autodesk").join("Revit").join("Addins");
                if addins_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(&addins_dir) {
                        for entry in entries.flatten() {
                            let p = entry.path();
                            if p.is_dir() {
                                let addin = p.join("Anarchy.addin");
                                let dll = p.join("AnarchyRevit").join("AnarchyRevit.dll");
                                if addin.exists() && dll.exists() {
                                    return true;
                                }
                            }
                        }
                    }
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
        "sketchup" => {
            let su_root = std::path::Path::new(&app_data).join("SketchUp");
            if su_root.exists() {
                if let Ok(entries) = std::fs::read_dir(&su_root) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let loader = path.join("SketchUp").join("Plugins").join("anarchy_sketchup.rb");
                        let sub = path.join("SketchUp").join("Plugins").join("anarchy_sketchup");
                        if loader.exists() || sub.exists() {
                            return true;
                        }
                    }
                }
            }
            false
        }
        _ => false,
    }
}
