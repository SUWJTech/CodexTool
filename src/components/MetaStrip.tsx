import { useI18n } from "../i18n/I18nProvider";
import type { AccountSummary } from "../types/app";
import { remainingPercent } from "../utils/usage";
import { AppIcon, type AppIconName } from "./AppIcon";

type MetaStripProps = {
  accounts: AccountSummary[];
  exportingAccounts: boolean;
  onExportAccounts: () => void;
};

type MetricTone = "blue" | "green" | "amber" | "red";

type MetricIconProps = {
  tone: MetricTone;
};

function MetricIcon({ tone }: MetricIconProps) {
  const iconByTone: Record<MetricTone, AppIconName> = {
    blue: "accounts",
    green: "check",
    amber: "clock",
    red: "alert",
  };
  return <AppIcon name={iconByTone[tone]} className="metricIconGlyph" />;
}

function hasBlockingAccountIssue(account: AccountSummary): boolean {
  return Boolean(
    account.authRefreshBlocked ||
      account.profileIntegrityError ||
      account.profileLastValidationError ||
      account.authRefreshError,
  );
}

function hasExhaustedWindow(account: AccountSummary): boolean {
  return [account.usage?.fiveHour ?? null, account.usage?.oneWeek ?? null].some((window) => {
    const remaining = remainingPercent(window);
    return remaining !== null && remaining <= 0;
  });
}

export function MetaStrip({
  accounts,
  exportingAccounts,
  onExportAccounts,
}: MetaStripProps) {
  const { copy, locale } = useI18n();
  const isChinese = locale === "zh-CN";
  const issueCount = accounts.filter(hasBlockingAccountIssue).length;
  const exhaustedCount = accounts.filter((account) => !hasBlockingAccountIssue(account) && hasExhaustedWindow(account)).length;
  const activeCount = accounts.filter(
    (account) => !hasBlockingAccountIssue(account) && !hasExhaustedWindow(account) && account.profileAuthReady,
  ).length;
  const metrics: Array<{
    label: string;
    value: number;
    helper: string;
    tone: MetricTone;
  }> = [
    {
      label: copy.metaStrip.accountCount,
      value: accounts.length,
      helper: isChinese ? "个账号" : "total",
      tone: "blue",
    },
    {
      label: isChinese ? "活跃账号" : "Active",
      value: activeCount,
      helper: isChinese ? "正常使用" : "ready",
      tone: "green",
    },
    {
      label: isChinese ? "已耗尽" : "Exhausted",
      value: exhaustedCount,
      helper: isChinese ? "使用率 100%" : "used 100%",
      tone: "amber",
    },
    {
      label: isChinese ? "异常账号" : "Needs attention",
      value: issueCount,
      helper: isChinese ? "需要关注" : "review",
      tone: "red",
    },
  ];

  return (
    <section className="metaStrip" aria-label={copy.metaStrip.ariaLabel}>
      {metrics.map((metric) => (
        <article key={metric.label} className={`metaPill metric-${metric.tone}`}>
          <span className="metricIcon">
            <MetricIcon tone={metric.tone} />
          </span>
          <span className="metricCopy">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{metric.helper}</em>
          </span>
        </article>
      ))}
      <button
        className="ghost metaExportButton"
        onClick={onExportAccounts}
        disabled={exportingAccounts || accounts.length === 0}
        aria-label={copy.metaStrip.exportAll}
      >
        {copy.metaStrip.exportAll}
      </button>
    </section>
  );
}
