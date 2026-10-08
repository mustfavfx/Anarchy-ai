use reqwest::multipart;
use base64::Engine as _;
use super::fs::is_path_safe;

/// Download an image from URL and return as base64 data URI
#[tauri::command]
pub async fn url_to_base64(url: String) -> Result<String, String> {
    if url.starts_with("data:") {
        return Ok(url);
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e: reqwest::Error| e.to_string())?;

    let mut req = client
        .get(&url)
        .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

    if url.contains("discordapp") || url.contains("discord.com") {
        req = req.header("Referer", "https://discord.com/");
    }

    let resp = req
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

    // Determine mime type (support images and videos)
    let mime = if content_type.contains("png") {
        "image/png"
    } else if content_type.contains("webp") {
        "image/webp"
    } else if content_type.contains("gif") {
        "image/gif"
    } else if content_type.contains("mp4") || content_type.contains("video/mp4") {
        "video/mp4"
    } else if content_type.contains("webm") || content_type.contains("video/webm") {
        "video/webm"
    } else if content_type.contains("quicktime") || content_type.contains("video/mov") {
        "video/mp4"
    } else if content_type.contains("video/") {
        // Generic video fallback
        "video/mp4"
    } else {
        "image/jpeg"
    };

    let data_uri = format!("data:{};base64,{}", mime, b64);
    Ok(data_uri)
}

/// Upload image to Replicate Files API and return serving URL
/// Accepts base64 string (not bytes) to avoid huge IPC serialization overhead
#[tauri::command]
pub async fn upload_to_replicate(
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
pub async fn upload_image(
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
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e: reqwest::Error| e.to_string())?;

    // Try catbox.moe first (ultra-fast, rock solid, no API key needed, returns direct HTTPS URL)
    let part_cb = multipart::Part::bytes(bytes.clone())
        .file_name(format!("image.{}", ext))
        .mime_str(mime)
        .map_err(|e: reqwest::Error| e.to_string())?;

    let form_cb = multipart::Form::new()
        .text("reqtype", "fileupload")
        .part("fileToUpload", part_cb);

    let resp_cb = client
        .post("https://catbox.moe/user/api.php")
        .multipart(form_cb)
        .send()
        .await;

    if let Ok(resp) = resp_cb {
        let status = resp.status();
        if let Ok(body_text) = resp.text().await {
            let url = body_text.trim().to_string();
            if status.is_success() && url.starts_with("https://") {
                return Ok(url);
            }
        }
    }

    // Fallback: 0x0.st
    let part_0x0 = multipart::Part::bytes(bytes)
        .file_name(format!("image.{}", ext))
        .mime_str(mime)
        .map_err(|e: reqwest::Error| e.to_string())?;

    let form_0x0 = multipart::Form::new().part("file", part_0x0);

    let resp_0x0 = client
        .post("https://0x0.st")
        .multipart(form_0x0)
        .send()
        .await
        .map_err(|e: reqwest::Error| format!("Upload failed: {}", e))?;

    let status = resp_0x0.status();
    let body_text = resp_0x0.text().await.map_err(|e: reqwest::Error| e.to_string())?;

    if !status.is_success() {
        return Err(format!("Upload error {}: {}", status, body_text));
    }

    let url = body_text.trim().to_string();
    if !url.starts_with("https://") {
        return Err(format!("Invalid upload response: {}", body_text));
    }

    Ok(url)
}

#[tauri::command]
pub async fn save_image_to_documents(data_uri: String, file_name: String) -> Result<String, String> {
    // Validate file_name to prevent path traversal
    let file_path = std::path::Path::new(&file_name);
    if file_name.contains("..") || file_name.contains('/') || file_name.contains('\\') || (file_path.parent().is_some() && file_path.parent().unwrap() != std::path::Path::new("")) {
        return Err("Invalid file name. Directory traversal is not allowed.".to_string());
    }

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
pub async fn save_image_to_path(path: String, data_uri: String) -> Result<(), String> {
    let b64 = data_uri
        .splitn(2, ',')
        .nth(1)
        .ok_or("Invalid data URI")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Write error: {}", e))
}

/// Read an image from the Windows clipboard and return it as a base64 PNG data URI
#[tauri::command]
pub fn read_clipboard_image() -> Result<String, String> {
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
            let fmt: u32;
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
                            return Ok(format!("data:image/png;base64,{}", b64));
                        }
                        // PNG bytes invalid, fall through to try other formats
                        if !has_dibv5 && !has_dib && !has_bitmap {
                            return Err("PNG in clipboard but invalid data".to_string());
                        }
                        // Re-open clipboard to try other formats
                        if OpenClipboard(std::ptr::null_mut()) == 0 {
                            return Err("Failed to re-open clipboard".to_string());
                        }
                    }
                }
            }

            // Try DIB / DIBv5 -> BMP -> PNG via `image` crate
            let dib_format = if has_dibv5 { CF_DIBV5 } else { CF_DIB };
            let handle = GetClipboardData(dib_format);
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

            // Construct BMP header: 14-byte BM file header + DIB data
            // BMP Header: 'BM' (2 bytes) + file size (4) + reserved (4) + pixel data offset (4)
            if dib_bytes.len() < 40 {
                return Err("Invalid DIB data".to_string());
            }

            // Read header size to determine offset
            let bi_size = u32::from_le_bytes([dib_bytes[0], dib_bytes[1], dib_bytes[2], dib_bytes[3]]) as usize;
            let bi_bit_count = u16::from_le_bytes([dib_bytes[14], dib_bytes[15]]);
            let bi_compression = u32::from_le_bytes([dib_bytes[16], dib_bytes[17], dib_bytes[18], dib_bytes[19]]);
            let bi_clr_used = u32::from_le_bytes([dib_bytes[32], dib_bytes[33], dib_bytes[34], dib_bytes[35]]) as usize;

            let color_table_size = if bi_clr_used > 0 {
                bi_clr_used * 4
            } else if bi_bit_count <= 8 {
                (1usize << bi_bit_count) * 4
            } else if bi_compression == 3 {
                // BI_BITFIELDS has 3 DWORD masks
                12
            } else {
                0
            };

            let pixel_offset = 14 + bi_size + color_table_size;
            let total_file_size = 14 + dib_bytes.len();

            let mut bmp = Vec::with_capacity(total_file_size);
            bmp.extend_from_slice(b"BM");
            bmp.extend_from_slice(&(total_file_size as u32).to_le_bytes());
            bmp.extend_from_slice(&[0u8; 4]); // reserved
            bmp.extend_from_slice(&(pixel_offset as u32).to_le_bytes());
            bmp.extend_from_slice(&dib_bytes);

            // Decode BMP using `image` crate and re-encode to PNG
            let img = image::load_from_memory_with_format(&bmp, image::ImageFormat::Bmp)
                .map_err(|e| format!("Failed to parse BMP: {}", e))?;

            let mut png_bytes = std::io::Cursor::new(Vec::new());
            img.write_to(&mut png_bytes, image::ImageFormat::Png)
                .map_err(|e| format!("Failed to encode PNG: {}", e))?;

            let b64 = base64::engine::general_purpose::STANDARD.encode(png_bytes.into_inner());
            Ok(format!("data:image/png;base64,{}", b64))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Clipboard image reading is currently only supported on Windows".to_string())
    }
}

/// Read a local image file from disk and return it as a base64 data URI
#[tauri::command]
pub async fn read_local_image(path: String) -> Result<String, String> {
    is_path_safe(&path)?;
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
pub async fn show_in_explorer(path: String) -> Result<(), String> {
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
pub async fn open_images_folder() -> Result<(), String> {
    let docs = dirs::document_dir()
        .ok_or("Cannot locate Documents folder")?;
    let save_dir = docs.join("Anarchy AI");
    std::fs::create_dir_all(&save_dir)
        .map_err(|e| format!("Cannot create folder: {}", e))?;
    open::that(&save_dir).map_err(|e| format!("Failed to open folder: {}", e))
}
