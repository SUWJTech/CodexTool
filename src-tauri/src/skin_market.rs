use std::fs;
use std::path::{Path, PathBuf};

#[cfg(target_os = "macos")]
use futures_util::StreamExt;
#[cfg(target_os = "macos")]
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
#[cfg(target_os = "macos")]
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

#[cfg(target_os = "macos")]
const MACOS_ENGINE_REVISION: &str = "e0341de41e3a4490194bf1fa3e7f3735ed6103df";
#[cfg(target_os = "macos")]
const MAX_COMMUNITY_METADATA_BYTES: usize = 64 * 1024;
#[cfg(target_os = "macos")]
const MAX_COMMUNITY_PACKAGE_BYTES: usize = 32 * 1024 * 1024;

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
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|path| {
            path.join("Library")
                .join("Application Support")
                .join("CodexDreamSkinStudio")
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        None
    }
}

#[cfg(target_os = "macos")]
fn macos_engine_root() -> Option<PathBuf> {
    // Keep CodexTool's pinned runtime separate from the standalone Dream Skin
    // app so neither product can silently downgrade or overwrite the other.
    dirs::home_dir().map(|path| path.join(".codex").join("codextool-dream-skin-runtime"))
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

    #[cfg(target_os = "windows")]
    let installed = root
        .join("engine")
        .join("scripts")
        .join("start-dream-skin.ps1")
        .is_file();
    #[cfg(target_os = "macos")]
    let installed = macos_engine_root().is_some_and(|path| {
        path.join("scripts")
            .join("start-dream-skin-macos.sh")
            .is_file()
    });
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let installed = false;

    #[cfg(target_os = "windows")]
    let active = installed && root.join("state.json").is_file() && !root.join("paused").exists();
    #[cfg(target_os = "macos")]
    let active = installed
        && fs::read_to_string(root.join("state.json"))
            .ok()
            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
            .and_then(|value| {
                value
                    .get("session")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            })
            .as_deref()
            == Some("active");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let active = false;

    #[cfg(target_os = "windows")]
    let theme_path = root.join("active-theme").join("theme.json");
    #[cfg(target_os = "macos")]
    let theme_path = root.join("theme").join("theme.json");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let theme_path = root.join("theme.json");
    let theme = fs::read_to_string(theme_path)
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
    #[cfg(target_os = "windows")]
    let platform = "windows";
    #[cfg(target_os = "macos")]
    let platform = "macos";
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    return Err("当前平台不支持 Dream Skin。".to_string());

    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("resources")
                .join("dream-skin")
                .join(platform),
        );
        candidates.push(resource_dir.join("dream-skin").join(platform));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("dream-skin")
            .join(platform),
    );

    candidates
        .into_iter()
        .find(|path| {
            #[cfg(target_os = "windows")]
            let entry = "install-dream-skin.ps1";
            #[cfg(target_os = "macos")]
            let entry = "start-dream-skin-macos.sh";
            path.join("scripts").join(entry).is_file()
        })
        .ok_or_else(|| "内置 Dream Skin 运行资源缺失，请重新安装 CodexTool。".to_string())
}

#[cfg(target_os = "macos")]
fn run_macos_script(script: &Path, arguments: &[&str]) -> Result<String, String> {
    let mut command = crate::utils::new_background_command("/bin/bash");
    command.arg(script).args(arguments);
    let output = command
        .output()
        .map_err(|error| format!("启动 Dream Skin macOS 运行器失败: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            format!("Dream Skin macOS 运行器退出，状态码: {}", output.status)
        } else {
            detail
        });
    }
    Ok(stdout)
}

#[cfg(target_os = "macos")]
fn provision_macos_engine(source: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let install_root = macos_engine_root().ok_or_else(|| "无法解析用户主目录。".to_string())?;
    let install_parent = install_root
        .parent()
        .ok_or_else(|| "Dream Skin 引擎安装目录无效。".to_string())?;
    fs::create_dir_all(install_parent)
        .map_err(|error| format!("创建 Dream Skin 引擎目录失败: {error}"))?;

    if fs::symlink_metadata(&install_root).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err("Dream Skin 引擎目录不能是符号链接。".to_string());
    }

    let operation_id = uuid::Uuid::new_v4().simple().to_string();
    let staging = install_parent.join(format!(".codex-dream-skin-staging-{operation_id}"));
    let previous = install_parent.join(format!(".codex-dream-skin-previous-{operation_id}"));
    fs::create_dir(&staging)
        .map_err(|error| format!("创建 Dream Skin 临时安装目录失败: {error}"))?;
    fs::set_permissions(&staging, fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("保护 Dream Skin 临时安装目录失败: {error}"))?;

    let source_arg = format!("{}/", source.display());
    let staging_arg = format!("{}/", staging.display());
    let output = crate::utils::new_background_command("/usr/bin/rsync")
        .arg("-a")
        .arg("--exclude")
        .arg("menubar-app/")
        .arg(source_arg)
        .arg(staging_arg)
        .output()
        .map_err(|error| format!("复制 Dream Skin macOS 引擎失败: {error}"))?;
    if !output.status.success() {
        let _ = fs::remove_dir_all(&staging);
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("复制 Dream Skin macOS 引擎失败: {}", output.status)
        } else {
            detail
        });
    }

    let start_script = staging.join("scripts").join("start-dream-skin-macos.sh");
    let revision_file = staging.join("UPSTREAM_COMMIT");
    if !start_script.is_file()
        || fs::read_to_string(&revision_file)
            .ok()
            .map_or(true, |value| value.trim() != MACOS_ENGINE_REVISION)
    {
        let _ = fs::remove_dir_all(&staging);
        return Err("Dream Skin macOS 引擎复制后未通过完整性检查。".to_string());
    }

    if install_root.exists() {
        if !install_root.is_dir() {
            let _ = fs::remove_dir_all(&staging);
            return Err("Dream Skin 引擎安装位置被非目录文件占用。".to_string());
        }
        fs::rename(&install_root, &previous)
            .map_err(|error| format!("备份现有 Dream Skin 引擎失败: {error}"))?;
    }
    if let Err(error) = fs::rename(&staging, &install_root) {
        if previous.exists() {
            let _ = fs::rename(&previous, &install_root);
        }
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("发布 Dream Skin macOS 引擎失败: {error}"));
    }
    if previous.exists() {
        let _ = fs::remove_dir_all(previous);
    }
    run_macos_script(
        &install_root
            .join("scripts")
            .join("codextool-seed-presets-macos.sh"),
        &[],
    )?;
    Ok(())
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
        #[cfg(target_os = "macos")]
        {
            let source = resource_root(app)?;
            let installed = macos_engine_root()
                .and_then(|root| fs::read_to_string(root.join("UPSTREAM_COMMIT")).ok())
                .is_some_and(|revision| revision.trim() == MACOS_ENGINE_REVISION);
            if !installed || !read_status().installed {
                provision_macos_engine(&source)?;
            }
            let status = read_status();
            if !status.installed {
                return Err("Dream Skin macOS 引擎部署后未通过完整性检查。".to_string());
            }
            Ok(status)
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = app;
            Ok(read_status())
        }
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

#[cfg(target_os = "macos")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommunityThemeMetadata {
    id: String,
    theme_id: String,
    name: String,
    version: String,
    author_display_name: String,
    license: String,
    package_sha256: String,
    package_bytes: u64,
    apply_compatible: bool,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MacosThemeImportResult {
    status: String,
    id: String,
    safe_css_status: String,
    content_fingerprint: Option<String>,
}

#[cfg(target_os = "macos")]
fn safe_community_display_text(value: &str, maximum: usize) -> bool {
    let scalar_count = value.chars().count();
    scalar_count > 0
        && scalar_count <= maximum
        && value.trim() == value
        && !value.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '\u{061c}'
                        | '\u{200e}'
                        | '\u{200f}'
                        | '\u{2028}'..='\u{202e}'
                        | '\u{2066}'..='\u{2069}'
                )
        })
}

#[cfg(target_os = "macos")]
fn valid_semantic_version(value: &str) -> bool {
    let parts = value.split('.').collect::<Vec<_>>();
    parts.len() == 3
        && parts.iter().all(|part| {
            !part.is_empty()
                && part.chars().all(|character| character.is_ascii_digit())
                && (*part == "0" || !part.starts_with('0'))
        })
}

#[cfg(target_os = "macos")]
fn validate_community_metadata(
    metadata: CommunityThemeMetadata,
    expected_version_id: &str,
) -> Result<CommunityThemeMetadata, String> {
    if metadata.id != expected_version_id {
        return Err("DreamSkin 服务端返回的主题版本与请求不一致。".to_string());
    }
    if !safe_community_display_text(&metadata.theme_id, 80)
        || !safe_community_display_text(&metadata.name, 120)
        || !safe_community_display_text(&metadata.author_display_name, 120)
        || !safe_community_display_text(&metadata.license, 80)
        || metadata.version.len() > 32
        || !valid_semantic_version(&metadata.version)
    {
        return Err("DreamSkin 主题元数据不符合客户端安全规则。".to_string());
    }
    if metadata.package_sha256.len() != 64
        || !metadata
            .package_sha256
            .chars()
            .all(|character| character.is_ascii_digit() || ('a'..='f').contains(&character))
        || metadata.package_bytes == 0
        || metadata.package_bytes as usize > MAX_COMMUNITY_PACKAGE_BYTES
    {
        return Err("DreamSkin 主题包大小或 SHA-256 标识无效。".to_string());
    }
    if !metadata.apply_compatible {
        return Err("该主题是旧格式，只能预览，不能一键换肤。".to_string());
    }
    Ok(metadata)
}

#[cfg(target_os = "macos")]
fn official_skin_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(60))
        .no_gzip()
        .user_agent(format!("CodexTool/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| format!("初始化 DreamSkin 官方客户端失败: {error}"))
}

#[cfg(target_os = "macos")]
async fn read_bounded_official_response(
    response: reqwest::Response,
    expected_url: &str,
    expected_media_type: &str,
    maximum_bytes: usize,
) -> Result<Vec<u8>, String> {
    if response.status() != reqwest::StatusCode::OK || response.url().as_str() != expected_url {
        return Err("DreamSkin 官方 API 返回了异常状态或重定向。".to_string());
    }
    let media_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .map(str::trim)
        .unwrap_or_default();
    if !media_type.eq_ignore_ascii_case(expected_media_type) {
        return Err("DreamSkin 官方 API 返回了意外的内容类型。".to_string());
    }
    if response
        .content_length()
        .is_some_and(|length| length > maximum_bytes as u64)
    {
        return Err("DreamSkin 官方 API 返回内容超过安全上限。".to_string());
    }

    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("读取 DreamSkin 官方响应失败: {error}"))?;
        if chunk.len() > maximum_bytes.saturating_sub(bytes.len()) {
            return Err("DreamSkin 官方 API 返回内容超过安全上限。".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.is_empty() {
        return Err("DreamSkin 官方 API 返回了空内容。".to_string());
    }
    Ok(bytes)
}

#[cfg(target_os = "macos")]
async fn download_macos_community_theme(
    version_id: &str,
) -> Result<(CommunityThemeMetadata, Vec<u8>), String> {
    let client = official_skin_client()?;
    let metadata_url = format!("https://api.dreamskin.cc/v1/themes/{version_id}");
    let metadata_response = client
        .get(&metadata_url)
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::ACCEPT_ENCODING, "identity")
        .send()
        .await
        .map_err(|error| format!("读取 DreamSkin 主题元数据失败: {error}"))?;
    let metadata_bytes = read_bounded_official_response(
        metadata_response,
        &metadata_url,
        "application/json",
        MAX_COMMUNITY_METADATA_BYTES,
    )
    .await?;
    let metadata = serde_json::from_slice::<CommunityThemeMetadata>(&metadata_bytes)
        .map_err(|error| format!("DreamSkin 主题元数据无法解析: {error}"))?;
    let metadata = validate_community_metadata(metadata, version_id)?;

    let download_url = format!("https://api.dreamskin.cc/v1/themes/{version_id}/download");
    let package_response = client
        .get(&download_url)
        .header(reqwest::header::ACCEPT, "application/zip")
        .header(reqwest::header::ACCEPT_ENCODING, "identity")
        .send()
        .await
        .map_err(|error| format!("下载 DreamSkin 主题包失败: {error}"))?;
    if package_response
        .content_length()
        .is_some_and(|length| length != metadata.package_bytes)
    {
        return Err("DreamSkin 主题包字节数与审核元数据不一致。".to_string());
    }
    let package = read_bounded_official_response(
        package_response,
        &download_url,
        "application/zip",
        metadata.package_bytes as usize,
    )
    .await?;
    if package.len() as u64 != metadata.package_bytes {
        return Err("DreamSkin 主题包实际字节数与审核元数据不一致。".to_string());
    }
    let actual_sha256 = format!("{:x}", Sha256::digest(&package));
    if actual_sha256 != metadata.package_sha256 {
        return Err("DreamSkin 主题包 SHA-256 校验失败。".to_string());
    }
    Ok((metadata, package))
}

#[cfg(target_os = "macos")]
fn macos_installed_script(name: &str) -> Result<PathBuf, String> {
    let script = macos_engine_root()
        .ok_or_else(|| "无法解析 Dream Skin macOS 引擎目录。".to_string())?
        .join("scripts")
        .join(name);
    if !script.is_file() {
        return Err("Dream Skin macOS 引擎尚未安装或文件不完整。".to_string());
    }
    Ok(script)
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

#[cfg(all(test, target_os = "macos"))]
mod macos_tests {
    use super::{
        safe_community_display_text, valid_semantic_version, validate_community_metadata,
        validated_gallery_version_id, CommunityThemeMetadata,
    };

    fn valid_metadata() -> CommunityThemeMetadata {
        CommunityThemeMetadata {
            id: "ver_5c7f8023de2ee4b92776".to_string(),
            theme_id: "sample-theme".to_string(),
            name: "Sample Theme".to_string(),
            version: "1.0.0".to_string(),
            author_display_name: "DreamSkin Author".to_string(),
            license: "MIT".to_string(),
            package_sha256: "a".repeat(64),
            package_bytes: 1024,
            apply_compatible: true,
        }
    }

    #[test]
    fn validates_gallery_ids_and_reviewed_metadata() {
        let version_id = "ver_5c7f8023de2ee4b92776";
        assert!(validated_gallery_version_id(version_id.to_string()).is_ok());
        assert!(validate_community_metadata(valid_metadata(), version_id).is_ok());
        assert!(validated_gallery_version_id("https://example.com".to_string()).is_err());
    }

    #[test]
    fn rejects_unsafe_or_incompatible_community_metadata() {
        assert!(!safe_community_display_text("unsafe\u{202e}name", 120));
        assert!(valid_semantic_version("1.5.16"));
        assert!(!valid_semantic_version("01.5.16"));

        let mut metadata = valid_metadata();
        metadata.apply_compatible = false;
        assert!(validate_community_metadata(metadata, "ver_5c7f8023de2ee4b92776").is_err());
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
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        tauri::async_runtime::spawn_blocking(move || ensure_skin_engine(&app))
            .await
            .map_err(|error| format!("Dream Skin 预装任务异常结束: {error}"))?
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = app;
        Err("当前平台暂不支持原生换肤。".to_string())
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
    #[cfg(target_os = "windows")]
    let platform = "windows";
    #[cfg(target_os = "macos")]
    let platform = "macos";
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let platform = "unsupported";
    items.retain(|item| {
        item.get("applyCompatible").and_then(Value::as_bool) == Some(true)
            && item
                .pointer("/displayMeta/platforms")
                .and_then(Value::as_array)
                .is_some_and(|platforms| {
                    platforms
                        .iter()
                        .any(|value| value.as_str() == Some(platform))
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
    #[cfg(target_os = "macos")]
    {
        use std::os::unix::fs::PermissionsExt;

        let version_id = validated_gallery_version_id(version_id)?;
        let setup_app = app.clone();
        tauri::async_runtime::spawn_blocking(move || ensure_skin_engine(&setup_app))
            .await
            .map_err(|error| format!("DreamSkin macOS 引擎部署任务异常结束: {error}"))??;
        let baseline = read_status();
        let (metadata, package) = download_macos_community_theme(&version_id).await?;
        let state = state_root().ok_or_else(|| "无法解析 Dream Skin 状态目录。".to_string())?;
        fs::create_dir_all(&state)
            .map_err(|error| format!("创建 Dream Skin 状态目录失败: {error}"))?;
        let transaction_root = state.join(format!(
            ".community-apply-{}",
            uuid::Uuid::new_v4().simple()
        ));
        fs::create_dir(&transaction_root)
            .map_err(|error| format!("创建 DreamSkin 换肤事务目录失败: {error}"))?;
        fs::set_permissions(&transaction_root, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("保护 DreamSkin 换肤事务目录失败: {error}"))?;
        let archive = transaction_root.join("theme.zip");
        fs::write(&archive, package)
            .map_err(|error| format!("保存 DreamSkin 主题包失败: {error}"))?;
        fs::set_permissions(&archive, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("保护 DreamSkin 主题包失败: {error}"))?;

        let baseline_theme_id = baseline
            .active
            .then_some(baseline.active_theme_id)
            .flatten();
        let package_sha256 = metadata.package_sha256;
        let package_bytes = metadata.package_bytes.to_string();
        let operation_root = transaction_root.clone();
        let operation = tauri::async_runtime::spawn_blocking(move || {
            let import = macos_installed_script("import-theme-zip-macos.sh")?;
            let archive_arg = archive.to_string_lossy().to_string();
            let import_output = run_macos_script(
                &import,
                &[
                    "--file",
                    &archive_arg,
                    "--expected-sha256",
                    &package_sha256,
                    "--expected-bytes",
                    &package_bytes,
                ],
            )?;
            let imported = serde_json::from_str::<MacosThemeImportResult>(&import_output)
                .map_err(|error| format!("DreamSkin 导入结果无法解析: {error}"))?;
            if !matches!(imported.status.as_str(), "imported" | "duplicate")
                || imported.safe_css_status != "validated"
            {
                return Err("DreamSkin 主题未通过 Safe CSS 导入校验。".to_string());
            }
            let fingerprint = imported
                .content_fingerprint
                .ok_or_else(|| "DreamSkin 导入结果缺少经过校验的内容指纹。".to_string())?;
            if fingerprint.len() != 64
                || !fingerprint
                    .chars()
                    .all(|character| character.is_ascii_digit() || ('a'..='f').contains(&character))
            {
                return Err("DreamSkin 导入结果包含无效内容指纹。".to_string());
            }

            if let Some(baseline_theme_id) = baseline_theme_id {
                let apply = macos_installed_script("apply-community-theme-macos.sh")?;
                let operation_root_arg = operation_root.to_string_lossy().to_string();
                run_macos_script(
                    &apply,
                    &[
                        "--id",
                        &imported.id,
                        "--expect-fingerprint",
                        &fingerprint,
                        "--expect-active-id",
                        &baseline_theme_id,
                        "--transaction-root",
                        &operation_root_arg,
                    ],
                )?;
            } else {
                let switch = macos_installed_script("switch-theme-macos.sh")?;
                if let Err(apply_error) = run_macos_script(
                    &switch,
                    &["--id", &imported.id, "--expect-fingerprint", &fingerprint],
                ) {
                    let restore = macos_installed_script("restore-dream-skin-macos.sh")?;
                    let restore_result =
                        run_macos_script(&restore, &["--restore-base-theme", "--restart-codex"]);
                    return Err(match restore_result {
                        Ok(_) => format!("{apply_error}\n已恢复官方外观。"),
                        Err(restore_error) => {
                            format!("{apply_error}\n自动恢复官方外观也失败: {restore_error}")
                        }
                    });
                }
            }
            Ok::<(), String>(())
        })
        .await
        .map_err(|error| format!("DreamSkin macOS 主题应用任务异常结束: {error}"))?;

        match operation {
            Ok(()) => {
                let _ = fs::remove_dir_all(&transaction_root);
                Ok(read_status())
            }
            Err(error) => Err(format!(
                "{error}\n换肤事务已停止；诊断信息与可能的回滚快照保留在 {}",
                transaction_root.display()
            )),
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (app, version_id);
        Err("当前平台暂不支持原生换肤。".to_string())
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
    #[cfg(target_os = "macos")]
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
        let setup_app = app.clone();
        tauri::async_runtime::spawn_blocking(move || ensure_skin_engine(&setup_app))
            .await
            .map_err(|error| format!("Dream Skin macOS 引擎部署任务异常结束: {error}"))??;
        tauri::async_runtime::spawn_blocking(move || {
            run_macos_script(
                &macos_installed_script("codextool-seed-presets-macos.sh")?,
                &[],
            )?;
            run_macos_script(
                &macos_installed_script("switch-theme-macos.sh")?,
                &["--id", &theme_id],
            )?;
            Ok::<(), String>(())
        })
        .await
        .map_err(|error| format!("Dream Skin macOS 应用任务异常结束: {error}"))??;
        Ok(read_status())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (app, theme_id);
        Err("当前平台暂不支持原生换肤。".to_string())
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
    #[cfg(target_os = "macos")]
    {
        let restore = macos_installed_script("restore-dream-skin-macos.sh")?;
        tauri::async_runtime::spawn_blocking(move || {
            run_macos_script(&restore, &["--restore-base-theme", "--restart-codex"])
        })
        .await
        .map_err(|error| format!("Dream Skin macOS 恢复任务异常结束: {error}"))??;
        Ok(read_status())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("当前平台暂不支持原生换肤。".to_string())
    }
}
