import { useI18n } from "../i18n/I18nProvider";
import { AppIcon } from "./AppIcon";

type AddAccountSectionProps = {
  onOpenAddDialog: () => void;
  onOpenRelayDialog: () => void;
  onSmartSwitch: () => void;
  smartSwitching: boolean;
};

export function AddAccountSection({
  onOpenAddDialog,
  onOpenRelayDialog,
  onSmartSwitch,
  smartSwitching,
}: AddAccountSectionProps) {
  const { copy, locale } = useI18n();

  return (
    <section className="importBar">
      <button
        className="ghost smartSwitchButton importSmartSwitch"
        onClick={onSmartSwitch}
        disabled={smartSwitching}
        title={copy.addAccount.smartSwitch}
        aria-label={copy.addAccount.smartSwitch}
      >
        <AppIcon name="sparkles" className="buttonIcon" />
        {copy.addAccount.smartSwitch}
      </button>
      <button
        className="primary importPrimary"
        onClick={onOpenAddDialog}
      >
        <AppIcon name="add" className="buttonIcon" />
        {copy.addAccount.startButton}
      </button>
      <button
        className="ghost importRelay"
        onClick={onOpenRelayDialog}
      >
        <AppIcon name="relay" className="buttonIcon" />
        {locale === "zh-CN" ? "添加中转" : "Add relay"}
      </button>
    </section>
  );
}
