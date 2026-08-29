type DebugFloatingToolProps = {
  onOpenUpdateDialog: () => void;
};

export function DebugFloatingTool({ onOpenUpdateDialog }: DebugFloatingToolProps) {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <details className="debugFloatingTool">
      <summary aria-label="展开本地调试工具">DEBUG</summary>
      <aside className="debugFloatingPanel" aria-label="Debug tools">
        <div className="debugFloatingHeader">
          <strong>本地调试</strong>
        </div>
        <button type="button" className="ghost" onClick={onOpenUpdateDialog}>
          打开更新弹窗
        </button>
      </aside>
    </details>
  );
}
