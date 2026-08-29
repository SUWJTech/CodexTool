import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";

import { useI18n } from "../i18n/I18nProvider";
import type { ThemeMode } from "../types/app";
import { AppIcon, type AppIconName } from "./AppIcon";

type AppTab = "accounts" | "analytics" | "store" | "skills" | "skins" | "settings";

type AppTopBarProps = {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onGoHome: () => void;
  showRefresh: boolean;
};

export function AppTopBar({
  activeTab,
  onSelectTab,
  themeMode,
  onToggleTheme,
  onRefresh,
  refreshing,
  onGoHome,
  showRefresh,
}: AppTopBarProps) {
  const { copy, locale } = useI18n();
  const marketplaceLabels = locale === "zh-CN"
    ? { store: "账号商城", skills: "Skill 仓库", skins: "皮肤仓库" }
    : { store: "Store", skills: "Skill Repository", skins: "Skin Repository" };
  const navItems: Array<{ id: AppTab; label: string; icon: AppIconName }> = [
    { id: "accounts", label: copy.bottomDock.accounts, icon: "accounts" },
    { id: "analytics", label: copy.bottomDock.analytics, icon: "analytics" },
    { id: "store", label: marketplaceLabels.store, icon: "store" },
    { id: "skills", label: marketplaceLabels.skills, icon: "skills" },
    { id: "skins", label: marketplaceLabels.skins, icon: "skins" },
    { id: "settings", label: copy.bottomDock.settings, icon: "settings" },
  ];
  const handleStartWindowDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (event.buttons !== 1 || !("__TAURI_INTERNALS__" in window)) {
      return;
    }

    event.preventDefault();
    const appWindow = getCurrentWindow();
    // Tauri 手动拖动契约使用 mousedown 的点击计数；双击不能再进入 startDragging。
    if (event.detail === 2) {
      void appWindow.toggleMaximize().catch(() => {});
      return;
    }

    void appWindow.startDragging().catch(() => {});
  };

  return (
    <header className="topbar">
      <button type="button" className="brandLine homeLink" onClick={onGoHome}>
        <img className="appLogo" src="/codextool-glass-icon-clean.png" alt="CodexTool" />
        <span className="brandCopy">
          <h1>CodexTool</h1>
          <span>{locale === "zh-CN" ? "Codex 工作台" : "Codex workspace"}</span>
        </span>
      </button>
      <div
        className="topDragRegion"
        aria-hidden="true"
        onMouseDown={handleStartWindowDrag}
      />
      <nav className="topSegmentedNav" aria-label={copy.bottomDock.ariaLabel}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`topSegmentedButton${activeTab === item.id ? " isActive" : ""}`}
            onClick={() => onSelectTab(item.id)}
            aria-pressed={activeTab === item.id}
          >
            <AppIcon name={item.icon} className="topNavIcon" />
            <span className="topNavLabel">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="topActions">
        <button
          className="iconButton"
          onClick={onToggleTheme}
          title={copy.settings.theme.switchAriaLabel}
          aria-label={copy.settings.theme.switchAriaLabel}
          type="button"
        >
          <AppIcon name={themeMode === "dark" ? "sun" : "moon"} className="iconGlyph" />
        </button>
        {showRefresh ? (
          <button
            className="iconButton"
            onClick={onRefresh}
            disabled={refreshing}
            title={refreshing ? copy.topBar.refreshing : copy.topBar.manualRefresh}
            aria-label={refreshing ? copy.topBar.refreshing : copy.topBar.manualRefresh}
          >
            <AppIcon name="refresh" className={`iconGlyph${refreshing ? " isSpinning" : ""}`} />
          </button>
        ) : null}
      </div>
    </header>
  );
}
