use std::{fs, io::ErrorKind, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

fn workspace_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("workspace.json"))
        .map_err(|error| error.to_string())
}

fn validate_workspace(data: &str) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(data).map_err(|error| error.to_string())?;
    if value.get("version").and_then(|version| version.as_u64()) != Some(1)
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

pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![load_workspace, save_workspace])
        .run(tauri::generate_context!())
        .expect("无法启动 ALL RIGHT 全对");
}
