use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenMetrics {
    pub width: i32,
    pub height: i32,
    pub virtual_x: i32,
    pub virtual_y: i32,
    pub virtual_width: i32,
    pub virtual_height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: isize,
    pub title: String,
    pub process_id: u32,
    pub rect: WindowRect,
    pub is_autodesk: bool,
    pub is_minimized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenCaptureResult {
    pub image: String,
    pub width: u32,
    pub height: u32,
    pub window_title: Option<String>,
    pub origin_x: i32,
    pub origin_y: i32,
    pub original_width: u32,
    pub original_height: u32,
    pub scale_factor: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutodeskCommandItem {
    pub id: String,
    pub software: String,
    pub action: String,
    pub script: String,
    pub params: Option<std::collections::HashMap<String, serde_json::Value>>,
    pub created_at: u64,
    pub ttl_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutodeskCommandResult {
    pub id: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

// Global command queue and heartbeat state for 3ds Max / Autodesk plugins
static AUTODESK_QUEUE: OnceLock<Arc<Mutex<Vec<AutodeskCommandItem>>>> = OnceLock::new();
static AUTODESK_RESULTS: OnceLock<Arc<Mutex<std::collections::HashMap<String, AutodeskCommandResult>>>> = OnceLock::new();
static LAST_HEARTBEATS: OnceLock<Arc<Mutex<std::collections::HashMap<String, u64>>>> = OnceLock::new();

pub fn record_autodesk_heartbeat(software: &str) {
    let map = LAST_HEARTBEATS.get_or_init(|| Arc::new(Mutex::new(std::collections::HashMap::new())));
    if let Ok(mut lock) = map.lock() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        lock.insert(software.to_lowercase(), now);
    }
}

pub fn is_autodesk_connector_online(software: &str) -> bool {
    let map = LAST_HEARTBEATS.get_or_init(|| Arc::new(Mutex::new(std::collections::HashMap::new())));
    if let Ok(lock) = map.lock() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        if let Some(&last) = lock.get(&software.to_lowercase()) {
            return now.saturating_sub(last) <= 10; // Polling interval is 1.2s, 10s threshold handles GC/jitter
        }
    }
    false
}

#[tauri::command]
pub fn cua_is_connector_online(software: String) -> bool {
    is_autodesk_connector_online(&software)
}

#[tauri::command]
pub async fn cua_wait_for_connector(software: String, timeout_secs: Option<u64>) -> Result<bool, String> {
    let max_wait = std::time::Duration::from_secs(timeout_secs.unwrap_or(30));
    let start = std::time::Instant::now();
    while start.elapsed() < max_wait {
        if is_autodesk_connector_online(&software) {
            return Ok(true);
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    Ok(false)
}

static IN_PROGRESS_COMMANDS: OnceLock<Arc<Mutex<std::collections::HashSet<String>>>> = OnceLock::new();

fn get_in_progress() -> &'static Arc<Mutex<std::collections::HashSet<String>>> {
    IN_PROGRESS_COMMANDS.get_or_init(|| Arc::new(Mutex::new(std::collections::HashSet::new())))
}

fn get_queue() -> &'static Arc<Mutex<Vec<AutodeskCommandItem>>> {
    AUTODESK_QUEUE.get_or_init(|| Arc::new(Mutex::new(Vec::new())))
}

fn get_results() -> &'static Arc<Mutex<std::collections::HashMap<String, AutodeskCommandResult>>> {
    AUTODESK_RESULTS.get_or_init(|| Arc::new(Mutex::new(std::collections::HashMap::new())))
}

#[tauri::command]
pub fn cua_get_screen_metrics() -> Result<ScreenMetrics, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN,
            SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
        };

        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);
        let virtual_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let virtual_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let virtual_width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let virtual_height = GetSystemMetrics(SM_CYVIRTUALSCREEN);

        Ok(ScreenMetrics {
            width,
            height,
            virtual_x,
            virtual_y,
            virtual_width,
            virtual_height,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("CUA screen metrics are only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn cua_get_active_windows() -> Result<Vec<WindowInfo>, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
            GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        };

        let mut windows: Vec<WindowInfo> = Vec::new();

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let list = &mut *(lparam as *mut Vec<WindowInfo>);
            if IsWindowVisible(hwnd) == 0 {
                return 1;
            }

            let length = GetWindowTextLengthW(hwnd);
            if length == 0 {
                return 1;
            }

            let mut title_buf = vec![0u16; (length + 1) as usize];
            let read_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), length + 1);
            if read_len == 0 {
                return 1;
            }

            let title = String::from_utf16_lossy(&title_buf[..read_len as usize]).trim().to_string();
            if title.is_empty() || title == "Program Manager" || title == "Settings" {
                return 1;
            }

            let mut rect: RECT = std::mem::zeroed();
            GetWindowRect(hwnd, &mut rect);
            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;

            // Ignore tiny 0x0 or off-screen hidden utility windows
            if width <= 10 || height <= 10 {
                return 1;
            }

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);

            let lower_title = title.to_lowercase();
            let is_autodesk = lower_title.contains("3ds max")
                || lower_title.contains("autocad")
                || lower_title.contains("revit")
                || lower_title.contains("autodesk");

            let is_minimized = IsIconic(hwnd) != 0;

            list.push(WindowInfo {
                id: hwnd as isize,
                title,
                process_id: pid,
                rect: WindowRect {
                    x: rect.left,
                    y: rect.top,
                    width,
                    height,
                },
                is_autodesk,
                is_minimized,
            });

            1
        }

        EnumWindows(Some(enum_proc), &mut windows as *mut _ as LPARAM);
        Ok(windows)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("CUA window enumeration is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn cua_focus_window(hwnd: Option<isize>, title_pattern: Option<String>) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Foundation::HWND;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            BringWindowToTop, SetForegroundWindow, ShowWindow, SW_RESTORE,
        };

        let target_hwnd = if let Some(h) = hwnd {
            h as HWND
        } else if let Some(pattern) = title_pattern {
            let windows = cua_get_active_windows()?;
            let pat = pattern.to_lowercase();
            let found = windows.iter().find(|w| w.title.to_lowercase().contains(&pat));
            match found {
                Some(w) => w.id as HWND,
                None => return Err(format!("No window matching title pattern: {}", pattern)),
            }
        } else {
            return Err("Must specify hwnd or title_pattern".to_string());
        };

        ShowWindow(target_hwnd, SW_RESTORE);
        BringWindowToTop(target_hwnd);
        let ok = SetForegroundWindow(target_hwnd);
        Ok(ok != 0)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Only supported on Windows".to_string())
    }
}

#[tauri::command]
pub async fn cua_launch_app(app_name: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let lower = app_name.to_lowercase();

        if lower.contains("3dsmax") || lower.contains("3ds max") || lower == "max" {
            // 1. Try to focus if already running with a visible window
            if let Ok(true) = cua_focus_window(None, Some("3ds Max".to_string())) {
                return Ok("3ds Max is already open and brought to front.".to_string());
            }

            // 2. Discover executable path
            let mut exe_path = None;
            let candidates = [
                r"C:\Program Files\Autodesk\3ds Max 2027\3dsmax.exe",
                r"C:\Program Files\Autodesk\3ds Max 2026\3dsmax.exe",
                r"C:\Program Files\Autodesk\3ds Max 2025\3dsmax.exe",
                r"C:\Program Files\Autodesk\3ds Max 2024\3dsmax.exe",
                r"D:\Program Files\Autodesk\3ds Max 2027\3dsmax.exe",
                r"E:\Program Files\Autodesk\3ds Max 2027\3dsmax.exe",
            ];
            for candidate in &candidates {
                if std::path::Path::new(candidate).exists() {
                    exe_path = Some(candidate.to_string());
                    break;
                }
            }

            if exe_path.is_none() {
                let installs = crate::commands::autodesk::detect_3dsmax_installs();
                for inst in installs.iter().rev() {
                    let p = std::path::Path::new(&inst.path).join("3dsmax.exe");
                    if p.exists() {
                        exe_path = Some(p.to_string_lossy().to_string());
                        break;
                    }
                }
            }

            if let Some(exe) = exe_path {
                let parent_dir = std::path::Path::new(&exe).parent();
                let mut cmd = std::process::Command::new(&exe);
                if let Some(dir) = parent_dir {
                    cmd.current_dir(dir);
                }
                cmd.arg("/Language=ENU");
                match cmd.spawn() {
                    Ok(child) => Ok(format!("3ds Max launched successfully (PID: {})", child.id())),
                    Err(e) => Err(format!("Failed to launch 3ds Max: {}", e)),
                }
            } else {
                Err("3ds Max installation not found in system or standard Autodesk directories.".to_string())
            }
        } else if lower.contains("autocad") || lower.contains("acad") {
            if let Ok(true) = cua_focus_window(None, Some("AutoCAD".to_string())) {
                return Ok("AutoCAD is already open and brought to front.".to_string());
            }

            let mut exe_path = None;
            let candidates = [
                r"C:\Program Files\Autodesk\AutoCAD 2027\acad.exe",
                r"C:\Program Files\Autodesk\AutoCAD 2026\acad.exe",
                r"C:\Program Files\Autodesk\AutoCAD 2025\acad.exe",
                r"C:\Program Files\Autodesk\AutoCAD 2024\acad.exe",
            ];
            for candidate in &candidates {
                if std::path::Path::new(candidate).exists() {
                    exe_path = Some(candidate.to_string());
                    break;
                }
            }

            if exe_path.is_none() {
                let installs = crate::commands::autodesk::detect_autocad_installs();
                for inst in installs.iter().rev() {
                    let p = std::path::Path::new(&inst.path).join("acad.exe");
                    if p.exists() {
                        exe_path = Some(p.to_string_lossy().to_string());
                        break;
                    }
                }
            }

            if let Some(exe) = exe_path {
                let parent_dir = std::path::Path::new(&exe).parent();
                let mut cmd = std::process::Command::new(&exe);
                if let Some(dir) = parent_dir {
                    cmd.current_dir(dir);
                }
                match cmd.spawn() {
                    Ok(child) => Ok(format!("AutoCAD launched successfully (PID: {})", child.id())),
                    Err(e) => Err(format!("Failed to launch AutoCAD: {}", e)),
                }
            } else {
                Err("AutoCAD installation not found in system or standard Autodesk directories.".to_string())
            }
        } else if lower.contains("revit") {
            if let Ok(true) = cua_focus_window(None, Some("Revit".to_string())) {
                return Ok("Revit is already open and brought to front.".to_string());
            }

            let mut exe_path = None;
            let candidates = [
                r"C:\Program Files\Autodesk\Revit 2027\Revit.exe",
                r"C:\Program Files\Autodesk\Revit 2026\Revit.exe",
                r"C:\Program Files\Autodesk\Revit 2025\Revit.exe",
                r"C:\Program Files\Autodesk\Revit 2024\Revit.exe",
            ];
            for candidate in &candidates {
                if std::path::Path::new(candidate).exists() {
                    exe_path = Some(candidate.to_string());
                    break;
                }
            }

            if exe_path.is_none() {
                let installs = crate::commands::autodesk::detect_revit_installs();
                for inst in installs.iter().rev() {
                    let p = std::path::Path::new(&inst.path).join("Revit.exe");
                    if p.exists() {
                        exe_path = Some(p.to_string_lossy().to_string());
                        break;
                    }
                }
            }

            if let Some(exe) = exe_path {
                let parent_dir = std::path::Path::new(&exe).parent();
                let mut cmd = std::process::Command::new(&exe);
                if let Some(dir) = parent_dir {
                    cmd.current_dir(dir);
                }
                match cmd.spawn() {
                    Ok(child) => Ok(format!("Revit launched successfully (PID: {})", child.id())),
                    Err(e) => Err(format!("Failed to launch Revit: {}", e)),
                }
            } else {
                Err("Revit installation not found in system or standard Autodesk directories.".to_string())
            }
        } else {
            Err(format!("Unsupported application: '{}'", app_name))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_name;
        Err("Application launching is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub async fn cua_capture_screen(
    window_title: Option<String>,
    max_dimension: Option<u32>,
) -> Result<ScreenCaptureResult, String> {
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || {
            capture_screen_windows(window_title, max_dimension)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Only supported on Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
fn capture_screen_windows(
    window_title: Option<String>,
    max_dimension: Option<u32>,
) -> Result<ScreenCaptureResult, String> {
    use std::io::Cursor;
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, GetWindowRect,
        SM_CXSCREEN, SM_CYSCREEN, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
        SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    };

    extern "system" {
        fn PrintWindow(
            hwnd: HWND,
            hdcBlt: windows_sys::Win32::Graphics::Gdi::HDC,
            nFlags: u32,
        ) -> windows_sys::Win32::Foundation::BOOL;

        fn GetWindowDC(
            hwnd: HWND,
        ) -> windows_sys::Win32::Graphics::Gdi::HDC;
    }

    unsafe {
        let (hwnd, src_x, src_y, origin_x, origin_y, width, height, matched_title) = if let Some(pattern) = &window_title {
            let windows = cua_get_active_windows()?;
            let pat = pattern.to_lowercase();
            let found = windows.iter().find(|w| w.title.to_lowercase().contains(&pat));
            match found {
                Some(w) => {
                    let mut r: RECT = std::mem::zeroed();
                    GetWindowRect(w.id as HWND, &mut r);
                    let w_width = (r.right - r.left).max(1);
                    let w_height = (r.bottom - r.top).max(1);
                    (w.id as HWND, 0, 0, r.left, r.top, w_width, w_height, Some(w.title.clone()))
                }
                None => return Err(format!("Window matching '{}' not found", pattern)),
            }
        } else {
            let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            let (final_vx, final_vy, final_vw, final_vh) = if vw > 0 && vh > 0 {
                (vx, vy, vw, vh)
            } else {
                (0, 0, GetSystemMetrics(SM_CXSCREEN).max(1), GetSystemMetrics(SM_CYSCREEN).max(1))
            };
            (std::ptr::null_mut() as HWND, final_vx, final_vy, final_vx, final_vy, final_vw, final_vh, None)
        };

        // Use GetWindowDC for specific HWND so client rect matches window frame (GetWindowRect), avoiding titlebar shift!
        // For full desktop (hwnd is null), use GetDC(null)
        let hdc_src = if !hwnd.is_null() {
            GetWindowDC(hwnd)
        } else {
            GetDC(hwnd)
        };
        if hdc_src.is_null() {
            return Err("Failed to acquire Device Context (GetWindowDC/GetDC)".to_string());
        }

        let hdc_mem = CreateCompatibleDC(hdc_src);
        if hdc_mem.is_null() {
            ReleaseDC(hwnd, hdc_src);
            return Err("Failed to create memory Device Context".to_string());
        }

        let hbm = CreateCompatibleBitmap(hdc_src, width, height);
        if hbm.is_null() {
            DeleteDC(hdc_mem);
            ReleaseDC(hwnd, hdc_src);
            return Err("Failed to create compatible bitmap".to_string());
        }

        let old_bm = SelectObject(hdc_mem, hbm);

        // Hardware-accelerated window capture:
        // Try PrintWindow with PW_RENDERFULLCONTENT (2) for DirectX, OpenGL, Nitrous viewport (3ds Max), and WebView2.
        let mut capture_ok = 0;
        if !hwnd.is_null() {
            capture_ok = PrintWindow(hwnd, hdc_mem, 2);
        }
        if capture_ok == 0 {
            // Fallback to BitBlt for standard GDI windows and full desktop
            capture_ok = BitBlt(hdc_mem, 0, 0, width, height, hdc_src, src_x, src_y, SRCCOPY);
        }
        SelectObject(hdc_mem, old_bm);

        if capture_ok == 0 {
            DeleteObject(hbm);
            DeleteDC(hdc_mem);
            ReleaseDC(hwnd, hdc_src);
            return Err("Screen capture failed (both PrintWindow and BitBlt failed)".to_string());
        }

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height; // Top-down DIB
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut bgra_buffer = vec![0u8; (width * height * 4) as usize];
        let lines = GetDIBits(
            hdc_mem,
            hbm,
            0,
            height as u32,
            bgra_buffer.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        DeleteObject(hbm);
        DeleteDC(hdc_mem);
        ReleaseDC(hwnd, hdc_src);

        if lines == 0 {
            return Err("GetDIBits failed to read pixels".to_string());
        }

        // Convert BGRA to RGBA in-place
        for chunk in bgra_buffer.chunks_exact_mut(4) {
            let b = chunk[0];
            let r = chunk[2];
            chunk[0] = r;
            chunk[2] = b;
            chunk[3] = 255;
        }

        let mut img = image::RgbaImage::from_raw(width as u32, height as u32, bgra_buffer)
            .ok_or_else(|| "Failed to construct RgbaImage from raw pixel buffer".to_string())?;

        let original_width = width as u32;
        let original_height = height as u32;
        let mut scale_factor = 1.0f32;

        if let Some(max_dim) = max_dimension {
            if original_width > max_dim || original_height > max_dim {
                let ratio = if original_width > original_height {
                    max_dim as f32 / original_width as f32
                } else {
                    max_dim as f32 / original_height as f32
                };
                let new_w = ((original_width as f32 * ratio).round().max(1.0)) as u32;
                let new_h = ((original_height as f32 * ratio).round().max(1.0)) as u32;
                scale_factor = ratio;
                img = image::imageops::resize(&img, new_w, new_h, image::imageops::FilterType::Triangle);
            }
        }

        let out_w = img.width();
        let out_h = img.height();

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        let rgb_img = image::DynamicImage::ImageRgba8(img).to_rgb8();
        rgb_img.write_to(&mut cursor, image::ImageFormat::Jpeg)
            .map_err(|e| format!("JPEG encode error: {}", e))?;

        use base64::Engine;
        let base64_str = base64::engine::general_purpose::STANDARD.encode(&jpeg_bytes);
        let data_url = format!("data:image/jpeg;base64,{}", base64_str);

        Ok(ScreenCaptureResult {
            image: data_url,
            width: out_w,
            height: out_h,
            window_title: matched_title,
            origin_x,
            origin_y,
            original_width,
            original_height,
            scale_factor,
        })
    }
}

pub fn clamp_to_target_window(
    x: i32,
    y: i32,
    target_window: Option<&str>,
    target_bounds: Option<[i32; 4]>,
) -> Result<(i32, i32), String> {
    if let Some([left, top, right, bottom]) = target_bounds {
        let min_x = left.min(right);
        let max_x = left.max(right);
        let min_y = top.min(bottom);
        let max_y = top.max(bottom);
        let cx = x.clamp(min_x, max_x);
        let cy = y.clamp(min_y, max_y);
        return Ok((cx, cy));
    }

    if let Some(target) = target_window {
        let windows = cua_get_active_windows()?;
        let pat = target.to_lowercase();
        if let Some(win) = windows.iter().find(|w| w.title.to_lowercase().contains(&pat)) {
            let left = win.rect.x;
            let top = win.rect.y;
            let right = win.rect.x + win.rect.width;
            let bottom = win.rect.y + win.rect.height;
            // Inset by 2px from borders to prevent clicking outside edge
            let min_x = left + 2;
            let max_x = (right - 2).max(min_x);
            let min_y = top + 2;
            let max_y = (bottom - 2).max(min_y);
            let cx = x.clamp(min_x, max_x);
            let cy = y.clamp(min_y, max_y);
            return Ok((cx, cy));
        } else {
            return Err(format!("Target window '{}' not found for bounds enforcement", target));
        }
    }

    Ok((x, y))
}

#[tauri::command]
pub fn cua_mouse_click(
    x: i32,
    y: i32,
    button: Option<String>,
    double_click: Option<bool>,
    target_window: Option<String>,
    target_bounds: Option<[i32; 4]>,
) -> Result<(), String> {
    let (target_x, target_y) = clamp_to_target_window(x, y, target_window.as_deref(), target_bounds)?;

    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
            MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
            MOUSEINPUT,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::SetCursorPos;

        SetCursorPos(target_x, target_y);
        std::thread::sleep(Duration::from_millis(15));

        let btn = button.as_deref().unwrap_or("left").to_lowercase();
        let (down_flag, up_flag) = match btn.as_str() {
            "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
            "middle" => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
            _ => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        };

        let mut inputs = [
            INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dx: 0,
                        dy: 0,
                        mouseData: 0,
                        dwFlags: down_flag,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dx: 0,
                        dy: 0,
                        mouseData: 0,
                        dwFlags: up_flag,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];

        SendInput(2, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);

        if double_click.unwrap_or(false) {
            std::thread::sleep(Duration::from_millis(60));
            SendInput(2, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
        }

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (target_x, target_y);
        Err("Only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn cua_mouse_move(
    x: i32,
    y: i32,
    target_window: Option<String>,
    target_bounds: Option<[i32; 4]>,
) -> Result<(), String> {
    let (target_x, target_y) = clamp_to_target_window(x, y, target_window.as_deref(), target_bounds)?;

    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::SetCursorPos;
        SetCursorPos(target_x, target_y);
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (target_x, target_y);
        Err("Only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn cua_mouse_scroll(direction: Option<String>, amount: Option<i32>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_WHEEL, MOUSEINPUT,
        };

        let dir = direction.as_deref().unwrap_or("down").to_lowercase();
        let amt = amount.unwrap_or(1).max(1);
        let delta = if dir == "up" { 120 * amt } else { -120 * amt };

        let mut input = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: delta as u32,
                    dwFlags: MOUSEEVENTF_WHEEL,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };

        SendInput(1, &mut input, std::mem::size_of::<INPUT>() as i32);
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn cua_mouse_drag(
    from_x: i32,
    from_y: i32,
    to_x: i32,
    to_y: i32,
    steps: Option<usize>,
    target_window: Option<String>,
    target_bounds: Option<[i32; 4]>,
) -> Result<(), String> {
    let (clamped_from_x, clamped_from_y) = clamp_to_target_window(from_x, from_y, target_window.as_deref(), target_bounds)?;
    let (clamped_to_x, clamped_to_y) = clamp_to_target_window(to_x, to_y, target_window.as_deref(), target_bounds)?;

    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
            MOUSEINPUT,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::SetCursorPos;

        SetCursorPos(clamped_from_x, clamped_from_y);
        std::thread::sleep(Duration::from_millis(15));

        let mut down_input = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: 0,
                    dwFlags: MOUSEEVENTF_LEFTDOWN,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        SendInput(1, &mut down_input, std::mem::size_of::<INPUT>() as i32);

        let step_count = steps.unwrap_or(20).max(1);
        for i in 1..=step_count {
            let t = i as f32 / step_count as f32;
            let cx = clamped_from_x as f32 + (clamped_to_x - clamped_from_x) as f32 * t;
            let cy = clamped_from_y as f32 + (clamped_to_y - clamped_from_y) as f32 * t;
            SetCursorPos(cx as i32, cy as i32);
            std::thread::sleep(Duration::from_millis(10));
        }

        let mut up_input = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: 0,
                    dwFlags: MOUSEEVENTF_LEFTUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        SendInput(1, &mut up_input, std::mem::size_of::<INPUT>() as i32);

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (clamped_from_x, clamped_from_y, clamped_to_x, clamped_to_y);
        Err("Only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn cua_send_keys(
    text: Option<String>,
    key_combo: Option<Vec<String>>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
            KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
            VK_CONTROL, VK_SHIFT, VK_MENU, VK_RETURN, VK_ESCAPE, VK_TAB,
            VK_BACK, VK_SPACE, VK_LEFT, VK_RIGHT, VK_UP, VK_DOWN,
        };

        // 1. Send text via Unicode events
        if let Some(txt) = text {
            let mut inputs = Vec::new();
            for ch in txt.encode_utf16() {
                inputs.push(INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: 0,
                            wScan: ch,
                            dwFlags: KEYEVENTF_UNICODE,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                });
                inputs.push(INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: 0,
                            wScan: ch,
                            dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                });
            }
            if !inputs.is_empty() {
                SendInput(inputs.len() as u32, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32);
            }
        }

        // 2. Send key combo (e.g. ["ctrl", "s"] or ["enter"])
        if let Some(combo) = key_combo {
            let mut vks_down = Vec::new();
            for key in combo {
                let vk = match key.to_lowercase().as_str() {
                    "ctrl" | "control" => VK_CONTROL,
                    "shift" => VK_SHIFT,
                    "alt" => VK_MENU,
                    "enter" | "return" => VK_RETURN,
                    "esc" | "escape" => VK_ESCAPE,
                    "tab" => VK_TAB,
                    "backspace" => VK_BACK,
                    "space" => VK_SPACE,
                    "left" => VK_LEFT,
                    "right" => VK_RIGHT,
                    "up" => VK_UP,
                    "down" => VK_DOWN,
                    "s" => b'S' as u16,
                    "z" => b'Z' as u16,
                    "c" => b'C' as u16,
                    "v" => b'V' as u16,
                    "a" => b'A' as u16,
                    "r" => b'R' as u16,
                    "del" | "delete" => 0x2E, // VK_DELETE
                    "home" => 0x24,           // VK_HOME
                    "end" => 0x23,            // VK_END
                    "insert" => 0x2D,         // VK_INSERT
                    "pgup" | "pageup" => 0x21,// VK_PRIOR
                    "pgdn" | "pagedown" => 0x22,// VK_NEXT
                    "f1" => 0x70,
                    "f2" => 0x71,
                    "f3" => 0x72,
                    "f4" => 0x73,
                    "f5" => 0x74,
                    "f6" => 0x75,
                    "f7" => 0x76,
                    "f8" => 0x77,
                    "f9" => 0x78, // 3ds Max Render Hotkey
                    "f10" => 0x79,
                    "f11" => 0x7A,
                    "f12" => 0x7B,
                    other => {
                        if other.len() == 1 {
                            other.chars().next().unwrap().to_ascii_uppercase() as u16
                        } else {
                            continue;
                        }
                    }
                };
                vks_down.push(vk);
            }

            // Key downs
            for &vk in &vks_down {
                let mut inp = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: vk,
                            wScan: 0,
                            dwFlags: 0,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };
                SendInput(1, &mut inp, std::mem::size_of::<INPUT>() as i32);
            }

            std::thread::sleep(Duration::from_millis(25));

            // Key ups in reverse order
            for &vk in vks_down.iter().rev() {
                let mut inp = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: vk,
                            wScan: 0,
                            dwFlags: KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };
                SendInput(1, &mut inp, std::mem::size_of::<INPUT>() as i32);
            }
        }

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Only supported on Windows".to_string())
    }
}

// ── Autodesk Precision Command Bridge ────────────────────────────────────────

pub fn is_script_safe(script: &str) -> Result<(), String> {
    let lower = script.to_lowercase();
    // Normalized stripped version to defeat string concatenation bypasses like "System.Diag" + "nostics"
    let stripped: String = lower.chars().filter(|c| c.is_alphanumeric()).collect();

    let dangerous_tokens = [
        "doscommand",
        "hiddendoscommand",
        "sysinfocommandline",
        "registrywrite",
        "registrydelete",
        "systemdiagnosticsprocess",
        "systemdiagnostics",
        "diagnosticsprocess",
        "shelllaunch",
        "pythonexecute",
        "deletefile",
        "resetmaxfile",
        "quitmax",
        "exitmax",
        "savemaxfile",
        "cmdexe",
        "powershellexe",
        // --- added: bypasses of the original list (file/process/.NET/script-runner access) ---
        "pythonrun",        // python.run "x.py"
        "systemio",         // (dotnetclass "System.IO.File").Delete / WriteAllText ...
        "systemreflection", // System.Reflection.Assembly.Load...
        "systemnet",        // System.Net.WebClient ...
        "createfile",       // createFile / createFileStream
        "deletedirectory",
        "deletefolder",
        "copyfile",
        "renamefile",
        "dotnetclass",
        "dotnetobject",
        "loadassembly",
        "setfileattribute",
    ];

    for token in dangerous_tokens {
        if stripped.contains(token) {
            return Err(format!("Security policy rejection: disallowed command token or sequence detected ('{}')", token));
        }
    }

    // Check raw lower for direct shell commands
    let raw_dangerous = [
        "doscommand",
        "hiddendoscommand",
        "python.execute",
        "shelllaunch",
        "deletefile",
        "resetmaxfile",
        "quitmax",
        "cmd.exe",
        "powershell.exe",
        "python.run",
        "filein",       // fileIn "x.ms" runs another script
        "execute(",     // MAXScript execute(<string>) = eval; note: "executeaction" is NOT matched
        "execute (",
        "execute \"",
    ];
    for token in raw_dangerous {
        if lower.contains(token) {
            return Err(format!("Security policy rejection: disallowed command token '{}'", token));
        }
    }

    // Hard size limit: a legitimate scene-editing snippet is short; huge payloads are almost always abuse.
    if script.len() > 20_000 {
        return Err("Security policy rejection: script too large (>20000 bytes)".to_string());
    }

    Ok(())
}

// NOTE: this is still a denylist. It reduces risk but cannot make free-form MAXScript safe.
// The durable fix is to expose structured, allowlisted tools (see PymxsTools.execute_tool) and make
// `execute_script` opt-in behind an explicit user approval.
#[cfg(test)]
mod script_safety_tests {
    use super::is_script_safe;

    #[test]
    fn allows_normal_scene_edits() {
        assert!(is_script_safe("b = box length:5 width:4 height:3 name:\"Wall_A\"\nmove b [0,0,1]").is_ok());
        assert!(is_script_safe("actionMan.executeAction 0 \"40021\"").is_ok()); // zoom extents must keep working
        assert!(is_script_safe("for o in selection do o.wirecolor = red").is_ok());
    }

    #[test]
    fn blocks_original_tokens() {
        for s in ["DOSCommand \"calc\"", "HiddenDOSCommand \"x\"", "python.execute \"print(1)\"",
                  "deleteFile \"a.txt\"", "resetMaxFile #noPrompt", "quitMax()", "ShellLaunch \"cmd.exe\" \"\""] {
            assert!(is_script_safe(s).is_err(), "should block: {s}");
        }
    }

    #[test]
    fn blocks_known_bypasses() {
        for s in [
            "python.run \"C:/x.py\"",
            "(dotnetclass \"System.IO.File\").Delete \"C:/a.txt\"",
            "f = createFile \"C:/a.ms\"",
            "fileIn \"C:/evil.ms\"",
            "execute (\"del\" + \"ete\" + \"File \\\"a\\\"\")",
            "execute \"messageBox 1\"",
            "dotnet.loadAssembly \"x.dll\"",
            "d = dotNetObject \"System.Net.WebClient\"",
        ] {
            assert!(is_script_safe(s).is_err(), "should block: {s}");
        }
    }

    #[test]
    fn blocks_oversized_scripts() {
        assert!(is_script_safe(&"a=1\n".repeat(10_000)).is_err());
    }
}

#[tauri::command]
pub async fn cua_dispatch_autodesk_command(
    software: String,
    action: String,
    script: String,
    params: Option<std::collections::HashMap<String, serde_json::Value>>,
    timeout_secs: Option<u64>,
) -> Result<AutodeskCommandResult, String> {
    is_script_safe(&script)?;

    let cmd_id = format!("cmd_{:x}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0));

    let item = AutodeskCommandItem {
        id: cmd_id.clone(),
        software: software.clone(),
        action: action.clone(),
        script: script.clone(),
        params,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        ttl_secs: 30,
    };

    // Push into queue
    {
        let queue = get_queue();
        let mut lock = queue.lock().map_err(|e| e.to_string())?;
        lock.push(item);
    }

    // Wait for result or timeout (default 10s)
    let max_wait = Duration::from_secs(timeout_secs.unwrap_or(10));
    let start = Instant::now();

    while start.elapsed() < max_wait {
        tokio::time::sleep(Duration::from_millis(150)).await;
        let results = get_results();
        let mut lock = results.lock().map_err(|e| e.to_string())?;
        if let Some(res) = lock.remove(&cmd_id) {
            return Ok(res);
        }
    }

    // Check whether the command was actually received/popped by 3ds Max or if it was never received
    let was_received = if let Ok(mut in_prog) = get_in_progress().lock() {
        in_prog.remove(&cmd_id)
    } else {
        false
    };

    // Purge timed-out command from queue immediately if it was never popped
    {
        let queue = get_queue();
        if let Ok(mut lock) = queue.lock() {
            if let Some(pos) = lock.iter().position(|c| c.id == cmd_id) {
                lock.remove(pos);
            }
        }
    }

    let timeout_val = timeout_secs.unwrap_or(10);
    let error_message = if was_received {
        format!(
            "Command was received by {} connector and execution started, but timed out after {}s (still executing inside {}).",
            software, timeout_val, software
        )
    } else {
        format!(
            "Command was not received by {} connector within {}s: connector is offline or not polling. Ensure {} is open and AnarchyConnector.ms is active.",
            software, timeout_val, software
        )
    };

    Ok(AutodeskCommandResult {
        id: cmd_id,
        success: false,
        output: None,
        error: Some(error_message),
    })
}

// Internal helper for HTTP server
pub fn pop_next_autodesk_command(software_filter: Option<String>) -> Option<AutodeskCommandItem> {
    let queue = get_queue();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let popped = if let Ok(mut lock) = queue.lock() {
        // 1. Purge expired commands
        lock.retain(|c| now.saturating_sub(c.created_at) < c.ttl_secs);

        // 2. Strict software routing: if software_filter is set, only pop matching software
        if let Some(sf) = software_filter {
            let pos = lock.iter().position(|c| c.software.eq_ignore_ascii_case(&sf));
            pos.map(|idx| lock.remove(idx))
        } else if !lock.is_empty() {
            Some(lock.remove(0))
        } else {
            None
        }
    } else {
        None
    };

    if let Some(ref cmd) = popped {
        if let Ok(mut in_prog) = get_in_progress().lock() {
            in_prog.insert(cmd.id.clone());
        }
    }

    popped
}

pub fn push_autodesk_command_result(res: AutodeskCommandResult) {
    if let Ok(mut in_prog) = get_in_progress().lock() {
        in_prog.remove(&res.id);
    }
    let results = get_results();
    if let Ok(mut lock) = results.lock() {
        lock.insert(res.id.clone(), res);
    }
}
