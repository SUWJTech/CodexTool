import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { AppIcon } from "./AppIcon";

type SkinEngineStatus = {
  supported: boolean;
  installed: boolean;
  active: boolean;
  activeThemeId: string | null;
  activeThemeName: string | null;
};

type GalleryTheme = {
  id: string;
  themeId: string;
  name: string;
  version: string;
  license: string;
  authorDisplayName: string;
  downloadCount?: number;
  packageBytes?: number;
  displayMeta?: {
    appearance?: "dark" | "light" | "auto";
    platforms?: string[];
    colors?: { accent?: string; background?: string };
  };
};

type GalleryResponse = { items?: GalleryTheme[]; total?: number };
type BusyAction = "install" | "apply" | "restore" | "refresh" | null;

const COPY = {
  "zh-CN": {
    kicker: "DREAMSKIN 官方主题库",
    title: "皮肤仓库",
    description: "直接读取 DreamSkin.cc 审核主题，在 CodexTool 内完成下载、校验、安装与切换。",
    search: "搜索主题、作者、版本或许可证",
    count: (count: number) => `${count} 个 Windows 可用主题`,
    empty: "没有匹配的官方主题",
    safe: "本地引擎已随 CodexTool 自动部署。应用主题时会验证官方元数据、文件大小与 SHA-256，并按需重启 Codex；不会修改 WindowsApps、app.asar、签名或 ACL。",
    engineReady: "本地换肤引擎已就绪",
    engineMissing: "自动预装未完成，可点击修复本地引擎",
    active: (name: string) => `当前已启用：${name}`,
    inactive: "当前为官方外观",
    install: "修复本地引擎",
    installing: "正在部署…",
    apply: "安装并应用",
    applying: "正在校验并应用…",
    restore: "恢复官方外观",
    restoring: "正在恢复…",
    refresh: "刷新主题",
    refreshing: "刷新中…",
    unsupported: "当前原生换肤运行链路先支持 Windows；macOS 运行器仍在迁移。",
    downloads: "次下载",
  },
  "en-US": {
    kicker: "DREAMSKIN OFFICIAL GALLERY",
    title: "Skin Repository",
    description: "Browse reviewed DreamSkin.cc themes and download, validate, install, and switch them natively in CodexTool.",
    search: "Search themes, creators, versions, or licenses",
    count: (count: number) => `${count} Windows-ready themes`,
    empty: "No matching official themes",
    safe: "The local engine is deployed with CodexTool. Applying validates official metadata, size, and SHA-256 before restarting Codex when needed; WindowsApps, app.asar, signatures, and ACLs remain untouched.",
    engineReady: "Local skin engine ready",
    engineMissing: "Automatic setup did not finish; repair the local engine",
    active: (name: string) => `Active: ${name}`,
    inactive: "Official appearance is active",
    install: "Repair local engine",
    installing: "Deploying…",
    apply: "Install & apply",
    applying: "Validating & applying…",
    restore: "Restore official appearance",
    restoring: "Restoring…",
    refresh: "Refresh themes",
    refreshing: "Refreshing…",
    unsupported: "The native skin runtime currently supports Windows; the macOS runner is still being migrated.",
    downloads: "downloads",
  },
} as const;

const EMPTY_STATUS: SkinEngineStatus = {
  supported: true,
  installed: false,
  active: false,
  activeThemeId: null,
  activeThemeName: null,
};

function formatBytes(bytes: number | undefined) {
  if (!Number.isFinite(bytes)) return "--";
  return `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
}

export function SkinStorePanel() {
  const { locale } = useI18n();
  const copy = locale === "zh-CN" ? COPY["zh-CN"] : COPY["en-US"];
  const desktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SkinEngineStatus>(EMPTY_STATUS);
  const [themes, setThemes] = useState<GalleryTheme[]>([]);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGallery = useCallback(async () => {
    if (!desktop) return;
    setBusy("refresh");
    setError(null);
    try {
      const [nextStatus, gallery] = await Promise.all([
        invoke<SkinEngineStatus>("get_skin_engine_status"),
        invoke<GalleryResponse>("list_skin_gallery"),
      ]);
      setStatus(nextStatus);
      setThemes(Array.isArray(gallery.items) ? gallery.items : []);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(null);
    }
  }, [desktop]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  useEffect(() => {
    if (!desktop || status.installed) return;
    const timer = window.setInterval(() => {
      void invoke<SkinEngineStatus>("get_skin_engine_status")
        .then((next) => setStatus(next))
        .catch(() => {});
    }, 1500);
    return () => window.clearInterval(timer);
  }, [desktop, status.installed]);

  const entries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return themes;
    return themes.filter((entry) =>
      [entry.name, entry.authorDisplayName, entry.themeId, entry.version, entry.license]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, themes]);

  const runAction = async (
    action: Exclude<BusyAction, null>,
    command: string,
    args?: Record<string, unknown>,
  ) => {
    setBusy(action);
    setError(null);
    try {
      setStatus(await invoke<SkinEngineStatus>(command, args));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setApplyingId(null);
      setBusy(null);
    }
  };

  return (
    <section className="marketPage skinMarketPage" aria-labelledby="skin-store-title">
      <header className="marketHero skinMarketHero workspacePageHeader">
        <div>
          <span className="marketKicker">{copy.kicker}</span>
          <h2 id="skin-store-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="marketHeroActions">
          {!status.installed ? (
            <button type="button" className="primary" disabled={busy !== null || !status.supported} onClick={() => void runAction("install", "install_skin_engine")}>
              {busy === "install" ? copy.installing : copy.install}
            </button>
          ) : status.active ? (
            <button type="button" className="secondary" disabled={busy !== null} onClick={() => void runAction("restore", "restore_official_skin")}>
              {busy === "restore" ? copy.restoring : copy.restore}
            </button>
          ) : null}
          <button type="button" className="ghost" disabled={busy !== null || !desktop} onClick={() => void loadGallery()}>
            {busy === "refresh" ? copy.refreshing : copy.refresh}
          </button>
        </div>
      </header>

      <div className="skinSecurityNote">{copy.safe}</div>
      {!status.supported && <div className="marketError">{copy.unsupported}</div>}
      {error && <div className="marketError" role="alert">{error}</div>}

      <div className="skinEngineStatus">
        <span className={`skinEngineDot${status.installed ? " isReady" : ""}${status.active ? " isActive" : ""}`} />
        <div>
          <strong>{status.installed ? copy.engineReady : copy.engineMissing}</strong>
          <span>{status.active ? copy.active(status.activeThemeName ?? status.activeThemeId ?? "DreamSkin") : copy.inactive}</span>
        </div>
      </div>

      <div className="skinCatalogToolbar">
        <label className="skinCatalogSearch">
          <AppIcon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
        </label>
        <span className="marketCount">{copy.count(entries.length)}</span>
      </div>

      {busy === "refresh" && themes.length === 0 ? (
        <div className="marketEmpty">{copy.refreshing}</div>
      ) : entries.length === 0 ? (
        <div className="marketEmpty">{copy.empty}</div>
      ) : (
        <div className="skinCatalogGrid">
          {entries.map((entry) => {
            const appearance = entry.displayMeta?.appearance ?? "auto";
            const active = status.active && status.activeThemeId === entry.themeId;
            const applying = busy === "apply" && applyingId === entry.id;
            return (
              <article key={entry.id} className={`skinCatalogCard${active ? " isActive" : ""}`}>
                <div className="skinCatalogPreview" style={{ background: entry.displayMeta?.colors?.background }}>
                  <img src={`https://api.dreamskin.cc/v1/themes/${encodeURIComponent(entry.id)}/preview/thumbnail`} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  <div className="skinCatalogPreviewBadges"><span>DreamSkin.cc</span><span>{appearance === "auto" ? (locale === "zh-CN" ? "自适应" : "Adaptive") : appearance === "dark" ? (locale === "zh-CN" ? "暗色" : "Dark") : (locale === "zh-CN" ? "浅色" : "Light")}</span></div>
                </div>
                <div className="skinCatalogBody">
                  <div className="skinCatalogTitleRow"><div><h3>{entry.name}</h3><span>by {entry.authorDisplayName}</span></div></div>
                  <div className="skinCatalogTags"><span>v{entry.version}</span><span>{entry.license}</span><span>{formatBytes(entry.packageBytes)}</span></div>
                  <p className="skinGalleryDownloads"><AppIcon name="download" /> {new Intl.NumberFormat(locale).format(entry.downloadCount ?? 0)} {copy.downloads}</p>
                  <button type="button" className={active ? "secondary" : "primary"} disabled={busy !== null || active || !status.installed || !status.supported} onClick={() => { setApplyingId(entry.id); void runAction("apply", "apply_gallery_skin", { versionId: entry.id }); }}>
                    {active ? (locale === "zh-CN" ? "正在使用" : "Active") : applying ? copy.applying : copy.apply}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="marketAttribution">Codex Dream Skin © contributors · MIT · 主题内容来自 DreamSkin.cc 审核图库，CodexTool 不重新托管主题包。</p>
    </section>
  );
}
