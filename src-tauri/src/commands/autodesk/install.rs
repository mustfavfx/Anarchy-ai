use super::types::AutodeskInstall;
use super::detect::{
    detect_3dsmax_installs, detect_revit_installs, detect_autocad_installs,
    find_autocad_dll, is_process_running,
};

#[tauri::command]
pub async fn install_3dsmax_plugin(_script: String, versions: Option<Vec<String>>) -> Result<Vec<String>, String> {
    let script = include_str!("../../../resources/AnarchyConnector.ms");
    let pymxs_tools = include_str!("../../../resources/PymxsTools.py");
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

    const ICON_24I: &[u8] = include_bytes!("../../../resources/maxicons/AnarchyLogo_24i.bmp");
    const ICON_24A: &[u8] = include_bytes!("../../../resources/maxicons/AnarchyLogo_24a.bmp");
    const ICON_16I: &[u8] = include_bytes!("../../../resources/maxicons/AnarchyLogo_16i.bmp");
    const ICON_16A: &[u8] = include_bytes!("../../../resources/maxicons/AnarchyLogo_16a.bmp");

    for version in &selected_versions {
        let candidate_names = [
            format!("{} - 64bit", version),
            format!("{}", version),
            format!("{} - 64-bit", version),
        ];

        let mut target_profile_paths = Vec::new();
        for name in &candidate_names {
            let p = max_root.join(name);
            if p.exists() {
                target_profile_paths.push(p);
            }
        }

        // If none exist yet, create the standard default profile in LocalAppData
        if target_profile_paths.is_empty() {
            let p = max_root.join(format!("{} - 64bit", version));
            if std::fs::create_dir_all(&p).is_ok() {
                target_profile_paths.push(p);
            }
        }

        for profile_path in target_profile_paths {
            // Detect all active language folders (e.g. ENU, DEU, FRA, JPN, CHS, KOR, PTB)
            let mut languages = Vec::new();
            if let Ok(entries) = std::fs::read_dir(&profile_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            if name.len() == 3 && name.chars().all(|c| c.is_ascii_uppercase()) {
                                languages.push(name.to_string());
                            }
                        }
                    }
                }
            }
            if languages.is_empty() {
                languages.push("ENU".to_string());
            }

            for lang in &languages {
                let startup_dir = profile_path.join(lang).join("scripts").join("startup");
                let usermacros_dir = profile_path.join(lang).join("usermacros");
                let usericons_dir = profile_path.join(lang).join("usericons");

                let _ = std::fs::create_dir_all(&startup_dir);
                let _ = std::fs::create_dir_all(&usermacros_dir);
                let _ = std::fs::create_dir_all(&usericons_dir);

                let script_path = startup_dir.join("AnarchyConnector.ms");
                if std::fs::write(&script_path, script).is_ok() {
                    installed_paths.push(script_path.to_string_lossy().to_string());
                }

                let py_tools_path = startup_dir.join("PymxsTools.py");
                if std::fs::write(&py_tools_path, pymxs_tools).is_ok() {
                    installed_paths.push(py_tools_path.to_string_lossy().to_string());
                }

                let macro_path = usermacros_dir.join("Anarchy-AnarchySync.mcr");
                if std::fs::write(&macro_path, script).is_ok() {
                    installed_paths.push(macro_path.to_string_lossy().to_string());
                }

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
        }

        // Also attempt writing to program installation directory if known
        if let Some(install_dir_str) = detected_map.get(version) {
            let install_dir = std::path::PathBuf::from(install_dir_str);
            if install_dir.join("3dsmax.exe").exists() {
                let sys_startup = install_dir.join("scripts").join("startup");
                if std::fs::create_dir_all(&sys_startup).is_ok() {
                    let sys_script = sys_startup.join("AnarchyConnector.ms");
                    let _ = std::fs::write(&sys_script, script);
                    let sys_py = sys_startup.join("PymxsTools.py");
                    let _ = std::fs::write(&sys_py, pymxs_tools);
                }
            }
        }
    }

    if installed_paths.is_empty() {
        return Err("No 3ds Max profiles could be written. Ensure 3ds Max is installed.".to_string());
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
        let parent_fw = std::path::Path::new(&win_dir)
            .join("Microsoft.NET").join(fw).join("v4.0.30319").join(name);
        if parent_fw.exists() {
            return Some(parent_fw);
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

#[allow(dead_code)]
fn format_dotnet_build_error(version: &str, stdout: &str, stderr: &str) -> String {
    let combined = format!("{}\n{}", stdout, stderr);

    if combined.contains("CS1705") || combined.contains("NETSDK1045") || combined.contains("Version=10.0.0.0") {
        let req_ver = if version == "2027" { ".NET 10 SDK" } else { ".NET 8 SDK" };
        let dl_ver = if version == "2027" { "10.0" } else { "8.0" };
        return format!(
            "{} required for Revit {}.\nRevit {} targets a higher .NET runtime version and requires {} to build the plugin.\nDownload from: https://dotnet.microsoft.com/download/dotnet/{}",
            req_ver, version, version, req_ver, dl_ver
        );
    }

    let error_lines: Vec<&str> = combined
        .lines()
        .map(|line| line.trim())
        .filter(|line| line.contains("error ") || line.contains("CS") && line.contains(":") || line.contains("NETSDK"))
        .collect();

    if !error_lines.is_empty() {
        return format!("Revit {} build failed:\n{}", version, error_lines.join("\n"));
    }

    let lines: Vec<&str> = combined.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    let tail = if lines.len() > 10 {
        lines[lines.len() - 10..].join("\n")
    } else {
        lines.join("\n")
    };

    format!("Revit {} build failed:\n{}", version, tail)
}

const REVIT_NET10_DLL: &[u8] = include_bytes!("../../../resources/revit-plugin/prebuilt/AnarchyRevit_net10.dll");
const REVIT_NET8_DLL: &[u8] = include_bytes!("../../../resources/revit-plugin/prebuilt/AnarchyRevit_net8.dll");
const REVIT_NET48_DLL: &[u8] = include_bytes!("../../../resources/revit-plugin/prebuilt/AnarchyRevit_net48.dll");

fn is_revit_net8(version: &str) -> bool {
    matches!(version, "2025" | "2026" | "2027" | "2028")
}

#[tauri::command]
pub async fn install_revit_plugin(versions: Option<Vec<String>>) -> Result<Vec<String>, String> {
    if is_process_running("Revit.exe") {
        return Err("Revit is currently running. Please save your work and close Revit completely before installing the plugin, then try again.".to_string());
    }

    let detected = detect_revit_installs();
    let selected = versions.unwrap_or_else(|| detected.iter().map(|i| i.version.clone()).collect());

    if selected.is_empty() {
        return Err("No Revit versions selected for installation.".to_string());
    }

    let detected_map: std::collections::HashMap<String, std::path::PathBuf> =
        detected.into_iter().map(|i| (i.version, std::path::PathBuf::from(i.path))).collect();

    const CS_SOURCE: &str = include_str!("../../../resources/revit-plugin/AnarchyRevit.cs");
    const ADDIN_TEMPLATE: &str = include_str!("../../../resources/revit-plugin/Anarchy.addin.template");
    const CSPROJ_TEMPLATE: &str = include_str!("../../../resources/revit-plugin/AnarchyRevit2025.csproj.template");
    const ICON_32: &[u8] = include_bytes!("../../../resources/revit-plugin/AnarchyLogo_32.png");
    const ICON_16: &[u8] = include_bytes!("../../../resources/revit-plugin/AnarchyLogo_16.png");

    let app_data = std::env::var("APPDATA")
        .map_err(|_| "APPDATA env var not found".to_string())?;
    let prog_data = std::env::var("PROGRAMDATA")
        .unwrap_or_else(|_| "C:\\ProgramData".to_string());

    let mut installed = Vec::new();
    let mut errors = Vec::new();

    for version in &selected {
        let addins_dir = std::path::PathBuf::from(&app_data)
            .join("Autodesk").join("Revit").join("Addins").join(version);
        if let Err(e) = std::fs::create_dir_all(&addins_dir) {
            errors.push(format!("Failed to create addins folder for Revit {}: {}", version, e));
            continue;
        }

        let plugin_dir = addins_dir.join("AnarchyRevit");
        if let Err(e) = std::fs::create_dir_all(&plugin_dir) {
            errors.push(format!("Failed to create plugin folder for Revit {}: {}", version, e));
            continue;
        }

        let icon32_path = plugin_dir.join("AnarchyLogo_32.png");
        let icon16_path = plugin_dir.join("AnarchyLogo_16.png");
        let _ = std::fs::write(&icon32_path, ICON_32);
        let _ = std::fs::write(&icon16_path, ICON_16);

        let dll_path = plugin_dir.join("AnarchyRevit.dll");

        // Primary deployment: Instant, offline installation via prebuilt assemblies
        let prebuilt_bytes: Option<&[u8]> = match version.as_str() {
            "2027" | "2028" => Some(REVIT_NET10_DLL),
            "2025" | "2026" => Some(REVIT_NET8_DLL),
            "2020" | "2021" | "2022" | "2023" | "2024" => Some(REVIT_NET48_DLL),
            _ => None,
        };

        let mut dll_written = false;
        if let Some(bytes) = prebuilt_bytes {
            if dll_path.exists() {
                let _ = std::fs::remove_file(&dll_path);
            }
            if std::fs::write(&dll_path, bytes).is_ok() {
                dll_written = true;
            }
        }

        // Secondary fallback: On-the-fly compilation if prebuilt was somehow not written
        if !dll_written {
            let revit_dir = detected_map.get(version).cloned().unwrap_or_else(|| {
                std::path::PathBuf::from(format!("C:\\Program Files\\Autodesk\\Revit {}", version))
            });
            let api_dll = revit_dir.join("RevitAPI.dll");
            let api_ui_dll = revit_dir.join("RevitAPIUI.dll");

            if is_revit_net8(version) {
                if let Some(dotnet) = find_dotnet_sdk() {
                    let build_dir = std::env::temp_dir().join(format!("AnarchyRevit{}Build", version));
                    let _ = std::fs::remove_dir_all(&build_dir);
                    let _ = std::fs::create_dir_all(&build_dir);
                    let _ = std::fs::write(build_dir.join("AnarchyRevit.cs"), CS_SOURCE);
                    let target_framework = match version.as_str() {
                        "2027" | "2028" => "net10.0-windows",
                        _ => "net8.0-windows",
                    };
                    let csproj = CSPROJ_TEMPLATE
                        .replace("{{REVIT_DIR}}", &revit_dir.to_string_lossy())
                        .replace("{{TARGET_FRAMEWORK}}", target_framework);
                    let _ = std::fs::write(build_dir.join("AnarchyRevit.csproj"), csproj);
                    let build_out_dir = std::env::temp_dir().join(format!("AnarchyRevit{}Out", version));
                    let _ = std::fs::remove_dir_all(&build_out_dir);
                    let _ = std::fs::create_dir_all(&build_out_dir);

                    if let Ok(out) = std::process::Command::new(&dotnet)
                        .args(["publish", "--nologo", "-c", "Release", "-r", "win-x64", "--self-contained", "false", "-o"])
                        .arg(&build_out_dir)
                        .current_dir(&build_dir)
                        .output()
                    {
                        if out.status.success() {
                            let built_dll = build_out_dir.join("AnarchyRevit.dll");
                            if built_dll.exists() {
                                let _ = std::fs::copy(&built_dll, &dll_path);
                                dll_written = true;
                            }
                        }
                    }
                    let _ = std::fs::remove_dir_all(&build_dir);
                    let _ = std::fs::remove_dir_all(&build_out_dir);
                }
            } else if let Some(csc) = find_csc_exe() {
                let cs_path = plugin_dir.join("AnarchyRevit.cs");
                let _ = std::fs::write(&cs_path, CS_SOURCE);
                let presentation_core = find_wpf_assembly("PresentationCore.dll");
                let windows_base = find_wpf_assembly("WindowsBase.dll");
                let system_xaml = find_wpf_assembly("System.Xaml.dll");

                if let (Some(pc), Some(wb), Some(sx)) = (presentation_core, windows_base, system_xaml) {
                    let out = std::process::Command::new(&csc)
                        .arg("/target:library")
                        .arg("/nologo")
                        .arg("/platform:x64")
                        .arg(format!("/out:{}", dll_path.display()))
                        .arg(format!("/reference:{}", api_dll.display()))
                        .arg(format!("/reference:{}", api_ui_dll.display()))
                        .arg(format!("/reference:{}", pc.display()))
                        .arg(format!("/reference:{}", wb.display()))
                        .arg(format!("/reference:{}", sx.display()))
                        .arg("/reference:System.dll")
                        .arg("/reference:System.Core.dll")
                        .arg(&cs_path)
                        .output();
                    if let Ok(o) = out {
                        if o.status.success() {
                            dll_written = true;
                        }
                    }
                }
            }
        }

        if !dll_written && !dll_path.exists() {
            errors.push(format!("Could not install AnarchyRevit.dll for Revit {}.", version));
            continue;
        }

        let addin_content = ADDIN_TEMPLATE.replace(
            "{{ASSEMBLY_PATH}}",
            &dll_path.to_string_lossy(),
        );
        let addin_path = addins_dir.join("Anarchy.addin");
        if let Err(e) = std::fs::write(&addin_path, &addin_content) {
            errors.push(format!("Failed to write .addin manifest for Revit {}: {}", version, e));
            continue;
        }

        // Also deploy to ProgramData for all-user visibility if accessible
        let machine_addins_dir = std::path::PathBuf::from(&prog_data)
            .join("Autodesk").join("Revit").join("Addins").join(version);
        if std::fs::create_dir_all(&machine_addins_dir).is_ok() {
            let _ = std::fs::write(machine_addins_dir.join("Anarchy.addin"), &addin_content);
        }

        installed.push(dll_path.to_string_lossy().to_string());
        installed.push(addin_path.to_string_lossy().to_string());
    }

    if installed.is_empty() {
        if !errors.is_empty() {
            return Err(errors.join("\n\n"));
        }
        return Err("No selected Revit versions could be installed. Ensure Revit is installed or browse for the installation folder.".to_string());
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
pub async fn install_autocad_plugin(versions: Option<Vec<String>>) -> Result<Vec<String>, String> {
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

    const PKG_TEMPLATE: &str = include_str!("../../../resources/autocad-plugin/PackageContents.xml.template");
    const ICON_32: &[u8] = include_bytes!("../../../resources/autocad-plugin/AnarchyLogo_32.png");
    const ICON_16: &[u8] = include_bytes!("../../../resources/autocad-plugin/AnarchyLogo_16.png");

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
        const CS_SOURCE_2025: &str = include_str!("../../../resources/autocad-plugin/AnarchyAutoCad2025.cs");
        const CSPROJ_TEMPLATE: &str = include_str!("../../../resources/autocad-plugin/AnarchyAutoCad2025.csproj.template");

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
        const CS_SOURCE: &str = include_str!("../../../resources/autocad-plugin/AnarchyAutoCad.cs");

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
pub async fn remove_old_autodesk_plugins(target: String) -> Result<Vec<String>, String> {
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

/// Automatically synchronizes the latest AnarchyConnector.ms and PymxsTools.py
/// to all detected 3ds Max installations and AppData on application launch.
pub fn auto_sync_autodesk_connectors() {
    let script = include_str!("../../../resources/AnarchyConnector.ms");
    let pymxs_tools = include_str!("../../../resources/PymxsTools.py");

    // 1. Sync to Roaming com.anarchyai.app
    if let Ok(app_data) = std::env::var("APPDATA") {
        let app_dir = std::path::Path::new(&app_data).join("com.anarchyai.app");
        let _ = std::fs::create_dir_all(&app_dir);
        let _ = std::fs::write(app_dir.join("AnarchyConnector.ms"), script);
        let _ = std::fs::write(app_dir.join("PymxsTools.py"), pymxs_tools);
    }

    // 2. Sync to all detected 3ds Max user profiles in LocalAppData
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let max_root = std::path::Path::new(&local_app_data).join("Autodesk").join("3dsMax");
    if max_root.exists() {
        if let Ok(entries) = std::fs::read_dir(&max_root) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    if let Ok(lang_entries) = std::fs::read_dir(&p) {
                        for lang_entry in lang_entries.flatten() {
                            let lp = lang_entry.path();
                            if lp.is_dir() {
                                let startup = lp.join("scripts").join("startup");
                                if startup.exists() || lp.join("scripts").exists() {
                                    let _ = std::fs::create_dir_all(&startup);
                                    let _ = std::fs::write(startup.join("AnarchyConnector.ms"), script);
                                    let _ = std::fs::write(startup.join("PymxsTools.py"), pymxs_tools);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

