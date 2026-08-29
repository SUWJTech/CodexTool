import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { tokenHeatmapLevel } from "../utils/heatmapScale";
import type {
  CodexBudgetAlert,
  CodexCostAnalyticsProgress,
  CodexCostAnalyticsSnapshot,
  CodexHourlyCostBucket,
  CodexProjectCostBreakdown,
  CodexPromptCostBreakdown,
  CodexSessionCostBreakdown,
} from "../types/app";

type AnalyticsPanelProps = {
  analytics: CodexCostAnalyticsSnapshot | null;
  error: string | null;
  loading: boolean;
  exporting: "csv" | "json" | null;
  progress: CodexCostAnalyticsProgress | null;
  weeklyBudgetUsd: number | null;
  savingSettings: boolean;
  onRefresh: () => void;
  onExport: (format: "csv" | "json") => void;
  onDeleteSession: (session: CodexSessionCostBreakdown) => Promise<void> | void;
  onUpdateWeeklyBudget: (value: number | null) => Promise<void>;
};

type AnalyticsCopy = ReturnType<typeof useI18n>["copy"]["analytics"];

function formatUsd(value: number, locale: string) {
  const digits = Math.abs(value) < 1 ? 4 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatWholeNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTokenCount(value: number, locale: string) {
  const absoluteValue = Math.abs(value);
  const scale =
    absoluteValue >= 999_950
      ? { divisor: 1_000_000, suffix: "M" }
      : absoluteValue >= 1_000
        ? { divisor: 1_000, suffix: "K" }
        : null;

  if (!scale) {
    return formatWholeNumber(value, locale);
  }

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value / scale.divisor);
  return `${formatted}${scale.suffix}`;
}

function formatDateTime(value: number | null, locale: string) {
  if (!value) {
    return "--";
  }
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value * 1000));
}

function formatDuration(seconds: number | null, locale: string) {
  if (seconds === null) {
    return "--";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours <= 0) {
    return new Intl.NumberFormat(locale).format(minutes) + "m";
  }
  return `${new Intl.NumberFormat(locale).format(hours)}h ${minutes}m`;
}

function alertLabel(
  alert: CodexBudgetAlert,
  copy: ReturnType<typeof useI18n>["copy"]["analytics"],
) {
  if (alert === "danger") {
    return copy.budgetDanger;
  }
  if (alert === "warning") {
    return copy.budgetWarning;
  }
  if (alert === "ok") {
    return copy.budgetOk;
  }
  return copy.budgetUnset;
}

function statCard(
  label: string,
  value: string,
  detail?: string,
  detailTitle?: string,
) {
  return (
    <article className="analyticsStatCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small title={detailTitle}>{detail}</small> : null}
    </article>
  );
}

function progressStageLabel(
  progress: CodexCostAnalyticsProgress | null,
  copy: ReturnType<typeof useI18n>["copy"]["analytics"],
) {
  if (progress?.stage === "caching") {
    return copy.progressCaching;
  }
  if (progress?.stage === "complete") {
    return copy.progressComplete;
  }
  return copy.progressScanning;
}

function costSourceDetail(
  analytics: CodexCostAnalyticsSnapshot | null,
  copy: AnalyticsCopy,
  locale: string,
) {
  if (!analytics) {
    return { label: copy.pricingEstimate, title: undefined };
  }

  const updatedAt = formatDateTime(analytics.costSourceUpdatedAt, locale);
  return {
    label: `${copy.costSourceLocal} · ${updatedAt}`,
    title: undefined,
  };
}

function Heatmap({
  buckets,
  locale,
  copy,
}: {
  buckets: CodexHourlyCostBucket[];
  locale: string;
  copy: Pick<AnalyticsCopy, "heatmapAriaLabel" | "heatmapTooltip">;
}) {
  const byKey = new Map(
    buckets.map((bucket) => [`${bucket.weekday}:${bucket.hour}`, bucket]),
  );
  const maxTokens = Math.max(...buckets.map((bucket) => bucket.tokens), 1);
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const weekdayLabels = Array.from({ length: 7 }, (_, weekday) =>
    weekdayFormatter.format(new Date(Date.UTC(2024, 0, 7 + weekday, 12))),
  );
  const hourLabels = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div
      className="analyticsHeatmap"
      role="img"
      aria-label={copy.heatmapAriaLabel}
    >
      <div className="analyticsHeatmapHeader" aria-hidden="true">
        <span />
        {hourLabels.map((hour) => (
          <b key={hour}>{hour % 6 === 0 ? `${hour}:00` : ""}</b>
        ))}
      </div>
      {weekdayLabels.map((label, weekday) => (
        <div key={label} className="analyticsHeatmapRow">
          <span>{label}</span>
          {hourLabels.map((hour) => {
            const bucket = byKey.get(`${weekday}:${hour}`);
            const tokens = bucket?.tokens ?? 0;
            const level = tokenHeatmapLevel(tokens, maxTokens);
            const tooltip = copy.heatmapTooltip(
              label,
              `${hour}:00`,
              formatTokenCount(tokens, locale),
            );
            return (
              <i
                key={hour}
                className={`analyticsHeatmapCell level${level}`}
                data-tooltip={tooltip}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ActivityTrend({
  buckets,
  locale,
}: {
  buckets: CodexHourlyCostBucket[];
  locale: string;
}) {
  const hourly = Array.from({ length: 24 }, (_, hour) =>
    buckets
      .filter((bucket) => bucket.hour === hour)
      .reduce(
        (total, bucket) => ({
          tokens: total.tokens + bucket.tokens,
          calls: total.calls + bucket.calls,
          costUsd: total.costUsd + bucket.costUsd,
        }),
        { tokens: 0, calls: 0, costUsd: 0 },
      ),
  );
  const maxTokens = Math.max(...hourly.map((item) => item.tokens), 1);
  const chartWidth = 720;
  const chartHeight = 224;
  const insetX = 16;
  const insetY = 18;
  const points = hourly.map((item, index) => {
    const x = insetX + (index / 23) * (chartWidth - insetX * 2);
    const y = chartHeight - insetY - (item.tokens / maxTokens) * (chartHeight - insetY * 2);
    return { x, y, ...item, hour: index };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${insetX},${chartHeight - insetY} ${line} ${chartWidth - insetX},${chartHeight - insetY}`;
  const peak = points.reduce((best, point) => (point.tokens > best.tokens ? point : best), points[0]);

  return (
    <div className="analyticsTrend">
      <div className="analyticsTrendSummary">
        <span>{locale.startsWith("zh") ? "全天活跃峰值" : "Daily activity peak"}</span>
        <strong>{String(peak.hour).padStart(2, "0")}:00</strong>
        <small>{formatTokenCount(peak.tokens, locale)} tokens · {formatWholeNumber(peak.calls, locale)} calls</small>
      </div>
      <div className="analyticsTrendCanvas">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={locale.startsWith("zh") ? "24 小时 Token 活跃趋势" : "24-hour token activity trend"}>
          <defs>
            <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--brand)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="analyticsTrendLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--brand)" />
              <stop offset="0.55" stopColor="#7c5cff" />
              <stop offset="1" stopColor="#22c9c3" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((row) => (
            <line key={row} x1="16" x2="704" y1={18 + row * 62} y2={18 + row * 62} className="analyticsTrendGridLine" />
          ))}
          <polygon points={area} fill="url(#analyticsTrendFill)" />
          <polyline points={line} fill="none" stroke="url(#analyticsTrendLine)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <circle key={point.hour} cx={point.x} cy={point.y} r={point.hour === peak.hour ? 6 : 3} className={point.hour === peak.hour ? "isPeak" : ""}>
              <title>{`${String(point.hour).padStart(2, "0")}:00 · ${formatTokenCount(point.tokens, locale)} tokens · ${formatWholeNumber(point.calls, locale)} calls · ${formatUsd(point.costUsd, locale)}`}</title>
            </circle>
          ))}
        </svg>
        <div className="analyticsTrendAxis" aria-hidden="true">
          {[0, 6, 12, 18, 23].map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}
        </div>
      </div>
    </div>
  );
}

function TokenMix({
  analytics,
  locale,
}: {
  analytics: CodexCostAnalyticsSnapshot;
  locale: string;
}) {
  const rows = [
    { label: locale.startsWith("zh") ? "输入" : "Input", value: analytics.total.inputTokens, tone: "input" },
    { label: locale.startsWith("zh") ? "缓存输入" : "Cached", value: analytics.total.cachedInputTokens, tone: "cached" },
    { label: locale.startsWith("zh") ? "输出" : "Output", value: analytics.total.outputTokens, tone: "output" },
    { label: locale.startsWith("zh") ? "推理" : "Reasoning", value: analytics.total.reasoningOutputTokens, tone: "reasoning" },
  ];
  const total = Math.max(rows.reduce((sum, row) => sum + row.value, 0), 1);
  let offset = 0;

  return (
    <div className="analyticsTokenMix">
      <div className="analyticsDonut">
        <svg viewBox="0 0 120 120" role="img" aria-label={locale.startsWith("zh") ? "Token 构成" : "Token composition"}>
          <circle cx="60" cy="60" r="44" className="analyticsDonutTrack" />
          {rows.map((row) => {
            const percent = row.value / total;
            const segmentOffset = offset;
            offset += percent;
            return (
              <circle
                key={row.tone}
                cx="60"
                cy="60"
                r="44"
                className={`analyticsDonutSegment tone-${row.tone}`}
                pathLength="1"
                strokeDasharray={`${percent} ${1 - percent}`}
                strokeDashoffset={-segmentOffset}
              />
            );
          })}
        </svg>
        <div><strong>{formatTokenCount(analytics.total.totalTokens, locale)}</strong><span>tokens</span></div>
      </div>
      <div className="analyticsTokenLegend">
        {rows.map((row) => (
          <div key={row.tone}>
            <i className={`tone-${row.tone}`} />
            <span>{row.label}</span>
            <strong>{formatTokenCount(row.value, locale)}</strong>
            <small>{Math.round((row.value / total) * 100)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectRows({
  projects,
  locale,
}: {
  projects: CodexProjectCostBreakdown[];
  locale: string;
}) {
  const maxCost = Math.max(
    ...projects.map((project) => project.costUsd),
    0.000001,
  );

  return (
    <div className="analyticsProjectList">
      {projects.slice(0, 10).map((project) => (
        <article key={project.projectPath} className="analyticsProjectRow">
          <div>
            <strong title={project.projectPath}>{project.projectName}</strong>
            <span title={project.projectPath}>{project.projectPath}</span>
          </div>
          <div className="analyticsProjectMetrics">
            <b>{formatUsd(project.costUsd, locale)}</b>
            <small>
              {formatNumber(project.total.totalTokens, locale)} tokens
            </small>
          </div>
          <div className="analyticsProjectBar" aria-hidden="true">
            <i
              style={{
                width: `${Math.max(4, (project.costUsd / maxCost) * 100)}%`,
              }}
            />
          </div>
          <small>
            {project.sessionCount} sessions · {project.promptCount} prompts ·{" "}
            {project.eventCount} events
          </small>
        </article>
      ))}
    </div>
  );
}

function SessionTable({
  sessions,
  locale,
  text,
  pendingDeleteSessionId,
  deletingSessionId,
  onDeleteSession,
}: {
  sessions: CodexSessionCostBreakdown[];
  locale: string;
  text: ReturnType<typeof useI18n>["copy"]["analytics"];
  pendingDeleteSessionId: string | null;
  deletingSessionId: string | null;
  onDeleteSession: (session: CodexSessionCostBreakdown) => void;
}) {
  return (
    <div className="analyticsTableWrap">
      <table className="analyticsTable">
        <thead>
          <tr>
            <th>Session</th>
            <th>Project</th>
            <th>Model</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.slice(0, 80).map((session) => (
            <tr key={session.sessionId}>
              <td>
                <strong title={session.sessionId}>
                  {session.sessionId.slice(0, 8)}
                </strong>
                {session.parentSessionId ? (
                  <small>parent {session.parentSessionId.slice(0, 8)}</small>
                ) : null}
              </td>
              <td title={session.projectPath}>{session.projectName}</td>
              <td>{session.model}</td>
              <td>{formatNumber(session.total.totalTokens, locale)}</td>
              <td>{formatUsd(session.costUsd, locale)}</td>
              <td>
                {formatDateTime(session.updatedAt, locale)}
                <small>{formatDuration(session.durationSeconds, locale)}</small>
              </td>
              <td>
                <button
                  type="button"
                  className="analyticsDeleteButton"
                  disabled={deletingSessionId !== null}
                  onClick={() => onDeleteSession(session)}
                >
                  {deletingSessionId === session.sessionId
                    ? text.sessionDeleting
                    : pendingDeleteSessionId === session.sessionId
                      ? text.sessionDeleteConfirm
                      : text.sessionDelete}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopPrompts({
  prompts,
  locale,
}: {
  prompts: CodexPromptCostBreakdown[];
  locale: string;
}) {
  return (
    <div className="analyticsPromptList">
      {prompts.map((prompt, index) => (
        <article
          key={`${prompt.sessionId}-${prompt.timestamp}-${index}`}
          className="analyticsPromptRow"
        >
          <div className="analyticsPromptRank">{index + 1}</div>
          <div className="analyticsPromptBody">
            <strong>{formatUsd(prompt.costUsd, locale)}</strong>
            <p title={prompt.promptPreview}>{prompt.promptPreview}</p>
            <span>
              {prompt.projectName} · {prompt.model} ·{" "}
              {formatNumber(prompt.total.totalTokens, locale)} tokens ·{" "}
              {prompt.promptChars} chars
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AnalyticsPanel({
  analytics,
  error,
  loading,
  exporting,
  progress,
  weeklyBudgetUsd,
  savingSettings,
  onRefresh,
  onExport,
  onDeleteSession,
  onUpdateWeeklyBudget,
}: AnalyticsPanelProps) {
  const { copy, locale } = useI18n();
  const text = copy.analytics;
  const budgetInputRef = useRef<HTMLInputElement | null>(null);
  const deleteConfirmTimerRef = useRef<number | null>(null);
  const [sessionQuery, setSessionQuery] = useState("");
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<
    string | null
  >(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null,
  );
  const budgetInputValue =
    weeklyBudgetUsd === null ? "" : String(weeklyBudgetUsd);

  const normalizedQuery = sessionQuery.trim().toLocaleLowerCase();
  const filteredSessions = useMemo(() => {
    const sessions = analytics?.sessions ?? [];
    if (!normalizedQuery) {
      return sessions;
    }
    return sessions.filter((session) =>
      [
        session.sessionId,
        session.parentSessionId ?? "",
        session.projectName,
        session.projectPath,
        session.model,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [analytics?.sessions, normalizedQuery]);

  const saveBudget = () => {
    const trimmed = budgetInputRef.current?.value.trim() ?? "";
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      return;
    }
    void onUpdateWeeklyBudget(value);
  };

  const clearBudget = () => {
    if (budgetInputRef.current) {
      budgetInputRef.current.value = "";
    }
    void onUpdateWeeklyBudget(null);
  };

  const clearDeleteConfirmTimer = () => {
    if (deleteConfirmTimerRef.current !== null) {
      window.clearTimeout(deleteConfirmTimerRef.current);
      deleteConfirmTimerRef.current = null;
    }
  };

  const handleDeleteSession = (session: CodexSessionCostBreakdown) => {
    if (deletingSessionId !== null) {
      return;
    }

    if (pendingDeleteSessionId !== session.sessionId) {
      clearDeleteConfirmTimer();
      setPendingDeleteSessionId(session.sessionId);
      deleteConfirmTimerRef.current = window.setTimeout(() => {
        setPendingDeleteSessionId((current) =>
          current === session.sessionId ? null : current,
        );
        deleteConfirmTimerRef.current = null;
      }, 3_000);
      return;
    }

    clearDeleteConfirmTimer();
    setDeletingSessionId(session.sessionId);
    void Promise.resolve(onDeleteSession(session))
      .catch(() => {})
      .finally(() => {
        setPendingDeleteSessionId(null);
        setDeletingSessionId(null);
      });
  };

  useEffect(
    () => () => {
      if (deleteConfirmTimerRef.current !== null) {
        window.clearTimeout(deleteConfirmTimerRef.current);
      }
    },
    [],
  );

  const budgetPercent = analytics?.weeklyBudgetPercent ?? null;
  const costSource = costSourceDetail(analytics, text, locale);
  const hasData = analytics !== null && analytics.eventCount > 0;
  const showProgress = loading || progress !== null;
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(progress?.percent ?? (loading ? 6 : 0))),
  );
  const progressFiles =
    progress && progress.totalFiles > 0
      ? `${formatNumber(progress.processedFiles, locale)} / ${formatNumber(progress.totalFiles, locale)} ${text.sourceFiles}`
      : text.loadingDescription;

  return (
    <section className="analyticsPage">
      <div className="analyticsShell">
        <header className="analyticsHeader workspacePageHeader">
          <div>
            <span className="analyticsKicker">{text.kicker}</span>
            <h2>{text.title}</h2>
            <p>{text.description}</p>
          </div>
          <div className="analyticsActions">
            <button
              type="button"
              className="ghost"
              onClick={onRefresh}
              disabled={loading}
            >
              {text.refresh}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => onExport("csv")}
              disabled={exporting !== null}
            >
              {exporting === "csv" ? text.exporting : text.exportCsv}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => onExport("json")}
              disabled={exporting !== null}
            >
              {exporting === "json" ? text.exporting : text.exportJson}
            </button>
          </div>
        </header>

        {error ? (
          <section className="analyticsNotice tone-danger">
            <strong>{text.errorTitle}</strong>
            <span>{error}</span>
          </section>
        ) : null}

        {showProgress ? (
          <section className="analyticsProgress" aria-live="polite">
            <div>
              <strong>{progressStageLabel(progress, text)}</strong>
              <span>{progressFiles}</span>
            </div>
            <div
              className="analyticsProgressMeter"
              aria-label={`${progressPercent}%`}
            >
              <i style={{ width: `${progressPercent}%` }} />
            </div>
            <b>{progressPercent}%</b>
            {progress?.currentPath ? (
              <code title={progress.currentPath}>{progress.currentPath}</code>
            ) : null}
          </section>
        ) : null}

        <section className="analyticsStats">
          {statCard(
            text.totalCost,
            analytics ? formatUsd(analytics.totalCostUsd, locale) : "--",
            costSource.label,
          )}
          {statCard(
            text.last7dCost,
            analytics ? formatUsd(analytics.last7dCostUsd, locale) : "--",
            costSource.label,
            costSource.title,
          )}
          {statCard(
            text.totalTokens,
            analytics
              ? formatNumber(analytics.total.totalTokens, locale)
              : "--",
            text.tokenEvents,
          )}
          {statCard(
            text.sessions,
            analytics ? formatNumber(analytics.sessions.length, locale) : "--",
            text.sourceFiles,
          )}
        </section>

        <section
          className={`analyticsBudget tone-${analytics?.weeklyBudgetAlert ?? "none"}`}
        >
          <div>
            <span>{text.budgetTitle}</span>
            <strong>
              {analytics
                ? alertLabel(analytics.weeklyBudgetAlert, text)
                : text.budgetUnset}
            </strong>
            <p>{text.budgetDescription}</p>
          </div>
          <div className="analyticsBudgetMeter" aria-hidden="true">
            <i
              style={{
                width: `${Math.min(100, Math.max(0, budgetPercent ?? 0))}%`,
              }}
            />
          </div>
          <label>
            <span>{text.budgetInputLabel}</span>
            <input
              key={budgetInputValue}
              ref={budgetInputRef}
              defaultValue={budgetInputValue}
              inputMode="decimal"
              placeholder={text.budgetPlaceholder}
            />
          </label>
          <div className="analyticsBudgetActions">
            <button
              type="button"
              className="ghost"
              onClick={clearBudget}
              disabled={savingSettings}
            >
              {text.budgetClear}
            </button>
            <button
              type="button"
              className="primary"
              onClick={saveBudget}
              disabled={savingSettings}
            >
              {text.budgetSave}
            </button>
          </div>
        </section>

        {loading && !analytics ? (
          <section className="analyticsEmpty">
            <strong>{text.loadingTitle}</strong>
            <span>{text.loadingDescription}</span>
          </section>
        ) : !hasData ? (
          <section className="analyticsEmpty">
            <strong>{text.emptyTitle}</strong>
            <span>{text.emptyDescription}</span>
          </section>
        ) : analytics ? (
          <div className="analyticsGrid">
            <section className="analyticsBlock analyticsBlockTrend">
              <div className="analyticsBlockHead">
                <div>
                  <span className="analyticsBlockKicker">LIVE PULSE</span>
                  <h3>{locale.startsWith("zh") ? "24 小时活跃趋势" : "24-hour activity trend"}</h3>
                  <p>{locale.startsWith("zh") ? "聚合最近记录的 Token、调用次数与成本，快速定位高负载时段。" : "Token, call and cost activity aggregated by hour."}</p>
                </div>
              </div>
              <ActivityTrend buckets={analytics.heatmap} locale={locale} />
            </section>

            <section className="analyticsBlock analyticsBlockMix">
              <div className="analyticsBlockHead">
                <div>
                  <span className="analyticsBlockKicker">TOKEN MIX</span>
                  <h3>{locale.startsWith("zh") ? "Token 构成" : "Token composition"}</h3>
                  <p>{locale.startsWith("zh") ? "输入、缓存、输出与推理消耗占比。" : "Input, cache, output and reasoning share."}</p>
                </div>
              </div>
              <TokenMix analytics={analytics} locale={locale} />
            </section>

            <section className="analyticsBlock analyticsBlockProjects">
              <div className="analyticsBlockHead">
                <div>
                  <h3>{text.projectsTitle}</h3>
                  <p>{text.projectsDescription}</p>
                </div>
              </div>
              <ProjectRows projects={analytics.projects} locale={locale} />
            </section>

            <section className="analyticsBlock analyticsBlockHeatmap">
              <div className="analyticsBlockHead">
                <div>
                  <h3>{text.heatmapTitle}</h3>
                  <p>{text.heatmapDescription}</p>
                </div>
              </div>
              <Heatmap
                buckets={analytics.heatmap}
                locale={locale}
                copy={text}
              />
            </section>

            <section className="analyticsBlock analyticsBlockSessions">
              <div className="analyticsBlockHead">
                <div>
                  <h3>{text.sessionsTitle}</h3>
                  <p>{text.sessionsDescription}</p>
                </div>
                <input
                  className="analyticsSearch"
                  value={sessionQuery}
                  placeholder="Search sessions"
                  onChange={(event) => setSessionQuery(event.target.value)}
                />
              </div>
              <SessionTable
                sessions={filteredSessions}
                locale={locale}
                text={text}
                pendingDeleteSessionId={pendingDeleteSessionId}
                deletingSessionId={deletingSessionId}
                onDeleteSession={handleDeleteSession}
              />
            </section>

            <section className="analyticsBlock analyticsBlockPrompts">
              <div className="analyticsBlockHead">
                <div>
                  <h3>{text.topPromptsTitle}</h3>
                  <p>{text.topPromptsDescription}</p>
                </div>
              </div>
              <TopPrompts prompts={analytics.topPrompts} locale={locale} />
            </section>
          </div>
        ) : null}

        {analytics ? (
          <footer className="analyticsFoot">
            <span>
              {text.updated}: {formatDateTime(analytics.updatedAt, locale)}
            </span>
            <span>
              {text.sourceFiles}: {analytics.sourcePathCount}
            </span>
            <span>
              {text.failedSources}: {analytics.failedPathCount}
            </span>
            {analytics.unresolvedForkCount > 0 ? (
              <span>
                {text.unresolvedForks}: {analytics.unresolvedForkCount}
              </span>
            ) : null}
            {analytics.unresolvedUsageEventCount > 0 ? (
              <span>
                {text.usageAnomalies}: {analytics.unresolvedUsageEventCount}
              </span>
            ) : null}
            <span>{analytics.pricingSource}</span>
          </footer>
        ) : null}
      </div>
    </section>
  );
}
