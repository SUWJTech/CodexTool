import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { AppIcon } from "./AppIcon";
import { LdxpStorePanel } from "./LdxpStorePanel";
import { StoreCategoryRail } from "./StoreCategoryRail";

type Storefront = {
  shop_no?: string;
  name?: string;
  logo?: string;
  announcement?: string;
  contact_qq?: string;
  merchant?: { region?: string; joined_months?: number };
};

type StoreGoods = {
  goods_no: string;
  goods_category_no?: string;
  name: string;
  description?: string;
  image?: string;
  price?: number;
  delivery_method?: number;
  stock_available_quantity?: number;
  stock_available_status?: "high" | "normal" | "low" | "out" | string;
  limit_quantity?: number;
  sales_count_text?: string;
};

type StoreCategory = {
  goods_category_no: string;
  name: string;
  image?: string;
};

type PaymentMethod = {
  id: number;
  show_name?: string;
  paytype?: { name?: string; code?: string; icon?: string };
};

type Quote = {
  unit_price?: number;
  quantity?: number;
  goods_amount?: number;
  promotion_discount?: number;
  coupon_discount?: number;
  fee?: number;
  total_amount?: number;
};

type OrderResult = {
  trade_no?: string;
  pay_url?: string;
  status?: number | string;
  status_text?: string;
};

type AccountStorePanelProps = {
  onOpenExternalUrl: (url: string) => void;
};

const PREVIEW_GOODS: StoreGoods[] = [
  {
    goods_no: "G-PREVIEW-PLUS",
    goods_category_no: "preview-account",
    name: "Codex Plus 账号商品",
    description: "桌面版将从 CodexTool 商城实时读取商品、库存与支付方式。",
    price: 128.82,
    delivery_method: 1,
    stock_available_quantity: 24,
    stock_available_status: "high",
    limit_quantity: 1,
  },
  {
    goods_no: "G-PREVIEW-TEAM",
    goods_category_no: "preview-service",
    name: "Codex Team 账号商品",
    description: "浏览器开发预览卡片，不会创建真实订单。",
    price: 18.8,
    delivery_method: 1,
    stock_available_quantity: 8,
    stock_available_status: "normal",
    limit_quantity: 1,
  },
];

const PREVIEW_CATEGORIES: StoreCategory[] = [
  { goods_category_no: "preview-account", name: "Codex 账号" },
  { goods_category_no: "preview-service", name: "开发服务" },
];

function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

function money(input: unknown) {
  const number = Number(input);
  return Number.isFinite(number) ? `¥${number.toFixed(2)}` : "--";
}

function plainText(html: string | undefined) {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ").trim();
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

function statusText(order: OrderResult | null, zh: boolean) {
  if (!order) return zh ? "等待支付" : "Awaiting payment";
  if (order.status_text) return order.status_text;
  const status = String(order.status ?? "").toLowerCase();
  if (["1", "paid", "success", "completed"].includes(status)) return zh ? "支付成功" : "Paid";
  if (["-1", "2", "closed", "cancelled", "failed"].includes(status)) return zh ? "订单已关闭" : "Closed";
  return zh ? "等待支付" : "Awaiting payment";
}

export function AccountStorePanel({ onOpenExternalUrl }: AccountStorePanelProps) {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const desktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [storefront, setStorefront] = useState<Storefront>({ name: "CodexTool" });
  const [goods, setGoods] = useState<StoreGoods[]>(desktop ? [] : PREVIEW_GOODS);
  const [categories, setCategories] = useState<StoreCategory[]>(desktop ? [] : PREVIEW_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoreGoods | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [provider, setProvider] = useState<"official" | "ldxp">("official");

  const loadStore = useCallback(async () => {
    if (!desktop) return;
    setLoading(true);
    setError(null);
    try {
      const [shop, categoryResult, goodsResult, paymentResult] = await Promise.all([
        invoke<Storefront>("get_account_storefront"),
        invoke<StoreCategory[]>("list_account_store_categories"),
        invoke<{ list?: StoreGoods[] }>("list_account_store_goods", { pageNo: 1, pageSize: 100 }),
        invoke<{ list?: PaymentMethod[] }>("list_account_store_payment_methods"),
      ]);
      const paymentList = Array.isArray(paymentResult?.list) ? paymentResult.list : [];
      setStorefront(shop);
      setCategories(Array.isArray(categoryResult) ? categoryResult : []);
      setGoods(Array.isArray(goodsResult?.list) ? goodsResult.list : []);
      setPayments(paymentList);
      setChannelId((current) => current ?? paymentList[0]?.id ?? null);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, [desktop]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const visibleGoods = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return goods.filter((item) => {
      if (selectedCategory !== "all" && item.goods_category_no !== selectedCategory) return false;
      return !needle || `${item.name} ${plainText(item.description)} ${item.goods_no}`.toLocaleLowerCase().includes(needle);
    });
  }, [goods, query, selectedCategory]);

  const requestQuote = useCallback(async (item: StoreGoods, nextQuantity: number, payment: number) => {
    if (!desktop) return;
    setQuoting(true);
    setError(null);
    try {
      setQuote(await invoke<Quote>("quote_account_store_order", {
        goodsNo: item.goods_no,
        quantity: nextQuantity,
        channelId: payment,
        couponCode: couponCode.trim(),
      }));
    } catch (reason) {
      setQuote(null);
      setError(String(reason));
    } finally {
      setQuoting(false);
    }
  }, [couponCode, desktop]);

  const openPurchase = (item: StoreGoods) => {
    const minimum = Math.max(1, Number(item.limit_quantity ?? 1));
    const payment = channelId ?? payments[0]?.id ?? null;
    setSelected(item);
    setQuantity(minimum);
    setQuote(null);
    setOrder(null);
    setError(null);
    if (payment !== null) {
      setChannelId(payment);
      void requestQuote(item, minimum, payment);
    }
  };

  const openCheckout = (result: OrderResult) => {
    if (!result.pay_url) return;
    onOpenExternalUrl(result.pay_url);
  };

  const createOrder = async () => {
    if (!desktop || !selected || channelId === null || !quote || ordering) return;
    setOrdering(true);
    setError(null);
    try {
      const result = await invoke<OrderResult>("create_account_store_order", {
        goodsNo: selected.goods_no,
        quantity,
        channelId,
        contactEmail: contactEmail.trim(),
        couponCode: couponCode.trim(),
      });
      setOrder(result);
      openCheckout(result);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setOrdering(false);
    }
  };

  useEffect(() => {
    if (!desktop || !order?.trade_no) return;
    let cancelled = false;
    const refresh = () => {
      void invoke<OrderResult>("get_account_store_order_status", { tradeNo: order.trade_no })
        .then((next) => {
          if (!cancelled) setOrder((current) => ({ ...current, ...next }));
        })
        .catch(() => {});
    };
    const timer = window.setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [desktop, order?.trade_no]);

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !ordering) setSelected(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ordering, selected]);

  const emailValid = isValidEmail(contactEmail);

  const providerSwitch = (
    <div className="storeProviderSwitcher" role="tablist" aria-label={zh ? "账号商城货源" : "Account store suppliers"}>
      <span>{zh ? "货源" : "Supplier"}</span>
      <button type="button" role="tab" aria-selected={provider === "official"} className={provider === "official" ? "isActive" : ""} onClick={() => setProvider("official")}><AppIcon name="store" />{zh ? "CodexTool 官方" : "CodexTool official"}</button>
      <button type="button" role="tab" aria-selected={provider === "ldxp"} className={provider === "ldxp" ? "isActive" : ""} onClick={() => setProvider("ldxp")}><AppIcon name="modules" />{zh ? "链动小铺" : "LDXP"}<i>{zh ? "新货源" : "New"}</i></button>
    </div>
  );

  if (provider === "ldxp") {
    return (
      <section className="accountStorePage" aria-label={zh ? "链动小铺账号货源" : "LDXP account supplier"}>
        {providerSwitch}
        <LdxpStorePanel onOpenExternalUrl={onOpenExternalUrl} />
      </section>
    );
  }

  return (
    <section className="accountStorePage" aria-labelledby="account-store-title">
      {providerSwitch}
      <header className="accountStoreHero accountStorefrontHero workspacePageHeader">
        <div className="storefrontIdentity">
          <img src={storefront.logo || "/codextool-glass-icon-clean.png"} alt="" />
          <div>
            <span className="marketKicker">{zh ? "CODEXTOOL 原生购买中心" : "CODEXTOOL NATIVE STORE"}</span>
            <h2 id="account-store-title">{storefront.name || (zh ? "账号商城" : "Account Marketplace")}</h2>
            <p>{zh
              ? "商品浏览、库存、优惠询价和支付方式均在 CodexTool 内完成；付款由安全支付通道处理。"
              : "Browse inventory and quote orders in CodexTool, then pay through secure checkout."}</p>
          </div>
        </div>
        <div className="storefrontTrustStack">
          <span className="storeConnectionBadge isConnected"><i />{zh ? "商城实时连接" : "Live catalog"}</span>
          <small>{storefront.merchant?.region || (zh ? "安全支付通道" : "Secure payments")}</small>
        </div>
      </header>

      {storefront.announcement ? (
        <div className="storeAnnouncement"><strong>{zh ? "店铺公告" : "Notice"}</strong><span>{storefront.announcement}</span></div>
      ) : null}
      {!desktop ? <div className="marketPreviewNote">{zh ? "当前为浏览器 UI 预览，不会创建真实订单。" : "Browser UI preview; no real orders are created."}</div> : null}

      <StoreCategoryRail ariaLabel={zh ? "商品分类" : "Product categories"} previousLabel={zh ? "向左浏览商品分类" : "Previous product categories"} nextLabel={zh ? "向右浏览商品分类" : "Next product categories"}>
        <button type="button" className={selectedCategory === "all" ? "isActive" : ""} onClick={() => setSelectedCategory("all")}>
          <span className="storeCategoryIcon"><AppIcon name="home" /></span><b>{zh ? "全部商品" : "All products"}</b><small>{goods.length}</small>
        </button>
        {categories.map((category) => (
          <button type="button" className={selectedCategory === category.goods_category_no ? "isActive" : ""} key={category.goods_category_no} onClick={() => setSelectedCategory(category.goods_category_no)}>
            <span className="storeCategoryIcon">{category.image ? <img src={category.image} alt="" /> : <AppIcon name="category" />}</span><b>{category.name}</b><small>{goods.filter((item) => item.goods_category_no === category.goods_category_no).length}</small>
          </button>
        ))}
      </StoreCategoryRail>

      <div className="storeToolbar storefrontToolbar">
        <label className="skinCatalogSearch"><AppIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? "搜索商品名称、介绍或编号" : "Search goods"} /></label>
        <div className="storePaymentSummary">
          {payments.slice(0, 3).map((payment) => <span key={payment.id}>{payment.paytype?.icon ? <img src={payment.paytype.icon} alt="" /> : null}{payment.show_name || payment.paytype?.name}</span>)}
        </div>
        <button type="button" className="ghost" disabled={loading || !desktop} onClick={() => void loadStore()}>{loading ? (zh ? "同步中…" : "Syncing…") : (zh ? "刷新商城" : "Refresh")}</button>
        <span className="marketCount">{visibleGoods.length} {zh ? "件在售商品" : "items"}</span>
      </div>

      {error ? <div className="marketError" role="alert">{error}</div> : null}
      {!loading && visibleGoods.length === 0 ? <div className="marketEmpty">{zh ? "暂无匹配商品" : "No matching goods"}</div> : null}
      <div className="accountGoodsGrid">
        {visibleGoods.map((item) => {
          const stock = Number(item.stock_available_quantity ?? 0);
          const description = plainText(item.description);
          return (
            <article className="accountGoodsCard" key={item.goods_no}>
              <div className="accountGoodsVisual">
                <img src={item.image || "/codextool-glass-icon-clean.png"} alt="" loading="lazy" />
                <span className={`stockTone is-${item.stock_available_status || "normal"}`}>{stock > 0 ? (zh ? `库存 ${stock}` : `${stock} in stock`) : (zh ? "暂时售罄" : "Sold out")}</span>
              </div>
              <div className="accountGoodsBody">
                <div className="accountGoodsTitle"><div><h3>{item.name}</h3><code>{item.goods_no}</code></div><strong>{money(item.price)}</strong></div>
                <p>{description || (zh ? "查看购买弹窗了解实时价格与支付方式。" : "Open purchase details for live pricing.")}</p>
                <div className="accountGoodsMeta"><span>{item.delivery_method === 1 ? (zh ? "自动发货" : "Auto delivery") : (zh ? "商家交付" : "Merchant delivery")}</span>{item.sales_count_text ? <span>{item.sales_count_text}</span> : null}</div>
                <button type="button" className="primary" disabled={loading || stock <= 0 || (desktop && payments.length === 0)} onClick={() => openPurchase(item)}>{zh ? "立即购买" : "Buy now"}</button>
              </div>
            </article>
          );
        })}
      </div>

      {selected ? (
        <div className="storePurchaseOverlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !ordering) setSelected(null); }}>
          <section className="storePurchaseDialog" role="dialog" aria-modal="true" aria-labelledby="store-purchase-title">
            <header><div><span>{zh ? "订单与支付" : "ORDER & PAYMENT"}</span><h3 id="store-purchase-title">{selected.name}</h3></div><button className="iconButton" type="button" disabled={ordering} onClick={() => setSelected(null)} aria-label={zh ? "关闭" : "Close"}><AppIcon name="close" /></button></header>
            {order ? (
              <div className="storeOrderCheckout">
                <div className="storeOrderPulse"><i /><div><span>{statusText(order, zh)}</span><code>{order.trade_no}</code></div></div>
                <p>{zh ? "订单已创建。若收银台未自动打开，可点击下方按钮继续支付；完成后状态会自动刷新。" : "The order is ready. Continue to official checkout to pay."}</p>
                {order.pay_url ? <button className="primary" type="button" onClick={() => openCheckout(order)}>{zh ? "打开安全收银台" : "Open secure checkout"}</button> : null}
              </div>
            ) : (
              <>
                <div className="storePurchaseSummary">
                  <label><span>{zh ? "购买数量" : "Quantity"}</span><input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></label>
                  <label className="storeEmailField"><span>{zh ? "联系邮箱（必填）" : "Contact email (required)"}</span><input type="email" required aria-invalid={contactEmail.length > 0 && !emailValid} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="name@example.com" />{contactEmail.length > 0 && !emailValid ? <small className="storeFieldError">{zh ? "请输入有效邮箱地址" : "Enter a valid email address"}</small> : null}</label>
                </div>
                <div className="storePaymentPicker">
                  <span>{zh ? "支付方式" : "Payment method"}</span>
                  <div>{payments.map((payment) => <button type="button" className={channelId === payment.id ? "isSelected" : ""} key={payment.id} onClick={() => { setChannelId(payment.id); void requestQuote(selected, quantity, payment.id); }}>{payment.paytype?.icon ? <img src={payment.paytype.icon} alt="" /> : null}<b>{payment.show_name || payment.paytype?.name}</b></button>)}</div>
                </div>
                <div className="storeCouponRow"><label><span>{zh ? "优惠码" : "Coupon"}</span><input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder={zh ? "没有可留空" : "Optional"} /></label><button className="ghost" type="button" disabled={!desktop || channelId === null || quoting} onClick={() => channelId !== null && void requestQuote(selected, quantity, channelId)}>{quoting ? (zh ? "询价中…" : "Quoting…") : (zh ? "更新金额" : "Update total")}</button></div>
                {quote ? <div className="storeFinalTotal"><span>{zh ? "最终付款金额" : "Final payment"}</span><strong>{money(quote.total_amount)}</strong></div> : null}
                <p className="storePurchaseWarning">{zh ? "确认后将创建待支付订单，并在系统浏览器打开安全收银台。" : "Creates an unpaid order and opens secure checkout in your system browser."}</p>
                <footer><button type="button" className="ghost" disabled={ordering} onClick={() => setSelected(null)}>{zh ? "取消" : "Cancel"}</button><button type="button" className="primary" disabled={!desktop || !quote || channelId === null || !emailValid || ordering} onClick={() => void createOrder()}>{ordering ? (zh ? "创建订单中…" : "Creating…") : (zh ? "确认订单并去支付" : "Create order & pay")}</button></footer>
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
