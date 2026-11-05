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

// Node's entry-point resolution cannot handle Windows verbatim script paths.
fn process_path(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(unc) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{unc}"));
    }
    if let Some(disk) = text.strip_prefix(r"\\?\") {
        return PathBuf::from(disk);
    }
    path
}

#[tauri::command]
fn get_mcp_config(app: AppHandle) -> Result<serde_json::Value, String> {
    let executable = process_path(app.path().resource_dir().map_err(|error| error.to_string())?)
        .join("resources").join("node.exe");
    let script = executable.parent().ok_or("MCP 目录无效")?.join("mcp-server.mjs");
    if !executable.is_file() || !script.is_file() {
        return Err("未找到内置 MCP，请使用完整安装版或先构建 MCP 程序。".into());
    }
    let output = process_path(app.path().app_data_dir().map_err(|error| error.to_string())?).join("mcp-output");
    fs::create_dir_all(&output).map_err(|error| error.to_string())?;
    Ok(serde_json::json!({ "mcpServers": { "allright": {
        "command": executable.to_string_lossy(),
        "args": [script.to_string_lossy()],
        "env": { "ALLRIGHT_OUTPUT_DIR": output.to_string_lossy() }
    }}}))
}

fn mcp_output_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("mcp-output");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

/// 只认目录里的普通文件名：不许带路径分隔符，也不许往外跳。
fn mcp_output_path_in(base: &std::path::Path, name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || name.len() > 120
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
        || name.contains("..")
    {
        return Err("文件名不合法".into());
    }
    let path = base.join(name);
    if path.parent() != Some(base) {
        return Err("文件名不合法".into());
    }
    Ok(path)
}

fn mcp_output_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let base = mcp_output_dir(app)?;
    mcp_output_path_in(&base, name)
}

#[tauri::command]
fn list_mcp_outputs(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let directory = mcp_output_dir(&app)?;
    let mut files = Vec::new();
    let entries = fs::read_dir(&directory).map_err(|error| error.to_string())?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.to_lowercase().ends_with(".json") {
            continue;
        }
        let meta = entry.metadata().map_err(|error| error.to_string())?;
        if !meta.is_file() {
            continue;
        }
        let modified = meta
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|since| since.as_millis() as u64)
            .unwrap_or(0);
        files.push(serde_json::json!({
            "name": name,
            "bytes": meta.len(),
            "modifiedAt": modified,
        }));
    }
    files.sort_by(|a, b| {
        b.get("modifiedAt")
            .and_then(|v| v.as_u64())
            .unwrap_or(0)
            .cmp(&a.get("modifiedAt").and_then(|v| v.as_u64()).unwrap_or(0))
    });
    Ok(files)
}

#[tauri::command]
fn read_mcp_output(app: AppHandle, name: String) -> Result<String, String> {
    let path = mcp_output_path(&app, &name)?;
    fs::read_to_string(&path).map_err(|_| "找不到这个文件".to_string())
}

#[tauri::command]
async fn check_mcp(app: AppHandle) -> Result<String, String> {
    let directory = process_path(app.path().resource_dir().map_err(|e| e.to_string())?).join("resources");
    for name in ["node.exe", "mcp-server.mjs", "mcp-selftest.mjs"] {
        if !directory.join(name).is_file() { return Err(format!("安装资源缺失：{name}")); }
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut command = std::process::Command::new(directory.join("node.exe"));
        command.arg(directory.join("mcp-selftest.mjs")).arg(directory.join("mcp-server.mjs"));
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let output = command.output().map_err(|e| format!("MCP 启动失败：{e}"))?;
        if !output.status.success() { return Err(format!("MCP 协议自检失败：{}", String::from_utf8_lossy(&output.stderr))); }
        Ok("连接正常，四个 MCP 工具可用".to_string())
    }).await.map_err(|e| e.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            save_asset,
            read_asset,
            delete_assets,
            list_assets,
            get_mcp_config,
            list_mcp_outputs,
            read_mcp_output,
            check_mcp
        ])
        .run(tauri::generate_context!())
        .expect("无法启动 ALL RIGHT 全对");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_paths_remove_windows_verbatim_prefix() {
        assert_eq!(process_path(PathBuf::from(r"\\?\C:\中文 路径\mcp.mjs")), PathBuf::from(r"C:\中文 路径\mcp.mjs"));
        assert_eq!(process_path(PathBuf::from(r"\\?\UNC\server\share\mcp.mjs")), PathBuf::from(r"\\server\share\mcp.mjs"));
        assert_eq!(process_path(PathBuf::from(r"C:\normal\mcp.mjs")), PathBuf::from(r"C:\normal\mcp.mjs"));
    }

    #[cfg(windows)]
    #[test]
    fn bundled_node_selftest_accepts_normalized_resource_paths() {
        let resources = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
        let verbatim = resources.canonicalize().expect("built MCP resources");
        let directory = process_path(verbatim);
        let output = std::process::Command::new(directory.join("node.exe"))
            .arg(directory.join("mcp-selftest.mjs"))
            .arg(directory.join("mcp-server.mjs"))
            .output().expect("start bundled Node");
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        assert!(String::from_utf8_lossy(&output.stdout).contains("four tools verified"));
    }

    #[test]
    fn mcp_output_path_stays_inside_the_output_directory() {
        let base = std::path::Path::new("/tmp/mcp-output");
        assert!(mcp_output_path_in(base, "通信试卷.json").is_ok());
        assert!(mcp_output_path_in(base, "bank.json").is_ok());
        for name in [
            "",
            "../x.json",
            "..\\x.json",
            "sub/x.json",
            "sub\\x.json",
            "a/../../b.json",
            "..",
        ] {
            assert!(
                mcp_output_path_in(base, name).is_err(),
                "文件名不该被放行：{name}"
            );
        }
    }

    #[test]
    fn asset_ids_must_be_content_hashes() {
        assert!(is_asset_id(&"a".repeat(64)));
        assert!(!is_asset_id(&"A".repeat(64)));
        assert!(!is_asset_id("short"));
        assert!(!is_asset_id(&format!("{}/x", "a".repeat(63))));
    }
}
