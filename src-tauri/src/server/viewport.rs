use std::sync::OnceLock;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub static VIEWPORT_TOKEN: OnceLock<String> = OnceLock::new();

#[derive(Clone, serde::Serialize)]
pub struct ExternalImagePayload {
    pub image: String,
    pub source: String,
}

#[derive(serde::Deserialize)]
pub struct UploadViewPayload {
    pub image: String,
    #[serde(default)]
    pub source: String,
}

pub async fn start_anarchy_viewport_server(app_handle: tauri::AppHandle) {
    // Generate token if not set
    let token = VIEWPORT_TOKEN.get_or_init(|| {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(123456789);
        let pid = std::process::id();
        format!("{:x}-{:x}", timestamp, pid)
    });

    // Write token to app data directory
    if let Ok(app_dir) = app_handle.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&app_dir);
        let token_path = app_dir.join(".token");
        let _ = std::fs::write(&token_path, token);
    }

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

            // Token authentication check
            let has_valid_token = headers.lines().any(|line| {
                if let Some((name, value)) = line.split_once(':') {
                    if name.trim().eq_ignore_ascii_case("x-anarchy-token") {
                        if let Some(expected) = VIEWPORT_TOKEN.get() {
                            return value.trim() == expected;
                        }
                    }
                }
                false
            });

            if !has_valid_token {
                eprintln!("[viewport-server] Unauthorized access attempt: missing or invalid token");
                let status = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":false,\"error\":\"Unauthorized\"}";
                let _ = socket.write_all(status.as_bytes()).await;
                return;
            }

            let is_upload_view = headers.starts_with("POST /upload-view ");
            let is_poll_command = headers.starts_with("GET /agent/poll-command");
            let is_command_result = headers.starts_with("POST /agent/command-result");
            let is_bim_metadata = headers.starts_with("POST /agent/bim-metadata");

            let status = if is_upload_view {
                match serde_json::from_str::<UploadViewPayload>(&body) {
                    Ok(payload) if payload.image.starts_with("data:image/") => {
                        let source = if payload.source.is_empty() { "3ds Max".to_string() } else { payload.source.clone() };
                        crate::commands::cua::record_autodesk_heartbeat(&source);
                        let _ = app.emit("anarchy://external-image", ExternalImagePayload {
                            image: payload.image,
                            source,
                        });
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":true}".to_string()
                    }
                    _ => "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":false}".to_string(),
                }
            } else if is_bim_metadata {
                crate::commands::cua::record_autodesk_heartbeat("3dsmax");
                match serde_json::from_str::<serde_json::Value>(&body) {
                    Ok(payload) => {
                        let _ = app.emit("anarchy://bim-metadata", payload);
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":true}".to_string()
                    }
                    Err(e) => format!("HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{{\"ok\":false,\"error\":\"{}\"}}", e),
                }
            } else if is_poll_command {
                let mut software_filter = None;
                if let Some(first_line) = headers.lines().next() {
                    if let Some(idx) = first_line.find("software=") {
                        let query_part = &first_line[idx + 9..];
                        let sf = query_part.split(|c: char| c == '&' || c == ' ' || c == '\r' || c == '\n').next().unwrap_or("");
                        if !sf.is_empty() {
                            software_filter = Some(sf.to_string());
                        }
                    }
                }
                if software_filter.is_none() {
                    for line in headers.lines() {
                        if let Some((k, v)) = line.split_once(':') {
                            if k.trim().eq_ignore_ascii_case("x-autodesk-software") {
                                software_filter = Some(v.trim().to_string());
                                break;
                            }
                        }
                    }
                }

                let sw_name = software_filter.clone().unwrap_or_else(|| "3dsmax".to_string());
                crate::commands::cua::record_autodesk_heartbeat(&sw_name);

                let cmd = crate::commands::cua::pop_next_autodesk_command(software_filter);
                let json_res = serde_json::json!({
                    "ok": true,
                    "command": cmd
                });
                format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}", json_res)
            } else if is_command_result {
                crate::commands::cua::record_autodesk_heartbeat("3dsmax");
                match serde_json::from_str::<crate::commands::cua::AutodeskCommandResult>(&body) {
                    Ok(res) => {
                        crate::commands::cua::push_autodesk_command_result(res);
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":true}".to_string()
                    }
                    Err(e) => format!("HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{{\"ok\":false,\"error\":\"{}\"}}", e),
                }
            } else {
                "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"ok\":false}".to_string()
            };

            let _ = socket.write_all(status.as_bytes()).await;
        });
    }
}
