import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PROJECT_LATEST_RELEASE_URL } from "../constants/externalLinks";
import { useI18n } from "../i18n/I18nProvider";
import { localizeBackendError } from "../i18n/backendErrors";
import { DEFAULT_LOCALE } from "../i18n/catalog";
import type { MessageCatalog } from "../i18n/catalog";
import type {
  AccountSummary,
  AppSettings,
  AuthJsonImportInput,
  CodexCostAnalyticsProgress,
  CodexCostAnalyticsSnapshot,
  CodexTokenUsageSnapshot,
  CreateApiAccountInput,
  DeleteCodexSessionResult,
  ImportAccountsResult,
  InstalledEditorApp,
  Notice,
  OauthCallbackFinishedEvent,
  PendingUpdateInfo,
  PreparedOauthLogin,
  SwitchAccountResult,
  TestApiAccountConnectionInput,
  TestApiAccountConnectionResult,
  UpdateSettingsOptions,
} from "../types/app";
import {
  pickBestSmartSwitchAccount,
  sortAccountsByRemaining,
} from "../utils/accountRanking";
import {
  getLatestChangelogEntry,
  getUnreleasedChangelogEntry,
} from "../utils/changelog";

const COST_ANALYTICS_STALE_MS = 30 * 60 * 1000;
const UPDATE_CHECK_MS = 60 * 60 * 1000;
const MAIN_WINDOW_VISIBILITY_CHANGED_EVENT = "main-window-visibility-changed";
const PERIODIC_USAGE_REFRESHED_EVENT = "periodic-usage-refreshed";
const DEFAULT_SETTINGS: AppSettings = {
  launchAtStartup: false,
  trayUsageDisplayMode: "oneWeekRemaining",
  trayUsageTitleShowWindowLabels: false,
  macosTrayTextIconStyle: "codexTools",
  windowsTrayIconStyle: "logoProgressRing",
  trayQuotaIconVisible: true,
  macosTrayLogoRingShowPercentage: true,
  windowsTaskbarWidgetPlacement: "left",
  windowsQuotaOnboardingCompleted: true,
  macosQuotaOnboardingCompleted: true,
  launchCodexAfterSwitch: true,
  smartSwitchIncludeApi: false,
  launchCodexAsAdmin: false,
  codexLaunchPath: null,
  syncOpencodeOpenaiAuth: false,
  restartOpencodeDesktopOnSwitch: false,
  restartEditorsOnSwitch: false,
  restartEditorTargets: [],
  codexAnalyticsWeeklyBudgetUsd: null,
  locale: DEFAULT_LOCALE,
  skippedUpdateVersion: null,
  skillsmpApiKey: null,
};

function buildImportNotice(
  result: ImportAccountsResult,
  prefix: string,
  notices: MessageCatalog["notices"],
  locale: string,
): Notice {
  const successCount = result.importedCount + result.updatedCount;
  const failureCount = result.failures.length;
  const firstFailure = result.failures[0];

  if (successCount === 0) {
    if (firstFailure) {
      return {
        type: "error",
        message: notices.importFailedWithSource(
          prefix,
          firstFailure.source,
          firstFailure.error,
        ),
      };
    }
    return {
      type: "error",
      message: notices.importFailedNoValidJson(prefix),
    };
  }

  const segments: string[] = [];
  if (result.importedCount > 0) {
    segments.push(notices.importSummaryAdded(result.importedCount));
  }
  if (result.updatedCount > 0) {
    segments.push(notices.importSummaryUpdated(result.updatedCount));
  }
  if (failureCount > 0) {
    segments.push(notices.importSummaryFailed(failureCount));
  }

  const suffix =
    failureCount > 0 && firstFailure
      ? notices.importSummaryFirstFailure(
          firstFailure.source,
          firstFailure.error,
        )
      : "";
  const listFormatter = new Intl.ListFormat(locale, {
    style: "short",
    type: "conjunction",
  });

  return {
    type: failureCount > 0 ? "info" : "ok",
    message: notices.importSummaryDone(
      prefix,
      listFormatter.format(segments),
      suffix,
    ),
  };
}

export function useCodexController(
  activeTab: "accounts" | "analytics" | "store" | "skills" | "skins" | "settings",
) {
  const { copy, locale } = useI18n();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [tokenUsage, setTokenUsage] = useState<CodexTokenUsageSnapshot | null>(
    null,
  );
  const [tokenUsageError, setTokenUsageError] = useState<string | null>(null);
  const [mainWindowShown, setMainWindowShown] = useState(true);
  const [mainWindowMinimized, setMainWindowMinimized] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const mainWindowVisible =
    mainWindowShown && !mainWindowMinimized && documentVisible;
  const [costAnalytics, setCostAnalytics] =
    useState<CodexCostAnalyticsSnapshot | null>(null);
  const [costAnalyticsError, setCostAnalyticsError] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usageRefreshInFlight, setUsageRefreshInFlight] = useState(false);
  const [initialUsageRefreshPending, setInitialUsageRefreshPending] =
    useState(true);
  const [usageRefreshError, setUsageRefreshError] = useState<string | null>(null);
  const [refreshingTokenUsage, setRefreshingTokenUsage] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogMode, setAddDialogMode] = useState<"account" | "relay">(
    "account",
  );
  const [reauthorizeAccount, setReauthorizeAccount] =
    useState<AccountSummary | null>(null);
  const [importingAccounts, setImportingAccounts] = useState(false);
  const [oauthWaitingForCallback, setOauthWaitingForCallback] = useState(false);
  const [exportingAccounts, setExportingAccounts] = useState(false);
  const [costAnalyticsLoading, setCostAnalyticsLoading] = useState(true);
  const [costAnalyticsExporting, setCostAnalyticsExporting] = useState<
    "csv" | "json" | null
  >(null);
  const [costAnalyticsProgress, setCostAnalyticsProgress] =
    useState<CodexCostAnalyticsProgress | null>(null);
  const costAnalyticsRefreshInFlightRef = useRef(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [renamingAccountId, setRenamingAccountId] = useState<string | null>(
    null,
  );
  const [deleteCandidate, setDeleteCandidate] = useState<AccountSummary | null>(
    null,
  );
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null,
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdateInfo | null>(
    null,
  );
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [installedEditorApps, setInstalledEditorApps] = useState<
    InstalledEditorApp[]
  >([]);
  const [hasOpencodeDesktopApp, setHasOpencodeDesktopApp] = useState(false);
  const installingUpdateRef = useRef(false);
  const settingsUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const tokenUsageRefreshInFlightRef = useRef(false);
  const usageBootstrapStartedRef = useRef(false);
  const usageRefreshCountRef = useRef(0);
  const usageRefreshSequenceRef = useRef(0);
  const costAnalyticsProgressVisibleRef = useRef(false);
  const reloginPromptedAccountKeysRef = useRef<Set<string>>(new Set());
  const profileIntegrityPromptedRef = useRef(false);
  const switchInFlightRef = useRef(false);

  const sortedAccounts = useMemo(
    () => sortAccountsByRemaining(accounts),
    [accounts],
  );
  const authBusy =
    importingAccounts || oauthWaitingForCallback || switchingId !== null;

  const localizeError = useCallback(
    (error: string) => localizeBackendError(error, locale),
    [locale],
  );

  const localizeAccounts = useCallback(
    (items: AccountSummary[]) =>
      items.map((account) => ({
        ...account,
        usageError: account.usageError
          ? localizeError(account.usageError)
          : null,
        authRefreshError: account.authRefreshError
          ? localizeError(account.authRefreshError)
          : null,
        profileIntegrityError: account.profileIntegrityError
          ? localizeError(account.profileIntegrityError)
          : null,
        profileLastValidationError: account.profileLastValidationError
          ? localizeError(account.profileLastValidationError)
          : null,
      })),
    [localizeError],
  );

  const applyAccounts = useCallback(
    (items: AccountSummary[], options?: { notifyBlocked?: boolean }) => {
      const localized = localizeAccounts(items);
      setAccounts(localized);

      const activeBlockedKeys = new Set(
        localized
          .filter(
            (account) => account.authRefreshBlocked && account.authRefreshError,
          )
          .map((account) => account.accountKey),
      );
      reloginPromptedAccountKeysRef.current.forEach((accountKey) => {
        if (!activeBlockedKeys.has(accountKey)) {
          reloginPromptedAccountKeysRef.current.delete(accountKey);
        }
      });

      if (options?.notifyBlocked === false) {
        return false;
      }

      const nextBlockedAccount = localized.find(
        (account) =>
          account.authRefreshBlocked &&
          account.authRefreshError &&
          !reloginPromptedAccountKeysRef.current.has(account.accountKey),
      );
      if (!nextBlockedAccount) {
        return false;
      }

      reloginPromptedAccountKeysRef.current.add(nextBlockedAccount.accountKey);
      setNotice({
        type: "info",
        message: copy.notices.reloginRequired(nextBlockedAccount.label),
      });
      return true;
    },
    [copy.notices, localizeAccounts],
  );

  const localizeImportResult = useCallback(
    (result: ImportAccountsResult): ImportAccountsResult => ({
      ...result,
      failures: result.failures.map((failure) => ({
        ...failure,
        error: localizeError(failure.error),
      })),
    }),
    [localizeError],
  );

  const loadAccounts = useCallback(async () => {
    const data = await invoke<AccountSummary[]>("list_accounts");
    applyAccounts(data);
    return data;
  }, [applyAccounts]);

  const maybeShowProfileIntegrityNotice = useCallback(
    (items: AccountSummary[]) => {
      if (profileIntegrityPromptedRef.current) {
        return;
      }
      const incompleteCount = items.filter(
        (account) => account.profileIntegrityError,
      ).length;
      if (incompleteCount <= 0) {
        return;
      }
      profileIntegrityPromptedRef.current = true;
      setNotice({
        type: "info",
        message: copy.notices.profileIntegrityWarning(incompleteCount),
      });
    },
    [copy.notices],
  );

  const loadSettings = useCallback(async () => {
    try {
      const data = await invoke<AppSettings>("get_app_settings");
      settingsRef.current = data;
      setSettings(data);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  const loadInstalledEditorApps = useCallback(async () => {
    try {
      const data = await invoke<InstalledEditorApp[]>(
        "list_installed_editor_apps",
      );
      setInstalledEditorApps(data);
    } catch {
      setInstalledEditorApps([]);
    }
  }, []);

  const loadOpencodeDesktopAppInstalled = useCallback(async () => {
    try {
      const installed = await invoke<boolean>(
        "is_opencode_desktop_app_installed",
      );
      setHasOpencodeDesktopApp(installed);
    } catch {
      setHasOpencodeDesktopApp(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>, options?: UpdateSettingsOptions) => {
      const shouldLockUi = !options?.keepInteractive;
      const task = async () => {
        if (shouldLockUi) {
          setSavingSettings(true);
        }

        try {
          const data = await invoke<AppSettings>("update_app_settings", {
            patch,
          });
          settingsRef.current = data;
          setSettings(data);
          if (!options?.silent) {
            setNotice({ type: "ok", message: copy.notices.settingsUpdated });
          }
        } catch (error) {
          setNotice({
            type: "error",
            message: copy.notices.updateSettingsFailed(
              localizeError(String(error)),
            ),
          });
          if (options?.throwOnError) {
            throw error;
          }
        } finally {
          if (shouldLockUi) {
            setSavingSettings(false);
          }
        }
      };

      const run = settingsUpdateQueueRef.current.then(task, task);
      settingsUpdateQueueRef.current = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    [copy.notices, localizeError],
  );

  const refreshUsage = useCallback(
    async (
      quiet = false,
      forceAuthRefresh = !quiet,
      initialRefresh = false,
      source: "startup" | "account-import" | "manual" =
        "manual",
    ) => {
      const requestId = usageRefreshSequenceRef.current + 1;
      usageRefreshSequenceRef.current = requestId;
      usageRefreshCountRef.current += 1;
      setUsageRefreshInFlight(true);
      setUsageRefreshError(null);

      try {
        if (!quiet) {
          setRefreshing(true);
        }
        const data = await invoke<AccountSummary[]>("refresh_all_usage", {
          forceAuthRefresh,
          source,
        });
        const promptedRelogin = applyAccounts(data);
        if (requestId === usageRefreshSequenceRef.current) {
          setUsageRefreshError(null);
        }
        if (!quiet && !promptedRelogin) {
          setNotice({ type: "ok", message: copy.notices.usageRefreshed });
        }
      } catch (error) {
        const localizedError = localizeError(String(error));
        if (requestId === usageRefreshSequenceRef.current) {
          setUsageRefreshError(localizedError);
        }
        if (!quiet) {
          setNotice({
            type: "error",
            message: copy.notices.refreshFailed(localizedError),
          });
        }
      } finally {
        if (initialRefresh) {
          setInitialUsageRefreshPending(false);
        }
        usageRefreshCountRef.current = Math.max(
          0,
          usageRefreshCountRef.current - 1,
        );
        if (usageRefreshCountRef.current === 0) {
          setUsageRefreshInFlight(false);
        }
        if (!quiet) {
          setRefreshing(false);
        }
      }
    },
    [applyAccounts, copy.notices, localizeError],
  );

  const refreshTokenUsage = useCallback(
    async (quiet = false) => {
      if (tokenUsageRefreshInFlightRef.current) {
        return;
      }
      tokenUsageRefreshInFlightRef.current = true;
      try {
        if (!quiet) {
          setRefreshingTokenUsage(true);
        }
        const data = await invoke<CodexTokenUsageSnapshot>(
          "get_codex_token_usage",
        );
        setTokenUsage(data);
        setTokenUsageError(null);
      } catch (error) {
        const localized = localizeError(String(error));
        setTokenUsageError(localized);
        if (!quiet) {
          setNotice({
            type: "error",
            message: copy.notices.refreshFailed(localized),
          });
        }
      } finally {
        tokenUsageRefreshInFlightRef.current = false;
        if (!quiet) {
          setRefreshingTokenUsage(false);
        }
      }
    },
    [copy.notices, localizeError],
  );

  const loadCostAnalytics = useCallback(
    async (quiet = false) => {
      try {
        if (!quiet) {
          setCostAnalyticsLoading(true);
        }
        const data = await invoke<CodexCostAnalyticsSnapshot | null>(
          "get_cached_codex_cost_analytics",
        );
        if (data) {
          setCostAnalytics(data);
          setCostAnalyticsError(null);
        }
        return data;
      } catch (error) {
        const localized = localizeError(String(error));
        setCostAnalyticsError(localized);
        if (!quiet) {
          setNotice({
            type: "error",
            message: copy.notices.refreshFailed(localized),
          });
        }
        return null;
      } finally {
        if (!costAnalyticsRefreshInFlightRef.current) {
          setCostAnalyticsLoading(false);
        }
      }
    },
    [copy.notices, localizeError],
  );

  const refreshCostAnalytics = useCallback(
    async (quiet = false) => {
      if (costAnalyticsRefreshInFlightRef.current) {
        return null;
      }
      costAnalyticsRefreshInFlightRef.current = true;
      costAnalyticsProgressVisibleRef.current = !quiet;
      if (!quiet) {
        setCostAnalyticsLoading(true);
        setCostAnalyticsProgress({
          stage: "scanning",
          processedFiles: 0,
          totalFiles: 0,
          percent: 0,
          currentPath: null,
        });
      }
      try {
        const data = await invoke<CodexCostAnalyticsSnapshot>(
          "refresh_codex_cost_analytics",
        );
        setCostAnalytics(data);
        setCostAnalyticsError(null);
        return data;
      } catch (error) {
        const localized = localizeError(String(error));
        setCostAnalyticsError(localized);
        if (!quiet) {
          setNotice({
            type: "error",
            message: copy.notices.refreshFailed(localized),
          });
        }
        return null;
      } finally {
        costAnalyticsRefreshInFlightRef.current = false;
        const shouldClearVisibleProgress =
          costAnalyticsProgressVisibleRef.current;
        costAnalyticsProgressVisibleRef.current = false;
        setCostAnalyticsLoading(false);
        if (shouldClearVisibleProgress) {
          window.setTimeout(() => setCostAnalyticsProgress(null), 600);
        }
      }
    },
    [copy.notices, localizeError],
  );

  const exportCostAnalytics = useCallback(
    async (format: "csv" | "json") => {
      if (costAnalyticsExporting) {
        return;
      }

      setCostAnalyticsExporting(format);
      try {
        const exportedPath = await invoke<string | null>(
          "export_codex_cost_analytics",
          {
            format,
          },
        );
        if (exportedPath) {
          setNotice({
            type: "ok",
            message: copy.notices.codexAnalyticsExported,
          });
        }
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.codexAnalyticsExportFailed(
            localizeError(String(error)),
          ),
        });
      } finally {
        setCostAnalyticsExporting(null);
      }
    },
    [copy.notices, costAnalyticsExporting, localizeError],
  );

  const onDeleteCodexSession = useCallback(
    async (session: { sessionId: string; sourcePath: string }) => {
      try {
        const result = await invoke<DeleteCodexSessionResult>(
          "delete_codex_session",
          {
            sourcePath: session.sourcePath,
            sessionId: session.sessionId,
          },
        );
        setNotice({
          type: "ok",
          message: copy.notices.codexSessionDeleted(result.sessionId),
        });
        await refreshCostAnalytics(true);
      } catch (error) {
        const message = localizeError(String(error));
        setNotice({
          type: "error",
          message: copy.notices.codexSessionDeleteFailed(message),
        });
        throw new Error(message);
      }
    },
    [copy.notices, localizeError, refreshCostAnalytics],
  );

  const applyImportResult = useCallback(
    async (result: ImportAccountsResult, prefix: string) => {
      const successCount = result.importedCount + result.updatedCount;
      if (successCount > 0) {
        await loadAccounts();
      }

      if (successCount > 0 && result.failures.length === 0) {
        setAddDialogOpen(false);
      }

      setNotice(buildImportNotice(result, prefix, copy.notices, locale));
    },
    [copy.notices, loadAccounts, locale],
  );

  useEffect(() => {
    installingUpdateRef.current = installingUpdate;
  }, [installingUpdate]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const ttl = notice.type === "error" ? 6_000 : 3_500;
    const timer = window.setTimeout(() => {
      setNotice((current) => (current === notice ? null : current));
    }, ttl);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  const installPendingUpdate = useCallback(
    async () => {
      if (installingUpdateRef.current) {
        return;
      }

      if (pendingUpdate?.debugPreview) {
        setPendingUpdate(null);
        setUpdateProgress(null);
        setUpdateDialogOpen(false);
        return;
      }

      setInstallingUpdate(true);
      setUpdateProgress(copy.notices.preparingUpdateDownload);
      try {
        if (!pendingUpdate) {
          setPendingUpdate(null);
          setUpdateDialogOpen(false);
          setNotice({ type: "ok", message: copy.notices.alreadyLatest });
          return;
        }
        await invoke("open_external_url", {
          url: pendingUpdate.releaseUrl || PROJECT_LATEST_RELEASE_URL,
        });
        setUpdateDialogOpen(false);
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.updateInstallFailed(
            localizeError(String(error)),
          ),
        });
        setUpdateProgress(null);
      } finally {
        setInstallingUpdate(false);
      }
    },
    [copy.notices, localizeError, pendingUpdate],
  );

  const checkForAppUpdate = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setCheckingUpdate(true);
      }
      try {
        const update = await invoke<PendingUpdateInfo | null>("check_github_release");
        if (update) {
          if (
            quiet &&
            settingsRef.current.skippedUpdateVersion === update.version
          ) {
            return;
          }

          setUpdateProgress(null);
          setPendingUpdate({
            currentVersion: update.currentVersion,
            version: update.version,
            body: update.body,
            date: update.date,
            releaseUrl: update.releaseUrl,
            manualOnly: true,
          });
          setUpdateDialogOpen(true);
          if (!quiet) {
            setNotice({
              type: "info",
              message: copy.notices.foundNewVersion(
                update.version,
                update.currentVersion,
              ),
            });
          }
        } else {
          setPendingUpdate(null);
          setUpdateDialogOpen(false);
          setUpdateProgress(null);
          if (!quiet) {
            setNotice({ type: "ok", message: copy.notices.alreadyLatest });
          }
        }
      } catch (error) {
        if (!quiet) {
          setNotice({
            type: "error",
            message: copy.notices.updateCheckFailed(
              localizeError(String(error)),
            ),
          });
        }
      } finally {
        if (!quiet) {
          setCheckingUpdate(false);
        }
      }
    },
    [copy.notices, localizeError],
  );

  const openManualDownloadPage = useCallback(async () => {
    try {
      await invoke("open_external_url", { url: PROJECT_LATEST_RELEASE_URL });
    } catch (error) {
      setNotice({
        type: "error",
        message: copy.notices.openManualDownloadFailed(
          localizeError(String(error)),
        ),
      });
    }
  }, [copy.notices, localizeError]);

  const openExternalUrl = useCallback(
    async (url: string) => {
      try {
        await invoke("open_external_url", { url });
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.openExternalFailed(
            localizeError(String(error)),
          ),
        });
      }
    },
    [copy.notices, localizeError],
  );

  const closeUpdateDialog = useCallback(() => {
    setUpdateDialogOpen(false);
  }, []);

  const openDebugUpdateDialog = useCallback(() => {
    const latestChangelogEntry =
      getUnreleasedChangelogEntry(locale) ?? getLatestChangelogEntry(locale);
    const version = latestChangelogEntry?.version ?? "0.0.0";
    const body = latestChangelogEntry?.items
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n");

    setUpdateProgress(null);
    setPendingUpdate({
      currentVersion: "debug-local",
      version,
      body,
      date: new Date().toISOString().slice(0, 10),
      debugPreview: true,
    });
    setUpdateDialogOpen(true);
  }, [locale]);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen<boolean>(MAIN_WINDOW_VISIBILITY_CHANGED_EVENT, (event) => {
      if (!disposed) {
        setMainWindowShown(event.payload);
      }
    })
      .then((fn) => {
        if (disposed) {
          void fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen<AccountSummary[]>(
      PERIODIC_USAGE_REFRESHED_EVENT,
      (event) => {
        if (!disposed) {
          applyAccounts(event.payload);
          setUsageRefreshError(null);
        }
      },
    )
      .then((fn) => {
        if (disposed) {
          void fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [applyAccounts]);

  useEffect(() => {
    let disposed = false;
    let unlistenResized: UnlistenFn | null = null;
    const syncDocumentVisibility = () => {
      setDocumentVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", syncDocumentVisibility);

    if (!("__TAURI_INTERNALS__" in window)) {
      return () => {
        disposed = true;
        document.removeEventListener(
          "visibilitychange",
          syncDocumentVisibility,
        );
      };
    }

    const currentWindow = getCurrentWindow();
    const syncMinimized = async () => {
      try {
        const minimized = await currentWindow.isMinimized();
        if (!disposed) {
          setMainWindowMinimized(minimized);
        }
      } catch {
        // Native window state can briefly be unavailable during shutdown.
      }
    };
    void currentWindow
      .onResized(() => {
        void syncMinimized();
      })
      .then((unlisten) => {
        if (disposed) {
          void unlisten();
          return;
        }
        unlistenResized = unlisten;
      })
      .catch(() => {});
    void syncMinimized();

    return () => {
      disposed = true;
      document.removeEventListener(
        "visibilitychange",
        syncDocumentVisibility,
      );
      if (unlistenResized) {
        void unlistenResized();
      }
    };
  }, []);

  const skipPendingUpdateVersion = useCallback(async () => {
    if (!pendingUpdate) {
      return;
    }

    setPendingUpdate(null);
    setUpdateProgress(null);
    setUpdateDialogOpen(false);

    if (pendingUpdate.debugPreview) {
      return;
    }

    await updateSettings(
      { skippedUpdateVersion: pendingUpdate.version },
      { silent: true, keepInteractive: true },
    );
  }, [pendingUpdate, updateSettings]);

  useEffect(() => {
    if (usageBootstrapStartedRef.current) {
      return;
    }
    usageBootstrapStartedRef.current = true;

    const bootstrap = async () => {
      try {
        // 账号列表和已缓存用量都来自本地存储，必须优先完成，不能被
        // 代理统计或网络请求阻塞首屏。编辑器仅在进入设置页时扫描。
        const initialAccounts = await loadAccounts();
        maybeShowProfileIntegrityNotice(initialAccounts);
      } finally {
        setLoading(false);
      }

      // 这些任务不影响已有账号和缓存用量的展示。并行执行可避免一个
      // 慢速网络请求（用量刷新上限为 18 秒）拖住其他初始化任务。
      const settingsTask = loadSettings();
      void Promise.allSettled([
        settingsTask,
        // A clean installation has no cached usage yet. Allow this one silent
        // startup refresh to renew stale auth tokens, while periodic refreshes
        // remain lightweight and do not rotate credentials unnecessarily.
        refreshUsage(true, true, true, "startup"),
        refreshTokenUsage(true),
        settingsTask.then(() => checkForAppUpdate(true)),
      ]);
    };

    void bootstrap();
  }, [
    checkForAppUpdate,
    loadAccounts,
    loadSettings,
    maybeShowProfileIntegrityNotice,
    refreshTokenUsage,
    refreshUsage,
  ]);

  useEffect(() => {
    if (!mainWindowVisible) {
      return;
    }

    const updateTimer = window.setInterval(() => {
      void checkForAppUpdate(true);
    }, UPDATE_CHECK_MS);

    return () => {
      window.clearInterval(updateTimer);
    };
  }, [
    checkForAppUpdate,
    mainWindowVisible,
  ]);

  useEffect(() => {
    if (!mainWindowVisible || activeTab !== "settings") {
      return;
    }

    void loadInstalledEditorApps();
    void loadOpencodeDesktopAppInstalled();
  }, [
    activeTab,
    loadInstalledEditorApps,
    loadOpencodeDesktopAppInstalled,
    mainWindowVisible,
  ]);

  useEffect(() => {
    if (!mainWindowVisible || activeTab !== "analytics") {
      return;
    }

    let cancelled = false;
    void (async () => {
      const cached = await loadCostAnalytics(true);
      if (cancelled) {
        return;
      }
      const updatedAtMs = (cached?.updatedAt ?? 0) * 1000;
      const stale =
        !cached || Date.now() >= updatedAtMs + COST_ANALYTICS_STALE_MS;
      if (stale) {
        await refreshCostAnalytics(Boolean(cached));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    loadCostAnalytics,
    mainWindowVisible,
    refreshCostAnalytics,
  ]);

  useEffect(() => {
    if (loading) {
      return;
    }

    void loadAccounts();
  }, [loadAccounts, loading, locale]);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen<CodexCostAnalyticsProgress>(
      "codex-cost-analytics-progress",
      (event) => {
        if (!disposed && costAnalyticsProgressVisibleRef.current) {
          setCostAnalyticsProgress(event.payload);
        }
      },
    )
      .then((fn) => {
        if (disposed) {
          void fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen<OauthCallbackFinishedEvent>(
      "oauth-callback-finished",
      (event) => {
        if (disposed) {
          return;
        }

        setOauthWaitingForCallback(false);
        if (event.payload.result) {
          void applyImportResult(
            localizeImportResult(event.payload.result),
            copy.notices.oauthImportPrefix,
          );
          setReauthorizeAccount(null);
          return;
        }

        if (event.payload.error) {
          setNotice({
            type: "error",
            message: copy.notices.importFailedPlain(
              copy.notices.oauthImportPrefix,
              localizeError(event.payload.error),
            ),
          });
        }
      },
    )
      .then((fn) => {
        if (disposed) {
          void fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [applyImportResult, copy.notices, localizeError, localizeImportResult]);

  const onOpenAddDialog = useCallback(() => {
    setOauthWaitingForCallback(false);
    setReauthorizeAccount(null);
    setAddDialogMode("account");
    setAddDialogOpen(true);
  }, []);

  const onOpenRelayDialog = useCallback(() => {
    setOauthWaitingForCallback(false);
    setReauthorizeAccount(null);
    setAddDialogMode("relay");
    setAddDialogOpen(true);
  }, []);

  const onPrepareOauthLogin = useCallback(async () => {
    setOauthWaitingForCallback(false);
    try {
      return await invoke<PreparedOauthLogin>("prepare_oauth_login", {
        accountId: reauthorizeAccount?.id ?? null,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: copy.notices.oauthLinkPrepareFailed(
          localizeError(String(error)),
        ),
      });
      throw error;
    }
  }, [copy.notices, localizeError, reauthorizeAccount]);

  const onOpenOauthAuthorizationPage = useCallback(
    async (url: string) => {
      setOauthWaitingForCallback(true);
      try {
        await invoke<void>("open_external_url", { url });
      } catch (error) {
        setOauthWaitingForCallback(false);
        setNotice({
          type: "error",
          message: copy.notices.openExternalFailed(
            localizeError(String(error)),
          ),
        });
      }
    },
    [copy.notices, localizeError],
  );

  const onCancelOauthLogin = useCallback(async () => {
    setOauthWaitingForCallback(false);
    try {
      await invoke<void>("cancel_oauth_login");
    } catch {
      // Ignore cancel failures so closing the dialog stays responsive.
    }
  }, []);

  const onCloseAddDialog = useCallback(() => {
    if (importingAccounts) {
      return;
    }

    if (!oauthWaitingForCallback) {
      void onCancelOauthLogin();
    }
    setAddDialogOpen(false);
    setReauthorizeAccount(null);
  }, [importingAccounts, oauthWaitingForCallback, onCancelOauthLogin]);

  const onReauthorizeAccount = useCallback((account: AccountSummary) => {
    setOauthWaitingForCallback(false);
    setReauthorizeAccount(account);
    setAddDialogMode(account.sourceKind === "relay" ? "relay" : "account");
    setAddDialogOpen(true);
  }, []);

  const onImportCurrentAuth = useCallback(async () => {
    if (importingAccounts) {
      return;
    }

    setImportingAccounts(true);
    try {
      await invoke<AccountSummary>("import_current_auth_account", {
        label: null,
      });
      await refreshUsage(true, false, false, "account-import");
      await loadAccounts();
      setAddDialogOpen(false);
      setNotice({
        type: "ok",
        message: copy.notices.currentAccountImportSuccess,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: copy.notices.currentAccountImportFailed(
          localizeError(String(error)),
        ),
      });
    } finally {
      setImportingAccounts(false);
    }
  }, [
    copy.notices,
    importingAccounts,
    loadAccounts,
    localizeError,
    refreshUsage,
  ]);

  const onImportAuthFiles = useCallback(
    async (items: AuthJsonImportInput[]) => {
      if (items.length === 0) {
        setNotice({ type: "error", message: copy.notices.importFilesRequired });
        return;
      }

      setImportingAccounts(true);
      try {
        const result = await invoke<ImportAccountsResult>(
          "import_auth_json_accounts",
          {
            items,
          },
        );
        await applyImportResult(
          localizeImportResult(result),
          copy.notices.fileImportPrefix,
        );
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.importFailedPlain(
            copy.notices.fileImportPrefix,
            localizeError(String(error)),
          ),
        });
      } finally {
        setImportingAccounts(false);
      }
    },
    [applyImportResult, copy.notices, localizeError, localizeImportResult],
  );

  const onCreateApiAccount = useCallback(
    async (input: CreateApiAccountInput) => {
      setImportingAccounts(true);
      try {
        await invoke<AccountSummary>("create_api_account", { input });
        await loadAccounts();
        setAddDialogOpen(false);
        setNotice({
          type: "ok",
          message: copy.notices.apiAccountCreated(input.label),
        });
      } catch (error) {
        const message = localizeError(String(error));
        setNotice({
          type: "error",
          message: copy.notices.apiAccountCreateFailed(message),
        });
        throw new Error(message);
      } finally {
        setImportingAccounts(false);
      }
    },
    [copy.notices, loadAccounts, localizeError],
  );

  const onUpdateApiAccount = useCallback(
    async (accountId: string, input: CreateApiAccountInput) => {
      setImportingAccounts(true);
      try {
        await invoke<AccountSummary>("update_api_account", {
          accountId,
          input,
        });
        await loadAccounts();
        setAddDialogOpen(false);
        setReauthorizeAccount(null);
        setNotice({
          type: "ok",
          message: copy.notices.apiAccountCreated(input.label),
        });
      } catch (error) {
        const message = localizeError(String(error));
        setNotice({
          type: "error",
          message: copy.notices.apiAccountCreateFailed(message),
        });
        throw new Error(message);
      } finally {
        setImportingAccounts(false);
      }
    },
    [copy.notices, loadAccounts, localizeError],
  );

  const onTestApiAccountConnection = useCallback(
    async (input: TestApiAccountConnectionInput) => {
      try {
        return await invoke<TestApiAccountConnectionResult>(
          "test_api_account_connection",
          {
            input,
          },
        );
      } catch (error) {
        throw new Error(localizeError(String(error)));
      }
    },
    [localizeError],
  );

  const onCompleteOauthCallbackLogin = useCallback(
    async (callbackUrl: string) => {
      setOauthWaitingForCallback(false);
      setImportingAccounts(true);
      try {
        const result = await invoke<ImportAccountsResult>(
          "complete_oauth_callback_login",
          {
            callbackUrl,
          },
        );
        await applyImportResult(
          localizeImportResult(result),
          copy.notices.oauthImportPrefix,
        );
        setReauthorizeAccount(null);
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.importFailedPlain(
            copy.notices.oauthImportPrefix,
            localizeError(String(error)),
          ),
        });
        throw error;
      } finally {
        setImportingAccounts(false);
      }
    },
    [
      applyImportResult,
      copy.notices,
      localizeError,
      localizeImportResult,
      setOauthWaitingForCallback,
    ],
  );

  const onExportAccounts = useCallback(
    async (account?: AccountSummary) => {
      if (exportingAccounts) {
        return;
      }

      setExportingAccounts(true);
      try {
        const exportedPath = await invoke<string | null>(
          "export_accounts_zip",
          {
            accountKey: account?.accountKey ?? null,
          },
        );
        if (exportedPath) {
          setNotice({ type: "ok", message: copy.notices.accountsExported });
        }
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.accountsExportFailed(
            localizeError(String(error)),
          ),
        });
      } finally {
        setExportingAccounts(false);
      }
    },
    [copy.notices, exportingAccounts, localizeError],
  );


  const onRenameAccountLabel = useCallback(
    async (account: AccountSummary, label: string): Promise<boolean> => {
      const normalizedLabel = label.trim();
      if (!normalizedLabel) {
        return false;
      }
      if (normalizedLabel === account.label.trim()) {
        return true;
      }
      if (renamingAccountId === account.accountKey) {
        return false;
      }

      setRenamingAccountId(account.accountKey);
      try {
        const resolvedLabel = await invoke<string>("update_account_label", {
          accountKey: account.accountKey,
          label: normalizedLabel,
        });
        setAccounts((prev) =>
          prev.map((item) =>
            item.accountKey === account.accountKey
              ? {
                  ...item,
                  label: resolvedLabel,
                }
              : item,
          ),
        );
        setNotice({
          type: "ok",
          message: copy.notices.accountAliasUpdated(resolvedLabel),
        });
        return true;
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.accountAliasUpdateFailed(
            localizeError(String(error)),
          ),
        });
        return false;
      } finally {
        setRenamingAccountId((current) =>
          current === account.accountKey ? null : current,
        );
      }
    },
    [copy.notices, localizeError, renamingAccountId],
  );

  const onDelete = useCallback(
    async (account: AccountSummary) => {
      setDeleteCandidate(account);
      setNotice({
        type: "info",
        message: copy.notices.deleteConfirm(account.label),
      });
    },
    [copy.notices],
  );

  const onCancelDelete = useCallback(() => {
    if (deletingAccountId !== null) {
      return;
    }
    setDeleteCandidate(null);
  }, [deletingAccountId]);

  const onConfirmDelete = useCallback(
    async () => {
      if (!deleteCandidate || deletingAccountId !== null) {
        return;
      }

      const account = deleteCandidate;
      setDeletingAccountId(account.id);
      try {
        await invoke<void>("delete_account", { id: account.id });
        setAccounts((prev) => prev.filter((item) => item.id !== account.id));
        setDeleteCandidate(null);
        setNotice({ type: "ok", message: copy.notices.accountDeleted });
      } catch (error) {
        setNotice({
          type: "error",
          message: copy.notices.deleteFailed(localizeError(String(error))),
        });
      } finally {
        setDeletingAccountId(null);
      }
    },
    [copy.notices, deleteCandidate, deletingAccountId, localizeError],
  );

  const onSwitch = useCallback(
    async (account: AccountSummary) => {
      if (
        switchInFlightRef.current ||
        importingAccounts ||
        oauthWaitingForCallback
      ) {
        return false;
      }

      switchInFlightRef.current = true;
      setSwitchingId(account.id);
      try {
        const result = await invoke<SwitchAccountResult>(
          "switch_account_and_launch",
          {
            id: account.id,
            workspacePath: null,
            launchCodex: settings.launchCodexAfterSwitch,
            restartEditorsOnSwitch: settings.restartEditorsOnSwitch,
            restartEditorTargets: settings.restartEditorTargets,
          },
        );
        await loadAccounts();

        if (result.noOp) {
          // 兼容后端判定出的同账号 no-op，只刷新状态并提示当前账号。
          if (result.providerSyncError) {
            setNotice({
              type: "error",
              message: copy.notices.providerSyncFailed(
                copy.notices.accountAlreadyCurrent,
                localizeError(result.providerSyncError),
              ),
            });
          } else {
            setNotice({
              type: "info",
              message: copy.notices.accountAlreadyCurrent,
            });
          }
          return false;
        }

        let baseNotice: Notice;
        if (!settings.launchCodexAfterSwitch) {
          baseNotice = { type: "ok", message: copy.notices.switchedOnly };
        } else if (result.usedFallbackCli) {
          baseNotice = {
            type: "info",
            message: copy.notices.switchedAndLaunchByCli,
          };
        } else {
          baseNotice = {
            type: "ok",
            message: copy.notices.switchedAndLaunching,
          };
        }

        if (settings.syncOpencodeOpenaiAuth) {
          if (result.opencodeSyncError) {
            baseNotice = {
              type: "error",
              message: copy.notices.opencodeSyncFailed(
                baseNotice.message,
                localizeError(result.opencodeSyncError),
              ),
            };
          } else if (result.opencodeSynced) {
            baseNotice = {
              ...baseNotice,
              message: copy.notices.opencodeSynced(baseNotice.message),
            };
          }

          if (settings.restartOpencodeDesktopOnSwitch) {
            if (result.opencodeDesktopRestartError) {
              baseNotice = {
                type: "error",
                message: copy.notices.opencodeDesktopRestartFailed(
                  baseNotice.message,
                  localizeError(result.opencodeDesktopRestartError),
                ),
              };
            } else if (result.opencodeDesktopRestarted) {
              baseNotice = {
                ...baseNotice,
                message: copy.notices.opencodeDesktopRestarted(
                  baseNotice.message,
                ),
              };
            }
          }
        }

        if (settings.restartEditorsOnSwitch) {
          if (result.editorRestartError) {
            baseNotice = {
              type: "error",
              message: copy.notices.editorRestartFailed(
                baseNotice.message,
                localizeError(result.editorRestartError),
              ),
            };
          } else if (result.restartedEditorApps.length > 0) {
            const restartedLabels = result.restartedEditorApps
              .map((id) => copy.editorAppLabels[id] ?? id)
              .join(" / ");
            baseNotice = {
              ...baseNotice,
              message: copy.notices.editorsRestarted(
                baseNotice.message,
                restartedLabels,
              ),
            };
          } else {
            baseNotice = {
              ...baseNotice,
              message: copy.notices.noEditorRestarted(baseNotice.message),
            };
          }
        }

        if (result.providerSyncError) {
          baseNotice = {
            type: "error",
            message: copy.notices.providerSyncFailed(
              baseNotice.message,
              localizeError(result.providerSyncError),
            ),
          };
        }

        setNotice(baseNotice);
        return true;
      } catch (error) {
        try {
          await loadAccounts();
        } catch {
          // 切换失败时后端可能已写入停刷状态，尽量刷新；刷新失败仍保留原错误提示。
        }
        setNotice({
          type: "error",
          message: copy.notices.switchFailed(localizeError(String(error))),
        });
        return false;
      } finally {
        switchInFlightRef.current = false;
        setSwitchingId(null);
      }
    },
    [
      copy.editorAppLabels,
      copy.notices,
      importingAccounts,
      loadAccounts,
      localizeError,
      oauthWaitingForCallback,
      settings.launchCodexAfterSwitch,
      settings.syncOpencodeOpenaiAuth,
      settings.restartOpencodeDesktopOnSwitch,
      settings.restartEditorsOnSwitch,
      settings.restartEditorTargets,
    ],
  );

  const onSmartSwitch = useCallback(async () => {
    if (authBusy) {
      return;
    }

    const target = pickBestSmartSwitchAccount(
      sortedAccounts,
      settings.smartSwitchIncludeApi,
    );
    if (!target) {
      setNotice({ type: "info", message: copy.notices.smartSwitchNoTarget });
      return;
    }
    if (target.isCurrent) {
      setNotice({
        type: "info",
        message: copy.notices.smartSwitchAlreadyBest,
      });
      return;
    }

    await onSwitch(target);
  }, [
    copy.notices,
    authBusy,
    onSwitch,
    settings.smartSwitchIncludeApi,
    sortedAccounts,
  ]);

  return {
    accounts: sortedAccounts,
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
    importingAccounts,
    reauthorizeAccount,
    oauthWaitingForCallback,
    exportingAccounts,
    authBusy,
    costAnalyticsLoading,
    costAnalyticsExporting,
    costAnalyticsProgress,
    switchingId,
    renamingAccountId,
    pendingDeleteId: deleteCandidate?.id ?? null,
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
    settingsLoaded,
    savingSettings,
    installedEditorApps,
    hasOpencodeDesktopApp,
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
    onUpdateApiAccount,
    onTestApiAccountConnection,
    onImportAuthFiles,
    onExportAccounts,
    onRenameAccountLabel,
    onDelete,
    onCancelDelete,
    onConfirmDelete,
    onSwitch,
    onSmartSwitch,
    smartSwitching: authBusy,
  };
}
