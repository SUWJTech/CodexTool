import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createPortal } from "react-dom";
import type { AppSettings } from "../types/app";

type RemoteSkill = {
  id: string;
  name: string;
  author: string;
  description: string;
  githubUrl: string | null;
  stars: number;
  installed: boolean;
  change: number | null;
  official: boolean;
};

type LocalSkill = {
  name: string;
  description: string;
  path: string;
  enabled: boolean;
};

type RemoteSkillDetail = {
  name: string;
  description: string;
  content: string;
  sourcePath: string;
};

type Props = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onOpenExternalUrl: (url: string) => void;
};

type MarketProvider = "skillsSh" | "skillsMp";
type LeaderboardView = "all-time" | "trending" | "hot";

const copy = {
  title: "Skill 仓库",
  description: "从 skills.sh 发现并安装 Skill，同时管理本机 ~/.codex/skills。",
  marketplace: "市场榜单",
  local: "本地管理",
  git: "Git 安装",
  skillsSh: "skills.sh",
  skillsMp: "SkillsMP 功能搜索",
  allTime: "全部",
  trending: "Trending",
  hot: "Hot",
  allSources: "全部来源",
  search: "搜索 skills.sh 市场…",
  functionalSearch: "描述想要的功能，例如：把会议记录整理成任务",
  searchButton: "搜索",
  searching: "加载中…",
  apiKey: "SkillsMP API Key（可选）",
  apiKeyHint: "匿名搜索可用；填写 Key 后可提高功能搜索额度。",
  install: "安装",
  installed: "已安装",
  open: "查看",
  noResults: "没有匹配的 Skill。",
  localEmpty: "尚未发现本地 Skill。",
  refresh: "刷新",
  enabled: "已启用",
  disabled: "已禁用",
  disable: "禁用",
  enable: "启用",
  gitPlaceholder: "https://github.com/owner/repository.git",
  gitInstall: "下载并安装",
  gitHint: "支持仓库地址或 GitHub tree 子目录；只复制 Skill 文件，不执行仓库脚本。",
  loading: "读取中…",
  downloading: (name: string) => `正在下载并安装 ${name}，界面可继续浏览…`,
  installDone: (name: string) => `${name} 安装完成，已加入本地 Skill。`,
  detail: "Skill 详情",
  detailHint: "说明内容直接读取该 Skill 仓库中的 SKILL.md。",
  detailLoading: "正在读取 Skill 详细介绍…",
  detailUnavailable: "暂时无法读取完整介绍，可前往源码仓库查看。",
  sourceFile: "来源文件",
  close: "关闭",
};

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function sourceUrl(skill: RemoteSkill) {
  if (skill.githubUrl) return skill.githubUrl.replace(/\.git$/, "");
  return `https://skills.sh/${skill.id}`;
}

export function SkillStorePanel({ settings, onUpdateSettings, onOpenExternalUrl }: Props) {
  const [tab, setTab] = useState<"market" | "local" | "git">("market");
  const [provider, setProvider] = useState<MarketProvider>("skillsSh");
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>("all-time");
  const [query, setQuery] = useState("");
  const [marketSkills, setMarketSkills] = useState<RemoteSkill[]>([]);
  const [localSkills, setLocalSkills] = useState<LocalSkill[]>([]);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [gitUrl, setGitUrl] = useState("");
  const [marketLoading, setMarketLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<RemoteSkill | null>(null);
  const [skillDetail, setSkillDetail] = useState<RemoteSkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequestId = useRef(0);
  const desktopAvailable = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const closeSkillDetail = useCallback(() => {
    detailRequestId.current += 1;
    setSelectedSkill(null);
    setDetailLoading(false);
  }, []);

  const loadLocal = useCallback(async () => {
    if (!desktopAvailable) return;
    setLocalLoading(true);
    try {
      setLocalSkills(await invoke<LocalSkill[]>("list_local_skills"));
      setError(null);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLocalLoading(false);
    }
  }, [desktopAvailable]);

  const loadLeaderboard = useCallback(async (view: LeaderboardView) => {
    if (!desktopAvailable) return;
    setMarketLoading(true);
    setError(null);
    setSourceFilter("all");
    try {
      setMarketSkills(await invoke<RemoteSkill[]>("list_skills_sh", { view }));
    } catch (reason) {
      setError(String(reason));
      setMarketSkills([]);
    } finally {
      setMarketLoading(false);
    }
  }, [desktopAvailable]);

  useEffect(() => {
    void loadLocal();
    void loadLeaderboard("all-time");
  }, [loadLeaderboard, loadLocal]);

  useEffect(() => {
    if (!selectedSkill) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSkillDetail();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeSkillDetail, selectedSkill]);

  const switchLeaderboard = (view: LeaderboardView) => {
    setProvider("skillsSh");
    setLeaderboardView(view);
    setQuery("");
    void loadLeaderboard(view);
  };

  const switchProvider = (next: MarketProvider) => {
    setProvider(next);
    setQuery("");
    setSourceFilter("all");
    if (next === "skillsSh") void loadLeaderboard(leaderboardView);
    else setMarketSkills([]);
  };

  const search = async () => {
    if (!desktopAvailable || marketLoading) return;
    if (!query.trim()) {
      if (provider === "skillsSh") await loadLeaderboard(leaderboardView);
      return;
    }
    setMarketLoading(true);
    setError(null);
    setSourceFilter("all");
    try {
      setMarketSkills(await invoke<RemoteSkill[]>("search_skill_market", {
        query,
        provider,
        apiKey: provider === "skillsMp" ? settings.skillsmpApiKey : null,
      }));
    } catch (reason) {
      setError(String(reason));
      setMarketSkills([]);
    } finally {
      setMarketLoading(false);
    }
  };

  const installRemote = async (skill: RemoteSkill) => {
    if (!skill.githubUrl) return;
    setInstalling(skill.id);
    setInstallNotice(copy.downloading(skill.name));
    setError(null);
    try {
      await invoke("install_skill_from_git", { rawUrl: skill.githubUrl, skillName: skill.name });
      await loadLocal();
      setMarketSkills((items) => items.map((item) => item.id === skill.id ? { ...item, installed: true } : item));
      setSelectedSkill((current) => current?.id === skill.id ? { ...current, installed: true } : current);
      setInstallNotice(copy.installDone(skill.name));
      window.setTimeout(() => setInstallNotice(null), 3200);
    } catch (reason) {
      setError(String(reason));
      setInstallNotice(null);
    } finally {
      setInstalling(null);
    }
  };

  const openSkillDetail = async (skill: RemoteSkill) => {
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    setSelectedSkill(skill);
    setSkillDetail(null);
    setDetailError(null);
    if (!skill.githubUrl || !desktopAvailable) return;
    setDetailLoading(true);
    try {
      const detail = await invoke<RemoteSkillDetail>("get_remote_skill_detail", {
        rawUrl: skill.githubUrl,
        skillName: skill.name,
      });
      if (detailRequestId.current === requestId) setSkillDetail(detail);
    } catch (reason) {
      if (detailRequestId.current === requestId) setDetailError(String(reason));
    } finally {
      if (detailRequestId.current === requestId) setDetailLoading(false);
    }
  };

  const installGit = async () => {
    if (!gitUrl.trim() || installing) return;
    setInstalling("git");
    setInstallNotice(copy.downloading("Git Skill"));
    setError(null);
    try {
      await invoke("install_skill_from_git", { rawUrl: gitUrl, skillName: null });
      setGitUrl("");
      await loadLocal();
      setInstallNotice(copy.installDone("Git Skill"));
      window.setTimeout(() => setInstallNotice(null), 3200);
    } catch (reason) {
      setError(String(reason));
      setInstallNotice(null);
    } finally {
      setInstalling(null);
    }
  };

  const toggleLocal = async (skill: LocalSkill) => {
    setInstalling(skill.path);
    setError(null);
    try {
      setLocalSkills(await invoke<LocalSkill[]>("set_local_skill_enabled", { id: skill.path, enabled: !skill.enabled }));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setInstalling(null);
    }
  };

  const popularSources = useMemo(() => {
    const sources = new Map<string, number>();
    for (const skill of marketSkills) sources.set(skill.author, (sources.get(skill.author) ?? 0) + skill.stars);
    return [...sources.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([source]) => source);
  }, [marketSkills]);
  const visibleSkills = sourceFilter === "all" ? marketSkills : marketSkills.filter((skill) => skill.author === sourceFilter);

  return (
    <section className="marketPage skillRepositoryPage" aria-labelledby="skill-store-title">
      <header className="marketHero workspacePageHeader">
        <div>
          <span className="marketKicker">SKILL WORKSPACE</span>
          <h2 id="skill-store-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <button type="button" className="secondary" onClick={() => {
          if (tab === "local" || tab === "git") void loadLocal();
          else if (provider === "skillsSh") void loadLeaderboard(leaderboardView);
          else void search();
        }} disabled={marketLoading || localLoading}>{copy.refresh}</button>
      </header>

      <nav className="skillRepositoryTabs" aria-label="Skill repository views">
        {([["market", copy.marketplace], ["local", copy.local], ["git", copy.git]] as const).map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? "isActive" : ""} onClick={() => setTab(value)}>{label}</button>
        ))}
      </nav>

      {error ? <div className="marketError">{error}</div> : null}
      {installNotice ? <div className={`skillInstallNotice${installing ? " isActive" : " isSuccess"}`}><span aria-hidden="true">{installing ? <i className="skillInstallSpinner" /> : "✓"}</span><strong>{installNotice}</strong></div> : null}
      {tab === "market" ? (
        <>
          <div className="skillDiscoveryPanel">
            <div className="skillDiscoveryRow">
              <div className="skillLeaderboardSwitch" aria-label="skills.sh leaderboard">
                <button type="button" className={provider === "skillsSh" && leaderboardView === "all-time" ? "isActive" : ""} onClick={() => switchLeaderboard("all-time")}>◷ {copy.allTime}</button>
                <button type="button" className={provider === "skillsSh" && leaderboardView === "trending" ? "isActive" : ""} onClick={() => switchLeaderboard("trending")}>↗ {copy.trending}</button>
                <button type="button" className={provider === "skillsSh" && leaderboardView === "hot" ? "isActive" : ""} onClick={() => switchLeaderboard("hot")}>☆ {copy.hot}</button>
              </div>
              <div className="marketToolbar skillSearchRow">
                <input className="marketSearch" value={query} onChange={(event) => setQuery(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder={provider === "skillsMp" ? copy.functionalSearch : copy.search} aria-label={copy.search} />
                <button type="button" className="primary" onClick={() => void search()} disabled={marketLoading || (provider === "skillsMp" && !query.trim())}>{marketLoading ? copy.searching : copy.searchButton}</button>
              </div>
              <div className="skillProviderSwitch">
                <button type="button" className={provider === "skillsSh" ? "isActive" : ""} onClick={() => switchProvider("skillsSh")}>{copy.skillsSh}</button>
                <button type="button" className={provider === "skillsMp" ? "isActive" : ""} onClick={() => switchProvider("skillsMp")}>{copy.skillsMp}</button>
              </div>
            </div>
            {provider === "skillsSh" && popularSources.length > 0 ? (
              <div className="skillSourceFilters"><strong>来源</strong><button type="button" className={sourceFilter === "all" ? "isActive" : ""} onClick={() => setSourceFilter("all")}>{copy.allSources}</button>{popularSources.map((source) => <button type="button" key={source} className={sourceFilter === source ? "isActive" : ""} onClick={() => setSourceFilter(source)}>@{source}</button>)}</div>
            ) : null}
          </div>
          {provider === "skillsMp" ? (
            <label className="skillApiKeyField">{copy.apiKey}<input type="password" value={settings.skillsmpApiKey ?? ""} onChange={(event) => onUpdateSettings({ skillsmpApiKey: event.currentTarget.value || null })} placeholder="sk_live_…" autoComplete="off" /><span>{copy.apiKeyHint}</span></label>
          ) : null}
          {marketLoading ? <div className="marketEmpty">{copy.loading}</div> : visibleSkills.length === 0 ? <div className="marketEmpty">{copy.noResults}</div> : (
            <div className="skillLeaderboardGrid">
              {visibleSkills.map((skill) => {
                const rank = marketSkills.findIndex((item) => item.id === skill.id) + 1;
                return <article className="skillLeaderboardCard" key={skill.id}>
                  <button type="button" className="skillLeaderboardDetailTrigger" onClick={() => void openSkillDetail(skill)} aria-label={`查看 ${skill.name} 详情`}>
                    <span className="skillRank">{rank}</span>
                    <span className="skillLeaderboardBody"><span className="skillLeaderboardTitle"><strong>{skill.name}</strong>{skill.official ? <span>官方</span> : null}</span><span className="skillLeaderboardMeta"><span>@{skill.author}</span><span>⇩ {formatCount(skill.stars)}</span>{leaderboardView === "hot" && skill.change !== null ? <span className="isGrowing">+{formatCount(Math.max(0, skill.change))}</span> : null}</span>{skill.description ? <span className="skillLeaderboardDescription">{skill.description}</span> : null}</span>
                  </button>
                  <div className="skillLeaderboardActions"><button type="button" className="skillOpenButton" title={copy.open} onClick={() => onOpenExternalUrl(sourceUrl(skill))}>↗</button><button type="button" className={`skillInstallButton${skill.installed ? " isInstalled" : ""}`} title={skill.installed ? copy.installed : copy.install} disabled={skill.installed || installing !== null || !skill.githubUrl} onClick={() => void installRemote(skill)}>{skill.installed ? "✓" : installing === skill.id ? <i className="skillInstallSpinner" /> : "+"}</button></div>
                </article>;
              })}
            </div>
          )}
        </>
      ) : tab === "git" ? (
        <div className="skillGitInstall"><h3>{copy.git}</h3><p>{copy.gitHint}</p><input className="marketSearch" value={gitUrl} onChange={(event) => setGitUrl(event.currentTarget.value)} placeholder={copy.gitPlaceholder} aria-label={copy.gitPlaceholder} /><button type="button" className="primary" disabled={!gitUrl.trim() || installing !== null} onClick={() => void installGit()}>{installing === "git" ? copy.loading : copy.gitInstall}</button></div>
      ) : (
        <>
          <div className="localSkillSummary"><strong>{localSkills.length}</strong><span>个本地 Skill</span><span>{localSkills.filter((skill) => skill.enabled).length} 个已启用</span></div>
          {localLoading ? <div className="marketEmpty">{copy.loading}</div> : localSkills.length === 0 ? <div className="marketEmpty">{copy.localEmpty}</div> : (
            <div className="localSkillTable" role="table" aria-label="本地 Skill">
              <div className="localSkillTableBody" role="rowgroup">
                {localSkills.map((skill) => (
                  <article className={`localSkillRow${skill.enabled ? " isEnabled" : " isDisabled"}`} key={skill.path} role="row">
                    <div className="localSkillIdentity" role="cell">
                      <span className="localSkillInitial" aria-hidden="true">{skill.name.slice(0, 1).toUpperCase()}</span>
                      <div><h3 title={skill.name}>{skill.name}</h3><span title={skill.path}>{skill.path}</span></div>
                    </div>
                    <p className="localSkillDescription" title={skill.description} role="cell">{skill.description || "暂无功能说明"}</p>
                    <span className="localSkillState" role="cell"><i aria-hidden="true" />{skill.enabled ? copy.enabled : copy.disabled}</span>
                    <div className="localSkillAction" role="cell"><button type="button" className={skill.enabled ? "secondary compactAction" : "primary compactAction"} disabled={installing !== null} onClick={() => void toggleLocal(skill)}>{installing === skill.path ? copy.loading : skill.enabled ? copy.disable : copy.enable}</button></div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {selectedSkill ? createPortal(
        <div className="skillDetailOverlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSkillDetail(); }}>
          <article className="skillDetailDialog" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title">
            <header>
              <div><span>{copy.detail}</span><h3 id="skill-detail-title">{skillDetail?.name || selectedSkill.name}</h3><p>{copy.detailHint}</p></div>
              <button type="button" className="skillDetailClose" onClick={closeSkillDetail} aria-label={copy.close}>×</button>
            </header>
            <div className="skillDetailMeta">
              <span>@{selectedSkill.author}</span>
              <span>⇩ {formatCount(selectedSkill.stars)}</span>
              {selectedSkill.official ? <span>官方认证</span> : null}
              <span className={selectedSkill.installed ? "isInstalled" : ""}>{selectedSkill.installed ? copy.installed : "未安装"}</span>
            </div>
            <section className="skillDetailSummary">
              <strong>功能介绍</strong>
              <p>{skillDetail?.description || selectedSkill.description || "该 Skill 暂未提供简短说明。"}</p>
            </section>
            <section className="skillDetailDocument" aria-live="polite">
              {detailLoading ? <div className="skillDetailLoading"><i className="skillInstallSpinner" />{copy.detailLoading}</div> : detailError ? <div className="skillDetailError"><strong>{copy.detailUnavailable}</strong><span>{detailError}</span></div> : <pre>{skillDetail?.content || selectedSkill.description || copy.detailUnavailable}</pre>}
            </section>
            <footer>
              <span title={skillDetail?.sourcePath}>{skillDetail ? `${copy.sourceFile}：${skillDetail.sourcePath}` : `来源：${selectedSkill.author}`}</span>
              <div><button type="button" className="secondary" onClick={() => onOpenExternalUrl(sourceUrl(selectedSkill))}>查看源码</button><button type="button" className="primary" disabled={selectedSkill.installed || installing !== null || !selectedSkill.githubUrl} onClick={() => void installRemote(selectedSkill)}>{selectedSkill.installed ? copy.installed : installing === selectedSkill.id ? copy.loading : copy.install}</button></div>
            </footer>
          </article>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
