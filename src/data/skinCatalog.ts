export type SkinCatalogEntry = {
  id: string;
  title: string;
  author: string;
  description: string;
  preview: string;
  appearance: "dark" | "light" | "adaptive";
  kind: "preset";
  tags: string[];
};

export const SKIN_CATALOG: SkinCatalogEntry[] = [
  {
    id: "preset-gothic-void-crusade",
    title: "Gothic Void Crusade",
    author: "seansong-ideogram",
    description: "Dream Skin 仓库的可再分发精选预设，采用哥特科幻氛围与金色强调色。",
    preview: "/skins/gothic-void-crusade.jpg",
    appearance: "dark",
    kind: "preset",
    tags: ["精选", "暗色", "哥特", "科幻"],
  },
  {
    id: "preset-aurora-observatory",
    title: "Aurora Observatory",
    author: "CodexTool Studio",
    description: "深海蓝与极光青交织的沉浸式暗色主题，适合长时间专注开发。",
    preview: "/skins/aurora-observatory.png",
    appearance: "dark",
    kind: "preset",
    tags: ["原创", "暗色", "极光", "玻璃"],
  },
  {
    id: "preset-crystal-horizon",
    title: "Crystal Horizon",
    author: "CodexTool Studio",
    description: "珍珠白、雾蓝与晶体质感构成的通透浅色主题。",
    preview: "/skins/crystal-horizon.png",
    appearance: "light",
    kind: "preset",
    tags: ["原创", "浅色", "晶体", "极简"],
  },
  {
    id: "preset-rose-synthesis",
    title: "Rose Synthesis",
    author: "CodexTool Studio",
    description: "柔和珊瑚粉与未来穹顶融合的明亮自适应主题。",
    preview: "/skins/rose-synthesis.png",
    appearance: "adaptive",
    kind: "preset",
    tags: ["原创", "自适应", "珊瑚", "未来"],
  },
];
