import { createPortal } from "react-dom";
import { AppIcon } from "./AppIcon";
import { useI18n } from "../i18n/I18nProvider";
import type { PendingUpdateInfo } from "../types/app";
import { getChangelogEntryForVersion, normalizeReleaseNoteItems } from "../utils/changelog";

type UpdateBannerProps = {
  open: boolean;
  pendingUpdate: PendingUpdateInfo | null;
  updateProgress: string | null;
  installingUpdate: boolean;
  onClose: () => void;
  onManualDownload: () => void;
  onSkipVersion: () => void;
  onInstallNow: () => void;
};

export function UpdateBanner({
  open,
  pendingUpdate,
  updateProgress,
  installingUpdate,
  onClose,
  onManualDownload,
  onSkipVersion,
  onInstallNow,
}: UpdateBannerProps) {
  const { copy, locale } = useI18n();

  if (!open || !pendingUpdate) {
    return null;
  }

  const changelogEntry = getChangelogEntryForVersion(pendingUpdate.version, locale);
  const releaseNoteItems = changelogEntry?.items.length
    ? changelogEntry.items
    : normalizeReleaseNoteItems(pendingUpdate.body, locale);
  const versionLabel = pendingUpdate.version.startsWith("v")
    ? pendingUpdate.version
    : `v${pendingUpdate.version}`;

  return createPortal(
    <div className="updateOverlay" onClick={onClose}>
      <section
        className="updateDialog"
        role="dialog"
        aria-modal="true"
        aria-label={copy.updateDialog.ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="updateDialogHeader">
          <div className="updateDialogIcon" aria-hidden="true">
            <AppIcon name="download" className="iconGlyph" />
          </div>
          <div className="updateDialogTitleBlock">
            <span className="updateVersionPill">{versionLabel}</span>
            <h2>{copy.updateDialog.title(pendingUpdate.version)}</h2>
            <p>{copy.updateDialog.subtitle(pendingUpdate.currentVersion)}</p>
          </div>
          <button
            className="iconButton ghost closeButton"
            onClick={onClose}
            aria-label={copy.updateDialog.close}
            title={copy.common.close}
          >
            <AppIcon name="close" className="iconGlyph" />
          </button>
        </div>

        <div className="updateDialogContent">
          <div className="updateText">
            {pendingUpdate.date && (
              <span className="updateMetaItem">
                {copy.updateDialog.publishedAt(pendingUpdate.date)}
              </span>
            )}
            <span className="updateMetaItem">
              {installingUpdate
                ? copy.updateDialog.statusInstalling
                : copy.updateDialog.statusReady}
            </span>
          </div>

          <div className="updateChangelog">
            <div className="updateChangelogHeader">
              <strong>{copy.updateDialog.changelogTitle}</strong>
            </div>
            {releaseNoteItems.length > 0 ? (
              <ol className="updateChangelogList">
                {releaseNoteItems.map((item, index) => (
                  <li className="updateChangelogItem" key={`${index}-${item}`}>
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="updateChangelogEmpty">{copy.updateDialog.changelogEmpty}</p>
            )}
          </div>

          {updateProgress && <p className="updateProgress">{updateProgress}</p>}
        </div>

        <div className="updateDialogActions">
          <button className="ghost" onClick={onSkipVersion} disabled={installingUpdate}>
            {copy.updateDialog.skipThisVersion}
          </button>
          {!pendingUpdate.manualOnly ? (
            <button className="ghost" onClick={onManualDownload} disabled={installingUpdate}>
              {copy.updateDialog.manualDownload}
            </button>
          ) : null}
          <button className="primary" onClick={onInstallNow} disabled={installingUpdate}>
            {installingUpdate
              ? copy.updateDialog.installingNow
              : pendingUpdate.manualOnly
                ? copy.updateDialog.manualDownload
                : copy.updateDialog.installNow}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
