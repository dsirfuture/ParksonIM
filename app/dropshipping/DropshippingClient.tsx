"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ImageLightbox } from "@/components/image-lightbox";
import { PageHeader } from "@/components/page-header";
import { ProductImage } from "@/components/product-image";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { getClientLang } from "@/lib/lang-client";
import type {
  DsExchangeRatePayload,
  DsFinanceRow,
  DsInventoryRow,
  DsOrderRow,
  DsOverviewStats,
} from "@/lib/dropshipping-types";

type OverviewPayload = {
  stats: DsOverviewStats;
  recentOrders: Array<{
    id: string;
    customerName: string;
    platform: string;
    orderNo: string;
    sku: string;
    quantity: number;
    shippingStatus: "pending" | "shipped" | "cancelled";
    createdAt: string;
  }>;
  alerts: Array<{
    type:
      | "pending_order"
      | "missing_shipping_proof"
      | "low_inventory"
      | "duplicate_order"
      | "exchange_rate_failed"
      | "customer_unsettled";
    count: number;
  }>;
  trends: {
    orderCount: number;
    shippedCount: number;
    receivable: number;
  };
};

type Props = {
  initialLang: "zh" | "es";
  initialOverview: OverviewPayload;
  initialOrders: DsOrderRow[];
  initialInventory: DsInventoryRow[];
  initialFinance: DsFinanceRow[];
  initialExchangeRate: DsExchangeRatePayload;
};

type TabKey = "overview" | "orders" | "inventory" | "finance";

type InventoryPreviewState = {
  orderId: string;
  customerId: string;
  customerName: string;
  sku: string;
  productNameZh: string;
} | null;

type InventoryShippedPreviewState = {
  customerId: string;
  customerName: string;
  sku: string;
  productNameZh: string;
} | null;

type FinancePreviewState = DsFinanceRow | null;

type OrderFormState = {
  id: string;
  customerName: string;
  platform: string;
  platformOrderNo: string;
  sku: string;
  productNameZh: string;
  productNameEs: string;
  quantity: string;
  trackingNo: string;
  color: string;
  warehouse: string;
  shippedAt: string;
  shippingFee: string;
  shippingStatus: "pending" | "shipped" | "cancelled";
  notes: string;
};

const EMPTY_ORDER_FORM: OrderFormState = {
  id: "",
  customerName: "",
  platform: "",
  platformOrderNo: "",
  sku: "",
  productNameZh: "",
  productNameEs: "",
  quantity: "1",
  trackingNo: "",
  color: "",
  warehouse: "墨西哥-百盛仓",
  shippedAt: "",
  shippingFee: "",
  shippingStatus: "pending",
  notes: "",
};

const FIXED_WAREHOUSE = "墨西哥-百盛仓";

const PLATFORM_OPTIONS = [
  "无",
  "Mercado Libre",
  "Amazon",
  "Shopee",
  "AliExpress",
  "SHEIN",
  "TikTok",
  "Temu",
] as const;

const SHIPPING_FEE_OPTIONS = ["6", "8", "10", "12"] as const;

function getShippingStatusLabel(status: OrderFormState["shippingStatus"], lang: "zh" | "es") {
  if (lang === "zh") {
    if (status === "shipped") return "已发";
    if (status === "cancelled") return "已取消";
    return "未发";
  }
  if (status === "shipped") return "Enviado";
  if (status === "cancelled") return "Cancelado";
  return "Pendiente";
}

function getShippingStatusClass(status: OrderFormState["shippingStatus"]) {
  if (status === "shipped") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-900";
}

function fmtDate(value: string | null | undefined, lang: "zh" | "es") {
  if (!value) return "-";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function fmtDateOnly(value: string | null | undefined, lang: "zh" | "es") {
  if (!value) return "-";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function fmtMoney(value: number, lang: "zh" | "es") {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function invertRate(value: number | null | undefined) {
  if (!value || value === 0) return null;
  return 1 / value;
}

function getMexicoDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
  return { weekday, hour };
}

function shouldShowSaturdaySettlementReminder(date: Date) {
  const { weekday, hour } = getMexicoDateParts(date);
  return weekday === "Sat" && hour >= 12;
}

function isDirectFileLink(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (normalized.startsWith("=")) return false;
  return /^https?:\/\//i.test(normalized) || normalized.startsWith("/");
}

function PencilIcon() {
  return <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8"><path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" /><path d="M10.75 6.5 13.5 9.25" /><path d="M11.5 3.75 16.25 8.5" /></svg>;
}

function SortDirectionIcon({ direction }: { direction: "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {direction === "asc" ? <path d="M4 10 8 6l4 4" /> : <path d="m4 6 4 4 4-4" />}
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.75 10s3-5 8.25-5 8.25 5 8.25 5-3 5-8.25 5S1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

function PlusBadge() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
      +
    </span>
  );
}

function MinusBadge() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-semibold text-white">
      -
    </span>
  );
}

export function DropshippingClient({
  initialLang,
  initialOverview,
  initialOrders,
  initialInventory,
  initialFinance,
  initialExchangeRate,
}: Props) {
  const [lang, setLang] = useState<"zh" | "es">(initialLang);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [overview, setOverview] = useState(initialOverview);
  const [orders, setOrders] = useState(initialOrders);
  const [inventory, setInventory] = useState(initialInventory);
  const [finance, setFinance] = useState(initialFinance);
  const [exchangeRate, setExchangeRate] = useState(initialExchangeRate);
  const [now, setNow] = useState(() => new Date());
  const [keyword, setKeyword] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [shippedAtSortDirection, setShippedAtSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedTrackingNos, setExpandedTrackingNos] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "shipped" | "cancelled">("all");
  const [settlementFilter, setSettlementFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [productFieldsLocked, setProductFieldsLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importSummary, setImportSummary] = useState<string>("");
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [failedInventoryImages, setFailedInventoryImages] = useState<string[]>([]);
  const [inventoryPreview, setInventoryPreview] = useState<InventoryPreviewState>(null);
  const [inventoryShippedPreview, setInventoryShippedPreview] = useState<InventoryShippedPreviewState>(null);
  const [financePreview, setFinancePreview] = useState<FinancePreviewState>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLang(getClientLang());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const financeDisplayRate = useMemo(() => invertRate(exchangeRate.rateValue), [exchangeRate.rateValue]);
  const financeRateDate = exchangeRate.fetchedAt || exchangeRate.rateDate;

  const text = lang === "zh"
    ? {
        badge: "轻量业务模块",
        title: "一件代发管理",
        desc: "在现有 ParksonIM 后台内集中处理代发订单、SKU 备货、客户结算与汇率信息。",
        refresh: "刷新数据",
        create: "新增订单",
        import: "历史迁移导入",
        tabs: { overview: "总览", orders: "订单管理", inventory: "商品备货", finance: "财务结算" },
        stats: {
          todayOrders: "今日录单",
          todayShipped: "今日已发货",
          todayPending: "今日待处理",
          unsettled: "待结算客户",
          receivable: "当前总应收",
          paid: "当前总已收",
          unpaid: "当前总未收",
          rate: "今日汇率",
        },
        sections: {
          recent: "最近订单",
          alerts: "待处理提醒",
          orders: "订单列表",
          inventory: "商品备货汇总",
          finance: "客户结算",
          rate: "汇率状态",
        },
        fields: {
          customer: "客户",
          platform: "平台",
          orderNo: "订单号",
          sku: "编码",
          quantity: "数量",
          status: "状态",
          shippedAt: "发货日期",
          trackingNo: "物流号",
          color: "颜色",
          warehouse: "发货仓",
          shippingFee: "代发费",
          shippingLabel: "物流面单",
          shippingProof: "发货凭据",
          productImage: "产品图",
          productZh: "中文名",
          remaining: "剩余",
          stocked: "备货",
          shipped: "已发",
          stockAmount: "备货金额",
          rateAmount: "汇率后金额",
          total: "总金额",
          paid: "已付",
          unpaid: "未付",
          lastPaid: "最近付款",
        },
        form: {
          create: "新增订单",
          edit: "编辑订单",
          customer: "客户名称",
          platform: "平台",
          orderNo: "后台订单号",
          sku: "编码",
          productZh: "产品中文名",
          productEs: "产品西文名",
          quantity: "数量",
          trackingNo: "物流号",
          color: "颜色",
          warehouse: "发货仓",
          shippedAt: "发货日期",
          shippingFee: "代发费",
          status: "发货状态",
          notes: "备注",
          cancel: "取消",
          submit: "保存",
        },
        alerts: {
          pending_order: "未发货订单",
          missing_shipping_proof: "已发货但缺少凭据",
          low_inventory: "库存不足 SKU",
          duplicate_order: "重复订单",
          exchange_rate_failed: "汇率抓取失败",
          customer_unsettled: "未结清客户",
        },
        status: {
          pending: "待发货",
          shipped: "已发货",
          cancelled: "已取消",
          healthy: "充足",
          low: "偏低",
          empty: "售罄",
          unpaid: "未结",
          partial: "部分已结",
          paid: "已结清",
        },
        empty: {
          title: "暂无数据",
          desc: "当前还没有一件代发记录，可以先新增一条订单开始使用。",
        },
        warnings: "异常",
        saving: "保存中...",
        importing: "导入中...",
      }
    : {
        badge: "Modulo interno",
        title: "Dropshipping",
        desc: "Gestiona pedidos, inventario SKU, liquidacion por cliente y tipo de cambio dentro del ParksonIM actual.",
        refresh: "Actualizar",
        create: "Nuevo pedido",
        import: "Importar historial",
        tabs: { overview: "Resumen", orders: "Pedidos", inventory: "Inventario SKU", finance: "Finanzas" },
        stats: {
          todayOrders: "Pedidos hoy",
          todayShipped: "Enviados hoy",
          todayPending: "Pendientes hoy",
          unsettled: "Clientes por cobrar",
          receivable: "Total por cobrar",
          paid: "Total cobrado",
          unpaid: "Total pendiente",
          rate: "Tipo de cambio",
        },
        sections: {
          recent: "Pedidos recientes",
          alerts: "Alertas",
          orders: "Lista de pedidos",
          inventory: "Resumen SKU",
          finance: "Liquidacion por cliente",
          rate: "Estado del tipo de cambio",
        },
        fields: {
          customer: "Cliente",
          platform: "Plataforma",
          orderNo: "Pedido",
          sku: "Codigo",
          quantity: "Cant.",
          status: "Estado",
          shippedAt: "Fecha envio",
          trackingNo: "Guia",
          color: "Color envio",
          warehouse: "Almacen",
          shippingFee: "Cargo",
          shippingLabel: "Guia PDF",
          shippingProof: "Prueba",
          productImage: "Imagen",
          productZh: "Nombre ZH",
          remaining: "Restante",
          stocked: "Stock",
          shipped: "Enviado",
          stockAmount: "Monto stock",
          rateAmount: "Monto convertido",
          total: "Total",
          paid: "Pagado",
          unpaid: "Pendiente",
          lastPaid: "Ultimo pago",
        },
        form: {
          create: "Nuevo pedido",
          edit: "Editar pedido",
          customer: "Cliente",
          platform: "Plataforma",
          orderNo: "Numero de pedido",
          sku: "Codigo",
          productZh: "Nombre ZH",
          productEs: "Nombre ES",
          quantity: "Cantidad",
          trackingNo: "Guia",
          color: "Color",
          warehouse: "Almacen",
          shippedAt: "Fecha envio",
          shippingFee: "Cargo",
          status: "Estado",
          notes: "Nota",
          cancel: "Cancelar",
          submit: "Guardar",
        },
        alerts: {
          pending_order: "Pedidos pendientes",
          missing_shipping_proof: "Enviados sin comprobante",
          low_inventory: "SKU con poco stock",
          duplicate_order: "Pedidos duplicados",
          exchange_rate_failed: "Fallo de tipo de cambio",
          customer_unsettled: "Clientes sin liquidar",
        },
        status: {
          pending: "Pendiente",
          shipped: "Enviado",
          cancelled: "Cancelado",
          healthy: "Suficiente",
          low: "Bajo",
          empty: "Agotado",
          unpaid: "Sin pagar",
          partial: "Parcial",
          paid: "Pagado",
        },
        empty: {
          title: "Sin datos",
          desc: "Todavia no hay registros de dropshipping. Crea un pedido para empezar.",
        },
        warnings: "Alertas",
        saving: "Guardando...",
        importing: "Importando...",
      };

  async function refreshAll() {
    try {
      setError("");
      const [overviewRes, ordersRes, inventoryRes, financeRes, rateRes] = await Promise.all([
        fetch("/api/dropshipping/overview"),
        fetch("/api/dropshipping/orders"),
        fetch("/api/dropshipping/inventory"),
        fetch("/api/dropshipping/finance"),
        fetch("/api/dropshipping/exchange-rate"),
      ]);
      const [overviewJson, ordersJson, inventoryJson, financeJson, rateJson] = await Promise.all([
        overviewRes.json(),
        ordersRes.json(),
        inventoryRes.json(),
        financeRes.json(),
        rateRes.json(),
      ]);
      if (!overviewRes.ok || !overviewJson?.ok) throw new Error(overviewJson?.error || "overview");
      if (!ordersRes.ok || !ordersJson?.ok) throw new Error(ordersJson?.error || "orders");
      if (!inventoryRes.ok || !inventoryJson?.ok) throw new Error(inventoryJson?.error || "inventory");
      if (!financeRes.ok || !financeJson?.ok) throw new Error(financeJson?.error || "finance");
      if (!rateRes.ok || !rateJson?.ok) throw new Error(rateJson?.error || "rate");
      setOverview(overviewJson.data);
      setOrders(ordersJson.items || []);
      setInventory(inventoryJson.items || []);
      setFinance(financeJson.items || []);
      setExchangeRate(rateJson.item);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Load failed");
    }
  }

  const customerOptions = useMemo(() => {
    return [...new Set(orders.map((row) => row.customerName.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh"));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return orders.filter((row) => {
      const customerHit = customerFilter === "all" || row.customerName === customerFilter;
      const hit =
        !normalized ||
        [
          row.customerName,
          row.platform,
          row.platformOrderNo,
          row.sku,
          row.productNameZh,
          row.trackingNo,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const statusHit = statusFilter === "all" || row.shippingStatus === statusFilter;
      const settlementHit = settlementFilter === "all" || row.settlementStatus === settlementFilter;
      return customerHit && hit && statusHit && settlementHit;
    });
  }, [customerFilter, keyword, orders, settlementFilter, statusFilter]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const aTime = a.shippedAt ? new Date(a.shippedAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.shippedAt ? new Date(b.shippedAt).getTime() : Number.POSITIVE_INFINITY;
      if (aTime === bTime) {
        const trackingCompare = (a.trackingNo || "").localeCompare(b.trackingNo || "", "en");
        if (trackingCompare !== 0) return trackingCompare;
        const orderCompare = a.platformOrderNo.localeCompare(b.platformOrderNo, "en");
        if (orderCompare !== 0) return orderCompare;
        return a.sku.localeCompare(b.sku, "en");
      }
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return shippedAtSortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [filteredOrders, shippedAtSortDirection]);

  const trackingDisplayMeta = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of sortedOrders) {
      const tracking = row.trackingNo.trim();
      if (!tracking) continue;
      counts.set(tracking, (counts.get(tracking) || 0) + 1);
    }

    const meta = new Map<string, { showTracking: boolean; count: number }>();
    let lastTracking = "";
    for (const row of sortedOrders) {
      const tracking = row.trackingNo.trim();
      if (!tracking) {
        meta.set(row.id, { showTracking: true, count: 0 });
        continue;
      }
      meta.set(row.id, {
        showTracking: tracking !== lastTracking,
        count: counts.get(tracking) || 0,
      });
      lastTracking = tracking;
    }
    return meta;
  }, [sortedOrders]);

  const trackingGroupedOrders = useMemo(() => {
    const grouped = new Map<string, DsOrderRow[]>();
    for (const row of sortedOrders) {
      const tracking = row.trackingNo.trim();
      if (!tracking) continue;
      const current = grouped.get(tracking) || [];
      current.push(row);
      grouped.set(tracking, current);
    }
    return grouped;
  }, [sortedOrders]);

  const sameTrackingOrders = useMemo(() => {
    const tracking = form.trackingNo.trim().toLowerCase();
    if (!tracking) return [];
    return orders.filter((row) => row.trackingNo.trim().toLowerCase() === tracking);
  }, [form.trackingNo, orders]);

  const currentEditingOrder = useMemo(() => {
    if (!form.id) return null;
    return orders.find((row) => row.id === form.id) || null;
  }, [form.id, orders]);

  const platformOptions = useMemo(() => {
    const current = form.platform.trim();
    if (!current || PLATFORM_OPTIONS.includes(current as (typeof PLATFORM_OPTIONS)[number])) {
      return [...PLATFORM_OPTIONS];
    }
    return [current, ...PLATFORM_OPTIONS];
  }, [form.platform]);

  const shippingFeeOptions = useMemo(() => {
    const current = form.shippingFee.trim();
    if (!current || SHIPPING_FEE_OPTIONS.includes(current as (typeof SHIPPING_FEE_OPTIONS)[number])) {
      return [...SHIPPING_FEE_OPTIONS];
    }
    return [current, ...SHIPPING_FEE_OPTIONS];
  }, [form.shippingFee]);

  const shippingStatusOptions: OrderFormState["shippingStatus"][] = useMemo(() => {
    const base: OrderFormState["shippingStatus"][] = ["pending", "shipped"];
    return form.shippingStatus === "cancelled" ? ["pending", "shipped", "cancelled"] : base;
  }, [form.shippingStatus]);

  const currentInventoryPreview = useMemo(() => {
    if (!inventoryPreview) return null;
    return (
      inventory.find((row) =>
        row.customerId === inventoryPreview.customerId
        && row.sku.trim().toLowerCase() === inventoryPreview.sku.trim().toLowerCase(),
      ) || null
    );
  }, [inventory, inventoryPreview]);

  const relatedOrderCount = useMemo(() => {
    if (!inventoryPreview) return 0;
    return orders.filter((row) =>
      row.customerId === inventoryPreview.customerId
      && row.sku.trim().toLowerCase() === inventoryPreview.sku.trim().toLowerCase(),
    ).length;
  }, [inventoryPreview, orders]);

  const currentPreviewOrder = useMemo(() => {
    if (!inventoryPreview) return null;
    return orders.find((row) => row.id === inventoryPreview.orderId) || null;
  }, [inventoryPreview, orders]);

  const shippedOrdersForInventoryPreview = useMemo(() => {
    if (!inventoryShippedPreview) return [];
    return orders.filter((row) =>
      row.customerId === inventoryShippedPreview.customerId
      && row.sku.trim().toLowerCase() === inventoryShippedPreview.sku.trim().toLowerCase()
      && row.shippingStatus === "shipped",
    );
  }, [inventoryShippedPreview, orders]);

  const orderTableCardProps = {
    description: undefined,
    titleRight: (
      <div className="flex items-center gap-2">
        <select
          value={customerFilter}
          onChange={(event) => setCustomerFilter(event.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="all">{lang === "zh" ? "全部客户" : "Todos los clientes"}</option>
          {customerOptions.map((customer) => (
            <option key={customer} value={customer}>
              {customer}
            </option>
          ))}
        </select>
      </div>
    ),
    right: (
      <div className="flex w-full justify-end lg:w-auto">
        <div className="relative w-full max-w-[420px]">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={lang === "zh" ? "搜索平台 / 订单号 / 编码" : "Buscar plataforma / pedido / codigo"}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-[130px] text-sm text-slate-700"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="absolute right-1 top-1 h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">{lang === "zh" ? "全部状态" : "Todos"}</option>
            <option value="pending">{getShippingStatusLabel("pending", lang)}</option>
            <option value="shipped">{getShippingStatusLabel("shipped", lang)}</option>
            <option value="cancelled">{getShippingStatusLabel("cancelled", lang)}</option>
          </select>
        </div>
      </div>
    ),
  };

  const showSaturdaySettlementReminder = useMemo(
    () => shouldShowSaturdaySettlementReminder(now),
    [now],
  );
  function openCreateModal() {
    setForm({ ...EMPTY_ORDER_FORM, warehouse: FIXED_WAREHOUSE });
    setProductFieldsLocked(false);
    setLabelFiles([]);
    setProofFiles([]);
    setModalOpen(true);
  }

  function openCreateModalWithTrackingSeed() {
    setForm({
      ...EMPTY_ORDER_FORM,
      customerName: form.customerName,
      platform: form.platform,
      platformOrderNo: form.platformOrderNo,
      trackingNo: form.trackingNo,
      color: form.color,
      shippedAt: form.shippedAt,
      shippingFee: form.shippingFee,
      shippingStatus: form.shippingStatus,
      warehouse: FIXED_WAREHOUSE,
    });
    setProductFieldsLocked(false);
    setLabelFiles([]);
    setProofFiles([]);
    setModalOpen(true);
  }

  function openEditModal(order: DsOrderRow) {
    setForm({
      id: order.id,
      customerName: order.customerName,
      platform: order.platform,
      platformOrderNo: order.platformOrderNo,
      sku: order.sku,
      productNameZh: order.productNameZh,
      productNameEs: order.productNameEs,
      quantity: String(order.quantity),
      trackingNo: order.trackingNo,
      color: order.color,
      warehouse: order.warehouse || FIXED_WAREHOUSE,
      shippedAt: order.shippedAt ? order.shippedAt.slice(0, 10) : "",
      shippingFee: order.shippingFee ? String(order.shippingFee) : "",
      shippingStatus: order.shippingStatus,
      notes: order.notes,
    });
    setProductFieldsLocked(order.catalogMatched);
    setLabelFiles([]);
    setProofFiles([]);
    setModalOpen(true);
  }

  async function uploadOrderAttachments(orderId: string) {
    const uploadSets: Array<{ type: "label" | "proof"; files: File[] }> = [
      { type: "label", files: labelFiles.slice(0, 1) },
      { type: "proof", files: proofFiles },
    ];

    for (const item of uploadSets) {
      if (item.files.length === 0) continue;
      const formData = new FormData();
      formData.append("type", item.type);
      for (const file of item.files) {
        formData.append("files", file);
      }
      const response = await fetch(`/api/dropshipping/orders/${orderId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "attachment_upload_failed");
      }
    }
  }

  async function submitOrder() {
    try {
      setSaving(true);
      setError("");
      const endpoint = form.id ? `/api/dropshipping/orders/${form.id}` : "/api/dropshipping/orders";
      const method = form.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          platform: form.platform,
          platformOrderNo: form.platformOrderNo,
          sku: form.sku,
          productNameZh: form.productNameZh,
          productNameEs: form.productNameEs,
          quantity: Number(form.quantity || 0),
          trackingNo: form.trackingNo,
          color: form.color,
          warehouse: FIXED_WAREHOUSE,
          shippedAt: form.shippedAt || null,
          shippingFee: form.shippingFee || null,
          shippingStatus: form.shippingStatus,
          notes: form.notes,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.error || "save_failed");
      const orderId = String(json.id || form.id || "");
      if (orderId) {
        await uploadOrderAttachments(orderId);
      }
      setModalOpen(false);
      setForm(EMPTY_ORDER_FORM);
      setLabelFiles([]);
      setProofFiles([]);
      await refreshAll();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSameTrackingOrder(order: DsOrderRow) {
    const tracking = order.trackingNo.trim();
    if (!tracking) {
      setError("tracking_required_for_delete");
      return;
    }

    const confirmValue = window.prompt(
      lang === "zh"
        ? `请输入完整物流号后删除：${tracking}`
        : `Escribe la guia completa para eliminar: ${tracking}`,
      "",
    );

    if (confirmValue === null) return;
    if (confirmValue.trim() !== tracking) {
      setError(lang === "zh" ? "物流号校验失败" : "La guia no coincide");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/dropshipping/orders/${order.id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "delete_failed");
      }
      if (form.id === order.id) {
        setModalOpen(false);
        setForm(EMPTY_ORDER_FORM);
      }
      await refreshAll();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "delete_failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(file: File) {
    try {
      setImporting(true);
      setImportProgress(null);
      setError("");
      setImportSummary("");
      const lowerName = file.name.toLowerCase();
      let response: Response;

      if (lowerName.endsWith(".zip")) {
        setImportProgress(5);
        const uploadUrlRes = await fetch("/api/dropshipping/import/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/zip",
          }),
        });
        const uploadUrlJson = await uploadUrlRes.json();
        if (!uploadUrlRes.ok || !uploadUrlJson?.ok || !uploadUrlJson?.upload?.url || !uploadUrlJson?.upload?.key) {
          throw new Error(uploadUrlJson?.error || "create_upload_url_failed");
        }

        setImportProgress(20);
        const uploadRes = await fetch(uploadUrlJson.upload.url as string, {
          method: "PUT",
          headers: uploadUrlJson.upload.headers || { "Content-Type": file.type || "application/zip" },
          body: file,
        });
        if (!uploadRes.ok) {
          const uploadErrorText = await uploadRes.text();
          throw new Error(uploadErrorText || "upload_to_r2_failed");
        }

        setImportProgress(75);
        response = await fetch("/api/dropshipping/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            r2Key: uploadUrlJson.upload.key,
            fileName: file.name,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", file);
        response = await fetch("/api/dropshipping/import", {
          method: "POST",
          body: formData,
        });
      }

      const raw = await response.text();
      let json: { ok?: boolean; error?: string; summary?: Record<string, number> } | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        if (!response.ok) {
          throw new Error(raw || "import_failed");
        }
        throw new Error("import_failed");
      }
      if (!response.ok || !json?.ok) throw new Error(json?.error || "import_failed");
      const summary = json.summary || {};
      setImportProgress(100);
      setImportSummary(
        lang === "zh"
          ? `已导入 ${summary.totalRows || 0} 行，新增订单 ${summary.createdOrders || 0}，更新订单 ${summary.updatedOrders || 0}，同步客户 ${summary.touchedCustomers || 0}，同步商品 ${summary.touchedProducts || 0}，付款快照 ${summary.seededPayments || 0}，面单 ${summary.uploadedLabels || 0}，凭据 ${summary.uploadedProofs || 0}。`
          : `Importadas ${summary.totalRows || 0} filas, pedidos nuevos ${summary.createdOrders || 0}, pedidos actualizados ${summary.updatedOrders || 0}, clientes ${summary.touchedCustomers || 0}, productos ${summary.touchedProducts || 0}, pagos ${summary.seededPayments || 0}, guias ${summary.uploadedLabels || 0}, pruebas ${summary.uploadedProofs || 0}.`,
      );
      await refreshAll();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "import_failed";
      if (message.includes("Request Entity Too Large") || message.includes("request entity too large")) {
        setError(
          lang === "zh"
            ? "历史导入压缩包被服务器拦截了，通常是上传体积超限。请把当前 zip 文件大小告诉我，我继续把上传链路改成可用方案。"
            : "The history import zip was blocked by the server, usually because the upload is too large. Tell me the zip size and I will adjust the upload flow.",
        );
        return;
      }
      setError(message);
    } finally {
      setImportProgress(null);
      setImporting(false);
    }
  }

  const tabButtonClass = (tab: TabKey) =>
    `inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
      activeTab === tab ? "bg-primary text-white shadow-soft" : "bg-white text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <section className="space-y-5">
      <PageHeader
        badge={text.badge}
        title={text.title}
        description={text.desc}
        meta={
          <div className="space-y-1">
            <div>RMB → MXN</div>
            <div>{text.sections.rate}: {exchangeRate.rateValue.toFixed(4)}</div>
          </div>
        }
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip,.xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {text.refresh}
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {importing ? text.importing : text.import}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
            >
              {text.create}
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      ) : null}

      {importSummary ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importSummary}</div>
      ) : null}

      {importing && importProgress !== null ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          {lang === "zh"
            ? `历史迁移处理中：${importProgress}%`
            : `Processing history import: ${importProgress}%`}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["overview", "orders", "inventory", "finance"] as TabKey[]).map((tab) => (
          <button key={tab} type="button" className={tabButtonClass(tab)} onClick={() => setActiveTab(tab)}>
            {text.tabs[tab]}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={text.stats.todayOrders} value={overview.stats.todayOrders} />
            <StatCard label={text.stats.todayShipped} value={overview.stats.todayShippedOrders} valueClassName="text-emerald-600" />
            <StatCard label={text.stats.todayPending} value={overview.stats.todayPendingOrders} valueClassName="text-amber-600" />
            <StatCard label={text.stats.unsettled} value={overview.stats.unsettledCustomers} valueClassName="text-rose-600" />
            <StatCard label={text.stats.receivable} value={fmtMoney(overview.stats.totalReceivable, lang)} />
            <StatCard label={text.stats.paid} value={fmtMoney(overview.stats.totalPaid, lang)} valueClassName="text-emerald-600" />
            <StatCard label={text.stats.unpaid} value={fmtMoney(overview.stats.totalUnpaid, lang)} valueClassName="text-rose-600" />
            <StatCard label={text.stats.rate} value={overview.stats.currentRate?.toFixed(4) || "-"} hint={fmtDate(overview.stats.rateUpdatedAt, lang)} />
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <TableCard title={text.sections.recent}>
              {overview.recentOrders.length === 0 ? (
                <EmptyState title={text.empty.title} description={text.empty.desc} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-500">
                        <th className="px-4 py-3 font-medium">{text.fields.customer}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.platform}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.orderNo}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.sku}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.quantity}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentOrders.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-sm text-slate-700">{row.customerName}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.platform}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.orderNo}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.sku}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.quantity}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{text.status[row.shippingStatus]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TableCard>

            <TableCard title={text.sections.alerts}>
              <div className="grid gap-3 p-4">
                {overview.alerts.map((item) => (
                  <div key={item.type} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm text-slate-500">{text.alerts[item.type]}</div>
                    <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{item.count}</div>
                  </div>
                ))}
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {text.sections.rate}: {exchangeRate.rateValue.toFixed(4)} / {fmtDate(exchangeRate.fetchedAt || exchangeRate.rateDate, lang)}
                  {exchangeRate.fetchFailed ? (
                    <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-600">
                      {exchangeRate.failureReason || text.alerts.exchange_rate_failed}
                    </div>
                  ) : null}
                </div>
              </div>
            </TableCard>
          </div>
        </>
      ) : null}

      {activeTab === "orders" ? (
        <TableCard
          title={text.sections.orders}
          description={lang === "zh" ? "支持快速录单、状态切换和异常提示。" : "Alta rapida, estado y alertas basicas."}
          unusedTitleRight={
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={lang === "zh" ? "搜索客户 / 平台 / 订单号 / SKU" : "Buscar cliente / plataforma / pedido / SKU"}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all" hidden>{lang === "zh" ? "全部结算" : "Todos"}</option>
                <option value="pending">{text.status.pending}</option>
                <option value="shipped">{text.status.shipped}</option>
                <option value="cancelled">{text.status.cancelled}</option>
              </select>
            </div>
          }
          hideDescription
          titleRight={
            <div className="flex items-center gap-2">
              <select
                value={customerFilter}
                onChange={(event) => setCustomerFilter(event.target.value)}
                className="h-10 rounded-xl border border-secondary-accent bg-secondary-accent px-3 text-sm text-primary"
              >
                <option value="all" hidden>{lang === "zh" ? "全部客户" : "Todos los clientes"}</option>
                {customerOptions.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
          }
          right={
            <div className="flex w-full justify-end gap-2 lg:w-auto">
              <select
                value={settlementFilter}
                onChange={(event) => setSettlementFilter(event.target.value as typeof settlementFilter)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">{lang === "zh" ? "全部结算" : "Toda liquidacion"}</option>
                <option value="paid">{lang === "zh" ? "已结" : "Liquidado"}</option>
                <option value="unpaid">{lang === "zh" ? "未结" : "Pendiente"}</option>
              </select>
              <div className="relative w-full max-w-[420px]">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={lang === "zh" ? "搜索平台 / 订单号 / 编码" : "Buscar plataforma / pedido / codigo"}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-[130px] text-sm text-slate-700"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="absolute right-1 top-1 h-8 rounded-lg border border-secondary-accent bg-secondary-accent px-3 text-sm text-primary"
                >
                  <option value="all" hidden>{lang === "zh" ? "全部状态" : "Todos"}</option>
                  <option value="pending">{getShippingStatusLabel("pending", lang)}</option>
                  <option value="shipped">{getShippingStatusLabel("shipped", lang)}</option>
                  <option value="cancelled">{getShippingStatusLabel("cancelled", lang)}</option>
                </select>
              </div>
            </div>
          }
        >
          {filteredOrders.length === 0 ? (
            <EmptyState
              title={text.empty.title}
              description={text.empty.desc}
              action={
                <button type="button" onClick={openCreateModal} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
                  {text.create}
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-max border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(148,163,184,0.18)]">
                  <tr className="bg-slate-50 text-left text-xs text-slate-700">
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.platform}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.orderNo}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.trackingNo}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.shippingLabel}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.status}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">
                      <button
                        type="button"
                        onClick={() => setShippedAtSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                        className="inline-flex items-center gap-1 text-slate-700"
                        title={lang === "zh" ? "按发货日期排序" : "Ordenar por fecha de envio"}
                      >
                        <span>{text.fields.shippedAt}</span>
                        <SortDirectionIcon direction={shippedAtSortDirection} />
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.shippingProof}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.sku}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">{text.fields.quantity}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.color}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{lang === "zh" ? "结算" : "Liquidacion"}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">{text.fields.shippingFee}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.productImage}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.productZh}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700" aria-label={lang === "zh" ? "编辑" : "Editar"} />
                  </tr>
                </thead>
                <tbody className="text-[13px] text-slate-700">
                  {sortedOrders.map((row) => {
                    const meta = trackingDisplayMeta.get(row.id);
                    const tracking = row.trackingNo.trim();
                    const isExpanded = tracking ? expandedTrackingNos.includes(tracking) : false;
                    const groupedItems = tracking ? (trackingGroupedOrders.get(tracking) || []).filter((item) => item.id !== row.id) : [];

                    return (
                    <Fragment key={row.id}>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.platform}</td>
                      <td className="px-3 py-2 text-slate-900">{row.platformOrderNo}</td>
                      <td className="px-3 py-2">
                        {(() => {
                          if (!row.trackingNo) return <span>-</span>;
                          if (!meta?.showTracking) return <span className="text-slate-300">|</span>;
                          return (
                            <div className="inline-flex items-center gap-2">
                              <span>{row.trackingNo}</span>
                              {meta.count > 1 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTrackingNos((prev) =>
                                      prev.includes(tracking)
                                        ? prev.filter((item) => item !== tracking)
                                        : [...prev, tracking],
                                    )
                                  }
                                  className="inline-flex"
                                  aria-label={lang === "zh" ? "\u5c55\u5f00\u540c\u7269\u6d41\u53f7\u5546\u54c1" : "Expand grouped tracking items"}
                                  title={lang === "zh" ? "\u67e5\u770b\u540c\u7269\u6d41\u53f7\u5176\u4ed6\u5546\u54c1" : "Ver otros productos con la misma guia"}
                                >
                                  <PlusBadge />
                                </button>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-h-10 items-center justify-center">
                          {row.shippingLabelAttachments[0]?.fileUrl ? (
                            <a
                              href={row.shippingLabelAttachments[0].fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              PDF
                            </a>
                          ) : isDirectFileLink(row.shippingLabelFile) ? (
                            <a
                              href={row.shippingLabelFile}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              PDF
                            </a>
                          ) : (
                            <span className="text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${getShippingStatusClass(row.shippingStatus)}`}>
                          {getShippingStatusLabel(row.shippingStatus, lang)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.shippedAt ? fmtDateOnly(row.shippedAt, lang) : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-h-10 items-center justify-center">
                        {row.shippingProofAttachments[0]?.fileUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: row.shippingProofAttachments[0].fileUrl,
                                title: `${row.platformOrderNo} / ${row.sku}`,
                              })
                            }
                            className="relative block overflow-hidden rounded-md border border-slate-200 bg-white"
                            title={lang === "zh" ? "预览发货凭据" : "Ver comprobante"}
                          >
                            <img
                              src={row.shippingProofAttachments[0].fileUrl}
                              alt={`${row.platformOrderNo} ${row.sku}`}
                              className="h-10 w-10 object-cover"
                            />
                            {row.shippingProofAttachments.length > 1 ? (
                              <span className="absolute bottom-0 right-0 rounded-tl-md bg-slate-900/75 px-1 text-[10px] text-white">
                                {row.shippingProofAttachments.length}
                              </span>
                            ) : null}
                          </button>
                        ) : isDirectFileLink(row.shippingProofFile) ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: row.shippingProofFile,
                                title: `${row.platformOrderNo} / ${row.sku}`,
                              })
                            }
                            className="block overflow-hidden rounded-md border border-slate-200 bg-white"
                            title={lang === "zh" ? "预览发货凭据" : "Ver comprobante"}
                          >
                            <img
                              src={row.shippingProofFile}
                              alt={`${row.platformOrderNo} ${row.sku}`}
                              className="h-10 w-10 object-cover"
                            />
                          </button>
                        ) : (
                          <span className="text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                        )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setInventoryPreview({
                              orderId: row.id,
                              customerId: row.customerId,
                              customerName: row.customerName,
                              sku: row.sku,
                              productNameZh: row.productNameZh,
                            })
                          }
                          className="text-slate-900 hover:text-primary"
                        >
                          {row.sku}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                      <td className="px-3 py-2">{row.color || "-"}</td>
                      <td className={`px-3 py-2 ${row.settlementStatus === "paid" ? "text-emerald-600" : "text-rose-600"}`}>
                        {row.settlementStatus === "paid"
                          ? lang === "zh"
                            ? "已结"
                            : "Liquidado"
                          : lang === "zh"
                            ? "未结"
                            : "Pendiente"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(row.shippingFee, lang)}</td>
                      <td className="px-3 py-2">
                        <div className="flex min-h-10 items-center justify-center">
                        {row.productImageUrl ? (
                          <ProductImage
                            sku={row.sku}
                            hasImage
                            size={40}
                            roundedClassName="rounded-md"
                            onClick={() =>
                              setPreviewImage({
                                src: row.productImageUrl,
                                title: row.sku,
                              })
                            }
                          />
                        ) : (
                          <span className="text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                        )}
                        </div>
                      </td>
                      <td className="max-w-[220px] px-3 py-2 truncate text-slate-900">{row.productNameZh}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          title={lang === "zh" ? "编辑" : "Editar"}
                          aria-label={lang === "zh" ? "编辑" : "Editar"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          <PencilIcon />
                        </button>
                      </td>
                    </tr>
                    {meta?.showTracking && meta.count > 1 && isExpanded && groupedItems.length > 0 ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5" />
                        <td colSpan={13} className="px-3 py-2.5">
                          <div className="relative pl-6">
                            <span className="absolute left-0 top-[-10px] h-5 w-px bg-slate-300" />
                            <span className="absolute left-0 top-2 h-px w-4 bg-slate-300" />
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              {groupedItems.map((item) => (
                                <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1">
                                  <span>{item.sku}</span>
                                  <span>/</span>
                                  <span>{item.productNameZh || "-"}</span>
                                  <span>/</span>
                                  <span>{lang === "zh" ? "\u6570\u91cf" : "Cant."} {item.quantity}</span>
                                  <span>/</span>
                                  <span>{fmtDateOnly(item.shippedAt, lang)}</span>
                                  <span>/</span>
                                  <span>{getShippingStatusLabel(item.shippingStatus, lang)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>
      ) : null}

      {activeTab === "inventory" ? (
        <TableCard title={text.sections.inventory}>
          {inventory.length === 0 ? (
            <EmptyState title={text.empty.title} description={lang === "zh" ? "录入订单后系统会自动建立客户+SKU 库存记录，后续可继续扩展基础资料维护。" : "Al guardar pedidos se crean registros base de cliente+SKU para seguimiento."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="px-4 py-3 font-medium">{text.fields.customer}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.sku}</th>
                    <th className="px-4 py-3 font-medium">{lang === "zh" ? "备货时间" : "Fecha de stock"}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.productImage}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.productZh}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.warehouse}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.stocked}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.shipped}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.remaining}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.stockAmount}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row) => (
                    <tr key={row.inventoryId} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-700">{row.customerName}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{row.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.stockedAt ? fmtDateOnly(row.stockedAt, lang) : "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex min-h-10 items-center justify-center">
                          {row.productImageUrl && !failedInventoryImages.includes(row.inventoryId) ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewImage({
                                  src: row.productImageUrl,
                                  title: `${row.sku} / ${row.productNameZh || "-"}`,
                                })
                              }
                              className="overflow-hidden rounded-md border border-slate-200 bg-white"
                              title={lang === "zh" ? "预览商品图" : "Ver imagen"}
                            >
                              <img
                                src={row.productImageUrl}
                                alt={row.productNameZh || row.sku}
                                className="h-10 w-10 object-cover"
                                onError={() =>
                                  setFailedInventoryImages((prev) =>
                                    prev.includes(row.inventoryId) ? prev : [...prev, row.inventoryId],
                                  )
                                }
                              />
                            </button>
                          ) : (
                            <span className="text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.productNameZh}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.warehouse || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.stockedQty}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.shippedQty > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setInventoryShippedPreview({
                                customerId: row.customerId,
                                customerName: row.customerName,
                                sku: row.sku,
                                productNameZh: row.productNameZh,
                              })
                            }
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {row.shippedQty}
                          </button>
                        ) : (
                          row.shippedQty
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${row.remainingQty <= 0 ? "text-rose-600" : row.remainingQty < 5 ? "text-amber-600" : "text-slate-900"}`}>{row.remainingQty}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.stockAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{text.status[row.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>
      ) : null}

      {activeTab === "finance" ? (
        <TableCard title={text.sections.finance}>
          {finance.length === 0 ? (
            <EmptyState title={text.empty.title} description={text.empty.desc} />
          ) : (
            <div>
              {showSaturdaySettlementReminder ? (
                <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                  {lang === "zh"
                    ? `按墨西哥时间，每周六中午 12:00 后提醒本周结算。当天结算汇率按 MXN → RMB ${financeDisplayRate?.toFixed(4) || "-"} / ${fmtDateOnly(financeRateDate, lang)} 显示。`
                    : `En horario de Mexico, despues de las 12:00 del sabado ya es momento de recordar la liquidacion semanal. El tipo de cambio de hoy para liquidar se muestra como MXN -> RMB ${financeDisplayRate?.toFixed(4) || "-"} / ${fmtDateOnly(financeRateDate, lang)}.`}
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 text-left text-sm text-slate-500">
                      <th className="px-4 py-3 font-medium">{text.fields.customer}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.stockAmount}</th>
                      <th className="px-4 py-3 font-medium">{lang === "zh" ? "今日汇率 (MXN → RMB)" : "Tipo de cambio hoy (MXN -> RMB)"}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.rateAmount}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.shippingFee}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.total}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.paid}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.unpaid}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.lastPaid}</th>
                      <th className="px-4 py-3 font-medium">{text.fields.status}</th>
                      <th className="px-4 py-3 font-medium">{lang === "zh" ? "详情" : "Detalle"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.map((row) => (
                      <tr key={row.customerId} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.customerName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.stockAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{invertRate(row.exchangeRate)?.toFixed(4) || "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.exchangedAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.shippingAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.totalAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600">{fmtMoney(row.paidAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-rose-600">{fmtMoney(row.unpaidAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtDate(row.lastPaidAt, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{text.status[row.status]}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <button
                            type="button"
                            onClick={() => setFinancePreview(row)}
                            disabled={row.settledOrders.length === 0}
                            title={lang === "zh" ? "查看已结算详情" : "Ver liquidaciones"}
                            aria-label={lang === "zh" ? "查看已结算详情" : "Ver liquidaciones"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                          >
                            <EyeIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TableCard>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="flex max-h-[88vh] w-full max-w-[860px] flex-col rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {form.id ? text.form.edit : text.form.create}
              </h3>
            </div>
            <div className="overflow-y-auto px-5 py-5">
              <div className="grid gap-4 md:grid-cols-6 xl:grid-cols-12">
                {([
                ["customerName", text.form.customer, "md:col-span-3 xl:col-span-4"],
                ["platformOrderNo", text.form.orderNo, "md:col-span-3 xl:col-span-4"],
                ["sku", text.form.sku, "md:col-span-2 xl:col-span-4"],
                ["productNameZh", text.form.productZh, "md:col-span-3 xl:col-span-4"],
                ["productNameEs", text.form.productEs, "md:col-span-3 xl:col-span-4"],
                ["quantity", text.form.quantity, "md:col-span-2 xl:col-span-2"],
                ["trackingNo", text.form.trackingNo, "md:col-span-3 xl:col-span-4"],
                ["color", text.form.color, "md:col-span-3 xl:col-span-4"],
                ["warehouse", text.form.warehouse, "md:col-span-3 xl:col-span-4"],
                ["shippedAt", text.form.shippedAt, "md:col-span-2 xl:col-span-3"],
              ] as Array<[keyof OrderFormState, string, string]>).map(([key, label, spanClass]) => (
                <label key={key} className={`space-y-1 ${spanClass}`}>
                  <span className="text-xs text-slate-500">{label}</span>
                  <input
                    type={key === "shippedAt" ? "date" : key === "quantity" ? "number" : "text"}
                    value={form[key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    disabled={key === "warehouse" || (productFieldsLocked && (key === "sku" || key === "productNameZh" || key === "productNameEs"))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </label>
              ))}

              {sameTrackingOrders.length > 1 ? (
                <div className="md:col-span-6 xl:col-span-12">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-500">
                      {lang === "zh" ? "同物流号商品" : "Productos con la misma guia"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sameTrackingOrders.map((item) => (
                        <div key={item.id} className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                              item.id === form.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                              {item.productImageUrl ? (
                                <img
                                  src={item.productImageUrl}
                                  alt={item.productNameZh || item.sku}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>
                              )}
                            </span>
                            <span>{item.sku}</span>
                          </button>
                          {sameTrackingOrders.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => void deleteSameTrackingOrder(item)}
                              className="inline-flex"
                              title={lang === "zh" ? "删除这个同物流号商品" : "Eliminar este producto agrupado"}
                              aria-label={lang === "zh" ? "删除这个同物流号商品" : "Eliminar este producto agrupado"}
                            >
                              <MinusBadge />
                            </button>
                          ) : null}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={openCreateModalWithTrackingSeed}
                        className="inline-flex"
                        title={lang === "zh" ? "新增同物流号商品" : "Agregar producto con la misma guia"}
                        aria-label={lang === "zh" ? "新增同物流号商品" : "Agregar producto con la misma guia"}
                      >
                        <PlusBadge />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-1 md:col-span-3 xl:col-span-4">
                <span className="text-xs text-slate-500">{text.fields.shippingLabel}</span>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  {currentEditingOrder?.shippingLabelAttachments[0]?.fileUrl ? (
                    <a
                      href={currentEditingOrder.shippingLabelAttachments[0].fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      PDF
                    </a>
                  ) : null}
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => setLabelFiles(event.target.files ? [event.target.files[0]].filter(Boolean) as File[] : [])}
                    className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                  />
                  {labelFiles.length > 0 ? (
                    <div className="mt-2 text-xs text-slate-500">{labelFiles[0].name}</div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1 md:col-span-3 xl:col-span-4">
                <span className="text-xs text-slate-500">{text.fields.shippingProof}</span>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  {currentEditingOrder?.shippingProofAttachments.length ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {currentEditingOrder.shippingProofAttachments.slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPreviewImage({ src: item.fileUrl, title: item.fileName })}
                          className="overflow-hidden rounded-md border border-slate-200"
                        >
                          <img src={item.fileUrl} alt={item.fileName} className="h-10 w-10 object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setProofFiles(event.target.files ? Array.from(event.target.files) : [])}
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                  />
                  {proofFiles.length > 0 ? (
                    <div className="mt-2 text-xs text-slate-500">{proofFiles.length} file(s)</div>
                  ) : null}
                </div>
              </div>

              <label className="space-y-1 md:col-span-6 xl:col-span-4">
                <span className="text-xs text-slate-500">{text.form.platform}</span>
                <select
                  value={form.platform}
                  onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">{lang === "zh" ? "请选择平台" : "Selecciona plataforma"}</option>
                  {platformOptions.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-3 xl:col-span-4">
                <span className="text-xs text-slate-500">{text.form.status}</span>
                <select
                  value={form.shippingStatus}
                  onChange={(event) => setForm((prev) => ({ ...prev, shippingStatus: event.target.value as OrderFormState["shippingStatus"] }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  {shippingStatusOptions.map((status: OrderFormState["shippingStatus"]) => (
                    <option key={status} value={status}>
                      {getShippingStatusLabel(status, lang)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-3 xl:col-span-4">
                <span className="text-xs text-slate-500">{text.form.shippingFee}</span>
                <select
                  value={form.shippingFee}
                  onChange={(event) => setForm((prev) => ({ ...prev, shippingFee: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">{lang === "zh" ? "请选择代发费" : "Selecciona cargo"}</option>
                  {shippingFeeOptions.map((fee) => (
                    <option key={fee} value={fee}>
                      {fee}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-6 xl:col-span-12">
                <span className="text-xs text-slate-500">{text.form.notes}</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {text.form.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitOrder()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? text.saving : text.form.submit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {inventoryPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[640px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">
                    {lang === "zh" ? "\u5907\u8d27\u8be6\u60c5" : "Detalle de inventario"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {inventoryPreview.sku} / {inventoryPreview.productNameZh || "-"}
                  </p>
                </div>
                <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {currentInventoryPreview?.productImageUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          src: currentInventoryPreview.productImageUrl,
                          title: `${currentInventoryPreview.sku} / ${currentInventoryPreview.productNameZh || "-"}`,
                        })
                      }
                      className="h-full w-full"
                    >
                      <img
                        src={currentInventoryPreview.productImageUrl}
                        alt={currentInventoryPreview.productNameZh || currentInventoryPreview.sku}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "关联订单数" : "Pedidos relacionados"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{relatedOrderCount}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "导入发货日期" : "Fecha importada"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {currentPreviewOrder?.shippedAt ? fmtDateOnly(currentPreviewOrder.shippedAt, lang) : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "导入备货数量" : "Stock importado"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {currentPreviewOrder?.snapshotStockedQty ?? currentInventoryPreview?.stockedQty ?? "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "导入备货金额" : "Monto importado"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {currentPreviewOrder?.snapshotStockAmount !== null && currentPreviewOrder?.snapshotStockAmount !== undefined
                    ? fmtMoney(currentPreviewOrder.snapshotStockAmount, lang)
                    : currentInventoryPreview
                      ? fmtMoney(currentInventoryPreview.stockAmount, lang)
                      : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "备货数量" : "Stock"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{currentInventoryPreview?.stockedQty ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "已发数量" : "Enviado"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{currentInventoryPreview?.shippedQty ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "剩余数量" : "Restante"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{currentInventoryPreview?.remainingQty ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "发货仓" : "Almacen"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{currentInventoryPreview?.warehouse || "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "备货金额" : "Monto stock"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {currentInventoryPreview ? fmtMoney(currentInventoryPreview.stockAmount, lang) : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">{lang === "zh" ? "状态" : "Estado"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {currentInventoryPreview ? text.status[currentInventoryPreview.status] : (lang === "zh" ? "暂无备货记录" : "Sin stock")}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setInventoryPreview(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {lang === "zh" ? "关闭" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {inventoryShippedPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[920px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {lang === "zh" ? "已发记录" : "Registros enviados"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {inventoryShippedPreview.customerName} / {inventoryShippedPreview.sku} / {inventoryShippedPreview.productNameZh || "-"}
              </p>
            </div>
            <div className="max-h-[70vh] overflow-auto px-5 py-5">
              {shippedOrdersForInventoryPreview.length === 0 ? (
                <EmptyState
                  title={lang === "zh" ? "暂无已发记录" : "Sin registros enviados"}
                  description={lang === "zh" ? "当前商品还没有已发出的订单记录。" : "Este producto aun no tiene pedidos enviados."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-500">
                        <th className="px-4 py-3 font-medium">{text.fields.orderNo}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.trackingNo}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.shippedAt}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.quantity}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.color}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.shippingLabel}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.shippingProof}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shippedOrdersForInventoryPreview.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-sm text-slate-900">{row.platformOrderNo}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.trackingNo || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{fmtDateOnly(row.shippedAt, lang)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.quantity}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.color || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {row.shippingLabelAttachments[0]?.fileUrl ? (
                              <a
                                href={row.shippingLabelAttachments[0].fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                PDF
                              </a>
                            ) : (
                              <span className="text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {row.shippingProofAttachments[0]?.fileUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    src: row.shippingProofAttachments[0].fileUrl,
                                    title: `${row.platformOrderNo} / ${row.sku}`,
                                  })
                                }
                                className="overflow-hidden rounded-md border border-slate-200 bg-white"
                              >
                                <img
                                  src={row.shippingProofAttachments[0].fileUrl}
                                  alt={`${row.platformOrderNo} ${row.sku}`}
                                  className="h-10 w-10 object-cover"
                                />
                              </button>
                            ) : (
                              <span className="text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setInventoryShippedPreview(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {lang === "zh" ? "关闭" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {financePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[920px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {lang === "zh" ? "已结算详情" : "Detalle de liquidaciones"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{financePreview.customerName}</p>
            </div>
            <div className="max-h-[70vh] overflow-auto px-5 py-5">
              {financePreview.settledOrders.length === 0 ? (
                <EmptyState
                  title={lang === "zh" ? "暂无已结算记录" : "Sin registros liquidados"}
                  description={lang === "zh" ? "当前客户还没有已结算的订单。" : "Este cliente aun no tiene pedidos liquidados."}
                />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <div className="min-w-[1120px]">
                    <div className="hidden items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700 lg:grid lg:grid-cols-[72px_180px_120px_180px_170px_110px_110px_120px_110px]">
                      <div className="whitespace-nowrap">{lang === "zh" ? "商品图" : "Imagen"}</div>
                      <div className="whitespace-nowrap">{text.fields.orderNo}</div>
                      <div className="whitespace-nowrap">{text.fields.sku}</div>
                      <div className="whitespace-nowrap">{text.fields.productZh}</div>
                      <div className="whitespace-nowrap">{text.fields.trackingNo}</div>
                      <div className="whitespace-nowrap">{text.fields.shippedAt}</div>
                      <div className="whitespace-nowrap">{lang === "zh" ? "结算日期" : "Fecha liquidacion"}</div>
                      <div className="whitespace-nowrap">{lang === "zh" ? "已结金额" : "Monto liquidado"}</div>
                      <div className="whitespace-nowrap">{text.fields.total}</div>
                    </div>
                    <div className="divide-y divide-slate-200">
                    {financePreview.settledOrders.map((item) => (
                      <div
                        key={item.orderId}
                        className="px-4 py-4 lg:grid lg:grid-cols-[72px_180px_120px_180px_170px_110px_110px_120px_110px] lg:items-center lg:gap-4"
                      >
                        <div className="mb-4 flex justify-center lg:mb-0">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {item.productImageUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    src: item.productImageUrl,
                                    title: `${item.sku} / ${item.productNameZh || "-"}`,
                                  })
                                }
                                className="h-full w-full"
                              >
                                <img
                                  src={item.productImageUrl}
                                  alt={item.productNameZh || item.sku}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-3 text-sm lg:contents">
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{text.fields.orderNo}</div>
                            <div className="truncate whitespace-nowrap text-[13px] text-slate-900">{item.platformOrderNo}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{text.fields.sku}</div>
                            <div className="truncate whitespace-nowrap text-[13px] text-slate-900">{item.sku}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{text.fields.productZh}</div>
                            <div className="truncate whitespace-nowrap text-[13px] text-slate-900">{item.productNameZh || "-"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{text.fields.trackingNo}</div>
                            <div className="truncate whitespace-nowrap text-[13px] text-slate-900">{item.trackingNo || "-"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{text.fields.shippedAt}</div>
                            <div className="whitespace-nowrap text-[13px] text-slate-900">{fmtDateOnly(item.shippedAt, lang)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{lang === "zh" ? "结算日期" : "Fecha liquidacion"}</div>
                            <div className="whitespace-nowrap text-[13px] text-slate-900">{fmtDateOnly(item.settledAt, lang)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{lang === "zh" ? "已结金额" : "Monto liquidado"}</div>
                            <div className="whitespace-nowrap text-[13px] text-emerald-700">{fmtMoney(item.paidAmount, lang)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 lg:hidden">{text.fields.total}</div>
                            <div className="whitespace-nowrap text-[13px] text-slate-900">{fmtMoney(item.totalAmount, lang)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setFinancePreview(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {lang === "zh" ? "关闭" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ImageLightbox
        open={Boolean(previewImage)}
        src={previewImage?.src || ""}
        title={previewImage?.title || ""}
        onClose={() => setPreviewImage(null)}
      />
    </section>
  );
}
