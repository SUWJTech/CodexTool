use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkinEngineStatus {
    supported: bool,
    installed: bool,
    active: bool,
    active_theme_id: Option<String>,
    active_theme_name: Option<String>,
}

fn state_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .map(|path| path.join("CodexDreamSkin"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

fn read_status() -> SkinEngineStatus {
    let Some(root) = state_root() else {
        return SkinEngineStatus {
            supported: false,
            installed: false,
            active: false,
            active_theme_id: None,
            active_theme_name: None,
        };
    };

    let installed = root
        .join("engine")
        .join("scripts")
        .join("start-dream-skin.ps1")
        .is_file();
    let active = installed && root.join("state.json").is_file() && !root.join("paused").exists();
    let theme = fs::read_to_string(root.join("active-theme").join("theme.json"))
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());

    SkinEngineStatus {
        supported: true,
        installed,
        active,
        active_theme_id: theme
            .as_ref()
            .and_then(|value| value.get("id"))
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned),
        active_theme_name: theme
            .as_ref()
            .and_then(|value| value.get("name"))
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned),
    }
}

fn resource_root(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("resources")
                .join("dream-skin")
                .join("windows"),
        );
        candidates.push(resource_dir.join("dream-skin").join("windows"));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("dream-skin")
            .join("windows"),
    );

    candidates
        .into_iter()
        .find(|path| {
            path.join("scripts")
                .join("install-dream-skin.ps1")
                .is_file()
        })
        .ok_or_else(|| "内置 Dream Skin 运行资源缺失，请重新安装 CodexTool。".to_string())
}

pub(crate) fn ensure_skin_engine(app: &AppHandle) -> Result<SkinEngineStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let source = resource_root(app)?;
        let root = state_root().ok_or_else(|| "无法解析 Dream Skin 状态目录。".to_string())?;
        let source_version = fs::read_to_string(source.join("VERSION"))
            .map_err(|error| format!("读取内置 Dream Skin 版本失败: {error}"))?;
        let installed_version =
            fs::read_to_string(root.join("engine").join("VERSION")).unwrap_or_default();
        let marker = root.join(".codextool-engine-v2");
        if marker.is_file()
            && source_version.trim() == installed_version.trim()
            && read_status().installed
        {
            return Ok(read_status());
        }

        let script = source
            .join("scripts")
            .join("codextool-provision-engine.ps1");
        run_powershell(&script, &[])?;
        fs::write(&marker, source_version.trim())
            .map_err(|error| format!("写入 Dream Skin 预装标记失败: {error}"))?;
        let status = read_status();
        if !status.installed {
            return Err("Dream Skin 运行引擎预装完成后未通过完整性检查。".to_string());
        }
        Ok(status)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(read_status())
    }
}

fn validated_gallery_version_id(version_id: String) -> Result<String, String> {
    let version_id = version_id.trim();
    if !(12..=68).contains(&version_id.len())
        || !version_id.starts_with("ver_")
        || !version_id[4..]
            .chars()
            .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
    {
        return Err("DreamSkin 主题版本编号无效。".to_string());
    }
    Ok(version_id.to_string())
}

#[cfg(target_os = "windows")]
fn powershell_compatible_path(path: &Path) -> PathBuf {
    let raw = path.as_os_str().to_string_lossy();
    if let Some(rest) = raw.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{rest}"))
    } else if let Some(rest) = raw.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        path.to_path_buf()
    }
}

#[cfg(target_os = "windows")]
fn run_powershell(script: &Path, arguments: &[&str]) -> Result<String, String> {
    // Tauri may resolve packaged resources to a Win32 verbatim path (`\\?\D:\...`).
    // Windows PowerShell accepts it as `-File`, but then exposes the same value as
    // `$PSScriptRoot`; `Join-Path` treats that prefix as a PSDrive and fails. Pass a
    // regular drive/UNC path so bundled scripts can safely resolve sibling files.
    let script = powershell_compatible_path(script);
    let mut command = crate::utils::new_background_command("powershell.exe");
    command
        .arg("-NoProfile")
        .arg("-NonInteractive")
        .arg("-ExecutionPolicy")
        // Bundled scripts can retain a Mark-of-the-Web alternate data stream after
        // an installer or archive extraction. Process-scoped Bypass avoids changing
        // the user's policy while still allowing our signed-in-app action to run.
        .arg("Bypass")
        .arg("-File")
        .arg(&script);
    command.args(arguments);
    let output = command
        .output()
        .map_err(|error| format!("启动 Dream Skin 本地运行器失败: {error}"))?;
    let stdout = decode_powershell_output(&output.stdout);
    let stderr = decode_powershell_output(&output.stderr);
    if !output.status.success() {
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            format!("Dream Skin 本地运行器退出，状态码: {}", output.status)
        } else {
            detail
        });
    }
    Ok(stdout)
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::{powershell_compatible_path, validated_gallery_version_id};
    use std::path::Path;

    #[test]
    fn strips_verbatim_drive_prefix_for_windows_powershell() {
        assert_eq!(
            powershell_compatible_path(Path::new(r"\\?\D:\CodexTool\install.ps1")),
            Path::new(r"D:\CodexTool\install.ps1")
        );
    }

    #[test]
    fn converts_verbatim_unc_prefix_for_windows_powershell() {
        assert_eq!(
            powershell_compatible_path(Path::new(r"\\?\UNC\server\share\install.ps1")),
            Path::new(r"\\server\share\install.ps1")
        );
    }

    #[test]
    fn validates_official_gallery_version_id() {
        assert!(validated_gallery_version_id("ver_5c7f8023de2ee4b92776".into()).is_ok());
        assert!(validated_gallery_version_id("https://example.com".into()).is_err());
        assert!(validated_gallery_version_id("ver_UPPERCASE123".into()).is_err());
    }
}

#[cfg(target_os = "windows")]
fn decode_powershell_output(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    let looks_utf16 = bytes.starts_with(&[0xff, 0xfe])
        || bytes
            .chunks_exact(2)
            .take(24)
            .filter(|pair| pair[1] == 0)
            .count()
            > 8;
    if looks_utf16 {
        let start = usize::from(bytes.starts_with(&[0xff, 0xfe])) * 2;
        let units = bytes[start..]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16_lossy(&units).trim().to_string();
    }
    if let Ok(value) = std::str::from_utf8(bytes) {
        return value.trim().to_string();
    }
    let (decoded, _, _) = encoding_rs::GBK.decode(bytes);
    decoded.trim().to_string()
}

#[tauri::command]
pub(crate) fn get_skin_engine_status() -> SkinEngineStatus {
    read_status()
}

#[tauri::command]
pub(crate) async fn install_skin_engine(app: AppHandle) -> Result<SkinEngineStatus, String> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || ensure_skin_engine(&app))
            .await
            .map_err(|error| format!("Dream Skin 预装任务异常结束: {error}"))?
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前版本先支持 Windows 原生换肤；macOS 迁移尚未完成。".to_string())
    }
}

#[tauri::command]
pub(crate) async fn list_skin_gallery() -> Result<Value, String> {
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("初始化 DreamSkin 图库客户端失败: {error}"))?
        .get("https://api.dreamskin.cc/v1/themes?limit=48&offset=0&sort=recent")
        .send()
        .await
        .map_err(|error| format!("连接 DreamSkin 官方图库失败: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "DreamSkin 官方图库请求失败（HTTP {}）。",
            response.status().as_u16()
        ));
    }
    let mut payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("DreamSkin 官方图库返回了无法解析的数据: {error}"))?;
    let items = payload
        .get_mut("items")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "DreamSkin 官方图库响应缺少主题列表。".to_string())?;
    items.retain(|item| {
        item.get("applyCompatible").and_then(Value::as_bool) == Some(true)
            && item
                .pointer("/displayMeta/platforms")
                .and_then(Value::as_array)
                .is_some_and(|platforms| {
                    platforms
                        .iter()
                        .any(|value| value.as_str() == Some("windows"))
                })
    });
    let total = items.len();
    payload["total"] = Value::from(total);
    Ok(payload)
}

#[tauri::command]
pub(crate) async fn apply_gallery_skin(
    app: AppHandle,
    version_id: String,
) -> Result<SkinEngineStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let version_id = validated_gallery_version_id(version_id)?;
        ensure_skin_engine(&app)?;
        let script = state_root()
            .ok_or_else(|| "无法解析 Dream Skin 状态目录。".to_string())?
            .join("engine")
            .join("scripts")
            .join("apply-community-theme.ps1");
        let uri = format!("dreamskin://apply?version={version_id}");
        tauri::async_runtime::spawn_blocking(move || {
            run_powershell(&script, &[&uri, "-CodexToolSilent"])
        })
        .await
        .map_err(|error| format!("DreamSkin 官方主题应用任务异常结束: {error}"))??;
        Ok(read_status())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, version_id);
        Err("当前版本先支持 Windows 原生换肤；macOS 运行器仍在迁移。".to_string())
    }
}

#[tauri::command]
pub(crate) async fn apply_builtin_skin(
    app: AppHandle,
    theme_id: String,
) -> Result<SkinEngineStatus, String> {
    #[cfg(target_os = "windows")]
    {
        const TRUSTED_THEMES: &[&str] = &[
            "preset-gothic-void-crusade",
            "preset-aurora-observatory",
            "preset-crystal-horizon",
            "preset-rose-synthesis",
        ];
        if !TRUSTED_THEMES.contains(&theme_id.as_str()) {
            return Err("不受信任的内置皮肤标识。".to_string());
        }
        let status = read_status();
        if !status.installed {
            return Err("请先安装 Dream Skin 本地运行引擎。".to_string());
        }
        let bridge = resource_root(&app)?
            .join("scripts")
            .join("codextool-bridge.ps1");
        let start = state_root()
            .ok_or_else(|| "无法解析 Dream Skin 状态目录。".to_string())?
            .join("engine")
            .join("scripts")
            .join("start-dream-skin.ps1");
        tauri::async_runtime::spawn_blocking(move || {
            run_powershell(&bridge, &["-Action", "Apply", "-ThemeId", &theme_id])?;
            run_powershell(&start, &["-RestartExisting", "-RequireUnpaused"])?;
            Ok::<(), String>(())
        })
        .await
        .map_err(|error| format!("Dream Skin 应用任务异常结束: {error}"))??;
        Ok(read_status())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, theme_id);
        Err("当前版本先支持 Windows 原生换肤；macOS 迁移尚未完成。".to_string())
    }
}

#[tauri::command]
pub(crate) async fn restore_official_skin() -> Result<SkinEngineStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let restore = state_root()
            .ok_or_else(|| "无法解析 Dream Skin 状态目录。".to_string())?
            .join("engine")
            .join("scripts")
            .join("restore-dream-skin.ps1");
        if !restore.is_file() {
            return Err("Dream Skin 本地运行引擎尚未安装。".to_string());
        }
        tauri::async_runtime::spawn_blocking(move || {
            run_powershell(&restore, &["-RestoreBaseTheme", "-ForceRestart"])
        })
        .await
        .map_err(|error| format!("Dream Skin 恢复任务异常结束: {error}"))??;
        Ok(read_status())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("当前版本先支持 Windows 原生换肤；macOS 迁移尚未完成。".to_string())
    }
}
