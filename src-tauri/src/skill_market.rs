use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use base64::Engine as _;
use serde::Deserialize;
use serde::Serialize;

use crate::app_paths;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillInstallResult {
    pub(crate) name: String,
    pub(crate) installed_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalSkillEntry {
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) path: String,
    pub(crate) enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteSkillEntry {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) author: String,
    pub(crate) description: String,
    pub(crate) github_url: Option<String>,
    pub(crate) stars: u64,
    pub(crate) installed: bool,
    pub(crate) change: Option<i64>,
    pub(crate) official: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteSkillDetail {
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) content: String,
    pub(crate) source_path: String,
}

#[derive(Debug, Deserialize)]
struct SkillsMpResponse {
    #[serde(default)]
    data: Option<SkillsMpData>,
    #[serde(default)]
    success: bool,
    #[serde(default)]
    error: Option<SkillsMpError>,
}

#[derive(Debug, Deserialize)]
struct SkillsMpData {
    #[serde(default)]
    skills: Vec<SkillsMpSkill>,
}

#[derive(Debug, Deserialize)]
struct SkillsMpError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct SkillsMpSkill {
    #[serde(default)]
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    description: String,
    #[serde(default, rename = "githubUrl")]
    github_url: Option<String>,
    #[serde(default)]
    stars: u64,
}

#[derive(Debug, Deserialize)]
struct SkillsShResponse {
    #[serde(default)]
    skills: Vec<SkillsShSkill>,
}

#[derive(Debug, Deserialize)]
struct SkillsShSkill {
    #[serde(default)]
    id: String,
    #[serde(default, rename = "skillId")]
    skill_id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    source: String,
    #[serde(default)]
    installs: u64,
    #[serde(default)]
    change: Option<i64>,
    #[serde(default, rename = "isOfficial")]
    is_official: bool,
}

#[derive(Debug, Deserialize)]
struct GithubTreeResponse {
    #[serde(default)]
    tree: Vec<GithubTreeItem>,
    #[serde(default)]
    truncated: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubTreeItem {
    path: String,
    mode: String,
    #[serde(rename = "type")]
    kind: String,
    url: String,
    #[serde(default)]
    size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GithubBlobResponse {
    content: String,
    encoding: String,
}

pub(crate) enum GithubInstallAttempt {
    NotApplicable,
    Installed(GitInstallResult),
    RetryWithGit(String),
    Failed(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitInstallResult {
    pub(crate) skills: Vec<SkillInstallResult>,
}

#[derive(Debug)]
struct SkillCandidate {
    name: String,
    directory: PathBuf,
    relative_path: String,
}

fn parse_frontmatter(skill_file: &Path) -> Option<(String, String)> {
    let raw = fs::read_to_string(skill_file).ok()?;
    parse_frontmatter_content(&raw)
}

fn parse_frontmatter_content(raw: &str) -> Option<(String, String)> {
    let mut lines = raw.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }

    let mut name = None;
    let mut description = None;
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        if let Some(value) = trimmed.strip_prefix("name:") {
            name = Some(unquote_yaml_scalar(value));
        } else if let Some(value) = trimmed.strip_prefix("description:") {
            let value = unquote_yaml_scalar(value);
            if !value.is_empty() && value != ">" && value != "|" {
                description = Some(value);
            }
        }
    }

    let name = name?.trim().to_string();
    if !is_safe_skill_name(&name) {
        return None;
    }
    let description = description.unwrap_or_else(|| format!("内置 Skill：{name}"));
    Some((name, description))
}

fn unquote_yaml_scalar(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string()
}

fn is_safe_skill_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 128
        && name != "."
        && name != ".."
        && name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

fn collect_skill_files(directory: &Path, output: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_skill_files(&path, output);
        } else if file_type.is_file() && entry.file_name() == "SKILL.md" {
            output.push(path);
        }
    }
}

fn local_skills_root() -> Result<PathBuf, String> {
    Ok(app_paths::codex_dir()?.join("skills"))
}

fn disabled_skills_root() -> Result<PathBuf, String> {
    Ok(app_paths::codex_dir()?.join("skills-disabled"))
}

fn relative_skill_path(path: &Path, root: &Path) -> Option<String> {
    path.strip_prefix(root)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/")
        .strip_suffix("/SKILL.md")
        .map(str::to_string)
}

fn is_safe_relative_skill_path(value: &str) -> bool {
    let path = Path::new(value);
    !value.is_empty()
        && !path.is_absolute()
        && path.components().all(|component| {
            matches!(
                component,
                std::path::Component::Normal(_) | std::path::Component::CurDir
            )
        })
}

fn local_skill_entries_in_root(root: &Path, enabled: bool) -> Vec<LocalSkillEntry> {
    if !root.is_dir() {
        return Vec::new();
    }

    let mut files = Vec::new();
    collect_skill_files(root, &mut files);
    files.sort();
    files
        .into_iter()
        .filter_map(|file| {
            let (name, description) = parse_frontmatter(&file)?;
            if name == "_template" {
                return None;
            }
            let relative = relative_skill_path(&file, root)?;
            if !is_safe_relative_skill_path(&relative) {
                return None;
            }
            Some(LocalSkillEntry {
                name,
                description,
                path: format!(
                    "{}:{relative}",
                    if enabled { "enabled" } else { "disabled" }
                ),
                enabled,
            })
        })
        .collect()
}

pub(crate) fn list_local_skills() -> Result<Vec<LocalSkillEntry>, String> {
    let enabled_root = local_skills_root()?;
    let disabled_root = disabled_skills_root()?;
    let mut entries = local_skill_entries_in_root(&enabled_root, true);
    entries.extend(local_skill_entries_in_root(&disabled_root, false));
    entries.sort_by(|left, right| {
        right
            .enabled
            .cmp(&left.enabled)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(entries)
}

fn split_local_skill_path(value: &str) -> Result<(bool, PathBuf), String> {
    let (root_kind, relative) = value
        .split_once(':')
        .ok_or_else(|| "Skill 路径无效。".to_string())?;
    let enabled = match root_kind {
        "enabled" => true,
        "disabled" => false,
        _ => return Err("Skill 路径无效。".to_string()),
    };
    if !is_safe_relative_skill_path(relative) {
        return Err("Skill 路径无效。".to_string());
    }
    Ok((enabled, PathBuf::from(relative)))
}

pub(crate) fn set_local_skill_enabled(
    id: &str,
    enabled: bool,
) -> Result<Vec<LocalSkillEntry>, String> {
    let (currently_enabled, relative) = split_local_skill_path(id)?;
    if currently_enabled == enabled {
        return list_local_skills();
    }

    let source_root = if currently_enabled {
        local_skills_root()?
    } else {
        disabled_skills_root()?
    };
    let destination_root = if enabled {
        local_skills_root()?
    } else {
        disabled_skills_root()?
    };
    let source = source_root.join(&relative);
    let destination = destination_root.join(&relative);
    if !source.join("SKILL.md").is_file() {
        return Err("未找到该本地 Skill，可能已被其他程序移动。".to_string());
    }
    if destination.exists() {
        return Err("目标位置已经存在同名 Skill，为保护本地文件未执行移动。".to_string());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建 Skill 目录失败: {error}"))?;
    }
    fs::rename(&source, &destination).map_err(|error| format!("切换 Skill 状态失败: {error}"))?;
    Ok(list_local_skills()?)
}

fn skill_names_set() -> std::collections::HashSet<String> {
    list_local_skills()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.name)
        .collect()
}

fn trim_http_error(body: &str) -> String {
    let compact = body.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.len() > 320 {
        format!("{}…", &compact[..320])
    } else {
        compact
    }
}

fn search_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!("CodexTool/{}", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("创建 Skill 搜索客户端失败: {error}"))
}

pub(crate) async fn search_skill_market(
    query: &str,
    provider: &str,
    api_key: Option<&str>,
) -> Result<Vec<RemoteSkillEntry>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("请输入 Skill 名称或功能关键词。".to_string());
    }
    if query.chars().count() > 200 {
        return Err("搜索关键词不能超过 200 个字符。".to_string());
    }

    let client = search_client()?;
    let installed = skill_names_set();
    match provider {
        "skillsMp" => {
            let mut request = client
                .get("https://skillsmp.com/api/v1/skills/search")
                .query(&[("q", query), ("limit", "50"), ("sortBy", "stars")]);
            if let Some(key) = api_key.map(str::trim).filter(|key| !key.is_empty()) {
                request = request.bearer_auth(key);
            }
            let response = request
                .send()
                .await
                .map_err(|error| format!("SkillsMP 搜索失败: {error}"))?;
            let status = response.status();
            let body = response
                .text()
                .await
                .map_err(|error| format!("读取 SkillsMP 响应失败: {error}"))?;
            if !status.is_success() {
                return Err(format!(
                    "SkillsMP 搜索失败（HTTP {}）：{}",
                    status.as_u16(),
                    trim_http_error(&body)
                ));
            }
            let payload = serde_json::from_str::<SkillsMpResponse>(&body)
                .map_err(|error| format!("解析 SkillsMP 响应失败: {error}"))?;
            if !payload.success {
                return Err(payload
                    .error
                    .map(|error| format!("SkillsMP 搜索失败：{}", error.message))
                    .unwrap_or_else(|| "SkillsMP 搜索失败。".to_string()));
            }
            Ok(payload
                .data
                .unwrap_or(SkillsMpData { skills: Vec::new() })
                .skills
                .into_iter()
                .filter(|skill| !skill.name.trim().is_empty())
                .map(|skill| RemoteSkillEntry {
                    installed: installed.contains(&skill.name),
                    id: skill.id,
                    name: skill.name,
                    author: skill.author,
                    description: skill.description,
                    github_url: skill.github_url,
                    stars: skill.stars,
                    change: None,
                    official: false,
                })
                .collect())
        }
        "skillsSh" => {
            let response = client
                .get("https://skills.sh/api/search")
                .query(&[("q", query)])
                .send()
                .await
                .map_err(|error| format!("skills.sh 搜索失败: {error}"))?;
            let status = response.status();
            let body = response
                .text()
                .await
                .map_err(|error| format!("读取 skills.sh 响应失败: {error}"))?;
            if !status.is_success() {
                return Err(format!(
                    "skills.sh 搜索失败（HTTP {}）：{}",
                    status.as_u16(),
                    trim_http_error(&body)
                ));
            }
            let payload = serde_json::from_str::<SkillsShResponse>(&body)
                .map_err(|error| format!("解析 skills.sh 响应失败: {error}"))?;
            Ok(payload
                .skills
                .into_iter()
                .filter(|skill| !skill.name.trim().is_empty())
                .map(|skill| {
                    let id = if skill.id.trim().is_empty() {
                        skill.skill_id
                    } else {
                        skill.id
                    };
                    let github_url = skill
                        .source
                        .split_once('/')
                        .map(|_| format!("https://github.com/{}.git", skill.source.trim()));
                    RemoteSkillEntry {
                        installed: installed.contains(&skill.name),
                        id,
                        name: skill.name,
                        author: skill.source.clone(),
                        description: "来自 skills.sh 的开源 Skill，可从 GitHub 安装。".to_string(),
                        github_url,
                        stars: skill.installs,
                        change: skill.change,
                        official: skill.is_official,
                    }
                })
                .collect())
        }
        _ => Err("不支持的 Skill 搜索来源。".to_string()),
    }
}

pub(crate) async fn list_skills_sh(view: &str) -> Result<Vec<RemoteSkillEntry>, String> {
    let view = match view {
        "all-time" | "trending" | "hot" => view,
        _ => return Err("不支持的 skills.sh 榜单类型。".to_string()),
    };
    let response = search_client()?
        .get(format!("https://skills.sh/api/skills/{view}/0"))
        .send()
        .await
        .map_err(|error| format!("读取 skills.sh 榜单失败: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 skills.sh 榜单响应失败: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "读取 skills.sh 榜单失败（HTTP {}）：{}",
            status.as_u16(),
            trim_http_error(&body)
        ));
    }
    let payload = serde_json::from_str::<SkillsShResponse>(&body)
        .map_err(|error| format!("解析 skills.sh 榜单失败: {error}"))?;
    let installed = skill_names_set();
    Ok(payload
        .skills
        .into_iter()
        .filter(|skill| !skill.name.trim().is_empty())
        .map(|skill| {
            let id = if skill.id.trim().is_empty() {
                format!("{}/{}", skill.source, skill.skill_id)
            } else {
                skill.id
            };
            let github_url = skill
                .source
                .split_once('/')
                .map(|_| format!("https://github.com/{}.git", skill.source.trim()));
            RemoteSkillEntry {
                installed: installed.contains(&skill.name),
                id,
                name: skill.name,
                author: skill.source,
                description: String::new(),
                github_url,
                stars: skill.installs,
                change: skill.change,
                official: skill.is_official,
            }
        })
        .collect())
}

struct GitSource {
    clone_url: String,
    subdirectory: Option<PathBuf>,
}

fn valid_git_source(raw: &str) -> Result<GitSource, String> {
    let trimmed = raw.trim();
    let parsed = reqwest::Url::parse(trimmed).map_err(|_| "Git URL 格式无效。".to_string())?;
    if parsed.host_str().is_none() || !matches!(parsed.scheme(), "https" | "http" | "ssh" | "git") {
        return Err("仅支持 http(s)、ssh 或 git 格式的仓库地址。".to_string());
    }
    if parsed.host_str() == Some("github.com") {
        let segments = parsed
            .path_segments()
            .map(|parts| parts.filter(|part| !part.is_empty()).collect::<Vec<_>>())
            .unwrap_or_default();
        if segments.len() >= 2 {
            let owner = segments[0];
            let repo = segments[1].trim_end_matches(".git");
            let clone_url = format!("https://github.com/{owner}/{repo}.git");
            let subdirectory = if segments.get(2) == Some(&"tree") && segments.len() >= 5 {
                let path = segments[4..].join("/");
                is_safe_relative_skill_path(&path).then(|| PathBuf::from(path))
            } else {
                None
            };
            if segments.get(2) == Some(&"tree") && subdirectory.is_none() {
                return Err("GitHub Skill 子目录地址无效。".to_string());
            }
            return Ok(GitSource {
                clone_url,
                subdirectory,
            });
        }
    }
    Ok(GitSource {
        clone_url: trimmed.to_string(),
        subdirectory: None,
    })
}

fn github_coordinates(source: &GitSource) -> Option<(String, String)> {
    let parsed = reqwest::Url::parse(&source.clone_url).ok()?;
    if parsed.host_str() != Some("github.com") {
        return None;
    }
    let segments = parsed
        .path_segments()?
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if segments.len() < 2 {
        return None;
    }
    Some((
        segments[0].to_string(),
        segments[1].trim_end_matches(".git").to_string(),
    ))
}

async fn fetch_github_blob(
    client: &reqwest::Client,
    item: &GithubTreeItem,
) -> Result<Vec<u8>, String> {
    const MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;
    if item.size.unwrap_or(0) > MAX_FILE_BYTES {
        return Err(format!("Skill 文件过大：{}", item.path));
    }
    let response = client
        .get(&item.url)
        .send()
        .await
        .map_err(|error| format!("下载 {} 失败: {error}", item.path))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 {} 失败: {error}", item.path))?;
    if !status.is_success() {
        return Err(format!(
            "下载 {} 失败（HTTP {}）：{}",
            item.path,
            status.as_u16(),
            trim_http_error(&body)
        ));
    }
    let blob = serde_json::from_str::<GithubBlobResponse>(&body)
        .map_err(|error| format!("解析 {} 失败: {error}", item.path))?;
    if blob.encoding != "base64" {
        return Err(format!("{} 使用了不支持的 GitHub 编码。", item.path));
    }
    let compact = blob
        .content
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(compact)
        .map_err(|error| format!("解码 {} 失败: {error}", item.path))?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(format!("Skill 文件过大：{}", item.path));
    }
    Ok(bytes)
}

fn resolve_github_skill_file<'a>(
    source: &GitSource,
    tree: &'a GithubTreeResponse,
    requested_name: &str,
) -> Result<(String, &'a GithubTreeItem), String> {
    let skill_files = tree
        .tree
        .iter()
        .filter(|item| {
            item.kind == "blob" && (item.path == "SKILL.md" || item.path.ends_with("/SKILL.md"))
        })
        .collect::<Vec<_>>();
    let relative_root = if let Some(path) = source.subdirectory.as_ref() {
        path.to_string_lossy().replace('\\', "/")
    } else if let Some(directory) = skill_files
        .iter()
        .filter_map(|item| Path::new(&item.path).parent())
        .filter(|directory| {
            directory
                .file_name()
                .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case(requested_name))
        })
        .min_by_key(|directory| directory.components().count())
    {
        directory.to_string_lossy().replace('\\', "/")
    } else if skill_files.len() == 1 {
        Path::new(&skill_files[0].path)
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .to_string_lossy()
            .replace('\\', "/")
    } else {
        return Err(format!(
            "GitHub HTTPS 清单中未定位到 Skill：{requested_name}"
        ));
    };
    let skill_file_path = if relative_root.is_empty() {
        "SKILL.md".to_string()
    } else {
        format!("{relative_root}/SKILL.md")
    };
    let skill_file = tree
        .tree
        .iter()
        .find(|item| item.path == skill_file_path)
        .ok_or_else(|| format!("GitHub HTTPS 清单中未找到 {skill_file_path}"))?;
    Ok((relative_root, skill_file))
}

fn skill_markdown_body(raw: &str) -> String {
    let mut frontmatter_closed = false;
    let mut lines = raw.lines();
    if lines.next().is_some_and(|line| line.trim() == "---") {
        for line in lines.by_ref() {
            if line.trim() == "---" {
                frontmatter_closed = true;
                break;
            }
        }
    }
    let body = if frontmatter_closed {
        lines.collect::<Vec<_>>().join("\n")
    } else {
        raw.to_string()
    };
    let trimmed = body.trim();
    if trimmed.chars().count() <= 60_000 {
        return trimmed.to_string();
    }
    format!(
        "{}\n\n…内容过长，已截断显示。",
        trimmed.chars().take(60_000).collect::<String>()
    )
}

pub(crate) async fn get_remote_skill_detail(
    raw_url: &str,
    requested_name: &str,
) -> Result<RemoteSkillDetail, String> {
    let source = valid_git_source(raw_url)?;
    let requested_name = requested_name.trim();
    if !is_safe_skill_name(requested_name) {
        return Err("Skill 名称无效。".to_string());
    }
    let (owner, repository) = github_coordinates(&source)
        .ok_or_else(|| "当前仅支持读取 GitHub Skill 详情。".to_string())?;
    let client = search_client()?;
    let response = client
        .get(format!(
            "https://api.github.com/repos/{owner}/{repository}/git/trees/HEAD?recursive=1"
        ))
        .send()
        .await
        .map_err(|error| format!("读取 Skill 详情清单失败: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 Skill 详情清单失败: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "读取 Skill 详情失败（HTTP {}）：{}",
            status.as_u16(),
            trim_http_error(&body)
        ));
    }
    let tree = serde_json::from_str::<GithubTreeResponse>(&body)
        .map_err(|error| format!("解析 Skill 详情清单失败: {error}"))?;
    if tree.truncated {
        return Err("GitHub 仓库文件清单过大，暂时无法读取详情。".to_string());
    }
    let (_, skill_file) = resolve_github_skill_file(&source, &tree, requested_name)?;
    let bytes = fetch_github_blob(&client, skill_file).await?;
    let text = std::str::from_utf8(&bytes).map_err(|_| "SKILL.md 不是有效 UTF-8。".to_string())?;
    let (name, description) =
        parse_frontmatter_content(text).ok_or_else(|| "SKILL.md 元数据无效。".to_string())?;
    Ok(RemoteSkillDetail {
        name,
        description,
        content: skill_markdown_body(text),
        source_path: skill_file.path.clone(),
    })
}

pub(crate) async fn install_skill_from_github_api(
    raw_url: &str,
    requested_skill_name: Option<&str>,
) -> GithubInstallAttempt {
    let source = match valid_git_source(raw_url) {
        Ok(source) => source,
        Err(error) => return GithubInstallAttempt::Failed(error),
    };
    let Some(requested_name) = requested_skill_name
        .map(str::trim)
        .filter(|name| !name.is_empty())
    else {
        return GithubInstallAttempt::NotApplicable;
    };
    let Some((owner, repository)) = github_coordinates(&source) else {
        return GithubInstallAttempt::NotApplicable;
    };
    let client = match search_client() {
        Ok(client) => client,
        Err(error) => return GithubInstallAttempt::RetryWithGit(error),
    };
    let tree_url =
        format!("https://api.github.com/repos/{owner}/{repository}/git/trees/HEAD?recursive=1");
    let response = match client.get(tree_url).send().await {
        Ok(response) => response,
        Err(error) => {
            return GithubInstallAttempt::RetryWithGit(format!(
                "GitHub HTTPS 清单读取失败: {error}"
            ))
        }
    };
    let status = response.status();
    let body = match response.text().await {
        Ok(body) => body,
        Err(error) => {
            return GithubInstallAttempt::RetryWithGit(format!(
                "GitHub HTTPS 清单读取失败: {error}"
            ))
        }
    };
    if !status.is_success() {
        return GithubInstallAttempt::RetryWithGit(format!(
            "GitHub HTTPS 清单失败（HTTP {}）：{}",
            status.as_u16(),
            trim_http_error(&body)
        ));
    }
    let tree = match serde_json::from_str::<GithubTreeResponse>(&body) {
        Ok(tree) => tree,
        Err(error) => {
            return GithubInstallAttempt::RetryWithGit(format!(
                "GitHub HTTPS 清单解析失败: {error}"
            ))
        }
    };
    if tree.truncated {
        return GithubInstallAttempt::RetryWithGit(
            "GitHub 仓库文件清单过大，改用 Git 备用下载。".to_string(),
        );
    }

    let (relative_root, skill_file) =
        match resolve_github_skill_file(&source, &tree, requested_name) {
            Ok(value) => value,
            Err(error) => return GithubInstallAttempt::RetryWithGit(error),
        };
    let skill_file_path = skill_file.path.clone();
    let prefix = if relative_root.is_empty() {
        String::new()
    } else {
        format!("{relative_root}/")
    };
    let files = tree
        .tree
        .iter()
        .filter(|item| {
            item.kind == "blob"
                && (prefix.is_empty() || item.path.starts_with(&prefix))
                && item.path != relative_root
        })
        .cloned()
        .collect::<Vec<_>>();
    if files.is_empty() || files.len() > 200 {
        return GithubInstallAttempt::Failed("Skill 文件数量异常，安装已取消。".to_string());
    }
    if files.iter().any(|item| item.mode == "120000") {
        return GithubInstallAttempt::Failed(
            "Skill 包含符号链接，出于安全原因拒绝安装。".to_string(),
        );
    }
    let estimated_size = files.iter().filter_map(|item| item.size).sum::<u64>();
    if estimated_size > 24 * 1024 * 1024 {
        return GithubInstallAttempt::Failed(
            "Skill 文件总大小超过 24 MB，安装已取消。".to_string(),
        );
    }

    let skill_bytes = match fetch_github_blob(&client, skill_file).await {
        Ok(bytes) => bytes,
        Err(error) => return GithubInstallAttempt::RetryWithGit(error),
    };
    let skill_text = match std::str::from_utf8(&skill_bytes) {
        Ok(text) => text,
        Err(_) => return GithubInstallAttempt::Failed("SKILL.md 不是有效 UTF-8。".to_string()),
    };
    let Some((installed_name, _)) = parse_frontmatter_content(skill_text) else {
        return GithubInstallAttempt::Failed("SKILL.md 元数据无效。".to_string());
    };
    if !installed_name.eq_ignore_ascii_case(requested_name) {
        return GithubInstallAttempt::Failed(format!(
            "Skill 名称不匹配：请求 {requested_name}，仓库提供 {installed_name}。"
        ));
    }

    let installed_root = match local_skills_root() {
        Ok(root) => root,
        Err(error) => return GithubInstallAttempt::Failed(error),
    };
    if let Err(error) = fs::create_dir_all(&installed_root) {
        return GithubInstallAttempt::Failed(format!("创建 Skills 目录失败: {error}"));
    }
    let destination = installed_root.join(&installed_name);
    if destination.exists() {
        return GithubInstallAttempt::Failed(format!(
            "Skill {installed_name} 已存在；为保护本地修改，CodexTool 不会覆盖它。"
        ));
    }
    let staging = installed_root.join(format!(
        ".{installed_name}.installing-{}",
        uuid::Uuid::new_v4()
    ));
    if let Err(error) = fs::create_dir_all(&staging) {
        return GithubInstallAttempt::Failed(format!("创建 Skill 临时目录失败: {error}"));
    }
    for item in files {
        let relative = if prefix.is_empty() {
            item.path.as_str()
        } else {
            item.path.strip_prefix(&prefix).unwrap_or("")
        };
        if !is_safe_relative_skill_path(relative) {
            let _ = fs::remove_dir_all(&staging);
            return GithubInstallAttempt::Failed("Skill 文件路径无效，安装已取消。".to_string());
        }
        let bytes = if item.path == skill_file_path {
            skill_bytes.clone()
        } else {
            match fetch_github_blob(&client, &item).await {
                Ok(bytes) => bytes,
                Err(error) => {
                    let _ = fs::remove_dir_all(&staging);
                    return GithubInstallAttempt::RetryWithGit(error);
                }
            }
        };
        let target = staging.join(relative);
        if let Some(parent) = target.parent() {
            if let Err(error) = fs::create_dir_all(parent) {
                let _ = fs::remove_dir_all(&staging);
                return GithubInstallAttempt::Failed(format!("创建 Skill 子目录失败: {error}"));
            }
        }
        if let Err(error) = fs::write(&target, bytes) {
            let _ = fs::remove_dir_all(&staging);
            return GithubInstallAttempt::Failed(format!("写入 Skill 文件失败: {error}"));
        }
    }
    if let Err(error) = fs::rename(&staging, &destination) {
        let _ = fs::remove_dir_all(&staging);
        return GithubInstallAttempt::Failed(format!("发布 Skill 失败: {error}"));
    }
    GithubInstallAttempt::Installed(GitInstallResult {
        skills: vec![SkillInstallResult {
            name: installed_name,
            installed_path: destination.to_string_lossy().to_string(),
        }],
    })
}

fn run_git(arguments: &[&str], phase: &str) -> Result<std::process::Output, String> {
    let mut child = Command::new("git")
        .args([
            "-c",
            "http.lowSpeedLimit=1024",
            "-c",
            "http.lowSpeedTime=30",
        ])
        .args(arguments)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("调用 git 失败，请确认已安装 Git: {error}"))?;
    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法读取 git 输出。".to_string())?;
    let mut stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法读取 git 错误。".to_string())?;
    let stdout_reader = thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = stdout.read_to_end(&mut buffer);
        buffer
    });
    let stderr_reader = thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = stderr.read_to_end(&mut buffer);
        buffer
    });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() < Duration::from_secs(35) => {
                thread::sleep(Duration::from_millis(80));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                // git may have spawned a transport helper. Do not block the
                // application waiting for inherited pipe handles to close.
                drop(stdout_reader);
                drop(stderr_reader);
                return Err(format!("{phase}超时（35 秒），请检查 GitHub 网络后重试。"));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                drop(stdout_reader);
                drop(stderr_reader);
                return Err(format!("等待 git 命令失败: {error}"));
            }
        }
    };
    let output = std::process::Output {
        status,
        stdout: stdout_reader.join().unwrap_or_default(),
        stderr: stderr_reader.join().unwrap_or_default(),
    };
    if output.status.success() {
        return Ok(output);
    }
    let stderr = trim_http_error(&String::from_utf8_lossy(&output.stderr));
    Err(if stderr.is_empty() {
        format!("{phase}失败。")
    } else {
        format!("{phase}失败：{stderr}")
    })
}

fn repository_skill_directory(
    repo_root: &Path,
    requested_skill_name: &str,
) -> Result<PathBuf, String> {
    let repo_root_string = repo_root.to_string_lossy().to_string();
    let tree = run_git(
        &[
            "-C",
            &repo_root_string,
            "ls-tree",
            "-r",
            "--name-only",
            "HEAD",
        ],
        "读取 Git Skill 清单",
    )?;
    let tree = String::from_utf8_lossy(&tree.stdout);
    let skill_files = tree
        .lines()
        .filter(|path| *path == "SKILL.md" || path.ends_with("/SKILL.md"))
        .collect::<Vec<_>>();
    if skill_files.len() == 1 {
        return Ok(Path::new(skill_files[0])
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .to_path_buf());
    }
    if let Some(path) = skill_files
        .iter()
        .filter_map(|path| Path::new(path).parent())
        .filter(|directory| {
            directory.file_name().is_some_and(|name| {
                name.to_string_lossy()
                    .eq_ignore_ascii_case(requested_skill_name)
            })
        })
        .min_by_key(|directory| directory.components().count())
    {
        return Ok(path.to_path_buf());
    }

    for skill_file in skill_files.into_iter().take(80) {
        let object = format!("HEAD:{skill_file}");
        let contents = match run_git(
            &["-C", &repo_root_string, "show", &object],
            "读取 Skill 元数据",
        ) {
            Ok(contents) => contents,
            Err(error) if error.contains("超时") => return Err(error),
            Err(_) => continue,
        };
        let contents = String::from_utf8_lossy(&contents.stdout);
        if parse_frontmatter_content(&contents)
            .is_some_and(|(name, _)| name.eq_ignore_ascii_case(requested_skill_name))
        {
            return Ok(Path::new(skill_file)
                .parent()
                .unwrap_or_else(|| Path::new(""))
                .to_path_buf());
        }
    }
    Err(format!("仓库中未找到 Skill：{requested_skill_name}"))
}

pub(crate) fn install_skill_from_git(
    raw_url: &str,
    requested_skill_name: Option<&str>,
) -> Result<GitInstallResult, String> {
    let source = valid_git_source(raw_url)?;
    let installed_root = local_skills_root()?;
    fs::create_dir_all(&installed_root)
        .map_err(|error| format!("创建 Skills 目录失败: {error}"))?;

    let work_root = std::env::temp_dir().join(format!("codextool-skill-{}", uuid::Uuid::new_v4()));
    let repo_root = work_root.join("repo");
    fs::create_dir_all(&work_root).map_err(|error| format!("创建临时目录失败: {error}"))?;
    let repo_root_string = repo_root.to_string_lossy().to_string();
    let targeted_install = source.subdirectory.is_some() || requested_skill_name.is_some();
    let mut clone_arguments = vec!["clone", "--depth", "1", "--no-tags", "--single-branch"];
    if targeted_install {
        clone_arguments.extend(["--filter=blob:none", "--sparse", "--no-checkout"]);
    }
    clone_arguments.extend(["--", &source.clone_url, &repo_root_string]);
    if let Err(error) = run_git(&clone_arguments, "Git 仓库下载") {
        let _ = fs::remove_dir_all(&work_root);
        return Err(error);
    }

    let relative_skill_root = match source.subdirectory {
        Some(path) => path,
        None => match requested_skill_name
            .map(str::trim)
            .filter(|name| !name.is_empty())
        {
            Some(name) => match repository_skill_directory(&repo_root, name) {
                Ok(path) => path,
                Err(error) => {
                    let _ = fs::remove_dir_all(&work_root);
                    return Err(error);
                }
            },
            None => PathBuf::new(),
        },
    };
    if targeted_install {
        let relative_string = relative_skill_root.to_string_lossy().to_string();
        let checkout_result = if relative_string.is_empty() {
            run_git(
                &["-C", &repo_root_string, "sparse-checkout", "disable"],
                "准备 Git Skill",
            )
        } else {
            run_git(
                &[
                    "-C",
                    &repo_root_string,
                    "sparse-checkout",
                    "set",
                    "--no-cone",
                    "--",
                    &relative_string,
                ],
                "准备 Git Skill",
            )
        };
        if let Err(error) = checkout_result.and_then(|_| {
            run_git(
                &["-C", &repo_root_string, "checkout", "--quiet", "HEAD"],
                "检出 Git Skill",
            )
        }) {
            let _ = fs::remove_dir_all(&work_root);
            return Err(error);
        }
    }

    let skill_root = repo_root.join(&relative_skill_root);
    if !skill_root.is_dir() {
        let _ = fs::remove_dir_all(&work_root);
        return Err("GitHub Skill 子目录不存在。".to_string());
    }
    let mut files = Vec::new();
    collect_skill_files(&skill_root, &mut files);
    files.sort();
    let mut candidates = HashMap::<String, SkillCandidate>::new();
    for file in files {
        let Some((name, _description)) = parse_frontmatter(&file) else {
            continue;
        };
        if name == "_template" {
            continue;
        }
        let Some(directory) = file.parent() else {
            continue;
        };
        let relative_path = directory
            .strip_prefix(&skill_root)
            .map(|path| path.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        let candidate = SkillCandidate {
            name: name.clone(),
            directory: directory.to_path_buf(),
            relative_path,
        };
        let replace = candidates
            .get(&name)
            .map(|current| {
                candidate.relative_path.matches('/').count()
                    < current.relative_path.matches('/').count()
            })
            .unwrap_or(true);
        if replace {
            candidates.insert(name, candidate);
        }
    }
    if candidates.is_empty() {
        let _ = fs::remove_dir_all(&work_root);
        return Err("该 Git 仓库中没有可安装的 SKILL.md。".to_string());
    }

    let mut candidates = candidates.into_values().collect::<Vec<_>>();
    if let Some(requested_name) = requested_skill_name
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        candidates.retain(|candidate| candidate.name.eq_ignore_ascii_case(requested_name));
        if candidates.is_empty() {
            let _ = fs::remove_dir_all(&work_root);
            return Err(format!("仓库中未找到 Skill：{requested_name}"));
        }
    }
    candidates.sort_by(|left, right| left.name.cmp(&right.name));
    if let Some(existing) = candidates
        .iter()
        .find(|candidate| installed_root.join(&candidate.name).exists())
    {
        let _ = fs::remove_dir_all(&work_root);
        return Err(format!(
            "Skill {} 已存在；为保护本地修改，CodexTool 不会覆盖它。",
            existing.name
        ));
    }

    let mut installed = Vec::new();
    for candidate in candidates {
        let destination = installed_root.join(&candidate.name);
        let staging = installed_root.join(format!(
            ".{}.installing-{}",
            candidate.name,
            uuid::Uuid::new_v4()
        ));
        if let Err(error) = copy_directory(&candidate.directory, &staging) {
            let _ = fs::remove_dir_all(&staging);
            let _ = fs::remove_dir_all(&work_root);
            return Err(error);
        }
        if !staging.join("SKILL.md").is_file() {
            let _ = fs::remove_dir_all(&staging);
            let _ = fs::remove_dir_all(&work_root);
            return Err("Git Skill 缺少 SKILL.md，安装已取消。".to_string());
        }
        if let Err(error) = fs::rename(&staging, &destination) {
            let _ = fs::remove_dir_all(&staging);
            let _ = fs::remove_dir_all(&work_root);
            return Err(format!("发布 Git Skill 失败: {error}"));
        }
        installed.push(SkillInstallResult {
            name: candidate.name,
            installed_path: destination.to_string_lossy().to_string(),
        });
    }
    let _ = fs::remove_dir_all(&work_root);
    Ok(GitInstallResult { skills: installed })
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| format!("创建 Skill 安装目录失败: {error}"))?;
    for entry in fs::read_dir(source).map_err(|error| format!("读取 Skill 资源失败: {error}"))?
    {
        let entry = entry.map_err(|error| format!("读取 Skill 资源项失败: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("读取 Skill 资源类型失败: {error}"))?;
        if entry.file_name() == ".git" {
            continue;
        }
        if file_type.is_symlink() {
            return Err("内置 Skill 包含符号链接，出于安全原因拒绝安装。".to_string());
        }
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), target)
                .map_err(|error| format!("复制 Skill 文件失败: {error}"))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_github_repository_and_tree_urls() {
        let repository = valid_git_source("https://github.com/vercel-labs/skills").unwrap();
        assert_eq!(
            repository.clone_url,
            "https://github.com/vercel-labs/skills.git"
        );
        assert!(repository.subdirectory.is_none());

        let nested = valid_git_source(
            "https://github.com/openclaw/openclaw/tree/main/extensions/imessage/skills/imsg",
        )
        .unwrap();
        assert_eq!(nested.clone_url, "https://github.com/openclaw/openclaw.git");
        assert_eq!(
            nested.subdirectory,
            Some(PathBuf::from("extensions/imessage/skills/imsg"))
        );
    }

    #[test]
    fn parses_skills_sh_leaderboard_metrics() {
        let response: SkillsShResponse = serde_json::from_str(
            r#"{"skills":[{"source":"owner/repo","skillId":"demo","name":"Demo","installs":42,"change":7,"isOfficial":true}]}"#,
        )
        .unwrap();
        assert_eq!(response.skills.len(), 1);
        assert_eq!(response.skills[0].skill_id, "demo");
        assert_eq!(response.skills[0].change, Some(7));
        assert!(response.skills[0].is_official);
    }

    #[test]
    fn strips_frontmatter_from_skill_detail_content() {
        let raw =
            "---\nname: demo\ndescription: Demo skill\n---\n\n# Demo\n\nUse this skill safely.";
        assert_eq!(skill_markdown_body(raw), "# Demo\n\nUse this skill safely.");
    }

    #[test]
    fn locates_requested_skill_file_in_github_tree() {
        let source = valid_git_source("https://github.com/vercel-labs/skills.git").unwrap();
        let tree = GithubTreeResponse {
            truncated: false,
            tree: vec![GithubTreeItem {
                path: "skills/find-skills/SKILL.md".to_string(),
                mode: "100644".to_string(),
                kind: "blob".to_string(),
                url: "https://api.github.com/blob/demo".to_string(),
                size: Some(128),
            }],
        };
        let (root, item) = resolve_github_skill_file(&source, &tree, "find-skills").unwrap();
        assert_eq!(root, "skills/find-skills");
        assert_eq!(item.path, "skills/find-skills/SKILL.md");
    }
}
