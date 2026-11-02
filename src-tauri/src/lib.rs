use std::{fs, io::ErrorKind, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

fn workspace_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("workspace.json"))
        .map_err(|error| error.to_string())
}

fn assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("assets"))
        .map_err(|error| error.to_string())
}

fn validate_workspace(data: &str) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(data).map_err(|error| error.to_string())?;
    let version = value.get("version").and_then(|version| version.as_u64());
    if !matches!(version, Some(1) | Some(2))
        || !value.get("banks").is_some_and(|banks| banks.is_array())
    {
        return Err("工作区格式不正确".into());
    }
    Ok(())
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Option<String>, String> {
    match fs::read_to_string(workspace_path(&app)?) {
        Ok(data) => {
            validate_workspace(&data)?;
            Ok(Some(data))
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_workspace(app: AppHandle, data: String, lock: State<'_, Mutex<()>>) -> Result<(), String> {
    validate_workspace(&data)?;
    let _guard = lock.lock().map_err(|error| error.to_string())?;
    let path = workspace_path(&app)?;
    let directory = path.parent().ok_or("无法确定数据目录")?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, data).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())
}

/// 资源 ID 只能是内容哈希：它会变成文件名，得防着路径穿越。
fn is_asset_id(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn base64_decode(input: &str) -> Option<Vec<u8>> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut lookup = [255u8; 256];
    for (index, &byte) in TABLE.iter().enumerate() {
        lookup[byte as usize] = index as u8;
    }
    let mut out: Vec<u8> = Vec::with_capacity(input.len() / 4 * 3);
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;
    for &byte in input.as_bytes() {
        if byte == b'=' {
            break;
        }
        let value = lookup[byte as usize];
        if value == 255 {
            return None;
        }
        buffer = (buffer << 6) | value as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
        }
    }
    Some(out)
}

/// 看真实字节认图片类型，不认扩展名也不认清单里写的 MIME。
fn sniff_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() >= 8
        && bytes[..8] == [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    {
        return Some("image/png");
    }
    if bytes.len() >= 3 && bytes[..3] == [0xff, 0xd8, 0xff] {
        return Some("image/jpeg");
    }
    if bytes.len() >= 12 && bytes[..4] == *b"RIFF" && bytes[8..12] == *b"WEBP" {
        return Some("image/webp");
    }
    None
}

fn normalize_mime(mime: &str) -> String {
    let lower = mime.trim().to_ascii_lowercase();
    match lower.as_str() {
        "image/jpg" | "image/pjpeg" => "image/jpeg".to_string(),
        "image/x-png" => "image/png".to_string(),
        _ => lower,
    }
}

#[tauri::command]
fn save_asset(app: AppHandle, id: String, data: String, mime: String) -> Result<(), String> {
    if !is_asset_id(&id) {
        return Err("资源 ID 不合法".into());
    }
    let bytes = base64_decode(&data).ok_or("图片数据不是合法的 base64")?;
    let sniffed = sniff_image_mime(&bytes).ok_or("只认 PNG、JPEG、WebP 三种图片格式")?;
    let declared = normalize_mime(&mime);
    if !declared.is_empty() && declared != sniffed {
        return Err(format!("文件类型对不上：写的是 {declared}，实际是 {sniffed}。"));
    }
    let directory = assets_dir(&app)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(&id);
    let temporary = directory.join(format!("{id}.tmp"));
    fs::write(&temporary, &bytes).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_asset(app: AppHandle, id: String) -> Result<tauri::ipc::Response, String> {
    if !is_asset_id(&id) {
        return Err("资源 ID 不合法".into());
    }
    let bytes = fs::read(assets_dir(&app)?.join(&id)).map_err(|_| "找不到这张图片".to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn delete_assets(app: AppHandle, ids: Vec<String>) -> Result<(), String> {
    let directory = assets_dir(&app)?;
    for id in ids {
        if !is_asset_id(&id) {
            continue;
        }
        let _ = fs::remove_file(directory.join(&id));
    }
    Ok(())
}

#[tauri::command]
fn list_assets(app: AppHandle) -> Result<Vec<String>, String> {
    let directory = assets_dir(&app)?;
    let mut ids = Vec::new();
    if let Ok(entries) = fs::read_dir(&directory) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if is_asset_id(&name) {
                ids.push(name);
            }
        }
    }
    Ok(ids)
}

pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            save_asset,
            read_asset,
            delete_assets,
            list_assets
        ])
        .run(tauri::generate_context!())
        .expect("无法启动 ALL RIGHT 全对");
}
