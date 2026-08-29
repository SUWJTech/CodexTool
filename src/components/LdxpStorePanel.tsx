import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { AppIcon } from "./AppIcon";
import { StoreCategoryRail } from "./StoreCategoryRail";

type LdxpStorefront = {
  name: string;
  avatar: string;
  description: string;
  region: string;
  goods_count: number;
  sell_count: number;
  shop_url: string;
};

type LdxpCategory = {
  id: string;
  name: string;
  image: string;
  goods_type: string;
  goods_count: number;
};

type LdxpGoods = {
  goods_key: string;
  goods_type: string;
  name: string;
  description: string;
  image: string;
  price: number;
  market_price?: number | null;
  stock?: number | null;
  in_stock: boolean;
  category_id: string;
  category_name: string;
  purchase_url: string;
};

type LdxpCatalog = {
  provider: "ldxp";
  storefront: LdxpStorefront;
  categories: LdxpCategory[];
  goods: LdxpGoods[];
};

type LdxpStorePanelProps = {
  onOpenExternalUrl: (url: string) => void;
};

const SHOP_URL = "https://pay.ldxp.cn/shop/CodexTool";

const PREVIEW_CATALOG: LdxpCatalog = {
  provider: "ldxp",
  storefront: {
    name: "CodexTool",
    avatar: "/codextool-glass-icon-clean.png",
    description: "链动小铺独立货源目录。桌面版会实时读取分类、库存和商品价格。",
    region: "浙江",
    goods_count: 2,
    sell_count: 0,
    shop_url: SHOP_URL,
  },
  categories: [
    { id: "preview-codex", name: "Codex 成品", image: "", goods_type: "card", goods_count: 2 },
  ],
  goods: [
    {
      goods_key: "preview-plus",
      goods_type: "card",
      name: "Codex Plus 账号货源",
      description: "浏览器开发预览商品，不会创建订单或发起付款。",
      image: "/codextool-glass-icon-clean.png",
      price: 25.5,
      stock: 8,
      in_stock: true,
      category_id: "preview-codex",
      category_name: "Codex 成品",
      purchase_url: SHOP_URL,
    },
    {
      goods_key: "preview-team",
      goods_type: "card",
      name: "Codex Team 账号货源",
      description: "桌面应用会显示链动小铺返回的实时商品与库存。",
      image: "/codextool-glass-icon-clean.png",
      price: 39,
      stock: 3,
      in_stock: true,
      category_id: "preview-codex",
      category_name: "Codex 成品",
      purchase_url: SHOP_URL,
    },
  ],
};

function money(input: unknown) {
  const number = Number(input);
  return Number.isFinite(number) ? `¥${number.toFixed(2)}` : "--";
}

function typeLabel(type: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    card: ["自动发卡", "Auto delivery"],
    article: ["图文商品", "Article"],
    resource: ["资源商品", "Resource"],
    equity: ["权益商品", "Entitlement"],
  };
  const label = labels[type] ?? ["店铺交付", "Store delivery"];
  return zh ? label[0] : label[1];
}

export function LdxpStorePanel({ onOpenExternalUrl }: LdxpStorePanelProps) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const desktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [catalog, setCatalog] = useState<LdxpCatalog | null>(desktop ? null : PREVIEW_CATALOG);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!desktop) return;
    setLoading(true);
    setError(null);
    try {
      setCatalog(await invoke<LdxpCatalog>("get_ldxp_store_catalog"));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, [desktop]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCatalog(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  const visibleGoods = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (catalog?.goods ?? []).filter((item) => {
      const categoryKey = `${item.goods_type}:${item.category_id}`;
      if (selectedCategory !== "all" && categoryKey !== selectedCategory) return false;
      return !needle || `${item.name} ${item.description} ${item.category_name} ${item.goods_key}`.toLocaleLowerCase().includes(needle);
    });
  }, [catalog?.goods, query, selectedCategory]);

  const storefront = catalog?.storefront;
  const shopUrl = storefront?.shop_url || SHOP_URL;

  return (
    <div className="ldxpStoreView" aria-labelledby="ldxp-store-title">
      <header className="accountStoreHero accountStorefrontHero workspacePageHeader ldxpStoreHero">
        <div className="storefrontIdentity">
          <img src={storefront?.avatar || "/codextool-glass-icon-clean.png"} alt="" />
          <div>
            <span className="marketKicker">{zh ? "链动小铺 · 独立货源" : "LDXP · INDEPENDENT SUPPLIER"}</span>
            <h2 id="ldxp-store-title">{storefront?.name || (zh ? "链动小铺货源" : "LDXP Catalog")}</h2>
            <p>{storefront?.description || (zh
              ? "正在读取链动小铺的实时分类、库存与商品价格。"
              : "Loading live categories, inventory, and pricing from LDXP.")}</p>
          </div>
        </div>
        <div className="storefrontTrustStack">
          <span className={`storeConnectionBadge ${catalog ? "isConnected" : ""}`}><i />{catalog ? (zh ? "货源已连接" : "Supplier connected") : (zh ? "独立连接" : "Isolated connection")}</span>
          <small>{storefront?.region || (zh ? "官方商品页完成付款" : "Checkout on official product page")}</small>
          <button type="button" className="ghost" onClick={() => onOpenExternalUrl(shopUrl)}>{zh ? "打开原店铺" : "Open source store"}</button>
        </div>
      </header>

      {!desktop ? <div className="marketPreviewNote">{zh ? "当前为浏览器 UI 预览，不会创建真实订单。" : "Browser UI preview; no real orders are created."}</div> : null}

      {catalog ? (
        <StoreCategoryRail ariaLabel={zh ? "链动小铺商品分类" : "LDXP product categories"} previousLabel={zh ? "向左浏览链动小铺分类" : "Previous LDXP categories"} nextLabel={zh ? "向右浏览链动小铺分类" : "Next LDXP categories"}>
          <button type="button" className={selectedCategory === "all" ? "isActive" : ""} onClick={() => setSelectedCategory("all")}>
            <span className="storeCategoryIcon"><AppIcon name="home" /></span><b>{zh ? "全部商品" : "All products"}</b><small>{catalog.goods.length}</small>
          </button>
          {catalog.categories.map((category) => {
            const categoryKey = `${category.goods_type}:${category.id}`;
            const count = catalog.goods.filter((item) => `${item.goods_type}:${item.category_id}` === categoryKey).length;
            return (
              <button type="button" className={selectedCategory === categoryKey ? "isActive" : ""} key={categoryKey} onClick={() => setSelectedCategory(categoryKey)}>
                <span className="storeCategoryIcon">{category.image ? <img src={category.image} alt="" /> : <AppIcon name="category" />}</span><b>{category.name || typeLabel(category.goods_type, zh)}</b><small>{count}</small>
              </button>
            );
          })}
        </StoreCategoryRail>
      ) : null}

      <div className="storeToolbar storefrontToolbar">
        <label className="skinCatalogSearch"><AppIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? "搜索链动小铺商品、分类或编号" : "Search LDXP goods"} /></label>
        <span className="ldxpCheckoutHint"><AppIcon name="link" />{zh ? "付款进入官方商品页" : "Official product checkout"}</span>
        <button type="button" className="ghost" disabled={loading || !desktop} onClick={() => void loadCatalog()}>{loading ? (zh ? "同步中…" : "Syncing…") : (zh ? "刷新货源" : "Refresh supplier")}</button>
        <span className="marketCount">{visibleGoods.length} {zh ? "件在售商品" : "items"}</span>
      </div>

      {error ? (
        <div className="ldxpSupplierError" role="alert">
          <div><AppIcon name="alert" /><span><strong>{zh ? "链动小铺暂时不可用" : "LDXP is temporarily unavailable"}</strong><small>{error}</small></span></div>
          <button type="button" className="ghost" onClick={() => onOpenExternalUrl(shopUrl)}>{zh ? "在浏览器打开" : "Open in browser"}</button>
        </div>
      ) : null}
      {!loading && catalog && visibleGoods.length === 0 ? <div className="marketEmpty">{zh ? "暂无匹配商品" : "No matching goods"}</div> : null}
      {loading && !catalog ? <div className="marketEmpty">{zh ? "正在连接独立货源…" : "Connecting to supplier…"}</div> : null}

      <div className="accountGoodsGrid">
        {visibleGoods.map((item) => (
          <article className="accountGoodsCard ldxpGoodsCard" key={item.goods_key}>
            <div className="accountGoodsVisual">
              <img src={item.image || storefront?.avatar || "/codextool-glass-icon-clean.png"} alt="" loading="lazy" />
              <span className={item.in_stock ? "stockTone is-high" : "stockTone is-out"}>{item.stock == null ? (zh ? "库存以店铺为准" : "Check stock") : item.stock > 0 ? (zh ? `库存 ${item.stock}` : `${item.stock} in stock`) : (zh ? "暂时售罄" : "Sold out")}</span>
            </div>
            <div className="accountGoodsBody">
              <div className="accountGoodsTitle"><div><h3>{item.name}</h3><code>{item.goods_key}</code></div><strong>{money(item.price)}</strong></div>
              <p>{item.description || (zh ? "进入官方商品页查看完整说明与交付规则。" : "Open the official page for full details.")}</p>
              <div className="accountGoodsMeta"><span>{typeLabel(item.goods_type, zh)}</span>{item.category_name ? <span>{item.category_name}</span> : null}</div>
              <button type="button" className="primary" disabled={!item.in_stock} onClick={() => onOpenExternalUrl(item.purchase_url)}>{zh ? "查看商品并购买" : "View & purchase"}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
