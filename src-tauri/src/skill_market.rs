use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;

use crate::app_paths;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BuiltinSkillEntry {
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) category: String,
    pub(crate) installed: bool,
    pub(crate) source_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillInstallResult {
    pub(crate) name: String,
    pub(crate) installed_path: String,
}

#[derive(Debug, Deserialize)]
struct LocalCatalog {
    #[serde(default)]
    categories: BTreeMap<String, LocalCategory>,
}

#[derive(Debug, Deserialize)]
struct LocalCategory {
    #[serde(default)]
    skills: Vec<String>,
}

#[derive(Debug)]
struct SkillCandidate {
    name: String,
    description: String,
    directory: PathBuf,
    relative_path: String,
}

fn marketplace_root(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("resources").join("skill-market"));
        candidates.push(resource_dir.join("skill-market"));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("skill-market"),
    );

    candidates
        .into_iter()
        .find(|path| path.join("skills").is_dir())
        .ok_or_else(|| "内置 Skill 商场资源缺失，请重新安装 CodexTool。".to_string())
}

fn read_category_map(root: &Path) -> HashMap<String, String> {
    let Ok(raw) = fs::read_to_string(root.join("local_skills.json")) else {
        return HashMap::new();
    };
    let Ok(catalog) = serde_json::from_str::<LocalCatalog>(&raw) else {
        return HashMap::new();
    };

    let mut categories = HashMap::new();
    for (category, entry) in catalog.categories {
        for skill in entry.skills {
            categories.entry(skill).or_insert_with(|| category.clone());
        }
    }
    categories
}

fn parse_frontmatter(skill_file: &Path) -> Option<(String, String)> {
    let raw = fs::read_to_string(skill_file).ok()?;
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

fn skill_candidates(root: &Path) -> Result<HashMap<String, SkillCandidate>, String> {
    let skills_root = root.join("skills");
    let mut files = Vec::new();
    collect_skill_files(&skills_root, &mut files);
    files.sort();

    let mut candidates: HashMap<String, SkillCandidate> = HashMap::new();
    for file in files {
        let Some((name, description)) = parse_frontmatter(&file) else {
            continue;
        };
        if name == "_template" {
            continue;
        }
        let Some(directory) = file.parent() else {
            continue;
        };
        let relative = directory
            .strip_prefix(&skills_root)
            .map_err(|error| format!("解析内置 Skill 路径失败: {error}"))?
            .to_string_lossy()
            .replace('\\', "/");
        let candidate = SkillCandidate {
            name: name.clone(),
            description,
            directory: directory.to_path_buf(),
            relative_path: relative,
        };

        let replace = match candidates.get(&name) {
            None => true,
            Some(current) => {
                candidate.relative_path.matches('/').count()
                    < current.relative_path.matches('/').count()
            }
        };
        if replace {
            candidates.insert(name, candidate);
        }
    }
    Ok(candidates)
}

fn installed_skills_root() -> Result<PathBuf, String> {
    Ok(app_paths::codex_dir()?.join("skills"))
}

pub(crate) fn list_builtin_skills(app: &AppHandle) -> Result<Vec<BuiltinSkillEntry>, String> {
    let root = marketplace_root(app)?;
    let category_map = read_category_map(&root);
    let installed_root = installed_skills_root()?;
    let mut entries = skill_candidates(&root)?
        .into_values()
        .map(|candidate| BuiltinSkillEntry {
            installed: installed_root
                .join(&candidate.name)
                .join("SKILL.md")
                .is_file(),
            category: category_map
                .get(&candidate.name)
                .cloned()
                .unwrap_or_else(|| "其他".to_string()),
            name: candidate.name,
            description: candidate.description,
            source_path: candidate.relative_path,
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        left.category
            .cmp(&right.category)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(entries)
}

pub(crate) fn install_builtin_skill(
    app: &AppHandle,
    requested_name: &str,
) -> Result<SkillInstallResult, String> {
    let name = requested_name.trim();
    if !is_safe_skill_name(name) {
        return Err("Skill 名称无效。".to_string());
    }

    let root = marketplace_root(app)?;
    let candidate = skill_candidates(&root)?
        .remove(name)
        .ok_or_else(|| format!("未找到内置 Skill：{name}"))?;
    let installed_root = installed_skills_root()?;
    fs::create_dir_all(&installed_root)
        .map_err(|error| format!("创建 Skills 目录失败: {error}"))?;

    let destination = installed_root.join(name);
    if destination.exists() {
        return Err(format!(
            "Skill {name} 已存在；为保护本地修改，CodexTool 不会覆盖它。"
        ));
    }

    let staging = installed_root.join(format!(".{name}.installing-{}", uuid::Uuid::new_v4()));
    copy_directory(&candidate.directory, &staging)?;
    if !staging.join("SKILL.md").is_file() {
        let _ = fs::remove_dir_all(&staging);
        return Err("内置 Skill 缺少 SKILL.md，安装已取消。".to_string());
    }
    if let Err(error) = fs::rename(&staging, &destination) {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("发布 Skill 到用户目录失败: {error}"));
    }

    Ok(SkillInstallResult {
        name: name.to_string(),
        installed_path: destination.to_string_lossy().to_string(),
    })
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| format!("创建 Skill 安装目录失败: {error}"))?;
    for entry in fs::read_dir(source).map_err(|error| format!("读取 Skill 资源失败: {error}"))?
    {
        let entry = entry.map_err(|error| format!("读取 Skill 资源项失败: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("读取 Skill 资源类型失败: {error}"))?;
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
