import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n/I18nProvider";

type BuiltinSkill = {
  name: string;
  description: string;
  category: string;
  installed: boolean;
  sourcePath: string;
};

const COPY = {
  "zh-CN": {
    kicker: "内置能力",
    title: "Skill 仓库",
    description: "精选自 anbeime/skill，技能包随 CodexTool 离线提供。安装时只复制到你的 ~/.codex/skills，不执行脚本。",
    search: "搜索 Skill、描述或分类",
    all: "全部",
    loading: "正在读取内置 Skill…",
    empty: "没有匹配的 Skill",
    install: "安装",
    installing: "安装中…",
    installed: "已安装",
    refresh: "刷新状态",
    source: "来源：anbeime/skill（目录结构与各 Skill 自带许可保持不变）",
    browserPreview: "浏览器演示仅预览界面；请使用 npm run tauri dev 启动桌面版以读取和安装内置 Skill。",
    count: (shown: number, total: number) => `显示 ${shown} / ${total} 个 Skill`,
  },
  "en-US": {
    kicker: "BUILT IN",
    title: "Skill Repository",
    description: "Curated from anbeime/skill and bundled for offline use. Installing only copies files to ~/.codex/skills; it does not execute scripts.",
    search: "Search skills, descriptions, or categories",
    all: "All",
    loading: "Loading bundled skills…",
    empty: "No matching skills",
    install: "Install",
    installing: "Installing…",
    installed: "Installed",
    refresh: "Refresh status",
    source: "Source: anbeime/skill (original structure and per-skill licenses retained)",
    browserPreview: "The browser demo previews the interface only. Run npm run tauri dev to browse and install bundled skills.",
    count: (shown: number, total: number) => `Showing ${shown} of ${total} skills`,
  },
} as const;

export function SkillStorePanel() {
  const { locale } = useI18n();
  const copy = locale === "zh-CN" ? COPY["zh-CN"] : COPY["en-US"];
  const [skills, setSkills] = useState<BuiltinSkill[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(copy.all);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktopAvailable = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!("__TAURI_INTERNALS__" in window)) {
      setSkills([]);
      setLoading(false);
      return;
    }
    try {
      const entries = await invoke<BuiltinSkill[]>("list_builtin_skills");
      setSkills(entries);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    setCategory(copy.all);
  }, [copy.all]);

  const categories = useMemo(
    () => [copy.all, ...Array.from(new Set(skills.map((skill) => skill.category)))],
    [copy.all, skills],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return skills.filter((skill) => {
      const matchesCategory = category === copy.all || skill.category === category;
      const matchesQuery =
        !needle ||
        `${skill.name} ${skill.description} ${skill.category}`
          .toLocaleLowerCase()
          .includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, copy.all, query, skills]);

  const install = async (skill: BuiltinSkill) => {
    if (skill.installed || installing) return;
    setInstalling(skill.name);
    setError(null);
    try {
      await invoke("install_builtin_skill", { name: skill.name });
      setSkills((current) =>
        current.map((entry) =>
          entry.name === skill.name ? { ...entry, installed: true } : entry,
        ),
      );
    } catch (reason) {
      setError(String(reason));
    } finally {
      setInstalling(null);
    }
  };

  return (
    <section className="marketPage" aria-labelledby="skill-store-title">
      <header className="marketHero workspacePageHeader">
        <div>
          <span className="marketKicker">{copy.kicker}</span>
          <h2 id="skill-store-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <button type="button" className="secondary" onClick={() => void loadSkills()} disabled={loading}>
          {copy.refresh}
        </button>
      </header>

      <div className="marketToolbar">
        <input
          className="marketSearch"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={copy.search}
          aria-label={copy.search}
        />
        <span className="marketCount">{copy.count(filtered.length, skills.length)}</span>
      </div>

      <div className="marketCategories" role="list" aria-label="Skill categories">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={`marketCategory${item === category ? " isActive" : ""}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {!desktopAvailable ? <div className="marketPreviewNote">{copy.browserPreview}</div> : null}
      {error ? <div className="marketError">{error}</div> : null}
      {loading ? (
        <div className="marketEmpty">{copy.loading}</div>
      ) : desktopAvailable && filtered.length === 0 ? (
        <div className="marketEmpty">{copy.empty}</div>
      ) : (
        <div className="skillGrid">
          {filtered.map((skill) => (
            <article className="skillCard" key={skill.name}>
              <div className="skillCardTop">
                <span className="skillCategory">{skill.category}</span>
                <span className={`skillStatus${skill.installed ? " isInstalled" : ""}`}>
                  {skill.installed ? copy.installed : "Skill"}
                </span>
              </div>
              <h3>{skill.name}</h3>
              <p>{skill.description}</p>
              <div className="skillCardFooter">
                <span title={skill.sourcePath}>{skill.sourcePath}</span>
                <button
                  type="button"
                  className="primary compactAction"
                  disabled={skill.installed || installing !== null}
                  onClick={() => void install(skill)}
                >
                  {skill.installed
                    ? copy.installed
                    : installing === skill.name
                      ? copy.installing
                      : copy.install}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="marketAttribution">{copy.source}</p>
    </section>
  );
}
