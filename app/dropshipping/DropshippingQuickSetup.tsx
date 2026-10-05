"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";
import { ProductImage } from "@/components/product-image";
import { buildProductImageUrl, buildProductImageUrls, HAS_REMOTE_PRODUCT_IMAGE_BASE } from "@/lib/product-image-url";

type Lang = "zh" | "es";

type StoreBindingRow = {
  platform: string;
  shopName: string;
  bindStatus: "unbound" | "bound" | "expired";
  authorizedAt: string | null;
  expiredAt: string | null;
  accountId: string;
  externalShopId: string;
  storeType: string;
  site: string;
};

type ProductRow = {
  id: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number | null;
  cartonPack: number | null;
  price: number | null;
  category: string;
  categoryName: string;
  subcategory: string;
  hasImage: boolean;
  normalDiscount: string;
  vipDiscount: string;
};

type StockPreference = {
  enabled: boolean;
  qty: string;
};

type DraftRow = {
  id: string;
  platform: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  draftStatus: string;
  failureReason: string;
  generatedAt: string;
};

type BindModalState = {
  mode: "edit" | "view";
  platform: string;
  shopName: string;
  accountId: string;
  externalShopId: string;
  storeType: string;
  site: string;
  bindStatus: "unbound" | "bound" | "expired";
  authorizedAt: string | null;
  expiredAt: string | null;
} | null;

type NoticeModalState = {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
} | null;

const PLATFORM_AUTH_URLS: Record<string, string> = {
  "TikTok Shop": "https://seller.tiktokglobalshop.com/account/login",
  Temu: "https://seller.temu.com/",
  "Mercado Libre": "https://www.mercadolibre.com.mx/",
  SHEIN: "https://supplier.sheingroup.com/",
  Amazon: "https://sellercentral.amazon.com/",
};

const STORE_TYPE_OPTIONS = [
  { value: "cross_border", labelZh: "跨境", labelEs: "Transfronteriza" },
  { value: "local", labelZh: "本土", labelEs: "Local" },
];

const PLATFORM_SITE_OPTIONS: Record<string, string[]> = {
  "TikTok Shop": [
    "美国站",
    "英国站",
    "墨西哥站",
    "日本站",
    "沙特站",
    "新加坡站",
    "马来西亚站",
    "泰国站",
    "菲律宾站",
    "越南站",
    "西班牙站",
    "德国站",
    "法国站",
    "意大利站",
  ],
  Temu: ["美国站", "加拿大站", "欧洲站", "英国站", "瑞士站"],
  "Mercado Libre": ["墨西哥站", "巴西站", "智利站", "哥伦比亚站", "阿根廷站"],
  SHEIN: ["美国站", "欧洲站", "沙特站", "阿联酋站"],
  Amazon: [
    "美国站",
    "加拿大站",
    "墨西哥站",
    "巴西站",
    "英国站",
    "西班牙站",
    "法国站",
    "荷兰站",
    "德国站",
    "意大利站",
    "瑞典站",
    "波兰站",
    "埃及站",
    "土耳其站",
    "沙特站",
    "阿联酋站",
    "印度站",
    "新加坡站",
    "澳大利亚站",
    "日本站",
  ],
};

function fmtTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function isBindingActive(item: Pick<StoreBindingRow, "bindStatus" | "expiredAt">) {
  if (item.bindStatus !== "bound") return false;
  if (!item.expiredAt) return true;
  const expiredAt = new Date(item.expiredAt).getTime();
  if (Number.isNaN(expiredAt)) return true;
  return expiredAt > Date.now();
}

export function DropshippingQuickSetup({ lang }: { lang: Lang }) {
  const [bindings, setBindings] = useState<StoreBindingRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductRow[]>([]);
  const [stockPreferences, setStockPreferences] = useState<Record<string, StockPreference>>({});
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [draftPlatform, setDraftPlatform] = useState("TikTok Shop");
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [bindModal, setBindModal] = useState<BindModalState>(null);
  const [noticeModal, setNoticeModal] = useState<NoticeModalState>(null);
  const [preview, setPreview] = useState<{
    open: boolean;
    src: string;
    fallbackSources: string[];
    title: string;
  }>({
    open: false,
    src: "",
    fallbackSources: [],
    title: "",
  });

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            title: "代发快捷设置",
            subtitle: "快速完成店铺绑定、商品选择与草稿生成",
            step1: "步骤 1：绑定店铺",
            step2: "步骤 2：选择产品",
            step3: "步骤 3：生成产品草稿",
            helper: "请先绑定店铺，再选择商品并生成草稿。",
            notBound: "未绑定",
            bound: "已绑定",
            expired: "授权失效",
            bindStore: "绑定店铺",
            rebindStore: "重新绑定",
            checkStatus: "查看状态",
            bindModalTitle: "绑定店铺",
            statusModalTitle: "店铺状态",
            openAuthPage: "打开授权页",
            shopName: "店铺名称",
            storeType: "店铺类型",
            site: "站点",
            storeTypeCrossBorder: "跨境",
            storeTypeLocal: "本土",
            unfilled: "未填写",
            saveBinding: "去授权",
            close: "关闭",
            cancel: "取消",
            selectPlaceholder: "请选择",
            searchPlaceholder: "搜索编码、条形码、中文名、西文名",
            categoryPlaceholder: "全部分类",
            selectedCount: "已选商品",
            saveSelection: "保存已选商品",
            selectAllPage: "全选本页",
            clearSelection: "取消选择",
            noProducts: "暂无可选商品",
            choosePlatform: "选择已绑定的平台",
            generateDrafts: "生成产品草稿",
            draftTip: "成功后请前往对应平台继续完善商品标题、描述、价格、规格等信息",
            draftStatus: "草稿状态",
            failureReason: "失败原因",
            generatedAt: "生成时间",
            platform: "平台",
            statusPending: "待生成",
            statusRunning: "生成中",
            statusSuccess: "成功",
            statusFailed: "失败",
            packageCount: "包装数",
            cartonCount: "装箱数",
            cartonSpec: "装箱规格",
            price: "单价",
            category: "分类",
            normalDiscount: "普通折扣",
            vipDiscount: "VIP折扣",
            discount: "折扣",
            stockPrepare: "备货",
            stockQty: "备货数量",
            code: "编码",
            barcode: "条形码",
            zhName: "中文名",
            esName: "西文名",
            currentBindings: "当前绑定状态",
            selectedArea: "已选商品统计",
            resultList: "生成结果预览",
            platformFollowup: "请去 {platform} 平台您的店铺，调整详细产品数据。",
            openPlatform: "平台直达",
            totalSku: "共：{count}个SKU",
            previousPage: "上一页",
            nextPage: "下一页",
            loadingText: "正在加载代发快捷设置...",
            bindSaved: "已保存店铺绑定信息",
            selectionSaved: "已保存当前已选商品",
            selectProductRequired: "请选择商品",
            platformRequired: "请先选择平台",
            siteRequired: "请选择站点",
            modalOk: "知道了",
          }
        : {
            title: "Configuración rápida",
            subtitle: "Vincula tiendas, elige productos y genera borradores",
            step1: "Paso 1: Vincular tienda",
            step2: "Paso 2: Seleccionar productos",
            step3: "Paso 3: Generar borradores",
            helper: "Primero vincula una tienda, luego elige productos y genera borradores.",
            notBound: "Sin vincular",
            bound: "Vinculado",
            expired: "Autorización vencida",
            bindStore: "Vincular",
            rebindStore: "Vincular de nuevo",
            checkStatus: "Estado",
            bindModalTitle: "Vincular tienda",
            statusModalTitle: "Estado de la tienda",
            openAuthPage: "Abrir autorización",
            shopName: "Nombre de tienda",
            storeType: "Tipo de tienda",
            site: "Sitio",
            storeTypeCrossBorder: "Transfronteriza",
            storeTypeLocal: "Local",
            unfilled: "Sin completar",
            saveBinding: "Ir a autorizar",
            close: "Cerrar",
            cancel: "Cancelar",
            selectPlaceholder: "Selecciona",
            searchPlaceholder: "Buscar por SKU, código de barras, nombre zh o es",
            categoryPlaceholder: "Todas las categorías",
            selectedCount: "Seleccionados",
            saveSelection: "Guardar selección",
            selectAllPage: "Seleccionar página",
            clearSelection: "Quitar selección",
            noProducts: "Sin productos",
            choosePlatform: "Plataforma vinculada",
            generateDrafts: "Generar borradores",
            draftTip: "Después completa título, descripción, precio y variantes en la plataforma.",
            draftStatus: "Estado",
            failureReason: "Motivo",
            generatedAt: "Generado",
            platform: "Plataforma",
            statusPending: "Pendiente",
            statusRunning: "Procesando",
            statusSuccess: "Correcto",
            statusFailed: "Falló",
            packageCount: "Empaque",
            cartonCount: "Caja",
            cartonSpec: "Especificación",
            price: "Precio unitario",
            category: "Categoría",
            normalDiscount: "Desc. normal",
            vipDiscount: "Desc. VIP",
            discount: "Descuento",
            stockPrepare: "Preparar stock",
            stockQty: "Cantidad",
            code: "SKU",
            barcode: "Código",
            zhName: "Nombre zh",
            esName: "Nombre es",
            currentBindings: "Estado actual",
            selectedArea: "Resumen de selección",
            resultList: "Vista previa de resultados",
            platformFollowup: "Ve a tu tienda en {platform} para ajustar los datos detallados del producto.",
            openPlatform: "Abrir plataforma",
            totalSku: "Total: {count} SKU",
            previousPage: "Anterior",
            nextPage: "Siguiente",
            loadingText: "Cargando configuración rápida...",
            bindSaved: "Vínculo guardado",
            selectionSaved: "Selección guardada",
            selectProductRequired: "Selecciona productos",
            platformRequired: "Selecciona una plataforma",
            siteRequired: "Selecciona un sitio",
            modalOk: "Aceptar",
          },
    [lang],
  );

  const boundPlatforms = useMemo(
    () => bindings.filter((item) => item.bindStatus === "bound").map((item) => item.platform),
    [bindings],
  );

  async function readJsonResponse(res: Response) {
    const raw = await res.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(raw || "response_parse_failed");
    }
  }

  function openNotice(tone: "success" | "error" | "info", message: string, title?: string) {
    setNoticeModal({
      tone,
      title:
        title ||
        (tone === "success" ? "操作成功" : tone === "error" ? "操作失败" : "提示"),
      message,
    });
  }

  function openBindModal(item: StoreBindingRow, mode: "edit" | "view") {
    setBindModal({
      mode,
      platform: item.platform,
      shopName: item.shopName || "",
      accountId: item.accountId || "",
      externalShopId: item.externalShopId || "",
      storeType: item.storeType || "",
      site: item.site || "",
      bindStatus: item.bindStatus,
      authorizedAt: item.authorizedAt,
      expiredAt: item.expiredAt,
    });
  }

  function getSiteOptions(platform: string) {
    return PLATFORM_SITE_OPTIONS[platform] || [];
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    void loadProducts(keyword, productCategory, productPage);
  }, [keyword, productCategory, productPage]);

  async function loadAll() {
    try {
      setLoading(true);
      await fetch("/api/dropshipping/quick-setup/selected-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });

      const [bindingRes, productRes, draftRes] = await Promise.all([
        fetch("/api/dropshipping/quick-setup/store-bindings", { cache: "no-store" }),
        fetch("/api/dropshipping/quick-setup/products", { cache: "no-store" }),
        fetch("/api/dropshipping/quick-setup/drafts", { cache: "no-store" }),
      ]);

      const [bindingJson, productJson, draftJson] = await Promise.all([
        readJsonResponse(bindingRes),
        readJsonResponse(productRes),
        readJsonResponse(draftRes),
      ]);

      if (!bindingRes.ok) throw new Error(bindingJson.error || "load_bindings_failed");
      if (!productRes.ok) throw new Error(productJson.error || "load_products_failed");
      if (!draftRes.ok) throw new Error(draftJson.error || "load_drafts_failed");

      setBindings(bindingJson.items || []);
      setProducts(productJson.items || []);
      setProductTotal(Number(productJson.total || 0));
      setProductTotalPages(Number(productJson.totalPages || 1));
      setCategoryOptions(Array.isArray(productJson.categoryOptions) ? productJson.categoryOptions : []);
      setSelectedProducts([]);
      setStockPreferences({});
      setDrafts(draftJson.items || []);
    } catch (caughtError) {
      openNotice("error", caughtError instanceof Error ? caughtError.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts(nextKeyword: string, nextCategory: string, nextPage: number) {
    try {
      const params = new URLSearchParams();
      if (nextKeyword.trim()) params.set("keyword", nextKeyword.trim());
      if (nextCategory) params.set("category", nextCategory);
      params.set("page", String(nextPage));
      const res = await fetch(`/api/dropshipping/quick-setup/products?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await readJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "load_products_failed");
      setProducts(data.items || []);
      setProductTotal(Number(data.total || 0));
      setProductTotalPages(Number(data.totalPages || 1));
      setCategoryOptions(Array.isArray(data.categoryOptions) ? data.categoryOptions : []);
    } catch (caughtError) {
      openNotice("error", caughtError instanceof Error ? caughtError.message : "load_products_failed");
    }
  }

  async function saveBinding(openAuthAfterSave = false) {
    if (!bindModal) return;
    try {
      if (!bindModal.site.trim()) {
        openNotice("error", text.siteRequired, "提示");
        return;
      }

      const nextStatus = bindModal.shopName.trim() || bindModal.storeType.trim() || bindModal.site.trim()
        ? "bound"
        : "unbound";
      const res = await fetch("/api/dropshipping/quick-setup/store-bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: bindModal.platform,
          bindStatus: nextStatus,
          shopName: bindModal.shopName.trim(),
          storeType: bindModal.storeType.trim(),
          site: bindModal.site.trim(),
          accountId: "",
          externalShopId: "",
        }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "bind_store_failed");
      setBindings((prev) =>
        prev.map((item) => (item.platform === bindModal.platform ? data.item : item)),
      );
      if (openAuthAfterSave && PLATFORM_AUTH_URLS[bindModal.platform]) {
        window.open(PLATFORM_AUTH_URLS[bindModal.platform], "_blank", "noopener,noreferrer");
      }
      setBindModal(null);
      openNotice("success", openAuthAfterSave ? `${text.bindSaved}，已打开授权页` : text.bindSaved);
    } catch (caughtError) {
      openNotice("error", caughtError instanceof Error ? caughtError.message : "bind_store_failed");
    }
  }

  function toggleProduct(product: ProductRow) {
    setSelectedProducts((prev) => {
      const exists = prev.some((item) => item.sku === product.sku);
      if (exists) {
        return prev.filter((item) => item.sku !== product.sku);
      }
      return [...prev, product];
    });
  }

  function updateStockPreference(sku: string, patch: Partial<StockPreference>) {
    setStockPreferences((prev) => ({
      ...prev,
      [sku]: {
        enabled: prev[sku]?.enabled || false,
        qty: prev[sku]?.qty || "",
        ...patch,
      },
    }));
  }

  function isStockQtyInvalid(item: ProductRow) {
    const qtyText = String(stockPreferences[item.sku]?.qty || "").trim();
    if (!qtyText) return false;
    const qty = Number(qtyText);
    const minQty = Number(item.casePack || 0);
    return Number.isFinite(qty) && qty < minQty;
  }

  function handleStockQtyBlur(item: ProductRow) {
    if (!isStockQtyInvalid(item)) return;
    openNotice("error", "备货数量不得低于商品包装数，请重新调整");
  }

  function selectAllCurrentPage() {
    setSelectedProducts((prev) => {
      const selectedMap = new Map(prev.map((item) => [item.sku, item]));
      for (const item of products) {
        selectedMap.set(item.sku, item);
      }
      return Array.from(selectedMap.values());
    });
  }

  async function clearSelectedProducts() {
    setSelectedProducts([]);
    setStockPreferences({});
    try {
      await fetch("/api/dropshipping/quick-setup/selected-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });
    } catch {}
  }

  async function saveSelection() {
    if (selectedProducts.length === 0) {
      openNotice("error", text.selectProductRequired, "提示");
      return;
    }
    try {
      setSavingSelection(true);
      const selectedItems = selectedProducts.map((item) => ({
        ...item,
        platform: draftPlatform,
      }));
      const stockItems = selectedProducts
        .filter((item) => stockPreferences[item.sku]?.enabled && String(stockPreferences[item.sku]?.qty || "").trim())
        .map((item) => ({
          sku: item.sku,
          productNameZh: item.nameZh,
          productNameEs: item.nameEs,
          stockedQty: Number(stockPreferences[item.sku]?.qty || 0),
          unitPrice: item.price,
          discountRate: item.normalDiscount ? Number(String(item.normalDiscount).replace("%", "")) : null,
        }));

      const [selectedRes, stockRes] = await Promise.all([
        fetch("/api/dropshipping/quick-setup/selected-products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: selectedItems }),
        }),
        fetch("/api/dropshipping/quick-setup/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: stockItems }),
        }),
      ]);
      const [selectedData, stockData] = await Promise.all([
        readJsonResponse(selectedRes),
        readJsonResponse(stockRes),
      ]);
      if (!selectedRes.ok || !selectedData.ok) throw new Error(selectedData.error || "save_selection_failed");
      if (!stockRes.ok || !stockData.ok) throw new Error(stockData.error || "save_stock_failed");
      openNotice("success", text.selectionSaved);
    } catch (caughtError) {
      openNotice("error", caughtError instanceof Error ? caughtError.message : "save_selection_failed");
    } finally {
      setSavingSelection(false);
    }
  }

  async function generateDrafts() {
    try {
      setGeneratingDrafts(true);
      if (!draftPlatform) {
        openNotice("error", text.platformRequired);
        return;
      }
      const res = await fetch("/api/dropshipping/quick-setup/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: draftPlatform,
        }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "generate_drafts_failed");
      setDrafts(data.items || []);
      await clearSelectedProducts();
      openNotice("success", data.message || text.draftTip);
    } catch (caughtError) {
      openNotice("error", caughtError instanceof Error ? caughtError.message : "generate_drafts_failed");
    } finally {
      setGeneratingDrafts(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-soft">
        正在加载代发快捷设置...
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{text.step1}</h3>
            <p className="mt-1 text-sm text-slate-500">{text.currentBindings}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {bindings.map((item) => {
            const bindingActive = isBindingActive(item);
            const statusText =
              item.bindStatus === "bound"
                ? text.bound
                : item.bindStatus === "expired"
                  ? text.expired
                  : text.notBound;
            const statusClass =
              item.bindStatus === "bound"
                ? "bg-emerald-50 text-emerald-700"
                : item.bindStatus === "expired"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-500";
            return (
              <div key={item.platform} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span>{item.platform}</span>
                      {bindingActive ? (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(34,197,94,0.16)]"
                          aria-label="绑定生效中"
                          title="绑定生效中"
                        />
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.shopName || "未填写店铺名称"}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
                    {statusText}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openBindModal(item, "edit")}
                    className="inline-flex h-8 flex-1 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-white shadow-soft transition hover:opacity-95"
                  >
                    {item.bindStatus === "bound" ? text.rebindStore : text.bindStore}
                  </button>
                  <button
                    type="button"
                    onClick={() => openBindModal(item, "view")}
                    className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {text.checkStatus}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_320px]">
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{text.step2}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 text-xs text-slate-500">
                {text.totalSku.replace("{count}", String(productTotal))}
              </div>
              <button
                type="button"
                onClick={selectAllCurrentPage}
                disabled={products.length === 0}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {text.selectAllPage}
              </button>
              <button
                type="button"
                onClick={clearSelectedProducts}
                disabled={selectedProducts.length === 0}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {text.clearSelection}
              </button>
              <select
                value={productCategory}
                onChange={(event) => {
                  setProductCategory(event.target.value);
                  setProductPage(1);
                }}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary"
              >
                <option value="">{text.categoryPlaceholder}</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setProductPage(1);
                }}
                placeholder={text.searchPlaceholder}
                className="h-10 min-w-[280px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-3">
            {products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                {text.noProducts}
              </div>
            ) : null}
            {products.map((item) => {
              const checked = selectedProducts.some((selected) => selected.sku === item.sku);
              const stockQtyInvalid = isStockQtyInvalid(item);
              return (
                <label
                  key={item.sku}
                  className={`grid cursor-pointer gap-3 rounded-2xl border px-4 py-3 transition lg:grid-cols-[auto_minmax(0,84px)_minmax(0,1fr)_minmax(0,88px)_minmax(0,120px)_minmax(0,120px)_minmax(0,96px)_minmax(0,168px)] ${
                    checked ? "border-primary bg-secondary-accent/30" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(item)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <ProductImage
                      sku={item.sku}
                      hasImage={item.hasImage}
                      size={52}
                      onClick={() =>
                        (item.hasImage || HAS_REMOTE_PRODUCT_IMAGE_BASE)
                          ? setPreview({
                              open: true,
                              src: buildProductImageUrl(item.sku, "jpg"),
                              fallbackSources: buildProductImageUrls(item.sku, ["jpg", "jpeg", "png", "webp"]),
                              title: item.nameZh || item.nameEs || item.sku,
                            })
                          : null
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{item.nameZh || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.nameEs || "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {text.code}：{item.sku} / {text.barcode}：{item.barcode || "-"}
                    </div>
                  </div>
                  <div className="text-sm text-slate-700">
                    <div className="text-xs text-slate-400">{text.price}</div>
                    <div className="mt-1 font-medium">{item.price === null ? "-" : item.price.toFixed(2)}</div>
                  </div>
                  <div className="text-sm text-slate-700">
                    <div className="text-xs text-slate-400">{text.cartonSpec}</div>
                    <div className="mt-1 space-y-1 font-medium">
                      <div>包装数：{item.casePack ?? "-"}</div>
                      <div>装箱数：{item.cartonPack ?? "-"}</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700">
                    <div className="text-xs text-slate-400">{text.discount}</div>
                    <div className="mt-1 space-y-1 font-medium">
                      <div>普折：{item.normalDiscount || "-"}</div>
                      <div>VIP折：{item.vipDiscount || "-"}</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700">
                    <div className="text-xs text-slate-400">{text.category}</div>
                    <div className="mt-1 font-medium">{item.categoryName || "-"}</div>
                    {item.subcategory && item.subcategory !== "-" ? (
                      <div className="mt-1 text-xs text-slate-400">{item.subcategory}</div>
                    ) : null}
                  </div>
                  <div className="text-sm text-slate-700">
                    <div className="text-xs text-slate-400">{text.stockPrepare}</div>
                    <div className="mt-2 flex items-center gap-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={Boolean(stockPreferences[item.sku]?.enabled)}
                        onChange={(event) => updateStockPreference(item.sku, { enabled: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <input
                        type="number"
                        min={Number(item.casePack || 0)}
                        inputMode="numeric"
                        value={stockPreferences[item.sku]?.qty || ""}
                        onChange={(event) =>
                          updateStockPreference(item.sku, {
                            qty: event.target.value.replace(/[^\d]/g, ""),
                          })}
                        onBlur={() => handleStockQtyBlur(item)}
                        disabled={!stockPreferences[item.sku]?.enabled}
                        className={`h-8 w-20 rounded-xl bg-white px-2 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                          stockQtyInvalid
                            ? "border border-rose-400 text-rose-600 focus:border-rose-500"
                            : "border border-slate-200 text-slate-700 focus:border-primary"
                        }`}
                        placeholder=""
                      />
                    </div>
                  </div>
                </label>
              );
            })}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={productPage <= 1}
                onClick={() => setProductPage((value) => Math.max(1, value - 1))}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {text.previousPage}
              </button>
              <div className="min-w-[72px] text-center text-sm text-slate-500">
                {productPage} / {productTotalPages}
              </div>
              <button
                type="button"
                disabled={productPage >= productTotalPages}
                onClick={() => setProductPage((value) => Math.min(productTotalPages, value + 1))}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {text.nextPage}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="text-base font-semibold text-slate-900">{text.selectedArea}</div>
            <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">{text.selectedCount}</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{selectedProducts.length}</div>
            </div>
            <div className="mt-4 space-y-2">
              {selectedProducts.slice(0, 8).map((item) => (
                <div key={item.sku} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700">{item.nameZh || item.nameEs || item.sku}</span>
                  <span className="shrink-0 text-xs text-slate-400">{item.sku}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveSelection}
              disabled={savingSelection}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {text.saveSelection}
            </button>
          </section>

          <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="text-base font-semibold text-slate-900">{text.step3}</div>
            <p className="mt-1 text-sm text-slate-500">{text.draftTip}</p>
            <select
              value={draftPlatform}
              onChange={(event) => setDraftPlatform(event.target.value)}
              className="mt-4 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary"
            >
              {(boundPlatforms.length > 0 ? boundPlatforms : bindings.map((item) => item.platform)).map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={generateDrafts}
              disabled={generatingDrafts}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {text.generateDrafts}
            </button>
          </section>
        </aside>
      </div>

      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{text.resultList}</h3>
          <span className="text-sm text-slate-500">{drafts.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left text-sm text-slate-500">
                <th className="px-4 py-3 font-semibold">{text.platform}</th>
                <th className="px-4 py-3 font-semibold">{text.code}</th>
                <th className="px-4 py-3 font-semibold">{text.zhName}</th>
                <th className="px-4 py-3 font-semibold">{text.esName}</th>
                <th className="px-4 py-3 font-semibold">{text.barcode}</th>
                <th className="px-4 py-3 font-semibold">{text.draftStatus}</th>
                <th className="px-4 py-3 font-semibold">{text.failureReason}</th>
                <th className="px-4 py-3 font-semibold">{text.generatedAt}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm text-slate-700">{item.platform}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.sku}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.nameZh || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.nameEs || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.barcode || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {item.draftStatus === "pending"
                      ? text.statusPending
                      : item.draftStatus === "running"
                        ? text.statusRunning
                        : item.draftStatus === "failed"
                          ? text.statusFailed
                          : text.statusSuccess}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{item.failureReason || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{fmtTime(item.generatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-sm text-slate-600">
            {text.platformFollowup.replace("{platform}", draftPlatform || "平台")}
          </div>
          <div className="mt-3">
            <a
              href={PLATFORM_AUTH_URLS[draftPlatform] || "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {text.openPlatform}
            </a>
          </div>
        </div>
      </section>

      {bindModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-xl rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {bindModal.mode === "edit" ? text.bindModalTitle : text.statusModalTitle}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{bindModal.platform}</p>
              </div>
              <button
                type="button"
                onClick={() => setBindModal(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-600">
                  <span>{text.shopName}</span>
                  <input
                    value={bindModal.shopName}
                    disabled={bindModal.mode === "view"}
                    onChange={(event) =>
                      setBindModal((current) => (current ? { ...current, shopName: event.target.value } : current))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-600">
                  <span>{text.storeType}</span>
                  <select
                    value={bindModal.storeType}
                    disabled={bindModal.mode === "view"}
                    onChange={(event) =>
                      setBindModal((current) => (current ? { ...current, storeType: event.target.value } : current))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary disabled:bg-slate-50"
                  >
                    <option value="">{text.selectPlaceholder}</option>
                    {STORE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {lang === "zh" ? option.labelZh : option.labelEs}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-600 md:col-span-2">
                  <span>{text.site}</span>
                  <select
                    value={bindModal.site}
                    disabled={bindModal.mode === "view"}
                    onChange={(event) =>
                      setBindModal((current) => (current ? { ...current, site: event.target.value } : current))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary disabled:bg-slate-50"
                  >
                    <option value="">{text.selectPlaceholder}</option>
                    {getSiteOptions(bindModal.platform).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 md:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-400">状态</div>
                  <div className="mt-1 font-medium text-slate-800">
                    {bindModal.bindStatus === "bound"
                      ? text.bound
                      : bindModal.bindStatus === "expired"
                        ? text.expired
                        : text.notBound}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">授权时间</div>
                  <div className="mt-1 font-medium text-slate-800">{fmtTime(bindModal.authorizedAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">失效时间</div>
                  <div className="mt-1 font-medium text-slate-800">{fmtTime(bindModal.expiredAt)}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setBindModal(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {bindModal.mode === "edit" ? text.cancel : text.close}
              </button>
              {bindModal.mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => void saveBinding(true)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
                >
                  {text.saveBinding}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {noticeModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{noticeModal.title}</h3>
            </div>
            <div className="px-6 py-5">
              <div
                className={`rounded-2xl px-4 py-4 text-sm ${
                  noticeModal.tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : noticeModal.tone === "error"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-slate-50 text-slate-700"
                }`}
              >
                {noticeModal.message}
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setNoticeModal(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
              >
                {text.modalOk}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ImageLightbox
        open={preview.open}
        src={preview.src}
        fallbackSources={preview.fallbackSources}
        title={preview.title}
        onClose={() => setPreview({ open: false, src: "", fallbackSources: [], title: "" })}
      />
    </section>
  );
}
