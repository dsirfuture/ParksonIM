"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type Dispatch, type DragEvent, type ReactNode, type SetStateAction } from "react";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { EmptyState } from "@/components/empty-state";
import { ImageLightbox } from "@/components/image-lightbox";
import { ProductImage } from "@/components/product-image";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { getClientLang } from "@/lib/lang-client";
import { applyStockPriorityProductAmounts } from "@/lib/dropshipping-finance";
import { normalizeProductCode } from "@/lib/product-code";
import { buildProductImageUrls } from "@/lib/product-image-url";
import type {
  DsAlertItem,
  DsOrderAttachment,
  DsExchangeRatePayload,
  DsFinanceStatus,
  DsFinanceRow,
  DsInventoryStatus,
  DsInventoryRow,
  DsOrderRow,
  DsOverviewAnalytics,
  DsOverviewOrder,
  DsOverviewStats,
  DsSettlementCurrencyMode,
} from "@/lib/dropshipping-types";
import { normalizeDsSettlementCurrencyMode } from "@/lib/dropshipping-types";

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
  initialLoadedTabs: Record<"overview" | "orders" | "inventory" | "finance" | "rate", boolean>;
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
  trackingNo: string;
  orderId: string;
  mode: "exact" | "related";
} | null;

type InventoryEditState = {
  mode: "create" | "edit";
  id: string;
  orderId: string;
  trackingNo: string;
  customerId: string;
  customerName: string;
  productCatalogId: string;
  productId: string;
  sku: string;
  productNameZh: string;
  productNameEs: string;
  isStocked: boolean;
  stockedAt: string;
  stockedQty: string;
  stockAmount: string;
  unitPrice: string;
  unitPriceLocked: boolean;
  discountRate: string;
  warehouse: string;
  remainingQty: number | null;
  status: DsInventoryStatus | null;
} | null;

type InventoryExportState = {
  stocked: "all" | "stocked" | "unstocked";
  status: "all" | DsInventoryStatus;
  skuKeyword: string;
  includeAllShipped: boolean;
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

type InventoryExportMode = "stocked" | "status" | "sku" | "allShipped" | null;

type FinancePreviewState = DsFinanceRow | null;
type FinanceActionLogEntry = {
  id: string;
  createdAtText: string;
  actionText: string;
  operatorName: string;
  detailText: string;
};
type FinanceStatementRecordEntry = {
  statementNumber: string;
  cycleText: string;
  exportedAtText: string;
  generatedAtText?: string;
  operatorName: string;
  isPaid: boolean;
};
type FinanceStatementLockState = {
  statementNumber: string;
  isGenerated: boolean;
  isPaid: boolean;
  actionText: string;
  createdAtText: string;
  generatedAtText?: string;
  operatorName: string;
  noteText: string;
} | null;
type FinanceSelectionState = {
  excludedOrderIds: string[];
  includedOrderIds: string[];
  reincludedOrderIds: string[];
};
type FinanceStatementRevokeState = {
  confirmStatementNumber: string;
  note: string;
  error: string;
} | null;
type OverviewRange = "day" | "week" | "month" | "year";

type DeleteOrderState = {
  id: string;
  trackingNo: string;
} | null;

type ImportedOrderRow = {
  platform: string;
  platformOrderNo: string;
  rawSku: string;
  sku: string;
  quantity: number;
  trackingNo: string;
  shippedAt: string;
  shippingFee: string;
  parseError: string;
  duplicateError: string;
};

type InventoryDeleteTargetState = {
  row: DsInventoryRow;
  kind: "inventory" | "shipped";
} | null;

function collectPaidFinanceCycleTextSet(
  entries: FinanceStatementRecordEntry[],
  options?: {
    includeCurrentPaidCycle?: boolean;
    currentCycleText?: string | null;
  },
) {
  const set = new Set<string>();
  entries.forEach((entry) => {
    if (entry.isPaid) {
      const cycleKey = normalizeFinanceCycleText(entry.cycleText);
      if (cycleKey) set.add(cycleKey);
    }
  });
  if (options?.includeCurrentPaidCycle) {
    const cycleKey = normalizeFinanceCycleText(options.currentCycleText);
    if (cycleKey) set.add(cycleKey);
  }
  return set;
}

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

function buildInventoryProductDisplay(sku: string, nameZh?: string | null, nameEs?: string | null) {
  return `${sku} / ${nameZh || nameEs || ""}`.trim();
}

function extractInventoryProductKeyword(query: string) {
  return query.split("/")[0]?.trim() || query.trim();
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

function fmtFinanceRateDateLabel(value: string | null | undefined, lang: "zh" | "es") {
  if (!value) return "-";
  const raw = String(value).trim();
  if (raw.includes("T") || /Z$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const formatter = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Mexico_City",
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(raw)).map((part) => [part.type, part.value]),
    ) as Record<string, string>;
    if (lang !== "zh") {
      return `${parts.day}/${parts.month}/${parts.year}`;
    }
    const todayFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayParts = Object.fromEntries(
      todayFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
    ) as Record<string, string>;
    const isToday =
      parts.year === todayParts.year &&
      parts.month === todayParts.month &&
      parts.day === todayParts.day;
    return `${Number(parts.year)}年${Number(parts.month)}月${Number(parts.day)}日${isToday ? "（今天）" : ""}`;
  }
  const parts = parseDateOnlyParts(value);
  if (!parts) return fmtDateOnly(value, lang);

  if (lang !== "zh") {
    return `${parts.day}/${parts.month}/${parts.year}`;
  }

  const todayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayParts = Object.fromEntries(
    todayFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const isToday =
    parts.year === todayParts.year &&
    parts.month === todayParts.month &&
    parts.day === todayParts.day;

  return `${Number(parts.year)}年${Number(parts.month)}月${Number(parts.day)}日${isToday ? "（今天）" : ""}`;
}

function deriveFinanceSummaryStatus(totalAmount: number, paidAmount: number): DsFinanceStatus {
  if (totalAmount <= 0) return "unpaid";
  if (paidAmount >= totalAmount) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
}

function getMexicoTodayDateValue() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDatePartFromDateTimeText(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/(\d{4}\/\d{2}\/\d{2})/);
  return match?.[1]?.replace(/\//g, "-") || "";
}

function toDateInputValue(value: string | null | undefined) {
  const parts = parseDateOnlyParts(String(value || ""));
  if (!parts) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeImportHeader(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function extractImportedPlatformSku(value: string) {
  const text = String(value || "")
    .replace(/[—–－]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const directMatched = text.match(/BS-([A-Za-z0-9]+)-([A-Za-z0-9]+)/i);
  if (directMatched?.[1] && directMatched?.[2]) {
    return `${directMatched[1].trim()}-${directMatched[2].trim()}`;
  }
  const afterPrefix = text.replace(/^BS-/i, "");
  const body = afterPrefix.replace(/\*\d+(?:$|\s.*$)/i, "").trim();
  const parts = body.split("-").map((item) => item.trim()).filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : (parts[0] || "");
}

function formatMexicoDateFromChinaParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) {
  const utcMillis = Date.UTC(year, month - 1, day, hour - 8, minute, second);
  const mexicoFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return mexicoFormatter.format(new Date(utcMillis));
}

function toMexicoDateInputFromChinaDateTime(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatMexicoDateFromChinaParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
    );
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const dateParts = XLSX.SSF.parse_date_code(value);
    if (dateParts) {
      return formatMexicoDateFromChinaParts(
        Number(dateParts.y || 0),
        Number(dateParts.m || 1),
        Number(dateParts.d || 1),
        Number(dateParts.H || 0),
        Number(dateParts.M || 0),
        Number(dateParts.S || 0),
      );
    }
  }

  const text = String(value || "").trim();
  if (!text) return "";
  const matched = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!matched) return "";
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = matched;
  return formatMexicoDateFromChinaParts(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function buildImportedOrderRowError(item: Pick<ImportedOrderRow, "platform" | "platformOrderNo" | "trackingNo" | "shippedAt" | "sku" | "quantity">) {
  const parseErrorList: string[] = [];
  if (!item.platform) parseErrorList.push("缺少平台");
  if (!item.platformOrderNo) parseErrorList.push("缺少订单编号");
  if (!item.trackingNo) parseErrorList.push("缺少跟踪号");
  if (!item.shippedAt) parseErrorList.push("发货时间无法识别");
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) parseErrorList.push("产品数量无效");
  if (!item.sku) parseErrorList.push("商品编码无法解析");
  return parseErrorList.join("；");
}

function buildImportedOrderDuplicateErrors(
  importedRows: ImportedOrderRow[],
  existingOrders: DsOrderRow[],
) {
  const duplicateMap = new Map<number, string>();
  const existingByOrderNo = new Map<string, DsOrderRow>();
  const existingByTrackingNo = new Map<string, DsOrderRow>();
  const importedOrderNoMap = new Map<string, number[]>();
  const importedTrackingMap = new Map<string, number[]>();

  existingOrders.forEach((order) => {
    const orderNoKey = String(order.platformOrderNo || "").trim().toLowerCase();
    const trackingKey = String(order.trackingNo || "").trim().toLowerCase();
    if (orderNoKey && !existingByOrderNo.has(orderNoKey)) existingByOrderNo.set(orderNoKey, order);
    if (trackingKey && !existingByTrackingNo.has(trackingKey)) existingByTrackingNo.set(trackingKey, order);
  });

  importedRows.forEach((row, index) => {
    const orderNoKey = String(row.platformOrderNo || "").trim().toLowerCase();
    const trackingKey = String(row.trackingNo || "").trim().toLowerCase();
    if (orderNoKey) importedOrderNoMap.set(orderNoKey, [...(importedOrderNoMap.get(orderNoKey) || []), index]);
    if (trackingKey) importedTrackingMap.set(trackingKey, [...(importedTrackingMap.get(trackingKey) || []), index]);
  });

  importedRows.forEach((row, index) => {
    const errors: string[] = [];
    const orderNoKey = String(row.platformOrderNo || "").trim().toLowerCase();
    const trackingKey = String(row.trackingNo || "").trim().toLowerCase();
    const existingOrderByNo = orderNoKey ? existingByOrderNo.get(orderNoKey) : null;
    const existingOrderByTracking = trackingKey ? existingByTrackingNo.get(trackingKey) : null;
    const importedOrderMatches = orderNoKey ? (importedOrderNoMap.get(orderNoKey) || []).filter((item) => item !== index) : [];
    const importedTrackingMatches = trackingKey ? (importedTrackingMap.get(trackingKey) || []).filter((item) => item !== index) : [];

    if (existingOrderByNo) {
      errors.push(`订单编号重复：${existingOrderByNo.platformOrderNo} / ${existingOrderByNo.customerName} / ${existingOrderByNo.sku}`);
    }
    if (existingOrderByTracking) {
      errors.push(`跟踪号重复：${existingOrderByTracking.trackingNo} / ${existingOrderByTracking.platformOrderNo} / ${existingOrderByTracking.customerName}`);
    }
    if (importedOrderMatches.length > 0) {
      errors.push(`订单编号与导入文件第 ${importedOrderMatches.map((item) => item + 2).join("、")} 行重复`);
    }
    if (importedTrackingMatches.length > 0) {
      errors.push(`跟踪号与导入文件第 ${importedTrackingMatches.map((item) => item + 2).join("、")} 行重复`);
    }

    duplicateMap.set(index, errors.join("；"));
  });

  return duplicateMap;
}

async function parseImportedOrderFile(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!worksheet) {
    throw new Error("import_sheet_missing");
  }

  const headerIndexMap = new Map<string, number>();
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  headerRow.forEach((cellValue, index) => {
    const headerKey = normalizeImportHeader(cellValue);
    if (headerKey) headerIndexMap.set(headerKey, index);
  });

  const platformCol = headerIndexMap.get("平台");
  const orderNoCol = headerIndexMap.get("订单编号");
  const shippedAtCol = headerIndexMap.get("发货时间");
  const platformSkuCol = headerIndexMap.get("商品sku");
  const quantityCol = headerIndexMap.get("产品数量");
  const trackingNoCol = headerIndexMap.get("跟踪号");

  if (
    platformCol === undefined
    || orderNoCol === undefined
    || shippedAtCol === undefined
    || platformSkuCol === undefined
    || quantityCol === undefined
    || trackingNoCol === undefined
  ) {
    throw new Error("import_columns_missing");
  }

  const importedRows: ImportedOrderRow[] = [];
  matrix.slice(1).forEach((row) => {
    const cells = Array.isArray(row) ? row : [];
    const platform = String(cells[platformCol] || "").trim();
    const platformOrderNo = String(cells[orderNoCol] || "").trim();
    const shippedAt = toMexicoDateInputFromChinaDateTime(cells[shippedAtCol]);
    const rawPlatformSku = String(cells[platformSkuCol] || "").trim();
    const sku = extractImportedPlatformSku(rawPlatformSku);
    const quantityValue = Number(String(cells[quantityCol] || "").trim());
    const trackingNo = String(cells[trackingNoCol] || "").trim();

    if (!platformOrderNo && !rawPlatformSku && !trackingNo) return;
    const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? Math.max(1, Math.round(quantityValue)) : 0;

    importedRows.push({
      platform,
      platformOrderNo,
      rawSku: rawPlatformSku,
      sku,
      quantity,
      trackingNo,
      shippedAt,
      shippingFee: "6",
      parseError: buildImportedOrderRowError({
        platform,
        platformOrderNo,
        trackingNo,
        shippedAt,
        sku,
        quantity,
      }),
      duplicateError: "",
    });
  });

  return importedRows;
}

function fmtMoney(value: number, lang: "zh" | "es") {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getFinanceSettlementMode(row: Pick<DsFinanceRow, "settlementCurrencyMode"> | null | undefined): DsSettlementCurrencyMode {
  return normalizeDsSettlementCurrencyMode(row?.settlementCurrencyMode);
}

function convertCnyToMxn(value: number, rateValue: number | null | undefined) {
  return rateValue && Number.isFinite(rateValue) && rateValue > 0 ? value / rateValue : 0;
}

function formatSettlementAmount(
  value: number,
  mode: DsSettlementCurrencyMode,
  lang: "zh" | "es",
) {
  return mode === "MXN" ? `$${fmtMoney(value, lang)}` : `￥${fmtMoney(value, lang)}`;
}

function getSettlementAmountLabels(
  mode: DsSettlementCurrencyMode,
  lang: "zh" | "es",
) {
  if (mode === "MXN") {
    return {
      productSettlement: lang === "zh" ? "商品金额（比索）" : "Productos (MXN)",
      serviceFee: lang === "zh" ? "代发服务费（比索）" : "Servicio (MXN)",
      rawServiceFeeRmb: lang === "zh" ? "代发服务费（人民币）" : "Servicio (RMB)",
      total: lang === "zh" ? "应付总额（比索）" : "Total a pagar (MXN)",
      settlementColumn: lang === "zh" ? "结算金额" : "Monto liquidado",
      totalColumn: lang === "zh" ? "合计" : "Total MXN",
      rateLine:
        lang === "zh"
          ? "结算汇率：1 RMB = {rate} MXN"
          : "Tipo de cambio: 1 RMB = {rate} MXN",
      serviceFeeDisplayPrefix: lang === "zh" ? "代发费：" : "Servicio:",
    };
  }

  return {
    productSettlement: lang === "zh" ? "商品折算（人民币）" : "Convertido (RMB)",
    serviceFee: lang === "zh" ? "代发服务费（人民币）" : "Servicio (RMB)",
    rawServiceFeeRmb: lang === "zh" ? "代发服务费（人民币）" : "Servicio (RMB)",
    total: lang === "zh" ? "应付总额（人民币）" : "Total a pagar (RMB)",
    settlementColumn: lang === "zh" ? "折算" : "RMB",
    totalColumn: lang === "zh" ? "合计" : "Total RMB",
    rateLine:
      lang === "zh"
        ? "结算汇率：1 MXN = {rate} RMB"
        : "Tipo de cambio: 1 MXN = {rate} RMB",
    serviceFeeDisplayPrefix: lang === "zh" ? "代发费：" : "Servicio:",
  };
}

function computeInventoryAmount(unitPrice: string, stockedQty: string, discountRate: string) {
  const qty = Number(stockedQty || 0);
  const price = Number(unitPrice || 0);
  const discount = Number(discountRate || 0);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return "";
  const normalizedDiscount = Math.abs(discount) <= 1 ? discount : discount / 100;
  const safeDiscount = Math.min(Math.max(normalizedDiscount, 0), 1);
  return String(Math.round(price * qty * (1 - safeDiscount) * 100) / 100);
}

function formatDiscountPercentInput(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "";
  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return String(Math.round(percent * 100) / 100);
}

function fmtYuanMoney(value: number, lang: "zh" | "es") {
  return `￥${fmtMoney(value, lang)}`;
}

function fmtDualCurrencyFromCny(value: number, rateValue: number | null | undefined, lang: "zh" | "es") {
  const mxnValue = rateValue && Number.isFinite(rateValue) && rateValue > 0 ? value / rateValue : null;
  return {
    mxnText: mxnValue === null ? "-" : `$ ${fmtMoney(mxnValue, lang)}`,
    cnyText: `￥ ${fmtMoney(value, lang)}`,
  };
}

function fmtPercent(value: number, lang: "zh" | "es") {
  if (!Number.isFinite(value)) return "0";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(normalized);
}

function getInventoryStatusClass(status: DsInventoryStatus) {
  if (status === "healthy") return "text-emerald-600";
  if (status === "empty") return "text-rose-600";
  return "text-amber-500";
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

function triggerBrowserDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function getExcelFontName(value: string, bold = false) {
  if (hasChineseGlyph(value)) {
    return bold ? "Noto Sans SC Bold" : "Noto Sans SC";
  }
  return "Inter";
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadExcelImageSource(url: string | null | undefined) {
  if (!url) return null;
  try {
    const resolvedUrl =
      typeof window !== "undefined" ? new URL(url, window.location.origin).toString() : url;
    const response = await fetch(resolvedUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const mimeType = blob.type.toLowerCase();
    const extension =
      mimeType.includes("png")
        ? "png"
        : mimeType.includes("jpeg") || mimeType.includes("jpg")
          ? "jpeg"
          : null;
    if (!extension) return null;
    const base64 = await blobToDataUrl(blob);
    return { base64, extension: extension as "png" | "jpeg" };
  } catch {
    return null;
  }
}

function shouldShowSaturdaySettlementReminder(date: Date) {
  const { weekday } = getMexicoDateParts(date);
  return weekday === "Sat";
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

function getMexicoWeekSaturdayValue(value: string | null | undefined) {
  const parts = parseDateOnlyParts(String(value || ""));
  if (!parts) return null;
  const referenceDate = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00.000-06:00`);
  const weekStart = startOfMexicoWeekClient(referenceDate);
  return new Date(weekStart.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
}

function getMexicoWeekCycleText(value: string | null | undefined) {
  const parts = parseDateOnlyParts(String(value || ""));
  if (!parts) return "";
  const referenceDate = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00.000-06:00`);
  const weekStart = startOfMexicoWeekClient(referenceDate);
  const weekEnd = new Date(weekStart.getTime() + 5 * 24 * 60 * 60 * 1000);
  const startParts = getMexicoDatePartsMap(weekStart);
  const endParts = getMexicoDatePartsMap(weekEnd);
  return `${startParts.year}/${startParts.month}/${startParts.day} - ${endParts.month}/${endParts.day}`;
}

function normalizeFinanceCycleText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFinanceCycleTextForRow(row: DsFinanceRow) {
  const shippedDates = row.settledOrders
    .map((item) => item.shippedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const unpaidShippedDates = row.settledOrders
    .filter((item) => item.settlementStatus !== "paid")
    .map((item) => item.shippedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const referenceDateValue = unpaidShippedDates[unpaidShippedDates.length - 1] || shippedDates[shippedDates.length - 1] || getMexicoTodayDateValue();
  return getMexicoWeekCycleText(referenceDateValue);
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

function extractDroppedAttachmentFile(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return null;
  const itemFiles = Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  const files = itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files || []);
  return files.find((file) => {
    const mime = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    return mime.startsWith("image/") || mime.includes("pdf") || name.endsWith(".pdf");
  }) || null;
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

function NotebookIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.25 3.75H14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6.25a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z" />
      <path d="M7.5 3.75v12.5" />
      <path d="M10 7.25h3" />
      <path d="M10 10h3" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.75 4.25h10.5a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H4.75a1.5 1.5 0 0 1-1.5-1.5v-8.5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M6.5 7.25h7" />
      <path d="M6.5 10h7" />
      <path d="M6.5 12.75H10" />
      <path d="M13.75 12.75h.01" />
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
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    label: string;
    orderCount: number;
    shippedCount: number;
  } | null>(null);
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
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ds-overview-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fillColor} />
            <stop offset="100%" stopColor="rgba(29, 78, 216, 0)" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingY + innerHeight - innerHeight * ratio;
          return (
            <g key={ratio}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 6" />
            </g>
          );
        })}
        <polygon points={areaPoints} fill="url(#ds-overview-area)" />
        <polyline points={orderPoints} fill="none" stroke={lineColor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={shippedPoints} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 5" />
        {data.map((item, index) => {
          const [xText, yText] = getPoint(index, item.orderCount).split(",");
          const x = Number(xText);
          const y = Number(yText);
          return (
            <g key={item.date}>
              <circle
                cx={x}
                cy={y}
                r="5"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint({ x, y, label: item.label, orderCount: item.orderCount, shippedCount: item.shippedCount })}
                onMouseLeave={() => setHoveredPoint((current) => (current?.label === item.label ? null : current))}
              />
              <circle cx={x} cy={y} r="3.5" fill={lineColor} className="pointer-events-none" />
              <text x={x} y={height - 2} textAnchor="middle" className="fill-slate-400 text-[11px]">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoveredPoint ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${Math.max(2, (hoveredPoint.y / height) * 100 - 16)}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-medium text-slate-900">{hoveredPoint.label}</div>
          <div>订单数: {hoveredPoint.orderCount}</div>
          <div>已发数: {hoveredPoint.shippedCount}</div>
        </div>
      ) : null}
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
  initialLoadedTabs,
}: Props) {
  const [lang, setLang] = useState<"zh" | "es">(initialLang);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [overviewAlertFilter, setOverviewAlertFilter] = useState<DsAlertItem["type"] | null>(null);
  const [overview, setOverview] = useState(initialOverview);
  const [orders, setOrders] = useState(initialOrders);
  const [inventory, setInventory] = useState(initialInventory);
  const [finance, setFinance] = useState(initialFinance);
  const [exchangeRate, setExchangeRate] = useState(initialExchangeRate);
  const [financeStatementLockedRate, setFinanceStatementLockedRate] = useState<DsExchangeRatePayload | null>(null);
  const [loadedTabs, setLoadedTabs] = useState(initialLoadedTabs);
  const [now, setNow] = useState(() => new Date());
  const [overviewRange, setOverviewRange] = useState<OverviewRange>("month");
  const [overviewCustomerFilter, setOverviewCustomerFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [inventoryKeyword, setInventoryKeyword] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [inventoryCustomerFilter, setInventoryCustomerFilter] = useState("all");
  const [inventoryStockFilter, setInventoryStockFilter] = useState<"all" | "stocked" | "unstocked">("all");
  const [inventorySortKey, setInventorySortKey] = useState<"stockedAt" | "shippedAt" | null>(null);
  const [inventorySortDirection, setInventorySortDirection] = useState<"asc" | "desc">("desc");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [shippedAtSortDirection, setShippedAtSortDirection] = useState<"asc" | "desc">("asc");
  const [financeDetailShippedAtSortDirection, setFinanceDetailShippedAtSortDirection] = useState<"asc" | "desc">("asc");
  const [financeDetailShippedAtSortTouched, setFinanceDetailShippedAtSortTouched] = useState(false);
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
  const [draggingAttachmentSlot, setDraggingAttachmentSlot] = useState<string | null>(null);
  const [labelSlotsDirty, setLabelSlotsDirty] = useState(false);
  const [proofSlotsDirty, setProofSlotsDirty] = useState(false);
  const [importing, setImporting] = useState(false);
  const [orderFileImporting, setOrderFileImporting] = useState(false);
  const [orderImportPreviewOpen, setOrderImportPreviewOpen] = useState(false);
  const [orderImportPreviewRows, setOrderImportPreviewRows] = useState<ImportedOrderRow[]>([]);
  const [orderImportPreviewError, setOrderImportPreviewError] = useState("");
  const [orderImportPreviewFileName, setOrderImportPreviewFileName] = useState("");
  const [orderImportPreviewPage, setOrderImportPreviewPage] = useState(1);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importSummary, setImportSummary] = useState<string>("");
  const [error, setError] = useState("");
  const [duplicateAlertMessage, setDuplicateAlertMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [recentSavedInventorySku, setRecentSavedInventorySku] = useState("");
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string; fallbackSources?: string[] } | null>(null);
  const [failedInventoryImages, setFailedInventoryImages] = useState<string[]>([]);
  const [failedFinanceImages, setFailedFinanceImages] = useState<string[]>([]);
  const [inventoryPreview, setInventoryPreview] = useState<InventoryPreviewState>(null);
  const [inventoryShippedPreview, setInventoryShippedPreview] = useState<InventoryShippedPreviewState>(null);
  const [inventoryEdit, setInventoryEdit] = useState<InventoryEditState>(null);
  const [inventoryExport, setInventoryExport] = useState<InventoryExportState>(null);
  const [inventoryCustomers, setInventoryCustomers] = useState<InventoryCustomerOption[]>([]);
  const [inventoryProductQuery, setInventoryProductQuery] = useState("");
  const [inventoryProductOptions, setInventoryProductOptions] = useState<InventoryProductOption[]>([]);
  const [inventoryProductLoading, setInventoryProductLoading] = useState(false);
  const [financePreview, setFinancePreview] = useState<FinancePreviewState>(null);
  const [financeLogTarget, setFinanceLogTarget] = useState<DsFinanceRow | null>(null);
  const [financeLogEntries, setFinanceLogEntries] = useState<FinanceActionLogEntry[]>([]);
  const [financeLogLoading, setFinanceLogLoading] = useState(false);
  const [financeLogError, setFinanceLogError] = useState("");
  const [financeStatementRecordTarget, setFinanceStatementRecordTarget] = useState<DsFinanceRow | null>(null);
  const [financeStatementRecordEntries, setFinanceStatementRecordEntries] = useState<FinanceStatementRecordEntry[]>([]);
  const [financeStatementEntriesByCustomerId, setFinanceStatementEntriesByCustomerId] = useState<Record<string, FinanceStatementRecordEntry[]>>({});
  const [financeStatementRecordLoading, setFinanceStatementRecordLoading] = useState(false);
  const [financeStatementRecordError, setFinanceStatementRecordError] = useState("");
  const [financeStatementPreviewOpen, setFinanceStatementPreviewOpen] = useState(false);
  const [financeStatementPreviewStandalone, setFinanceStatementPreviewStandalone] = useState(false);
  const [financeStatementPreviewRecord, setFinanceStatementPreviewRecord] = useState<FinanceStatementRecordEntry | null>(null);
  const [financeStatementVipEnabled, setFinanceStatementVipEnabled] = useState(false);
  const [financeStatementLockState, setFinanceStatementLockState] = useState<FinanceStatementLockState>(null);
  const [financeSelectionState, setFinanceSelectionState] = useState<FinanceSelectionState>({
    excludedOrderIds: [],
    includedOrderIds: [],
    reincludedOrderIds: [],
  });
  const [financeStatementLockLoading, setFinanceStatementLockLoading] = useState(false);
  const [financeStatementActionLoading, setFinanceStatementActionLoading] = useState<"" | "generate" | "revoke" | "export" | "confirm_paid">("");
  const [financeStatementActionError, setFinanceStatementActionError] = useState("");
  const [financeSettlementSavingCustomerId, setFinanceSettlementSavingCustomerId] = useState("");
  const [financeStatementRevokeState, setFinanceStatementRevokeState] = useState<FinanceStatementRevokeState>(null);
  const [selectedFinanceOrderIds, setSelectedFinanceOrderIds] = useState<string[]>([]);
  const [financePreviewPage, setFinancePreviewPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DeleteOrderState>(null);
  const [deleteTrackingInput, setDeleteTrackingInput] = useState("");
  const [inventoryDeleteTarget, setInventoryDeleteTarget] = useState<InventoryDeleteTargetState>(null);
  const orderImportInputRef = useRef<HTMLInputElement | null>(null);
  const financePreviewScrollRef = useRef<HTMLDivElement | null>(null);
  const labelInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const proofInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const financePreviewPageSize = 10;
  const inventoryPageSize = 11;
  const orderPageSize = 10;
  const orderImportPreviewPageSize = 8;

  const overviewCustomerOptions = useMemo(() => {
    const customerMap = new Map<string, string>();
    for (const row of orders) {
      if (!row.customerId || !row.customerName) continue;
      customerMap.set(row.customerId, row.customerName);
    }
    return [{ id: "all", name: lang === "zh" ? "全部客户" : "Todos los clientes" }, ...Array.from(customerMap.entries()).map(([id, name]) => ({ id, name }))];
  }, [lang, orders]);

  const overviewRangeLabel = useMemo(() => {
    const rangeStart =
      overviewRange === "day"
        ? startOfMexicoDayClient(now)
        : overviewRange === "week"
          ? startOfMexicoWeekClient(now)
          : overviewRange === "year"
            ? startOfMexicoYearClient(now)
            : startOfMexicoMonthClient(now);
    const rangeEndExclusive =
      overviewRange === "day"
        ? endOfMexicoDayClient(rangeStart)
        : overviewRange === "week"
          ? new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000)
          : overviewRange === "year"
            ? new Date(rangeStart.getUTCFullYear() + 1, 0, 1, 6, 0, 0, 0)
            : new Date(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + 1, 1, 6, 0, 0, 0);

    if (lang === "zh") {
      const extractDigits = (value: string) => value.replace(/[^\d]/g, "");
      const year = extractDigits(new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Mexico_City", year: "numeric" }).format(rangeStart));
      const month = extractDigits(new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Mexico_City", month: "numeric" }).format(rangeStart));
      const day = extractDigits(new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Mexico_City", day: "numeric" }).format(rangeStart));
      if (overviewRange === "day") return `${month}月${day}日`;
      if (overviewRange === "month") return `${year}/${month}`;
      if (overviewRange === "year") return year;
      const weekEnd = new Date(rangeEndExclusive.getTime() - 24 * 60 * 60 * 1000);
      const startMonth = extractDigits(new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Mexico_City", month: "numeric" }).format(rangeStart));
      const startDay = extractDigits(new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Mexico_City", day: "numeric" }).format(rangeStart));
      const endMonth = extractDigits(new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Mexico_City", month: "numeric" }).format(weekEnd));
      const endDay = extractDigits(new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Mexico_City", day: "numeric" }).format(weekEnd));
      return `${startMonth}/${startDay}-${endMonth}/${endDay}`;
    }

    if (overviewRange === "day") return fmtDateOnly(rangeStart.toISOString(), lang);
    if (overviewRange === "month") return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", year: "numeric", month: "long" }).format(rangeStart);
    if (overviewRange === "year") return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", year: "numeric" }).format(rangeStart);
    const weekEnd = new Date(rangeEndExclusive.getTime() - 24 * 60 * 60 * 1000);
    return `${fmtDateOnly(rangeStart.toISOString(), lang)} - ${fmtDateOnly(weekEnd.toISOString(), lang)}`;
  }, [lang, now, overviewRange]);

  useEffect(() => {
    setLang(getClientLang());
  }, []);

  useEffect(() => {
    if ((activeTab !== "finance" && activeTab !== "overview") || finance.length === 0) return;
    const missingCustomerIds = finance
      .map((row) => row.customerId)
      .filter((customerId) => !financeStatementEntriesByCustomerId[customerId]);
    if (missingCustomerIds.length === 0) return;

    let cancelled = false;
    void Promise.allSettled(
      missingCustomerIds.map(async (customerId) => {
        try {
          const entries = await fetchFinanceStatementEntries(customerId);
          return [customerId, entries] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const nextEntries: Record<string, FinanceStatementRecordEntry[]> = {};
      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) continue;
        const [customerId, entries] = result.value;
        nextEntries[customerId] = entries;
      }
      if (Object.keys(nextEntries).length === 0) return;
      setFinanceStatementEntriesByCustomerId((prev) => ({ ...prev, ...nextEntries }));
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, finance, financeStatementEntriesByCustomerId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventoryCustomerFilter, inventoryKeyword]);

  useEffect(() => {
    if (!success && !recentSavedInventorySku) return;
    const timer = window.setTimeout(() => {
      setSuccess("");
      setRecentSavedInventorySku("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [recentSavedInventorySku, success]);

  useEffect(() => {
    if (!inventoryEdit || inventoryEdit.mode !== "create") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setInventoryProductLoading(true);
        const keyword = extractInventoryProductKeyword(inventoryProductQuery);
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
    if (!inventoryEdit || inventoryEdit.mode !== "create") return;
    const keyword = extractInventoryProductKeyword(inventoryProductQuery);
    if (!keyword) return;

    const normalizedKeyword = normalizeProductCode(keyword).toLowerCase();
    if (!normalizedKeyword) return;

    const exactMatch = inventoryProductOptions.find(
      (option) => normalizeProductCode(option.sku).toLowerCase() === normalizedKeyword,
    );
    const uniquePrefixMatch = exactMatch
      || (inventoryProductOptions.length > 0
        ? inventoryProductOptions.filter((option) =>
            normalizeProductCode(option.sku).toLowerCase().startsWith(normalizedKeyword),
          )[0]
        : undefined);

    if (!uniquePrefixMatch) return;

    const prefixMatches = inventoryProductOptions.filter((option) =>
      normalizeProductCode(option.sku).toLowerCase().startsWith(normalizedKeyword),
    );

    if (!exactMatch && prefixMatches.length !== 1) return;
    if (inventoryEdit.productCatalogId === uniquePrefixMatch.id) return;

    pickInventoryProduct(uniquePrefixMatch);
    setInventoryProductOptions([]);
  }, [inventoryEdit, inventoryProductOptions, inventoryProductQuery]);

  useEffect(() => {
    setFinancePreviewPage(1);
    setSelectedFinanceOrderIds([]);
    setFinanceStatementActionError("");
    setFinanceStatementRevokeState(null);
    if (!financePreview) {
      setFinanceStatementLockState(null);
      setFinanceStatementPreviewRecord(null);
      setFinanceSelectionState({ excludedOrderIds: [], includedOrderIds: [], reincludedOrderIds: [] });
      setFinanceStatementPreviewOpen(false);
    }
  }, [financePreview]);

  useEffect(() => {
    if (!modalOpen) return;
    const rawSku = form.sku.trim();
    if (!rawSku) return;

    const normalizedSku = normalizeProductCode(rawSku);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/dropshipping/product-search?keyword=${encodeURIComponent(rawSku)}`, {
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json?.ok || !Array.isArray(json.items)) return;
        const match =
          json.items.find((item: Record<string, unknown>) => normalizeProductCode(String(item.sku || "")) === normalizedSku)
          || json.items.find((item: Record<string, unknown>) => normalizeProductCode(String(item.sku || "")).includes(normalizedSku))
          || json.items[0];
        if (!match) return;

        setForm((prev) => {
          if (normalizeProductCode(prev.sku) !== normalizedSku) return prev;
          return {
            ...prev,
            sku: String(match.sku || prev.sku).trim(),
            productNameZh: String(match.nameZh || prev.productNameZh || prev.sku).trim(),
            productNameEs: String(match.nameEs || prev.productNameEs || "").trim(),
            color: prev.color.trim() || (lang === "zh" ? "随机" : "Aleatorio"),
          };
        });
      } catch (lookupError) {
        if ((lookupError as Error).name !== "AbortError") {
          console.error("[DropshippingClient] sku auto match failed", lookupError);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [form.id, form.sku, lang, modalOpen]);

  const handleOrderSkuChange = (value: string) => {
    const nextSku = value;
    const normalizedNextSku = normalizeProductCode(nextSku);

    setProductFieldsLocked(false);
    setForm((prev) => {
      const normalizedPrevSku = normalizeProductCode(prev.sku);
      const shouldResetMatchedProduct =
        !nextSku.trim() ||
        (normalizedPrevSku !== "" && normalizedNextSku !== normalizedPrevSku);

      return {
        ...prev,
        sku: nextSku,
        productNameZh: shouldResetMatchedProduct ? "" : prev.productNameZh,
        productNameEs: shouldResetMatchedProduct ? "" : prev.productNameEs,
      };
    });
  };

  useEffect(() => {
    financePreviewScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [financePreviewPage]);

  useEffect(() => {
    if (!financePreview || !financeStatementPreviewOpen) return;
    window.requestAnimationFrame(() => {
      financePreviewScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [financePreview, financeStatementPreviewOpen]);

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
              sourceId: row.inventoryId || row.orderId,
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
        importOrders: "导入订单文件",
        import: "历史迁移导入",
        tabs: { overview: "总览", orders: "订单管理", inventory: "已发商品", finance: "财务结算" },
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
          inventory: "已发商品列表",
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
          stockedAt: "备货时间",
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
          low_inventory: "库存告警 SKU",
          missing_stock_record: "无备货记录 SKU",
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
        importOrders: "Importar archivo",
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
          stockedAt: "Fecha stock",
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
          low_inventory: "SKU con alerta de stock",
          missing_stock_record: "SKU sin registro de stock",
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

  async function refreshData(
    sections: Array<"overview" | "orders" | "inventory" | "finance" | "rate"> = [
      "overview",
      "orders",
      "inventory",
      "finance",
      "rate",
    ],
  ) {
    try {
      setError("");
      const uniqueSections = Array.from(new Set(sections));
      await Promise.all(
        uniqueSections.map(async (section) => {
          const endpoint =
            section === "overview"
              ? "/api/dropshipping/overview"
              : section === "orders"
                ? "/api/dropshipping/orders"
                : section === "inventory"
                  ? "/api/dropshipping/inventory"
                  : section === "finance"
                    ? "/api/dropshipping/finance"
                    : "/api/dropshipping/exchange-rate";

          const response = await fetch(endpoint);
          const json = await response.json();
          if (!response.ok || !json?.ok) {
            throw new Error(json?.error || section);
          }

          if (section === "overview") {
            setOverview(json.data);
          } else if (section === "orders") {
            setOrders(json.items || []);
          } else if (section === "inventory") {
            setInventory(json.items || []);
            setInventoryCustomers(json.customers || []);
          } else if (section === "finance") {
            setFinance(json.items || []);
          } else {
            setExchangeRate(json.item);
          }
        }),
      );
      setLoadedTabs((prev) => {
        const next = { ...prev };
        for (const section of uniqueSections) {
          next[section] = true;
        }
        return next;
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Load failed");
    }
  }

  useEffect(() => {
    if (activeTab === "overview") {
      const missing: Array<"overview" | "orders" | "rate" | "finance" | "inventory"> = [];
      if (!loadedTabs.overview) missing.push("overview");
      if (!loadedTabs.orders) missing.push("orders");
      if (!loadedTabs.rate) missing.push("rate");
      if (!loadedTabs.finance) missing.push("finance");
      if (!loadedTabs.inventory) missing.push("inventory");
      if (missing.length > 0) {
        void refreshData(missing);
      }
      return;
    }

    if (activeTab === "orders" && !loadedTabs.orders) {
      void refreshData(["orders"]);
      return;
    }

    if (activeTab === "inventory" && !loadedTabs.inventory) {
      void refreshData(["inventory"]);
      return;
    }

    if (activeTab === "finance") {
      const missing: Array<"finance" | "rate" | "inventory"> = [];
      if (!loadedTabs.finance) missing.push("finance");
      if (!loadedTabs.rate) missing.push("rate");
      if (!loadedTabs.inventory) missing.push("inventory");
      if (missing.length > 0) {
        void refreshData(missing);
      }
    }
  }, [activeTab, loadedTabs]);

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
      const alertHit =
        !overviewAlertFilter
        || (overviewAlertFilter === "pending_order" && row.shippingStatus === "pending")
        || (overviewAlertFilter === "missing_shipping_proof" && row.warnings.includes("missing_shipping_proof"));
      return customerHit && hit && statusHit && settlementHit && alertHit;
    });
  }, [customerFilter, keyword, orders, overviewAlertFilter, settlementFilter, statusFilter]);

  const filteredOrderCount = useMemo(() => {
    const seen = new Set<string>();
    for (const row of filteredOrders) {
      const trackingNo = row.trackingNo.trim().toLowerCase();
      seen.add(trackingNo || row.id);
    }
    return seen.size;
  }, [filteredOrders]);

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

  const orderImportPreviewTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(orderImportPreviewRows.length / orderImportPreviewPageSize));
  }, [orderImportPreviewRows.length, orderImportPreviewPageSize]);

  const pagedOrderImportPreviewRows = useMemo(() => {
    const start = (orderImportPreviewPage - 1) * orderImportPreviewPageSize;
    return orderImportPreviewRows.slice(start, start + orderImportPreviewPageSize);
  }, [orderImportPreviewPage, orderImportPreviewPageSize, orderImportPreviewRows]);

  const filteredInventory = useMemo(() => {
    const normalized = inventoryKeyword.trim().toLowerCase();
    const rows = inventory.filter((row) => {
      const customerHit = inventoryCustomerFilter === "all" || row.customerName === inventoryCustomerFilter;
      const stockHit =
        inventoryStockFilter === "all"
        || (inventoryStockFilter === "stocked" && row.isStocked)
        || (inventoryStockFilter === "unstocked" && !row.isStocked);
      const keywordHit =
        !normalized ||
        [row.customerName, row.sku, row.productNameZh, row.productNameEs]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
        const alertHit =
          !overviewAlertFilter
          || (overviewAlertFilter === "low_inventory" && row.isStocked && row.status !== "healthy")
          || (overviewAlertFilter === "missing_stock_record" && !row.isStocked);
        return customerHit && stockHit && keywordHit && alertHit;
      });

    if (!inventorySortKey) return rows;

    return [...rows].sort((a, b) => {
      const aValue = inventorySortKey === "stockedAt" ? a.stockedAt : a.shippedAt;
      const bValue = inventorySortKey === "stockedAt" ? b.stockedAt : b.shippedAt;
      const aTime = aValue ? new Date(aValue).getTime() : Number.POSITIVE_INFINITY;
      const bTime = bValue ? new Date(bValue).getTime() : Number.POSITIVE_INFINITY;

      if (aTime === bTime) {
        return a.sku.localeCompare(b.sku, "en");
      }
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return inventorySortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [inventory, inventoryCustomerFilter, inventoryKeyword, inventorySortDirection, inventorySortKey, inventoryStockFilter, overviewAlertFilter]);

  const filteredFinance = useMemo(() => {
    return finance.filter((row) => {
      if (overviewAlertFilter !== "customer_unsettled") return true;
      return row.unpaidAmount > 0.0001;
    });
  }, [finance, overviewAlertFilter]);

  const inventoryKeywordStockSummary = useMemo(() => {
    const normalized = inventoryKeyword.trim().toLowerCase();
    if (!normalized) return null;

    const matchedRows = inventory.filter((row) => {
      const customerHit =
        inventoryCustomerFilter === "all" || row.customerName === inventoryCustomerFilter;
      return customerHit && row.sku.toLowerCase().includes(normalized);
    });

    if (matchedRows.length === 0) return null;

    const stockedQty = matchedRows.reduce((sum, row) => {
      if (!row.isStocked) return sum;
      return sum + Math.max(row.stockedQty, 0);
    }, 0);

    if (stockedQty > 0) {
      return {
        text:
          lang === "zh"
            ? `备货：${stockedQty}个`
            : `Stock: ${stockedQty}`,
        className: "text-emerald-600",
      };
    }

    return {
      text: lang === "zh" ? "无备货" : "Sin stock",
      className: "text-rose-600",
    };
  }, [inventory, inventoryCustomerFilter, inventoryKeyword, lang]);

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

  const orderTotalPages = Math.max(1, Math.ceil(visibleSortedOrders.length / orderPageSize));
  const orderCurrentPage = Math.min(orderPage, orderTotalPages);
  const pagedVisibleOrders = visibleSortedOrders.slice(
    (orderCurrentPage - 1) * orderPageSize,
    orderCurrentPage * orderPageSize,
  );

  function handleOverviewAlertClick(type: DsAlertItem["type"]) {
    setOverviewAlertFilter(type);
    if (type === "pending_order" || type === "missing_shipping_proof") {
      setActiveTab("orders");
      setOrderPage(1);
      setKeyword("");
      setCustomerFilter("all");
      setSettlementFilter("all");
      setStatusFilter(type === "pending_order" ? "pending" : "shipped");
      return;
    }
    if (type === "low_inventory" || type === "missing_stock_record") {
      setActiveTab("inventory");
      setInventoryPage(1);
      setInventoryKeyword("");
      setInventoryCustomerFilter("all");
      setInventoryStockFilter("all");
      return;
    }
    if (type === "customer_unsettled") {
      setActiveTab("finance");
    }
  }

  useEffect(() => {
    setOrderPage(1);
  }, [keyword, customerFilter, statusFilter, settlementFilter, shippedAtSortDirection]);

  useEffect(() => {
    setOrderPage((prev) => Math.min(prev, orderTotalPages));
  }, [orderTotalPages]);

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

  function clearAttachmentSlot(type: "label" | "proof", slotIndex: number) {
    if (type === "label") {
      setLabelSlots((prev) => {
        const next = [...prev];
        const current = next[slotIndex];
        if (current?.kind === "new" && current.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }
        next[slotIndex] = { kind: "empty" };
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
      next[slotIndex] = { kind: "empty" };
      return next;
    });
    setProofSlotsDirty(true);
  }

  function handleAttachmentDragOver(event: DragEvent<HTMLDivElement>, type: "label" | "proof", slotIndex: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDraggingAttachmentSlot(`${type}-${slotIndex}`);
  }

  function handleAttachmentDragLeave(type: "label" | "proof", slotIndex: number) {
    setDraggingAttachmentSlot((prev) => (prev === `${type}-${slotIndex}` ? null : prev));
  }

  function handleAttachmentDrop(event: DragEvent<HTMLDivElement>, type: "label" | "proof", slotIndex: number) {
    event.preventDefault();
    setDraggingAttachmentSlot(null);
    const file = extractDroppedAttachmentFile(event.dataTransfer);
    if (!file) return;
    updateAttachmentSlot(type, slotIndex, file);
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
      && (
        inventoryShippedPreview.mode === "related"
        || (inventoryShippedPreview.trackingNo && row.trackingNo.trim() === inventoryShippedPreview.trackingNo.trim())
        || row.id === inventoryShippedPreview.orderId
      )
      && row.shippingStatus === "shipped",
    );
  }, [inventoryShippedPreview, orders]);

  const shippedQtyForInventoryPreview = useMemo(
    () => shippedOrdersForInventoryPreview.reduce((sum, row) => sum + row.quantity, 0),
    [shippedOrdersForInventoryPreview],
  );

  const financePreviewSettlementWeek = useMemo(() => {
    if (!financePreview) return null;
    const shippedDates = financePreview.settledOrders
      .map((item) => item.shippedAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const unpaidShippedDates = financePreview.settledOrders
      .filter((item) => item.settlementStatus !== "paid")
      .map((item) => item.shippedAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const referenceDateValue =
      unpaidShippedDates[unpaidShippedDates.length - 1]
      || shippedDates[shippedDates.length - 1]
      || getMexicoTodayDateValue();
    const referenceParts = parseDateOnlyParts(referenceDateValue);
    const referenceDate = referenceParts
      ? new Date(`${referenceParts.year}-${referenceParts.month}-${referenceParts.day}T12:00:00.000-06:00`)
      : now;
    const weekStart = startOfMexicoWeekClient(referenceDate);
    const weekEnd = new Date(weekStart.getTime() + 5 * 24 * 60 * 60 * 1000);
    return {
      weekStart,
      weekEnd,
      weekStartKey: toDateInputValue(weekStart.toISOString()),
      weekEndKey: toDateInputValue(weekEnd.toISOString()),
    };
  }, [financePreview, now]);
  const financePreviewWeekOrders = useMemo(() => {
    if (!financePreview || !financePreviewSettlementWeek) return [];
    const { weekStartKey, weekEndKey } = financePreviewSettlementWeek;
    return financePreview.settledOrders.filter((item) => {
      const shippedKey = toDateInputValue(item.shippedAt);
      return Boolean(shippedKey) && shippedKey >= weekStartKey && shippedKey <= weekEndKey;
    });
  }, [financePreview, financePreviewSettlementWeek]);
  const financeSelectionExcludedIdSet = useMemo(
    () => new Set(financeSelectionState.excludedOrderIds),
    [financeSelectionState.excludedOrderIds],
  );
  const financeSelectionIncludedIdSet = useMemo(
    () => new Set(financeSelectionState.includedOrderIds),
    [financeSelectionState.includedOrderIds],
  );
  const financeSelectionReincludedIdSet = useMemo(
    () => new Set(financeSelectionState.reincludedOrderIds),
    [financeSelectionState.reincludedOrderIds],
  );
  const financePreviewDetailOrders = useMemo(() => {
    return financePreview?.settledOrders || [];
  }, [financePreview]);
  const financePreviewWeekUnpaidIdSet = useMemo(
    () =>
      new Set(
        financePreviewWeekOrders
          .filter((item) => item.settlementStatus !== "paid")
          .map((item) => item.orderId),
      ),
    [financePreviewWeekOrders],
  );
  const financePreviewTotalPages = financePreview
    ? Math.max(1, Math.ceil(financePreviewDetailOrders.length / financePreviewPageSize))
    : 1;
  const financePreviewCurrentPage = Math.min(financePreviewPage, financePreviewTotalPages);
  const prepareFinanceOrders = (sourceOrders: DsFinanceRow["settledOrders"]) => {
    const seenTracking = new Set<string>();
    return sourceOrders.map((item) => {
      const trackingKey = String(item.trackingNo || "").trim().toLowerCase() || `order:${item.orderId}`;
      const shouldCountShipping = !seenTracking.has(trackingKey);
      if (shouldCountShipping) {
        seenTracking.add(trackingKey);
      }
      const shippingFee = shouldCountShipping ? item.shippingFee : 0;
      return {
        ...item,
        shippingFee,
        cnyTotalAmount: item.productAmount + shippingFee,
      };
    });
  };
  const financePreviewPreparedOrders = useMemo(
    () => prepareFinanceOrders(financePreviewDetailOrders),
    [financePreviewDetailOrders],
  );
  const financePreviewSortedOrders = useMemo(() => {
    return [...financePreviewPreparedOrders].sort((a, b) => {
      if (!financeDetailShippedAtSortTouched) {
        const aIsCurrentWeekUnpaid =
          a.settlementStatus !== "paid" && financePreviewWeekUnpaidIdSet.has(a.orderId);
        const bIsCurrentWeekUnpaid =
          b.settlementStatus !== "paid" && financePreviewWeekUnpaidIdSet.has(b.orderId);
        if (aIsCurrentWeekUnpaid !== bIsCurrentWeekUnpaid) {
          return aIsCurrentWeekUnpaid ? -1 : 1;
        }
      }
      const aTime = a.shippedAt ? new Date(a.shippedAt).getTime() : 0;
      const bTime = b.shippedAt ? new Date(b.shippedAt).getTime() : 0;
      return financeDetailShippedAtSortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [
    financeDetailShippedAtSortTouched,
    financeDetailShippedAtSortDirection,
    financePreviewPreparedOrders,
    financePreviewWeekUnpaidIdSet,
  ]);
  const financePreviewAllPreparedOrders = useMemo(
    () => prepareFinanceOrders(financePreview?.settledOrders || []),
    [financePreview?.settledOrders],
  );
  const financeDefaultSelectedOrderIds = useMemo(() => {
    return financePreviewSortedOrders
      .filter((item) => {
        if (item.settlementStatus === "paid") return false;
        if (financePreviewWeekUnpaidIdSet.has(item.orderId)) {
          return !financeSelectionExcludedIdSet.has(item.orderId);
        }
        return financeSelectionIncludedIdSet.has(item.orderId);
      })
      .map((item) => item.orderId);
  }, [
    financePreviewSortedOrders,
    financePreviewWeekUnpaidIdSet,
    financeSelectionExcludedIdSet,
    financeSelectionIncludedIdSet,
  ]);
  const financePreviewVisibleOrders = financePreviewSortedOrders.slice(
    (financePreviewCurrentPage - 1) * financePreviewPageSize,
    financePreviewCurrentPage * financePreviewPageSize,
  );
  const financePreviewSelectableVisibleOrders = financePreviewVisibleOrders.filter((item) => item.settlementStatus !== "paid");
  const financeSelectionLocked = Boolean(financeStatementLockState?.isGenerated);
  const areAllVisibleFinanceOrdersSelected =
    financePreviewSelectableVisibleOrders.length > 0 &&
    financePreviewSelectableVisibleOrders.every((item) => selectedFinanceOrderIds.includes(item.orderId));
  const financePaidCycleTextSet = useMemo(() => {
    return collectPaidFinanceCycleTextSet(financeStatementRecordEntries, {
      includeCurrentPaidCycle: Boolean(financeStatementLockState?.isPaid),
      currentCycleText: financeStatementPreviewRecord?.cycleText,
    });
  }, [financeStatementLockState?.isPaid, financeStatementPreviewRecord?.cycleText, financeStatementRecordEntries]);
  const financeStatementLockedDateValue =
    getDatePartFromDateTimeText(financeStatementPreviewRecord?.generatedAtText)
    || getDatePartFromDateTimeText(financeStatementLockState?.generatedAtText)
    || (financeStatementLockState?.isGenerated ? getDatePartFromDateTimeText(financeStatementLockState?.createdAtText) : "")
    || "";
  const financeStatementDisplayDateValue = financeStatementLockedDateValue || getMexicoTodayDateValue();
  const financeStatementDisplayRate = financeStatementLockState?.isGenerated && financeStatementLockedRate
    ? financeStatementLockedRate
    : exchangeRate;
  const financeStatementRateValue = financeStatementDisplayRate.rateValue || 0;
  const financeStatementPreparedData = useMemo(
    () => buildFinanceStatementData(inventory, "weekly_unpaid", financePaidCycleTextSet, financeStatementVipEnabled),
    [financePaidCycleTextSet, financePreview, financePreviewPreparedOrders, inventory, selectedFinanceOrderIds, financeSelectionReincludedIdSet, financeStatementRateValue, financeStatementVipEnabled],
  );
  const financeStatementMode = financeStatementPreparedData?.settlementMode || getFinanceSettlementMode(financePreview);
  const financeStatementLabels = getSettlementAmountLabels(financeStatementMode, lang);
  const financeExportSummaryByCustomerId = useMemo(
    () =>
      new Map(
        finance.map((row) => {
          const cachedEntries = financeStatementEntriesByCustomerId[row.customerId] || [];
          const paidCycleTextSet = collectPaidFinanceCycleTextSet(cachedEntries, {
            includeCurrentPaidCycle:
              financeStatementLockState?.isPaid === true
              && financePreview?.customerId === row.customerId,
            currentCycleText:
              financePreview?.customerId === row.customerId
                ? financeStatementPreviewRecord?.cycleText
                : null,
          });
          return [
            row.customerId,
            buildFinanceCustomerExportSummary(
              row,
              inventory,
              paidCycleTextSet,
              exchangeRate.rateValue || row.exchangeRate,
            ),
          ];
        }),
      ),
    [exchangeRate.rateValue, finance, financePreview?.customerId, financeStatementEntriesByCustomerId, financeStatementLockState?.isPaid, financeStatementPreviewRecord?.cycleText, inventory],
  );
  const financeStatementSummary = useMemo(() => {
    if (!financePreview) return null;
    const minShippedAt = financePreviewSettlementWeek?.weekStart.toISOString() || now.toISOString();
    const maxShippedAt = financePreviewSettlementWeek?.weekEnd.toISOString() || now.toISOString();
    const todayParts = getMexicoDatePartsMap(new Date());
    const statementNumber = `BS-${todayParts.year}${todayParts.month}${todayParts.day}`;

    return {
      mxnSubtotal: financeStatementPreparedData?.mxnSubtotal || 0,
      cnySubtotal: financeStatementPreparedData?.cnySubtotal || 0,
      serviceFeeTotal: financeStatementPreparedData?.serviceFeeTotal || 0,
      rawServiceFeeTotal: financeStatementPreparedData?.rawServiceFeeTotal || 0,
      payableTotal: financeStatementPreparedData?.payableTotal || 0,
      minShippedAt,
      maxShippedAt,
      statementNumber,
      hasUnpaid: financeStatementPreparedData?.hasUnpaid ?? false,
      orderCount: financeStatementPreparedData?.orderCount || 0,
      serviceFeePerOrder: financeStatementPreparedData?.serviceFeePerOrder || 0,
    };
  }, [financePreview, financePreviewSettlementWeek, financeStatementPreparedData, now]);

  const financeStatementCycleText = useMemo(() => {
    if (!financeStatementSummary) return "";
    const start = parseDateOnlyParts(financeStatementSummary.minShippedAt || "");
    const end = parseDateOnlyParts(financeStatementSummary.maxShippedAt || "");
    if (!start || !end) return "";
    return `${start.year}/${start.month}/${start.day} - ${end.month}/${end.day}`;
  }, [financeStatementSummary]);
  const financeCurrentStatementNumber = financeStatementPreviewRecord?.statementNumber || financeStatementSummary?.statementNumber || "";
  const financeCurrentCycleText = financeStatementPreviewRecord?.cycleText || financeStatementCycleText;
  const financeStatementIsPaid = Boolean(financeStatementLockState?.isPaid);
  const financeStatementHasUnpaid = financeStatementIsPaid ? false : Boolean(financeStatementSummary?.hasUnpaid);

  useEffect(() => {
    if (!financeStatementLockState?.isGenerated || !financeStatementDisplayDateValue) {
      setFinanceStatementLockedRate(null);
      return;
    }
    let cancelled = false;
    const loadLockedRate = async () => {
      try {
        const response = await fetch(`/api/dropshipping/exchange-rate?date=${encodeURIComponent(financeStatementDisplayDateValue)}`);
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok || !result?.item) {
          throw new Error(result?.error || "failed_to_load_locked_rate");
        }
        if (!cancelled) {
          setFinanceStatementLockedRate(result.item as DsExchangeRatePayload);
        }
      } catch {
        if (!cancelled) {
          setFinanceStatementLockedRate(null);
        }
      }
    };
    void loadLockedRate();
    return () => {
      cancelled = true;
    };
  }, [financeStatementLockState?.isGenerated, financeStatementDisplayDateValue]);

  useEffect(() => {
    if (!financePreview || !financeCurrentStatementNumber) {
      setFinanceStatementLockState(null);
      return;
    }
    let cancelled = false;
    const loadFinanceStatementState = async () => {
      setFinanceStatementLockLoading(true);
      try {
        const response = await fetch(
          `/api/dropshipping/finance/${encodeURIComponent(financePreview.customerId)}/logs?statementNumber=${encodeURIComponent(financeCurrentStatementNumber)}`,
        );
        const result = await response.json();
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || (lang === "zh" ? "获取账单状态失败" : "No se pudo cargar el estado"));
        }
        if (!cancelled) {
          setFinanceSelectionState(result.selectionState || {
            excludedOrderIds: [],
            includedOrderIds: [],
            reincludedOrderIds: [],
          });
          setFinanceStatementLockState(result.statementState || {
            statementNumber: financeCurrentStatementNumber,
            isGenerated: false,
            isPaid: false,
            actionText: "",
            createdAtText: "",
            operatorName: "",
            noteText: "",
          });
        }
      } catch (stateError) {
        if (!cancelled) {
          setFinanceSelectionState({ excludedOrderIds: [], includedOrderIds: [], reincludedOrderIds: [] });
          setFinanceStatementLockState({
            statementNumber: financeCurrentStatementNumber,
            isGenerated: false,
            isPaid: false,
            actionText: "",
            createdAtText: "",
            operatorName: "",
            noteText: "",
          });
          setFinanceStatementActionError(stateError instanceof Error ? stateError.message : (lang === "zh" ? "获取账单状态失败" : "No se pudo cargar el estado"));
        }
      } finally {
        if (!cancelled) setFinanceStatementLockLoading(false);
      }
    };
    void loadFinanceStatementState();
    return () => {
      cancelled = true;
    };
  }, [financePreview, financeCurrentStatementNumber, lang]);

  useEffect(() => {
    if (financeStatementPreviewOpen) {
      setFinanceStatementVipEnabled(false);
    }
  }, [financeStatementPreviewOpen, financeCurrentStatementNumber]);

  useEffect(() => {
    if (!financePreview) {
      setSelectedFinanceOrderIds([]);
      return;
    }
    setSelectedFinanceOrderIds((prev) => {
      if (
        prev.length === financeDefaultSelectedOrderIds.length
        && prev.every((value, index) => value === financeDefaultSelectedOrderIds[index])
      ) {
        return prev;
      }
      return financeDefaultSelectedOrderIds;
    });
  }, [financePreview, financeDefaultSelectedOrderIds]);

  const recordFinanceAction = async (
    row: DsFinanceRow,
    actionType:
      | "view_detail"
      | "statement_preview"
      | "export_all"
      | "generate_statement"
      | "revoke_statement"
      | "confirm_statement_paid"
      | "export_weekly_statement"
      | "exclude_weekly_order"
      | "include_weekly_order",
    options?: {
      statementNumber?: string;
      cycleText?: string;
      note?: string;
      orderId?: string;
      orderNo?: string;
    },
  ) => {
    try {
      const response = await fetch(`/api/dropshipping/finance/${encodeURIComponent(row.customerId)}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          customerName: row.customerName,
          statementNumber: options?.statementNumber || "",
          cycleText: options?.cycleText || "",
          note: options?.note || "",
          orderId: options?.orderId || "",
          orderNo: options?.orderNo || "",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || (lang === "zh" ? "账单动作记录失败" : "No se pudo registrar la accion"));
      }
    } catch {
      // Keep customer-settlement interactions responsive even when logging fails.
    }
  };

  const loadFinanceActionLogs = async (row: DsFinanceRow) => {
    setFinanceLogTarget(row);
    setFinanceLogLoading(true);
    setFinanceLogError("");
    try {
      const response = await fetch(`/api/dropshipping/finance/${encodeURIComponent(row.customerId)}/logs`);
      const result = await response.json();
      if (!response.ok || !result?.ok || !Array.isArray(result.entries)) {
        throw new Error(result?.error || (lang === "zh" ? "获取账单动作记录失败" : "No se pudo cargar el historial"));
      }
      setFinanceLogEntries(result.entries);
    } catch (fetchError) {
      setFinanceLogEntries([]);
      setFinanceLogError(fetchError instanceof Error ? fetchError.message : (lang === "zh" ? "获取账单动作记录失败" : "No se pudo cargar el historial"));
    } finally {
      setFinanceLogLoading(false);
    }
  };

  const fetchFinanceStatementEntries = async (customerId: string) => {
    const response = await fetch(`/api/dropshipping/finance/${encodeURIComponent(customerId)}/logs`);
    const result = await response.json();
    if (!response.ok || !result?.ok || !Array.isArray(result.statementEntries)) {
      throw new Error(result?.error || (lang === "zh" ? "获取账单记录失败" : "No se pudo cargar las facturas"));
    }
    const entries = result.statementEntries as FinanceStatementRecordEntry[];
    setFinanceStatementEntriesByCustomerId((prev) => ({
      ...prev,
      [customerId]: entries,
    }));
    return entries;
  };

  const loadFinanceStatementRecords = async (row: DsFinanceRow) => {
    setFinanceStatementRecordTarget(row);
    setFinanceStatementRecordLoading(true);
    setFinanceStatementRecordError("");
    try {
      const entries = await fetchFinanceStatementEntries(row.customerId);
      setFinanceStatementRecordEntries(entries);
    } catch (fetchError) {
      setFinanceStatementRecordEntries([]);
      setFinanceStatementRecordError(fetchError instanceof Error ? fetchError.message : (lang === "zh" ? "获取账单记录失败" : "No se pudo cargar las facturas"));
    } finally {
      setFinanceStatementRecordLoading(false);
    }
  };

  const updateFinanceSettlementMode = async (row: DsFinanceRow, nextMode: DsSettlementCurrencyMode) => {
    try {
      setFinanceSettlementSavingCustomerId(row.customerId);
      setError("");
      const response = await fetch(`/api/dropshipping/customers/${encodeURIComponent(row.customerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementMode: nextMode }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || (lang === "zh" ? "更新结算模式失败" : "No se pudo actualizar el modo de liquidacion"));
      }

      setFinance((prev) =>
        prev.map((item) =>
          item.customerId === row.customerId
            ? { ...item, settlementCurrencyMode: nextMode }
            : item,
        ),
      );
      setFinancePreview((prev) =>
        prev && prev.customerId === row.customerId
          ? { ...prev, settlementCurrencyMode: nextMode }
          : prev,
      );
      setFinanceLogTarget((prev) =>
        prev && prev.customerId === row.customerId
          ? { ...prev, settlementCurrencyMode: nextMode }
          : prev,
      );
      setFinanceStatementRecordTarget((prev) =>
        prev && prev.customerId === row.customerId
          ? { ...prev, settlementCurrencyMode: nextMode }
          : prev,
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : (lang === "zh" ? "更新结算模式失败" : "No se pudo actualizar el modo de liquidacion"));
    } finally {
      setFinanceSettlementSavingCustomerId("");
    }
  };

  const updateFinanceStatementGeneratedState = async (
    action: "generate" | "revoke",
    options?: { note?: string; confirmStatementNumber?: string },
  ) => {
    if (!financePreview || !financeStatementSummary) return;
    setFinanceStatementActionLoading(action);
    setFinanceStatementActionError("");
    try {
      const statementNumber = financeCurrentStatementNumber || financeStatementSummary.statementNumber;
      const response = await fetch(`/api/dropshipping/finance/${encodeURIComponent(financePreview.customerId)}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: action === "generate" ? "generate_statement" : "revoke_statement",
          customerName: financePreview.customerName,
          statementNumber,
          cycleText: financeStatementCycleText,
          note: options?.note || "",
          confirmStatementNumber: options?.confirmStatementNumber || "",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || (lang === "zh" ? "更新账单状态失败" : "No se pudo actualizar el estado"));
      }
      const nextGenerated = action === "generate";
      setFinanceStatementLockState({
        statementNumber,
        isGenerated: nextGenerated,
        isPaid: false,
        actionText: nextGenerated ? (lang === "zh" ? "生成账单" : "Generado") : (lang === "zh" ? "撤销生成" : "Revocado"),
        createdAtText: fmtDate(new Date().toISOString(), lang),
        operatorName: "",
        noteText: options?.note || "",
      });
      if (action === "revoke") {
        setFinanceStatementRevokeState(null);
      }
      try {
        const refreshedEntries = await fetchFinanceStatementEntries(financePreview.customerId);
        setFinanceStatementRecordEntries(refreshedEntries);
      } catch {
        // Keep the local lock state when refreshing statement entries fails.
      }
      if (financeLogTarget?.customerId === financePreview.customerId) {
        void loadFinanceActionLogs(financePreview);
      }
    } catch (actionError) {
      setFinanceStatementActionError(actionError instanceof Error ? actionError.message : (lang === "zh" ? "更新账单状态失败" : "No se pudo actualizar el estado"));
    } finally {
      setFinanceStatementActionLoading("");
    }
  };

  const updateFinanceOrderSelection = async (
    item: (typeof financePreviewPreparedOrders)[number],
    nextChecked: boolean,
  ) => {
    if (financeSelectionLocked) return;
    if (!financePreview || !financeStatementSummary) return;
    setFinanceStatementActionError("");
    try {
      const response = await fetch(`/api/dropshipping/finance/${encodeURIComponent(financePreview.customerId)}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: nextChecked ? "include_weekly_order" : "exclude_weekly_order",
          customerName: financePreview.customerName,
          statementNumber: financeCurrentStatementNumber || financeStatementSummary.statementNumber,
          cycleText: financeStatementCycleText,
          orderId: item.orderId,
          orderNo: item.platformOrderNo,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || (lang === "zh" ? "更新订单选择失败" : "No se pudo actualizar la seleccion"));
      }
      setFinanceSelectionState((prev) => {
        const excludedSet = new Set(prev.excludedOrderIds);
        const includedSet = new Set(prev.includedOrderIds);
        const reincludedSet = new Set(prev.reincludedOrderIds);
        if (nextChecked) {
          excludedSet.delete(item.orderId);
          includedSet.add(item.orderId);
          if (prev.excludedOrderIds.includes(item.orderId) || prev.reincludedOrderIds.includes(item.orderId)) {
            reincludedSet.add(item.orderId);
          }
        } else {
          excludedSet.add(item.orderId);
          includedSet.delete(item.orderId);
          reincludedSet.delete(item.orderId);
        }
        return {
          excludedOrderIds: Array.from(excludedSet),
          includedOrderIds: Array.from(includedSet),
          reincludedOrderIds: Array.from(reincludedSet),
        };
      });
      setSelectedFinanceOrderIds((prev) =>
        nextChecked
          ? Array.from(new Set([...prev, item.orderId]))
          : prev.filter((id) => id !== item.orderId),
      );
      if (financeLogTarget?.customerId === financePreview.customerId) {
        void loadFinanceActionLogs(financePreview);
      }
    } catch (selectionError) {
      setFinanceStatementActionError(selectionError instanceof Error ? selectionError.message : (lang === "zh" ? "更新订单选择失败" : "No se pudo actualizar la seleccion"));
    }
  };

  const openFinancePreview = async (row: DsFinanceRow) => {
    setFinanceStatementPreviewStandalone(false);
    setFinanceStatementPreviewRecord(null);
    setFinanceDetailShippedAtSortTouched(false);
    setFinanceDetailShippedAtSortDirection("asc");
    setFinancePreview(row);
    try {
      const statementEntries = await fetchFinanceStatementEntries(row.customerId);
        const currentCycleText = normalizeFinanceCycleText(getFinanceCycleTextForRow(row));
        const matchedEntry = statementEntries.find(
          (entry: FinanceStatementRecordEntry) => normalizeFinanceCycleText(entry.cycleText) === currentCycleText,
        );
        if (matchedEntry) {
          setFinanceStatementPreviewRecord(matchedEntry);
        }
    } catch {
      // Fall back to the current-cycle preview when statement records cannot be loaded.
    }
    void recordFinanceAction(row, "view_detail");
  };

  const openWeeklyFinancePreview = async (row: DsFinanceRow) => {
    setFinanceStatementPreviewStandalone(false);
    if (financeSelectionLocked && financeStatementPreviewRecord) {
      setFinanceStatementPreviewOpen(true);
      void recordFinanceAction(row, "statement_preview", {
        statementNumber: financeStatementPreviewRecord.statementNumber,
        cycleText: financeStatementPreviewRecord.cycleText,
      });
      return;
    }
    setFinanceStatementPreviewRecord(null);
    setFinanceStatementPreviewOpen(true);
    try {
      const statementEntries = await fetchFinanceStatementEntries(row.customerId);
        const currentCycleText = normalizeFinanceCycleText(getFinanceCycleTextForRow(row));
        const matchedEntry = statementEntries.find(
          (entry: FinanceStatementRecordEntry) => normalizeFinanceCycleText(entry.cycleText) === currentCycleText,
        );
        if (matchedEntry) {
          setFinanceStatementPreviewRecord(matchedEntry);
          void recordFinanceAction(row, "statement_preview", {
            statementNumber: matchedEntry.statementNumber,
            cycleText: matchedEntry.cycleText,
          });
          return;
        }
    } catch {
      // Fall back to the current-cycle preview when statement records cannot be loaded.
    }
    void recordFinanceAction(row, "statement_preview");
  };

  const openFinanceStatementRecordPreview = (row: DsFinanceRow, entry: FinanceStatementRecordEntry) => {
    setFinanceStatementRecordTarget(null);
    setFinanceStatementRecordEntries([]);
    setFinanceStatementRecordError("");
    setFinanceStatementPreviewStandalone(true);
    setFinanceStatementPreviewRecord(entry);
    setFinancePreview(row);
    setFinanceStatementPreviewOpen(true);
    setFinancePreviewPage(1);
    void recordFinanceAction(row, "statement_preview", {
      statementNumber: entry.statementNumber,
      cycleText: entry.cycleText,
    });
    window.requestAnimationFrame(() => {
      financePreviewScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const confirmFinanceStatementPaid = async (row: DsFinanceRow, entry: FinanceStatementRecordEntry) => {
    setFinanceStatementActionLoading("confirm_paid");
    setFinanceStatementActionError("");
    try {
      const matchedStatementOrderIds =
        financeStatementPreparedData
        && financeCurrentStatementNumber === entry.statementNumber
          ? financeStatementPreparedData.orders
              .filter((item) => item.settlementStatus !== "paid")
              .map((item) => item.orderId)
          : [];
      const response = await fetch(`/api/dropshipping/finance/${encodeURIComponent(row.customerId)}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "confirm_statement_paid",
          customerName: row.customerName,
          statementNumber: entry.statementNumber,
          cycleText: entry.cycleText,
          orderIds: matchedStatementOrderIds,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || (lang === "zh" ? "确认已付款失败" : "No se pudo confirmar el pago"));
      }
      if (matchedStatementOrderIds.length > 0) {
        const matchedOrderIdSet = new Set(matchedStatementOrderIds);
        setOrders((prev) =>
          prev.map((item) =>
            matchedOrderIdSet.has(item.id)
              ? {
                  ...item,
                  settlementStatus: "paid",
                }
              : item,
          ),
        );
      }
      setFinanceStatementRecordEntries((prev) =>
        prev.map((item) =>
          item.statementNumber === entry.statementNumber
            ? {
                ...item,
                isPaid: true,
                exportedAtText: result.statementState?.createdAtText || item.exportedAtText,
                operatorName: result.statementState?.operatorName || item.operatorName,
              }
            : item,
        ),
      );
      try {
        const refreshedEntries = await fetchFinanceStatementEntries(row.customerId);
        setFinanceStatementRecordEntries(refreshedEntries);
      } catch {
        // Keep the optimistic paid-state update if the refresh request fails.
      }
      await refreshData(["orders", "finance", "overview"]);
      if (financeCurrentStatementNumber === entry.statementNumber) {
        setFinanceStatementLockState(result.statementState || {
          statementNumber: entry.statementNumber,
          isGenerated: true,
          isPaid: true,
          actionText: lang === "zh" ? "已付款确认" : "Pago confirmado",
          createdAtText: "",
          operatorName: "",
          noteText: "",
        });
      }
      setFinanceStatementPreviewRecord((prev) =>
        prev?.statementNumber === entry.statementNumber
          ? { ...prev, isPaid: true }
          : prev,
      );
      if (financeLogTarget?.customerId === row.customerId) {
        void loadFinanceActionLogs(row);
      }
    } catch (confirmError) {
      setFinanceStatementActionError(confirmError instanceof Error ? confirmError.message : (lang === "zh" ? "确认已付款失败" : "No se pudo confirmar el pago"));
    } finally {
      setFinanceStatementActionLoading("");
    }
  };

  function buildFinanceStatementData(
    sourceInventory: DsInventoryRow[],
    mode: "weekly_unpaid" | "all" = "weekly_unpaid",
    paidCycleTextSet: ReadonlySet<string> = new Set<string>(),
    vipEnabled = true,
  ) {
    if (!financePreview) return null;
    const settlementMode = getFinanceSettlementMode(financePreview);
    const getExportSkuKey = (value: string | null | undefined) =>
      normalizeProductCode(value || "") || String(value || "").trim().toLowerCase();
    const targetPreparedOrders =
      mode === "all"
        ? financePreviewAllPreparedOrders
        : financePreviewPreparedOrders.filter(
            (item) => item.settlementStatus !== "paid" && selectedFinanceOrderIds.includes(item.orderId),
          );
    const cycleStartTime = targetPreparedOrders.reduce((min, item) => {
      const time = item.shippedAt ? new Date(item.shippedAt).getTime() : Number.POSITIVE_INFINITY;
      return Math.min(min, time);
    }, Number.POSITIVE_INFINITY);
    const cycleStartDate = Number.isFinite(cycleStartTime) ? new Date(cycleStartTime) : null;
    const financeOrderIds = new Set(targetPreparedOrders.map((item) => item.orderId).filter(Boolean));
    const financeTrackingSkuKeys = new Set(
      targetPreparedOrders.map((item) => `${String(item.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(item.sku)}`),
    );
    const financeSkuKeys = new Set(targetPreparedOrders.map((item) => getExportSkuKey(item.sku)).filter(Boolean));
    const matchesFinanceCustomer = (row: { customerId?: string | null; customerName?: string | null }) =>
      (row.customerId && financePreview.customerId && row.customerId === financePreview.customerId)
      || String(row.customerName || "").trim() === String(financePreview.customerName || "").trim();
    const matchesFinanceInventoryRow = (row: {
      customerId?: string | null;
      customerName?: string | null;
      orderId?: string | null;
      trackingNo?: string | null;
      sku?: string | null;
    }) => {
      if (matchesFinanceCustomer(row)) return true;
      if (row.orderId && financeOrderIds.has(row.orderId)) return true;
      const trackingSkuKey = `${String(row.trackingNo || "").trim().toLowerCase()}::${normalizeProductCode(row.sku || "")}`;
      if (financeTrackingSkuKeys.has(trackingSkuKey)) return true;
      return financeSkuKeys.has(normalizeProductCode(row.sku || ""));
    };
    const inventoryStockBySku = sourceInventory.reduce((map, row) => {
      if (!matchesFinanceInventoryRow(row)) return map;
      const skuKey = getExportSkuKey(row.sku);
      if (!skuKey) return map;
      const current = map.get(skuKey) || { isStocked: false, stockedQty: 0, stockedAt: null as string | null };
      map.set(skuKey, {
        isStocked: current.isStocked || row.isStocked,
        stockedQty: current.stockedQty + (row.isStocked ? Math.max(row.stockedQty, 0) : 0),
        stockedAt: current.stockedAt || row.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const inventoryStockBySkuFallback = sourceInventory.reduce((map, row) => {
      const skuKey = getExportSkuKey(row.sku);
      if (!skuKey || !row.isStocked) return map;
      const current = map.get(skuKey) || { isStocked: false, stockedQty: 0, stockedAt: null as string | null };
      map.set(skuKey, {
        isStocked: true,
        stockedQty: current.stockedQty + Math.max(row.stockedQty, 0),
        stockedAt: current.stockedAt || row.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const isDirectExactMatchableInventoryRow = (row: DsInventoryRow) =>
      row.isStocked && row.rowKey.startsWith("order:");
    const inventoryStockByOrderId = sourceInventory.reduce((map, row) => {
      if (!matchesFinanceInventoryRow(row)) return map;
      if (!isDirectExactMatchableInventoryRow(row) || !row.orderId) return map;
      map.set(row.orderId, {
        isStocked: true,
        stockedQty: Math.max(row.stockedQty, 0),
        stockedAt: row.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const inventoryStockByTrackingSku = sourceInventory.reduce((map, row) => {
      if (!matchesFinanceInventoryRow(row)) return map;
      if (!isDirectExactMatchableInventoryRow(row)) return map;
      const trackingKey = `${String(row.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(row.sku)}`;
      if (!trackingKey || trackingKey.startsWith("::")) return map;
      map.set(trackingKey, {
        isStocked: true,
        stockedQty: Math.max(row.stockedQty, 0),
        stockedAt: row.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const inventoryStockBySkuStockedDate = sourceInventory.reduce((map, row) => {
      if (!matchesFinanceInventoryRow(row)) return map;
      if (!row.isStocked || !row.stockedAt) return map;
      const stockedDateKey = toDateInputValue(row.stockedAt);
      const skuStockedDateKey = `${getExportSkuKey(row.sku)}::${stockedDateKey}`;
      if (!stockedDateKey || skuStockedDateKey.startsWith("::")) return map;
      map.set(skuStockedDateKey, {
        isStocked: true,
        stockedQty: Math.max(row.stockedQty, 0),
        stockedAt: row.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const getMatchedStockInfo = (item: (typeof financePreviewPreparedOrders)[number]) => {
      const directMatch = inventoryStockByOrderId.get(item.orderId);
      if (directMatch) return directMatch;
      const trackingSkuKey = `${String(item.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(item.sku)}`;
      const trackingMatch = inventoryStockByTrackingSku.get(trackingSkuKey);
      if (trackingMatch) return trackingMatch;
      const shippedDateKey = toDateInputValue(item.shippedAt);
      const skuStockedDateKey = `${getExportSkuKey(item.sku)}::${shippedDateKey}`;
      const datedMatch = inventoryStockBySkuStockedDate.get(skuStockedDateKey);
      if (datedMatch) return datedMatch;
      return inventoryStockBySku.get(getExportSkuKey(item.sku)) || inventoryStockBySkuFallback.get(getExportSkuKey(item.sku)) || null;
    };
    const getExactMatchedStockInfo = (item: (typeof financePreviewPreparedOrders)[number]) => {
      const directMatch = inventoryStockByOrderId.get(item.orderId);
      if (directMatch) return directMatch;
      const trackingSkuKey = `${String(item.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(item.sku)}`;
      const trackingMatch = inventoryStockByTrackingSku.get(trackingSkuKey);
      if (trackingMatch) return trackingMatch;
      const shippedDateKey = toDateInputValue(item.shippedAt);
      const skuStockedDateKey = `${getExportSkuKey(item.sku)}::${shippedDateKey}`;
      return inventoryStockBySkuStockedDate.get(skuStockedDateKey) || null;
    };
    const findExactMatchedInventoryRow = (item: (typeof financePreviewPreparedOrders)[number]) => {
      const directMatch = sourceInventory.find((row) =>
        isDirectExactMatchableInventoryRow(row)
        && row.orderId === item.orderId,
      );
      if (directMatch) return directMatch;
      const trackingNo = String(item.trackingNo || "").trim().toLowerCase();
      const skuKey = getExportSkuKey(item.sku);
      const trackingMatch = sourceInventory.find((row) =>
        isDirectExactMatchableInventoryRow(row)
        && String(row.trackingNo || "").trim().toLowerCase() === trackingNo
        && getExportSkuKey(row.sku) === skuKey,
      );
      if (trackingMatch) return trackingMatch;
      const shippedDateKey = toDateInputValue(item.shippedAt);
      return sourceInventory.find((row) =>
        row.isStocked
        && getExportSkuKey(row.sku) === skuKey
        && toDateInputValue(row.stockedAt) === shippedDateKey,
      ) || null;
    };
    const shippedQtyBySku = targetPreparedOrders.reduce((map, item) => {
      const skuKey = getExportSkuKey(item.sku);
      if (!skuKey) return map;
      map.set(skuKey, (map.get(skuKey) || 0) + Math.max(item.quantity, 0));
      return map;
    }, new Map<string, number>());
    const shippedBeforeCycleBySku = financePreviewAllPreparedOrders.reduce((map, item) => {
      const skuKey = getExportSkuKey(item.sku);
      if (!skuKey || !cycleStartDate || !item.shippedAt) return map;
      const shippedAt = new Date(item.shippedAt);
      if (!(shippedAt < cycleStartDate)) return map;
      map.set(skuKey, (map.get(skuKey) || 0) + Math.max(item.quantity, 0));
      return map;
    }, new Map<string, number>());
    const stockedBeforeCycleBySku = sourceInventory.reduce((map, row) => {
      const skuKey = getExportSkuKey(row.sku);
      if (!skuKey || !row.isStocked || !cycleStartDate || !row.stockedAt) return map;
      const stockedAt = new Date(row.stockedAt);
      if (!(stockedAt < cycleStartDate)) return map;
      map.set(skuKey, (map.get(skuKey) || 0) + Math.max(row.stockedQty, 0));
      return map;
    }, new Map<string, number>());
    const initialCoveredQtyBySku = new Map<string, number>();
    for (const skuKey of new Set([...stockedBeforeCycleBySku.keys(), ...shippedBeforeCycleBySku.keys()])) {
      initialCoveredQtyBySku.set(
        skuKey,
        Math.max((stockedBeforeCycleBySku.get(skuKey) || 0) - (shippedBeforeCycleBySku.get(skuKey) || 0), 0),
      );
    }
    const remainingQtyBySku = new Map<string, number>();
    for (const skuKey of new Set([...inventoryStockBySku.keys(), ...inventoryStockBySkuFallback.keys(), ...shippedQtyBySku.keys()])) {
      const stockedQty = inventoryStockBySku.get(skuKey)?.stockedQty || inventoryStockBySkuFallback.get(skuKey)?.stockedQty || 0;
      remainingQtyBySku.set(skuKey, stockedQty - (shippedQtyBySku.get(skuKey) || 0));
    }
    const findDirectMatchedInventoryRow = (item: (typeof financePreviewPreparedOrders)[number]) =>
      sourceInventory.find((row) =>
        row.rowKey.startsWith("order:")
        && row.orderId === item.orderId
        && (row.stockedQty || 0) > 0
        && Boolean(row.stockedAt)
      ) || null;
    const preparedOrders = targetPreparedOrders.map((item) => {
      const matchedStockInfo = getMatchedStockInfo(item);
      const exactMatchedStockInfo = getExactMatchedStockInfo(item);
      const exactMatchedInventoryRow = findExactMatchedInventoryRow(item);
      const directMatchedInventoryRow = findDirectMatchedInventoryRow(item);
      const billedStockInventoryRow = directMatchedInventoryRow || exactMatchedInventoryRow;
      const exportIsStocked = matchedStockInfo?.isStocked ?? item.isStocked;
      const exportStockedQty =
        matchedStockInfo && matchedStockInfo.stockedQty > 0
          ? matchedStockInfo.stockedQty
          : item.isStocked && item.stockedQty > 0
            ? item.stockedQty
            : 0;
      const cycleText = getMexicoWeekCycleText(item.shippedAt);
      const effectiveSettlementStatus = paidCycleTextSet.has(normalizeFinanceCycleText(cycleText))
        ? "paid"
        : item.settlementStatus;
      return {
        ...item,
        settlementStatus: effectiveSettlementStatus,
        exportIsStocked,
        exportStockedQty,
        exportStockedAt: matchedStockInfo?.stockedAt || null,
        displayIsStocked: Boolean(exactMatchedInventoryRow?.isStocked || exactMatchedStockInfo?.isStocked),
        displayStockedQty: exactMatchedInventoryRow?.stockedQty || exactMatchedStockInfo?.stockedQty || 0,
        displayStockedAt: exactMatchedInventoryRow?.stockedAt || exactMatchedStockInfo?.stockedAt || null,
        exportRemainingQty: remainingQtyBySku.get(getExportSkuKey(item.sku)),
        skuStockInfo: inventoryStockBySku.get(getExportSkuKey(item.sku)) || inventoryStockBySkuFallback.get(getExportSkuKey(item.sku)),
        skuKey: getExportSkuKey(item.sku),
        initialCoveredQty: initialCoveredQtyBySku.get(getExportSkuKey(item.sku)) || 0,
        stockBatchKey: billedStockInventoryRow?.rowKey || null,
        stockBatchQty: billedStockInventoryRow?.stockedQty || exactMatchedStockInfo?.stockedQty || 0,
        stockBatchShouldBill: Boolean(
          billedStockInventoryRow?.stockedAt
          && cycleStartDate
          && new Date(billedStockInventoryRow.stockedAt) >= cycleStartDate,
        ),
        statementCycleText: cycleText,
        displayReincluded:
          financeSelectionReincludedIdSet.has(item.orderId)
          && !financePreviewWeekUnpaidIdSet.has(item.orderId),
      };
    });
    const computeAmountWithQty = (item: (typeof preparedOrders)[number], effectiveQty: number) => {
      const normalizedNormalDiscount = Math.min(
        Math.max(Math.abs(item.normalDiscount) <= 1 ? item.normalDiscount : item.normalDiscount / 100, 0),
        1,
      );
      const normalizedVipDiscount = vipEnabled
        ? Math.min(
            Math.max(Math.abs(item.vipDiscount) <= 1 ? item.vipDiscount : item.vipDiscount / 100, 0),
            1,
          )
        : 0;
      return item.unitPrice > 0 && effectiveQty > 0
        ? item.unitPrice * effectiveQty * (1 - normalizedNormalDiscount) * (1 - normalizedVipDiscount)
        : 0;
    };
    const sortedPreparedOrders = [...preparedOrders].sort((a, b) => {
      const aTime = a.shippedAt ? new Date(a.shippedAt).getTime() : 0;
      const bTime = b.shippedAt ? new Date(b.shippedAt).getTime() : 0;
      return aTime - bTime;
    });
    const ordersWithDisplayAmounts = applyStockPriorityProductAmounts(sortedPreparedOrders, {
      vipEnabled: financeStatementVipEnabled,
    }).map((item) => {
      const displayConvertedAmount =
        settlementMode === "MXN"
          ? item.displayProductAmount
          : (
              financeStatementRateValue && Number.isFinite(financeStatementRateValue)
                ? item.displayProductAmount * financeStatementRateValue
                : item.productAmount
            );
      const displayShippingAmount =
        settlementMode === "MXN"
          ? convertCnyToMxn(item.shippingFee, financeStatementRateValue)
          : item.shippingFee;
      return {
        ...item,
        displayConvertedAmount,
        displayShippingAmount,
        displayCnyTotalAmount: displayConvertedAmount + displayShippingAmount,
      };
    });
    const computeSettlementGroupAmount = (items: typeof ordersWithDisplayAmounts) => {
      const mxnAmount = items.reduce((sum, item) => sum + item.displayProductAmount, 0);
      const shippingAmount = items.reduce((sum, item) => sum + item.displayShippingAmount, 0);
      const convertedAmount =
        settlementMode === "MXN"
          ? mxnAmount
          : (
              financeStatementRateValue && Number.isFinite(financeStatementRateValue)
                ? mxnAmount * financeStatementRateValue
                : items.reduce((sum, item) => sum + item.productAmount, 0)
            );
      return {
        mxnAmount,
        convertedAmount,
        shippingAmount,
        totalAmount: convertedAmount + shippingAmount,
      };
    };
    const overallAmounts = computeSettlementGroupAmount(ordersWithDisplayAmounts);
    const rawServiceFeeTotal = ordersWithDisplayAmounts.reduce((sum, item) => sum + item.shippingFee, 0);
    const uniqueShippingFees = Array.from(
      new Set(
        ordersWithDisplayAmounts
          .map((item) => item.displayShippingAmount)
          .filter((value) => Number.isFinite(value) && value > 0)
          .map((value) => Number(value.toFixed(2))),
      ),
    ).sort((a, b) => a - b);
    const serviceFeeDisplay = uniqueShippingFees.length === 0
      ? `${settlementMode === "MXN" ? "$" : "￥"}0.00 / ${lang === "zh" ? "单" : "pedido"}`
      : uniqueShippingFees.length === 1
        ? `${settlementMode === "MXN" ? "$" : "￥"}${fmtMoney(uniqueShippingFees[0], lang)} / ${lang === "zh" ? "单" : "pedido"}`
        : `${settlementMode === "MXN" ? "$" : "￥"}${fmtMoney(uniqueShippingFees[0], lang)}-${fmtMoney(uniqueShippingFees[uniqueShippingFees.length - 1], lang)} / ${lang === "zh" ? "单" : "pedido"}`;
    return {
      settlementMode,
      orders: ordersWithDisplayAmounts,
      mxnSubtotal: overallAmounts.mxnAmount,
      cnySubtotal: overallAmounts.convertedAmount,
      serviceFeeTotal: overallAmounts.shippingAmount,
      rawServiceFeeTotal,
      payableTotal: overallAmounts.totalAmount,
      totalPaidAmount: computeSettlementGroupAmount(ordersWithDisplayAmounts.filter((item) => item.settlementStatus === "paid")).totalAmount,
      totalUnpaidAmount: computeSettlementGroupAmount(ordersWithDisplayAmounts.filter((item) => item.settlementStatus !== "paid")).totalAmount,
      hasUnpaid: ordersWithDisplayAmounts.some((item) => item.settlementStatus !== "paid"),
      orderCount: ordersWithDisplayAmounts.length,
      serviceFeePerOrder: overallAmounts.shippingAmount > 0
        ? overallAmounts.shippingAmount / Math.max(1, ordersWithDisplayAmounts.filter((item) => item.shippingFee > 0).length)
        : 0,
      serviceFeeDisplay,
    };
  }

  function buildFinanceCustomerExportSummary(
    row: DsFinanceRow,
    sourceInventory: DsInventoryRow[],
    paidCycleTextSet: ReadonlySet<string> = new Set<string>(),
    summaryRateValue?: number | null,
  ) {
    const effectiveSummaryRateValue =
      typeof summaryRateValue === "number" && Number.isFinite(summaryRateValue) && summaryRateValue > 0
        ? summaryRateValue
        : row.exchangeRate;
    const settlementMode = getFinanceSettlementMode(row);
    const getExportSkuKey = (value: string | null | undefined) =>
      normalizeProductCode(value || "") || String(value || "").trim().toLowerCase();
    const targetPreparedOrders = row.settledOrders.map((item) => {
      const trackingKey = String(item.trackingNo || "").trim().toLowerCase() || `order:${item.orderId}`;
      return {
        ...item,
        trackingKey,
      };
    });
    const seenTracking = new Set<string>();
    const dedupedOrders = targetPreparedOrders.map((item) => {
      const shouldCountShipping = !seenTracking.has(item.trackingKey);
      if (shouldCountShipping) seenTracking.add(item.trackingKey);
      return {
        ...item,
        shippingFee: shouldCountShipping ? item.shippingFee : 0,
      };
    });
    const cycleStartTime = dedupedOrders.reduce((min, item) => {
      const time = item.shippedAt ? new Date(item.shippedAt).getTime() : Number.POSITIVE_INFINITY;
      return Math.min(min, time);
    }, Number.POSITIVE_INFINITY);
    const cycleStartDate = Number.isFinite(cycleStartTime) ? new Date(cycleStartTime) : null;
    const financeOrderIds = new Set(dedupedOrders.map((item) => item.orderId).filter(Boolean));
    const financeTrackingSkuKeys = new Set(
      dedupedOrders.map((item) => `${String(item.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(item.sku)}`),
    );
    const financeSkuKeys = new Set(dedupedOrders.map((item) => getExportSkuKey(item.sku)).filter(Boolean));
    const matchesFinanceCustomer = (inventoryRow: { customerId?: string | null; customerName?: string | null }) =>
      (inventoryRow.customerId && row.customerId && inventoryRow.customerId === row.customerId)
      || String(inventoryRow.customerName || "").trim() === String(row.customerName || "").trim();
    const matchesFinanceInventoryRow = (inventoryRow: {
      customerId?: string | null;
      customerName?: string | null;
      orderId?: string | null;
      trackingNo?: string | null;
      sku?: string | null;
    }) => {
      if (matchesFinanceCustomer(inventoryRow)) return true;
      if (inventoryRow.orderId && financeOrderIds.has(inventoryRow.orderId)) return true;
      const trackingSkuKey = `${String(inventoryRow.trackingNo || "").trim().toLowerCase()}::${normalizeProductCode(inventoryRow.sku || "")}`;
      if (financeTrackingSkuKeys.has(trackingSkuKey)) return true;
      return financeSkuKeys.has(normalizeProductCode(inventoryRow.sku || ""));
    };
    const inventoryStockBySku = sourceInventory.reduce((map, inventoryRow) => {
      if (!matchesFinanceInventoryRow(inventoryRow)) return map;
      const skuKey = getExportSkuKey(inventoryRow.sku);
      if (!skuKey) return map;
      const current = map.get(skuKey) || { isStocked: false, stockedQty: 0, stockedAt: null as string | null };
      map.set(skuKey, {
        isStocked: current.isStocked || inventoryRow.isStocked,
        stockedQty: current.stockedQty + (inventoryRow.isStocked ? Math.max(inventoryRow.stockedQty, 0) : 0),
        stockedAt: current.stockedAt || inventoryRow.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const inventoryStockBySkuFallback = sourceInventory.reduce((map, inventoryRow) => {
      const skuKey = getExportSkuKey(inventoryRow.sku);
      if (!skuKey || !inventoryRow.isStocked) return map;
      const current = map.get(skuKey) || { isStocked: false, stockedQty: 0, stockedAt: null as string | null };
      map.set(skuKey, {
        isStocked: true,
        stockedQty: current.stockedQty + Math.max(inventoryRow.stockedQty, 0),
        stockedAt: current.stockedAt || inventoryRow.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const isDirectExactMatchableInventoryRow = (inventoryRow: DsInventoryRow) =>
      inventoryRow.isStocked && inventoryRow.rowKey.startsWith("order:");
    const inventoryStockByOrderId = sourceInventory.reduce((map, inventoryRow) => {
      if (!matchesFinanceInventoryRow(inventoryRow)) return map;
      if (!isDirectExactMatchableInventoryRow(inventoryRow) || !inventoryRow.orderId) return map;
      map.set(inventoryRow.orderId, {
        isStocked: true,
        stockedQty: Math.max(inventoryRow.stockedQty, 0),
        stockedAt: inventoryRow.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const inventoryStockByTrackingSku = sourceInventory.reduce((map, inventoryRow) => {
      if (!matchesFinanceInventoryRow(inventoryRow)) return map;
      if (!isDirectExactMatchableInventoryRow(inventoryRow)) return map;
      const trackingKey = `${String(inventoryRow.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(inventoryRow.sku)}`;
      if (!trackingKey || trackingKey.startsWith("::")) return map;
      map.set(trackingKey, {
        isStocked: true,
        stockedQty: Math.max(inventoryRow.stockedQty, 0),
        stockedAt: inventoryRow.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const inventoryStockBySkuStockedDate = sourceInventory.reduce((map, inventoryRow) => {
      if (!matchesFinanceInventoryRow(inventoryRow)) return map;
      if (!inventoryRow.isStocked || !inventoryRow.stockedAt) return map;
      const stockedDateKey = toDateInputValue(inventoryRow.stockedAt);
      const skuStockedDateKey = `${getExportSkuKey(inventoryRow.sku)}::${stockedDateKey}`;
      if (!stockedDateKey || skuStockedDateKey.startsWith("::")) return map;
      map.set(skuStockedDateKey, {
        isStocked: true,
        stockedQty: Math.max(inventoryRow.stockedQty, 0),
        stockedAt: inventoryRow.stockedAt || null,
      });
      return map;
    }, new Map<string, { isStocked: boolean; stockedQty: number; stockedAt: string | null }>());
    const getMatchedStockInfo = (item: (typeof dedupedOrders)[number]) => {
      const directMatch = inventoryStockByOrderId.get(item.orderId);
      if (directMatch) return directMatch;
      const trackingSkuKey = `${String(item.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(item.sku)}`;
      const trackingMatch = inventoryStockByTrackingSku.get(trackingSkuKey);
      if (trackingMatch) return trackingMatch;
      const shippedDateKey = toDateInputValue(item.shippedAt);
      const skuStockedDateKey = `${getExportSkuKey(item.sku)}::${shippedDateKey}`;
      const datedMatch = inventoryStockBySkuStockedDate.get(skuStockedDateKey);
      if (datedMatch) return datedMatch;
      return inventoryStockBySku.get(getExportSkuKey(item.sku)) || inventoryStockBySkuFallback.get(getExportSkuKey(item.sku)) || null;
    };
    const getExactMatchedStockInfo = (item: (typeof dedupedOrders)[number]) => {
      const directMatch = inventoryStockByOrderId.get(item.orderId);
      if (directMatch) return directMatch;
      const trackingSkuKey = `${String(item.trackingNo || "").trim().toLowerCase()}::${getExportSkuKey(item.sku)}`;
      const trackingMatch = inventoryStockByTrackingSku.get(trackingSkuKey);
      if (trackingMatch) return trackingMatch;
      const shippedDateKey = toDateInputValue(item.shippedAt);
      const skuStockedDateKey = `${getExportSkuKey(item.sku)}::${shippedDateKey}`;
      return inventoryStockBySkuStockedDate.get(skuStockedDateKey) || null;
    };
    const findExactMatchedInventoryRow = (item: (typeof dedupedOrders)[number]) => {
      const directMatch = sourceInventory.find((row) =>
        isDirectExactMatchableInventoryRow(row)
        && row.orderId === item.orderId,
      );
      if (directMatch) return directMatch;
      const trackingNo = String(item.trackingNo || "").trim().toLowerCase();
      const skuKey = getExportSkuKey(item.sku);
      const trackingMatch = sourceInventory.find((row) =>
        isDirectExactMatchableInventoryRow(row)
        && String(row.trackingNo || "").trim().toLowerCase() === trackingNo
        && getExportSkuKey(row.sku) === skuKey,
      );
      if (trackingMatch) return trackingMatch;
      const shippedDateKey = toDateInputValue(item.shippedAt);
      return sourceInventory.find((row) =>
        row.isStocked
        && getExportSkuKey(row.sku) === skuKey
        && toDateInputValue(row.stockedAt) === shippedDateKey,
      ) || null;
    };
    const shippedQtyBySku = dedupedOrders.reduce((map, item) => {
      const skuKey = getExportSkuKey(item.sku);
      if (!skuKey) return map;
      map.set(skuKey, (map.get(skuKey) || 0) + Math.max(item.quantity, 0));
      return map;
    }, new Map<string, number>());
    const shippedBeforeCycleBySku = row.settledOrders.reduce((map, item) => {
      const skuKey = getExportSkuKey(item.sku);
      if (!skuKey || !cycleStartDate || !item.shippedAt) return map;
      const shippedAt = new Date(item.shippedAt);
      if (!(shippedAt < cycleStartDate)) return map;
      map.set(skuKey, (map.get(skuKey) || 0) + Math.max(item.quantity, 0));
      return map;
    }, new Map<string, number>());
    const stockedBeforeCycleBySku = sourceInventory.reduce((map, inventoryRow) => {
      const skuKey = getExportSkuKey(inventoryRow.sku);
      if (!skuKey || !inventoryRow.isStocked || !cycleStartDate || !inventoryRow.stockedAt) return map;
      const stockedAt = new Date(inventoryRow.stockedAt);
      if (!(stockedAt < cycleStartDate)) return map;
      map.set(skuKey, (map.get(skuKey) || 0) + Math.max(inventoryRow.stockedQty, 0));
      return map;
    }, new Map<string, number>());
    const initialCoveredQtyBySku = new Map<string, number>();
    for (const skuKey of new Set([...stockedBeforeCycleBySku.keys(), ...shippedBeforeCycleBySku.keys()])) {
      initialCoveredQtyBySku.set(
        skuKey,
        Math.max((stockedBeforeCycleBySku.get(skuKey) || 0) - (shippedBeforeCycleBySku.get(skuKey) || 0), 0),
      );
    }
    const remainingQtyBySku = new Map<string, number>();
    for (const skuKey of new Set([...inventoryStockBySku.keys(), ...inventoryStockBySkuFallback.keys(), ...shippedQtyBySku.keys()])) {
      const stockedQty = inventoryStockBySku.get(skuKey)?.stockedQty || inventoryStockBySkuFallback.get(skuKey)?.stockedQty || 0;
      remainingQtyBySku.set(skuKey, stockedQty - (shippedQtyBySku.get(skuKey) || 0));
    }
    const findDirectMatchedInventoryRow = (item: (typeof dedupedOrders)[number]) =>
      sourceInventory.find((inventoryRow) =>
        inventoryRow.rowKey.startsWith("order:")
        && inventoryRow.orderId === item.orderId
        && (inventoryRow.stockedQty || 0) > 0
        && Boolean(inventoryRow.stockedAt)
      ) || null;
    const preparedOrders = dedupedOrders.map((item) => {
      const matchedStockInfo = getMatchedStockInfo(item);
      const exactMatchedStockInfo = getExactMatchedStockInfo(item);
      const exactMatchedInventoryRow = findExactMatchedInventoryRow(item);
      const directMatchedInventoryRow = findDirectMatchedInventoryRow(item);
      const billedStockInventoryRow = directMatchedInventoryRow || exactMatchedInventoryRow;
      const exportIsStocked = matchedStockInfo?.isStocked ?? item.isStocked;
      const exportStockedQty =
        matchedStockInfo && matchedStockInfo.stockedQty > 0
          ? matchedStockInfo.stockedQty
          : item.isStocked && item.stockedQty > 0
            ? item.stockedQty
            : 0;
      const cycleText = getMexicoWeekCycleText(item.shippedAt);
      const effectiveSettlementStatus = paidCycleTextSet.has(normalizeFinanceCycleText(cycleText))
        ? "paid"
        : item.settlementStatus;
      return {
        ...item,
        settlementStatus: effectiveSettlementStatus,
        exportIsStocked,
        exportStockedQty,
        exportRemainingQty: remainingQtyBySku.get(getExportSkuKey(item.sku)),
        skuKey: getExportSkuKey(item.sku),
        initialCoveredQty: initialCoveredQtyBySku.get(getExportSkuKey(item.sku)) || 0,
        stockBatchKey: billedStockInventoryRow?.rowKey || null,
        stockBatchQty: billedStockInventoryRow?.stockedQty || exactMatchedStockInfo?.stockedQty || 0,
        stockBatchShouldBill: Boolean(
          billedStockInventoryRow?.stockedAt
          && cycleStartDate
          && new Date(billedStockInventoryRow.stockedAt) >= cycleStartDate,
        ),
      };
    });
    const computeAmountWithQty = (item: (typeof preparedOrders)[number], effectiveQty: number) => {
      const normalizedNormalDiscount = Math.min(
        Math.max(Math.abs(item.normalDiscount) <= 1 ? item.normalDiscount : item.normalDiscount / 100, 0),
        1,
      );
      const normalizedVipDiscount = Math.min(
        Math.max(Math.abs(item.vipDiscount) <= 1 ? item.vipDiscount : item.vipDiscount / 100, 0),
        1,
      );
      return item.unitPrice > 0 && effectiveQty > 0
        ? item.unitPrice * effectiveQty * (1 - normalizedNormalDiscount) * (1 - normalizedVipDiscount)
        : 0;
    };
    const sortedPreparedOrders = [...preparedOrders].sort((a, b) => {
      const aTime = a.shippedAt ? new Date(a.shippedAt).getTime() : 0;
      const bTime = b.shippedAt ? new Date(b.shippedAt).getTime() : 0;
      return aTime - bTime;
    });
    const ordersWithDisplayAmounts = applyStockPriorityProductAmounts(sortedPreparedOrders).map((item) => {
      const displayConvertedAmount =
        settlementMode === "MXN"
          ? item.displayProductAmount
          : (
              effectiveSummaryRateValue && Number.isFinite(effectiveSummaryRateValue)
                ? item.displayProductAmount * effectiveSummaryRateValue
                : item.productAmount
            );
      const displayShippingAmount =
        settlementMode === "MXN"
          ? convertCnyToMxn(item.shippingFee, effectiveSummaryRateValue)
          : item.shippingFee;
      return {
        ...item,
        displayConvertedAmount,
        displayShippingAmount,
        displayCnyTotalAmount: displayConvertedAmount + displayShippingAmount,
      };
    });
    const computeSettlementGroupAmount = (items: typeof ordersWithDisplayAmounts) => {
      const mxnAmount = items.reduce((sum, item) => sum + item.displayProductAmount, 0);
      const shippingAmount = items.reduce((sum, item) => sum + item.displayShippingAmount, 0);
      const convertedAmount =
        settlementMode === "MXN"
          ? mxnAmount
          : (
              effectiveSummaryRateValue && Number.isFinite(effectiveSummaryRateValue)
                ? mxnAmount * effectiveSummaryRateValue
                : items.reduce((sum, item) => sum + item.productAmount, 0)
            );
      return {
        mxnAmount,
        convertedAmount,
        shippingAmount,
        totalAmount: convertedAmount + shippingAmount,
      };
    };
    const overallAmounts = computeSettlementGroupAmount(ordersWithDisplayAmounts);
    const rawServiceFeeTotal = ordersWithDisplayAmounts.reduce((sum, item) => sum + item.shippingFee, 0);
    return {
      settlementMode,
      orders: ordersWithDisplayAmounts,
      mxnSubtotal: overallAmounts.mxnAmount,
      cnySubtotal: overallAmounts.convertedAmount,
      serviceFeeTotal: overallAmounts.shippingAmount,
      rawServiceFeeTotal,
      payableTotal: overallAmounts.totalAmount,
      totalPaidAmount: computeSettlementGroupAmount(ordersWithDisplayAmounts.filter((item) => item.settlementStatus === "paid")).totalAmount,
      totalUnpaidAmount: computeSettlementGroupAmount(ordersWithDisplayAmounts.filter((item) => item.settlementStatus !== "paid")).totalAmount,
      hasUnpaid: sortedPreparedOrders.some((item) => item.settlementStatus !== "paid"),
    };
  }

  const exportFinancePreviewRows = async (
    actionType: "export_all" | "export_weekly_statement" = "export_all",
  ) => {
    if (!financePreview) return;
    let exportInventory = inventory;
    let exportPaidCycleTextSet = financePaidCycleTextSet;
    let exportFinanceRow = financePreview;
    try {
      const inventoryResponse = await fetch("/api/dropshipping/inventory");
      const inventoryJson = await inventoryResponse.json();
      if (inventoryResponse.ok && inventoryJson?.ok && Array.isArray(inventoryJson.items)) {
        exportInventory = inventoryJson.items;
      }
    } catch {
      // Fallback to the current in-memory inventory state when the refresh request fails.
    }
    try {
      const financeResponse = await fetch("/api/dropshipping/finance");
      const financeJson = await financeResponse.json();
      if (financeResponse.ok && financeJson?.ok && Array.isArray(financeJson.items)) {
        const matchedFinanceRow = financeJson.items.find((row: DsFinanceRow) => row.customerId === financePreview.customerId);
        if (matchedFinanceRow) {
          exportFinanceRow = matchedFinanceRow;
        }
      }
    } catch {
      // Fallback to the current in-memory finance state when the refresh request fails.
    }
    try {
      const logsResponse = await fetch(`/api/dropshipping/finance/${financePreview.customerId}/logs`);
      const logsJson = await logsResponse.json();
      if (logsResponse.ok && logsJson?.ok && Array.isArray(logsJson.statementEntries)) {
        exportPaidCycleTextSet = new Set<string>(
          logsJson.statementEntries
            .filter((entry: { isPaid?: boolean; cycleText?: string | null }) => Boolean(entry?.isPaid))
            .map((entry: { cycleText?: string | null }) => normalizeFinanceCycleText(entry?.cycleText))
            .filter(Boolean),
        );
      }
    } catch {
      // Fallback to the in-memory statement records when the refresh request fails.
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(lang === "zh" ? "结算详情" : "Detalle");
    const companyTitle = exportFinanceRow.customerName || (lang === "zh" ? "公司名" : "Empresa");
    const statementData =
      actionType === "export_all"
        ? buildFinanceCustomerExportSummary(
            exportFinanceRow,
            exportInventory,
            exportPaidCycleTextSet,
            exchangeRate.rateValue || exportFinanceRow.exchangeRate,
          )
        : buildFinanceStatementData(
            exportInventory,
            "weekly_unpaid",
            exportPaidCycleTextSet,
            financeStatementVipEnabled,
          );
    if (!statementData) return;
    const totalProductAmount = statementData.mxnSubtotal;
    const totalConvertedAmount = statementData.cnySubtotal;
    const totalShippingFee = statementData.serviceFeeTotal;
    const totalPayableAmount = statementData.payableTotal;
    const totalPaidAmount = statementData.totalPaidAmount;
    const totalUnpaidAmount = statementData.totalUnpaidAmount;
    const settlementMode = statementData.settlementMode || getFinanceSettlementMode(financePreview);
    const settlementLabels = getSettlementAmountLabels(settlementMode, lang);
    const todayParts = getMexicoDatePartsMap(new Date());
    const todayZhText = `今天${Number(todayParts.year)}年${Number(todayParts.month)}月${Number(todayParts.day)}日`;
    const exportDateCode = `${todayParts.year}${todayParts.month}${todayParts.day}`;
    const exportDateText =
      lang === "zh"
        ? `文件导出日期：${Number(todayParts.year)}年${Number(todayParts.month)}月${Number(todayParts.day)}日`
        : `Fecha de exportacion: ${todayParts.year}/${todayParts.month}/${todayParts.day}`;
    const exportDisplayRate = actionType === "export_all" ? exchangeRate : financeStatementDisplayRate;
    const rateHintText =
      settlementMode === "MXN"
        ? (
            lang === "zh"
              ? `${todayZhText}   汇率：RMB兑MXN  ${exportDisplayRate.rateValue ? (1 / exportDisplayRate.rateValue).toFixed(4) : "-"}`
              : `Hoy ${todayParts.year}/${todayParts.month}/${todayParts.day}   Tipo de cambio: RMB a MXN ${exportDisplayRate.rateValue ? (1 / exportDisplayRate.rateValue).toFixed(4) : "-"}`
          )
        : (
            lang === "zh"
              ? `${todayZhText}   汇率：MXN兑RMB  ${exportDisplayRate.rateValue ? exportDisplayRate.rateValue.toFixed(4) : "-"}`
              : `Hoy ${todayParts.year}/${todayParts.month}/${todayParts.day}   Tipo de cambio: MXN a RMB ${exportDisplayRate.rateValue ? exportDisplayRate.rateValue.toFixed(4) : "-"}`
          );
    const headerLabels = [
      lang === "zh" ? "订单号" : "Pedido",
      lang === "zh" ? "物流号" : "Guia",
      lang === "zh" ? "发货日期" : "Fecha envio",
      lang === "zh" ? "编码" : "Codigo",
      lang === "zh" ? "中文名" : "Nombre",
      lang === "zh" ? "产品单价" : "Precio unitario",
      lang === "zh" ? "普通折扣" : "Descuento general",
      lang === "zh" ? "VIP折扣" : "Descuento VIP",
      lang === "zh" ? "备货" : "Stock",
      lang === "zh" ? "备货时间" : "Fecha stock",
      lang === "zh" ? "备货数量" : "Cantidad stock",
      lang === "zh" ? "发货数量" : "Cantidad",
      lang === "zh" ? "备货剩余" : "Stock restante",
      lang === "zh" ? "产品金额" : "Monto producto",
      lang === "zh" ? "结算金额" : "Monto liquidado",
      lang === "zh" ? "代发费" : "Cargo servicio",
      lang === "zh" ? "结算日期" : "Fecha liquidacion",
      lang === "zh" ? "状态" : "Estado",
    ];

    if (actionType === "export_weekly_statement") {
      const response = await fetch(`/api/dropshipping/finance/${financePreview.customerId}/export/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            customerName: financePreview.customerName,
            statementNumber: financeCurrentStatementNumber || `BS-${exportDateCode}`,
            generatedDateText: fmtDateOnly(financeStatementDisplayDateValue, lang),
            orderCount: statementData.orders.length,
            statusText: financeStatementHasUnpaid ? (lang === "zh" ? "未结" : "Con pendientes") : (lang === "zh" ? "已结" : "Liquidado"),
            hasUnpaid: financeStatementHasUnpaid,
            cycleText:
              lang === "zh"
                ? (() => {
                    return `结算周期：${financeCurrentCycleText}`;
                  })()
                : `Periodo: ${financeCurrentCycleText}`,
            rateText:
              lang === "zh"
                ? `${
                    settlementMode === "MXN"
                      ? `结算汇率：1 RMB = ${financeStatementDisplayRate.rateValue ? (1 / financeStatementDisplayRate.rateValue).toFixed(4) : "-"} MXN`
                      : `结算汇率：1 MXN = ${financeStatementDisplayRate.rateValue ? financeStatementDisplayRate.rateValue.toFixed(4) : "-"} RMB`
                  }    ${fmtDateOnly(financeStatementDisplayDateValue, lang)}汇率   来源：${financeStatementDisplayRate.sourceName || "-"}`
                : (
                    settlementMode === "MXN"
                      ? `Tipo de cambio: 1 RMB = ${financeStatementDisplayRate.rateValue ? (1 / financeStatementDisplayRate.rateValue).toFixed(4) : "-"} MXN`
                      : `Tipo de cambio: 1 MXN = ${financeStatementDisplayRate.rateValue ? financeStatementDisplayRate.rateValue.toFixed(4) : "-"} RMB`
                  ),
            serviceFeeDisplay:
              financeStatementPreparedData?.serviceFeeDisplay
              || `${settlementMode === "MXN" ? "$" : "￥"}0.00 / ${lang === "zh" ? "单" : "pedido"}`,
            mxnSubtotalText: `$${fmtMoney(totalProductAmount, lang)}`,
            cnySubtotalText: formatSettlementAmount(totalConvertedAmount, settlementMode, lang),
            serviceFeeTotalText: formatSettlementAmount(totalShippingFee, settlementMode, lang),
            rawServiceFeeRmbText: `￥${fmtMoney(statementData.rawServiceFeeTotal || 0, lang)}`,
            payableTotalText: formatSettlementAmount(totalPayableAmount, settlementMode, lang),
            isGenerated: Boolean(financeStatementLockState?.isGenerated),
            settlementMode,
            noteLines:
              settlementMode === "MXN"
                ? (
                    lang === "zh"
                      ? [
                          "1. 商品按墨西哥比索（MXN）计价。",
                          financeStatementVipEnabled
                            ? "2. 产品金额按备货优先消耗；无备货部分再按发货数量、普通折扣和 VIP 折扣计算。"
                            : "2. 产品金额按备货优先消耗；无备货部分再按发货数量和普通折扣计算。",
                          "3. 代发费先按人民币确定，再按结算汇率折算为比索。",
                          "4. 合计 = 商品金额（MXN） + 当行代发费（MXN）。",
                        ]
                      : [
                          "1. Los productos se cotizan en MXN.",
                          financeStatementVipEnabled
                            ? "2. El monto usa stock primero; sin stock, cobra por cantidad enviada y descuentos."
                            : "2. El monto usa stock primero; sin stock, cobra por cantidad enviada y descuento general.",
                          "3. El servicio se define en RMB y luego se convierte a MXN.",
                          "4. Total MXN = productos + servicio por fila.",
                        ]
                  )
                : (
                    lang === "zh"
                      ? [
                          "1. 商品按墨西哥比索（MXN）计价。",
                          financeStatementVipEnabled
                            ? "2. 产品金额按备货优先消耗；无备货部分再按发货数量、普通折扣和 VIP 折扣计算。"
                            : "2. 产品金额按备货优先消耗；无备货部分再按发货数量和普通折扣计算。",
                          "3. 代发费按唯一物流单计入人民币费用。",
                          "4. 合计 = 折算 + 当行代发费。",
                        ]
                      : [
                          "1. Los productos se cotizan en MXN.",
                          financeStatementVipEnabled
                            ? "2. El monto usa stock primero; sin stock, cobra por cantidad enviada y descuentos."
                            : "2. El monto usa stock primero; sin stock, cobra por cantidad enviada y descuento general.",
                          "3. El servicio se cobra una vez por guia unica.",
                          "4. Total RMB = conversion RMB + servicio por fila.",
                        ]
                  ),
            orders: statementData.orders.map((item) => ({
              platformOrderNo: item.platformOrderNo,
              trackingNo: item.trackingNo || "-",
              shippedAtText: fmtDateOnly(item.shippedAt, lang),
              sku: item.sku,
              isStockedBadge: Boolean(item.stockBatchShouldBill),
              quantity: item.quantity,
              unitPriceText: item.unitPrice > 0 ? `$${fmtMoney(item.unitPrice, lang)}` : "-",
              normalDiscountText: item.normalDiscount > 0 ? `${fmtPercent(item.normalDiscount, lang)}%` : "-",
              vipDiscountText: financeStatementVipEnabled && item.vipDiscount > 0 ? `${fmtPercent(item.vipDiscount, lang)}%` : "-",
              productAmountText: item.displayProductAmount > 0 ? `$${fmtMoney(item.displayProductAmount, lang)}` : "-",
              convertedAmountText: item.displayConvertedAmount > 0 ? formatSettlementAmount(item.displayConvertedAmount, settlementMode, lang) : "-",
              shippingFeeText: item.displayShippingAmount > 0 ? formatSettlementAmount(item.displayShippingAmount, settlementMode, lang) : "-",
              totalAmountText: formatSettlementAmount(item.displayCnyTotalAmount, settlementMode, lang),
              highlightRed: "displayReincluded" in item ? item.displayReincluded : false,
            })),
            exportDateCode,
          },
        }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error || (lang === "zh" ? "导出账单失败" : "No se pudo exportar"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      anchor.href = url;
      anchor.download = match?.[1]
        ? decodeURIComponent(match[1])
        : `BS-${financePreview.customerName || "finance"}-${financeStatementIsPaid ? "本周已结账单" : "本周未结账单"}-${exportDateCode}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      void recordFinanceAction(financePreview, actionType, {
        statementNumber: financeCurrentStatementNumber,
        cycleText: financeCurrentCycleText,
      });
      return;
    }

    worksheet.getRow(1).height = 16;
    const brandCell = worksheet.getCell(2, 1);
    brandCell.value = "PARKSONMX";
    brandCell.font = {
      name: getExcelFontName("PARKSONMX", true),
      size: 14,
      bold: true,
      color: { argb: "FF2F3C7F" },
    };
    brandCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(2).height = 24;
    worksheet.getRow(3).height = 16;

    worksheet.mergeCells(4, 1, 4, headerLabels.length);
    const companyCell = worksheet.getCell(4, 1);
    const companyLabel = lang === "zh" ? "客户名称：" : "Cliente:";
    companyCell.value = {
      richText: [
        {
          text: companyLabel,
          font: {
            name: getExcelFontName(companyLabel, true),
            size: 11,
            bold: true,
            color: { argb: "FF111827" },
          },
        },
        {
          text: companyTitle,
          font: {
            name: getExcelFontName(companyTitle, false),
            size: 11,
            bold: false,
            color: { argb: "FF111827" },
          },
        },
      ],
    };
    companyCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(4).height = 22;

    const summaryLines = [
      {
        title: lang === "zh" ? "商品金额：" : "Monto producto:",
        value: `$ ${fmtMoney(totalProductAmount, lang)}`,
      },
      {
        title: `${settlementLabels.productSettlement}${lang === "zh" ? "：" : ":"}`,
        value: formatSettlementAmount(totalConvertedAmount, settlementMode, lang),
        suffix: rateHintText,
      },
      {
        title: `${settlementLabels.serviceFee}${lang === "zh" ? "：" : ":"}`,
        value: formatSettlementAmount(totalShippingFee, settlementMode, lang),
      },
      {
        title: lang === "zh" ? "合计金额：" : "Monto total:",
        value: formatSettlementAmount(totalPayableAmount, settlementMode, lang),
      },
      {
        title: lang === "zh" ? "已结：" : "Pagado:",
        value: formatSettlementAmount(totalPaidAmount, settlementMode, lang),
        valueColor: "FF059669",
      },
      {
        title: lang === "zh" ? "未结：" : "Pendiente:",
        value: formatSettlementAmount(totalUnpaidAmount, settlementMode, lang),
        valueColor: "FFE11D48",
      },
    ];

    summaryLines.forEach((line, index) => {
      const rowNumber = index + 5;
      worksheet.mergeCells(rowNumber, 1, rowNumber, headerLabels.length);
      const cell = worksheet.getCell(rowNumber, 1);
      cell.value = {
        richText: [
          {
            text: line.title,
            font: {
              name: getExcelFontName(line.title, true),
              size: 11,
              bold: true,
              color: { argb: "FF111827" },
            },
          },
          {
            text: line.value,
            font: {
              name: getExcelFontName(line.value, false),
              size: 11,
              bold: false,
              color: { argb: line.valueColor || "FF111827" },
            },
          },
          ...(line.suffix
            ? [
                {
                  text: "   ",
                  font: {
                    name: getExcelFontName(line.value, false),
                    size: 11,
                    bold: false,
                    color: { argb: "FF111827" },
                  },
                },
                {
                  text: line.suffix,
                  font: {
                    name: getExcelFontName(line.suffix, false),
                    size: 9,
                    bold: false,
                    color: { argb: "FF111827" },
                  },
                },
              ]
            : []),
        ],
      };
      cell.alignment = { horizontal: "left", vertical: "middle" };
      worksheet.getRow(rowNumber).height = 22;
    });

    worksheet.getRow(11).height = 18;
    worksheet.getRow(12).height = 18;
    const exportDateCell = worksheet.getCell(12, headerLabels.length);
    exportDateCell.value = exportDateText;
    exportDateCell.font = {
      name: getExcelFontName(exportDateText, false),
      size: 10,
      bold: false,
      color: { argb: "FF111827" },
    };
    exportDateCell.alignment = { horizontal: "right", vertical: "middle" };

    const headerRow = worksheet.getRow(13);
    headerLabels.forEach((label, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = label;
      cell.font = {
        name: getExcelFontName(label, true),
        size: 11,
        bold: true,
        color: { argb: "FF000000" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9E1EA" } },
        left: { style: "thin", color: { argb: "FFD9E1EA" } },
        bottom: { style: "thin", color: { argb: "FFD9E1EA" } },
        right: { style: "thin", color: { argb: "FFD9E1EA" } },
      };
    });
    headerRow.height = 24;

    for (const item of statementData.orders) {
      const exportProductAmount = item.displayProductAmount;
      const exportDisplayReincluded = "displayReincluded" in item ? item.displayReincluded : false;
      const exportDisplayIsStocked = "displayIsStocked" in item ? item.displayIsStocked : item.exportIsStocked;
      const exportDisplayStockedAt = "displayStockedAt" in item ? item.displayStockedAt : null;
      const exportDisplayStockedQty = "displayStockedQty" in item ? item.displayStockedQty : item.exportStockedQty;
      const exportRemainingQty =
        "skuStockInfo" in item
          ? item.skuStockInfo?.isStocked && typeof item.exportRemainingQty === "number"
            ? String(item.exportRemainingQty)
            : "-"
          : typeof item.exportRemainingQty === "number"
            ? String(item.exportRemainingQty)
            : "-";
      const row = worksheet.addRow([
        item.platformOrderNo,
        item.trackingNo || "",
        fmtDateOnly(item.shippedAt, lang),
        item.sku,
        item.productNameZh || "",
        item.unitPrice > 0 ? `$${fmtMoney(item.unitPrice, lang)}` : "-",
        item.normalDiscount > 0 ? `${fmtPercent(item.normalDiscount, lang)}%` : "-",
        item.vipDiscount > 0 ? `${fmtPercent(item.vipDiscount, lang)}%` : "-",
        exportDisplayIsStocked ? (lang === "zh" ? "备" : "Stock") : "-",
        exportDisplayIsStocked && exportDisplayStockedAt ? fmtDateOnly(exportDisplayStockedAt, lang) : "-",
        exportDisplayIsStocked && exportDisplayStockedQty > 0 ? String(exportDisplayStockedQty) : "-",
        item.quantity,
        exportRemainingQty,
        exportProductAmount > 0 ? `$${fmtMoney(exportProductAmount, lang)}` : "-",
        item.displayConvertedAmount > 0 ? formatSettlementAmount(item.displayConvertedAmount, settlementMode, lang) : "-",
        item.displayShippingAmount > 0 ? formatSettlementAmount(item.displayShippingAmount, settlementMode, lang) : "-",
        fmtDateOnly(getMexicoWeekSaturdayValue(item.shippedAt) || item.settledAt, lang),
        getSettlementStatusLabel(item.settlementStatus, lang),
      ]);
      row.height = 30;
      row.eachCell((cell) => {
        const text = String(cell.value ?? "");
        cell.font = {
          name: getExcelFontName(text, false),
          size: 10.5,
          bold: false,
          color: { argb: exportDisplayReincluded ? "FFE11D48" : "FF111827" },
        };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5EAF1" } },
          left: { style: "thin", color: { argb: "FFE5EAF1" } },
          bottom: { style: "thin", color: { argb: "FFE5EAF1" } },
          right: { style: "thin", color: { argb: "FFE5EAF1" } },
        };
      });
      [3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].forEach((columnIndex) => {
        row.getCell(columnIndex).alignment = { vertical: "middle", horizontal: "center" };
      });
      const statusCell = row.getCell(17);
      const statusText = String(statusCell.value ?? "");
      statusCell.font = {
        name: getExcelFontName(statusText, false),
        size: 10.5,
        bold: false,
        color: { argb: exportDisplayReincluded ? "FFE11D48" : statusText === (lang === "zh" ? "已结" : "Liquidado") ? "FF059669" : "FFE11D48" },
      };
      const stockedCell = row.getCell(9);
      const stockedText = String(stockedCell.value ?? "");
      stockedCell.font = {
        name: getExcelFontName(stockedText, false),
        size: 10.5,
        bold: false,
        color: { argb: exportDisplayReincluded ? "FFE11D48" : "FF111827" },
      };
    }

    worksheet.columns = [
      { width: 22 },
      { width: 20 },
      { width: 14 },
      { width: 14 },
      { width: 20 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 14 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 14 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
    ];
    worksheet.views = [{ state: "frozen", ySplit: 13, showGridLines: false }];
    const safeCustomerName = (financePreview.customerName || "finance")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim();
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `BS-${safeCustomerName || "finance"}-${lang === "zh" ? "详情" : "detalle"}-${exportDateCode}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    void recordFinanceAction(financePreview, actionType, {
      statementNumber: financeStatementSummary?.statementNumber,
      cycleText: financeStatementCycleText,
    });
  };

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
        <span className="whitespace-nowrap text-sm text-slate-500">
          {lang === "zh" ? `共有：${filteredOrders.length}订单` : `Total: ${filteredOrders.length} pedidos`}
        </span>
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
      if (overviewCustomerFilter !== "all" && row.customerId !== overviewCustomerFilter) return false;
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

    const rangedCustomerIds = new Set(rangedOrders.map((row) => row.customerId).filter(Boolean));
    receivable = 0;
    paid = 0;
    pending = 0;
    const financeSummaryCustomerMap = new Map<string, { customerId: string; customerName: string; totalAmount: number; paidAmount: number; unpaidAmount: number }>();
    for (const row of finance.filter((item) => rangedCustomerIds.has(item.customerId))) {
      const exportSummary = financeExportSummaryByCustomerId.get(row.customerId);
      const filteredOrders =
        exportSummary?.orders.filter((item) => {
          if (!item.shippedAt) return false;
          const shippedAt = new Date(item.shippedAt);
          return shippedAt >= rangeStart && shippedAt < rangeEnd;
        }) || [];
      const summary = filteredOrders.length > 0
        ? {
            totalAmount: filteredOrders.reduce((sum, item) => sum + item.displayCnyTotalAmount, 0),
            paidAmount: filteredOrders
              .filter((item) => item.settlementStatus === "paid")
              .reduce((sum, item) => sum + item.displayCnyTotalAmount, 0),
            unpaidAmount: filteredOrders
              .filter((item) => item.settlementStatus !== "paid")
              .reduce((sum, item) => sum + item.displayCnyTotalAmount, 0),
          }
        : null;
      const totalAmount = summary?.totalAmount ?? 0;
      const paidAmount = summary?.paidAmount ?? 0;
      const unpaidAmount = summary?.unpaidAmount ?? 0;
      receivable += totalAmount;
      paid += paidAmount;
      pending += unpaidAmount;
      const existing = customerMap.get(row.customerId);
      const currentCustomerName = existing?.customerName || row.customerName;
      const currentOrderCount = existing?.orderCount || 0;
      customerMap.set(row.customerId, {
        customerId: row.customerId,
        customerName: currentCustomerName,
        orderCount: currentOrderCount,
        totalAmount,
        paidAmount,
        unpaidAmount,
      });
      financeSummaryCustomerMap.set(row.customerId, {
        customerId: row.customerId,
        customerName: currentCustomerName,
        totalAmount,
        paidAmount,
        unpaidAmount,
      });
    }

    const periodOrderCount = rangedOrders.length;
    const periodShippedCount = rangedOrders.filter((row) => row.shippingStatus === "shipped").length;
    const periodPendingCount = rangedOrders.filter((row) => row.shippingStatus !== "shipped").length;
    const unsettledCustomers = Array.from(financeSummaryCustomerMap.values()).filter((item) => item.unpaidAmount > 0.0001).length;

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
        { type: "low_inventory" as const, count: inventory.filter((row) => row.isStocked && row.status !== "healthy").length },
        { type: "missing_stock_record" as const, count: inventory.filter((row) => !row.isStocked).length },
        { type: "customer_unsettled" as const, count: unsettledCustomers },
      ],
    };
  }, [exchangeRate.rateValue, finance, financeExportSummaryByCustomerId, inventory, lang, now, orders, overviewCustomerFilter, overviewRange]);
  function openCreateModal() {
    setForm({
      ...EMPTY_ORDER_FORM,
      warehouse: FIXED_WAREHOUSE,
      color: lang === "zh" ? "随机" : "Aleatorio",
    });
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
      sku: source.sku.trim(),
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
    const normalizedOrderNo = source.platformOrderNo.trim();
    const normalizedTrackingNo = source.trackingNo.trim();
    if (!normalizedTrackingNo) {
      throw new Error("missing_tracking_no");
    }
    if (!source.id && normalizedOrderNo && normalizedOrderNo === normalizedTrackingNo) {
      throw new Error("same_order_and_tracking_no");
    }
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
          shippingFee: form.shippingFee,
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

  function handleOrderSaveError(rawError: unknown) {
    const message = rawError instanceof Error ? rawError.message : "save_failed";
    if (message === "missing_tracking_no") {
      setError(
        lang === "zh"
          ? "物流号必须填写"
          : "La guia es obligatoria.",
      );
      return;
    }
    if (message === "same_order_and_tracking_no") {
      setError(
        lang === "zh"
          ? "订单号和物流号不能相同"
          : "El numero de pedido y la guia no pueden ser iguales.",
      );
      return;
    }
    if (message === "duplicate_platform_order_no") {
      setDuplicateAlertMessage(
        lang === "zh"
          ? "此订单号已存在，请检查"
          : "Este numero de pedido ya existe. Revisalo.",
      );
      setError("");
      return;
    }
    if (message === "duplicate_tracking_no") {
      setDuplicateAlertMessage(
        lang === "zh"
          ? "此物流号已存在，请检查"
          : "Esta guia ya existe. Revisala.",
      );
      setError("");
      return;
    }
    setError(message);
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
      setDuplicateAlertMessage("");
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
      await refreshData(["orders", "inventory", "finance", "overview", "rate"]);
      const freshOrders = await fetchOrdersOnly();
      setOrders(freshOrders);
      const refreshedCurrent = freshOrders.find((row) => row.id === orderId);
      if (refreshedCurrent) {
        openEditModal(refreshedCurrent, modalPrimaryOrderId || form.id || refreshedCurrent.id);
      }
    } catch (groupError) {
      handleOrderSaveError(groupError);
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
    setGroupedDeleteTarget(null);

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/dropshipping/orders/${slot.orderId}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "delete_failed");
      }
      await refreshData(["orders", "inventory", "finance", "overview", "rate"]);
      const freshOrders = await fetchOrdersOnly();
      setOrders(freshOrders);
      const currentOrderId = form.id || modalPrimaryOrderId;
      const refreshed = currentOrderId ? freshOrders.find((row) => row.id === currentOrderId) : null;
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
    const slotKey = `${type}-${slotIndex}`;
    const isDragActive = draggingAttachmentSlot === slotKey;
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
        onDragOver={(event) => handleAttachmentDragOver(event, type, slotIndex)}
        onDragEnter={(event) => handleAttachmentDragOver(event, type, slotIndex)}
        onDragLeave={() => handleAttachmentDragLeave(type, slotIndex)}
        onDrop={(event) => handleAttachmentDrop(event, type, slotIndex)}
        className={`relative rounded-xl border bg-white transition ${
          isDragActive ? "border-primary ring-2 ring-primary/15" : "border-slate-200"
        } ${isEmpty ? "p-0" : "p-2.5"}`}
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
              <span className="text-[11px] font-medium">
                {isDragActive
                  ? (lang === "zh" ? "松开上传" : "Soltar para subir")
                  : (lang === "zh" ? "添加附件" : "Agregar")}
              </span>
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
        {!isEmpty && type === "proof" ? (
          <button
            type="button"
            onClick={() => clearAttachmentSlot(type, slotIndex)}
            className="absolute bottom-3 right-3 inline-flex h-6 items-center justify-center rounded-lg border border-rose-200 bg-white px-2 text-[10px] font-medium text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            {lang === "zh" ? "去除" : "Quitar"}
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
      setDuplicateAlertMessage("");
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
      await refreshData(["orders", "inventory", "finance", "overview", "rate"]);
    } catch (submitError) {
      handleOrderSaveError(submitError);
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
    const initialQty = row.inventoryId
      ? Math.max(row.stockedQty, 0)
      : Math.max(row.shippedQty, 1);
    setInventoryEdit({
      mode: row.inventoryId ? "edit" : "create",
      id: row.inventoryId || "",
      orderId: row.orderId,
      trackingNo: row.trackingNo || "",
      customerId: row.customerId,
      customerName: row.customerName,
      productCatalogId: "",
      productId: row.productId,
      sku: row.sku,
      productNameZh: row.productNameZh,
      productNameEs: row.productNameEs || "",
      isStocked: row.inventoryId ? row.isStocked : true,
      stockedAt: toDateInputValue(row.inventoryId ? row.stockedAt : (row.stockedAt || row.shippedAt)),
      stockedQty: String(initialQty),
      stockAmount: computeInventoryAmount(
        String(row.unitPrice ?? ""),
        String(initialQty),
        formatDiscountPercentInput(row.discountRate),
      ),
      unitPrice: String(row.unitPrice ?? ""),
      unitPriceLocked: true,
      discountRate: formatDiscountPercentInput(row.discountRate),
      warehouse: FIXED_WAREHOUSE,
      remainingQty: row.remainingQty,
      status: row.status,
    });
    setInventoryProductQuery(buildInventoryProductDisplay(row.sku, row.productNameZh, row.productNameEs));
  }

  async function beginInventoryCreate() {
    try {
      setError("");
      let customerOptions = inventoryCustomers;
      if (customerOptions.length === 0) {
        const response = await fetch("/api/dropshipping/inventory/options");
        const json = await response.json();
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || "inventory_options_failed");
        }
        customerOptions = Array.isArray(json.customers) ? json.customers : [];
        setInventoryCustomers(customerOptions);
      }
      const defaultCustomer =
        inventoryCustomerFilter !== "all"
          ? customerOptions.find((row) => row.name === inventoryCustomerFilter) || null
          : customerOptions.length === 1
            ? customerOptions[0]
            : null;
      setInventoryEdit({
        mode: "create",
        id: "",
        orderId: "",
        trackingNo: "",
        customerId: defaultCustomer?.id || "",
        customerName: defaultCustomer?.name || "",
        productCatalogId: "",
        productId: "",
        sku: "",
        productNameZh: "",
        productNameEs: "",
        isStocked: false,
        stockedAt: "",
        stockedQty: "0",
        stockAmount: "",
        unitPrice: "",
        unitPriceLocked: false,
        discountRate: "",
        warehouse: FIXED_WAREHOUSE,
        remainingQty: null,
        status: null,
      });
      setInventoryProductQuery("");
      setInventoryProductOptions([]);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "inventory_options_failed");
    }
  }

  function openInventoryExport() {
    setInventoryExport({
      stocked: "all",
      status: "all",
      skuKeyword: "",
      includeAllShipped: false,
    });
  }

  function getInventoryExportMode(state: InventoryExportState): InventoryExportMode {
    if (!state) return null;
    if (state.stocked !== "all") return "stocked";
    if (state.status !== "all") return "status";
    if (state.skuKeyword.trim()) return "sku";
    if (state.includeAllShipped) return "allShipped";
    return null;
  }

  function resetInventoryExportState(): NonNullable<InventoryExportState> {
    return {
      stocked: "all",
      status: "all",
      skuKeyword: "",
      includeAllShipped: false,
    };
  }

  function exportFilteredInventory(kind: "xlsx" | "pdf") {
    if (!inventoryExport) return;
    const searchParams = new URLSearchParams();
    if (inventoryExport.stocked !== "all") searchParams.set("stocked", inventoryExport.stocked);
    if (inventoryExport.status !== "all") searchParams.set("status", inventoryExport.status);
    if (inventoryExport.skuKeyword.trim()) searchParams.set("sku", inventoryExport.skuKeyword.trim());
    if (!inventoryExport.includeAllShipped) searchParams.set("allShipped", "0");
    triggerBrowserDownload(`/api/dropshipping/inventory/export/${kind}?${searchParams.toString()}`);
  }

  function pickInventoryProduct(option: InventoryProductOption) {
    const qty = Number(inventoryEdit?.stockedQty || 0);
    const pickedUnitPrice = Number(option.unitPrice || 0);
    const pickedDiscount = Number(option.discountRate || 0);
    const nextAmount = qty > 0 && pickedUnitPrice > 0
      ? Math.round(pickedUnitPrice * qty * (1 - (Math.abs(pickedDiscount) <= 1 ? pickedDiscount : pickedDiscount / 100)) * 100) / 100
      : 0;
    setInventoryEdit((prev) => (prev ? {
      ...prev,
      productCatalogId: option.id,
      sku: option.sku,
      productNameZh: option.nameZh || option.sku,
      productNameEs: option.nameEs || "",
      unitPrice: option.unitPrice || "",
      unitPriceLocked: Boolean(option.unitPrice),
      discountRate: option.discountRate
        ? formatDiscountPercentInput(option.discountRate)
        : prev.discountRate,
      stockAmount: nextAmount > 0 ? String(nextAmount) : prev.stockAmount,
    } : prev));
    setInventoryProductQuery(buildInventoryProductDisplay(option.sku, option.nameZh, option.nameEs));
    setInventoryProductOptions([]);
  }

  async function saveInventoryEdit() {
    if (!inventoryEdit) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const stockedQty = inventoryEdit.isStocked ? Number(inventoryEdit.stockedQty || 0) : 0;
      const unitPrice = inventoryEdit.unitPrice.trim();
      const discountRate = inventoryEdit.discountRate.trim();
      const stockedAt = inventoryEdit.stockedAt.trim();
      const savedSku = inventoryEdit.sku;
      const savedQtyText = inventoryEdit.isStocked ? `${stockedQty}` : "0";
      if (inventoryEdit.mode === "create") {
        if (!inventoryEdit.customerId && !inventoryEdit.sku) {
          throw new Error(lang === "zh" ? "请选择客户和产品" : "Selecciona cliente y producto");
        }
        if (!inventoryEdit.customerId) {
          throw new Error(lang === "zh" ? "请选择客户" : "Selecciona cliente");
        }
        if (!inventoryEdit.sku) {
          throw new Error(lang === "zh" ? "请选择产品" : "Selecciona producto");
        }
      }
      const discountRateValue = discountRate === "" ? null : Number(discountRate) / 100;
      const unitPriceValue = unitPrice === "" ? null : Number(unitPrice);

      const response = await fetch(
        inventoryEdit.mode === "create" ? "/api/dropshipping/inventory" : `/api/dropshipping/inventory/${inventoryEdit.id}`,
        {
          method: inventoryEdit.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: inventoryEdit.orderId || null,
            customerId: inventoryEdit.customerId,
            productCatalogId: inventoryEdit.productCatalogId || null,
            sku: inventoryEdit.sku,
            productNameZh: inventoryEdit.productNameZh,
            productNameEs: inventoryEdit.productNameEs,
            isStocked: inventoryEdit.isStocked,
            stockedAt: stockedAt || null,
            stockedQty,
            unitPrice: unitPriceValue,
            discountRate: discountRateValue,
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
      setInventoryKeyword(savedSku);
      setInventoryPage(1);
      setRecentSavedInventorySku(savedSku);
      setSuccess(
        lang === "zh"
          ? `备货已保存：${savedSku} × ${savedQtyText}`
          : `Stock guardado: ${savedSku} × ${savedQtyText}`,
      );
      await refreshData(["inventory", "overview"]);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeInventoryRow(row: DsInventoryRow) {
    setInventoryDeleteTarget({ row, kind: "inventory" });
  }

  async function removeShippedItemRow(row: DsInventoryRow) {
    setInventoryDeleteTarget({ row, kind: "shipped" });
  }

  async function confirmInventoryDelete() {
    if (!inventoryDeleteTarget) return;
    try {
      setSaving(true);
      setError("");
      const response = inventoryDeleteTarget.kind === "inventory"
        ? await fetch(`/api/dropshipping/inventory/${inventoryDeleteTarget.row.inventoryId}`, {
            method: "DELETE",
          })
        : await fetch(`/api/dropshipping/orders/${inventoryDeleteTarget.row.orderId}`, {
            method: "DELETE",
          });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "delete_failed");
      }
      setInventoryDeleteTarget(null);
      await refreshData(
        inventoryDeleteTarget.kind === "inventory"
          ? ["inventory", "overview"]
          : ["orders", "inventory", "finance", "overview", "rate"],
      );
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
      await refreshData(["orders", "inventory", "finance", "overview", "rate"]);
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
      await refreshData(["orders", "inventory", "finance", "overview", "rate"]);
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

  async function openOrderFileImportPreview(file: File) {
    try {
      setOrderFileImporting(true);
      setError("");
      setSuccess("");
      setOrderImportPreviewError("");
      setOrderImportPreviewRows([]);
      setOrderImportPreviewFileName(file.name || "");
      if (customerFilter === "all") {
        throw new Error(lang === "zh" ? "请先筛选客户后再导入订单文件" : "Selecciona un cliente antes de importar");
      }

      const importedRows = await parseImportedOrderFile(file);
      if (importedRows.length === 0) {
        throw new Error(lang === "zh" ? "导入文件里没有可用订单数据" : "No hay pedidos validos en el archivo");
      }
      const duplicateErrorMap = buildImportedOrderDuplicateErrors(importedRows, orders);
      setOrderImportPreviewPage(1);
      setOrderImportPreviewRows(
        importedRows.map((item, index) => ({
          ...item,
          duplicateError: duplicateErrorMap.get(index) || "",
        })),
      );
      setOrderImportPreviewOpen(true);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "import_failed";
      if (message === "import_columns_missing") {
        setOrderImportPreviewError(
          lang === "zh"
            ? "导入文件缺少必需列：平台、订单编号、发货时间、商品SKU、产品数量、跟踪号"
            : "Faltan columnas requeridas: plataforma, pedido, fecha, SKU, cantidad y guia",
        );
      } else if (message === "import_sheet_missing") {
        setOrderImportPreviewError(lang === "zh" ? "导入文件没有工作表" : "El archivo no tiene hojas");
      } else {
        setOrderImportPreviewError(message);
      }
      setOrderImportPreviewOpen(true);
    } finally {
      if (orderImportInputRef.current) {
        orderImportInputRef.current.value = "";
      }
      setOrderFileImporting(false);
    }
  }

  async function confirmOrderFileImport() {
    try {
      setOrderFileImporting(true);
      setError("");
      setSuccess("");
      const importedRows = orderImportPreviewRows;
      if (importedRows.length === 0) {
        throw new Error(lang === "zh" ? "没有可导入的数据" : "No hay datos para importar");
      }
      const invalidRows = importedRows.filter((item) =>
        !item.platform
        || !item.platformOrderNo
        || !item.trackingNo
        || !item.shippedAt
        || !item.sku
        || !Number.isFinite(item.quantity)
        || item.quantity <= 0
        || !!item.duplicateError
      );
      if (invalidRows.length > 0) {
        setOrderImportPreviewError(
          lang === "zh"
            ? "预览里还有重复订单/跟踪号或未修正的行，请先处理后再确认导入。"
            : "Todavia hay filas duplicadas o incompletas en la vista previa. Corrigelas antes de importar.",
        );
        return;
      }
      const seenOrderNos = new Set<string>();
      let createdCount = 0;
      let skippedCount = 0;

      for (const item of importedRows) {
        if (seenOrderNos.has(item.platformOrderNo)) {
          skippedCount += 1;
          continue;
        }
        seenOrderNos.add(item.platformOrderNo);

        const responseId = await persistOrderRequest({
          id: "",
          trackingGroupId: "",
          customerName: customerFilter,
          platform: item.platform || "无",
          platformOrderNo: item.platformOrderNo,
          sku: item.sku,
          productNameZh: item.sku,
          productNameEs: "",
          quantity: String(item.quantity),
          trackingNo: item.trackingNo,
          color: "随机",
          warehouse: FIXED_WAREHOUSE,
          shippedAt: item.shippedAt,
          shippingFee: item.shippingFee,
          settlementStatus: "unpaid",
          shippingStatus: item.trackingNo ? "shipped" : "pending",
          notes: "",
        });

        if (responseId) {
          createdCount += 1;
        }
      }

      await refreshData(["orders", "inventory", "finance", "overview", "rate"]);
      setOrderPage(1);
      setOrderImportPreviewOpen(false);
      setOrderImportPreviewPage(1);
      setOrderImportPreviewRows([]);
      setOrderImportPreviewError("");
      setSuccess(
        lang === "zh"
          ? `订单文件已导入：新增 ${createdCount} 条，跳过 ${skippedCount} 条。`
          : `Archivo importado: ${createdCount} nuevos, ${skippedCount} omitidos.`,
      );
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "import_failed";
      if (message === "import_columns_missing") {
        setOrderImportPreviewError(
          lang === "zh"
            ? "导入文件缺少必需列：平台、订单编号、发货时间、商品SKU、产品数量、跟踪号"
            : "Faltan columnas requeridas: plataforma, pedido, fecha, SKU, cantidad y guia",
        );
      } else if (message === "import_sheet_missing") {
        setOrderImportPreviewError(lang === "zh" ? "导入文件没有工作表" : "El archivo no tiene hojas");
      } else {
        setOrderImportPreviewError(message);
      }
    } finally {
      setOrderFileImporting(false);
    }
  }

  function updateOrderImportPreviewRow(
    index: number,
    patch: Partial<Pick<ImportedOrderRow, "sku" | "shippingFee">>,
  ) {
    setOrderImportPreviewError("");
    setOrderImportPreviewRows((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const nextItem = {
          ...item,
          ...patch,
        };
        return {
          ...nextItem,
          parseError: buildImportedOrderRowError(nextItem),
          duplicateError: item.duplicateError,
        };
      }),
    );
  }

  const tabButtonClass = (tab: TabKey) =>
    `inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
      activeTab === tab ? "bg-primary text-white shadow-soft" : "bg-white text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <section className="-mt-[2px] space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["overview", "orders", "inventory", "finance"] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={tabButtonClass(tab)}
              onClick={() => {
                setOverviewAlertFilter(null);
                setActiveTab(tab);
              }}
            >
              {text.tabs[tab]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-3.5">
          <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
            <section className="self-start overflow-hidden rounded-[20px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_24%),linear-gradient(135deg,#ffffff_0%,#f8fbff_48%,#eef4ff_100%)] shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-white/60 px-3.5 py-2.5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{lang === "zh" ? "总览仪表板" : "Dashboard"}</div>
                  <div className="mt-1">
                    <select
                      value={overviewCustomerFilter}
                      onChange={(event) => setOverviewCustomerFilter(event.target.value)}
                      className="min-w-0 bg-transparent text-xs text-slate-500 outline-none"
                    >
                      {overviewCustomerOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">{overviewRangeLabel}</div>
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
              </div>

              <div className="grid gap-3 px-3.5 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(200px,0.68fr)]">
                <div className="min-w-0">
                  <div className="text-[1.75rem] font-semibold tracking-tight text-slate-900 sm:text-[1.95rem]">{fmtMoney(overviewDashboard.receivable, lang)}</div>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "客户订单总额" : "Monto total"}</div>
                      {(() => {
                        const amount = fmtDualCurrencyFromCny(overviewDashboard.receivable, exchangeRate.rateValue, lang);
                        return (
                          <div className="mt-1">
                            <div className="text-lg font-semibold text-slate-900">{amount.mxnText}</div>
                            <div className="text-base font-medium text-slate-400">{amount.cnyText}</div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "结款总额" : "Liquidado"}</div>
                      {(() => {
                        const amount = fmtDualCurrencyFromCny(overviewDashboard.paid, exchangeRate.rateValue, lang);
                        return (
                          <div className="mt-1">
                            <div className="text-lg font-semibold text-emerald-600">{amount.mxnText}</div>
                            <div className="text-base font-medium text-slate-400">{amount.cnyText}</div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="rounded-[18px] border border-white/70 bg-white/85 px-3 py-2">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "未结总额" : "Pendiente"}</div>
                      {(() => {
                        const amount = fmtDualCurrencyFromCny(overviewDashboard.pending, exchangeRate.rateValue, lang);
                        return (
                          <div className="mt-1">
                            <div className="text-lg font-semibold text-rose-600">{amount.mxnText}</div>
                            <div className="text-base font-medium text-slate-400">{amount.cnyText}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="mt-2.5 rounded-[18px] border border-white/70 bg-white/80 p-3">
                    <div className="mb-2 flex items-center justify-start gap-3 text-xs text-slate-500">
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
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleOverviewAlertClick(item.type)}
                    className="flex w-full items-start gap-3 rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-500">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900">{text.alerts[item.type]}</div>
                      <div className="mt-1 text-xs text-slate-500">{lang === "zh" ? "当前数量" : "Conteo actual"} · {item.count}</div>
                    </div>
                  </button>
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
                      {(() => {
                        const amount = fmtDualCurrencyFromCny(overview.stats.totalReceivable, exchangeRate.rateValue, lang);
                        return (
                          <div className="mt-2">
                            <div className="text-2xl font-semibold text-slate-900">{amount.mxnText}</div>
                            <div className="text-lg font-medium text-slate-400">{amount.cnyText}</div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "结款总额" : "Liquidado"}</div>
                      {(() => {
                        const amount = fmtDualCurrencyFromCny(overview.stats.totalPaid, exchangeRate.rateValue, lang);
                        return (
                          <div className="mt-2">
                            <div className="text-2xl font-semibold text-emerald-600">{amount.mxnText}</div>
                            <div className="text-lg font-medium text-slate-400">{amount.cnyText}</div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="text-xs text-slate-500">{lang === "zh" ? "未结总额" : "Pendiente"}</div>
                      {(() => {
                        const amount = fmtDualCurrencyFromCny(overview.stats.totalUnpaid, exchangeRate.rateValue, lang);
                        return (
                          <div className="mt-2">
                            <div className="text-2xl font-semibold text-rose-600">{amount.mxnText}</div>
                            <div className="text-lg font-medium text-slate-400">{amount.cnyText}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="mt-6 rounded-[28px] border border-white/70 bg-white/75 p-4 backdrop-blur">
                    <div className="mb-4 flex flex-wrap items-center justify-start gap-4 text-xs text-slate-500">
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
            <span className="whitespace-nowrap text-sm text-slate-500">
              {lang === "zh" ? `共有：${filteredOrderCount}订单` : `Total: ${filteredOrderCount} pedidos`}
            </span>
          }
          right={
            <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto lg:flex-nowrap">
              <input
                ref={orderImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void openOrderFileImportPreview(file);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => orderImportInputRef.current?.click()}
                disabled={orderFileImporting}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {orderFileImporting ? text.importing : text.importOrders}
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
              >
                {text.create}
              </button>
              <div className="relative w-full max-w-[760px] rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={lang === "zh" ? "\u641c\u7d22\u5e73\u53f0 / \u8ba2\u5355\u53f7 / \u7f16\u7801" : "Buscar plataforma / pedido / codigo"}
                  className="h-10 w-full rounded-xl bg-transparent px-3 pr-[386px] text-sm text-slate-700 outline-none"
                />
                <div className="absolute inset-y-1 right-1 flex items-center gap-1 border-l border-slate-200 pl-1.5">
                  <div className="relative shrink-0">
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                      className="h-8 min-w-[116px] appearance-none rounded-lg bg-transparent px-3 pr-8 text-sm text-slate-700 outline-none transition"
                    >
                      <option value="all">{lang === "zh" ? "\u5168\u90e8\u72b6\u6001" : "Todos"}</option>
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
                  <div className="relative shrink-0">
                    <select
                      value={customerFilter}
                      onChange={(event) => setCustomerFilter(event.target.value)}
                      className="h-8 min-w-[116px] appearance-none rounded-lg bg-transparent px-3 pr-8 text-sm text-slate-700 outline-none transition"
                    >
                      <option value="all">{lang === "zh" ? "\u5168\u90e8\u5ba2\u6237" : "Todos los clientes"}</option>
                      {customerOptions.map((customer) => (
                        <option key={customer} value={customer}>
                          {customer}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4 6 4 4 4-4" />
                      </svg>
                    </span>
                  </div>
                  <div className="relative shrink-0">
                    <select
                      value={settlementFilter}
                      onChange={(event) => setSettlementFilter(event.target.value as typeof settlementFilter)}
                      className="h-8 min-w-[116px] appearance-none rounded-lg bg-transparent px-3 pr-8 text-sm text-slate-700 outline-none transition"
                    >
                      <option value="all">{lang === "zh" ? "\u5168\u90e8\u7ed3\u7b97" : "Toda liquidacion"}</option>
                      <option value="paid">{lang === "zh" ? "\u5df2\u7ed3" : "Liquidado"}</option>
                      <option value="unpaid">{lang === "zh" ? "\u672a\u7ed3" : "Pendiente"}</option>
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
            <>
              <div className="overflow-x-auto">
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
                  {pagedVisibleOrders.map((row) => {
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
                                      fallbackSources: buildProductImageUrls(row.sku, ["jpg", "jpeg", "png", "webp"]),
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
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                <span>
                  {lang === "zh"
                    ? `共 ${filteredOrderCount} 条订单记录`
                    : `${filteredOrderCount} registros`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderPage(1)}
                    disabled={orderCurrentPage <= 1}
                    className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {lang === "zh" ? "第一页" : "Primera"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPage((prev) => Math.max(1, prev - 1))}
                    disabled={orderCurrentPage <= 1}
                    className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {lang === "zh" ? "上一页" : "Anterior"}
                  </button>
                  <span className="inline-flex h-7 min-w-[72px] items-center justify-center rounded-lg bg-primary px-3 font-medium text-white">
                    {orderCurrentPage}/{orderTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOrderPage((prev) => Math.min(orderTotalPages, prev + 1))}
                    disabled={orderCurrentPage >= orderTotalPages}
                    className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {lang === "zh" ? "下一页" : "Siguiente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPage(orderTotalPages)}
                    disabled={orderCurrentPage >= orderTotalPages}
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

      {activeTab === "inventory" ? (
        <TableCard
          title={text.sections.inventory}
          titleRight={
            <span className="whitespace-nowrap text-sm text-slate-500">
              {lang === "zh" ? `已发商品共：${filteredInventory.length}个` : `Productos enviados: ${filteredInventory.length}`}
            </span>
          }
          right={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <button
                type="button"
                onClick={openInventoryExport}
                className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <span className="whitespace-nowrap">{lang === "zh" ? "筛选导出" : "Exportar filtro"}</span>
              </button>
              <button
                type="button"
                onClick={() => void beginInventoryCreate()}
                className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                <span className="whitespace-nowrap">{lang === "zh" ? "新增备货" : "Nuevo stock"}</span>
              </button>
              <div className="relative w-full max-w-[560px] rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60">
                <input
                  value={inventoryKeyword}
                  onChange={(event) => setInventoryKeyword(event.target.value)}
                  placeholder={lang === "zh" ? "搜索编码 / 中文名" : "Buscar codigo / nombre"}
                  className="h-10 w-full rounded-xl bg-transparent pl-3 pr-[340px] text-sm text-slate-700 outline-none"
                />
                {inventoryKeywordStockSummary ? (
                  <div
                    className={`pointer-events-none absolute inset-y-0 right-[236px] flex items-center whitespace-nowrap text-sm font-bold ${inventoryKeywordStockSummary.className}`}
                  >
                    {inventoryKeywordStockSummary.text}
                  </div>
                ) : null}
                <div className="absolute inset-y-1 right-1 flex items-center border-l border-slate-200 pl-1.5">
                  <div className="relative">
                    <select
                      value={inventoryStockFilter}
                      onChange={(event) => setInventoryStockFilter(event.target.value as "all" | "stocked" | "unstocked")}
                      className="h-8 min-w-[96px] appearance-none rounded-lg bg-transparent px-3 pr-8 text-sm text-slate-700 outline-none transition"
                    >
                      <option value="all">{lang === "zh" ? "备货" : "Stock"}</option>
                      <option value="stocked">{lang === "zh" ? "已备货" : "Con stock"}</option>
                      <option value="unstocked">{lang === "zh" ? "无备货" : "Sin stock"}</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4 6 4 4 4-4" />
                      </svg>
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={inventoryCustomerFilter}
                      onChange={(event) => setInventoryCustomerFilter(event.target.value)}
                      className="h-8 min-w-[116px] appearance-none rounded-lg bg-transparent px-3 pr-8 text-sm text-slate-700 outline-none transition"
                    >
                      <option value="all">{lang === "zh" ? "全部客户" : "Todos"}</option>
                      {inventoryCustomerOptions.map((customer) => (
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
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.productImage}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.sku}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.productZh}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "单价" : "Precio"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "普通折扣" : "Dsc"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "备货数量" : "Cant. stock"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "备货金额" : "Monto stock"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setInventorySortDirection((prev) =>
                            inventorySortKey === "stockedAt" ? (prev === "asc" ? "desc" : "asc") : "desc",
                          );
                          setInventorySortKey("stockedAt");
                        }}
                        className="inline-flex items-center gap-1 text-slate-700"
                        title={lang === "zh" ? "按备货时间排序" : "Ordenar por fecha stock"}
                      >
                        <span>{lang === "zh" ? "备货时间" : "Fecha stock"}</span>
                        <SortDirectionIcon direction={inventorySortKey === "stockedAt" ? inventorySortDirection : "desc"} />
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "备货剩余" : "Restante stock"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{lang === "zh" ? "备货状态" : "Estado stock"}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">{text.fields.shipped}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setInventorySortDirection((prev) =>
                            inventorySortKey === "shippedAt" ? (prev === "asc" ? "desc" : "asc") : "desc",
                          );
                          setInventorySortKey("shippedAt");
                        }}
                        className="inline-flex items-center gap-1 text-slate-700"
                        title={lang === "zh" ? "按发货时间排序" : "Ordenar por fecha envio"}
                      >
                        <span>{lang === "zh" ? "发货时间" : "Fecha envio"}</span>
                        <SortDirectionIcon direction={inventorySortKey === "shippedAt" ? inventorySortDirection : "desc"} />
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInventory.map((row) => (
                    <tr
                      key={row.rowKey}
                      className={`border-t border-slate-100 ${
                        recentSavedInventorySku && row.sku === recentSavedInventorySku ? "bg-emerald-50/70" : ""
                      }`}
                    >
                      <td className="px-4 py-2 text-sm text-slate-700">
                        <div className="flex min-h-8 items-center justify-start">
                          {row.productImageUrl && !failedInventoryImages.includes(row.rowKey) ? (
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
                                    prev.includes(row.rowKey) ? prev : [...prev, row.rowKey],
                                  )
                                }
                              />
                            </button>
                          ) : (
                            <span className="text-slate-400">{lang === "zh" ? "空" : "Vacio"}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{row.sku}</span>
                          {row.isStocked ? (
                            <button
                              type="button"
                              onClick={() =>
                                setInventoryShippedPreview({
                                  customerId: row.customerId,
                                  customerName: row.customerName,
                                  sku: row.sku,
                                  productNameZh: row.productNameZh,
                                  trackingNo: row.trackingNo,
                                  orderId: row.orderId,
                                  mode: "related",
                                })
                              }
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white transition hover:bg-primary/90"
                              title={lang === "zh" ? "查看相关发货记录" : "Ver pedidos enviados relacionados"}
                              aria-label={lang === "zh" ? "查看相关发货记录" : "Ver pedidos enviados relacionados"}
                            >
                              备
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">{row.productNameZh}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">${fmtMoney(row.unitPrice, lang)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{fmtPercent(row.discountRate, lang)}%</td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {row.isStocked ? row.stockedQty : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {row.isStocked ? `$${fmtMoney(row.stockAmount, lang)}` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {row.isStocked && row.stockedAt ? fmtDateOnly(row.stockedAt, lang) : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {row.isStocked ? row.remainingQty : "-"}
                      </td>
                      <td className={`px-4 py-2 text-sm ${row.isStocked ? getInventoryStatusClass(row.status) : "text-slate-700"}`}>
                        {row.isStocked ? text.status[row.status] : "-"}
                      </td>
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
                                trackingNo: row.trackingNo,
                                orderId: row.orderId,
                                mode: "exact",
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
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {row.shippedAt ? fmtDateOnly(row.shippedAt, lang) : "-"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void (row.inventoryId ? removeInventoryRow(row) : removeShippedItemRow(row))}
                            title={lang === "zh" ? "删除" : "Eliminar"}
                            aria-label={lang === "zh" ? "删除" : "Eliminar"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition hover:border-rose-300 hover:text-rose-600"
                          >
                            <TrashIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => beginInventoryEdit(row)}
                            title={lang === "zh" ? "编辑" : "Editar"}
                            aria-label={lang === "zh" ? "编辑" : "Editar"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <PencilIcon />
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
                  ? `共 ${filteredInventory.length} 条已发商品记录`
                  : `${filteredInventory.length} registros enviados`}
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
            <a
              href="https://wise.com/zh-cn/currency-converter/mxn-to-cny-rate"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 text-sm text-slate-500"
            >
              <span className="whitespace-nowrap">
                {lang === "zh"
                  ? `${fmtFinanceRateDateLabel(financeRateDate, lang)}汇率`
                  : "Tipo de cambio"}: {financeDisplayRate?.toFixed(4) || "-"}
              </span>
              <span className="whitespace-nowrap">
                {lang === "zh" ? "来源" : "Fuente"}: {exchangeRate.sourceName || "-"}
              </span>
            </a>
          }
          right={
            showSaturdaySettlementReminder ? (
              <div className="relative inline-flex items-center">
                <div
                  className="finance-reminder-breath relative inline-flex items-center rounded-full bg-secondary-accent px-4 py-2 text-sm font-semibold text-primary shadow-[0_1px_4px_rgba(47,60,127,0.12)] ring-1 ring-primary/15"
                >
                  {lang === "zh" ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span>{`今天是${fmtDateOnly(getMexicoTodayDateValue(), lang)}，周六-结账日，请点击下面`}</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/20 bg-white/70 text-primary">
                      <EyeIcon />
                    </span>
                    <span>浏览并生成结账单</span>
                    </span>
                  ) : (
                    `Hoy es ${fmtDateOnly(getMexicoTodayDateValue(), lang)}, revisa y genera el estado de cuenta.`
                  )}
                </div>
              </div>
            ) : null
          }
        >
          {filteredFinance.length === 0 ? (
            <EmptyState title={text.empty.title} description={text.empty.desc} />
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 text-left text-sm text-slate-700">
                      <th className="px-4 py-3 font-semibold">{text.fields.customer}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "产品金额" : "Monto producto"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "结算商品金额" : "Monto liquidado"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "结算代发费" : "Servicio liquidado"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "结算合计" : "Total liquidado"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "已付金额" : "Monto pagado"}</th>
                      <th className="px-4 py-3 font-semibold">{lang === "zh" ? "未付金额" : "Monto pendiente"}</th>
                      <th className="px-4 py-3 font-semibold">{text.fields.status}</th>
                      <th className="px-4 py-3 text-center font-semibold">{lang === "zh" ? "结算转换" : "Liquidacion"}</th>
                      <th className="w-[110px] px-3 py-3 text-center font-semibold">{lang === "zh" ? "账单记录" : "Facturas"}</th>
                      <th className="w-[92px] px-3 py-3 text-center font-semibold">{lang === "zh" ? "\u8be6\u60c5" : "Detalle"}</th>
                      <th className="w-[92px] px-3 py-3 text-center font-semibold">{lang === "zh" ? "日志" : "Historial"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFinance.map((row) => (
                      <tr key={row.customerId} className="border-t border-slate-100">
                        {(() => {
                          const exportSummary = financeExportSummaryByCustomerId.get(row.customerId);
                          const statementEntries = financeStatementEntriesByCustomerId[row.customerId] || [];
                          const unpaidStatementCount = statementEntries.filter((entry) => !entry.isPaid).length;
                          const displayProductAmount = exportSummary?.mxnSubtotal ?? row.stockAmount;
                          const displayConvertedAmount = exportSummary?.cnySubtotal ?? row.exchangedAmount;
                          const displayShippingAmount = exportSummary?.serviceFeeTotal ?? row.shippingAmount;
                          const displayTotalAmount = exportSummary?.payableTotal ?? row.totalAmount;
                          const displayPaidAmount = exportSummary?.totalPaidAmount ?? row.paidAmount;
                          const displayUnpaidAmount = exportSummary?.totalUnpaidAmount ?? row.unpaidAmount;
                          const displayStatus = deriveFinanceSummaryStatus(displayTotalAmount, displayPaidAmount);
                          const settlementMode = exportSummary?.settlementMode || getFinanceSettlementMode(row);
                          return (
                            <>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.customerName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{`$${fmtMoney(displayProductAmount, lang)}`}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatSettlementAmount(displayConvertedAmount, settlementMode, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatSettlementAmount(displayShippingAmount, settlementMode, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatSettlementAmount(displayTotalAmount, settlementMode, lang)}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600">{formatSettlementAmount(displayPaidAmount, settlementMode, lang)}</td>
                        <td className="px-4 py-3 text-sm text-rose-600">{formatSettlementAmount(displayUnpaidAmount, settlementMode, lang)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{text.status[displayStatus as keyof typeof text.status]}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-700">
                          <div className="inline-flex items-center gap-2 whitespace-nowrap">
                            <span className={`text-[11px] font-semibold ${settlementMode === "MXN" ? "text-slate-900" : "text-slate-400"}`}>MXN</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={settlementMode === "RMB"}
                              aria-label={lang === "zh" ? "切换结算模式" : "Cambiar modo de liquidacion"}
                              title={
                                lang === "zh"
                                  ? `当前${settlementMode === "RMB" ? "人民币结算" : "比索结算"}，点击切换`
                                  : `Modo actual: ${settlementMode === "RMB" ? "RMB" : "MXN"}`
                              }
                              disabled={financeSettlementSavingCustomerId === row.customerId}
                              onClick={() => void updateFinanceSettlementMode(row, settlementMode === "RMB" ? "MXN" : "RMB")}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full border transition ${
                                settlementMode === "RMB"
                                  ? "border-primary bg-primary/90"
                                  : "border-slate-300 bg-slate-200"
                              } ${financeSettlementSavingCustomerId === row.customerId ? "cursor-wait opacity-60" : "hover:opacity-90"}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                  settlementMode === "RMB" ? "translate-x-5" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                            <span className={`text-[11px] font-semibold ${settlementMode === "RMB" ? "text-primary" : "text-slate-400"}`}>RMB</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-700">
                          <div className="inline-flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => void loadFinanceStatementRecords(row)}
                              title={lang === "zh" ? "查看账单记录" : "Ver facturas"}
                              aria-label={lang === "zh" ? "查看账单记录" : "Ver facturas"}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                            >
                              <LedgerIcon />
                            </button>
                            {unpaidStatementCount > 0 ? (
                              <span className="inline-flex min-h-5 whitespace-nowrap items-center justify-center rounded-full bg-rose-500 px-2 text-[9px] font-semibold leading-none text-white">
                                {lang === "zh" ? `未结${unpaidStatementCount}单` : `${unpaidStatementCount} pendientes`}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-700">
                          <button
                            type="button"
                            onClick={() => openFinancePreview(row)}
                            disabled={row.settledOrders.length === 0}
                            title={lang === "zh" ? "\u67e5\u770b\u5df2\u7ed3\u7b97\u8be6\u60c5" : "Ver liquidaciones"}
                            aria-label={lang === "zh" ? "\u67e5\u770b\u5df2\u7ed3\u7b97\u8be6\u60c5" : "Ver liquidaciones"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                          >
                            <EyeIcon />
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-700">
                          <button
                            type="button"
                            onClick={() => void loadFinanceActionLogs(row)}
                            title={lang === "zh" ? "查看账单动作记录" : "Ver historial"}
                            aria-label={lang === "zh" ? "查看账单动作记录" : "Ver historial"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <NotebookIcon />
                          </button>
                        </td>
                            </>
                          );
                        })()}
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
                    onChange={(event) => handleOrderSkuChange(event.target.value)}
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
                      list="dropshipping-customer-options"
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
                      onChange={(event) => handleOrderSkuChange(event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
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

                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "minmax(148px,1.35fr) minmax(124px,1.15fr) minmax(124px,1.15fr) minmax(72px,0.7fr) minmax(72px,0.7fr)" }}
                >
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
                  <label className="min-w-0 space-y-1">
                    <span className="whitespace-nowrap text-xs text-slate-500">{text.form.shippingFee}</span>
                    <select
                      value={form.shippingFee}
                      onChange={(event) => setForm((prev) => ({ ...prev, shippingFee: event.target.value }))}
                      className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700"
                    >
                      <option value="">{lang === "zh" ? "费用" : "Cargo"}</option>
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
                      className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700"
                    >
                      <option value="paid">{getSettlementStatusLabel("paid", lang)}</option>
                      <option value="unpaid">{getSettlementStatusLabel("unpaid", lang)}</option>
                    </select>
                  </label>
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
                                          fallbackSources: buildProductImageUrls(slot.sku, ["jpg", "jpeg", "png", "webp"]),
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
                <datalist id="dropshipping-customer-options">
                  {customerOptions.map((customer) => (
                    <option key={customer} value={customer} />
                  ))}
                </datalist>
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

      {orderImportPreviewOpen ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="flex w-[min(1180px,calc(100vw-20px))] max-h-[calc(100vh-32px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {lang === "zh" ? "导入订单文件预览" : "Vista previa de importacion"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {orderImportPreviewFileName || (lang === "zh" ? "未选择文件" : "Sin archivo")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOrderImportPreviewOpen(false);
                    setOrderImportPreviewPage(1);
                    setOrderImportPreviewRows([]);
                    setOrderImportPreviewError("");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {orderImportPreviewError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {orderImportPreviewError}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-slate-600">
                    {lang === "zh"
                      ? `共解析 ${orderImportPreviewRows.length} 条，确认后才会正式导入。`
                      : `Se detectaron ${orderImportPreviewRows.length} filas. Solo se importaran al confirmar.`}
                  </div>
                  <div className="rounded-2xl border border-slate-200">
                    <table className="w-full table-fixed border-separate border-spacing-0">
                      <thead className="bg-slate-50 text-left text-sm text-slate-700">
                        <tr>
                          <th className="w-[9%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "平台" : "Plataforma"}</th>
                          <th className="w-[18%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "订单编号" : "Pedido"}</th>
                          <th className="w-[17%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "跟踪号" : "Guia"}</th>
                          <th className="w-[10%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "发货时间" : "Fecha envio"}</th>
                          <th className="w-[7%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "产品数量" : "Cantidad"}</th>
                          <th className="w-[9%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "代发费" : "Cargo"}</th>
                          <th className="w-[14%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "原始商品SKU" : "SKU original"}</th>
                          <th className="w-[16%] whitespace-nowrap px-2 py-1.5 font-semibold">{lang === "zh" ? "解析编码" : "SKU解析"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedOrderImportPreviewRows.map((item, index) => {
                          const actualIndex = (orderImportPreviewPage - 1) * orderImportPreviewPageSize + index;
                          const rowError = [item.parseError, item.duplicateError].filter(Boolean).join("；");
                          return (
                          <tr key={`${item.platformOrderNo}-${actualIndex}`} className="border-t border-slate-100 text-sm text-slate-700">
                            <td className="truncate px-2 py-1.5">{item.platform}</td>
                            <td className="truncate px-2 py-1.5">{item.platformOrderNo}</td>
                            <td className="truncate px-2 py-1.5">{item.trackingNo || "-"}</td>
                            <td className="whitespace-nowrap px-2 py-1.5">{item.shippedAt || "-"}</td>
                            <td className="px-2 py-1.5">{item.quantity}</td>
                            <td className="px-2 py-1.5">
                              <select
                                value={item.shippingFee}
                                onChange={(event) => updateOrderImportPreviewRow(actualIndex, { shippingFee: event.target.value })}
                                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none"
                              >
                                {SHIPPING_FEE_OPTIONS.map((fee) => (
                                  <option key={fee} value={fee}>
                                    {fee}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="truncate px-2 py-1.5">{item.rawSku || "-"}</td>
                            <td className="px-2 py-1.5">
                              <div className="space-y-1">
                                <input
                                  value={item.sku}
                                  onChange={(event) => updateOrderImportPreviewRow(actualIndex, { sku: event.target.value })}
                                  className={`h-8 w-full rounded-lg border bg-white px-2 text-sm font-medium outline-none ${rowError ? "border-rose-300 text-rose-700" : "border-slate-200 text-slate-900"}`}
                                />
                                {rowError ? (
                                  <div className="text-[11px] leading-4 text-rose-600">
                                    {rowError}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                  {orderImportPreviewTotalPages > 1 ? (
                    <div className="flex items-center justify-between pt-2 text-sm text-slate-500">
                      <div>
                        {lang === "zh"
                          ? `第 ${orderImportPreviewPage} / ${orderImportPreviewTotalPages} 页`
                          : `Pagina ${orderImportPreviewPage} / ${orderImportPreviewTotalPages}`}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOrderImportPreviewPage((prev) => Math.max(1, prev - 1))}
                          disabled={orderImportPreviewPage <= 1}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {lang === "zh" ? "上一页" : "Anterior"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderImportPreviewPage((prev) => Math.min(orderImportPreviewTotalPages, prev + 1))}
                          disabled={orderImportPreviewPage >= orderImportPreviewTotalPages}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {lang === "zh" ? "下一页" : "Siguiente"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setOrderImportPreviewOpen(false);
                  setOrderImportPreviewPage(1);
                  setOrderImportPreviewRows([]);
                  setOrderImportPreviewError("");
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                {lang === "zh" ? "取消" : "Cancelar"}
              </button>
              {!orderImportPreviewError ? (
                <button
                  type="button"
                  onClick={() => void confirmOrderFileImport()}
                  disabled={orderFileImporting || orderImportPreviewRows.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {orderFileImporting ? (lang === "zh" ? "导入中..." : "Importando...") : (lang === "zh" ? "确认导入" : "Confirmar")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {groupedDeleteTarget ? (
        <div className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pb-3 pt-5">
              <h3 className="text-base font-semibold text-slate-900">
                {lang === "zh" ? "确认移除添加商品" : "Confirmar eliminacion"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {lang === "zh"
                  ? `确认将 ${groupedDeleteTarget.sku || groupedDeleteTarget.productNameZh || "该商品"} 从当前订单中移除？`
                  : `Quitar ${groupedDeleteTarget.sku || groupedDeleteTarget.productNameZh || "este producto"} del pedido actual?`}
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
                  {currentInventoryPreview?.sku ? (
                    <ProductImage
                      sku={currentInventoryPreview.sku}
                      hasImage
                      size={64}
                      className="h-full w-full"
                      roundedClassName="rounded-xl"
                      onClick={() =>
                        setPreviewImage({
                          src: currentInventoryPreview.productImageUrl || "",
                          fallbackSources: buildProductImageUrls(currentInventoryPreview.sku, ["jpg", "jpeg", "png", "webp"]),
                          title: `${currentInventoryPreview.sku} / ${currentInventoryPreview.productNameZh || "-"}`,
                        })
                      }
                    />
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
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-slate-900">
                  {inventoryEdit.mode === "create"
                    ? (lang === "zh" ? "新增备货记录" : "Nuevo stock")
                    : (lang === "zh" ? "编辑备货记录" : "Editar stock")}
                </h3>
                {inventoryEdit.mode === "edit" && inventoryEdit.trackingNo ? (
                  <span className="text-xs text-slate-500">
                    {lang === "zh" ? "物流号：" : "Guia: "}
                    {inventoryEdit.trackingNo}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "客户" : "Cliente"}</p>
                {inventoryEdit.mode === "create" ? (
                  <select
                    value={inventoryEdit.customerId}
                    onChange={(event) => {
                      const nextCustomerId = event.target.value;
                      const customer = inventoryCustomers.find((row) => row.id === nextCustomerId);
                      setInventoryEdit((prev) => (prev ? {
                        ...prev,
                        customerId: nextCustomerId,
                        customerName: customer?.name || "",
                      } : prev));
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary/40"
                  >
                    <option value="">{lang === "zh" ? "请选择客户" : "Selecciona cliente"}</option>
                    {inventoryCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={inventoryEdit.customerName}
                    disabled
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none"
                  />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "产品（编码 / 中文名）" : "Producto (codigo / nombre)"}</p>
                <input
                  value={inventoryEdit.mode === "create" ? inventoryProductQuery : `${inventoryEdit.sku} / ${inventoryEdit.productNameZh || "-"}`}
                  disabled={inventoryEdit.mode !== "create"}
                  onChange={(event) => setInventoryProductQuery(event.target.value)}
                  placeholder={lang === "zh" ? "输入产品编码" : "Escribe el codigo del producto"}
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
                    ) : inventoryProductLoading ? (
                      <div className="px-3 py-2 text-xs text-slate-500">
                        {lang === "zh" ? "正在查找产品..." : "Buscando productos..."}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "备货时间" : "Fecha de stock"}</p>
                <input
                  type="date"
                  value={inventoryEdit.stockedAt}
                  onChange={(event) => setInventoryEdit((prev) => (prev ? { ...prev, stockedAt: event.target.value } : prev))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-primary/40"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "备货数量" : "Stock"}</p>
                <input
                  inputMode="numeric"
                  value={inventoryEdit.stockedQty}
                  onChange={(event) =>
                    setInventoryEdit((prev) => {
                      if (!prev) return prev;
                      const nextQty = event.target.value.replace(/[^\d]/g, "");
                      const nextQtyNumber = Number(nextQty || 0);
                      return {
                        ...prev,
                        stockedQty: nextQty,
                        isStocked: nextQtyNumber > 1 ? true : prev.isStocked,
                        stockAmount: computeInventoryAmount(prev.unitPrice, nextQty, prev.discountRate) || prev.stockAmount,
                      };
                    })
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "备货金额" : "Monto stock"}</p>
                <input
                  value={inventoryEdit.stockAmount}
                  readOnly
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "普通折扣 (%)" : "Descuento (%)"}</p>
                <input
                  inputMode="decimal"
                  value={inventoryEdit.discountRate}
                  onChange={(event) =>
                    setInventoryEdit((prev) => {
                      if (!prev) return prev;
                      const nextDiscountRate = event.target.value.replace(/[^\d.]/g, "");
                      return {
                        ...prev,
                        discountRate: nextDiscountRate,
                        stockAmount: computeInventoryAmount(prev.unitPrice, prev.stockedQty, nextDiscountRate) || prev.stockAmount,
                      };
                    })
                  }
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
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "剩余" : "Restante"}</p>
                <input
                  value={inventoryEdit.remainingQty ?? "-"}
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "状态" : "Estado"}</p>
                <input
                  value={inventoryEdit.status ? text.status[inventoryEdit.status] : "-"}
                  disabled
                  className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ${
                    inventoryEdit.status ? getInventoryStatusClass(inventoryEdit.status) : "text-slate-500"
                  }`}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "备货" : "Stock"}</p>
                <button
                  type="button"
                  onClick={() =>
                    setInventoryEdit((prev) => {
                      if (!prev) return prev;
                      const nextIsStocked = !prev.isStocked;
                      const nextQty = nextIsStocked ? (Number(prev.stockedQty || 0) > 0 ? prev.stockedQty : "1") : "0";
                      return {
                        ...prev,
                        isStocked: nextIsStocked,
                        stockedQty: nextQty,
                        stockAmount: nextIsStocked
                          ? (computeInventoryAmount(prev.unitPrice, nextQty, prev.discountRate) || prev.stockAmount)
                          : "0",
                      };
                    })
                  }
                  className={`inline-flex h-11 w-full items-center justify-between rounded-xl border px-3 text-sm transition ${
                    inventoryEdit.isStocked
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <span>{inventoryEdit.isStocked ? (lang === "zh" ? "已备货" : "Activo") : (lang === "zh" ? "未备货" : "Inactivo")}</span>
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      inventoryEdit.isStocked ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        inventoryEdit.isStocked ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
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
      {inventoryExport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            {(() => {
              const exportMode = getInventoryExportMode(inventoryExport);
              const stockedDisabled = exportMode !== null && exportMode !== "stocked";
              const statusDisabled = exportMode !== null && exportMode !== "status";
              const skuDisabled = exportMode !== null && exportMode !== "sku";
              const allShippedDisabled = exportMode !== null && exportMode !== "allShipped";
              return (
                <>
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{lang === "zh" ? "筛选导出" : "Exportar filtro"}</h3>
            </div>
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "已备货" : "Stock"}</p>
                <div className={`space-y-2 rounded-xl border px-4 py-3 ${stockedDisabled ? "border-slate-100 bg-slate-50" : "border-slate-200"}`}>
                  {[
                    { value: "all", label: lang === "zh" ? "全部" : "Todos" },
                    { value: "stocked", label: lang === "zh" ? "已备货" : "Con stock" },
                    { value: "unstocked", label: lang === "zh" ? "未备货" : "Sin stock" },
                  ].map((option) => {
                    const checked = inventoryExport.stocked === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={stockedDisabled}
                        onClick={() =>
                          setInventoryExport((prev) => prev ? {
                            ...resetInventoryExportState(),
                            stocked: option.value as "all" | "stocked" | "unstocked",
                          } : prev)
                        }
                        className={`flex w-full items-center gap-3 text-left text-sm ${stockedDisabled ? "cursor-not-allowed text-slate-400" : "text-slate-700"}`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${checked ? "border-primary" : stockedDisabled ? "border-slate-200" : "border-slate-300"}`}>
                          <span className={`h-2 w-2 rounded-full ${checked ? "bg-primary" : "bg-transparent"}`} />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{lang === "zh" ? "备货状态" : "Estado stock"}</p>
                <div className={`space-y-2 rounded-xl border px-4 py-3 ${statusDisabled ? "border-slate-100 bg-slate-50" : "border-slate-200"}`}>
                  {[
                    { value: "all", label: lang === "zh" ? "全部" : "Todos" },
                    { value: "healthy", label: lang === "zh" ? "充足" : "Suficiente" },
                    { value: "low", label: lang === "zh" ? "偏低" : "Bajo" },
                    { value: "empty", label: lang === "zh" ? "售罄" : "Agotado" },
                  ].map((option) => {
                    const checked = inventoryExport.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={statusDisabled}
                        onClick={() =>
                          setInventoryExport((prev) => prev ? {
                            ...resetInventoryExportState(),
                            status: option.value as "all" | DsInventoryStatus,
                          } : prev)
                        }
                        className={`flex w-full items-center gap-3 text-left text-sm ${statusDisabled ? "cursor-not-allowed text-slate-400" : "text-slate-700"}`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${checked ? "border-primary" : statusDisabled ? "border-slate-200" : "border-slate-300"}`}>
                          <span className={`h-2 w-2 rounded-full ${checked ? "bg-primary" : "bg-transparent"}`} />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-xs text-slate-500">{lang === "zh" ? "商品编码" : "SKU"}</p>
                <input
                  value={inventoryExport.skuKeyword}
                  onChange={(event) =>
                    setInventoryExport((prev) => prev ? {
                      ...resetInventoryExportState(),
                      skuKeyword: event.target.value,
                    } : prev)
                  }
                  placeholder={lang === "zh" ? "输入商品编码" : "Escribe SKU"}
                  disabled={skuDisabled}
                  className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${skuDisabled ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 text-slate-700"}`}
                />
              </div>
              <label className={`md:col-span-2 flex items-center gap-3 rounded-xl border px-4 py-3 ${allShippedDisabled ? "cursor-not-allowed border-slate-100 bg-slate-50" : "border-slate-200"}`}>
                <input
                  type="checkbox"
                  checked={inventoryExport.includeAllShipped}
                  disabled={allShippedDisabled}
                  onChange={(event) =>
                    setInventoryExport((prev) => prev ? {
                      ...resetInventoryExportState(),
                      includeAllShipped: event.target.checked,
                    } : prev)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
                <span className={`text-sm ${allShippedDisabled ? "text-slate-400" : "text-slate-700"}`}>{lang === "zh" ? "全部发货记录" : "Todos los envios"}</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setInventoryExport(resetInventoryExportState())}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
              >
                {lang === "zh" ? "清空选项" : "Limpiar"}
              </button>
              <button
                type="button"
                onClick={() => setInventoryExport(null)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
              >
                {lang === "zh" ? "取消" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => exportFilteredInventory("xlsx")}
                className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                XLSX
              </button>
              <button
                type="button"
                onClick={() => exportFilteredInventory("pdf")}
                className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                PDF
              </button>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
      {inventoryShippedPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[920px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {inventoryShippedPreview.mode === "related"
                    ? (lang === "zh" ? "相关发货记录" : "Pedidos enviados relacionados")
                    : (lang === "zh" ? "已发记录" : "Registros enviados")}
                </h3>
                {inventoryShippedPreview.mode === "related" ? (
                  <div className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                    <span className="inline-flex items-center">
                      {lang === "zh" ? "共：" : "Total:"}
                      <span className="px-1 font-semibold text-rose-600">{shippedOrdersForInventoryPreview.length}</span>
                      {lang === "zh" ? "次发货" : " envios"}
                      <span className="pl-3">
                        {lang === "zh" ? "此商品销量：" : "Cantidad vendida:"}
                      </span>
                      <span className="px-1 font-semibold text-rose-600">{shippedQtyForInventoryPreview}</span>
                      {lang === "zh" ? "个" : ""}
                    </span>
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {inventoryShippedPreview.customerName} / {inventoryShippedPreview.sku} / {inventoryShippedPreview.productNameZh || "-"}
              </p>
            </div>
            <div className="max-h-[70vh] overflow-auto px-5 py-5">
              {shippedOrdersForInventoryPreview.length === 0 ? (
                <EmptyState
                  title={inventoryShippedPreview.mode === "related"
                    ? (lang === "zh" ? "暂无相关发货记录" : "Sin pedidos relacionados")
                    : (lang === "zh" ? "暂无已发记录" : "Sin registros enviados")}
                  description={inventoryShippedPreview.mode === "related"
                    ? (lang === "zh" ? "当前商品还没有相关的发货订单记录。" : "Este producto aun no tiene pedidos enviados relacionados.")
                    : (lang === "zh" ? "当前商品还没有已发出的订单记录。" : "Este producto aun no tiene pedidos enviados.")}
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
      {financePreview && !financeStatementPreviewStandalone ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-3">
          <div className="flex max-h-[calc(100vh-16px)] w-full max-w-[1160px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="border-b border-slate-200 bg-white px-5 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <h3 className="whitespace-nowrap text-xl font-semibold text-slate-900">
                    {lang === "zh" ? "\u7ed3\u7b97\u8be6\u60c5" : "Detalle de liquidaciones"}
                  </h3>
                  <p className="truncate text-sm text-slate-500">
                    {lang === "zh" ? `客户：${financePreview.customerName}` : `Cliente: ${financePreview.customerName}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openWeeklyFinancePreview(financePreview)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-secondary-accent bg-secondary-accent px-3 text-sm font-semibold text-primary transition hover:brightness-95"
                  >
                    {lang === "zh" ? "本周 未结单 预览" : "Vista previa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportFinancePreviewRows()}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {lang === "zh" ? "导出全部数据" : "Exportar todo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFinanceStatementPreviewOpen(false);
                      setFinanceStatementPreviewStandalone(false);
                      setFinancePreview(null);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={lang === "zh" ? "关闭" : "Cerrar"}
                    title={lang === "zh" ? "关闭" : "Cerrar"}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-white">
              {financePreviewPreparedOrders.length === 0 ? (
                <EmptyState
                  title={lang === "zh" ? "\u6682\u65e0\u5df2\u7ed3\u7b97\u8bb0\u5f55" : "Sin registros liquidados"}
                  description={lang === "zh" ? "\u5f53\u524d\u5ba2\u6237\u8fd8\u6ca1\u6709\u5df2\u7ed3\u7b97\u7684\u8ba2\u5355\u3002" : "Este cliente aun no tiene pedidos liquidados."}
                />
              ) : (
                <div className="overflow-hidden bg-white">
                  <div ref={financePreviewScrollRef} className="max-h-[calc(100vh-152px)] overflow-y-auto overflow-x-hidden px-[15px]">
                    <table className="w-auto border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[12px] font-semibold text-slate-600 shadow-[0_1px_0_0_rgba(226,232,240,1),0_6px_16px_rgba(15,23,42,0.04)]">
                          <th className="w-[1%] whitespace-nowrap px-3 py-2.5">{text.fields.orderNo}</th>
                          <th className="w-[1%] whitespace-nowrap px-3 py-2.5">{text.fields.trackingNo}</th>
                          <th className="w-[1%] whitespace-nowrap px-3 py-2.5">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-inherit"
                              onClick={() => {
                                setFinanceDetailShippedAtSortTouched(true);
                                setFinanceDetailShippedAtSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                              }}
                            >
                              <span>{text.fields.shippedAt}</span>
                              <SortDirectionIcon direction={financeDetailShippedAtSortDirection} />
                            </button>
                          </th>
                          <th className="w-[1%] whitespace-nowrap px-3 py-2.5">{lang === "zh" ? "\u5546\u54c1\u56fe" : "Image"}</th>
                          <th className="w-[1%] whitespace-nowrap px-3 py-2.5">{text.fields.sku}</th>
                          <th className="w-[18ch] whitespace-nowrap px-3 py-2.5">{text.fields.productZh}</th>
                          <th className="w-[3ch] whitespace-nowrap px-1.5 py-2.5 text-right">{lang === "zh" ? "\u53d1\u8d27\u6570\u91cf" : "Qty"}</th>
                          <th className="w-[5ch] whitespace-nowrap px-1.5 py-2.5 text-right">{lang === "zh" ? "\u4ea7\u54c1\u91d1\u989d" : "Prod."}</th>
                          <th className="w-[4ch] whitespace-nowrap px-1.5 py-2.5 text-right">{lang === "zh" ? "\u4ee3\u53d1\u8d39" : "Ship."}</th>
                          <th className="w-[6ch] whitespace-nowrap px-1.5 py-2.5">{lang === "zh" ? "\u7ed3\u7b97\u65e5\u671f" : "Settled"}</th>
                          <th className="w-[3ch] whitespace-nowrap px-1 py-2.5 text-center">{lang === "zh" ? "\u72b6\u6001" : "Status"}</th>
                          <th className="w-[2ch] whitespace-nowrap px-1 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={financeSelectionLocked ? financePreviewSelectableVisibleOrders.length > 0 : areAllVisibleFinanceOrdersSelected}
                              disabled={financeSelectionLocked || financePreviewSelectableVisibleOrders.length === 0}
                              onChange={(event) => {
                                const targetOrders = financePreviewSelectableVisibleOrders.filter(
                                  (item) => selectedFinanceOrderIds.includes(item.orderId) !== event.target.checked,
                                );
                                void Promise.all(
                                  targetOrders.map((item) => updateFinanceOrderSelection(item, event.target.checked)),
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {financePreviewVisibleOrders.map((item, index) => (
                          <tr
                            key={item.orderId}
                            className={`border-b border-slate-100 text-[12px] text-slate-700 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/45"}`}
                          >
                            <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-900">{item.platformOrderNo}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 align-middle">{item.trackingNo || "-"}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 align-middle">{fmtDateOnly(item.shippedAt, lang)}</td>
                            <td className="px-3 py-2.5 align-middle">
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
                            <td className="whitespace-nowrap px-3 py-2.5 align-middle">{item.sku}</td>
                            <td className="px-3 py-2.5 align-middle">
                              <span className="block max-w-full truncate align-middle" title={item.productNameZh || "-"}>
                                {item.productNameZh || "-"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-1.5 py-2.5 text-right text-slate-900 align-middle">{item.quantity}</td>
                            <td className="whitespace-nowrap px-1.5 py-2.5 text-right text-slate-900 align-middle">{item.rawProductAmount > 0 ? `$${fmtMoney(item.rawProductAmount, lang)}` : "-"}</td>
                            <td className="whitespace-nowrap px-1.5 py-2.5 text-right text-slate-900 align-middle">{item.shippingFee > 0 ? `\uffe5${fmtMoney(item.shippingFee, lang)}` : "-"}</td>
                            <td className="whitespace-nowrap px-1.5 py-2.5 align-middle">{fmtDateOnly(getMexicoWeekSaturdayValue(item.shippedAt) || item.settledAt, lang)}</td>
                            <td className="px-1 py-2.5 text-center align-middle">
                              <span
                                className={`inline-flex h-6 min-w-[38px] items-center justify-center whitespace-nowrap rounded-full px-1 text-[11px] font-normal ${
                                  item.settlementStatus === "paid"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50 text-rose-600"
                                }`}
                              >
                                {getSettlementStatusLabel(item.settlementStatus, lang)}
                              </span>
                            </td>
                            <td className="px-1 py-2.5 text-center align-middle">
                              <input
                                type="checkbox"
                                checked={financeSelectionLocked ? item.settlementStatus !== "paid" : selectedFinanceOrderIds.includes(item.orderId)}
                                disabled={financeSelectionLocked || item.settlementStatus === "paid"}
                                onChange={(event) => void updateFinanceOrderSelection(item, event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-2 text-xs text-slate-400">
                    <span>
                      {lang === "zh"
                        ? `共 ${financePreviewPreparedOrders.length} 条详情记录`
                        : `${financePreviewPreparedOrders.length} detail records`}
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
      {financeStatementRecordTarget ? (
        <div className="fixed inset-0 z-[54] flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="flex max-h-[calc(100vh-180px)] w-full max-w-[840px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {lang === "zh" ? "账单记录" : "Facturas del periodo"}
                  </h3>
                  <p className="truncate text-sm text-slate-500">
                    {lang === "zh" ? `客户：${financeStatementRecordTarget.customerName}` : `Cliente: ${financeStatementRecordTarget.customerName}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFinanceStatementRecordTarget(null);
                    setFinanceStatementRecordEntries([]);
                    setFinanceStatementRecordError("");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={lang === "zh" ? "关闭" : "Cerrar"}
                  title={lang === "zh" ? "关闭" : "Cerrar"}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
              {financeStatementRecordLoading ? (
                <div className="py-14 text-center text-sm text-slate-500">
                  {lang === "zh" ? "正在加载账单记录..." : "Cargando facturas..."}
                </div>
              ) : financeStatementRecordError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
                  {financeStatementRecordError}
                </div>
              ) : financeStatementRecordEntries.length === 0 ? (
                <EmptyState
                  title={lang === "zh" ? "暂无账单记录" : "Sin facturas"}
                  description={lang === "zh" ? "当前客户还没有周期账单记录。" : "Este cliente aun no tiene facturas por periodo."}
                />
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-700">
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "对账单号" : "No. estado"}</th>
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "对账周期" : "Periodo"}</th>
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "导出日期" : "Fecha exportacion"}</th>
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "已付款确认" : "Pago confirmado"}</th>
                        <th className="px-4 py-3 text-center font-semibold">{lang === "zh" ? "确认" : "Check"}</th>
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "操作人" : "Operador"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeStatementRecordEntries.map((entry) => (
                        <tr
                          key={`${entry.statementNumber}-${entry.exportedAtText}`}
                          className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                          onClick={() => openFinanceStatementRecordPreview(financeStatementRecordTarget, entry)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{entry.statementNumber}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{entry.cycleText || "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{entry.exportedAtText || "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (entry.isPaid || financeStatementActionLoading) return;
                                void confirmFinanceStatementPaid(financeStatementRecordTarget, entry);
                              }}
                              disabled={entry.isPaid || Boolean(financeStatementActionLoading)}
                              className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium transition ${
                                entry.isPaid
                                  ? "cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-600"
                                  : "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                              }`}
                            >
                              {entry.isPaid ? (lang === "zh" ? "已确认" : "Confirmado") : (lang === "zh" ? "已付款确认" : "Confirmar pago")}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-center">
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm transition ${
                                entry.isPaid
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                  : "border-slate-200 bg-slate-50 text-slate-400"
                              }`}
                              aria-label={entry.isPaid ? (lang === "zh" ? "已确认付款" : "Pago confirmado") : (lang === "zh" ? "未确认付款" : "Pago pendiente")}
                              title={entry.isPaid ? (lang === "zh" ? "已确认付款" : "Pago confirmado") : (lang === "zh" ? "未确认付款" : "Pago pendiente")}
                            >
                              ✓
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{entry.operatorName || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {financeLogTarget ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="flex max-h-[calc(100vh-160px)] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {lang === "zh" ? "账单动作记录" : "Historial de acciones"}
                  </h3>
                  <p className="truncate text-sm text-slate-500">
                    {lang === "zh" ? `客户：${financeLogTarget.customerName}` : `Cliente: ${financeLogTarget.customerName}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFinanceLogTarget(null);
                    setFinanceLogEntries([]);
                    setFinanceLogError("");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={lang === "zh" ? "关闭" : "Cerrar"}
                  title={lang === "zh" ? "关闭" : "Cerrar"}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
              {financeLogLoading ? (
                <div className="py-16 text-center text-sm text-slate-500">
                  {lang === "zh" ? "正在加载记录..." : "Cargando historial..."}
                </div>
              ) : financeLogError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
                  {financeLogError}
                </div>
              ) : financeLogEntries.length === 0 ? (
                <EmptyState
                  title={lang === "zh" ? "暂无动作记录" : "Sin acciones"}
                  description={lang === "zh" ? "当前客户账单还没有记录动作时间线。" : "Este cliente aun no tiene historial de acciones."}
                />
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-700">
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "动作时间" : "Fecha"}</th>
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "动作" : "Accion"}</th>
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "操作用户" : "Usuario"}</th>
                        <th className="px-4 py-3 font-semibold">{lang === "zh" ? "说明" : "Detalle"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeLogEntries.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{entry.createdAtText || "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{entry.actionText}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{entry.operatorName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{entry.detailText || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {financePreview && financeStatementPreviewOpen && financeStatementSummary ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-10">
          <div className="flex max-h-[calc(100vh-80px)] w-full max-w-[1380px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {lang === "zh" ? "本周 未结单 预览" : "Vista previa del estado"}
                </h3>
                <p className="truncate text-sm text-slate-500">{financePreview.customerName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={Boolean(financeStatementLockState?.isGenerated) || financeStatementActionLoading === "generate" || financeStatementLockLoading}
                  onClick={() => void updateFinanceStatementGeneratedState("generate")}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-primary bg-primary px-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {lang === "zh" ? "生成账单" : "Generar"}
                </button>
                <button
                  type="button"
                  disabled={!financeStatementLockState?.isGenerated || financeStatementLockState?.isPaid || financeStatementActionLoading === "revoke" || financeStatementLockLoading}
                  onClick={() => setFinanceStatementRevokeState({ confirmStatementNumber: "", note: "", error: "" })}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {lang === "zh" ? "撤销生成" : "Revocar"}
                </button>
                <button
                  type="button"
                  disabled={!financeStatementLockState?.isGenerated || financeStatementActionLoading === "export"}
                  onClick={async () => {
                    setFinanceStatementActionLoading("export");
                    setFinanceStatementActionError("");
                    try {
                      await exportFinancePreviewRows("export_weekly_statement");
                    } catch (exportError) {
                      setFinanceStatementActionError(exportError instanceof Error ? exportError.message : (lang === "zh" ? "导出账单失败" : "No se pudo exportar"));
                    } finally {
                      setFinanceStatementActionLoading("");
                    }
                  }}
                  className={`inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    financeStatementLockState?.isGenerated
                      ? "border-primary bg-primary text-white hover:opacity-95"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {lang === "zh" ? "导出本周未结账单" : "Exportar semanal"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFinanceStatementPreviewOpen(false);
                    if (financeStatementPreviewStandalone) {
                      setFinanceStatementPreviewRecord(null);
                      setFinanceStatementPreviewStandalone(false);
                      setFinancePreview(null);
                    }
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={lang === "zh" ? "关闭" : "Cerrar"}
                  title={lang === "zh" ? "关闭" : "Cerrar"}
                >
                  ×
                </button>
              </div>
            </div>
            {financeStatementActionError ? (
              <div className="border-b border-rose-100 bg-rose-50 px-5 py-2 text-sm text-rose-600">
                {financeStatementActionError}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
              <div className="relative mx-auto flex w-full max-w-[1280px] flex-col rounded-[28px] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
                {financeStatementLockState?.isGenerated ? (
                  <div className="pointer-events-none absolute left-[calc(50%+132px)] top-[62px] z-20 -translate-x-1/2 rotate-[-11deg] opacity-[0.82]">
                    <div className="relative inline-block min-w-[320px] border-[6px] border-[#b03127]/90 bg-[#fffaf8]/45 px-5 py-4 text-[#b03127] shadow-[0_12px_26px_rgba(176,49,39,0.08)]">
                      <div className="pointer-events-none absolute inset-[8px] border-[2px] border-[#b03127]/38" />
                      <div
                        className="pointer-events-none absolute inset-0 opacity-[0.28]"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 10% 18%, rgba(176,49,39,0.22) 0 1.1px, transparent 1.1px), radial-gradient(circle at 74% 26%, rgba(176,49,39,0.16) 0 1px, transparent 1px), radial-gradient(circle at 22% 76%, rgba(176,49,39,0.18) 0 1.1px, transparent 1.1px), radial-gradient(circle at 86% 68%, rgba(176,49,39,0.12) 0 0.9px, transparent 0.9px), repeating-linear-gradient(135deg, rgba(176,49,39,0.12) 0 2px, transparent 2px 15px)",
                        }}
                      />
                      <div className="pointer-events-none absolute inset-x-[18px] top-1/2 h-px -translate-y-1/2 bg-[#b03127]/34" />
                      <div className="relative flex min-h-[96px] flex-col justify-between py-1">
                        <div className="text-center text-[28px] font-black leading-none tracking-[0.01em] text-[#b03127]">
                          {lang === "zh" ? "账单生成并锁定" : "BLOQUEADO"}
                        </div>
                        <div className="text-center text-[28px] font-black uppercase leading-none tracking-[0.01em] text-[#b03127]">
                          FACT. GEN. Y BLOQ.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="bg-transparent px-6 py-4 text-slate-950">
                  <div className="flex items-start justify-between gap-8">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 inline-flex h-8 items-center rounded-full border border-slate-200/70 px-4 text-sm font-semibold tracking-[0.18em] text-slate-400">
                        PARKSONMX
                      </div>
                      <h2 className="text-[34px] font-black text-black" style={{ letterSpacing: "4px" }}>
                        {lang === "zh" ? "代发结算单" : "Estado de liquidacion"}
                      </h2>
                      <div className="mt-4 grid w-fit max-w-none grid-cols-[max-content_max-content] gap-x-[60px] gap-y-2.5 text-[14px]">
                        <div className="flex items-center gap-3">
                          <p className="font-normal text-slate-400">
                            {lang === "zh" ? `客户：${financePreview.customerName}` : `Cliente: ${financePreview.customerName}`}
                          </p>
                          <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                              checked={financeStatementVipEnabled}
                              onChange={(event) => setFinanceStatementVipEnabled(event.target.checked)}
                            />
                            <span>VIP</span>
                          </label>
                        </div>
                        <p className="font-normal text-slate-400">
                          {lang === "zh"
                            ? (() => {
                                const start = parseDateOnlyParts(financeStatementSummary.minShippedAt || "");
                                const end = parseDateOnlyParts(financeStatementSummary.maxShippedAt || "");
                                if (!start || !end) {
                                  return `结算周期：${fmtDateOnly(financeStatementSummary.minShippedAt, lang)} -- ${fmtDateOnly(financeStatementSummary.maxShippedAt, lang)}`;
                                }
                                return `结算周期：${financeCurrentCycleText}`;
                              })()
                            : `Periodo: ${financeCurrentCycleText}`}
                        </p>
                        {lang === "zh" ? (
                          <p className="text-[12px] font-normal text-slate-400">
                            <span>{financeStatementLabels.rateLine.replace(
                              "{rate}",
                              financeStatementDisplayRate.rateValue
                                ? (
                                    financeStatementMode === "MXN"
                                      ? (1 / financeStatementDisplayRate.rateValue).toFixed(4)
                                      : financeStatementDisplayRate.rateValue.toFixed(4)
                                  )
                                : "-",
                            )}</span>
                            <span className="ml-[20px]">{`${fmtDateOnly(financeStatementDisplayDateValue, lang)}汇率`}</span>
                            <span className="ml-3">{`来源：${financeStatementDisplayRate.sourceName || "-"}`}</span>
                          </p>
                        ) : (
                          <p className="text-[12px] font-normal text-slate-400">
                            <span>{financeStatementLabels.rateLine.replace(
                              "{rate}",
                              financeStatementDisplayRate.rateValue
                                ? (
                                    financeStatementMode === "MXN"
                                      ? (1 / financeStatementDisplayRate.rateValue).toFixed(4)
                                      : financeStatementDisplayRate.rateValue.toFixed(4)
                                  )
                                : "-",
                            )}</span>
                            <span className="ml-[20px]">{fmtDateOnly(financeStatementDisplayDateValue, lang)}</span>
                            <span className="ml-3">{`fuente: ${financeStatementDisplayRate.sourceName || "-"}`}</span>
                          </p>
                        )}
                        <p className="font-normal text-slate-400">
                          {`${financeStatementLabels.serviceFeeDisplayPrefix} ${
                            financeStatementPreparedData?.serviceFeeDisplay
                            || `${financeStatementMode === "MXN" ? "$" : "￥"}0.00 / ${lang === "zh" ? "单" : "pedido"}`
                          }`}
                        </p>
                      </div>
                    </div>
                    <div className="w-full max-w-[280px] rounded-[24px] border border-slate-200/60 bg-slate-50/35 p-3.5">
                      <div className="space-y-2 text-[12px]">
                        {[
                          [lang === "zh" ? "对账单号" : "Folio", financeCurrentStatementNumber || financeStatementSummary.statementNumber],
                          [lang === "zh" ? "生成日期" : "Fecha", fmtDateOnly(financeStatementDisplayDateValue, lang)],
                          [lang === "zh" ? "订单数" : "Pedidos", String(financeStatementSummary.orderCount)],
                          [
                            lang === "zh" ? "状态" : "Estado",
                            financeStatementHasUnpaid
                              ? lang === "zh"
                                ? "未结"
                                : "Con pendientes"
                              : lang === "zh"
                                ? "已结"
                                : "Generado / Cerrado",
                          ],
                        ].map(([label, value], index) => (
                          <div
                            key={`${label}-${index}`}
                            className={`flex items-center justify-between gap-3 ${index < 3 ? "border-b border-slate-200/80 pb-3" : ""}`}
                          >
                            <span className="text-slate-400">{label}</span>
                            <span
                              className={`text-right font-semibold ${
                                index === 3 && value === (lang === "zh" ? "未结" : "Con pendientes")
                                  ? "text-rose-600"
                                  : index === 3 && value === (lang === "zh" ? "已结" : "Liquidado")
                                    ? "text-emerald-600"
                                    : "text-slate-700"
                              }`}
                            >
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-6 pt-5 pb-2">
                  <div className="grid justify-center gap-3.5 lg:grid-cols-4">
                    {[
                      {
                        label: lang === "zh" ? "商品小计（比索）" : "Subtotal (MXN)",
                        value: `$${fmtMoney(financeStatementSummary.mxnSubtotal, lang)}`,
                        valueClass: "text-slate-950",
                        cardClass: "bg-transparent",
                      },
                      {
                        label: financeStatementMode === "MXN" ? financeStatementLabels.rawServiceFeeRmb : financeStatementLabels.productSettlement,
                        value:
                          financeStatementMode === "MXN"
                            ? `￥${fmtMoney(financeStatementSummary.rawServiceFeeTotal || 0, lang)}`
                            : formatSettlementAmount(financeStatementSummary.cnySubtotal, financeStatementMode, lang),
                        valueClass: "text-slate-950",
                        cardClass: "bg-transparent",
                      },
                      {
                        label: financeStatementLabels.serviceFee,
                        value: formatSettlementAmount(financeStatementSummary.serviceFeeTotal, financeStatementMode, lang),
                        valueClass: "text-slate-950",
                        cardClass: "bg-transparent",
                      },
                      {
                        label: financeStatementLabels.total,
                        value: formatSettlementAmount(financeStatementSummary.payableTotal, financeStatementMode, lang),
                        valueClass: financeStatementIsPaid ? "text-slate-950" : "text-rose-600",
                        cardClass: "bg-transparent",
                      },
                    ].map((card) => (
                      <div key={card.label} className={`px-5 pt-3 pb-1 text-center ${card.cardClass}`}>
                        <p className="text-[12px] text-slate-500">{card.label}</p>
                        <p className={`mt-2 mb-0 text-[14px] font-black tracking-tight ${card.valueClass}`}>{card.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 border border-slate-200">
                    <div className="overflow-visible">
                      <table className="w-full table-auto border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-white text-left text-xs font-semibold text-slate-400">
                            <th className="w-[1%] whitespace-nowrap px-2 py-2">{lang === "zh" ? "订单号" : "Pedido"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2">{lang === "zh" ? "物流号" : "Guia"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2">{lang === "zh" ? "发货日期" : "Envio"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2">{lang === "zh" ? "编码" : "Codigo"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{lang === "zh" ? "数量" : "Cant."}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{lang === "zh" ? "单价" : "Precio"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{lang === "zh" ? "普通折扣" : "Desc. gen."}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{lang === "zh" ? "VIP折扣" : "Desc. VIP"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{lang === "zh" ? "产品金额" : "Monto producto"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{financeStatementLabels.settlementColumn}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{lang === "zh" ? "代发费" : "Servicio"}</th>
                            <th className="w-[1%] whitespace-nowrap px-2 py-2 text-right">{financeStatementLabels.totalColumn}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(financeStatementPreparedData?.orders || []).map((item, index) => {
                            const rowTextClass = item.displayReincluded && !financeStatementIsPaid ? "text-rose-600" : "text-slate-700";
                            return (
                            <tr key={`statement-${item.orderId}`} className={`border-b border-slate-200/70 ${index % 2 === 0 ? "bg-white" : "bg-white"}`}>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-[12px] font-normal ${item.displayReincluded && !financeStatementIsPaid ? "text-rose-600" : "text-slate-900"}`}>{item.platformOrderNo}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-[12px] ${rowTextClass}`}>{item.trackingNo || "-"}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-[12px] ${rowTextClass}`}>{fmtDateOnly(item.shippedAt, lang)}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-[12px] ${rowTextClass}`}>
                                <div className="flex items-center gap-2">
                                  {item.stockBatchShouldBill ? (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#273a8a] text-[10px] font-semibold leading-none text-white">
                                      {lang === "zh" ? "备" : "S"}
                                    </span>
                                  ) : null}
                                  <span>{item.sku}</span>
                                </div>
                              </td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] ${rowTextClass}`}>{item.quantity}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] ${item.displayReincluded && !financeStatementIsPaid ? "text-rose-600" : "text-slate-900"}`}>{item.unitPrice > 0 ? `$${fmtMoney(item.unitPrice, lang)}` : "-"}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] ${rowTextClass}`}>{item.normalDiscount > 0 ? `${fmtPercent(item.normalDiscount, lang)}%` : "-"}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] ${rowTextClass}`}>{financeStatementVipEnabled && item.vipDiscount > 0 ? `${fmtPercent(item.vipDiscount, lang)}%` : "-"}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] font-normal ${item.displayReincluded && !financeStatementIsPaid ? "text-rose-600" : "text-slate-900"}`}>{item.displayProductAmount > 0 ? `$${fmtMoney(item.displayProductAmount, lang)}` : "-"}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] ${item.displayReincluded && !financeStatementIsPaid ? "text-rose-600" : "text-slate-900"}`}>{item.displayConvertedAmount > 0 ? formatSettlementAmount(item.displayConvertedAmount, financeStatementMode, lang) : "-"}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] ${item.displayReincluded && !financeStatementIsPaid ? "text-rose-600" : "text-slate-900"}`}>{item.displayShippingAmount > 0 ? formatSettlementAmount(item.displayShippingAmount, financeStatementMode, lang) : "-"}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right text-[12px] font-normal ${financeStatementIsPaid ? "text-slate-950" : "text-rose-600"}`}>{formatSettlementAmount(item.displayCnyTotalAmount, financeStatementMode, lang)}</td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-5 lg:grid-cols-[1.7fr_1fr]">
                    <div className="px-1 py-1">
                      <h4 className="text-[14px] font-black tracking-tight text-slate-400">{lang === "zh" ? "备注说明" : "Notas"}</h4>
                      <div className="mt-4 space-y-[13px] text-[12px] leading-[18px] text-slate-400">
                        <p>{lang === "zh" ? "1. 商品按墨西哥比索（MXN）计价。" : "1. Los productos se cotizan en MXN."}</p>
                        <p>
                          {lang === "zh"
                            ? financeStatementVipEnabled
                              ? "2. 产品金额按单价、发货数量、普通折扣和 VIP 折扣计算。"
                              : "2. 产品金额按单价、发货数量和普通折扣计算。"
                            : financeStatementVipEnabled
                              ? "2. El monto del producto considera precio, cantidad y descuentos."
                              : "2. El monto del producto considera precio, cantidad y descuento general."}
                        </p>
                        <p>{financeStatementMode === "MXN"
                          ? (lang === "zh" ? "3. 代发费先按人民币确定，再按结算汇率折算为比索。" : "3. El servicio se define en RMB y luego se convierte a MXN.")
                          : (lang === "zh" ? "3. 代发费按唯一物流单计入人民币费用。" : "3. El servicio se cobra una vez por guia unica.")}</p>
                        <p>{financeStatementMode === "MXN"
                          ? (lang === "zh" ? "4. 合计 = 商品金额（MXN） + 当行代发费（MXN）。" : "4. Total MXN = productos + servicio por fila.")
                          : (lang === "zh" ? "4. 合计 = 折算 + 当行代发费。" : "4. Total = conversion + servicio por fila.")}</p>
                      </div>
                    </div>
                    <div className="px-1 py-1 text-slate-400">
                      <h4 className="text-[14px] font-black tracking-tight">{lang === "zh" ? "结算汇总" : "Resumen"}</h4>
                      <div className="mt-4 space-y-[13px] text-[12px]">
                        {[
                          [lang === "zh" ? "商品金额（比索）" : "Productos (MXN)", `$${fmtMoney(financeStatementSummary.mxnSubtotal, lang)}`],
                          [financeStatementLabels.productSettlement, formatSettlementAmount(financeStatementSummary.cnySubtotal, financeStatementMode, lang)],
                          [financeStatementLabels.serviceFee, formatSettlementAmount(financeStatementSummary.serviceFeeTotal, financeStatementMode, lang)],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="flex items-center justify-between border-b border-slate-200 pb-[13px]">
                            <span className="text-slate-400">{label}</span>
                            <span className="text-slate-400">{value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-[18px] mb-[18px] flex items-end justify-between gap-3">
                        <span className="text-[16px] font-black tracking-tight text-slate-400">{lang === "zh" ? "应付总额" : "Total"}</span>
                        <span className={`text-[16px] font-black tracking-tight ${financeStatementIsPaid ? "text-slate-950" : "text-rose-600"}`}>{formatSettlementAmount(financeStatementSummary.payableTotal, financeStatementMode, lang)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {financePreview && financeStatementSummary && financeStatementRevokeState ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setFinanceStatementRevokeState(null)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{lang === "zh" ? "撤销生成" : "Revocar generacion"}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {lang === "zh" ? "请输入完整对账单号，并填写备注后继续。" : "Ingresa el folio completo y agrega una nota."}
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="text-sm text-slate-600">{lang === "zh" ? "完整对账单号" : "Folio completo"}</label>
                  <span className="text-xs text-slate-400">{financeCurrentStatementNumber || financeStatementSummary.statementNumber}</span>
                </div>
                <input
                  value={financeStatementRevokeState.confirmStatementNumber}
                  onChange={(event) => setFinanceStatementRevokeState((prev) => prev ? { ...prev, confirmStatementNumber: event.target.value, error: "" } : prev)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">{lang === "zh" ? "备注" : "Nota"}</label>
                <textarea
                  value={financeStatementRevokeState.note}
                  onChange={(event) => setFinanceStatementRevokeState((prev) => prev ? { ...prev, note: event.target.value, error: "" } : prev)}
                  className="min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-primary/40"
                />
              </div>
              {financeStatementRevokeState.error ? <div className="text-sm text-rose-600">{financeStatementRevokeState.error}</div> : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setFinanceStatementRevokeState(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50">
                {lang === "zh" ? "取消" : "Cancelar"}
              </button>
              <button
                type="button"
                disabled={financeStatementActionLoading === "revoke"}
                onClick={() => {
                  if (financeStatementRevokeState.confirmStatementNumber.trim() !== (financeCurrentStatementNumber || financeStatementSummary.statementNumber).trim()) {
                    setFinanceStatementRevokeState((prev) => prev ? { ...prev, error: lang === "zh" ? "对账单号校验失败" : "El folio no coincide" } : prev);
                    return;
                  }
                  if (!financeStatementRevokeState.note.trim()) {
                    setFinanceStatementRevokeState((prev) => prev ? { ...prev, error: lang === "zh" ? "请填写备注" : "Escribe una nota" } : prev);
                    return;
                  }
                  void updateFinanceStatementGeneratedState("revoke", {
                    note: financeStatementRevokeState.note.trim(),
                    confirmStatementNumber: financeStatementRevokeState.confirmStatementNumber.trim(),
                  });
                }}
                className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {lang === "zh" ? "确认撤销" : "Confirmar"}
              </button>
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
      {duplicateAlertMessage ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pb-5 pt-6">
              <p className="text-base font-semibold text-slate-900">
                {lang === "zh" ? "提示" : "Aviso"}
              </p>
              <p className="mt-3 text-sm text-slate-700">{duplicateAlertMessage}</p>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setDuplicateAlertMessage("")}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                {lang === "zh" ? "确定" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {inventoryDeleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pb-5 pt-6">
              <p className="text-base font-semibold text-slate-900">
                {lang === "zh" ? "确认删除" : "Confirmar eliminacion"}
              </p>
              <p className="mt-3 text-sm text-slate-700">
                {inventoryDeleteTarget.kind === "inventory"
                  ? (lang === "zh" ? "确认删除这条备货记录？" : "Eliminar este registro de stock?")
                  : (lang === "zh" ? "确认删除这条已发商品记录？" : "Eliminar este registro enviado?")}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {inventoryDeleteTarget.row.sku} / {inventoryDeleteTarget.row.productNameZh || "-"}
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setInventoryDeleteTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {lang === "zh" ? "取消" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => void confirmInventoryDelete()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                {lang === "zh" ? "确定" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ImageLightbox
        open={Boolean(previewImage)}
        src={previewImage?.src || ""}
        fallbackSources={previewImage?.fallbackSources || []}
        title={previewImage?.title || ""}
        onClose={() => setPreviewImage(null)}
      />
      <style jsx>{`
        .finance-reminder-breath {
          animation: finance-reminder-breath 2.8s ease-in-out infinite;
          transform-origin: center;
          will-change: transform, opacity, box-shadow;
        }

        @keyframes finance-reminder-breath {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.94;
            box-shadow: 0 1px 4px rgba(47, 60, 127, 0.1);
          }
          35% {
            transform: scale(1.018);
            opacity: 1;
            box-shadow: 0 2px 8px rgba(47, 60, 127, 0.14);
          }
          60% {
            transform: scale(1.01);
            opacity: 0.98;
            box-shadow: 0 1px 6px rgba(47, 60, 127, 0.12);
          }
        }
      `}</style>
    </section>
  );
}
