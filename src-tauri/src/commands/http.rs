use std::collections::HashMap;
use reqwest::multipart;
use base64::Engine as _;

#[tauri::command]
pub async fn http_post(
    url: String,
    headers: HashMap<String, String>,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut header_map = reqwest::header::HeaderMap::new();
    header_map.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    for (k, v) in &headers {
        if let (Ok(name), Ok(val)) = (
            reqwest::header::HeaderName::from_bytes(k.as_bytes()),
            reqwest::header::HeaderValue::from_str(v),
        ) {
            header_map.insert(name, val);
        }
    }
    let body_bytes = serde_json::to_vec(&body).map_err(|e| e.to_string())?;
    let resp = client
        .post(&url)
        .headers(header_map)
        .body(body_bytes)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status();
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(serde_json::to_string(&json).unwrap_or_else(|_| status.to_string()));
    }
    Ok(json)
}

#[tauri::command]
pub async fn http_get(
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
pub async fn analyze_floor_plan(image_base64: String) -> Result<String, String> {
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
