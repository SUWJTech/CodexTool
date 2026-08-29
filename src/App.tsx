import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "./App.css";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { AddAccountSection } from "./components/AddAccountSection";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { AccountsGrid } from "./components/AccountsGrid";
import { AccountStorePanel } from "./components/AccountStorePanel";
import { AppTopBar } from "./components/AppTopBar";
import { DebugFloatingTool } from "./components/DebugFloatingTool";
import { DeleteAccountDialog } from "./components/DeleteAccountDialog";
import { MetaStrip } from "./components/MetaStrip";
import { NoticeBanner } from "./components/NoticeBanner";
import { SettingsPanel } from "./components/SettingsPanel";
import { SkillStorePanel } from "./components/SkillStorePanel";
import { SkinStorePanel } from "./components/SkinStorePanel";
import { UpdateBanner } from "./components/UpdateBanner";
import { useCodexController } from "./hooks/useCodexController";
import { useThemeMode } from "./hooks/useThemeMode";

type AppTab = "accounts" | "analytics" | "store" | "skills" | "skins" | "settings";
const APP_MENU_OPEN_SETTINGS_EVENT = "app-menu-open-settings";
const APP_MENU_CHECK_UPDATE_EVENT = "app-menu-check-update";
const TOKEN_USAGE_FRESHNESS_MS = 5 * 60 * 1000;

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("accounts");
  const { themeMode, toggleTheme } = useThemeMode();
  const {
    accounts,
    tokenUsage,
    tokenUsageError,
    costAnalytics,
    costAnalyticsError,
    mainWindowVisible,
    loading,
    refreshing,
    usageRefreshInFlight,
    initialUsageRefreshPending,
    usageRefreshError,
    refreshingTokenUsage,
    addDialogOpen,
    addDialogMode,
    reauthorizeAccount,
    importingAccounts,
    oauthWaitingForCallback,
    exportingAccounts,
    authBusy,
    switchingId,
    renamingAccountId,
    pendingDeleteId,
    deleteCandidate,
    deletingAccountId,
    checkingUpdate,
    installingUpdate,
    updateProgress,
    pendingUpdate,
    updateDialogOpen,
    skipPendingUpdateVersion,
    notice,
    openExternalUrl,
    settings,
    installedEditorApps,
    hasOpencodeDesktopApp,
    savingSettings,
    costAnalyticsLoading,
    costAnalyticsExporting,
    costAnalyticsProgress,
    refreshUsage,
    refreshTokenUsage,
    loadCostAnalytics,
    refreshCostAnalytics,
    exportCostAnalytics,
    onDeleteCodexSession,
    checkForAppUpdate,
    installPendingUpdate,
    openDebugUpdateDialog,
    openManualDownloadPage,
    closeUpdateDialog,
    updateSettings,
    onOpenAddDialog,
    onOpenRelayDialog,
    onReauthorizeAccount,
    onPrepareOauthLogin,
    onOpenOauthAuthorizationPage,
    onCloseAddDialog,
    onCancelOauthLogin,
    onCompleteOauthCallbackLogin,
    onImportCurrentAuth,
    onCreateApiAccount,
    onTestApiAccountConnection,
    onImportAuthFiles,
    onExportAccounts,
    onRenameAccountLabel,
    onDelete,
    onCancelDelete,
    onConfirmDelete,
    onSwitch,
    onSmartSwitch,
    smartSwitching,
  } = useCodexController(activeTab);

  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== "r") {
        return;
      }
      const isTrigger = isMac ? event.metaKey : event.ctrlKey;
      if (!isTrigger) {
        return;
      }
      event.preventDefault();
      void refreshUsage(false);
      void refreshTokenUsage(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [refreshTokenUsage, refreshUsage]);

  useEffect(() => {
    let disposed = false;
    const unlistenFns: UnlistenFn[] = [];

    const registerAppMenuListeners = async () => {
      try {
        const openSettingsUnlisten = await listen<void>(
          APP_MENU_OPEN_SETTINGS_EVENT,
          () => {
            setActiveTab("settings");
          },
        );
        const checkUpdateUnlisten = await listen<void>(
          APP_MENU_CHECK_UPDATE_EVENT,
          () => {
            void checkForAppUpdate(false);
          },
        );
        if (disposed) {
          void openSettingsUnlisten();
          void checkUpdateUnlisten();
          return;
        }

        unlistenFns.push(openSettingsUnlisten, checkUpdateUnlisten);
      } catch {
        // The app can still run in a browser-only preview where Tauri events are unavailable.
      }
    };

    void registerAppMenuListeners();

    return () => {
      disposed = true;
      for (const unlisten of unlistenFns) {
        void unlisten();
      }
    };
  }, [checkForAppUpdate]);

  useEffect(() => {
    if (activeTab !== "accounts" || !mainWindowVisible) {
      return;
    }

    const updatedAtMs = (tokenUsage?.updatedAt ?? 0) * 1000;
    if (updatedAtMs > 0 && Date.now() < updatedAtMs + TOKEN_USAGE_FRESHNESS_MS) {
      return;
    }

    void refreshTokenUsage(true);
  }, [activeTab, mainWindowVisible, refreshTokenUsage, tokenUsage]);

  const refreshAccountsView = () => {
    if (activeTab === "analytics") {
      void refreshCostAnalytics(false);
      return;
    }
    void refreshUsage(false);
    void refreshTokenUsage(false);
  };

  return (
    <div className={`shell${mainWindowVisible ? "" : " isUiInactive"}`}>
      <div className="ambient" />
      <main className="panel">
        <AppTopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onRefresh={refreshAccountsView}
          refreshing={
            activeTab === "analytics"
              ? costAnalyticsLoading
              : refreshing || refreshingTokenUsage
          }
          onGoHome={() => setActiveTab("accounts")}
          showRefresh={activeTab === "accounts" || activeTab === "analytics"}
        />

        <AddAccountDialog
          open={addDialogOpen}
          mode={addDialogMode}
          reauthorizeAccount={reauthorizeAccount}
          importingAccounts={importingAccounts}
          oauthWaitingForCallback={oauthWaitingForCallback}
          onPrepareOauth={onPrepareOauthLogin}
          onOpenOauthPage={onOpenOauthAuthorizationPage}
          onCompleteOauth={onCompleteOauthCallbackLogin}
          onCancelOauth={onCancelOauthLogin}
          onImportCurrentAuth={onImportCurrentAuth}
          onCreateApiAccount={onCreateApiAccount}
          onTestApiConnection={onTestApiAccountConnection}
          onImportFiles={onImportAuthFiles}
          onClose={onCloseAddDialog}
        />
        <DeleteAccountDialog
          account={deleteCandidate}
          deleting={deletingAccountId === deleteCandidate?.id}
          onCancel={onCancelDelete}
          onConfirm={() => void onConfirmDelete()}
        />

        <NoticeBanner notice={notice} />
        <DebugFloatingTool onOpenUpdateDialog={openDebugUpdateDialog} />
        <UpdateBanner
          open={updateDialogOpen}
          pendingUpdate={pendingUpdate}
          updateProgress={updateProgress}
          installingUpdate={installingUpdate}
          onClose={closeUpdateDialog}
          onManualDownload={() => void openManualDownloadPage()}
          onSkipVersion={() => void skipPendingUpdateVersion()}
          onInstallNow={() => void installPendingUpdate()}
        />
        <section className="viewStage">
          {activeTab === "accounts" ? (
            <div className="accountsPage">
              <AccountsGrid
                leadingContent={
                  <MetaStrip
                    accounts={accounts}
                    exportingAccounts={exportingAccounts}
                    onExportAccounts={() => void onExportAccounts()}
                  />
                }
                toolbarActions={
                  <AddAccountSection
                    onOpenAddDialog={onOpenAddDialog}
                    onOpenRelayDialog={onOpenRelayDialog}
                    onSmartSwitch={() => void onSmartSwitch()}
                    smartSwitching={smartSwitching}
                  />
                }
                accounts={accounts}
                tokenUsage={tokenUsage}
                tokenUsageError={tokenUsageError}
                loading={loading}
                usageRefreshing={usageRefreshInFlight}
                showInitialUsageRefresh={initialUsageRefreshPending}
                usageRefreshError={usageRefreshError}
                exportingAccounts={exportingAccounts}
                authBusy={authBusy}
                switchingId={switchingId}
                renamingAccountId={renamingAccountId}
                pendingDeleteId={pendingDeleteId}
                onExportAll={() => void onExportAccounts()}
                onExport={(account) => void onExportAccounts(account)}
                onReauthorize={(account) => void onReauthorizeAccount(account)}
                onRename={(account, label) =>
                  onRenameAccountLabel(account, label)
                }
                onSwitch={(account) => onSwitch(account)}
                onDelete={(account) => void onDelete(account)}
              />
            </div>
          ) : activeTab === "analytics" ? (
            <AnalyticsPanel
              analytics={costAnalytics}
              error={costAnalyticsError}
              loading={costAnalyticsLoading}
              exporting={costAnalyticsExporting}
              progress={costAnalyticsProgress}
              weeklyBudgetUsd={settings.codexAnalyticsWeeklyBudgetUsd}
              savingSettings={savingSettings}
              onRefresh={() => void refreshCostAnalytics(false)}
              onExport={(format) => void exportCostAnalytics(format)}
              onDeleteSession={(session) => void onDeleteCodexSession(session)}
              onUpdateWeeklyBudget={(value) =>
                updateSettings(
                  { codexAnalyticsWeeklyBudgetUsd: value },
                  { silent: true, keepInteractive: true },
                ).then(async () => {
                  await loadCostAnalytics(true);
                })
              }
            />
          ) : activeTab === "store" ? (
            <AccountStorePanel onOpenExternalUrl={(url) => void openExternalUrl(url)} />
          ) : activeTab === "skills" ? (
            <SkillStorePanel />
          ) : activeTab === "skins" ? (
            <SkinStorePanel />
          ) : (
            <SettingsPanel
              themeMode={themeMode}
              onToggleTheme={toggleTheme}
              checkingUpdate={checkingUpdate}
              onCheckUpdate={() => void checkForAppUpdate(false)}
              onOpenExternalUrl={(url) => void openExternalUrl(url)}
              settings={settings}
              accounts={accounts}
              installedEditorApps={installedEditorApps}
              hasOpencodeDesktopApp={hasOpencodeDesktopApp}
              savingSettings={savingSettings}
              onUpdateSettings={(patch, options) =>
                void updateSettings(patch, options)
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
