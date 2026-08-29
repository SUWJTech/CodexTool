import type { SVGProps } from "react";

export type AppIconName =
  | "accounts"
  | "analytics"
  | "store"
  | "skills"
  | "skins"
  | "settings"
  | "refresh"
  | "sun"
  | "moon"
  | "search"
  | "home"
  | "category"
  | "close"
  | "download"
  | "add"
  | "relay"
  | "oauth"
  | "upload"
  | "flask"
  | "api"
  | "display"
  | "link"
  | "info"
  | "check"
  | "alert"
  | "export"
  | "edit"
  | "more"
  | "switch"
  | "login"
  | "trash"
  | "clock"
  | "code"
  | "modules"
  | "tools"
  | "sparkles"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down";

type AppIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: AppIconName;
  title?: string;
};

function IconPaths({ name }: { name: AppIconName }) {
  switch (name) {
    case "accounts":
      return <><circle cx="12" cy="8" r="3.25" /><path d="M5.75 20v-1.25a6.25 6.25 0 0 1 12.5 0V20" /></>;
    case "analytics":
      return <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /><path d="m4 8 5-4 5 7 5-8" /></>;
    case "store":
      return <><path d="M5 9h14l-1 11H6L5 9Z" /><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" /></>;
    case "skills":
      return <><path d="m12 3 7.5 4.2v9.6L12 21l-7.5-4.2V7.2L12 3Z" /><path d="m4.8 7.4 7.2 4.1 7.2-4.1M12 11.5V21" /><path d="m15.8 3.9-7.4 4.2" /></>;
    case "skins":
      return <><path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z" /><circle cx="7.5" cy="11.5" r=".7" /><circle cx="9" cy="7.5" r=".7" /><circle cx="13.5" cy="6.5" r=".7" /></>;
    case "settings":
      return <><path d="M4 6h10m4 0h2M4 12h2m4 0h10M4 18h8m4 0h4" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="14" cy="18" r="2" /></>;
    case "refresh":
      return <><path d="M20.5 9A8.5 8.5 0 1 0 21 14" /><path d="M20.5 4v5h-5" /></>;
    case "sun":
      return <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4m0-13.4-1.4 1.4M6.7 17.3l-1.4 1.4" /></>;
    case "moon":
      return <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z" />;
    case "search":
      return <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 4.5 4.5" /></>;
    case "home":
      return <><path d="m4 10 8-6 8 6" /><path d="M6.5 9v10h11V9M10 19v-5h4v5" /></>;
    case "category":
      return <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>;
    case "close":
      return <path d="m6 6 12 12M18 6 6 18" />;
    case "download":
      return <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 20h14" /></>;
    case "add":
      return <path d="M12 5v14M5 12h14" />;
    case "relay":
      return <><path d="M4 8h12m-3-3 3 3-3 3M20 16H8m3-3-3 3 3 3" /></>;
    case "oauth":
      return <><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 3v6l4 2M21 5v4h-4" /></>;
    case "upload":
      return <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M5 20h14" /></>;
    case "flask":
      return <><path d="M9 3h6M10 3v4.5L5.8 17a3 3 0 0 0 2.7 4.2h7a3 3 0 0 0 2.7-4.2L14 7.5V3" /><path d="M8 14h8" /></>;
    case "api":
      return <><path d="M4 8.5h16M4 15.5h16M7 4.5v15M17 4.5v15" /></>;
    case "display":
      return <><rect x="3" y="4" width="18" height="13" rx="2.5" /><path d="M8 21h8M12 17v4M7 9h10" /></>;
    case "link":
      return <><path d="m8.5 15.5 7-7M7.2 10.8l-2.1 2.1a4 4 0 0 0 5.7 5.7l2.1-2.1M16.8 13.2l2.1-2.1a4 4 0 0 0-5.7-5.7l-2.1 2.1" /></>;
    case "info":
      return <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>;
    case "check":
      return <path d="m5 12.5 4.25 4.25L19 7" />;
    case "alert":
      return <><path d="M10.3 4.2 2.8 18a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>;
    case "export":
      return <><rect x="4" y="7" width="12" height="13" rx="2" /><path d="M12 4h8v8m0-8-9 9" /></>;
    case "edit":
      return <><path d="m14 5 5 5L9 20l-5 1 1-5L15 6" /><path d="m13 7 4 4" /></>;
    case "more":
      return <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>;
    case "switch":
      return <><path d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3" /></>;
    case "login":
      return <><path d="M10 5H5v14h5" /><path d="m13 8 4 4-4 4m4-4H8" /></>;
    case "trash":
      return <><path d="M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14M10 11v6m4-6v6" /></>;
    case "clock":
      return <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>;
    case "code":
      return <><path d="m8.5 7-5 5 5 5m7-10 5 5-5 5" /><path d="m13.5 4-3 16" /></>;
    case "modules":
      return <><path d="m12 3 7.5 4.2L12 11.5 4.5 7.2 12 3Z" /><path d="m4.5 12 7.5 4.3 7.5-4.3M4.5 16.5 12 21l7.5-4.5" /></>;
    case "tools":
      return <><path d="M14.5 6.5a4 4 0 0 0-5-5L12 4l-3 3-2.5-2.5a4 4 0 0 0 5 5L5 16l3 3 6.5-6.5a4 4 0 0 0 5-5L17 10l-3-3 2.5-2.5" /></>;
    case "sparkles":
      return <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14Zm14-1 .8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z" /></>;
    case "chevron-left":
      return <path d="m14.5 6-6 6 6 6" />;
    case "chevron-right":
      return <path d="m9.5 6 6 6-6 6" />;
    case "chevron-down":
      return <path d="m7 10 5 5 5-5" />;
  }
}

export function AppIcon({ name, className = "", title, ...props }: AppIconProps) {
  const classes = `appIcon${className ? ` ${className}` : ""}`;
  return (
    <svg
      {...props}
      className={classes}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <IconPaths name={name} />
    </svg>
  );
}
