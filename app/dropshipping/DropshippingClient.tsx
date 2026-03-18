"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { EmptyState } from "@/components/empty-state";
import { ImageLightbox } from "@/components/image-lightbox";
import { ProductImage } from "@/components/product-image";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { getClientLang } from "@/lib/lang-client";
import { normalizeProductCode } from "@/lib/product-code";
import type {
  DsAlertItem,
  DsOrderAttachment,
  DsExchangeRatePayload,
  DsFinanceRow,
  DsInventoryStatus,
  DsInventoryRow,
  DsOrderRow,
  DsOverviewAnalytics,
  DsOverviewOrder,
  DsOverviewStats,
} from "@/lib/dropshipping-types";

type OverviewPayload = {
  stats: DsOverviewStats;
  recentOrders: DsOverviewOrder[];
  alerts: DsAlertItem[];
  analytics: DsOverviewAnalytics;
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

type InventoryEditState = {
  mode: "create" | "edit";
  id: string;
  customerId: string;
  customerName: string;
  productCatalogId: string;
  productId: string;
  sku: string;
  productNameZh: string;
  productNameEs: string;
  stockedQty: string;
  unitPrice: string;
  unitPriceLocked: boolean;
  discountRate: string;
  warehouse: string;
} | null;

type InventoryCustomerOption = {
  id: string;
  name: string;
};

type InventoryProductOption = {
  id: string;
  sku: string;
  nameZh: string;
  nameEs: string;
  imageUrl: string;
  unitPrice: string;
  discountRate: string;
};

type FinancePreviewState = DsFinanceRow | null;
type OverviewRange = "day" | "week" | "month" | "year";

type DeleteOrderState = {
  id: string;
  trackingNo: string;
} | null;

type GroupProductOption = {
  source: "inventory" | "catalog";
  sourceId: string;
  productId: string | null;
  sku: string;
  nameZh: string;
  nameEs: string;
  imageUrl: string;
};

type GroupedOrderSlot = {
  slotKey: string;
  orderId: string | null;
  productId: string;
  sku: string;
  productNameZh: string;
  productNameEs: string;
  productImageUrl: string;
  isCurrent: boolean;
  isPersisted: boolean;
};

type AttachmentSlotState =
  | { kind: "empty" }
  | { kind: "existing"; attachment: DsOrderAttachment }
  | { kind: "new"; file: File; previewUrl: string | null };

type OrderFormState = {
  id: string;
  trackingGroupId: string;
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
  settlementStatus: "unpaid" | "paid";
  shippingStatus: "pending" | "shipped" | "cancelled";
  notes: string;
};

const EMPTY_ORDER_FORM: OrderFormState = {
  id: "",
  trackingGroupId: "",
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
  settlementStatus: "unpaid",
  shippingStatus: "pending",
  notes: "",
};

const ATTACHMENT_SLOT_COUNT = 3;

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

function getSettlementStatusLabel(status: OrderFormState["settlementStatus"], lang: "zh" | "es") {
  if (lang === "zh") {
    return status === "paid" ? "已结" : "未结";
  }
  return status === "paid" ? "Liquidado" : "Pendiente";
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

function parseDateOnlyParts(value: string) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return null;
  return {
    year: match[1],
    month: match[2],
    day: match[3],
  };
}

function fmtDateOnly(value: string | null | undefined, lang: "zh" | "es") {
  if (!value) return "-";
  const parts = parseDateOnlyParts(value);
  if (parts) {
    return lang === "zh"
      ? `${parts.year}/${parts.month}/${parts.day}`
      : `${parts.day}/${parts.month}/${parts.year}`;
  }
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

function fmtYuanMoney(value: number, lang: "zh" | "es") {
  return `￥${fmtMoney(value, lang)}`;
}

function fmtPercent(value: number, lang: "zh" | "es") {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(normalized);
}

function getInventoryStatusClass(status: DsInventoryStatus) {
  if (status === "healthy") return "text-violet-600";
  if (status === "empty") return "text-rose-600";
  return "text-emerald-600";
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

function getMexicoDatePartsMap(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function startOfMexicoDayClient(value: Date) {
  const parts = getMexicoDatePartsMap(value);
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000-06:00`);
}

function endOfMexicoDayClient(value: Date) {
  const start = startOfMexicoDayClient(value);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function startOfMexicoWeekClient(value: Date) {
  const start = startOfMexicoDayClient(value);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
  }).format(start);
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = weekdayMap[weekday] ?? 0;
  return new Date(start.getTime() - offset * 24 * 60 * 60 * 1000);
}

function startOfMexicoMonthClient(value: Date) {
  const parts = getMexicoDatePartsMap(value);
  return new Date(`${parts.year}-${parts.month}-01T00:00:00.000-06:00`);
}

function startOfMexicoYearClient(value: Date) {
  const parts = getMexicoDatePartsMap(value);
  return new Date(`${parts.year}-01-01T00:00:00.000-06:00`);
}

function isDirectFileLink(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (normalized.startsWith("=")) return false;
  return /^https?:\/\//i.test(normalized) || normalized.startsWith("/");
}

function createEmptyAttachmentSlots() {
  return Array.from({ length: ATTACHMENT_SLOT_COUNT }, (): AttachmentSlotState => ({ kind: "empty" }));
}

function attachmentLooksLikeImage(mimeType?: string | null, fileName?: string | null) {
  const normalizedMime = String(mimeType || "").toLowerCase();
  if (normalizedMime.startsWith("image/")) return true;
  const normalizedName = String(fileName || "").toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].some((ext) => normalizedName.endsWith(ext));
}

function attachmentLooksLikePdf(mimeType?: string | null, fileName?: string | null) {
  const normalizedMime = String(mimeType || "").toLowerCase();
  if (normalizedMime.includes("pdf")) return true;
  return String(fileName || "").toLowerCase().endsWith(".pdf");
}

function attachmentDisplayName(fileName?: string | null, lang?: "zh" | "es") {
  const normalized = String(fileName || "").trim();
  if (!normalized) return lang === "zh" ? "附件" : "Archivo";
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex > 0 ? normalized.slice(dotIndex + 1).toUpperCase() : normalized;
}

function buildAttachmentSlotsFromExisting(attachments: DsOrderAttachment[]) {
  const slots = attachments
    .slice(0, ATTACHMENT_SLOT_COUNT)
    .map<AttachmentSlotState>((attachment) => ({ kind: "existing", attachment }));
  while (slots.length < ATTACHMENT_SLOT_COUNT) {
    slots.push({ kind: "empty" });
  }
  return slots;
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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3.25v8.5" />
      <path d="m6.75 8.5 3.25 3.25 3.25-3.25" />
      <path d="M4 14.75h12" />
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.75 5.5h10.5" />
      <path d="M7.25 5.5V4.25h5.5V5.5" />
      <path d="M6.25 7.25v7.5h7.5v-7.5" />
      <path d="M8.5 9.25v3.5" />
      <path d="M11.5 9.25v3.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 4.16663V15.8333M4.16669 10H15.8334"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OverviewLineChart({
  data,
  lineColor = "#1d4ed8",
  fillColor = "rgba(29, 78, 216, 0.12)",
}: {
  data: DsOverviewAnalytics["dailySeries"];
  lineColor?: string;
  fillColor?: string;
}) {
  const width = 600;
  const height = 148;
  const paddingX = 16;
  const paddingY = 16;
  const maxValue = Math.max(...data.map((item) => Math.max(item.orderCount, item.shippedCount)), 1);
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const getPoint = (index: number, value: number) => {
    const x = paddingX + (data.length <= 1 ? innerWidth / 2 : (innerWidth * index) / (data.length - 1));
    const y = paddingY + innerHeight - (value / maxValue) * innerHeight;
    return `${x},${y}`;
  };

  const orderPoints = data.map((item, index) => getPoint(index, item.orderCount)).join(" ");
  const shippedPoints = data.map((item, index) => getPoint(index, item.shippedCount)).join(" ");
  const areaPoints = `${paddingX},${height - paddingY} ${orderPoints} ${paddingX + innerWidth},${height - paddingY}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ds-overview-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fillColor} />
            <stop offset="100%" stopColor="rgba(29, 78, 216, 0)" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingY + innerHeight - innerHeight * ratio;
          const label = Math.round(maxValue * ratio);
          return (
            <g key={ratio}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 6" />
              <text x={4} y={y + 4} className="fill-slate-400 text-[11px]">{label}</text>
            </g>
          );
        })}
        <polygon points={areaPoints} fill="url(#ds-overview-area)" />
        <polyline points={orderPoints} fill="none" stroke={lineColor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={shippedPoints} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 5" />
        {data.map((item, index) => {
          const [x, y] = getPoint(index, item.orderCount).split(",");
          return (
            <g key={item.date}>
              <circle cx={x} cy={y} r="3.5" fill={lineColor} />
              <text x={x} y={height - 2} textAnchor="middle" className="fill-slate-400 text-[11px]">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function OverviewDonutChart({
  items,
  lang,
}: {
  items: DsOverviewAnalytics["topPlatforms"];
  lang: "zh" | "es";
}) {
  const total = items.reduce((sum, item) => sum + item.orderCount, 0) || 1;
  const radius = 52;
  const strokeWidth = 13;
  const circumference = 2 * Math.PI * radius;
  const colors = ["#ef4f91", "#8a63d2", "#f7b500", "#3b82f6", "#10b981"];
  let offset = 0;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative mx-auto h-36 w-36 shrink-0">
        <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
          <circle cx="110" cy="110" r={radius} fill="none" stroke="#eef2ff" strokeWidth={strokeWidth} />
          {items.map((item, index) => {
            const dash = (item.orderCount / total) * circumference;
            const segment = (
              <circle
                key={item.platform || index}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return segment;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
            {lang === "zh" ? "\u5e73\u53f0\u6d41\u91cf" : "Traffic"}
          </div>
          <div className="mt-1 text-[22px] font-semibold text-slate-900">{items.length}</div>
          <div className="mt-1 text-xs text-slate-500">{lang === "zh" ? "\u6d3b\u8dc3\u5e73\u53f0" : "Plataformas activas"}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {items.map((item, index) => {
          const share = (item.orderCount / total) * 100;
          return (
            <div key={item.platform || index} className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-slate-900">
                      {item.platform || (lang === "zh" ? "\u65e0" : "Sin plataforma")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {lang === "zh" ? `\u4ef6\u6570 ${item.quantity}` : `Piezas ${item.quantity}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900">{share.toFixed(0)}%</div>
                  <div className="text-xs text-slate-500">{item.orderCount} {lang === "zh" ? "\u5355" : "ped."}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverviewHighlightCard({
  title,
  value,
  subtitle,
  className,
}: {
  title: string;
  value: string;
  subtitle?: string;
  className: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[20px] p-3.5 text-white shadow-soft ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-white/80">{title}</div>
          <div className="mt-1.5 text-[26px] font-semibold tracking-tight">{value}</div>
          {subtitle ? <div className="mt-2 text-xs text-white/80">{subtitle}</div> : null}
        </div>
      </div>
    </section>
  );
}

function OverviewRankList({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex h-full flex-col rounded-[22px] border border-slate-200 bg-white/90 shadow-soft ${className}`}>
      <div className="border-b border-slate-100 px-3.5 py-2.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </section>
  );
}

function OverviewWidgetShell({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex h-full flex-col rounded-[22px] border border-slate-200 bg-white/90 shadow-soft ${className}`}>
      <div className="border-b border-slate-100 px-3.5 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </section>
  );
}

function normalizeGroupProductOptions(items: GroupProductOption[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalizedSku = normalizeProductCode(item.sku);
    const key = item.productId?.trim() || normalizedSku;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const [overviewRange, setOverviewRange] = useState<OverviewRange>("month");
  const [keyword, setKeyword] = useState("");
  const [inventoryKeyword, setInventoryKeyword] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [inventoryCustomerFilter, setInventoryCustomerFilter] = useState("all");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [shippedAtSortDirection, setShippedAtSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedTrackingNos, setExpandedTrackingNos] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "shipped" | "cancelled">("all");
  const [settlementFilter, setSettlementFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [modalPrimaryOrderId, setModalPrimaryOrderId] = useState("");
  const [groupProductSearchOpen, setGroupProductSearchOpen] = useState(false);
  const [groupProductSearchKeyword, setGroupProductSearchKeyword] = useState("");
  const [groupProductSearchLoading, setGroupProductSearchLoading] = useState(false);
  const [groupProductOptions, setGroupProductOptions] = useState<GroupProductOption[]>([]);
  const [activeGroupSlotKey, setActiveGroupSlotKey] = useState<string | null>(null);
  const [groupedDeleteTarget, setGroupedDeleteTarget] = useState<GroupedOrderSlot | null>(null);
  const [productFieldsLocked, setProductFieldsLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [labelSlots, setLabelSlots] = useState<AttachmentSlotState[]>(() => createEmptyAttachmentSlots());
  const [proofSlots, setProofSlots] = useState<AttachmentSlotState[]>(() => createEmptyAttachmentSlots());
  const [labelSlotsDirty, setLabelSlotsDirty] = useState(false);
  const [proofSlotsDirty, setProofSlotsDirty] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importSummary, setImportSummary] = useState<string>("");
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [failedInventoryImages, setFailedInventoryImages] = useState<string[]>([]);
  const [failedFinanceImages, setFailedFinanceImages] = useState<string[]>([]);
  const [inventoryPreview, setInventoryPreview] = useState<InventoryPreviewState>(null);
  const [inventoryShippedPreview, setInventoryShippedPreview] = useState<InventoryShippedPreviewState>(null);
  const [inventoryEdit, setInventoryEdit] = useState<InventoryEditState>(null);
  const [inventoryCustomers, setInventoryCustomers] = useState<InventoryCustomerOption[]>([]);
  const [inventoryProductQuery, setInventoryProductQuery] = useState("");
  const [inventoryProductOptions, setInventoryProductOptions] = useState<InventoryProductOption[]>([]);
  const [inventoryProductLoading, setInventoryProductLoading] = useState(false);
  const [financePreview, setFinancePreview] = useState<FinancePreviewState>(null);
  const [financePreviewPage, setFinancePreviewPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DeleteOrderState>(null);
  const [deleteTrackingInput, setDeleteTrackingInput] = useState("");
  const financePreviewScrollRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const labelInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const proofInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const financePreviewPageSize = 10;
  const inventoryPageSize = 11;

  useEffect(() => {
    setLang(getClientLang());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventoryCustomerFilter, inventoryKeyword]);

  useEffect(() => {
    if (!inventoryEdit || inventoryEdit.mode !== "create") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setInventoryProductLoading(true);
        const keyword = inventoryProductQuery.trim();
        const response = await fetch(`/api/dropshipping/product-search${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`, {
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "product_search_failed");
        }
        setInventoryProductOptions(json.items || []);
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") return;
        setError(searchError instanceof Error ? searchError.message : "product_search_failed");
      } finally {
        setInventoryProductLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [inventoryEdit, inventoryProductQuery]);

  useEffect(() => {
    setFinancePreviewPage(1);
  }, [financePreview]);

  useEffect(() => {
    financePreviewScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [financePreviewPage]);

  useEffect(() => {
    if (!groupProductSearchOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setGroupProductSearchLoading(true);
        setError("");
        const query = groupProductSearchKeyword.trim();

        const normalizedQuery = query.toLowerCase();
        const inventoryMatches = normalizeGroupProductOptions(
          inventory
            .filter((row) => {
              if (!normalizedQuery) return true;
              return [row.sku, row.productNameZh, row.productNameEs]
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery);
            })
            .map<GroupProductOption>((row) => ({
              source: "inventory",
              sourceId: row.inventoryId,
              productId: row.productId,
              sku: row.sku,
              nameZh: row.productNameZh || row.sku,
              nameEs: row.productNameEs || "",
              imageUrl: row.productImageUrl || "",
            })),
        ).slice(0, query ? 24 : 12);

        if (inventoryMatches.length > 0) {
          setGroupProductOptions(inventoryMatches);
          return;
        }

        const response = await fetch(`/api/dropshipping/product-search?keyword=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "product_search_failed");
        }
        const catalogMatches = normalizeGroupProductOptions(
          (Array.isArray(json.items) ? json.items : []).map((item: Record<string, unknown>): GroupProductOption => ({
            source: "catalog" as const,
            sourceId: String(item.id || item.sku || ""),
            productId: null,
            sku: String(item.sku || ""),
            nameZh: String(item.nameZh || item.sku || ""),
            nameEs: String(item.nameEs || ""),
            imageUrl: String(item.imageUrl || ""),
          })),
        );
        setGroupProductOptions(catalogMatches);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setError(searchError instanceof Error ? searchError.message : "product_search_failed");
        }
      } finally {
        setGroupProductSearchLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [groupProductSearchKeyword, groupProductSearchOpen, inventory]);

  const financeDisplayRate = useMemo(() => exchangeRate.rateValue || null, [exchangeRate.rateValue]);
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
          settlement: "结算",
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
          settlement: "Liquidacion",
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
      setInventoryCustomers(inventoryJson.customers || []);
      setFinance(financeJson.items || []);
      setExchangeRate(rateJson.item);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Load failed");
    }
  }

  const customerOptions = useMemo(() => {
    return [...new Set(orders.map((row) => row.customerName.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh"));
  }, [orders]);

  const inventoryCustomerOptions = useMemo(() => {
    return [...new Set(inventory.map((row) => row.customerName.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh"));
  }, [inventory]);

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

  const filteredInventory = useMemo(() => {
    const normalized = inventoryKeyword.trim().toLowerCase();
    return inventory.filter((row) => {
      const customerHit = inventoryCustomerFilter === "all" || row.customerName === inventoryCustomerFilter;
      const keywordHit =
        !normalized ||
        [row.customerName, row.sku, row.productNameZh, row.productNameEs]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return customerHit && keywordHit;
    });
  }, [inventory, inventoryCustomerFilter, inventoryKeyword]);

  const inventoryTotalPages = Math.max(1, Math.ceil(filteredInventory.length / inventoryPageSize));
  const inventoryCurrentPage = Math.min(inventoryPage, inventoryTotalPages);
  const pagedInventory = filteredInventory.slice(
    (inventoryCurrentPage - 1) * inventoryPageSize,
    inventoryCurrentPage * inventoryPageSize,
  );

  const visibleSortedOrders = useMemo(() => {
    const seenGroupKeys = new Set<string>();
    return sortedOrders.filter((row) => {
      const trackingGroupKey = row.trackingGroupId?.trim().toLowerCase() || "";
      if (!trackingGroupKey) return true;
      if (seenGroupKeys.has(trackingGroupKey)) return false;
      seenGroupKeys.add(trackingGroupKey);
      return true;
    });
  }, [sortedOrders]);

  const orderGroupedOrders = useMemo(() => {
    const grouped = new Map<string, DsOrderRow[]>();
    for (const row of sortedOrders) {
      const trackingGroupKey = row.trackingGroupId?.trim().toLowerCase() || "";
      if (!trackingGroupKey) continue;
      const current = grouped.get(trackingGroupKey) || [];
      current.push(row);
      grouped.set(trackingGroupKey, current);
    }
    return grouped;
  }, [sortedOrders]);

  const visibleTrackingDisplayMeta = useMemo(() => {
    const meta = new Map<string, { showTracking: boolean }>();
    let lastTracking = "";
    for (const row of visibleSortedOrders) {
      const tracking = row.trackingNo.trim();
      if (!tracking) {
        meta.set(row.id, { showTracking: true });
        continue;
      }
      meta.set(row.id, {
        showTracking: tracking !== lastTracking,
      });
      lastTracking = tracking;
    }
    return meta;
  }, [visibleSortedOrders]);

  const currentEditingOrder = useMemo(() => {
    if (!form.id) return null;
    return orders.find((row) => row.id === form.id) || null;
  }, [form.id, orders]);

  function revokeAttachmentSlotPreviews(slots: AttachmentSlotState[]) {
    for (const slot of slots) {
      if (slot.kind === "new" && slot.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
    }
  }

  function replaceAttachmentSlots(
    setter: Dispatch<SetStateAction<AttachmentSlotState[]>>,
    nextSlots: AttachmentSlotState[],
    currentSlots: AttachmentSlotState[],
  ) {
    revokeAttachmentSlotPreviews(currentSlots);
    setter(nextSlots);
  }

  function resetAttachmentSlotStates() {
    replaceAttachmentSlots(setLabelSlots, createEmptyAttachmentSlots(), labelSlots);
    replaceAttachmentSlots(setProofSlots, createEmptyAttachmentSlots(), proofSlots);
    setLabelSlotsDirty(false);
    setProofSlotsDirty(false);
  }

  function hydrateAttachmentSlotStates(order?: DsOrderRow | null) {
    replaceAttachmentSlots(
      setLabelSlots,
      buildAttachmentSlotsFromExisting(order?.shippingLabelAttachments || []),
      labelSlots,
    );
    replaceAttachmentSlots(
      setProofSlots,
      buildAttachmentSlotsFromExisting(order?.shippingProofAttachments || []),
      proofSlots,
    );
    setLabelSlotsDirty(false);
    setProofSlotsDirty(false);
  }

  function triggerAttachmentPicker(type: "label" | "proof", slotIndex: number) {
    const refs = type === "label" ? labelInputRefs.current : proofInputRefs.current;
    refs[slotIndex]?.click();
  }

  function updateAttachmentSlot(type: "label" | "proof", slotIndex: number, file: File | null) {
    if (!file) return;
    if (type === "label") {
      setLabelSlots((prev) => {
        const next = [...prev];
        const current = next[slotIndex];
        if (current?.kind === "new" && current.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }
        next[slotIndex] = {
          kind: "new",
          file,
          previewUrl: URL.createObjectURL(file),
        };
        return next;
      });
      setLabelSlotsDirty(true);
      return;
    }

    setProofSlots((prev) => {
      const next = [...prev];
      const current = next[slotIndex];
      if (current?.kind === "new" && current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      next[slotIndex] = {
        kind: "new",
        file,
        previewUrl: URL.createObjectURL(file),
      };
      return next;
    });
    setProofSlotsDirty(true);
  }

  function previewAttachmentSlot(slot: AttachmentSlotState, type: "label" | "proof", slotIndex: number) {
    if (slot.kind === "empty") {
      triggerAttachmentPicker(type, slotIndex);
      return;
    }

    const previewUrl = slot.kind === "existing" ? slot.attachment.fileUrl : slot.previewUrl;
    const mimeType = slot.kind === "existing" ? slot.attachment.mimeType : slot.file.type;
    const fileName = slot.kind === "existing" ? slot.attachment.fileName : slot.file.name;
    if (!previewUrl) return;

    if (attachmentLooksLikeImage(mimeType, fileName)) {
      setPreviewImage({
        src: previewUrl,
        title: fileName || (lang === "zh" ? "附件预览" : "Vista previa"),
      });
      return;
    }

    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  async function materializeAttachmentSlotFiles(slots: AttachmentSlotState[]) {
    const files: File[] = [];
    for (const slot of slots) {
      if (slot.kind === "empty") continue;
      if (slot.kind === "new") {
        files.push(slot.file);
        continue;
      }
      const response = await fetch(slot.attachment.fileUrl);
      if (!response.ok) {
        throw new Error("attachment_materialize_failed");
      }
      const blob = await response.blob();
      files.push(
        new File([blob], slot.attachment.fileName, {
          type: slot.attachment.mimeType || blob.type || "application/octet-stream",
        }),
      );
    }
    return files;
  }

  const modalPrimaryOrder = useMemo(() => {
    const primaryId = modalPrimaryOrderId.trim();
    if (!primaryId) return null;
    return orders.find((row) => row.id === primaryId) || null;
  }, [modalPrimaryOrderId, orders]);

  const groupedOrdersForModal = useMemo(() => {
    const primaryId = modalPrimaryOrderId.trim() || form.id.trim();
    const trackingGroupId = form.trackingGroupId.trim().toLowerCase();
    if (trackingGroupId) {
      return orders
        .filter((row) => row.trackingGroupId?.trim().toLowerCase() === trackingGroupId)
        .sort((a, b) => {
          if (a.id === primaryId) return -1;
          if (b.id === primaryId) return 1;
          return a.createdAt.localeCompare(b.createdAt, "en");
        });
    }

    const tracking = form.trackingNo.trim().toLowerCase();
    if (!tracking) {
      return primaryId ? orders.filter((row) => row.id === primaryId) : [];
    }

    return orders
      .filter((row) => row.trackingNo.trim().toLowerCase() === tracking)
      .sort((a, b) => {
        if (a.id === primaryId) return -1;
        if (b.id === primaryId) return 1;
        return a.createdAt.localeCompare(b.createdAt, "en");
      });
  }, [form.id, form.trackingGroupId, form.trackingNo, modalPrimaryOrderId, orders]);

  const groupedOrderSlots = useMemo(() => {
    const primaryId = modalPrimaryOrderId.trim() || form.id.trim();
    const primaryOrder = primaryId && primaryId === form.id ? currentEditingOrder : modalPrimaryOrder;
    const currentSlot: GroupedOrderSlot = {
      slotKey: primaryId || form.id || "current",
      orderId: primaryId || form.id || null,
      productId: primaryOrder?.productId || "",
      sku: primaryId === form.id ? form.sku : primaryOrder?.sku || form.sku,
      productNameZh: primaryId === form.id ? form.productNameZh : primaryOrder?.productNameZh || form.productNameZh,
      productNameEs: primaryId === form.id ? form.productNameEs : primaryOrder?.productNameEs || form.productNameEs,
      productImageUrl: primaryOrder?.productImageUrl || "",
      isCurrent: true,
      isPersisted: Boolean(primaryId || form.id),
    };

    const siblingSlots = groupedOrdersForModal
      .filter((row) => row.id !== primaryId)
      .map<GroupedOrderSlot>((row) => ({
        slotKey: row.id,
        orderId: row.id,
        productId: row.productId,
        sku: row.sku,
        productNameZh: row.productNameZh,
        productNameEs: row.productNameEs,
        productImageUrl: row.productImageUrl,
        isCurrent: false,
        isPersisted: true,
      }));

    const slots = [currentSlot, ...siblingSlots].slice(0, 7);
    while (slots.length < 7) {
      slots.push({
        slotKey: `empty-${slots.length}`,
        orderId: null,
        productId: "",
        sku: "",
        productNameZh: "",
        productNameEs: "",
        productImageUrl: "",
        isCurrent: false,
        isPersisted: false,
      });
    }
    return slots;
  }, [
    currentEditingOrder,
    form.id,
    form.productNameEs,
    form.productNameZh,
    form.sku,
    groupedOrdersForModal,
    modalPrimaryOrder,
    modalPrimaryOrderId,
  ]);

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

  const financePreviewTotalPages = financePreview
    ? Math.max(1, Math.ceil(financePreview.settledOrders.length / financePreviewPageSize))
    : 1;
  const financePreviewCurrentPage = Math.min(financePreviewPage, financePreviewTotalPages);
  const financePreviewVisibleOrders = financePreview
    ? financePreview.settledOrders.slice(
        (financePreviewCurrentPage - 1) * financePreviewPageSize,
        financePreviewCurrentPage * financePreviewPageSize,
      )
    : [];

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
  const overviewDashboard = useMemo(() => {
    const safePlatformLabel = (platform: string) => platform.trim() || (lang === "zh" ? "无" : "Sin plataforma");
    const rangeStart =
      overviewRange === "day"
        ? startOfMexicoDayClient(now)
        : overviewRange === "week"
          ? startOfMexicoWeekClient(now)
          : overviewRange === "year"
            ? startOfMexicoYearClient(now)
            : startOfMexicoMonthClient(now);
    const rangeEnd =
      overviewRange === "day"
        ? endOfMexicoDayClient(rangeStart)
        : overviewRange === "week"
          ? new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000)
          : overviewRange === "year"
            ? new Date(rangeStart.getUTCFullYear() + 1, 0, 1, 6, 0, 0, 0)
            : new Date(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + 1, 1, 6, 0, 0, 0);

    const formatRangeTitle = () => {
      if (overviewRange === "day") {
        return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(rangeStart);
      }
      if (overviewRange === "week") {
        const weekEnd = new Date(rangeEnd.getTime() - 24 * 60 * 60 * 1000);
        return `${fmtDateOnly(rangeStart.toISOString(), lang)} - ${fmtDateOnly(weekEnd.toISOString(), lang)}`;
      }
      if (overviewRange === "year") {
        return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
          timeZone: "America/Mexico_City",
          year: "numeric",
        }).format(rangeStart);
      }
      return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "long",
      }).format(rangeStart);
    };

    const createSeries = () => {
      if (overviewRange === "day") {
        return Array.from({ length: 24 }, (_, hour) => ({
          date: `${rangeStart.toISOString()}#${hour}`,
          label: String(hour).padStart(2, "0"),
          orderCount: 0,
          shippedCount: 0,
          totalAmount: 0,
        }));
      }
      if (overviewRange === "week") {
        return Array.from({ length: 7 }, (_, index) => {
          const date = new Date(rangeStart.getTime() + index * 24 * 60 * 60 * 1000);
          return {
            date: date.toISOString(),
            label: new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
              timeZone: "America/Mexico_City",
              weekday: "short",
            }).format(date),
            orderCount: 0,
            shippedCount: 0,
            totalAmount: 0,
          };
        });
      }
      if (overviewRange === "year") {
        return Array.from({ length: 12 }, (_, index) => {
          const date = new Date(rangeStart.getUTCFullYear(), index, 1, 6, 0, 0, 0);
          return {
            date: date.toISOString(),
            label: new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
              timeZone: "America/Mexico_City",
              month: "short",
            }).format(date),
            orderCount: 0,
            shippedCount: 0,
            totalAmount: 0,
          };
        });
      }
      const nextMonthStart = new Date(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + 1, 1, 6, 0, 0, 0);
      const days = Math.round((nextMonthStart.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000));
      return Array.from({ length: days }, (_, index) => {
        const date = new Date(rangeStart.getTime() + index * 24 * 60 * 60 * 1000);
        return {
          date: date.toISOString(),
          label: new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Mexico_City",
            day: "2-digit",
          }).format(date),
          orderCount: 0,
          shippedCount: 0,
          totalAmount: 0,
        };
      });
    };

    const series = createSeries();
    const seriesMap = new Map(series.map((item) => [item.date, item]));
    const rangedOrders = orders.filter((row) => {
      if (!row.shippedAt) return false;
      const shippedAt = new Date(row.shippedAt);
      return shippedAt >= rangeStart && shippedAt < rangeEnd;
    });

    const productMap = new Map<string, { sku: string; productNameZh: string; quantity: number; orderCount: number }>();
    const customerMap = new Map<string, { customerId: string; customerName: string; orderCount: number; totalAmount: number; paidAmount: number; unpaidAmount: number }>();
    const platformMap = new Map<string, { platform: string; orderCount: number; quantity: number }>();

    let receivable = 0;
    let paid = 0;
    let pending = 0;

    for (const row of rangedOrders) {
      const shippedAt = new Date(row.shippedAt!);
      const orderAmount = (row.snapshotStockAmount ?? 0) + row.shippingFee;
      receivable += orderAmount;
      if (row.settlementStatus === "paid") {
        paid += orderAmount;
      } else {
        pending += orderAmount;
      }

      const seriesKey =
        overviewRange === "day"
          ? `${rangeStart.toISOString()}#${new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Mexico_City",
              hour: "2-digit",
              hour12: false,
            }).format(shippedAt)}`
          : overviewRange === "week"
            ? startOfMexicoDayClient(shippedAt).toISOString()
            : overviewRange === "year"
              ? new Date(shippedAt.getUTCFullYear(), shippedAt.getUTCMonth(), 1, 6, 0, 0, 0).toISOString()
              : startOfMexicoDayClient(shippedAt).toISOString();
      const point = seriesMap.get(seriesKey);
      if (point) {
        point.orderCount += 1;
        if (row.shippingStatus === "shipped") point.shippedCount += 1;
        point.totalAmount += orderAmount;
      }

      const skuKey = normalizeProductCode(row.sku);
      const product = productMap.get(skuKey) || {
        sku: row.sku,
        productNameZh: row.productNameZh || row.sku,
        quantity: 0,
        orderCount: 0,
      };
      product.quantity += row.quantity;
      product.orderCount += 1;
      productMap.set(skuKey, product);

      const customer = customerMap.get(row.customerId) || {
        customerId: row.customerId,
        customerName: row.customerName,
        orderCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      };
      customer.orderCount += 1;
      customer.totalAmount += orderAmount;
      if (row.settlementStatus === "paid") customer.paidAmount += orderAmount;
      else customer.unpaidAmount += orderAmount;
      customerMap.set(row.customerId, customer);

      const platformKey = safePlatformLabel(row.platform);
      const platform = platformMap.get(platformKey) || {
        platform: platformKey,
        orderCount: 0,
        quantity: 0,
      };
      platform.orderCount += 1;
      platform.quantity += row.quantity;
      platformMap.set(platformKey, platform);
    }

    const periodOrderCount = rangedOrders.length;
    const periodShippedCount = rangedOrders.filter((row) => row.shippingStatus === "shipped").length;
    const periodPendingCount = rangedOrders.filter((row) => row.shippingStatus !== "shipped").length;
    const unsettledCustomers = new Set(
      rangedOrders.filter((row) => row.settlementStatus !== "paid").map((row) => row.customerId),
    ).size;

    return {
      title: formatRangeTitle(),
      summaryLabel:
        overviewRange === "day"
          ? lang === "zh"
            ? "日度总览"
            : "Resumen diario"
          : overviewRange === "week"
            ? lang === "zh"
              ? "周度总览"
              : "Resumen semanal"
            : overviewRange === "year"
              ? lang === "zh"
                ? "年度总览"
                : "Resumen anual"
              : lang === "zh"
                ? "月度总览"
                : "Resumen mensual",
      metricLabels: {
        orders:
          overviewRange === "day"
            ? lang === "zh"
              ? "今日录单"
              : "Pedidos hoy"
            : overviewRange === "week"
              ? lang === "zh"
                ? "本周录单"
                : "Pedidos semana"
              : overviewRange === "year"
                ? lang === "zh"
                  ? "本年录单"
                  : "Pedidos año"
                : lang === "zh"
                  ? "本月录单"
                  : "Pedidos mes",
        shipped:
          overviewRange === "day"
            ? lang === "zh"
              ? "今日已发货"
              : "Enviados hoy"
            : overviewRange === "week"
              ? lang === "zh"
                ? "本周已发货"
                : "Enviados semana"
              : overviewRange === "year"
                ? lang === "zh"
                  ? "本年已发货"
                  : "Enviados año"
                : lang === "zh"
                  ? "本月已发货"
                  : "Enviados mes",
        pending:
          overviewRange === "day"
            ? lang === "zh"
              ? "今日待处理"
              : "Pendientes hoy"
            : overviewRange === "week"
              ? lang === "zh"
                ? "本周待处理"
                : "Pendientes semana"
              : overviewRange === "year"
                ? lang === "zh"
                  ? "本年待处理"
                  : "Pendientes año"
                : lang === "zh"
                  ? "本月待处理"
                  : "Pendientes mes",
        unsettled: lang === "zh" ? "待结算客户" : "Clientes pendientes",
      },
      receivable,
      paid,
      pending,
      periodOrderCount,
      periodShippedCount,
      periodPendingCount,
      unsettledCustomers,
      dailySeries: series,
      topProducts: [...productMap.values()].sort((a, b) => b.quantity - a.quantity || b.orderCount - a.orderCount).slice(0, 4),
      topCustomersByOrders: [...customerMap.values()].sort((a, b) => b.orderCount - a.orderCount || b.totalAmount - a.totalAmount).slice(0, 4),
      topPlatforms: [...platformMap.values()].sort((a, b) => b.orderCount - a.orderCount || b.quantity - a.quantity).slice(0, 4),
      topCustomersByAmount: [...customerMap.values()].sort((a, b) => b.totalAmount - a.totalAmount || b.orderCount - a.orderCount).slice(0, 4),
      alerts: [
        { type: "pending_order" as const, count: orders.filter((row) => row.shippingStatus === "pending").length },
        { type: "missing_shipping_proof" as const, count: orders.filter((row) => row.warnings.includes("missing_shipping_proof")).length },
        { type: "low_inventory" as const, count: inventory.filter((row) => row.status !== "healthy").length },
        { type: "customer_unsettled" as const, count: unsettledCustomers },
      ],
    };
  }, [exchangeRate.rateValue, inventory, lang, now, orders, overviewRange]);
  function openCreateModal() {
    setForm({ ...EMPTY_ORDER_FORM, warehouse: FIXED_WAREHOUSE });
    setProductFieldsLocked(false);
    setLabelFiles([]);
    setProofFiles([]);
    resetAttachmentSlotStates();
    setModalPrimaryOrderId("");
    setGroupProductSearchOpen(false);
    setGroupProductSearchKeyword("");
    setGroupProductOptions([]);
    setActiveGroupSlotKey(null);
    setModalOpen(true);
  }

  function openEditModal(order: DsOrderRow, primaryOrderId?: string) {
    setForm({
      id: order.id,
      trackingGroupId: order.trackingGroupId || "",
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
      settlementStatus: order.settlementStatus,
      shippingStatus: order.shippingStatus,
      notes: order.notes,
    });
    setProductFieldsLocked(order.catalogMatched);
    setLabelFiles([]);
    setProofFiles([]);
    hydrateAttachmentSlotStates(order);
    setGroupProductSearchOpen(false);
    setGroupProductSearchKeyword("");
    setGroupProductOptions([]);
    setActiveGroupSlotKey(null);
    setModalPrimaryOrderId(primaryOrderId || order.id);
    setModalOpen(true);
  }

  function buildOrderPayload(source: OrderFormState, trackingGroupId?: string | null) {
    return {
      customerName: source.customerName,
      platform: source.platform,
      platformOrderNo: source.platformOrderNo,
      trackingGroupId: trackingGroupId === undefined ? source.trackingGroupId || null : trackingGroupId,
      sku: source.sku,
      productNameZh: source.productNameZh,
      productNameEs: source.productNameEs,
      quantity: Number(source.quantity || 0),
      trackingNo: source.trackingNo,
      color: source.color,
      warehouse: FIXED_WAREHOUSE,
      shippedAt: source.shippedAt || null,
      shippingFee: source.shippingFee || null,
      settlementStatus: source.settlementStatus,
      shippingStatus: source.shippingStatus,
      notes: source.notes,
    };
  }

  async function persistOrderRequest(source: OrderFormState, trackingGroupId?: string | null) {
    const endpoint = source.id ? `/api/dropshipping/orders/${source.id}` : "/api/dropshipping/orders";
    const method = source.id ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildOrderPayload(source, trackingGroupId)),
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) throw new Error(json?.error || "save_failed");
    return String(json.id || source.id || "");
  }

  async function syncGroupedOrders(trackingGroupId: string, currentOrderId: string) {
    const siblings = groupedOrdersForModal.filter((row) => row.id !== currentOrderId);
    for (const row of siblings) {
      await persistOrderRequest(
        {
          id: row.id,
          trackingGroupId,
          customerName: row.customerName,
          platform: row.platform,
          platformOrderNo: row.platformOrderNo,
          sku: row.sku,
          productNameZh: row.productNameZh,
          productNameEs: row.productNameEs,
          quantity: String(row.quantity),
          trackingNo: row.trackingNo,
          color: row.color,
          warehouse: row.warehouse || FIXED_WAREHOUSE,
          shippedAt: row.shippedAt ? row.shippedAt.slice(0, 10) : "",
          shippingFee: row.shippingFee ? String(row.shippingFee) : "",
          settlementStatus: row.settlementStatus,
          shippingStatus: row.shippingStatus,
          notes: row.notes,
        },
        trackingGroupId,
      );
    }
  }

  async function persistCurrentOrder(forceTrackingGroupId?: string | null) {
    const shouldPersistGroup =
      Boolean(forceTrackingGroupId)
      || Boolean(form.trackingGroupId)
      || groupedOrdersForModal.length > 1;
    const trackingGroupId = shouldPersistGroup
      ? (forceTrackingGroupId || form.trackingGroupId || crypto.randomUUID())
      : null;
    const orderId = await persistOrderRequest(form, trackingGroupId);
    if (trackingGroupId) {
      await syncGroupedOrders(trackingGroupId, orderId);
    }
    return { orderId, trackingGroupId: trackingGroupId || "" };
  }

  async function fetchOrdersOnly() {
    const response = await fetch("/api/dropshipping/orders");
    const json = await response.json();
    if (!response.ok || !json?.ok || !Array.isArray(json.items)) {
      throw new Error(json?.error || "orders");
    }
    return json.items as DsOrderRow[];
  }

  function openGroupProductSearch(slotKey: string) {
    setActiveGroupSlotKey(slotKey);
    setGroupProductSearchKeyword("");
    setGroupProductOptions([]);
    setGroupProductSearchOpen(true);
  }

  async function handleSelectGroupedProduct(product: GroupProductOption) {
    try {
      setSaving(true);
      setError("");
      const normalizedSku = normalizeProductCode(product.sku);
      const duplicateOrder = groupedOrdersForModal.find((row) =>
        (product.productId && row.productId === product.productId)
        || normalizeProductCode(row.sku) === normalizedSku,
      );
      if (duplicateOrder) {
        throw new Error(lang === "zh" ? "该商品已在同组订单中" : "El producto ya existe en el grupo");
      }
      const { orderId, trackingGroupId } = await persistCurrentOrder(
        form.trackingGroupId || crypto.randomUUID(),
      );
      if (orderId) {
        await uploadOrderAttachments(orderId);
      }
      const response = await fetch("/api/dropshipping/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          platform: form.platform,
          platformOrderNo: form.platformOrderNo,
          trackingGroupId,
          sku: product.sku,
          productNameZh: product.nameZh || product.sku,
          productNameEs: product.nameEs || "",
          quantity: 1,
          trackingNo: form.trackingNo,
          color: "",
          warehouse: FIXED_WAREHOUSE,
          shippedAt: form.shippedAt || null,
          shippingFee: form.shippingFee || null,
          settlementStatus: form.settlementStatus,
          shippingStatus: form.shippingStatus,
          notes: "",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "save_failed");
      }
      setGroupProductSearchOpen(false);
      setGroupProductSearchKeyword("");
      setGroupProductOptions([]);
      setActiveGroupSlotKey(null);
      await refreshAll();
      const freshOrders = await fetchOrdersOnly();
      setOrders(freshOrders);
      const refreshedCurrent = freshOrders.find((row) => row.id === orderId);
      if (refreshedCurrent) {
        openEditModal(refreshedCurrent, modalPrimaryOrderId || form.id || refreshedCurrent.id);
      }
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  function requestRemoveGroupedOrder(slot: GroupedOrderSlot) {
    if (!slot.orderId || slot.isCurrent) return;
    setGroupedDeleteTarget(slot);
  }

  async function confirmRemoveGroupedOrder() {
    const slot = groupedDeleteTarget;
    if (!slot?.orderId || slot.isCurrent) return;
    const targetOrder = orders.find((row) => row.id === slot.orderId);
    setGroupedDeleteTarget(null);
    if (!targetOrder) return;

    try {
      setSaving(true);
      setError("");
      const trackingGroupId = form.trackingGroupId || crypto.randomUUID();
      const { orderId } = await persistCurrentOrder(trackingGroupId);
      if (orderId) {
        await uploadOrderAttachments(orderId);
      }
      await persistOrderRequest(
        {
          id: targetOrder.id,
          trackingGroupId: "",
          customerName: targetOrder.customerName,
          platform: targetOrder.platform,
          platformOrderNo: targetOrder.platformOrderNo,
          sku: targetOrder.sku,
          productNameZh: targetOrder.productNameZh,
          productNameEs: targetOrder.productNameEs,
          quantity: String(targetOrder.quantity),
          trackingNo: targetOrder.trackingNo,
          color: targetOrder.color,
          warehouse: targetOrder.warehouse || FIXED_WAREHOUSE,
          shippedAt: targetOrder.shippedAt ? targetOrder.shippedAt.slice(0, 10) : "",
          shippingFee: targetOrder.shippingFee ? String(targetOrder.shippingFee) : "",
          shippingStatus: targetOrder.shippingStatus,
          notes: targetOrder.notes,
        },
        null,
      );
      await refreshAll();
      const freshOrders = await fetchOrdersOnly();
      setOrders(freshOrders);
      const refreshed = freshOrders.find((row) => row.id === orderId);
      if (refreshed) {
        openEditModal(refreshed, modalPrimaryOrderId || form.id || refreshed.id);
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadOrderAttachments(orderId: string) {
    const uploadSets: Array<{ type: "label" | "proof"; dirty: boolean; slots: AttachmentSlotState[] }> = [
      { type: "label", dirty: labelSlotsDirty, slots: labelSlots },
      { type: "proof", dirty: proofSlotsDirty, slots: proofSlots },
    ];

    for (const item of uploadSets) {
      if (!item.dirty) continue;
      const files = await materializeAttachmentSlotFiles(item.slots);
      const formData = new FormData();
      formData.append("type", item.type);
      for (const file of files) {
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

    setLabelSlotsDirty(false);
    setProofSlotsDirty(false);
  }

  function renderAttachmentSlot(slot: AttachmentSlotState, type: "label" | "proof", slotIndex: number) {
    const isEmpty = slot.kind === "empty";
    const previewUrl = slot.kind === "existing"
      ? slot.attachment.fileUrl
      : slot.kind === "new"
        ? slot.previewUrl
        : "";
    const mimeType = slot.kind === "existing"
      ? slot.attachment.mimeType
      : slot.kind === "new"
        ? slot.file.type
        : "";
    const fileName = slot.kind === "existing"
      ? slot.attachment.fileName
      : slot.kind === "new"
        ? slot.file.name
      : "";
    const isImage = !isEmpty && attachmentLooksLikeImage(mimeType, fileName) && Boolean(previewUrl);
    const isPdf = !isEmpty && attachmentLooksLikePdf(mimeType, fileName);
    const actionLabel = isEmpty
      ? (lang === "zh" ? "添加附件" : "Agregar")
      : isImage
        ? (lang === "zh" ? "点击查看" : "Ver")
        : isPdf
          ? (lang === "zh" ? "点击查看 PDF" : "Ver PDF")
          : (lang === "zh" ? "点击查看" : "Ver");

    return (
      <div
        key={`${type}-${slotIndex}`}
        className={`relative rounded-xl border border-slate-200 bg-white ${isEmpty ? "p-0" : "p-2.5"}`}
      >
        <button
          type="button"
          onClick={() => previewAttachmentSlot(slot, type, slotIndex)}
          className={`flex h-[88px] w-full flex-col items-center justify-center gap-1 text-slate-400 transition ${
            isEmpty ? "rounded-xl hover:bg-slate-50 hover:text-primary" : "rounded-lg hover:bg-slate-50"
          }`}
        >
          {isEmpty ? (
            <>
              <span className="text-lg leading-none">+</span>
              <span className="text-[11px] font-medium">{lang === "zh" ? "添加附件" : "Agregar"}</span>
            </>
          ) : isImage ? (
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg">
              <img src={previewUrl || ""} alt={fileName || `${type}-${slotIndex + 1}`} className="h-full w-full object-cover" />
            </span>
          ) : isPdf ? (
            <span className="flex flex-col items-center justify-center gap-1 text-slate-700">
              <span className="inline-flex h-9 min-w-[48px] items-center justify-center rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-600">
                PDF
              </span>
              <span className="text-[11px] font-medium text-slate-700">{lang === "zh" ? "已上传" : "Subido"}</span>
            </span>
          ) : (
            <span className="flex flex-col items-center justify-center gap-1 text-slate-700">
              <span className="inline-flex h-9 min-w-[48px] items-center justify-center rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-600">
                {attachmentDisplayName(fileName, lang)}
              </span>
              <span className="text-[11px] font-medium text-slate-700">{lang === "zh" ? "已上传" : "Subido"}</span>
            </span>
          )}
          {!isEmpty ? (
            <span className="text-[11px] font-medium text-slate-500">{actionLabel}</span>
          ) : null}
        </button>
        {!isEmpty ? (
          <button
            type="button"
            onClick={() => triggerAttachmentPicker(type, slotIndex)}
            className="absolute right-3 top-3 inline-flex h-6 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            {lang === "zh" ? "替换" : "Cambiar"}
          </button>
        ) : null}
        <input
          ref={(node) => {
            if (type === "label") {
              labelInputRefs.current[slotIndex] = node;
            } else {
              proofInputRefs.current[slotIndex] = node;
            }
          }}
          type="file"
          accept=".pdf,image/*"
          onChange={(event) => {
            updateAttachmentSlot(type, slotIndex, event.target.files?.[0] || null);
            event.currentTarget.value = "";
          }}
          className="sr-only"
        />
      </div>
    );
  }

  async function submitOrder() {
    try {
      setSaving(true);
      setError("");
      const { orderId } = await persistCurrentOrder();
      if (orderId) {
        await uploadOrderAttachments(orderId);
      }
      setModalOpen(false);
      setForm(EMPTY_ORDER_FORM);
      setLabelFiles([]);
      setProofFiles([]);
      resetAttachmentSlotStates();
      setGroupProductSearchOpen(false);
      setGroupProductSearchKeyword("");
      setGroupProductOptions([]);
      setActiveGroupSlotKey(null);
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
    setDeleteTrackingInput("");
    setDeleteTarget({
      id: order.id,
      trackingNo: tracking,
    });
  }

  function beginInventoryEdit(row: DsInventoryRow) {
    setInventoryEdit({
      mode: "edit",
      id: row.inventoryId,
      customerId: row.customerId,
      customerName: row.customerName,
      productCatalogId: "",
      productId: row.productId,
      sku: row.sku,
      productNameZh: row.productNameZh,
      productNameEs: row.productNameEs || "",
      stockedQty: String(row.stockedQty),
      unitPrice: String(row.unitPrice ?? ""),
      unitPriceLocked: true,
      discountRate: String(Math.round((row.discountRate || 0) * 10000) / 100),
      warehouse: FIXED_WAREHOUSE,
    });
    setInventoryProductQuery(`${row.sku} / ${row.productNameZh || ""}`.trim());
  }

  async function beginInventoryCreate() {
    try {
      setError("");
      if (inventoryCustomers.length === 0) {
        const response = await fetch("/api/dropshipping/inventory/options");
        const json = await response.json();
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "inventory_options_failed");
        }
        setInventoryCustomers(json.customers || []);
      }
      setInventoryEdit({
        mode: "create",
        id: "",
        customerId: "",
        customerName: "",
        productCatalogId: "",
        productId: "",
        sku: "",
        productNameZh: "",
        productNameEs: "",
        stockedQty: "0",
        unitPrice: "",
        unitPriceLocked: false,
        discountRate: "",
        warehouse: FIXED_WAREHOUSE,
      });
      setInventoryProductQuery("");
      setInventoryProductOptions([]);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "inventory_options_failed");
    }
  }

  function pickInventoryProduct(option: InventoryProductOption) {
    setInventoryEdit((prev) => (prev ? {
      ...prev,
      productCatalogId: option.id,
      sku: option.sku,
      productNameZh: option.nameZh || option.sku,
      productNameEs: option.nameEs || "",
      unitPrice: option.unitPrice || "",
      unitPriceLocked: Boolean(option.unitPrice),
      discountRate: option.discountRate
        ? String(Math.round(Number(option.discountRate) * 10000) / 100)
        : prev.discountRate,
    } : prev));
    setInventoryProductQuery(`${option.sku} / ${option.nameZh || option.nameEs || ""}`.trim());
  }

  async function saveInventoryEdit() {
    if (!inventoryEdit) return;
    try {
      setSaving(true);
      setError("");
      const stockedQty = Number(inventoryEdit.stockedQty || 0);
      const unitPrice = inventoryEdit.unitPrice.trim();
      const discountRate = inventoryEdit.discountRate.trim();
      if (inventoryEdit.mode === "create" && (!inventoryEdit.customerId || !inventoryEdit.sku)) {
        throw new Error(lang === "zh" ? "请选择客户和产品" : "Selecciona cliente y producto");
      }

      const response = await fetch(
        inventoryEdit.mode === "create" ? "/api/dropshipping/inventory" : `/api/dropshipping/inventory/${inventoryEdit.id}`,
        {
          method: inventoryEdit.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: inventoryEdit.customerId,
            productCatalogId: inventoryEdit.productCatalogId || null,
            sku: inventoryEdit.sku,
            productNameZh: inventoryEdit.productNameZh,
            productNameEs: inventoryEdit.productNameEs,
            stockedQty,
            unitPrice: unitPrice === "" ? null : Number(unitPrice),
            discountRate: discountRate === "" ? null : Number(discountRate) / 100,
            warehouse: FIXED_WAREHOUSE,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "save_failed");
      }
      setInventoryEdit(null);
      setInventoryProductQuery("");
      setInventoryProductOptions([]);
      await refreshAll();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeInventoryRow(row: DsInventoryRow) {
    const confirmed = window.confirm(
      lang === "zh"
        ? `确认删除这条备货记录？\n${row.customerName} / ${row.sku}`
        : `Eliminar este registro de stock?\n${row.customerName} / ${row.sku}`,
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/dropshipping/inventory/${row.inventoryId}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "delete_failed");
      }
      await refreshAll();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "delete_failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteOrder() {
    if (!deleteTarget) return;

    if (deleteTrackingInput.trim() !== deleteTarget.trackingNo) {
      setError(lang === "zh" ? "\u7269\u6d41\u53f7\u6821\u9a8c\u5931\u8d25" : "La guia no coincide");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/dropshipping/orders/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "delete_failed");
      }
      if (form.id === deleteTarget.id) {
        setModalOpen(false);
        setForm(EMPTY_ORDER_FORM);
      }
      setDeleteTarget(null);
      setDeleteTrackingInput("");
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
    <section className="space-y-4">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["overview", "orders", "inventory", "finance"] as TabKey[]).map((tab) => (
            <button key={tab} type="button" className={tabButtonClass(tab)} onClick={() => setActiveTab(tab)}>
              {text.tabs[tab]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-3.5">
          <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
            <section className="self-start overflow-hidden rounded-[20px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_24%),linear-gradient(135deg,#ffffff_0%,#f8fbff_48%,#eef4ff_100%)] shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-white/60 px-3.5 py-2.5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{lang === "zh" ? "总览仪表板" : "Dashboard"}</div>
                  <div className="mt-1 text-xs text-slate-500">{`${overviewDashboard.title} · ${overviewDashboard.summaryLabel}`}</div>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 text-[10px] font-medium">
                  {([
                    { key: "day", zh: "天", es: "Dia" },
                    { key: "week", zh: "周", es: "Semana" },
                    { key: "month", zh: "月", es: "Mes" },
                    { key: "year", zh: "年", es: "Año" },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setOverviewRange(item.key)}
                      className={`rounded-full px-2.5 py-1 transition ${
                        overviewRange === item.key
                          ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow"
                          : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {lang === "zh" ? item.zh : item.es}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 px-3.5 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(200px,0.68fr)]">
                <div className="min-w-0">
                  <div className="text-[1.75rem] font-semibold tracking-tight text-slate-900 sm:text-[1.95rem]">{fmtMoney(overviewDashboard.receivable, lang)}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    {lang === "zh"
                      ? "按所选时间范围查看订单、已发、平台与结算的核心数据。"
                      : "Consulta pedidos, envios, plataformas y liquidacion segun el rango seleccionado."}
                  </p>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "客户订单总额" : "Monto total"}</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(overviewDashboard.receivable, lang)}</div>
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "结款总额" : "Liquidado"}</div>
                      <div className="mt-1 text-lg font-semibold text-emerald-600">{fmtMoney(overviewDashboard.paid, lang)}</div>
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "未结总额" : "Pendiente"}</div>
                      <div className="mt-1 text-lg font-semibold text-rose-600">{fmtMoney(overviewDashboard.pending, lang)}</div>
                    </div>
                  </div>
                  <div className="mt-2.5 rounded-[18px] border border-white/70 bg-white/80 p-3">
                    <div className="mb-2 flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />{lang === "zh" ? "订单数" : "Pedidos"}</span>
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{lang === "zh" ? "已发数" : "Enviados"}</span>
                    </div>
                    <OverviewLineChart data={overviewDashboard.dailySeries} lineColor="#6366f1" fillColor="rgba(99,102,241,0.14)" />
                  </div>
                </div>

                <div className="grid auto-rows-fr gap-2 sm:grid-cols-2 lg:grid-cols-2">
                  <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2.5">
                    <div className="text-xs text-slate-500">{overviewDashboard.metricLabels.orders}</div>
                    <div className="mt-1.5 text-[1.45rem] font-semibold text-slate-900">{overviewDashboard.periodOrderCount}</div>
                  </div>
                  <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2.5">
                    <div className="text-xs text-slate-500">{overviewDashboard.metricLabels.shipped}</div>
                    <div className="mt-1.5 text-[1.45rem] font-semibold text-emerald-600">{overviewDashboard.periodShippedCount}</div>
                  </div>
                  <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2.5">
                    <div className="text-xs text-slate-500">{overviewDashboard.metricLabels.pending}</div>
                    <div className="mt-1.5 text-[1.45rem] font-semibold text-amber-500">{overviewDashboard.periodPendingCount}</div>
                  </div>
                  <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2.5">
                    <div className="text-xs text-slate-500">{overviewDashboard.metricLabels.unsettled}</div>
                    <div className="mt-1.5 text-[1.45rem] font-semibold text-rose-600">{overviewDashboard.unsettledCustomers}</div>
                  </div>
                </div>
              </div>
            </section>

            <div className="self-start">
              <OverviewRankList
                title={lang === "zh" ? "平台订单分布" : "Platform Share"}
                subtitle={lang === "zh" ? "按所选时间范围统计" : "Distribucion del periodo"}
                className="min-h-0"
              >
                <div className="space-y-2">
                  {overviewDashboard.topPlatforms.map((item, index) => {
                    const totalOrders = overviewDashboard.topPlatforms.reduce((sum, platform) => sum + platform.orderCount, 0) || 1;
                    const share = (item.orderCount / totalOrders) * 100;
                    const colors = ["#ef4f91", "#8a63d2", "#f7b500", "#3b82f6"];
                    return (
                      <div key={`${item.platform || "unknown"}-${index}`} className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <div className="min-w-0 flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-slate-900">
                              {item.platform || (lang === "zh" ? "无" : "Sin plataforma")}
                            </div>
                            <div className="text-xs text-slate-500">
                              {lang === "zh" ? `件数 ${item.quantity}` : `Piezas ${item.quantity}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-slate-900">{share.toFixed(0)}%</div>
                          <div className="text-xs text-slate-500">{item.orderCount} {lang === "zh" ? "单" : "ped."}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </OverviewRankList>
              <OverviewWidgetShell className="hidden"
                title={lang === "zh" ? "汇率与来源" : "Rate & Source"}
                subtitle={lang === "zh" ? "今日 Wise 汇率与更新时间" : "Tipo de cambio y actualizacion"}
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-3">
                    <div className="text-xs text-slate-500">{lang === "zh" ? "今日汇率" : "Tipo de cambio"}</div>
                    <div className="mt-1 text-[1.45rem] font-semibold text-slate-900">{exchangeRate.rateValue?.toFixed(4) || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">MXN → RMB</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-3">
                    <div className="text-xs text-slate-500">{lang === "zh" ? "汇率来源" : "Fuente"}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{exchangeRate.sourceName || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">{fmtDate(exchangeRate.fetchedAt || exchangeRate.rateDate, lang)}</div>
                  </div>
                </div>
              </OverviewWidgetShell>
            </div>
          </div>

          <div className="grid gap-3.5 md:grid-cols-2 2xl:grid-cols-4">
            <OverviewRankList
              title={lang === "zh" ? "产品销量排名" : "Product Ranking"}
              subtitle={lang === "zh" ? "按数量与订单数排序" : "Por cantidad y pedidos"}
              className="min-h-0"
            >
              <div className="space-y-2">
                {overviewDashboard.topProducts.map((item, index) => (
                  <div key={item.sku} className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-500">{index + 1}</span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-900">{item.sku}</div>
                        <div className="truncate text-xs text-slate-500">{item.productNameZh}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-900">{item.quantity}</div>
                      <div className="text-xs text-slate-500">{item.orderCount} {lang === "zh" ? "单" : "ped."}</div>
                    </div>
                  </div>
                ))}
              </div>
            </OverviewRankList>

            <OverviewRankList
              title={lang === "zh" ? "客户订单数排名" : "Customer Orders"}
              subtitle={lang === "zh" ? "按订单数排序" : "Por cantidad de pedidos"}
              className="min-h-0"
            >
              <div className="space-y-2">
                {overviewDashboard.topCustomersByOrders.map((item, index) => (
                  <div key={item.customerId} className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-500">{index + 1}</span>
                      <div className="truncate text-xs font-medium text-slate-900">{item.customerName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-900">{item.orderCount}</div>
                      <div className="text-xs text-slate-500">{lang === "zh" ? "订单" : "Pedidos"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </OverviewRankList>

            <OverviewRankList
              title={lang === "zh" ? "客户订单总额" : "Customer Amount"}
              subtitle={lang === "zh" ? "显示总额、已结与未结" : "Total, pagado y pendiente"}
              className="min-h-0"
            >
              <div className="space-y-2">
                {overviewDashboard.topCustomersByAmount.map((item, index) => (
                  <div key={item.customerId} className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-500">{index + 1}</span>
                        <div className="truncate text-xs font-medium text-slate-900">{item.customerName}</div>
                      </div>
                      <div className="text-xs font-semibold text-slate-900">{fmtMoney(item.totalAmount, lang)}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-700">
                        <div>{lang === "zh" ? "已结" : "Pagado"}</div>
                        <div className="mt-1 text-xs font-semibold">{fmtMoney(item.paidAmount, lang)}</div>
                      </div>
                      <div className="rounded-lg bg-rose-50 px-2.5 py-2 text-rose-700">
                        <div>{lang === "zh" ? "未结" : "Pendiente"}</div>
                        <div className="mt-1 text-xs font-semibold">{fmtMoney(item.unpaidAmount, lang)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </OverviewRankList>

            <OverviewWidgetShell
              title={lang === "zh" ? "待处理提醒" : "Alerts"}
              subtitle={lang === "zh" ? "优先关注的业务提醒" : "Alertas prioritarias"}
              className="min-h-0"
            >
              <div className="space-y-2">
                {overviewDashboard.alerts.map((item, index) => (
                  <div key={item.type} className="flex items-start gap-3 rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-500">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900">{text.alerts[item.type]}</div>
                      <div className="mt-1 text-xs text-slate-500">{lang === "zh" ? "当前数量" : "Conteo actual"} · {item.count}</div>
                    </div>
                  </div>
                ))}
              </div>
            </OverviewWidgetShell>
          </div>
        </div>
      ) : null}

      {false ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-12">
            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_24%),linear-gradient(135deg,#ffffff_0%,#f9fbff_46%,#eef4ff_100%)] shadow-soft xl:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/60 px-6 py-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{lang === "zh" ? "总览仪表板" : "Dashboard"}</div>
                  <div className="mt-2 text-xs text-slate-500">{lang === "zh" ? `${overview.analytics.monthLabel}月度总览` : `${overview.analytics.monthLabel} monthly overview`}</div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 p-1 text-[11px] font-medium text-slate-400">
                  {["Daily", "Weekly", "Monthly", "Yearly"].map((item) => (
                    <span
                      key={item}
                      className={`rounded-full px-3 py-1.5 ${
                        item === "Monthly"
                          ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow"
                          : "text-slate-400"
                      }`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.3fr_0.7fr]">
                <div>
                  <div className="text-5xl font-semibold tracking-tight text-slate-900">{fmtMoney(overview.stats.totalReceivable, lang)}</div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                    {lang === "zh"
                      ? "月度销售、结款、订单与平台分布在这里集中查看。"
                      : "Consulta aqui el panorama mensual de ventas, cobros, pedidos y distribucion por plataforma."}
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "客户订单总额" : "Monto total"}</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{fmtMoney(overview.stats.totalReceivable, lang)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "结款总额" : "Liquidado"}</div>
                      <div className="mt-2 text-2xl font-semibold text-emerald-600">{fmtMoney(overview.stats.totalPaid, lang)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "未结总额" : "Pendiente"}</div>
                      <div className="mt-2 text-2xl font-semibold text-rose-600">{fmtMoney(overview.stats.totalUnpaid, lang)}</div>
                    </div>
                  </div>
                  <div className="mt-6 rounded-[28px] border border-white/70 bg-white/75 p-4 backdrop-blur">
                    <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />{lang === "zh" ? "订单数" : "Pedidos"}</span>
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-fuchsia-500" />{lang === "zh" ? "已发货" : "Enviados"}</span>
                    </div>
                    <OverviewLineChart data={overview.analytics.dailySeries} lineColor="#7c3aed" fillColor="rgba(236,72,153,0.12)" />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[26px] border border-white/70 bg-white/80 px-5 py-5 backdrop-blur">
                    <div className="text-xs text-slate-500">{text.stats.todayOrders}</div>
                    <div className="mt-3 text-4xl font-semibold text-slate-900">{overview.stats.todayOrders}</div>
                  </div>
                  <div className="rounded-[26px] border border-white/70 bg-white/80 px-5 py-5 backdrop-blur">
                    <div className="text-xs text-slate-500">{text.stats.todayShipped}</div>
                    <div className="mt-3 text-4xl font-semibold text-emerald-600">{overview.stats.todayShippedOrders}</div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="rounded-[26px] border border-white/70 bg-white/80 px-5 py-5 backdrop-blur">
                      <div className="text-xs text-slate-500">{text.stats.todayPending}</div>
                      <div className="mt-3 text-3xl font-semibold text-amber-500">{overview.stats.todayPendingOrders}</div>
                    </div>
                    <div className="rounded-[26px] border border-white/70 bg-white/80 px-5 py-5 backdrop-blur">
                      <div className="text-xs text-slate-500">{text.stats.unsettled}</div>
                      <div className="mt-3 text-3xl font-semibold text-rose-600">{overview.stats.unsettledCustomers}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <OverviewRankList
              title={lang === "zh" ? "平台订单分布" : "Traffic"}
              subtitle={lang === "zh" ? "按当月平台订单占比分布" : "Distribucion mensual por plataforma"}
              className="xl:col-span-4"
            >
              <OverviewDonutChart items={overview.analytics.topPlatforms.slice(0, 5)} lang={lang} />
            </OverviewRankList>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <OverviewHighlightCard
              title={lang === "zh" ? "应收" : "Receivable"}
              value={fmtMoney(overview.stats.totalReceivable, lang)}
              subtitle={lang === "zh" ? `${overview.analytics.monthLabel}月` : overview.analytics.monthLabel}
              className="bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500"
            />
            <OverviewHighlightCard
              title={lang === "zh" ? "已收" : "Paid"}
              value={fmtMoney(overview.stats.totalPaid, lang)}
              subtitle={lang === "zh" ? "本期结款" : "Cobrado"}
              className="bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500"
            />
            <OverviewHighlightCard
              title={lang === "zh" ? "未结" : "Pending"}
              value={fmtMoney(overview.stats.totalUnpaid, lang)}
              subtitle={lang === "zh" ? "待跟进回款" : "Pendiente por cobrar"}
              className="bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-400"
            />
            <OverviewHighlightCard
              title={lang === "zh" ? "今日汇率" : "Rate"}
              value={overview.stats.currentRate?.toFixed(4) || "-"}
              subtitle={`${exchangeRate.sourceName || "-"} ? ${fmtDateOnly(exchangeRate.fetchedAt || exchangeRate.rateDate, lang)}`}
              className="bg-gradient-to-br from-amber-400 via-orange-400 to-pink-500"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-12">
            <OverviewWidgetShell
              title={lang === "zh" ? "近期提醒" : "Recent Activities"}
              subtitle={lang === "zh" ? "优先关注的业务提示" : "Alertas y seguimientos prioritarios"}
              className="xl:col-span-3"
            >
              <div className="space-y-4">
                {overview.alerts.map((item, index) => (
                  <div key={item.type} className="relative pl-8">
                    {index < overview.alerts.length - 1 ? <span className="absolute left-[11px] top-6 h-[calc(100%+8px)] w-px bg-slate-200" /> : null}
                    <span className="absolute left-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                      {index + 1}
                    </span>
                    <div className="text-sm font-medium text-slate-900">{text.alerts[item.type]}</div>
                    <div className="mt-1 text-xs text-slate-500">{lang === "zh" ? "当前数量" : "Conteo actual"} ? {item.count}</div>
                  </div>
                ))}
              </div>
            </OverviewWidgetShell>

            <OverviewRankList
              title={lang === "zh" ? "产品销量排名" : "Product Ranking"}
              subtitle={lang === "zh" ? "按销量与订单数排序" : "Ordenado por volumen y pedidos"}
              className="xl:col-span-4"
            >
              <div className="space-y-3">
                {overview.analytics.topProducts.map((item, index) => (
                  <div key={item.sku} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">{index + 1}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{item.sku}</div>
                        <div className="truncate text-xs text-slate-500">{item.productNameZh}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{item.quantity}</div>
                      <div className="text-xs text-slate-500">{item.orderCount} {lang === "zh" ? "单" : "ped."}</div>
                    </div>
                  </div>
                ))}
              </div>
            </OverviewRankList>

            <div className="grid gap-5 xl:col-span-5">
              <OverviewRankList
                title={lang === "zh" ? "客户订单数排名" : "Customer Orders"}
                subtitle={lang === "zh" ? "按订单数排序" : "Ordenado por pedidos"}
              >
                <div className="space-y-3">
                  {overview.analytics.topCustomersByOrders.map((item, index) => (
                    <div key={item.customerId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">{index + 1}</span>
                        <div className="truncate text-sm font-medium text-slate-900">{item.customerName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">{item.orderCount}</div>
                        <div className="text-xs text-slate-500">{lang === "zh" ? "订单" : "Pedidos"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </OverviewRankList>

              <OverviewRankList
                title={lang === "zh" ? "财务速览" : "Finance Snapshot"}
                subtitle={lang === "zh" ? "汇率来源与结款提示" : "Tipo de cambio y resumen de cobros"}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                    <div className="text-xs text-slate-500">{lang === "zh" ? "汇率来源" : "Source"}</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{exchangeRate.sourceName || "-"}</div>
                    <div className="mt-2 text-xs text-slate-500">{fmtDate(exchangeRate.fetchedAt || exchangeRate.rateDate, lang)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                    <div className="text-xs text-slate-500">{lang === "zh" ? "今日汇率" : "Rate"}</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{overview.stats.currentRate?.toFixed(4) || "-"}</div>
                    <div className="mt-2 text-xs text-slate-500">MXN ? RMB</div>
                  </div>
                </div>
                {exchangeRate.fetchFailed ? (
                  <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {exchangeRate.failureReason || text.alerts.exchange_rate_failed}
                  </div>
                ) : null}
              </OverviewRankList>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-12">
            <OverviewWidgetShell title={text.sections.recent} className="xl:col-span-7">
              {overview.recentOrders.length === 0 ? (
                <EmptyState title={text.empty.title} description={text.empty.desc} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-700">
                        <th className="px-4 py-3 font-semibold">{text.fields.customer}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.platform}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.orderNo}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.sku}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.quantity}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.status}</th>
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
            </OverviewWidgetShell>

            <OverviewRankList
              title={lang === "zh" ? "客户订单总额排名" : "Customer Amount Ranking"}
              subtitle={lang === "zh" ? "显示总额、已结与未结" : "Total, paid and pending"}
              className="xl:col-span-5"
            >
              <div className="space-y-3">
                {overview.analytics.topCustomersByAmount.map((item, index) => (
                  <div key={item.customerId} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">{index + 1}</span>
                        <div className="truncate text-sm font-medium text-slate-900">{item.customerName}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{fmtMoney(item.totalAmount, lang)}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-emerald-50 px-3 py-3 text-emerald-700">
                        <div>{lang === "zh" ? "已结" : "Liquidado"}</div>
                        <div className="mt-1 text-sm font-semibold">{fmtMoney(item.paidAmount, lang)}</div>
                      </div>
                      <div className="rounded-xl bg-rose-50 px-3 py-3 text-rose-700">
                        <div>{lang === "zh" ? "未结" : "Pendiente"}</div>
                        <div className="mt-1 text-sm font-semibold">{fmtMoney(item.unpaidAmount, lang)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </OverviewRankList>
          </div>
        </div>
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
              <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60">
                <select
                  value={customerFilter}
                  onChange={(event) => setCustomerFilter(event.target.value)}
                  className="h-10 min-w-[120px] appearance-none rounded-xl bg-transparent px-4 pr-10 text-sm text-slate-700 outline-none transition"
                >
                  <option value="all" hidden>{lang === "zh" ? "\u5168\u90e8\u5ba2\u6237" : "Todos los clientes"}</option>
                  {customerOptions.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </span>
              </div>
            </div>
          }
          right={
            <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto lg:flex-nowrap">
              <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60">
                <select
                  value={settlementFilter}
                  onChange={(event) => setSettlementFilter(event.target.value as typeof settlementFilter)}
                  className="h-10 min-w-[120px] appearance-none rounded-xl bg-transparent px-4 pr-10 text-sm text-slate-700 outline-none transition"
                >
                  <option value="all">{lang === "zh" ? "\u5168\u90e8\u7ed3\u7b97" : "Toda liquidacion"}</option>
                  <option value="paid">{lang === "zh" ? "\u5df2\u7ed3" : "Liquidado"}</option>
                  <option value="unpaid">{lang === "zh" ? "\u672a\u7ed3" : "Pendiente"}</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </span>
              </div>
              <div className="relative w-full max-w-[440px] rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={lang === "zh" ? "\u641c\u7d22\u5e73\u53f0 / \u8ba2\u5355\u53f7 / \u7f16\u7801" : "Buscar plataforma / pedido / codigo"}
                  className="h-10 w-full rounded-xl bg-transparent px-3 pr-[138px] text-sm text-slate-700 outline-none"
                />
                <div className="absolute inset-y-1 right-1 flex items-center border-l border-slate-200 pl-1.5">
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                      className="h-8 min-w-[122px] appearance-none rounded-lg bg-transparent px-3 pr-8 text-sm text-slate-700 outline-none transition"
                    >
                      <option value="all" hidden>{lang === "zh" ? "\u5168\u90e8\u72b6\u6001" : "Todos"}</option>
                      <option value="pending">{getShippingStatusLabel("pending", lang)}</option>
                      <option value="shipped">{getShippingStatusLabel("shipped", lang)}</option>
                      <option value="cancelled">{getShippingStatusLabel("cancelled", lang)}</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4 6 4 4 4-4" />
                      </svg>
                    </span>
                  </div>
                </div>
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
              <div className="max-h-[calc(100vh-250px)] overflow-auto">
              <table className="min-w-full table-auto border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_rgba(148,163,184,0.18)]">
                  <tr className="bg-slate-50 text-left text-sm text-slate-700">
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
                        title={lang === "zh" ? "\u6309\u53d1\u8d27\u65e5\u671f\u6392\u5e8f" : "Ordenar por fecha de envio"}
                      >
                        <span>{text.fields.shippedAt}</span>
                        <SortDirectionIcon direction={shippedAtSortDirection} />
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.shippingProof}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">{text.fields.quantity}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.productImage}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.sku}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.productZh}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{text.fields.color}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">{text.fields.shippingFee}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{lang === "zh" ? "\u7ed3\u7b97" : "Liquidacion"}</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700" aria-label={lang === "zh" ? "\u64cd\u4f5c" : "Acciones"} />
                  </tr>
                </thead>
                <tbody className="text-[13px] text-slate-700">
                  {visibleSortedOrders.map((row) => {
                    const meta = visibleTrackingDisplayMeta.get(row.id);
                    const tracking = row.trackingNo.trim();
                    const groupKey = row.trackingGroupId?.trim().toLowerCase() || "";
                    const isExpanded = groupKey ? expandedTrackingNos.includes(groupKey) : false;
                    const groupedItems = groupKey ? (orderGroupedOrders.get(groupKey) || []).filter((item) => item.id !== row.id) : [];

                    return (
                      <Fragment key={row.id}>
                        <tr className="border-t border-slate-100">
                          <td className="px-3 py-2">{row.platform}</td>
                          <td className="px-3 py-2 text-slate-900">{row.platformOrderNo}</td>
                          <td className="px-3 py-2">
                            {(() => {
                              if (!row.trackingNo) return <span className="text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>;
                              if (!meta?.showTracking) return <span className="text-slate-300">|</span>;
                              return (
                                <div className="inline-flex items-center gap-2">
                                  <span>{row.trackingNo}</span>
                                  {groupedItems.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedTrackingNos((prev) =>
                                          prev.includes(groupKey)
                                            ? prev.filter((item) => item !== groupKey)
                                            : [...prev, groupKey],
                                        )
                                      }
                                      className="inline-flex"
                                      aria-label={lang === "zh" ? "\u5c55\u5f00\u540c\u8ba2\u5355\u5176\u4ed6\u5546\u54c1" : "Expand grouped order items"}
                                      title={lang === "zh" ? "\u67e5\u770b\u540c\u8ba2\u5355\u5176\u4ed6\u5546\u54c1" : "Ver otros productos del mismo pedido"}
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
                          <td className="px-3 py-2">{row.shippedAt ? fmtDateOnly(row.shippedAt, lang) : "-"}</td>
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
                                  title={lang === "zh" ? "\u9884\u89c8\u53d1\u8d27\u51ed\u636e" : "Ver comprobante"}
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
                                  title={lang === "zh" ? "\u9884\u89c8\u53d1\u8d27\u51ed\u636e" : "Ver comprobante"}
                                >
                                  <img
                                    src={row.shippingProofFile}
                                    alt={`${row.platformOrderNo} ${row.sku}`}
                                    className="h-10 w-10 object-cover"
                                  />
                                </button>
                              ) : (
                                <span className="text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                          <td className="px-3 py-2">
                            <div className="flex min-h-10 items-center justify-center">
                              {row.sku ? (
                                <ProductImage
                                  sku={row.sku}
                                  hasImage
                                  size={40}
                                  roundedClassName="rounded-md"
                                  onClick={() =>
                                    setPreviewImage({
                                      src: row.productImageUrl || "",
                                      title: `${row.sku} / ${row.productNameZh || "-"}`,
                                    })
                                  }
                                />
                              ) : (
                                <span className="text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>
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
                          <td className="px-3 py-2">{row.productNameZh}</td>
                          <td className="px-3 py-2">{row.color || "-"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtYuanMoney(row.shippingFee, lang)}</td>
                          <td className={`px-3 py-2 ${row.settlementStatus === "paid" ? "text-emerald-600" : "text-rose-600"}`}>
                            {row.settlementStatus === "paid" ? (lang === "zh" ? "\u5df2\u7ed3" : "Liquidado") : (lang === "zh" ? "\u672a\u7ed3" : "Pendiente")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void deleteSameTrackingOrder(row)}
                                title={lang === "zh" ? "\u5220\u9664" : "Eliminar"}
                                aria-label={lang === "zh" ? "\u5220\u9664" : "Eliminar"}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <TrashIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(row)}
                                title={lang === "zh" ? "\u7f16\u8f91" : "Editar"}
                                aria-label={lang === "zh" ? "\u7f16\u8f91" : "Editar"}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                              >
                                <PencilIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {meta?.showTracking && isExpanded && groupedItems.length > 0 ? (
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
        <TableCard
          title={text.sections.inventory}
          titleRight={
            <div className="flex items-center gap-2">
              <select
                value={inventoryCustomerFilter}
                onChange={(event) => setInventoryCustomerFilter(event.target.value)}
                className="h-10 rounded-xl border border-secondary-accent bg-secondary-accent px-3 text-sm text-primary"
              >
                <option value="all" hidden>{lang === "zh" ? "全部客户" : "Todos los clientes"}</option>
                {inventoryCustomerOptions.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
          }
          right={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <button
                type="button"
                onClick={() => void beginInventoryCreate()}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                <PlusIcon />
                <span className="whitespace-nowrap">{lang === "zh" ? "新增备货" : "Nuevo stock"}</span>
              </button>
              <div className="relative w-full max-w-[340px]">
                <input
                  value={inventoryKeyword}
                  onChange={(event) => setInventoryKeyword(event.target.value)}
                  placeholder={lang === "zh" ? "搜索编码 / 中文名" : "Buscar codigo / nombre"}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>
          }
        >
          {inventory.length === 0 ? (
            <EmptyState title={text.empty.title} description={lang === "zh" ? "录入订单后系统会自动建立客户+SKU 库存记录，后续可继续扩展基础资料维护。" : "Al guardar pedidos se crean registros base de cliente+SKU para seguimiento."} />
          ) : filteredInventory.length === 0 ? (
            <EmptyState
              title={lang === "zh" ? "未找到匹配记录" : "Sin resultados"}
              description={lang === "zh" ? "请尝试修改搜索关键字。" : "Prueba con otra palabra clave."}
            />
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-700">
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "备货时间" : "Fecha de stock"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.productImage}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.sku}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.productZh}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "单价" : "Precio"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "普通折扣" : "Dsc"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "备货数量" : "Stock"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "备货金额" : "Monto stock"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.shipped}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.remaining}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.status}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">{lang === "zh" ? "操作" : "Acciones"}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInventory.map((row) => (
                    <tr key={row.inventoryId} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-sm text-slate-700">{row.stockedAt ? fmtDateOnly(row.stockedAt, lang) : "-"}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        <div className="flex min-h-8 items-center justify-center">
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
                                className="h-8 w-8 object-cover"
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
                      <td className="px-4 py-2 text-sm text-slate-900">{row.sku}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{row.productNameZh}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">${fmtMoney(row.unitPrice, lang)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{fmtPercent(row.discountRate, lang)}%</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{row.stockedQty}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">${fmtMoney(row.stockAmount, lang)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">
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
                      <td className="px-4 py-2 text-sm font-semibold text-slate-900">{row.remainingQty}</td>
                      <td className={`px-4 py-2 text-sm ${getInventoryStatusClass(row.status)}`}>{text.status[row.status]}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => beginInventoryEdit(row)}
                            title={lang === "zh" ? "编辑" : "Editar"}
                            aria-label={lang === "zh" ? "编辑" : "Editar"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeInventoryRow(row)}
                            title={lang === "zh" ? "删除" : "Eliminar"}
                            aria-label={lang === "zh" ? "删除" : "Eliminar"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
              <span>
                {lang === "zh"
                  ? `共 ${filteredInventory.length} 条备货记录`
                  : `${filteredInventory.length} registros de stock`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInventoryPage(1)}
                  disabled={inventoryCurrentPage <= 1}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {lang === "zh" ? "第一页" : "Primera"}
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                  disabled={inventoryCurrentPage <= 1}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {lang === "zh" ? "上一页" : "Anterior"}
                </button>
                <span className="inline-flex h-7 min-w-[72px] items-center justify-center rounded-lg bg-primary px-3 font-medium text-white">
                  {inventoryCurrentPage} / {inventoryTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setInventoryPage((prev) => Math.min(inventoryTotalPages, prev + 1))}
                  disabled={inventoryCurrentPage >= inventoryTotalPages}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {lang === "zh" ? "下一页" : "Siguiente"}
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryPage(inventoryTotalPages)}
                  disabled={inventoryCurrentPage >= inventoryTotalPages}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {lang === "zh" ? "最后一页" : "Ultima"}
                </button>
              </div>
              </div>
            </>
          )}
        </TableCard>
      ) : null}

      {activeTab === "finance" ? (
        <TableCard
          title={text.sections.finance}
          titleRight={
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="whitespace-nowrap">
                {lang === "zh" ? "当天汇率" : "Tipo de cambio"}: {financeDisplayRate?.toFixed(4) || "-"}
              </span>
              <span className="whitespace-nowrap">
                {lang === "zh" ? "来源" : "Fuente"}: {exchangeRate.sourceName || "-"}
              </span>
            </div>
          }
        >
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
                    <tr className="bg-slate-50 text-left text-sm text-slate-700">
                      <th className="px-4 py-3 font-semibold">{text.fields.customer}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "备货金额 (MXN)" : "Monto stock (MXN)"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "今日汇率 (MXN → RMB)" : "Tipo de cambio hoy (MXN -> RMB)"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "汇率后金额 (RMB)" : "Monto convertido (RMB)"}</th>
                      <th className="px-4 py-3 font-semibold">{text.fields.shippingFee}</th>
                      <th className="px-4 py-3 font-semibold">{text.fields.total}</th>
                      <th className="px-4 py-3 font-semibold">{text.fields.paid}</th>
                      <th className="px-4 py-3 font-semibold">{text.fields.unpaid}</th>
                      <th className="px-4 py-3 font-semibold">{text.fields.lastPaid}</th>
                      <th className="px-4 py-3 font-semibold">{text.fields.status}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "\u8be6\u60c5" : "Detalle"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "\u5bfc\u51fa" : "Exportar"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.map((row) => (
                      <tr key={row.customerId} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.customerName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.stockAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{row.exchangeRate?.toFixed(4) || "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.exchangedAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.shippingAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.totalAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600">{fmtMoney(row.paidAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-rose-600">{fmtMoney(row.unpaidAmount, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmtDateOnly(row.lastPaidAt, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{text.status[row.status]}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <button
                            type="button"
                            onClick={() => setFinancePreview(row)}
                            disabled={row.settledOrders.length === 0}
                            title={lang === "zh" ? "\u67e5\u770b\u5df2\u7ed3\u7b97\u8be6\u60c5" : "Ver liquidaciones"}
                            aria-label={lang === "zh" ? "\u67e5\u770b\u5df2\u7ed3\u7b97\u8be6\u60c5" : "Ver liquidaciones"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                          >
                            <EyeIcon />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <a
                            href={`/api/dropshipping/finance/${row.customerId}/export/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            title={lang === "zh" ? "\u5bfc\u51fa\u7ed3\u7b97 PDF" : "Exportar PDF"}
                            aria-label={lang === "zh" ? "\u5bfc\u51fa\u7ed3\u7b97 PDF" : "Exportar PDF"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <DownloadIcon />
                          </a>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-3">
          <div className="flex max-h-[calc(100vh-24px)] w-[min(940px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {form.id ? text.form.edit : text.form.create}
              </h3>
            </div>
            <div className="overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
              <div className="grid gap-4 md:grid-cols-6">
              {false && ([
                ["customerName", text.form.customer, "md:col-span-1 xl:col-span-4 xl:order-1"],
                ["platformOrderNo", lang === "zh" ? "订单号" : text.form.orderNo, "md:col-span-1 xl:col-span-4 xl:order-2"],
                ["trackingNo", text.form.trackingNo, "md:col-span-2 xl:col-span-4 xl:order-3"],
                ["sku", text.form.sku, "md:col-span-1 xl:col-span-3 xl:order-4"],
                ["productNameZh", lang === "zh" ? "中文名" : text.form.productZh, "md:col-span-1 xl:col-span-6 xl:order-5"],
                ["quantity", text.form.quantity, "md:col-span-1 xl:col-span-3 xl:order-6"],
                ["shippedAt", text.form.shippedAt, "md:col-span-1 xl:col-span-4 xl:order-7"],
                ["color", text.form.color, "md:col-span-1 xl:col-span-4 xl:order-8"],
              ] as Array<[keyof OrderFormState, string, string]>).map(([key, label, spanClass]) => (
                <label key={key} className={`space-y-1 ${spanClass}`}>
                  <span className="whitespace-nowrap text-xs text-slate-500">{label}</span>
                  <input
                    type={key === "shippedAt" ? "date" : key === "quantity" ? "number" : "text"}
                    value={form[key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    disabled={productFieldsLocked && (key === "sku" || key === "productNameZh")}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </label>
              ))}

              <label className="hidden space-y-1 md:col-span-2 md:order-1">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.customer}</span>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-2 md:order-2">
                <span className="whitespace-nowrap text-xs text-slate-500">{lang === "zh" ? "订单号" : text.form.orderNo}</span>
                <input
                  type="text"
                  value={form.platformOrderNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, platformOrderNo: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-2 md:order-3">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.trackingNo}</span>
                <input
                  type="text"
                  value={form.trackingNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, trackingNo: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-1 md:order-4">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.sku}</span>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
                  disabled={productFieldsLocked}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-4 md:order-5">
                <span className="whitespace-nowrap text-xs text-slate-500">{lang === "zh" ? "中文名" : text.form.productZh}</span>
                <input
                  type="text"
                  value={form.productNameZh}
                  onChange={(event) => setForm((prev) => ({ ...prev, productNameZh: event.target.value }))}
                  disabled={productFieldsLocked}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-1 md:order-6">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.quantity}</span>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-1 md:order-7">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.shippedAt}</span>
                <input
                  type="date"
                  value={form.shippedAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, shippedAt: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-1 md:order-8">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.color}</span>
                <input
                  type="text"
                  value={form.color}
                  onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <div className="hidden space-y-1 md:col-span-2 xl:col-span-6 xl:order-12">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.fields.shippingLabel}</span>
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
                  ) : (
                    <span className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">
                      {lang === "zh" ? "\u7a7a" : "Vacio"}
                    </span>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white">
                      {lang === "zh" ? "选择文件" : "Seleccionar archivo"}
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(event) => setLabelFiles(event.target.files ? [event.target.files[0]].filter(Boolean) as File[] : [])}
                        className="sr-only"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                      {labelFiles[0]?.name || currentEditingOrder?.shippingLabelAttachments[0]?.fileName || ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden space-y-1 md:col-span-2 xl:col-span-6 xl:order-13">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.fields.shippingProof}</span>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  {currentEditingOrder?.shippingProofAttachments.length ? (
                    <div className="flex flex-wrap gap-2">
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
                  ) : (
                    <span className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">
                      {lang === "zh" ? "\u7a7a" : "Vacio"}
                    </span>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white">
                      {lang === "zh" ? "选择文件" : "Seleccionar archivo"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => setProofFiles(event.target.files ? Array.from(event.target.files) : [])}
                        className="sr-only"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                      {proofFiles.length > 0
                        ? `${proofFiles.length} ${lang === "zh" ? "个文件" : "archivo(s)"}`
                        : currentEditingOrder?.shippingProofAttachments.length
                          ? `${currentEditingOrder.shippingProofAttachments.length} ${lang === "zh" ? "个文件" : "archivo(s)"}`
                          : ""}
                    </span>
                  </div>
                </div>
              </div>

              <label className="hidden space-y-1 md:col-span-1 xl:col-span-4 xl:order-9">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.platform}</span>
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

              <label className="hidden space-y-1 md:col-span-1 xl:col-span-6 xl:order-10">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.status}</span>
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

              <label className="hidden space-y-1 md:col-span-1 xl:col-span-6 xl:order-11">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.shippingFee}</span>
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

              <label className="hidden space-y-1 md:col-span-1 xl:col-span-6 xl:order-12">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.settlement}</span>
                <select
                  value={form.settlementStatus}
                  onChange={(event) => setForm((prev) => ({ ...prev, settlementStatus: event.target.value as OrderFormState["settlementStatus"] }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="paid">{getSettlementStatusLabel("paid", lang)}</option>
                  <option value="unpaid">{getSettlementStatusLabel("unpaid", lang)}</option>
                </select>
              </label>

              <label className="hidden space-y-1 md:col-span-2 xl:col-span-12 xl:order-14">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.notes}</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <label className="hidden space-y-1 md:col-span-1 md:order-9">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.platform}</span>
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

              <label className="hidden space-y-1 md:col-span-1 md:order-10">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.status}</span>
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

              <label className="hidden space-y-1 md:col-span-1 md:order-11">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.shippingFee}</span>
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

              <label className="hidden space-y-1 md:col-span-1 md:order-12">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.settlement}</span>
                <select
                  value={form.settlementStatus}
                  onChange={(event) => setForm((prev) => ({ ...prev, settlementStatus: event.target.value as OrderFormState["settlementStatus"] }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="paid">{getSettlementStatusLabel("paid", lang)}</option>
                  <option value="unpaid">{getSettlementStatusLabel("unpaid", lang)}</option>
                </select>
              </label>

              <div className="hidden space-y-1 md:col-span-3 md:order-13">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.fields.shippingLabel}</span>
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
                  ) : (
                    <span className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">
                      {lang === "zh" ? "\u7a7a" : "Vacio"}
                    </span>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white">
                      {lang === "zh" ? "选择文件" : "Seleccionar archivo"}
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(event) => setLabelFiles(event.target.files ? [event.target.files[0]].filter(Boolean) as File[] : [])}
                        className="sr-only"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                      {labelFiles[0]?.name || currentEditingOrder?.shippingLabelAttachments[0]?.fileName || ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden space-y-1 md:col-span-3 md:order-13">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.fields.shippingProof}</span>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  {currentEditingOrder?.shippingProofAttachments.length ? (
                    <div className="flex flex-wrap gap-2">
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
                  ) : (
                    <span className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">
                      {lang === "zh" ? "\u7a7a" : "Vacio"}
                    </span>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white">
                      {lang === "zh" ? "选择文件" : "Seleccionar archivo"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => setProofFiles(event.target.files ? Array.from(event.target.files) : [])}
                        className="sr-only"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                      {proofFiles.length > 0
                        ? `${proofFiles.length} ${lang === "zh" ? "个文件" : "archivo(s)"}`
                        : currentEditingOrder?.shippingProofAttachments.length
                          ? `${currentEditingOrder.shippingProofAttachments.length} ${lang === "zh" ? "个文件" : "archivo(s)"}`
                          : ""}
                    </span>
                  </div>
                </div>
              </div>

              <label className="hidden space-y-1 md:col-span-6 md:order-14">
                <span className="whitespace-nowrap text-xs text-slate-500">{text.form.notes}</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>

              <div className="md:col-span-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-[minmax(120px,0.55fr)_minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(92px,0.32fr)]">
                  <label className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.customer}</span>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{lang === "zh" ? "订单号" : text.form.orderNo}</span>
                    <input
                      type="text"
                      value={form.platformOrderNo}
                      onChange={(event) => setForm((prev) => ({ ...prev, platformOrderNo: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.trackingNo}</span>
                    <input
                      type="text"
                      value={form.trackingNo}
                      onChange={(event) => setForm((prev) => ({ ...prev, trackingNo: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.quantity}</span>
                    <input
                      type="number"
                      value={form.quantity}
                      onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,2fr)_minmax(120px,0.45fr)]">
                  <label className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.sku}</span>
                    <input
                      type="text"
                      value={form.sku}
                      onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
                      disabled={productFieldsLocked}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{lang === "zh" ? "中文名" : text.form.productZh}</span>
                    <input
                      type="text"
                      value={form.productNameZh}
                      onChange={(event) => setForm((prev) => ({ ...prev, productNameZh: event.target.value }))}
                      disabled={productFieldsLocked}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.color}</span>
                    <input
                      type="text"
                      value={form.color}
                      onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-[156px_132px_132px_minmax(190px,1fr)]">
                  <label className="min-w-0 space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.shippedAt}</span>
                    <input
                      type="date"
                      value={form.shippedAt}
                      onChange={(event) => setForm((prev) => ({ ...prev, shippedAt: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.platform}</span>
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
                  <label className="min-w-0 space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.status}</span>
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
                  <div className="grid min-w-0 grid-cols-[82px_82px] gap-3">
                    <label className="min-w-0 space-y-1">
                      <span className="whitespace-nowrap text-xs text-slate-500">{text.form.shippingFee}</span>
                      <select
                        value={form.shippingFee}
                        onChange={(event) => setForm((prev) => ({ ...prev, shippingFee: event.target.value }))}
                        className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                      >
                        <option value="">{lang === "zh" ? "请选择代发费" : "Selecciona cargo"}</option>
                        {shippingFeeOptions.map((fee) => (
                          <option key={fee} value={fee}>
                            {fee}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0 space-y-1">
                      <span className="whitespace-nowrap text-xs text-slate-500">{text.form.settlement}</span>
                      <select
                        value={form.settlementStatus}
                        onChange={(event) => setForm((prev) => ({ ...prev, settlementStatus: event.target.value as OrderFormState["settlementStatus"] }))}
                        className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                      >
                        <option value="paid">{getSettlementStatusLabel("paid", lang)}</option>
                        <option value="unpaid">{getSettlementStatusLabel("unpaid", lang)}</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.fields.shippingLabel}</span>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                      <div className="grid grid-cols-3 gap-2">
                        {labelSlots.map((slot, slotIndex) => renderAttachmentSlot(slot, "label", slotIndex))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.fields.shippingProof}</span>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                      <div className="grid grid-cols-3 gap-2">
                        {proofSlots.map((slot, slotIndex) => renderAttachmentSlot(slot, "proof", slotIndex))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="whitespace-nowrap text-xs text-slate-500">{lang === "zh" ? "同物流号商品" : "Productos con la misma guia"}</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
                      {groupedOrderSlots.map((slot, index) => (
                        <div
                          key={slot.slotKey}
                          className={`relative min-h-[82px] rounded-xl border border-slate-200 bg-white ${
                            slot.orderId ? "p-2.5" : "p-0"
                          }`}
                        >
                          {slot.orderId ? (
                            <>
                              {!slot.isCurrent ? (
                                <button
                                  type="button"
                                  onClick={() => requestRemoveGroupedOrder(slot)}
                                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-200 bg-white text-xs text-rose-500 transition hover:border-rose-300 hover:bg-rose-50"
                                  title={lang === "zh" ? "删除" : "Quitar"}
                                  aria-label={lang === "zh" ? "删除" : "Quitar"}
                                >
                                  -
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!slot.orderId || slot.isCurrent) return;
                                  const match = groupedOrdersForModal.find((item) => item.id === slot.orderId);
                                  if (match) openEditModal(match, modalPrimaryOrderId || form.id || match.id);
                                }}
                                className={`flex w-full items-start gap-1.5 text-left ${slot.isCurrent ? "cursor-default" : "cursor-pointer"}`}
                              >
                                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                                  {slot.sku ? (
                                    <ProductImage
                                      sku={slot.sku}
                                      hasImage
                                      size={40}
                                      roundedClassName="rounded-lg"
                                      onClick={() => {
                                        if (!slot.sku) return;
                                        setPreviewImage({
                                          src: slot.productImageUrl || "",
                                          title: `${slot.sku} / ${slot.productNameZh || "-"}`,
                                        });
                                      }}
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                                  )}
                                </span>
                                <span className="flex min-w-0 flex-col justify-center pt-0.5">
                                  <span className="block truncate text-[13px] font-medium text-slate-900">{slot.sku || `SKU ${index + 1}`}</span>
                                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{slot.productNameZh || (lang === "zh" ? "未选择商品" : "Sin producto")}</span>
                                  <span
                                    className={`mt-1 inline-flex w-fit max-w-full whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] leading-none tracking-tight ${
                                      slot.isCurrent ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {slot.isCurrent ? (lang === "zh" ? "当前编辑" : "Actual") : (lang === "zh" ? "点击切换" : "Cambiar")}
                                  </span>
                                </span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openGroupProductSearch(slot.slotKey)}
                              className="flex h-full min-h-[82px] w-full flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-primary"
                            >
                              <span className="text-lg leading-none">+</span>
                              <span className="text-[11px] font-medium">{lang === "zh" ? "添加商品" : "Agregar"}</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="space-y-1">
                  <span className="whitespace-nowrap text-xs text-slate-500">{text.form.notes}</span>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  />
                </label>
              </div>
            </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
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
      {groupedDeleteTarget ? (
        <div className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pb-3 pt-5">
              <h3 className="text-base font-semibold text-slate-900">
                {lang === "zh" ? "确认移除商品" : "Confirmar eliminacion"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {lang === "zh"
                  ? `确认将 ${groupedDeleteTarget.sku || groupedDeleteTarget.productNameZh || "该商品"} 从同物流号商品组中移除？`
                  : `Quitar ${groupedDeleteTarget.sku || groupedDeleteTarget.productNameZh || "este producto"} del grupo?`}
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setGroupedDeleteTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {lang === "zh" ? "取消" : "Cancelar"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmRemoveGroupedOrder()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {lang === "zh" ? "确定" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {groupProductSearchOpen ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {lang === "zh" ? "选择商品" : "Seleccionar producto"}
                    </h3>
                  </div>
                  <button
                type="button"
                onClick={() => {
                  setGroupProductSearchOpen(false);
                  setGroupProductSearchKeyword("");
                  setGroupProductOptions([]);
                  setActiveGroupSlotKey(null);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              >
                X
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <input
                value={groupProductSearchKeyword}
                onChange={(event) => setGroupProductSearchKeyword(event.target.value)}
                placeholder={lang === "zh" ? "搜索编码 / 中文名" : "Buscar SKU / nombre"}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
              />
              <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-200">
                {groupProductSearchLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    {lang === "zh" ? "搜索中..." : "Buscando..."}
                  </div>
                ) : groupProductOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    {lang === "zh" ? "没有可选商品" : "Sin productos"}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {groupProductOptions.map((item) => (
                      <button
                        key={`${item.source}-${item.sourceId}`}
                        type="button"
                        onClick={() => void handleSelectGroupedProduct(item)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.nameZh || item.sku} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{item.sku}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{item.nameZh || item.nameEs || "-"}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                    ? `$${fmtMoney(currentPreviewOrder.snapshotStockAmount, lang)}`
                    : currentInventoryPreview
                      ? `$${fmtMoney(currentInventoryPreview.stockAmount, lang)}`
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
                  {currentInventoryPreview ? `$${fmtMoney(currentInventoryPreview.stockAmount, lang)}` : "-"}
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

      {inventoryEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setInventoryEdit(null)}>
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-slate-900">
                {inventoryEdit.mode === "create"
                  ? (lang === "zh" ? "新增备货记录" : "Nuevo stock")
                  : (lang === "zh" ? "编辑备货记录" : "Editar stock")}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {inventoryEdit.mode === "create"
                  ? (lang === "zh" ? "选择客户与产品后录入备货信息" : "Selecciona cliente y producto")
                  : `${inventoryEdit.customerName} / ${inventoryEdit.sku} / ${inventoryEdit.productNameZh || "-"}`}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "客户" : "Cliente"}</p>
                <select
                  value={inventoryEdit.customerId}
                  disabled={inventoryEdit.mode !== "create"}
                  onChange={(event) => {
                    const nextCustomerId = event.target.value;
                    const customer = inventoryCustomers.find((row) => row.id === nextCustomerId);
                    setInventoryEdit((prev) => (prev ? {
                      ...prev,
                      customerId: nextCustomerId,
                      customerName: customer?.name || "",
                    } : prev));
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary/40 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">{lang === "zh" ? "请选择客户" : "Selecciona cliente"}</option>
                  {inventoryCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "产品（编码 / 中文名）" : "Producto (codigo / nombre)"}</p>
                <input
                  value={inventoryProductQuery}
                  disabled={inventoryEdit.mode !== "create"}
                  onChange={(event) => setInventoryProductQuery(event.target.value)}
                  placeholder={lang === "zh" ? "搜索编码 / 中文名" : "Buscar codigo / nombre"}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40 disabled:bg-slate-50 disabled:text-slate-500"
                />
                {inventoryEdit.mode === "create" && inventoryProductQuery.trim().length > 0 ? (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                    {inventoryProductOptions.length > 0 ? (
                      inventoryProductOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => pickInventoryProduct(option)}
                          className={`flex w-full items-center gap-3 border-b border-slate-200 px-3 py-2.5 text-left last:border-b-0 hover:bg-white ${
                            inventoryEdit.productCatalogId === option.id ? "bg-white" : ""
                          }`}
                        >
                          <span className="shrink-0">
                            <ProductImage
                              sku={option.sku}
                              hasImage
                              size={42}
                              roundedClassName="rounded-lg"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {option.sku}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {option.nameZh || option.nameEs || "-"}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-500">
                        {inventoryProductLoading
                          ? (lang === "zh" ? "正在查找产品..." : "Buscando productos...")
                          : (lang === "zh" ? "请输入编码或中文名查找产品" : "Escribe para buscar productos")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "备货数量" : "Stock"}</p>
                <input
                  inputMode="numeric"
                  value={inventoryEdit.stockedQty}
                  onChange={(event) => setInventoryEdit((prev) => (prev ? { ...prev, stockedQty: event.target.value.replace(/[^\d]/g, "") } : prev))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "单价" : "Precio"}</p>
                <input
                  inputMode="decimal"
                  value={inventoryEdit.unitPrice}
                  onChange={(event) => setInventoryEdit((prev) => (prev ? { ...prev, unitPrice: event.target.value.replace(/[^\d.]/g, "") } : prev))}
                  disabled={inventoryEdit.unitPriceLocked}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "普通折扣 (%)" : "Descuento (%)"}</p>
                <input
                  inputMode="decimal"
                  value={inventoryEdit.discountRate}
                  onChange={(event) => setInventoryEdit((prev) => (prev ? { ...prev, discountRate: event.target.value.replace(/[^\d.]/g, "") } : prev))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "发货仓" : "Almacen"}</p>
                <input
                  value={inventoryEdit.warehouse}
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setInventoryEdit(null)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50"
              >
                {lang === "zh" ? "取消" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => void saveInventoryEdit()}
                disabled={saving}
                className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? (lang === "zh" ? "保存中..." : "Guardando...") : (lang === "zh" ? "保存" : "Guardar")}
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
                      <tr className="bg-slate-50 text-left text-sm text-slate-700">
                        <th className="px-4 py-3 font-semibold">{text.fields.orderNo}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.trackingNo}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.shippedAt}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.quantity}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.color}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.shippingLabel}</th>
                        <th className="px-4 py-3 font-semibold">{text.fields.shippingProof}</th>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-3">
          <div className="flex max-h-[calc(100vh-16px)] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="border-b border-slate-200 bg-white px-5 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <h3 className="whitespace-nowrap text-xl font-semibold text-slate-900">
                    {lang === "zh" ? "\u5df2\u7ed3\u7b97\u8be6\u60c5" : "Detalle de liquidaciones"}
                  </h3>
                  <p className="truncate text-sm text-slate-500">{financePreview.customerName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFinancePreview(null)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={lang === "zh" ? "关闭" : "Cerrar"}
                  title={lang === "zh" ? "关闭" : "Cerrar"}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-white">
              {financePreview.settledOrders.length === 0 ? (
                <EmptyState
                  title={lang === "zh" ? "\u6682\u65e0\u5df2\u7ed3\u7b97\u8bb0\u5f55" : "Sin registros liquidados"}
                  description={lang === "zh" ? "\u5f53\u524d\u5ba2\u6237\u8fd8\u6ca1\u6709\u5df2\u7ed3\u7b97\u7684\u8ba2\u5355\u3002" : "Este cliente aun no tiene pedidos liquidados."}
                />
              ) : (
                <div className="overflow-hidden bg-white">
                  <div ref={financePreviewScrollRef} className="max-h-[calc(100vh-152px)] overflow-auto">
                    <table className="min-w-[1040px] w-full border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[12px] font-semibold text-slate-600 shadow-[0_1px_0_0_rgba(226,232,240,1),0_6px_16px_rgba(15,23,42,0.04)]">
                          <th className="w-[64px] whitespace-nowrap px-3 py-2.5">{lang === "zh" ? "\u5546\u54c1\u56fe" : "Image"}</th>
                          <th className="w-[180px] whitespace-nowrap px-4 py-2.5">{text.fields.orderNo}</th>
                          <th className="w-[120px] whitespace-nowrap px-4 py-2.5">{text.fields.sku}</th>
                          <th className="w-[180px] whitespace-nowrap px-4 py-2.5">{text.fields.productZh}</th>
                          <th className="w-[170px] whitespace-nowrap px-4 py-2.5">{text.fields.trackingNo}</th>
                          <th className="w-[96px] whitespace-nowrap px-3 py-2.5">{text.fields.shippedAt}</th>
                          <th className="w-[96px] whitespace-nowrap px-3 py-2.5">{lang === "zh" ? "\u7ed3\u7b97\u65e5\u671f" : "Settled"}</th>
                          <th className="w-[72px] whitespace-nowrap px-3 py-2.5">{lang === "zh" ? "\u72b6\u6001" : "Status"}</th>
                          <th className="w-[92px] whitespace-nowrap px-3 py-2.5 text-right">{lang === "zh" ? "\u5df2\u7ed3" : "Paid"}</th>
                          <th className="w-[92px] whitespace-nowrap px-3 py-2.5 text-right">{lang === "zh" ? "\u603b\u91d1\u989d" : "Total"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financePreviewVisibleOrders.map((item, index) => (
                          <tr
                            key={item.orderId}
                            className={`border-b border-slate-100 text-[12px] text-slate-700 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/45"}`}
                          >
                            <td className="px-4 py-2.5 align-middle">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-slate-200 bg-white">
                                {item.productImageUrl && !failedFinanceImages.includes(item.orderId) ? (
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
                                      onError={() =>
                                        setFailedFinanceImages((prev) =>
                                          prev.includes(item.orderId) ? prev : [...prev, item.orderId],
                                        )
                                      }
                                    />
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">{lang === "zh" ? "\u7a7a" : "Vacio"}</span>
                                )}
                              </div>
                            </td>
                            <td className="max-w-[180px] whitespace-nowrap px-4 py-2.5 align-middle text-slate-900 truncate">{item.platformOrderNo}</td>
                            <td className="max-w-[120px] whitespace-nowrap px-4 py-2.5 align-middle truncate">{item.sku}</td>
                            <td className="max-w-[180px] whitespace-nowrap px-4 py-2.5 align-middle truncate">{item.productNameZh || "-"}</td>
                            <td className="max-w-[170px] whitespace-nowrap px-4 py-2.5 align-middle truncate">{item.trackingNo || "-"}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 align-middle">{fmtDateOnly(item.shippedAt, lang)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 align-middle">{fmtDateOnly(item.settledAt, lang)}</td>
                            <td className="px-4 py-2.5 align-middle">
                              <span className="inline-flex h-6 min-w-[52px] items-center justify-center whitespace-nowrap rounded-full bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-600">
                                {lang === "zh" ? "\u5df2\u7ed3" : "Paid"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-emerald-600 align-middle">{`\uffe5${fmtMoney(item.paidAmount, lang)}`}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-900 align-middle">{`\uffe5${fmtMoney(item.totalAmount, lang)}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-2 text-xs text-slate-400">
                    <span>
                      {lang === "zh"
                        ? `\u5171 ${financePreview.settledOrders.length} \u6761\u5df2\u7ed3\u7b97\u8bb0\u5f55`
                        : `${financePreview.settledOrders.length} settled records`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFinancePreviewPage(1)}
                        disabled={financePreviewCurrentPage <= 1}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {lang === "zh" ? "\u56de\u7b2c\u4e00\u9875" : "Primera"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinancePreviewPage((prev) => Math.max(1, prev - 1))}
                        disabled={financePreviewCurrentPage <= 1}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {lang === "zh" ? "\u4e0a\u4e00\u9875" : "Anterior"}
                      </button>
                      <span className="inline-flex h-7 min-w-[78px] items-center justify-center rounded-lg bg-primary px-3 font-medium text-white">
                        {financePreviewCurrentPage} / {financePreviewTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFinancePreviewPage((prev) => Math.min(financePreviewTotalPages, prev + 1))}
                        disabled={financePreviewCurrentPage >= financePreviewTotalPages}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {lang === "zh" ? "\u4e0b\u4e00\u9875" : "Siguiente"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinancePreviewPage(financePreviewTotalPages)}
                        disabled={financePreviewCurrentPage >= financePreviewTotalPages}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {lang === "zh" ? "\u53bb\u6700\u540e\u9875" : "Ultima"}
                      </button>
                    </div>
                    <div className="hidden items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white">‹</span>
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-white">1</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white">›</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pb-5 pt-6">
              <p className="mb-3 text-sm text-slate-600">
                {lang === "zh"
                  ? `请输入完整物流号：${deleteTarget.trackingNo}`
                  : `Ingresa la guia completa: ${deleteTarget.trackingNo}`}
              </p>
              <input
                type="text"
                value={deleteTrackingInput}
                onChange={(event) => setDeleteTrackingInput(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder={
                  lang === "zh"
                    ? `请输入完整物流号：${deleteTarget.trackingNo}`
                    : `Ingresa la guia completa: ${deleteTarget.trackingNo}`
                }
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteTrackingInput("");
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {lang === "zh" ? "\u53d6\u6d88" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteOrder()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                {lang === "zh" ? "\u786e\u5b9a" : "Confirmar"}
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
