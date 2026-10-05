"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Barcode, FileSpreadsheet, IdCard, Maximize2, Minimize2, ScanLine, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import { PosDataTableShell } from "@/components/pos/pos-data-table-shell";
import { PosEmptyState } from "@/components/pos/pos-empty-state";
import { PosFilterBar } from "@/components/pos/pos-filter-bar";
import { PosModalShell } from "@/components/pos/pos-modal-shell";
import { PosSectionCard } from "@/components/pos/pos-section-card";
import { PosStatsCards } from "@/components/pos/pos-stats-cards";
import { PosTicketPreview } from "@/components/pos/pos-ticket-preview";
import { ImageLightbox } from "@/components/image-lightbox";
import { ProductImage } from "@/components/product-image";
import { type Lang, t } from "@/lib/i18n";
import { buildProductImageUrl, buildProductImageUrls } from "@/lib/product-image-url";
import { getPosAuditActionLabelKey, getPosAuditModuleLabelKey, getPosAuditTargetLabelKey } from "@/lib/pos/audit-labels";
import { getCurrentCart, setCurrentCart, setPosCashierContext, setPosStoreContext } from "@/lib/pos/mock/pos-memory-store";
import { hasPosActionPermission, type PosAccessContext } from "@/lib/pos/access";
import { getAppPermissionDefinition, getDefaultPosActionPermissionKeysByRole, POS_CONFIGURABLE_PERMISSION_KEYS, type AppPermissionMap } from "@/lib/permissions";
import { exportPosAuditLogsService, getPosAuditLogDetailService, listPosAuditLogsService } from "@/lib/pos/services/pos-audit.service";
import { addProductToCart as addProductToCartService, clearCart, createEmptyCart, removeCartLine, setCustomerField, setLineDiscount, setOrderDiscount, setPaymentMethod as setPaymentMethodService, setReceivedAmount as setReceivedAmountService, updateCartLineQty } from "@/lib/pos/services/pos-cart.service";
import { checkoutPosSaleService } from "@/lib/pos/services/pos-checkout.service";
import { quoteToCart as quoteToCartService } from "@/lib/pos/services/pos-quote.service";
import { listPosPrimaryCategoriesService, listPosProductsService, searchPosProductsService } from "@/lib/pos/services/pos-products.service";
import { createPosQuoteService, deletePosQuoteService, listPosQuotesService } from "@/lib/pos/services/pos-quote-data.service";
import { adjustPosInventoryService, countPosInventoryService, damagePosInventoryService, getPosInventoryDetailService, listPosInventoryMovementsService, listPosInventoryService } from "@/lib/pos/services/pos-inventory.service";
import { exportPosFinanceReportService, exportPosInventoryMovementsService, exportPosInventoryReportService, exportPosInventoryService, exportPosReplenishmentService, exportPosSalesService } from "@/lib/pos/services/pos-export.service";
import { commitPosInventoryImportService, downloadPosInventoryImportTemplate, parsePosInventoryImportFile, previewPosInventoryImportService } from "@/lib/pos/services/pos-inventory-import.service";
import { listPosReplenishmentSuggestionsService } from "@/lib/pos/services/pos-replenishment.service";
import { getPosDashboardSummaryService, getPosInventoryOverviewService, getPosPaymentsSummaryService, getPosSalesTrendService, getPosTopProductsReportService } from "@/lib/pos/services/pos-reports.service";
import { getPosSaleDetailService, listPosSalesService, refundPosSaleService } from "@/lib/pos/services/pos-sales.service";
import { createPosCashierService, getPosCashierService, listPosCashiersService, updatePosCashierService, updatePosCashierStatusService } from "@/lib/pos/services/pos-cashiers.service";
import { listPosStoresService, savePosStoreService } from "@/lib/pos/services/pos-stores.service";
import { createPosSuspendedOrderService, deletePosSuspendedOrderService, listPosSuspendedOrdersService, resumePosSuspendedOrderService } from "@/lib/pos/services/pos-suspended-data.service";
import { getPosSaleTicketService, printPosTicket } from "@/lib/pos/services/pos-ticket.service";
import { listPosTicketSettingsService, savePosTicketSettingService } from "@/lib/pos/services/pos-ticket-settings-config.service";
import { createPosTransferService, getPosTransferDetailService, listPosTransfersService, receivePosTransferService, sendPosTransferService } from "@/lib/pos/services/pos-transfers.service";
import { buildBarcodeSvgMarkup, canRenderEan13Barcode, normalizeEan13Barcode } from "@/lib/pos/barcode";
import { PHONE_COUNTRIES } from "@/lib/user-account";
import { type PosAuditLogDetail, type PosAuditLogItem, type PosCart, type PosCartLine, type PosCashierItem, type PosCashierRole, type PosCashierUpsertInput, type PosDashboardSummary, type PosDiscountType, type PosInventoryAdjustInput, type PosInventoryCountInput, type PosInventoryDamageInput, type PosInventoryDetail, type PosInventoryImportCommitResult, type PosInventoryImportPreviewResult, type PosInventoryImportRowInput, type PosInventoryItem, type PosInventoryMovementItem, type PosInventoryOverview, type PosLabelItem, type PosLabelPrintFields, type PosLabelSize, type PosLabelTemplateType, type PosPaymentMethod, type PosPaymentsSummary, type PosPermissionOverrideItem, type PosProduct, type PosQuoteDraft, type PosRefundRecord, type PosReplenishmentSuggestionItem, type PosSaleListItem, type PosSalesTrendPoint, type PosStoreSetting, type PosSuspendedOrder, type PosTicketDto, type PosTicketSettingConfig, type PosTopProductsReport, type PosTransferCreateLineInput, type PosTransferDetail, type PosTransferItem } from "@/lib/pos/types";

declare global {
  interface Window {
    openCashDrawer?: () => void | Promise<void>;
    parksonPos?: {
      openCashDrawer?: () => void | Promise<void>;
    };
  }
}

export type PosTabId =
  | "workbench"
  | "cashier"
  | "suspended"
  | "quote"
  | "sales_docs"
  | "returns_void"
  | "products_prices"
  | "store_inventory"
  | "inventory_movement"
  | "inventory_import"
  | "transfers"
  | "finance_stats"
  | "inventory_stats"
  | "replenishment"
  | "audit_logs"
  | "cashiers"
  | "store_settings"
  | "receipt_template"
  | "system_settings";

type PosModuleProps = {
  lang: Lang;
  initialActiveTab: PosTabId;
  permissionMap: AppPermissionMap;
  posAccess: PosAccessContext;
  storeOptions: Array<{ id: string; name: string }>;
};

type PosTabConfig = {
  id: PosTabId;
  group: "sales" | "inventory" | "finance" | "system";
  permission: keyof AppPermissionMap;
  navKey: string;
  titleKey: string;
  subtitleKey: string;
  futureKey: string;
};

type PosMainNavId = "workbench" | "cashier_ops" | "inventory_ops" | "reports_ops" | "settings_ops";

type PosLabelPrintState = {
  open: boolean;
  source: "products" | "inventory";
  template: PosLabelTemplateType;
  size: PosLabelSize;
  fields: PosLabelPrintFields;
  items: PosLabelItem[];
};

type SearchState = {
  barcode: string;
  query: string;
};

type CashierViewMode = "layout1" | "layout2";

type WorkbenchSalesDetailRow = PosSalesTrendPoint;

type WorkbenchSalesDetailModal = {
  title: string;
  storeName?: string;
  rows: WorkbenchSalesDetailRow[];
};

type DiscountTarget =
  | { kind: "line"; lineId: string }
  | { kind: "order" }
  | { kind: "quote_line"; lineId: string }
  | { kind: "quote_order" };

const POS_TABS: PosTabConfig[] = [
  { id: "workbench", group: "sales", permission: "pos.workbench.view", navKey: "pos.nav.workbench", titleKey: "pos.page.workbench.title", subtitleKey: "pos.page.workbench.subtitle", futureKey: "pos.page.workbench.future" },
  { id: "cashier", group: "sales", permission: "pos.cashier.view", navKey: "pos.nav.cashier", titleKey: "pos.page.cashier.title", subtitleKey: "pos.page.cashier.subtitle", futureKey: "pos.page.cashier.future" },
  { id: "suspended", group: "sales", permission: "pos.suspended.view", navKey: "pos.nav.suspended", titleKey: "pos.page.suspended.title", subtitleKey: "pos.page.suspended.subtitle", futureKey: "pos.page.suspended.future" },
  { id: "quote", group: "sales", permission: "pos.quote.view", navKey: "pos.nav.quote", titleKey: "pos.page.quote.title", subtitleKey: "pos.page.quote.subtitle", futureKey: "pos.page.quote.future" },
  { id: "sales_docs", group: "sales", permission: "pos.sales_docs.view", navKey: "pos.nav.sales_docs", titleKey: "pos.page.sales_docs.title", subtitleKey: "pos.page.sales_docs.subtitle", futureKey: "pos.page.sales_docs.future" },
  { id: "returns_void", group: "sales", permission: "pos.returns_void.view", navKey: "pos.nav.returns_void", titleKey: "pos.page.returns_void.title", subtitleKey: "pos.page.returns_void.subtitle", futureKey: "pos.page.returns_void.future" },
  { id: "products_prices", group: "inventory", permission: "pos.products_prices.view", navKey: "pos.nav.products_prices", titleKey: "pos.page.products_prices.title", subtitleKey: "pos.page.products_prices.subtitle", futureKey: "pos.page.products_prices.future" },
  { id: "store_inventory", group: "inventory", permission: "pos.store_inventory.view", navKey: "pos.nav.store_inventory", titleKey: "pos.page.store_inventory.title", subtitleKey: "pos.page.store_inventory.subtitle", futureKey: "pos.page.store_inventory.future" },
  { id: "inventory_movement", group: "inventory", permission: "pos.inventory_movement.view", navKey: "pos.nav.inventory_movement", titleKey: "pos.page.inventory_movement.title", subtitleKey: "pos.page.inventory_movement.subtitle", futureKey: "pos.page.inventory_movement.future" },
  { id: "inventory_import", group: "inventory", permission: "pos.inventory_import.view", navKey: "pos.nav.inventory_import", titleKey: "pos.page.inventory_import.title", subtitleKey: "pos.page.inventory_import.subtitle", futureKey: "pos.page.inventory_import.future" },
  { id: "transfers", group: "inventory", permission: "pos.transfers.view", navKey: "pos.nav.transfers", titleKey: "pos.page.transfers.title", subtitleKey: "pos.page.transfers.subtitle", futureKey: "pos.page.transfers.future" },
  { id: "finance_stats", group: "finance", permission: "pos.finance_stats.view", navKey: "pos.nav.finance_stats", titleKey: "pos.page.finance_stats.title", subtitleKey: "pos.page.finance_stats.subtitle", futureKey: "pos.page.finance_stats.future" },
  { id: "inventory_stats", group: "finance", permission: "pos.inventory_stats.view", navKey: "pos.nav.inventory_stats", titleKey: "pos.page.inventory_stats.title", subtitleKey: "pos.page.inventory_stats.subtitle", futureKey: "pos.page.inventory_stats.future" },
  { id: "replenishment", group: "finance", permission: "pos.replenishment.view", navKey: "pos.nav.replenishment", titleKey: "pos.page.replenishment.title", subtitleKey: "pos.page.replenishment.subtitle", futureKey: "pos.page.replenishment.future" },
  { id: "audit_logs", group: "system", permission: "pos.audit_logs.view", navKey: "pos.nav.audit_logs", titleKey: "pos.page.audit_logs.title", subtitleKey: "pos.page.audit_logs.subtitle", futureKey: "pos.page.audit_logs.future" },
  { id: "cashiers", group: "system", permission: "pos.cashiers.view", navKey: "pos.nav.cashiers", titleKey: "pos.page.cashiers.title", subtitleKey: "pos.page.cashiers.subtitle", futureKey: "pos.page.cashiers.future" },
  { id: "store_settings", group: "system", permission: "pos.store_settings.view", navKey: "pos.nav.store_settings", titleKey: "pos.page.store_settings.title", subtitleKey: "pos.page.store_settings.subtitle", futureKey: "pos.page.store_settings.future" },
  { id: "receipt_template", group: "system", permission: "pos.receipt_template.view", navKey: "pos.nav.receipt_template", titleKey: "pos.page.receipt_template.title", subtitleKey: "pos.page.receipt_template.subtitle", futureKey: "pos.page.receipt_template.future" },
  { id: "system_settings", group: "system", permission: "pos.system_settings.view", navKey: "pos.nav.system_settings", titleKey: "pos.page.system_settings.title", subtitleKey: "pos.page.system_settings.subtitle", futureKey: "pos.page.system_settings.future" },
];

const GROUP_ORDER: Array<PosTabConfig["group"]> = ["sales", "inventory", "finance", "system"];

const POS_MAIN_NAV: Array<{ id: PosMainNavId; labelKey: string }> = [
  { id: "workbench", labelKey: "pos.nav.main.workbench" },
  { id: "cashier_ops", labelKey: "pos.nav.main.cashier" },
  { id: "inventory_ops", labelKey: "pos.nav.main.inventory" },
  { id: "reports_ops", labelKey: "pos.nav.main.reports" },
  { id: "settings_ops", labelKey: "pos.nav.main.settings" },
];

const POS_MAIN_NAV_TABS: Record<PosMainNavId, PosTabId[]> = {
  workbench: ["workbench"],
  cashier_ops: ["cashier", "suspended", "quote", "sales_docs", "returns_void"],
  inventory_ops: ["products_prices", "store_inventory", "inventory_movement", "inventory_import", "transfers"],
  reports_ops: ["finance_stats", "inventory_stats", "replenishment"],
  settings_ops: ["audit_logs", "cashiers", "store_settings", "receipt_template", "system_settings"],
};

const LABEL_FIELD_DEFAULTS: PosLabelPrintFields = {
  price: true,
  barcode: true,
  nameCn: true,
  nameEs: true,
  clave: true,
  origin: false,
  importer: false,
  shortDescription: false,
};

const POS_PERMISSION_GROUPS = [
  {
    key: "sales",
    titleKey: "pos.nav.main.cashier",
    permissions: ["pos.sale.view", "pos.sale.refund", "pos.sale.export"],
  },
  {
    key: "inventory",
    titleKey: "pos.nav.main.inventory",
    permissions: [
      "pos.inventory.view",
      "pos.inventory.adjust",
      "pos.inventory.count",
      "pos.inventory.damage",
      "pos.inventory.import",
      "pos.inventory.export",
      "pos.inventory.movements.view",
    ],
  },
  {
    key: "transfer",
    titleKey: "pos.nav.transfers",
    permissions: ["pos.transfer.view", "pos.transfer.create", "pos.transfer.send", "pos.transfer.receive"],
  },
  {
    key: "reports",
    titleKey: "pos.nav.main.reports",
    permissions: ["pos.report.finance.view", "pos.report.inventory.view", "pos.replenishment.view", "pos.report.export"],
  },
  {
    key: "config",
    titleKey: "pos.nav.main.settings",
    permissions: ["pos.store.manage", "pos.ticket.manage", "pos.cashier.manage"],
  },
  {
    key: "audit",
    titleKey: "pos.nav.audit_logs",
    permissions: ["pos.audit.view"],
  },
] as const;

function formatCurrency(lang: Lang, value: number) {
  return `$${value.toFixed(2)} MX`;
}

function formatCurrencyWithSymbolGap(value: number) {
  return `$${value.toFixed(2)} MX`;
}

function CurrencyParts({
  value,
  symbolClassName,
  valueClassName,
}: {
  value: number;
  symbolClassName: string;
  valueClassName: string;
}) {
  const formattedValue = value.toFixed(2);
  const [integerPart, decimalPart = "00"] = formattedValue.split(".");

  return (
    <span className="inline-flex items-baseline">
      <span className={symbolClassName}>$</span>
      <span className={`inline-flex items-start ${valueClassName}`}>
        <span>{integerPart}</span>
        <span className="ml-0.5 text-[0.52em] leading-none">{decimalPart}</span>
      </span>
      <span className={`ml-1 ${symbolClassName}`}>MX</span>
    </span>
  );
}

function formatDateTime(lang: Lang, value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function toDateInputValue(input: Date) {
  const year = input.getFullYear();
  const month = `${input.getMonth() + 1}`.padStart(2, "0");
  const day = `${input.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(now),
  };
}

function getRecentDateRange(days: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));
  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(now),
  };
}

function getCurrentWeekDateRange() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(end),
  };
}

function getCurrentMonthDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(end),
  };
}

function getDateBuckets(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const buckets: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    buckets.push(toDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function getCurrentWeekLabel() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}-${end.getDate()}号`;
}

function getCurrentMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
}

function getDayLabel(input: string) {
  return input.slice(8, 10);
}

function formatTrendAmount(lang: Lang, amount: number) {
  return formatCurrencyWithSymbolGap(amount);
}

function openingCashLabel(lang: Lang) {
  return lang === "zh" ? "开业现金" : "Efectivo inicial";
}

function openDrawerLabel(lang: Lang) {
  return lang === "zh" ? "开钱箱" : "Abrir cajon";
}

function cashierPasswordPromptLabel(lang: Lang) {
  return lang === "zh" ? "输入收款员密码" : "Ingresa la clave del cajero";
}

function openDrawerConfirmLabel(lang: Lang) {
  return lang === "zh" ? "打开钱箱" : "Abrir cajon";
}

function cashierPasswordRequiredLabel(lang: Lang) {
  return lang === "zh" ? "请输入收款员密码" : "Ingresa la clave del cajero";
}

function cashierPasswordInvalidLabel(lang: Lang) {
  return lang === "zh" ? "收款员密码错误" : "Clave del cajero incorrecta";
}

function cashDrawerInterfaceMissingLabel(lang: Lang) {
  return lang === "zh" ? "未检测到钱箱控制接口" : "No se detecto la interfaz del cajon";
}

function cashierAutoCloseEnabledLabel(lang: Lang) {
  return lang === "zh" ? "定时关闭POS页面" : "Cerrar POS por inactividad";
}

function cashierAutoCloseMinutesLabel(lang: Lang) {
  return lang === "zh" ? "定时关闭分钟" : "Minutos para cerrar";
}

function cashierAutoCloseHintLabel(lang: Lang) {
  return lang === "zh" ? "只关闭收银页两张卡片，顶部导航保持可见。分钟只允许整数。" : "Solo cierra las dos tarjetas del cajero. La barra superior sigue visible. Solo enteros.";
}

function cashierClosedButtonLabel(lang: Lang) {
  return lang === "zh" ? "开启收款机" : "Abrir caja";
}

function cashierClosedPasswordTitle(lang: Lang) {
  return lang === "zh" ? "输入密码开启收款机" : "Ingresa la clave para abrir la caja";
}

function formatCashierClosedDateTime(lang: Lang, input: Date) {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(input);
}

function formatSalesDetailDate(lang: Lang, bucket: string) {
  const month = bucket.slice(5, 7);
  const day = bucket.slice(8, 10);
  return lang === "zh" ? `${month}月${day}日` : `${day}/${month}`;
}

function getLineDiscount(line: PosCartLine) {
  return Math.max(0, line.qty * line.unitPrice - line.subtotal);
}

function paymentLabel(lang: Lang, paymentMethod: PosPaymentMethod) {
  if (paymentMethod === "cash") return t(lang, "pos.payment.cash");
  if (paymentMethod === "transfer") return t(lang, "pos.payment.transfer");
  if (paymentMethod === "card") return t(lang, "pos.payment.card");
  return "-";
}

function labelSizeLabel(lang: Lang, size: PosLabelSize) {
  return t(lang, size === "40x50" ? "pos.field.label_size_product" : "pos.field.label_size_shelf");
}

function recordStatusLabel(lang: Lang, status: string) {
  if (status === "suspended") return t(lang, "pos.status.suspended");
  if (status === "draft" || status === "quoted") return t(lang, "pos.status.quoted");
  if (status === "resumed") return t(lang, "pos.status.completed");
  if (status === "refunded") return t(lang, "pos.status.refunded");
  return status;
}

function sourceTypeLabel(lang: Lang, sourceType: string) {
  if (sourceType === "suspended") return t(lang, "pos.status.suspended");
  if (sourceType === "quote") return t(lang, "pos.status.quoted");
  return t(lang, "pos.status.direct_sale");
}

function isMeaningfulCategory(value?: string | null) {
  const text = String(value || "").trim();
  if (!text || text === "-") return false;
  if (/%/u.test(text) || /vip|折扣|discount/iu.test(text)) return false;
  return true;
}

function inventoryStatusLabel(lang: Lang, status: string) {
  if (status === "out") return t(lang, "pos.status.out_of_stock");
  if (status === "low") return t(lang, "pos.status.low_inventory");
  return t(lang, "pos.status.inventory_ok");
}

function inventoryMoveTypeLabel(lang: Lang, moveType: string) {
  if (moveType === "sale") return t(lang, "pos.status.move_sale");
  if (moveType === "return") return t(lang, "pos.status.move_return");
  if (moveType === "adjust") return t(lang, "pos.status.move_adjust");
  if (moveType === "import") return t(lang, "pos.status.move_import");
  if (moveType === "count") return t(lang, "pos.status.move_count");
  if (moveType === "damage") return t(lang, "pos.status.move_damage");
  if (moveType === "transfer_out") return t(lang, "pos.status.move_transfer_out");
  if (moveType === "transfer_in") return t(lang, "pos.status.move_transfer_in");
  return moveType;
}

function auditResultLabel(lang: Lang, status: string) {
  if (status === "success") return t(lang, "pos.status.audit_success");
  if (status === "failed") return t(lang, "pos.status.audit_failed");
  if (status === "denied") return t(lang, "pos.status.audit_denied");
  return status;
}

function auditActionLabel(lang: Lang, actionType: string) {
  const labelKey = getPosAuditActionLabelKey(actionType);
  return labelKey ? t(lang, labelKey) : actionType;
}

function auditModuleLabel(lang: Lang, module: string) {
  const labelKey = getPosAuditModuleLabelKey(module);
  return labelKey ? t(lang, labelKey) : module;
}

function auditTargetLabel(lang: Lang, targetType?: string | null) {
  const labelKey = getPosAuditTargetLabelKey(targetType);
  return labelKey ? t(lang, labelKey) : auditFieldValue(targetType);
}

function auditFieldValue(value?: string | null) {
  return value && value.trim() ? value : "-";
}

function auditDisplayValue(lang: Lang, labelKey: string, value?: string | null) {
  const raw = auditFieldValue(value);
  if (raw === "-") return raw;
  if (labelKey === "pos.field.payment_method") return paymentLabel(lang, raw as PosPaymentMethod);
  if (labelKey === "pos.field.source_type") return sourceTypeLabel(lang, raw);
  if (labelKey === "pos.field.role") return posRoleLabel(lang, raw);
  if (labelKey === "pos.field.result") return auditResultLabel(lang, raw);
  return raw;
}

function posRoleLabel(lang: Lang, role: string) {
  if (role === "admin_general") return t(lang, "pos.role.admin_general");
  if (role === "cashier") return t(lang, "pos.role.cashier");
  return t(lang, "pos.role.store_admin");
}

function transferStatusLabel(lang: Lang, status: string) {
  if (status === "sent") return t(lang, "pos.status.transfer_sent");
  if (status === "received") return t(lang, "pos.status.transfer_received");
  if (status === "canceled") return t(lang, "pos.status.transfer_canceled");
  return t(lang, "pos.status.transfer_draft");
}

function inventoryImportReasonLabel(lang: Lang, reason: string) {
  if (reason === "POS_IMPORT_READY") return t(lang, "pos.status.import_ready");
  if (reason === "POS_IMPORT_STORE_NOT_FOUND") return t(lang, "pos.notice.import_store_not_found");
  if (reason === "POS_IMPORT_IDENTIFIER_REQUIRED") return t(lang, "pos.notice.import_identifier_required");
  if (reason === "POS_IMPORT_PRODUCT_NOT_FOUND") return t(lang, "pos.notice.import_product_not_found");
  if (reason === "POS_IMPORT_PRODUCT_MISMATCH") return t(lang, "pos.notice.import_product_mismatch");
  if (reason === "POS_IMPORT_QTY_INVALID") return t(lang, "pos.notice.import_qty_invalid");
  if (reason === "POS_IMPORT_DUPLICATE_ROW") return t(lang, "pos.notice.import_duplicate_row");
  return reason;
}

function posErrorLabel(lang: Lang, raw: string) {
  const [code, detail] = raw.split("::");
  if (code === "POS_STORE_NAME_REQUIRED") return t(lang, "pos.notice.store_name_required");
  if (code === "POS_STORE_LOAD_FAILED") return t(lang, "pos.notice.store_load_failed");
  if (code === "POS_STORE_SAVE_FAILED") return t(lang, "pos.notice.store_save_failed");
  if (code === "POS_TICKET_SETTING_LOAD_FAILED") return t(lang, "pos.notice.ticket_setting_load_failed");
  if (code === "POS_TICKET_SETTING_SAVE_FAILED") return t(lang, "pos.notice.ticket_setting_save_failed");
  if (code === "POS_CASHIER_LOAD_FAILED") return t(lang, "pos.notice.cashier_load_failed");
  if (code === "POS_CASHIER_SAVE_FAILED") return t(lang, "pos.notice.cashier_save_failed");
  if (code === "POS_CASHIER_NOT_FOUND") return t(lang, "pos.notice.cashier_not_found");
  if (code === "POS_CASHIER_ACCOUNT_REQUIRED") return t(lang, "pos.notice.cashier_account_required");
  if (code === "POS_CASHIER_NAME_INVALID") return t(lang, "pos.notice.cashier_name_invalid");
  if (code === "POS_CASHIER_PHONE_INVALID") return t(lang, "pos.notice.cashier_phone_invalid");
  if (code === "POS_CASHIER_EMAIL_INVALID") return t(lang, "pos.notice.cashier_email_invalid");
  if (code === "POS_CASHIER_STORE_REQUIRED") return t(lang, "pos.notice.cashier_store_required");
  if (code === "POS_CASHIER_PASSWORD_INVALID") return t(lang, "pos.notice.cashier_password_invalid");
  if (code === "POS_CASHIER_DUPLICATE") return t(lang, "pos.notice.cashier_duplicate");
  if (code === "CHECKOUT_EMPTY_CART" || code === "CHECKOUT_EMPTY_LINES") return t(lang, "pos.notice.cart_empty");
  if (code === "CHECKOUT_PAYMENT_REQUIRED" || code === "CHECKOUT_INVALID_PAYMENT") return t(lang, "pos.notice.payment_incomplete");
  if (code === "CHECKOUT_SOURCE_COMPLETED") return t(lang, "pos.notice.source_completed");
  if (code === "CHECKOUT_SOURCE_NOT_FOUND") return t(lang, "pos.notice.source_not_found");
  if (code === "CHECKOUT_SOURCE_INVALID") return t(lang, "pos.notice.source_invalid");
  if (code === "POS_PRODUCT_NOT_FOUND") return t(lang, "pos.notice.product_not_found_checkout", { product: detail || "-" });
  if (code === "POS_PRODUCT_INACTIVE") return t(lang, "pos.notice.product_inactive_checkout", { product: detail || "-" });
  if (code === "POS_STOCK_NOT_FOUND") return t(lang, "pos.notice.stock_not_found", { product: detail || "-" });
  if (code === "POS_STOCK_INSUFFICIENT") return t(lang, "pos.notice.stock_insufficient", { product: detail || "-" });
  if (code === "POS_SALE_NOT_FOUND") return t(lang, "pos.notice.sale_not_found");
  if (code === "POS_SALE_ALREADY_REFUNDED") return t(lang, "pos.notice.sale_already_refunded");
  if (code === "POS_SALE_REFUND_INVALID") return t(lang, "pos.notice.sale_refund_invalid");
  if (code === "POS_INVENTORY_NOT_FOUND") return t(lang, "pos.notice.inventory_not_found");
  if (code === "POS_INVENTORY_INVALID_ADJUST_QTY") return t(lang, "pos.notice.inventory_adjust_invalid_qty");
  if (code === "POS_INVENTORY_NEGATIVE_NOT_ALLOWED") return t(lang, "pos.notice.inventory_adjust_negative_not_allowed");
  if (code === "POS_COUNT_INVALID_FINAL_QTY") return t(lang, "pos.notice.inventory_count_invalid_final_qty");
  if (code === "POS_DAMAGE_INVALID_QTY") return t(lang, "pos.notice.inventory_damage_invalid_qty");
  if (code === "POS_DAMAGE_NEGATIVE_NOT_ALLOWED") return t(lang, "pos.notice.inventory_damage_negative_not_allowed");
  if (code === "POS_IMPORT_EMPTY_FILE") return t(lang, "pos.notice.import_empty_file");
  if (code === "POS_IMPORT_TEMPLATE_INVALID") return t(lang, "pos.notice.import_template_invalid");
  if (code === "POS_IMPORT_PREVIEW_INVALID") return t(lang, "pos.notice.import_preview_invalid");
  if (code === "POS_IMPORT_COMMIT_FAILED") return t(lang, "pos.notice.import_commit_failed");
  if (code === "POS_TRANSFER_NOT_FOUND") return t(lang, "pos.notice.transfer_not_found");
  if (code === "POS_TRANSFER_INVALID_STATUS") return t(lang, "pos.notice.transfer_invalid_status");
  if (code === "POS_TRANSFER_SAME_STORE_NOT_ALLOWED") return t(lang, "pos.notice.transfer_same_store");
  if (code === "POS_TRANSFER_EMPTY_LINES") return t(lang, "pos.notice.transfer_empty_lines");
  if (code === "POS_TRANSFER_STOCK_NOT_FOUND") return t(lang, "pos.notice.transfer_stock_not_found", { product: detail || "-" });
  if (code === "POS_TRANSFER_STOCK_INSUFFICIENT") return t(lang, "pos.notice.transfer_stock_insufficient", { product: detail || "-" });
  if (code === "POS_TRANSFER_ALREADY_RECEIVED") return t(lang, "pos.notice.transfer_already_received");
  if (code === "POS_FORBIDDEN") return t(lang, "pos.notice.forbidden");
  if (code === "POS_PERMISSION_DENIED") return t(lang, "pos.notice.permission_denied");
  if (code === "POS_STORE_SCOPE_DENIED") return t(lang, "pos.notice.store_scope_denied");
  if (code === "POS_ROLE_NOT_ALLOWED") return t(lang, "pos.notice.role_not_allowed");
  if (code === "POS_AUDIT_LOG_NOT_FOUND") return t(lang, "pos.notice.audit_not_found");
  if (code === "POS_AUDIT_LOG_LOAD_FAILED") return t(lang, "pos.notice.audit_load_failed");
  if (code === "PRINT_WINDOW_BLOCKED") return t(lang, "pos.notice.print_window_blocked");
  if (code === "CHECKOUT_FAILED") return t(lang, "pos.notice.checkout_failed");
  if (code === "POS_REFUND_FAILED") return t(lang, "pos.notice.refund_failed");
  if (code === "POS_INVENTORY_ADJUST_FAILED") return t(lang, "pos.notice.inventory_adjust_failed");
  if (code === "POS_INVENTORY_DAMAGE_FAILED") return t(lang, "pos.notice.inventory_damage_failed");
  if (code === "POS_EXPORT_FAILED") return t(lang, "pos.notice.export_failed");
  return raw;
}

export function PosModule({ lang, initialActiveTab, permissionMap, posAccess, storeOptions }: PosModuleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const storeSnapshot = useMemo(
    () => ({
      storeContext: {
        storeId: posAccess.defaultStoreId,
        storeName: posAccess.defaultStoreName,
      },
      cashierContext: {
        cashierId: posAccess.cashierId,
        cashierName: posAccess.cashierName,
      },
    }),
    [posAccess.cashierId, posAccess.cashierName, posAccess.defaultStoreId, posAccess.defaultStoreName],
  );
  const canCheckout = hasPosActionPermission(permissionMap, "pos.sale.checkout");
  const canSaleView = hasPosActionPermission(permissionMap, "pos.sale.view");
  const canRefund = hasPosActionPermission(permissionMap, "pos.sale.refund");
  const canSaleExport = hasPosActionPermission(permissionMap, "pos.sale.export");
  const canInventoryView = hasPosActionPermission(permissionMap, "pos.inventory.view");
  const canInventoryAdjust = hasPosActionPermission(permissionMap, "pos.inventory.adjust");
  const canInventoryCount = hasPosActionPermission(permissionMap, "pos.inventory.count");
  const canInventoryDamage = hasPosActionPermission(permissionMap, "pos.inventory.damage");
  const canImportInventory = hasPosActionPermission(permissionMap, "pos.inventory.import");
  const canInventoryExport = hasPosActionPermission(permissionMap, "pos.inventory.export");
  const canInventoryMovementsView = hasPosActionPermission(permissionMap, "pos.inventory.movements.view");
  const canTransferView = hasPosActionPermission(permissionMap, "pos.transfer.view");
  const canTransferCreate = hasPosActionPermission(permissionMap, "pos.transfer.create");
  const canTransferSend = hasPosActionPermission(permissionMap, "pos.transfer.send");
  const canTransferReceive = hasPosActionPermission(permissionMap, "pos.transfer.receive");
  const canFinanceReportView = hasPosActionPermission(permissionMap, "pos.report.finance.view");
  const canInventoryReportView = hasPosActionPermission(permissionMap, "pos.report.inventory.view");
  const canReplenishmentView = hasPosActionPermission(permissionMap, "pos.replenishment.view");
  const canReportExport = hasPosActionPermission(permissionMap, "pos.report.export");
  const canStoreManage = hasPosActionPermission(permissionMap, "pos.store.manage");
  const canTicketManage = hasPosActionPermission(permissionMap, "pos.ticket.manage");
  const canCashierManage = hasPosActionPermission(permissionMap, "pos.cashier.manage");
  const canAuditView = hasPosActionPermission(permissionMap, "pos.audit.view");
  const canLabelPrint = hasPosActionPermission(permissionMap, "pos.label.print");

  useEffect(() => {
    setPosStoreContext(storeSnapshot.storeContext);
    setPosCashierContext(storeSnapshot.cashierContext);
  }, [storeSnapshot]);

  const visibleTabs = useMemo(
    () => POS_TABS.filter((tab) => permissionMap[tab.permission]),
    [permissionMap],
  );

  const openingCashStorageKey = useMemo(
    () => `pos-opening-cash:${storeSnapshot.storeContext.storeId}:${new Date().toISOString().slice(0, 10)}`,
    [storeSnapshot.storeContext.storeId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(openingCashStorageKey);
    const parsed = Number(raw || 0);
    setOpeningCashAmount(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
  }, [openingCashStorageKey]);

  const [activeTab, setActiveTab] = useState<PosTabId>(initialActiveTab);
  const posFullscreenRef = useRef<HTMLDivElement | null>(null);
  const cashierBarcodeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeKeyHandledRef = useRef<{ key: string; code: string; at: number } | null>(null);
  const [cashierPrimaryCategory, setCashierPrimaryCategory] = useState("");
  const [cashierPrimaryCategoryOptions, setCashierPrimaryCategoryOptions] = useState<string[]>([]);
  const [cashierSecondaryCategory, setCashierSecondaryCategory] = useState("");
  const [cashierCategoryProducts, setCashierCategoryProducts] = useState<PosProduct[] | null>(null);
  const [cashierSearch, setCashierSearch] = useState<SearchState>({ barcode: "", query: "" });
  const [cashierViewMode, setCashierViewMode] = useState<CashierViewMode>("layout1");
  const [cashierSyncYogoProducts, setCashierSyncYogoProducts] = useState(false);
  const [cashierLayout2Qty, setCashierLayout2Qty] = useState(1);
  const [cashierProductPage, setCashierProductPage] = useState(1);
  const [layout2CartPage, setLayout2CartPage] = useState(1);
  const [cashierCategoryModalOpen, setCashierCategoryModalOpen] = useState(false);
  const [cashierCategoryPage, setCashierCategoryPage] = useState(1);
  const [quoteSearch, setQuoteSearch] = useState<SearchState>({ barcode: "", query: "" });
  const [cashierCustomerModalOpen, setCashierCustomerModalOpen] = useState(false);
  const [openingCashModalOpen, setOpeningCashModalOpen] = useState(false);
  const [openingCashDraft, setOpeningCashDraft] = useState("");
  const [openingCashAmount, setOpeningCashAmount] = useState(0);
  const [cashDrawerModalOpen, setCashDrawerModalOpen] = useState(false);
  const [cashDrawerPasswordDraft, setCashDrawerPasswordDraft] = useState("");
  const [cashDrawerSubmitting, setCashDrawerSubmitting] = useState(false);
  const [cashDrawerMessage, setCashDrawerMessage] = useState("");
  const [cashierClosed, setCashierClosed] = useState(false);
  const [cashierUnlockModalOpen, setCashierUnlockModalOpen] = useState(false);
  const [cashierUnlockPasswordDraft, setCashierUnlockPasswordDraft] = useState("");
  const [cashierUnlockSubmitting, setCashierUnlockSubmitting] = useState(false);
  const [cashierUnlockError, setCashierUnlockError] = useState("");
  const [cashierClockNow, setCashierClockNow] = useState(() => new Date());
  const [cashierLastActiveAt, setCashierLastActiveAt] = useState(() => Date.now());
  const [cashierFullscreenActive, setCashierFullscreenActive] = useState(false);
  const [cashierFullscreenFallback, setCashierFullscreenFallback] = useState(false);
  const quoteImportFileRef = useRef<HTMLInputElement | null>(null);
  const ticketLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cashierResults, setCashierResults] = useState<PosProduct[]>([]);
  const [quoteResults, setQuoteResults] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<PosCart>(() => getCurrentCart());
  const [quoteCart, setQuoteCart] = useState<PosCart>(() => createEmptyCart());
  const [selectedProductsModal, setSelectedProductsModal] = useState<{ mode: "cashier" | "quote"; items: PosProduct[] } | null>(null);
  const [discountTarget, setDiscountTarget] = useState<DiscountTarget | null>(null);
  const [discountModeDraft, setDiscountModeDraft] = useState<PosDiscountType>("percent");
  const [discountValueDraft, setDiscountValueDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [sales, setSales] = useState<PosSaleListItem[]>([]);
  const [ticketPreview, setTicketPreview] = useState<PosTicketDto | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendNoteDraft, setSuspendNoteDraft] = useState("");
  const [suspendedOrders, setSuspendedOrders] = useState<PosSuspendedOrder[]>([]);
  const [selectedSuspendedOrderId, setSelectedSuspendedOrderId] = useState<string | null>(null);
  const [resumeTarget, setResumeTarget] = useState<PosSuspendedOrder | null>(null);
  const [quotes, setQuotes] = useState<PosQuoteDraft[]>([]);
  const [quoteKeyword, setQuoteKeyword] = useState("");
  const [reportFilters, setReportFilters] = useState(() => ({
    storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
    ...getDefaultDateRange(),
  }));
  const [dashboardSummary, setDashboardSummary] = useState<PosDashboardSummary | null>(null);
  const [workbenchOrderPeriod, setWorkbenchOrderPeriod] = useState<"month" | "week" | "day">("week");
  const [paymentsSummary, setPaymentsSummary] = useState<PosPaymentsSummary | null>(null);
  const [topProductsReport, setTopProductsReport] = useState<PosTopProductsReport | null>(null);
  const [inventoryOverview, setInventoryOverview] = useState<PosInventoryOverview | null>(null);
  const [workbenchLowStockStoreId, setWorkbenchLowStockStoreId] = useState(
    posAccess.allowAllStores ? (storeOptions[0]?.id || storeSnapshot.storeContext.storeId) : storeSnapshot.storeContext.storeId,
  );
  const [workbenchLowStockOverview, setWorkbenchLowStockOverview] = useState<PosInventoryOverview | null>(null);
  const [workbenchLowStockModalOpen, setWorkbenchLowStockModalOpen] = useState(false);
  const [workbenchLowStockPage, setWorkbenchLowStockPage] = useState(1);
  const [workbenchLowStockPreviewImage, setWorkbenchLowStockPreviewImage] = useState<{ src: string; title: string; fallbackSources?: string[] } | null>(null);
  const [workbenchSalesStoreId, setWorkbenchSalesStoreId] = useState(
    posAccess.allowAllStores ? (storeOptions[0]?.id || storeSnapshot.storeContext.storeId) : storeSnapshot.storeContext.storeId,
  );
  const [replenishmentRows, setReplenishmentRows] = useState<PosReplenishmentSuggestionItem[]>([]);
  const [replenishmentTotal, setReplenishmentTotal] = useState(0);
  const [replenishmentStores, setReplenishmentStores] = useState<string[]>(storeOptions.map((item) => item.id));
  const [inventoryRows, setInventoryRows] = useState<PosInventoryItem[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryMovements, setInventoryMovements] = useState<PosInventoryMovementItem[]>([]);
  const [inventoryMovementTotal, setInventoryMovementTotal] = useState(0);
  const [salesTrend, setSalesTrend] = useState<PosSalesTrendPoint[]>([]);
  const [monthlySalesTrend, setMonthlySalesTrend] = useState<PosSalesTrendPoint[]>([]);
  const [workbenchStoreSummary, setWorkbenchStoreSummary] = useState<PosDashboardSummary | null>(null);
  const [workbenchStoreWeeklySalesTrend, setWorkbenchStoreWeeklySalesTrend] = useState<PosSalesTrendPoint[]>([]);
  const [workbenchStoreMonthlySalesTrend, setWorkbenchStoreMonthlySalesTrend] = useState<PosSalesTrendPoint[]>([]);
  const [workbenchSalesDetailModal, setWorkbenchSalesDetailModal] = useState<WorkbenchSalesDetailModal | null>(null);
  const [workbenchSalesDetailPage, setWorkbenchSalesDetailPage] = useState(1);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [replenishmentLoading, setReplenishmentLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryMovementLoading, setInventoryMovementLoading] = useState(false);
  const [inventoryFilters, setInventoryFilters] = useState({
    storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
    keyword: "",
    clave: "",
    barcode: "",
    status: "",
    lowStockOnly: false,
    page: 1,
    limit: 20,
  });
  const [inventoryMovementFilters, setInventoryMovementFilters] = useState(() => ({
    storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
    keyword: "",
    moveType: "",
    dateFrom: getDefaultDateRange().dateFrom,
    dateTo: getDefaultDateRange().dateTo,
    page: 1,
    limit: 20,
  }));
  const [replenishmentFilters, setReplenishmentFilters] = useState(() => ({
    storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
    keyword: "",
    lowStockOnly: true,
    suggestedOnly: true,
    ...getDefaultDateRange(),
    limit: 100,
  }));
  const [inventoryDetail, setInventoryDetail] = useState<PosInventoryDetail | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<PosInventoryDetail | null>(null);
  const [countTarget, setCountTarget] = useState<PosInventoryDetail | null>(null);
  const [damageTarget, setDamageTarget] = useState<PosInventoryDetail | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [countSubmitting, setCountSubmitting] = useState(false);
  const [damageSubmitting, setDamageSubmitting] = useState(false);
  const inventoryImportFileRef = useRef<HTMLInputElement | null>(null);
  const [adjustForm, setAdjustForm] = useState<PosInventoryAdjustInput>({
    adjustType: "increase",
    qty: 1,
    reason: "",
    note: "",
    operator: "",
  });
  const [countForm, setCountForm] = useState<PosInventoryCountInput>({
    finalQty: 0,
    reason: "",
    note: "",
    operator: "",
  });
  const [damageForm, setDamageForm] = useState<PosInventoryDamageInput>({
    qty: 1,
    reason: "",
    note: "",
    operator: "",
  });
  const [inventoryImportRows, setInventoryImportRows] = useState<PosInventoryImportRowInput[]>([]);
  const [inventoryImportFileName, setInventoryImportFileName] = useState("");
  const [inventoryImportPreview, setInventoryImportPreview] = useState<PosInventoryImportPreviewResult | null>(null);
  const [inventoryImportResult, setInventoryImportResult] = useState<PosInventoryImportCommitResult | null>(null);
  const [inventoryImportLoading, setInventoryImportLoading] = useState(false);
  const [inventoryImportSubmitting, setInventoryImportSubmitting] = useState(false);
  const [transferFilters, setTransferFilters] = useState({
    fromStoreId: "",
    toStoreId: "",
    status: "",
    folio: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 20,
  });
  const [transferRows, setTransferRows] = useState<PosTransferItem[]>([]);
  const [transferTotal, setTransferTotal] = useState(0);
  const [transferStores, setTransferStores] = useState<string[]>(storeOptions.map((item) => item.id));
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferDetail, setTransferDetail] = useState<PosTransferDetail | null>(null);
  const [transferCreateOpen, setTransferCreateOpen] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferActionSubmitting, setTransferActionSubmitting] = useState(false);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferSearchResults, setTransferSearchResults] = useState<PosProduct[]>([]);
  const [transferForm, setTransferForm] = useState({
    fromStoreId: storeSnapshot.storeContext.storeId,
    toStoreId: storeOptions.find((item) => item.id !== storeSnapshot.storeContext.storeId)?.id || "default",
    note: "",
    lines: [] as PosTransferCreateLineInput[],
  });
  const [salesFilters, setSalesFilters] = useState({
    storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
    dateFrom: "",
    dateTo: "",
    folio: "",
    customer: "",
    paymentMethod: "",
    status: "",
  });
  const [salesLoading, setSalesLoading] = useState(false);
  const [saleDetail, setSaleDetail] = useState<PosSaleListItem | null>(null);
  const [refundTarget, setRefundTarget] = useState<PosSaleListItem | null>(null);
  const [refundReasonDraft, setRefundReasonDraft] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [lastRefund, setLastRefund] = useState<PosRefundRecord | null>(null);
  const [auditFilters, setAuditFilters] = useState({
    storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
    actorUserId: "",
    actorRole: "",
    module: "",
    actionType: "",
    resultStatus: "",
    dateFrom: getDefaultDateRange().dateFrom,
    dateTo: getDefaultDateRange().dateTo,
    page: 1,
    limit: 20,
  });
  const [auditRows, setAuditRows] = useState<PosAuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);
  const [auditDetail, setAuditDetail] = useState<PosAuditLogDetail | null>(null);
  const [storeSettingsRows, setStoreSettingsRows] = useState<PosStoreSetting[]>([]);
  const [storeSettingsLoading, setStoreSettingsLoading] = useState(false);
  const [storeSettingsSaving, setStoreSettingsSaving] = useState(false);
  const [selectedStoreSettingId, setSelectedStoreSettingId] = useState(storeSnapshot.storeContext.storeId);
  const [storeSettingForm, setStoreSettingForm] = useState<PosStoreSetting>({
    id: "",
    storeId: storeSnapshot.storeContext.storeId,
    storeName: storeSnapshot.storeContext.storeName,
    companyFullName: "",
    storeCode: "",
    address: "",
    phone: "",
    rfc: "",
    active: true,
    defaultTicketHeader: storeSnapshot.storeContext.storeName,
    ticketSubtitle: "",
    cashierAutoCloseEnabled: false,
    cashierAutoCloseMinutes: 10,
    updatedAt: "",
  });
  const [ticketSettingRows, setTicketSettingRows] = useState<PosTicketSettingConfig[]>([]);
  const [ticketSettingsLoading, setTicketSettingsLoading] = useState(false);
  const [ticketSettingsSaving, setTicketSettingsSaving] = useState(false);
  const [selectedTicketStoreId, setSelectedTicketStoreId] = useState(storeSnapshot.storeContext.storeId);
  const [ticketSettingForm, setTicketSettingForm] = useState<PosTicketSettingConfig>({
    id: "",
    storeId: storeSnapshot.storeContext.storeId,
    ticketHeaderName: storeSnapshot.storeContext.storeName,
    ticketHeaderSubtitle: "",
    companyFullName: "",
    logoUrl: "",
    showLogo: false,
    address: "",
    phone: "",
    whatsapp: "",
    website: "",
    qrContent: "",
    rfc: "",
    showRfc: false,
    showTicketBarcode: false,
    showWhatsapp: false,
    showWebsite: false,
    showQr: false,
    showCashier: true,
    showCustomer: true,
    footerLine1: "",
    footerLine2: "",
    updatedAt: "",
  });
  const [cashierRows, setCashierRows] = useState<PosCashierItem[]>([]);
  const [cashiersLoading, setCashiersLoading] = useState(false);
  const [cashierSaving, setCashierSaving] = useState(false);
  const [cashierFilters, setCashierFilters] = useState({
    storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
    keyword: "",
    role: "",
    status: "",
  });
  const [cashierEditorOpen, setCashierEditorOpen] = useState(false);
  const [editingCashierId, setEditingCashierId] = useState<string | null>(null);
  const [cashierForm, setCashierForm] = useState<PosCashierUpsertInput>({
    account: "",
    name: "",
    phone: "",
    phoneCountry: "MX",
    email: "",
    password: "",
    storeId: storeSnapshot.storeContext.storeId,
    role: posAccess.role === "admin_general" ? "store_admin" : "cashier",
    active: true,
    permissionOverrides: [],
  });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [labelPrintState, setLabelPrintState] = useState<PosLabelPrintState>({
    open: false,
    source: "products",
    template: "product",
    size: "40x50",
    fields: LABEL_FIELD_DEFAULTS,
    items: [],
  });
  const [systemSettingsForm, setSystemSettingsForm] = useState({
    defaultLabelSize: "40x50" as PosLabelSize,
    defaultReportDays: 7,
    compactMode: true,
    showInventoryBadge: true,
    defaultPrintBarcode: true,
  });
  const workbenchStoreName = useMemo(
    () =>
      storeOptions.find((item) => item.id === workbenchSalesStoreId)?.name
      || (workbenchSalesStoreId === storeSnapshot.storeContext.storeId ? storeSnapshot.storeContext.storeName : workbenchSalesStoreId),
    [storeOptions, storeSnapshot.storeContext.storeId, storeSnapshot.storeContext.storeName, workbenchSalesStoreId],
  );
  const workbenchLowStockStoreName = useMemo(
    () =>
      storeOptions.find((item) => item.id === workbenchLowStockStoreId)?.name
      || (workbenchLowStockStoreId === storeSnapshot.storeContext.storeId ? storeSnapshot.storeContext.storeName : workbenchLowStockStoreId),
    [storeOptions, storeSnapshot.storeContext.storeId, storeSnapshot.storeContext.storeName, workbenchLowStockStoreId],
  );

  const selectedTicketStore = useMemo(
    () =>
      storeSettingsRows.find((item) => item.storeId === ticketSettingForm.storeId)
      || storeSettingsRows.find((item) => item.storeId === selectedTicketStoreId)
      || storeSettingsRows.find((item) => item.storeId === storeSnapshot.storeContext.storeId)
      || null,
    [selectedTicketStoreId, storeSettingsRows, storeSnapshot.storeContext.storeId, ticketSettingForm.storeId],
  );
  const activeCashierStoreSetting = useMemo(
    () =>
      storeSettingsRows.find((item) => item.storeId === storeSnapshot.storeContext.storeId)
      || (storeSettingForm.storeId === storeSnapshot.storeContext.storeId ? storeSettingForm : null)
      || null,
    [storeSettingForm, storeSettingsRows, storeSnapshot.storeContext.storeId],
  );
  const cashierAutoCloseMinutes = Math.max(1, Math.trunc(activeCashierStoreSetting?.cashierAutoCloseMinutes ?? 10));
  const cashierAutoCloseEnabled = activeTab === "cashier" && (activeCashierStoreSetting?.cashierAutoCloseEnabled ?? false);
  const activeCashierTicketSetting = useMemo(
    () => ticketSettingRows.find((item) => item.storeId === storeSnapshot.storeContext.storeId) || null,
    [storeSnapshot.storeContext.storeId, ticketSettingRows],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("pos-system-settings");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<typeof systemSettingsForm>;
      setSystemSettingsForm((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore invalid local draft
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("pos-system-settings", JSON.stringify(systemSettingsForm));
  }, [systemSettingsForm]);

  const ticketPreviewDraft = useMemo<PosTicketDto>(() => {
    const resolvedStoreName =
      ticketSettingForm.ticketHeaderName
      || selectedTicketStore?.defaultTicketHeader
      || selectedTicketStore?.storeName
      || ticketSettingForm.storeId
      || storeSnapshot.storeContext.storeName;
    const resolvedSubtitle = ticketSettingForm.ticketHeaderSubtitle || selectedTicketStore?.ticketSubtitle || "";
    const resolvedCompanyFullName = ticketSettingForm.companyFullName || selectedTicketStore?.companyFullName || "";
    const resolvedAddress = ticketSettingForm.address || selectedTicketStore?.address || "";
    const resolvedPhone = ticketSettingForm.phone || selectedTicketStore?.phone || "";
    const resolvedRfc = ticketSettingForm.rfc || selectedTicketStore?.rfc || "";

    return {
      saleId: "preview-sale",
      folio: "POS-VISTA-001",
      createdAt: new Date().toISOString(),
      storeName: resolvedStoreName,
      companyFullName: resolvedCompanyFullName,
      logoUrl: ticketSettingForm.logoUrl,
      showLogo: ticketSettingForm.showLogo && Boolean(ticketSettingForm.logoUrl),
      headerSubtitle: resolvedSubtitle,
      address: resolvedAddress,
      phone: resolvedPhone,
      whatsapp: ticketSettingForm.whatsapp,
      website: ticketSettingForm.website,
      qrContent: ticketSettingForm.qrContent,
      rfc: resolvedRfc,
      showRfc: ticketSettingForm.showRfc,
      ticketBarcodeValue: "7501234567890",
      showTicketBarcode: ticketSettingForm.showTicketBarcode,
      showWhatsapp: ticketSettingForm.showWhatsapp,
      showWebsite: ticketSettingForm.showWebsite,
      showQr: ticketSettingForm.showQr && Boolean(ticketSettingForm.qrContent),
      showCashier: ticketSettingForm.showCashier,
      showCustomer: ticketSettingForm.showCustomer,
      cashierName: storeSnapshot.cashierContext.cashierName || "CAJERO DEMO",
      customerName: "CLIENTE DEMO",
      paymentMethod: "cash",
      receivedAmount: 250,
      changeAmount: 11,
      subtotal: 224,
      discountTotal: 12,
      total: 212,
      lines: [
        {
          productName: lang === "zh" ? "展示商品 A" : "PROD. DEMO A",
          clave: "POS-001",
          barcode: "7501234567890",
          spec: lang === "zh" ? "标准款" : "STD",
          qty: 2,
          unitPrice: 60,
          discountType: "amount",
          discountValue: 8,
          subtotal: 112,
        },
        {
          productName: lang === "zh" ? "展示商品 B" : "PROD. DEMO B",
          clave: "POS-002",
          barcode: "7501234567891",
          spec: lang === "zh" ? "常规装" : "REG",
          qty: 1,
          unitPrice: 100,
          discountType: "percent",
          discountValue: 4,
          subtotal: 96,
        },
        {
          productName: lang === "zh" ? "展示商品 C" : "PROD. DEMO C",
          clave: "POS-003",
          barcode: "7501234567892",
          spec: lang === "zh" ? "促销包" : "PROMO",
          qty: 1,
          unitPrice: 12,
          discountType: null,
          discountValue: 0,
          subtotal: 12,
        },
      ],
      footerLine1: ticketSettingForm.footerLine1,
      footerLine2: ticketSettingForm.footerLine2,
    };
  }, [
    lang,
    selectedTicketStore,
    storeSnapshot.cashierContext.cashierName,
    storeSnapshot.storeContext.storeName,
    ticketSettingForm.address,
    ticketSettingForm.companyFullName,
    ticketSettingForm.footerLine1,
    ticketSettingForm.footerLine2,
    ticketSettingForm.phone,
    ticketSettingForm.qrContent,
    ticketSettingForm.rfc,
    ticketSettingForm.showCashier,
    ticketSettingForm.showCustomer,
    ticketSettingForm.showRfc,
    ticketSettingForm.showQr,
    ticketSettingForm.showWebsite,
    ticketSettingForm.showWhatsapp,
    ticketSettingForm.storeId,
    ticketSettingForm.ticketHeaderName,
    ticketSettingForm.ticketHeaderSubtitle,
    ticketSettingForm.website,
    ticketSettingForm.whatsapp,
  ]);

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.id === initialActiveTab)) {
      setActiveTab(initialActiveTab);
      return;
    }
    setActiveTab(visibleTabs[0]?.id || "workbench");
  }, [initialActiveTab, visibleTabs]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setCashierFullscreenActive(document.fullscreenElement === posFullscreenRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!cashierFullscreenFallback) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCashierFullscreenFallback(false);
      }
    };
    document.body.classList.add("overflow-hidden");
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [cashierFullscreenFallback]);

  useEffect(() => {
    if (activeTab === "cashier") return;
    if (document.fullscreenElement === posFullscreenRef.current) {
      void document.exitFullscreen().catch(() => undefined);
    }
    setCashierFullscreenFallback(false);
  }, [activeTab]);

  useEffect(() => {
    setCurrentCart(cart);
  }, [cart]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedViewMode = window.localStorage.getItem("pos.cashier.viewMode");
    const savedSyncYogoProducts = window.localStorage.getItem("pos.cashier.syncYogoProducts");
    if (savedViewMode === "layout1" || savedViewMode === "layout2") {
      setCashierViewMode(savedViewMode);
    }
    if (savedSyncYogoProducts === "1") {
      setCashierSyncYogoProducts(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("pos.cashier.viewMode", cashierViewMode);
  }, [cashierViewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("pos.cashier.syncYogoProducts", cashierSyncYogoProducts ? "1" : "0");
  }, [cashierSyncYogoProducts]);

  useEffect(() => {
    setCashierResults([]);
    setQuoteResults([]);
    setCashierProductPage(1);
  }, [cashierSyncYogoProducts, storeSnapshot.storeContext.storeId]);

  useEffect(() => {
    if (
      cashierViewMode === "layout2"
      || !cashierSyncYogoProducts
      || !cashierPrimaryCategory
    ) {
      setCashierCategoryProducts(null);
      return;
    }

    let mounted = true;
    setCashierProductPage(1);
    (async () => {
      try {
        const rows = await listPosProductsService(storeSnapshot.storeContext.storeId, {
          includeYogo: true,
          take: 5000,
          category: cashierPrimaryCategory,
        });
        if (!mounted) return;
        setCashierCategoryProducts(rows);
      } catch {
        if (!mounted) return;
        setCashierCategoryProducts([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [cashierPrimaryCategory, cashierSyncYogoProducts, cashierViewMode, storeSnapshot.storeContext.storeId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listPosPrimaryCategoriesService(storeSnapshot.storeContext.storeId, {
          includeYogo: cashierSyncYogoProducts,
        });
        if (!mounted) return;
        setCashierPrimaryCategoryOptions(
          rows
            .map((item) => (lang === "zh" ? item.categoryZh : item.categoryEs || item.categoryZh).trim())
            .filter((value, index, array) => isMeaningfulCategory(value) && array.indexOf(value) === index),
        );
      } catch {
        if (!mounted) return;
        setCashierPrimaryCategoryOptions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [cashierSyncYogoProducts, lang, storeSnapshot.storeContext.storeId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [productRows, suspendedRows, quoteRows, saleRows, summary, payments, tops, inventory, trend, monthlyTrend, storeSummary, storeWeeklyTrend, storeMonthlyTrend, workbenchLowStock, replenishment, inventoryList, movementList, transferList, auditList] = await Promise.all([
          listPosProductsService(storeSnapshot.storeContext.storeId, { includeYogo: cashierSyncYogoProducts, take: cashierSyncYogoProducts ? 1000 : 120 }),
          listPosSuspendedOrdersService(storeSnapshot.storeContext.storeId),
          listPosQuotesService(storeSnapshot.storeContext.storeId),
          listPosSalesService({ storeId: salesFilters.storeId || undefined }),
          getPosDashboardSummaryService(reportFilters),
          getPosPaymentsSummaryService(reportFilters),
          getPosTopProductsReportService({ ...reportFilters, limit: 10 }),
          getPosInventoryOverviewService({ storeId: reportFilters.storeId }),
          getPosSalesTrendService({ ...reportFilters, ...getCurrentWeekDateRange() }),
          getPosSalesTrendService({ ...reportFilters, ...getCurrentMonthDateRange() }),
          getPosDashboardSummaryService({ ...reportFilters, storeId: workbenchSalesStoreId }),
          getPosSalesTrendService({ ...reportFilters, storeId: workbenchSalesStoreId, ...getCurrentWeekDateRange() }),
          getPosSalesTrendService({ ...reportFilters, storeId: workbenchSalesStoreId, ...getCurrentMonthDateRange() }),
          getPosInventoryOverviewService({ storeId: workbenchLowStockStoreId }),
          listPosReplenishmentSuggestionsService(replenishmentFilters),
          listPosInventoryService(inventoryFilters),
          listPosInventoryMovementsService(inventoryMovementFilters),
          listPosTransfersService(transferFilters),
          listPosAuditLogsService(auditFilters),
        ]);
        if (!mounted) return;
        setProducts(productRows);
        setSuspendedOrders(suspendedRows);
        setQuotes(quoteRows);
        setSales(saleRows);
        setDashboardSummary(summary);
        setPaymentsSummary(payments);
        setTopProductsReport(tops);
        setInventoryOverview(inventory);
        setWorkbenchLowStockOverview(workbenchLowStock);
        setReplenishmentRows(replenishment.items);
        setReplenishmentTotal(replenishment.total);
        setReplenishmentStores(replenishment.stores.length ? replenishment.stores : storeOptions.map((item) => item.id));
        setInventoryRows(inventoryList.items);
        setInventoryTotal(inventoryList.total);
        setInventoryMovements(movementList.items);
        setInventoryMovementTotal(movementList.total);
        setTransferRows(transferList.items);
        setTransferTotal(transferList.total);
        setTransferStores(transferList.stores.length ? transferList.stores : storeOptions.map((item) => item.id));
        setAuditRows(auditList.items);
        setAuditTotal(auditList.total);
        setSalesTrend(trend);
        setMonthlySalesTrend(monthlyTrend);
        setWorkbenchStoreSummary(storeSummary);
        setWorkbenchStoreWeeklySalesTrend(storeWeeklyTrend);
        setWorkbenchStoreMonthlySalesTrend(storeMonthlyTrend);
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [auditFilters, cashierSyncYogoProducts, inventoryFilters, inventoryMovementFilters, replenishmentFilters, reportFilters, salesFilters.storeId, storeOptions, transferFilters, storeSnapshot.storeContext.storeId, workbenchLowStockStoreId, workbenchSalesStoreId]);

  useEffect(() => {
    if (activeTab === "store_settings") void loadStoreSettings();
    if (activeTab === "receipt_template") {
      void loadStoreSettings();
      void loadTicketSettings();
    }
    if (activeTab === "cashiers") void loadCashiers();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "cashier") return;
    if (storeSettingsRows.length > 0) return;
    void loadStoreSettings();
  }, [activeTab, storeSettingsRows.length]);

  useEffect(() => {
    if (!cashierAutoCloseEnabled) {
      setCashierClosed(false);
      return;
    }
    setCashierLastActiveAt(Date.now());
  }, [activeTab, cashierAutoCloseEnabled, storeSnapshot.storeContext.storeId]);

  useEffect(() => {
    if (!cashierAutoCloseEnabled || cashierClosed || activeTab !== "cashier") return;
    const markActivity = () => setCashierLastActiveAt(Date.now());
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "mousedown", "touchstart", "click", "focusin", "input", "change"];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, markActivity, true);
    }
    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, markActivity, true);
      }
    };
  }, [activeTab, cashierAutoCloseEnabled, cashierClosed]);

  useEffect(() => {
    if (!cashierAutoCloseEnabled || cashierClosed) return;
    const timer = window.setInterval(() => {
      if (Date.now() - cashierLastActiveAt >= cashierAutoCloseMinutes * 60 * 1000) {
        setCashierClosed(true);
        setCashierUnlockModalOpen(false);
        setCashierUnlockPasswordDraft("");
        setCashierUnlockError("");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cashierAutoCloseEnabled, cashierAutoCloseMinutes, cashierClosed, cashierLastActiveAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setCashierClockNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadSales(query?: Partial<typeof salesFilters>) {
    try {
      setSalesLoading(true);
      const items = await listPosSalesService({
        ...salesFilters,
        ...query,
        storeId: query?.storeId ?? (salesFilters.storeId || undefined),
      });
      setSales(items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSalesLoading(false);
    }
  }

  async function loadReportData(query?: Partial<typeof reportFilters>) {
    const nextQuery = {
      ...reportFilters,
      ...query,
    };
    try {
      setReportsLoading(true);
      const [summary, payments, tops, inventory, trend, monthlyTrend, storeSummary, storeWeeklyTrend, storeMonthlyTrend] = await Promise.all([
        getPosDashboardSummaryService(nextQuery),
        getPosPaymentsSummaryService(nextQuery),
        getPosTopProductsReportService({ ...nextQuery, limit: 10 }),
        getPosInventoryOverviewService({ storeId: nextQuery.storeId }),
        getPosSalesTrendService({ ...nextQuery, ...getCurrentWeekDateRange() }),
        getPosSalesTrendService({ ...nextQuery, ...getCurrentMonthDateRange() }),
        getPosDashboardSummaryService({ ...nextQuery, storeId: workbenchSalesStoreId }),
        getPosSalesTrendService({ ...nextQuery, storeId: workbenchSalesStoreId, ...getCurrentWeekDateRange() }),
        getPosSalesTrendService({ ...nextQuery, storeId: workbenchSalesStoreId, ...getCurrentMonthDateRange() }),
      ]);
      setDashboardSummary(summary);
      setPaymentsSummary(payments);
      setTopProductsReport(tops);
      setInventoryOverview(inventory);
      setSalesTrend(trend);
      setMonthlySalesTrend(monthlyTrend);
      setWorkbenchStoreSummary(storeSummary);
      setWorkbenchStoreWeeklySalesTrend(storeWeeklyTrend);
      setWorkbenchStoreMonthlySalesTrend(storeMonthlyTrend);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setReportsLoading(false);
    }
  }

  async function loadReplenishment(query?: Partial<typeof replenishmentFilters>) {
    const nextQuery = {
      ...replenishmentFilters,
      ...query,
    };
    try {
      setReplenishmentLoading(true);
      const result = await listPosReplenishmentSuggestionsService(nextQuery);
      setReplenishmentRows(result.items);
      setReplenishmentTotal(result.total);
      setReplenishmentStores(result.stores.length ? result.stores : storeOptions.map((item) => item.id));
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_REPLENISHMENT_FAILED"));
    } finally {
      setReplenishmentLoading(false);
    }
  }

  async function loadInventory(query?: Partial<typeof inventoryFilters>) {
    const nextQuery = {
      ...inventoryFilters,
      ...query,
    };
    try {
      setInventoryLoading(true);
      const result = await listPosInventoryService(nextQuery);
      setInventoryRows(result.items);
      setInventoryTotal(result.total);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadInventoryMovements(query?: Partial<typeof inventoryMovementFilters>) {
    const nextQuery = {
      ...inventoryMovementFilters,
      ...query,
    };
    try {
      setInventoryMovementLoading(true);
      const result = await listPosInventoryMovementsService(nextQuery);
      setInventoryMovements(result.items);
      setInventoryMovementTotal(result.total);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setInventoryMovementLoading(false);
    }
  }

  async function loadTransfers(query?: Partial<typeof transferFilters>) {
    const nextQuery = {
      ...transferFilters,
      ...query,
    };
    try {
      setTransferLoading(true);
      const result = await listPosTransfersService(nextQuery);
      setTransferRows(result.items);
      setTransferTotal(result.total);
      setTransferStores(result.stores.length ? result.stores : storeOptions.map((item) => item.id));
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setTransferLoading(false);
    }
  }

  async function loadAuditLogs(query?: Partial<typeof auditFilters>) {
    const nextQuery = {
      ...auditFilters,
      ...query,
    };
    try {
      setAuditLoading(true);
      const result = await listPosAuditLogsService(nextQuery);
      setAuditRows(result.items);
      setAuditTotal(result.total);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_AUDIT_LOG_LOAD_FAILED"));
    } finally {
      setAuditLoading(false);
    }
  }

  async function openAuditDetail(id: string) {
    try {
      const item = await getPosAuditLogDetailService(id);
      setAuditDetail(item);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_AUDIT_LOG_NOT_FOUND"));
    }
  }

  async function handleAuditExport() {
    try {
      setAuditExporting(true);
      await exportPosAuditLogsService(auditFilters, lang);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_EXPORT_FAILED"));
    } finally {
      setAuditExporting(false);
    }
  }

  async function loadStoreSettings() {
    try {
      setStoreSettingsLoading(true);
      const items = await listPosStoresService();
      setStoreSettingsRows(items);
      const selected = items.find((item) => item.storeId === selectedStoreSettingId) || items[0];
      if (selected) {
        setSelectedStoreSettingId(selected.storeId);
        setStoreSettingForm(selected);
      }
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_STORE_LOAD_FAILED"));
    } finally {
      setStoreSettingsLoading(false);
    }
  }

  async function loadTicketSettings() {
    try {
      setTicketSettingsLoading(true);
      const items = await listPosTicketSettingsService();
      setTicketSettingRows(items);
      const selected = items.find((item) => item.storeId === selectedTicketStoreId) || items[0];
      if (selected) {
        setSelectedTicketStoreId(selected.storeId);
        setTicketSettingForm(selected);
      }
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_TICKET_SETTING_LOAD_FAILED"));
    } finally {
      setTicketSettingsLoading(false);
    }
  }

  async function loadCashiers(query?: Partial<typeof cashierFilters>) {
    const nextQuery = {
      ...cashierFilters,
      ...query,
    };
    try {
      setCashiersLoading(true);
      const items = await listPosCashiersService(nextQuery);
      setCashierRows(items);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_CASHIER_LOAD_FAILED"));
    } finally {
      setCashiersLoading(false);
    }
  }

  async function submitStoreSetting() {
    try {
      setStoreSettingsSaving(true);
      const item = await savePosStoreService(storeSettingForm.storeId, {
        storeName: storeSettingForm.storeName,
        storeCode: storeSettingForm.storeCode,
        address: storeSettingForm.address,
        phone: storeSettingForm.phone,
        rfc: storeSettingForm.rfc,
        active: storeSettingForm.active,
        defaultTicketHeader: storeSettingForm.defaultTicketHeader,
        ticketSubtitle: storeSettingForm.ticketSubtitle,
        cashierAutoCloseEnabled: storeSettingForm.cashierAutoCloseEnabled,
        cashierAutoCloseMinutes: storeSettingForm.cashierAutoCloseMinutes,
      });
      setStoreSettingForm(item);
      await loadStoreSettings();
      setNoticeMessage(t(lang, "pos.notice.save_ok"));
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_STORE_SAVE_FAILED"));
    } finally {
      setStoreSettingsSaving(false);
    }
  }

  async function submitTicketSetting() {
    try {
      setTicketSettingsSaving(true);
      const item = await savePosTicketSettingService(ticketSettingForm.storeId, {
        ticketHeaderName: ticketSettingForm.ticketHeaderName,
        ticketHeaderSubtitle: ticketSettingForm.ticketHeaderSubtitle,
        companyFullName: ticketSettingForm.companyFullName,
        logoUrl: ticketSettingForm.logoUrl,
        showLogo: ticketSettingForm.showLogo,
        address: ticketSettingForm.address,
        phone: ticketSettingForm.phone,
        whatsapp: ticketSettingForm.whatsapp,
        website: ticketSettingForm.website,
        qrContent: ticketSettingForm.qrContent,
        rfc: ticketSettingForm.rfc,
        showRfc: ticketSettingForm.showRfc,
        showTicketBarcode: ticketSettingForm.showTicketBarcode,
        showWhatsapp: ticketSettingForm.showWhatsapp,
        showWebsite: ticketSettingForm.showWebsite,
        showQr: ticketSettingForm.showQr,
        showCashier: ticketSettingForm.showCashier,
        showCustomer: ticketSettingForm.showCustomer,
        footerLine1: ticketSettingForm.footerLine1,
        footerLine2: ticketSettingForm.footerLine2,
      });
      setTicketSettingForm(item);
      await loadTicketSettings();
      setNoticeMessage(t(lang, "pos.notice.save_ok"));
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_TICKET_SETTING_SAVE_FAILED"));
    } finally {
      setTicketSettingsSaving(false);
    }
  }

  async function handleTicketLogoUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setTicketSettingForm((prev) => ({
        ...prev,
        logoUrl: typeof reader.result === "string" ? reader.result : "",
        showLogo: true,
      }));
    };
    reader.readAsDataURL(file);
  }

  function renderSystemSettings() {
    return (
      <div className="grid gap-3 xl:grid-cols-[0.92fr_1.08fr]">
        <PosSectionCard title={t(lang, "pos.section.system_preferences")} description={t(lang, "pos.page.system_settings.subtitle")}>
          <div className="grid gap-2.5 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">{t(lang, "pos.field.default_label_size")}</span>
              <select
                value={systemSettingsForm.defaultLabelSize}
                onChange={(event) => setSystemSettingsForm((prev) => ({ ...prev, defaultLabelSize: event.target.value as PosLabelSize }))}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary"
              >
                <option value="40x50">{t(lang, "pos.field.label_size_product")}</option>
                <option value="80x50">{t(lang, "pos.field.label_size_shelf")}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">{t(lang, "pos.field.default_report_days")}</span>
              <input
                type="number"
                min={1}
                max={90}
                value={systemSettingsForm.defaultReportDays}
                onChange={(event) => setSystemSettingsForm((prev) => ({ ...prev, defaultReportDays: Math.max(1, Number(event.target.value || 7)) }))}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary"
              />
            </label>
            <label className="inline-flex h-9 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={systemSettingsForm.compactMode}
                onChange={(event) => setSystemSettingsForm((prev) => ({ ...prev, compactMode: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              {t(lang, "pos.field.compact_mode")}
            </label>
            <label className="inline-flex h-9 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={systemSettingsForm.showInventoryBadge}
                onChange={(event) => setSystemSettingsForm((prev) => ({ ...prev, showInventoryBadge: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              {t(lang, "pos.field.show_inventory_badge")}
            </label>
            <label className="inline-flex h-9 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={systemSettingsForm.defaultPrintBarcode}
                onChange={(event) => setSystemSettingsForm((prev) => ({ ...prev, defaultPrintBarcode: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              {t(lang, "pos.field.default_print_barcode")}
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={saveSystemSettings} className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-white">
              {t(lang, "common.save")}
            </button>
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.section.future_tools")} description={t(lang, "pos.page.system_settings.future")}>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              t(lang, "pos.field.default_label_size"),
              t(lang, "pos.field.default_report_days"),
              t(lang, "pos.field.compact_mode"),
              t(lang, "pos.field.show_inventory_badge"),
              t(lang, "pos.field.default_print_barcode"),
            ].map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-700">{item}</div>
                <div className="mt-1 text-[11px] text-slate-500">{t(lang, "pos.page.system_settings.future")}</div>
              </div>
            ))}
          </div>
        </PosSectionCard>
      </div>
    );
  }

  function saveSystemSettings() {
    setNoticeMessage(t(lang, "pos.notice.save_ok"));
  }

  function resetCashierForm() {
    setEditingCashierId(null);
    setCashierForm({
      account: "",
      name: "",
      phone: "",
      phoneCountry: "MX",
      email: "",
      password: "",
      storeId: posAccess.allowAllStores ? (cashierFilters.storeId || storeSnapshot.storeContext.storeId) : storeSnapshot.storeContext.storeId,
      role: posAccess.role === "admin_general" ? "store_admin" : "cashier",
      active: true,
      permissionOverrides: [],
    });
  }

  async function openCashierEditor(item?: PosCashierItem) {
    if (!item) {
      resetCashierForm();
      setCashierEditorOpen(true);
      return;
    }
    try {
      const detail = await getPosCashierService(item.id);
      setEditingCashierId(detail.id);
      setCashierForm({
        account: detail.account,
        name: detail.name,
        phone: detail.phone,
        phoneCountry: detail.phoneCountry || "MX",
        email: detail.email || "",
        password: "",
        storeId: detail.storeId,
        role: detail.role,
        active: detail.active,
        permissionOverrides: [
          ...(detail.permissions.grants || []).map((permissionKey) => ({ permissionKey, effect: "grant" as const })),
          ...(detail.permissions.denies || []).map((permissionKey) => ({ permissionKey, effect: "deny" as const })),
        ],
      });
      setCashierEditorOpen(true);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_CASHIER_LOAD_FAILED"));
    }
  }

  function getCashierPermissionEffect(permissionKey: string): "inherit" | "grant" | "deny" {
    const found = cashierForm.permissionOverrides?.find((item) => item.permissionKey === permissionKey);
    if (!found) return "inherit";
    return found.effect === "deny" ? "deny" : "grant";
  }

  function setCashierPermissionEffect(permissionKey: string, effect: "inherit" | "grant" | "deny") {
    setCashierForm((prev) => {
      const next = (prev.permissionOverrides || []).filter((item) => item.permissionKey !== permissionKey);
      if (effect === "inherit") {
        return { ...prev, permissionOverrides: next };
      }
      return {
        ...prev,
        permissionOverrides: [...next, { permissionKey, effect }],
      };
    });
  }

  async function submitCashier() {
    try {
      setCashierSaving(true);
      if (editingCashierId) {
        await updatePosCashierService(editingCashierId, cashierForm);
      } else {
        await createPosCashierService(cashierForm);
      }
      setCashierEditorOpen(false);
      resetCashierForm();
      await loadCashiers();
      setNoticeMessage(t(lang, "pos.notice.save_ok"));
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_CASHIER_SAVE_FAILED"));
    } finally {
      setCashierSaving(false);
    }
  }

  async function toggleCashierStatus(item: PosCashierItem) {
    try {
      await updatePosCashierStatusService(item.id, !item.active);
      await loadCashiers();
      setNoticeMessage(t(lang, "pos.notice.save_ok"));
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_CASHIER_SAVE_FAILED"));
    }
  }

  async function handleExportSales() {
    try {
      await exportPosSalesService({
        ...salesFilters,
        storeId: salesFilters.storeId || undefined,
      }, lang);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_EXPORT_FAILED"));
    }
  }

  async function handleExportInventory() {
    try {
      await exportPosInventoryService(inventoryFilters, lang);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_EXPORT_FAILED"));
    }
  }

  async function handleExportInventoryMovements() {
    try {
      await exportPosInventoryMovementsService(inventoryMovementFilters, lang);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_EXPORT_FAILED"));
    }
  }

  async function handleExportFinanceReport() {
    try {
      await exportPosFinanceReportService(reportFilters, lang);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_EXPORT_FAILED"));
    }
  }

  async function handleExportInventoryReport() {
    try {
      await exportPosInventoryReportService({ ...reportFilters, limit: 20 }, lang);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_EXPORT_FAILED"));
    }
  }

  async function handleExportReplenishment() {
    try {
      await exportPosReplenishmentService(replenishmentFilters, lang);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "POS_EXPORT_FAILED"));
    }
  }

  function renderAuditLogs() {
    return (
      <div className="space-y-3">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.audit_logs.subtitle")}>
          <div className="grid gap-2 lg:grid-cols-3 xl:grid-cols-8">
            {posAccess.allowAllStores ? (
              <select
                value={auditFilters.storeId}
                onChange={(event) => setAuditFilters((prev) => ({ ...prev, storeId: event.target.value, page: 1 }))}
                className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary"
              >
                <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option>
                {storeOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            ) : null}
            <input value={auditFilters.dateFrom} onChange={(event) => setAuditFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))} type="date" className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary" />
            <input value={auditFilters.dateTo} onChange={(event) => setAuditFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))} type="date" className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary" />
            <input value={auditFilters.actorUserId} onChange={(event) => setAuditFilters((prev) => ({ ...prev, actorUserId: event.target.value, page: 1 }))} placeholder={t(lang, "pos.field.user")} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary" />
            <select value={auditFilters.actorRole} onChange={(event) => setAuditFilters((prev) => ({ ...prev, actorRole: event.target.value, page: 1 }))} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary">
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.role")}</option>
              <option value="admin_general">{t(lang, "pos.role.admin_general")}</option>
              <option value="store_admin">{t(lang, "pos.role.store_admin")}</option>
              <option value="cashier">{t(lang, "pos.role.cashier")}</option>
            </select>
            <input value={auditFilters.module} onChange={(event) => setAuditFilters((prev) => ({ ...prev, module: event.target.value, page: 1 }))} placeholder={t(lang, "pos.field.module")} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary" />
            <input value={auditFilters.actionType} onChange={(event) => setAuditFilters((prev) => ({ ...prev, actionType: event.target.value, page: 1 }))} placeholder={t(lang, "pos.field.action")} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary" />
            <select value={auditFilters.resultStatus} onChange={(event) => setAuditFilters((prev) => ({ ...prev, resultStatus: event.target.value, page: 1 }))} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary">
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.result")}</option>
              <option value="success">{t(lang, "pos.status.audit_success")}</option>
              <option value="failed">{t(lang, "pos.status.audit_failed")}</option>
              <option value="denied">{t(lang, "pos.status.audit_denied")}</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadAuditLogs()} disabled={auditLoading} className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {auditLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
            <button
              type="button"
              onClick={() => void handleAuditExport()}
              disabled={auditExporting}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {auditExporting ? t(lang, "common.loading") : t(lang, "pos.button.export_current")}
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = {
                  storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
                  actorUserId: "",
                  actorRole: "",
                  module: "",
                  actionType: "",
                  resultStatus: "",
                  dateFrom: "",
                  dateTo: "",
                  page: 1,
                  limit: auditFilters.limit,
                };
                setAuditFilters(cleared);
                void loadAuditLogs(cleared);
              }}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700"
            >
              {t(lang, "common.reset")}
            </button>
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.page.audit_logs.title")} description={t(lang, "pos.page.audit_logs.subtitle")}>
          {auditRows.length === 0 ? (
            <PosEmptyState
              title={t(lang, "pos.empty.title")}
              description={t(lang, "pos.empty.description")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    {[t(lang, "pos.field.datetime"), t(lang, "pos.field.action"), t(lang, "pos.field.module"), t(lang, "pos.field.user"), t(lang, "pos.field.role"), t(lang, "pos.field.store"), t(lang, "pos.field.target"), t(lang, "pos.field.folio"), t(lang, "pos.field.result"), t(lang, "pos.field.summary"), t(lang, "pos.field.actions")].map((header) => (
                      <th key={header} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{formatDateTime(lang, item.createdAt)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{auditActionLabel(lang, item.actionType)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{auditModuleLabel(lang, item.module)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{item.actorName}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{posRoleLabel(lang, item.actorRole)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{auditFieldValue(item.storeId)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{auditTargetLabel(lang, item.targetType)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{auditFieldValue(item.targetFolio)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{auditResultLabel(lang, item.resultStatus)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-700">{item.summary}</td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => void openAuditDetail(item.id)} className="inline-flex h-6 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700">
                          {t(lang, "pos.button.view_detail")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">{t(lang, "common.total")}：{auditTotal}</div>
            </div>
          )}
        </PosSectionCard>
      </div>
    );
  }

  async function handleInventoryImportFile(file: File) {
    try {
      const rows = await parsePosInventoryImportFile(file);
      setInventoryImportRows(rows);
      setInventoryImportFileName(file.name);
      setInventoryImportPreview(null);
      setInventoryImportResult(null);
    } catch (error) {
      setInventoryImportRows([]);
      setInventoryImportFileName("");
      setInventoryImportPreview(null);
      setInventoryImportResult(null);
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    }
  }

  async function handleInventoryImportPreview() {
    if (!inventoryImportRows.length) {
      setErrorMessage(t(lang, "pos.notice.import_empty_file"));
      return;
    }
    try {
      setInventoryImportLoading(true);
      const result = await previewPosInventoryImportService(inventoryImportRows);
      setInventoryImportPreview(result);
      setInventoryImportResult(null);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setInventoryImportLoading(false);
    }
  }

  async function handleInventoryImportCommit() {
    if (!inventoryImportPreview?.items?.length) {
      setErrorMessage(t(lang, "pos.notice.import_preview_invalid"));
      return;
    }
    if (inventoryImportPreview.invalidCount > 0 || inventoryImportPreview.importableCount === 0) {
      setErrorMessage(t(lang, "pos.notice.import_preview_invalid"));
      return;
    }
    try {
      setInventoryImportSubmitting(true);
      const result = await commitPosInventoryImportService(inventoryImportRows, storeSnapshot.cashierContext.cashierName);
      setInventoryImportResult(result);
      await Promise.all([
        loadInventory(),
        loadInventoryMovements({ moveType: "import", page: 1 }),
        loadReplenishment(),
        loadReportData(),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const payload = (error as Error & { payload?: { preview?: PosInventoryImportPreviewResult } }).payload;
      if (payload?.preview) {
        setInventoryImportPreview(payload.preview);
      }
      setErrorMessage(posErrorLabel(lang, message));
    } finally {
      setInventoryImportSubmitting(false);
    }
  }

  const currentTab = visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0] || POS_TABS[0];
  const cashierFullscreenEnabled = activeTab === "cashier" && (cashierFullscreenActive || cashierFullscreenFallback);
  const cashierLayout2Active = cashierViewMode === "layout2";
  const activeMainNav = useMemo<PosMainNavId>(() => {
    const found = POS_MAIN_NAV.find((section) => POS_MAIN_NAV_TABS[section.id].includes(currentTab.id));
    return found?.id || "workbench";
  }, [currentTab.id]);
  const visibleSecondaryTabs = useMemo(
    () => POS_MAIN_NAV_TABS[activeMainNav].map((id) => visibleTabs.find((tab) => tab.id === id)).filter(Boolean) as PosTabConfig[],
    [activeMainNav, visibleTabs],
  );
  const cashierPrimaryCategories = useMemo(() => {
    const loadedCategories = Array.from(
      new Set(products.map((item) => item.category?.trim()).filter((value) => isMeaningfulCategory(value)) as string[]),
    );
    if (!cashierPrimaryCategoryOptions.length) {
      return loadedCategories;
    }
    const categories = [...cashierPrimaryCategoryOptions];
    for (const category of loadedCategories) {
      if (!categories.includes(category)) categories.push(category);
    }
    return categories;
  }, [cashierPrimaryCategoryOptions, products]);
  const visibleCashierPrimaryCategories = cashierPrimaryCategories;
  const extraCashierPrimaryCategories = cashierPrimaryCategories.slice(6);
  const cashierCategoryPageSize = 15;
  const cashierCategoryTotalPages = Math.max(1, Math.ceil(extraCashierPrimaryCategories.length / cashierCategoryPageSize));
  const cashierCategoryCurrentPage = Math.min(cashierCategoryPage, cashierCategoryTotalPages);
  const cashierCategoryPagedItems = extraCashierPrimaryCategories.slice(
    (cashierCategoryCurrentPage - 1) * cashierCategoryPageSize,
    cashierCategoryCurrentPage * cashierCategoryPageSize,
  );
  const cashierSecondaryCategories = useMemo(() => {
    const source = products.filter((item) => {
      if (!cashierPrimaryCategory) return true;
      return item.category === cashierPrimaryCategory;
    });
    return Array.from(new Set(source.map((item) => item.subcategory?.trim()).filter((value) => isMeaningfulCategory(value)) as string[]));
  }, [cashierPrimaryCategory, products]);
  const cashierCatalogProducts = useMemo(
    () => products.filter((item) => {
      const matchesPrimary = !cashierPrimaryCategory || item.category === cashierPrimaryCategory;
      const matchesSecondary = !cashierSecondaryCategory || item.subcategory === cashierSecondaryCategory;
      return matchesPrimary && matchesSecondary;
    }),
    [cashierPrimaryCategory, cashierSecondaryCategory, products],
  );
  const selectedProductRows = useMemo(
    () => products.filter((item) => selectedProductIds.includes(item.id)),
    [products, selectedProductIds],
  );
  const selectedInventoryRows = useMemo(
    () => inventoryRows.filter((item) => selectedInventoryIds.includes(item.id)),
    [inventoryRows, selectedInventoryIds],
  );

  const suspendedFiltered = suspendedOrders;

  const selectedSuspendedOrder = useMemo(
    () => suspendedFiltered.find((item) => item.id === selectedSuspendedOrderId)
      || suspendedOrders.find((item) => item.id === selectedSuspendedOrderId)
      || null,
    [selectedSuspendedOrderId, suspendedFiltered, suspendedOrders],
  );

  const quotesFiltered = useMemo(() => {
    const keyword = quoteKeyword.trim().toLowerCase();
    if (!keyword) return quotes;
    return quotes.filter((item) =>
      item.folio.toLowerCase().includes(keyword)
      || item.customer.name.toLowerCase().includes(keyword)
      || item.note.toLowerCase().includes(keyword),
    );
  }, [quoteKeyword, quotes]);

  useEffect(() => {
    if (!cashierPrimaryCategory && cashierPrimaryCategories.length) {
      setCashierPrimaryCategory(cashierPrimaryCategories[0]);
      return;
    }
    if (cashierPrimaryCategory && !cashierPrimaryCategories.includes(cashierPrimaryCategory)) {
      setCashierPrimaryCategory(cashierPrimaryCategories[0] || "");
    }
  }, [cashierPrimaryCategory, cashierPrimaryCategories]);

  useEffect(() => {
    if (cashierSecondaryCategory && !cashierSecondaryCategories.includes(cashierSecondaryCategory)) {
      setCashierSecondaryCategory("");
    }
  }, [cashierSecondaryCategories, cashierSecondaryCategory]);

  useEffect(() => {
    setCashierProductPage(1);
  }, [cashierPrimaryCategory, cashierSecondaryCategory, cashierSearch.barcode, cashierSearch.query, cashierResults]);

  useEffect(() => {
    setCashierCategoryPage(1);
  }, [extraCashierPrimaryCategories.length]);

  useEffect(() => {
    if (suspendedFiltered.length === 0) {
      setSelectedSuspendedOrderId(null);
      return;
    }
    if (!selectedSuspendedOrderId || !suspendedFiltered.some((item) => item.id === selectedSuspendedOrderId)) {
      setSelectedSuspendedOrderId(suspendedFiltered[0]?.id || null);
    }
  }, [selectedSuspendedOrderId, suspendedFiltered]);

  useEffect(() => {
    if (activeTab !== "cashier" || cashierClosed || cashierUnlockModalOpen || cashierCategoryModalOpen || selectedProductsModal || cashierCustomerModalOpen || openingCashModalOpen || cashDrawerModalOpen || suspendModalOpen || Boolean(discountTarget) || Boolean(errorMessage) || Boolean(noticeMessage) || Boolean(resumeTarget)) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        if (active === cashierBarcodeInputRef.current) return;
        if (active.closest("[data-cashier-focus-unlocked='true']")) return;
        const tagName = active.tagName;
        if (active.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
      }
      cashierBarcodeInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeTab, cashDrawerModalOpen, cashierCategoryModalOpen, cashierClosed, cashierCustomerModalOpen, cashierUnlockModalOpen, discountTarget, errorMessage, noticeMessage, openingCashModalOpen, resumeTarget, selectedProductsModal, suspendModalOpen]);

  useEffect(() => {
    if (activeTab !== "cashier" || cashierClosed || cashierUnlockModalOpen || cashierCategoryModalOpen || selectedProductsModal || cashierCustomerModalOpen || openingCashModalOpen || cashDrawerModalOpen || suspendModalOpen || Boolean(discountTarget) || Boolean(errorMessage) || Boolean(noticeMessage) || Boolean(resumeTarget)) return;

    const handleGlobalCashierTyping = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const active = document.activeElement;
      const isBarcodeFocused = active === cashierBarcodeInputRef.current;
      if (active instanceof HTMLElement) {
        const tagName = active.tagName;
        if (active.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
          if (!isBarcodeFocused) return;
        }
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setCashierSearch((prev) => ({ ...prev, barcode: prev.barcode.slice(0, -1) }));
        setCashierResults([]);
        cashierBarcodeInputRef.current?.focus();
        return;
      }
      const key = resolveBarcodeKey(event);
      if (!key) return;
      event.preventDefault();
      barcodeKeyHandledRef.current = { key, code: event.code || "", at: Date.now() };
      setCashierSearch((prev) => ({ ...prev, barcode: `${prev.barcode}${key}` }));
      setCashierResults([]);
      cashierBarcodeInputRef.current?.focus();
    };

    const handleGlobalCashierTypingOnKeyup = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Backspace" || event.key === "Delete" || event.key === "Enter") return;
      const active = document.activeElement;
      const isBarcodeFocused = active === cashierBarcodeInputRef.current;
      if (active instanceof HTMLElement) {
        const tagName = active.tagName;
        if (active.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
          if (!isBarcodeFocused) return;
        }
      }
      const key = resolveBarcodeKey(event);
      if (!key) return;
      const handled = barcodeKeyHandledRef.current;
      if (handled && handled.key === key && handled.code === (event.code || "") && Date.now() - handled.at < 300) return;
      barcodeKeyHandledRef.current = { key, code: event.code || "", at: Date.now() };
      setCashierSearch((prev) => ({ ...prev, barcode: `${prev.barcode}${key}` }));
      setCashierResults([]);
      cashierBarcodeInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleGlobalCashierTyping, true);
    window.addEventListener("keyup", handleGlobalCashierTypingOnKeyup, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalCashierTyping, true);
      window.removeEventListener("keyup", handleGlobalCashierTypingOnKeyup, true);
    };
  }, [activeTab, cashDrawerModalOpen, cashierCategoryModalOpen, cashierClosed, cashierCustomerModalOpen, cashierUnlockModalOpen, discountTarget, errorMessage, noticeMessage, openingCashModalOpen, resumeTarget, selectedProductsModal, suspendModalOpen]);

  function refocusCashierBarcodeUnlessUnlocked() {
    window.setTimeout(() => {
      if (cashierClosed || cashierUnlockModalOpen || cashierCustomerModalOpen || openingCashModalOpen || cashDrawerModalOpen || suspendModalOpen || Boolean(discountTarget) || Boolean(errorMessage) || Boolean(noticeMessage) || Boolean(resumeTarget) || cashierCategoryModalOpen) {
        return;
      }
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) {
        cashierBarcodeInputRef.current?.focus();
        return;
      }
      if (active.closest("[data-cashier-focus-unlocked='true']")) return;
      const tagName = active.tagName;
      if (active.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
      cashierBarcodeInputRef.current?.focus();
    }, 0);
  }

  function resolveBarcodeKey(event: { key: string; code: string }): string | null {
    const key = event.key;
    if (typeof key === "string" && key.length === 1 && key !== " ") return key;
    const code = "code" in event ? event.code : "";
    const digitMatch = code.match(/^Digit([0-9])$/);
    if (digitMatch) return digitMatch[1];
    const numpadMatch = code.match(/^Numpad([0-9])$/);
    if (numpadMatch) return numpadMatch[1];
    if (code === "NumpadDecimal") return ".";
    const legacy = event as unknown as { which?: number; keyCode?: number };
    const keyCode = Number(legacy.which ?? legacy.keyCode ?? 0);
    if (keyCode >= 48 && keyCode <= 57) return String(keyCode - 48);
    if (keyCode >= 96 && keyCode <= 105) return String(keyCode - 96);
    if (keyCode === 110 || keyCode === 190) return ".";
    return null;
  }

  function switchTab(tab: PosTabId) {
    setActiveTab(tab);
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  }

  function switchMainNav(section: PosMainNavId) {
    const target = POS_MAIN_NAV_TABS[section].find((id) => visibleTabs.some((tab) => tab.id === id));
    if (target) switchTab(target);
  }

  async function toggleCashierFullscreen() {
    if (activeTab !== "cashier") return;
    setCashierFullscreenFallback((enabled) => !enabled);
  }

  function openRefundListFromCashier() {
    setSalesFilters((prev) => ({
      ...prev,
      storeId: posAccess.allowAllStores ? prev.storeId : storeSnapshot.storeContext.storeId,
      status: "completed",
    }));
    switchTab("sales_docs");
    void loadSales({
      ...salesFilters,
      storeId: posAccess.allowAllStores ? salesFilters.storeId : storeSnapshot.storeContext.storeId,
      status: "completed",
    });
  }

  function toggleSelection(type: "products" | "inventory", value: string) {
    if (type === "products") {
      setSelectedProductIds((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
      return;
    }
    setSelectedInventoryIds((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  }

  function buildLabelItemsFromProducts(items: PosProduct[]): PosLabelItem[] {
    return items.map((item) => ({
      productId: item.id,
      storeId: storeSnapshot.storeContext.storeId,
      storeName: storeSnapshot.storeContext.storeName,
      clave: item.clave,
      barcode: item.barcode,
      nameCn: item.nameCn,
      nameEs: item.nameEs,
      price: item.price,
      imageUrl: item.imageUrl || "",
      origin: item.origin || "",
      importer: item.importer || "",
      shortDescription: item.shortDescription || "",
      copies: 1,
    }));
  }

  function buildLabelItemsFromInventory(items: PosInventoryItem[]): PosLabelItem[] {
    return items.map((item) => ({
      productId: item.productId,
      storeId: item.storeId,
      storeName: storeOptions.find((option) => option.id === item.storeId)?.name || item.storeId,
      clave: item.clave,
      barcode: item.barcode || "",
      nameCn: item.productName,
      nameEs: item.productName,
      price: products.find((product) => product.id === item.productId || product.clave === item.clave)?.price || 0,
      imageUrl: products.find((product) => product.id === item.productId || product.clave === item.clave)?.imageUrl || "",
      origin: products.find((product) => product.id === item.productId || product.clave === item.clave)?.origin || "",
      importer: products.find((product) => product.id === item.productId || product.clave === item.clave)?.importer || "",
      shortDescription: products.find((product) => product.id === item.productId || product.clave === item.clave)?.shortDescription || item.spec || "",
      copies: 1,
    }));
  }

  function openLabelPrint(source: "products" | "inventory", items: PosLabelItem[]) {
    if (!canLabelPrint) {
      setErrorMessage(t(lang, "pos.notice.permission_denied"));
      return;
    }
    if (!items.length) {
      setErrorMessage(t(lang, "pos.notice.select_product"));
      return;
    }
    setLabelPrintState({
      open: true,
      source,
      template: source === "inventory" ? "shelf" : "product",
      size: source === "inventory" ? "80x50" : "40x50",
      fields: {
        ...LABEL_FIELD_DEFAULTS,
        origin: source === "inventory",
        importer: source === "inventory",
      },
      items,
    });
  }

  function handlePrintLabels() {
    if (!labelPrintState.items.length) {
      setErrorMessage(t(lang, "pos.notice.select_product"));
      return;
    }
    const printWindow = window.open("", "_blank", "width=1080,height=760");
    if (!printWindow) {
      setErrorMessage(posErrorLabel(lang, "PRINT_WINDOW_BLOCKED"));
      return;
    }
    const labelWidth = labelPrintState.size === "80x50" ? "80mm" : "40mm";
    const labelHeight = labelPrintState.size === "80x50" ? "50mm" : "50mm";
    const title = t(lang, "pos.modal.print_labels");
    const renderedLabels = labelPrintState.items.flatMap((item) =>
      Array.from({ length: Math.max(1, item.copies) }).map(() => `
        <div class="label ${labelPrintState.size === "80x50" ? "label-shelf" : "label-product"}">
          ${item.imageUrl ? `<div class="thumb"><img src="${item.imageUrl}" alt="${item.nameCn || item.nameEs || item.clave}" /></div>` : ""}
          <div class="price">${labelPrintState.fields.price ? formatCurrency(lang, item.price) : "&nbsp;"}</div>
          ${labelPrintState.fields.nameCn ? `<div class="name">${item.nameCn || ""}</div>` : ""}
          ${labelPrintState.fields.nameEs ? `<div class="sub">${item.nameEs || ""}</div>` : ""}
          ${labelPrintState.fields.clave ? `<div class="meta">${t(lang, "pos.field.clave")}: ${item.clave}</div>` : ""}
          ${labelPrintState.fields.barcode && canRenderEan13Barcode(item.barcode || "") ? `<div class="barcode">${buildBarcodeSvgMarkup(item.barcode || "", { width: labelPrintState.size === "80x50" ? 1.35 : 1.05, height: labelPrintState.size === "80x50" ? 34 : 26, displayValue: true, margin: 0 })}</div>` : ""}
          ${labelPrintState.fields.barcode && !canRenderEan13Barcode(item.barcode || "") ? `<div class="meta warn">${t(lang, "pos.notice.barcode_not_printable")}</div>` : ""}
          ${labelPrintState.fields.origin ? `<div class="meta">${t(lang, "pos.field.origin")}: ${item.origin || "-"}</div>` : ""}
          ${labelPrintState.fields.importer ? `<div class="meta">${t(lang, "pos.field.importer")}: ${item.importer || "-"}</div>` : ""}
          ${labelPrintState.fields.shortDescription ? `<div class="desc">${item.shortDescription || ""}</div>` : ""}
        </div>
      `),
    ).join("");
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { margin: 8mm; }
            body { font-family: Arial, sans-serif; margin: 0; background: #fff; color: #0f172a; }
            .sheet { display:grid; grid-template-columns: repeat(auto-fill, minmax(${labelWidth}, 1fr)); gap: 8mm; padding: 8mm; }
            .label { width:${labelWidth}; min-height:${labelHeight}; border:1px solid #cbd5e1; border-radius:4mm; padding:4mm; box-sizing:border-box; display:flex; flex-direction:column; gap:2mm; page-break-inside: avoid; overflow:hidden; }
            .label-product { justify-content:flex-start; }
            .label-shelf { justify-content:flex-start; }
            .thumb { display:flex; justify-content:center; align-items:center; height:16mm; background:#f8fafc; border-radius:3mm; overflow:hidden; }
            .thumb img { max-width:100%; max-height:100%; object-fit:contain; }
            .price { font-size: 18px; font-weight: 700; }
            .name { font-size: 11px; font-weight: 700; line-height: 1.25; }
            .sub,.meta,.desc { font-size: 9px; line-height: 1.2; }
            .barcode { margin-top:1mm; }
            .barcode svg { width:100%; height:auto; }
            .warn { color:#b91c1c; }
          </style>
        </head>
        <body>
          <div class="sheet">${renderedLabels}</div>
          <script>window.onload = () => window.print();<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function addProductToCashierCart(product: PosProduct) {
    setCart((prev) => addProductToCartService(prev, product));
  }

  function addProductQtyToCashierCart(product: PosProduct, qty: number) {
    setCart((prev) => {
      let next = prev;
      for (let index = 0; index < Math.max(1, qty); index += 1) {
        next = addProductToCartService(next, product);
      }
      return next;
    });
  }

  function addProductToQuoteCart(product: PosProduct) {
    setQuoteCart((prev) => addProductToCartService(prev, product));
  }

  async function runSearch(mode: "cashier" | "quote") {
    const state = mode === "cashier" ? cashierSearch : quoteSearch;
    if (!state.barcode.trim() && !state.query.trim()) {
      setErrorMessage(t(lang, "pos.notice.search_required"));
      return;
    }
    const results = await searchPosProductsService({
      barcode: state.barcode.trim(),
      q: state.query.trim(),
      name: state.query.trim(),
    }, storeSnapshot.storeContext.storeId, { includeYogo: cashierSyncYogoProducts, take: cashierSyncYogoProducts ? 100 : 50 });
    if (mode === "cashier") setCashierResults(results);
    else setQuoteResults(results);
    if (results.length === 0) {
      setErrorMessage(t(lang, "pos.notice.product_not_found"));
      return;
    }
    const barcode = state.barcode.trim().toLowerCase();
    const query = state.query.trim().toLowerCase();
    const exact = results.filter((product) =>
      (barcode && product.barcode.toLowerCase() === barcode)
      || (query && product.clave.toLowerCase() === query),
    );
    if (exact.length === 1) {
      mode === "cashier" ? addProductToCashierCart(exact[0]) : addProductToQuoteCart(exact[0]);
      if (mode === "cashier") setCashierSearch({ barcode: "", query: "" });
      else setQuoteSearch({ barcode: "", query: "" });
      return;
    }
    if (results.length === 1) {
      mode === "cashier" ? addProductToCashierCart(results[0]) : addProductToQuoteCart(results[0]);
      if (mode === "cashier") setCashierSearch({ barcode: "", query: "" });
      else setQuoteSearch({ barcode: "", query: "" });
      return;
    }
    setSelectedProductsModal({ mode, items: results });
  }

  async function handleQuoteBatchUpload(file: File) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) {
      setErrorMessage(t(lang, "pos.notice.import_empty_file"));
      return;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
    if (!rows.length) {
      setErrorMessage(t(lang, "pos.notice.import_empty_file"));
      return;
    }
    let nextCart = quoteCart;
    for (const row of rows) {
      const clave = String(row.CLAVE || row.Clave || row.clave || "").trim();
      const barcode = String(row["COD. BARRAS"] || row["COD_BARRAS"] || row.barcode || row.Barcode || "").trim();
      const qty = Math.max(1, Number(row["CANT."] || row.CANT || row.qty || row.QTY || 1));
      if (!clave && !barcode) continue;
      const found = await searchPosProductsService({ barcode, q: clave || barcode, name: clave || barcode }, storeSnapshot.storeContext.storeId, { includeYogo: cashierSyncYogoProducts });
      const matched = barcode
        ? found.find((item) => item.barcode === barcode) || found[0]
        : found.find((item) => item.clave === clave) || found[0];
      if (!matched) continue;
      nextCart = addProductToCartService(nextCart, matched);
      const added = nextCart.lines[nextCart.lines.length - 1];
      nextCart = updateCartLineQty(nextCart, added.lineId, qty);
    }
    setQuoteCart(nextCart);
    setNoticeMessage(t(lang, "pos.notice.quote_import_ok"));
  }

  function updateItemQty(mode: "cashier" | "quote", lineId: string, qty: number) {
    const setter = mode === "cashier" ? setCart : setQuoteCart;
    setter((prev) => updateCartLineQty(prev, lineId, qty));
  }

  function removeItem(mode: "cashier" | "quote", lineId: string) {
    const setter = mode === "cashier" ? setCart : setQuoteCart;
    setter((prev) => removeCartLine(prev, lineId));
  }

  function clearCashierOrder() {
    setCart(clearCart());
  }

  function clearQuoteDraft() {
    setQuoteCart(createEmptyCart());
  }

  function openDiscount(target: DiscountTarget) {
    setDiscountTarget(target);
    if (target.kind === "order") {
      setDiscountModeDraft(cart.orderDiscount?.type || "percent");
      setDiscountValueDraft(cart.orderDiscount?.value ? String(cart.orderDiscount.value) : "");
      return;
    }
    if (target.kind === "quote_order") {
      setDiscountModeDraft(quoteCart.orderDiscount?.type || "percent");
      setDiscountValueDraft(quoteCart.orderDiscount?.value ? String(quoteCart.orderDiscount.value) : "");
      return;
    }
    const source = target.kind === "line"
      ? cart.lines.find((item) => item.lineId === target.lineId)
      : quoteCart.lines.find((item) => item.lineId === target.lineId);
    setDiscountModeDraft(source?.lineDiscount?.type || "percent");
    setDiscountValueDraft(source?.lineDiscount?.value ? String(source.lineDiscount.value) : "");
  }

  function applyDiscount() {
    if (!discountTarget) return;
    try {
      const normalizedDraft = String(discountValueDraft || "").trim().replace(",", ".");
      const rawValue = Number(normalizedDraft || 0);
      const parsedValue = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
      if (discountTarget.kind === "order") {
        setCart((prev) => setOrderDiscount(prev, discountModeDraft, parsedValue));
      } else if (discountTarget.kind === "quote_order") {
        setQuoteCart((prev) => setOrderDiscount(prev, discountModeDraft, parsedValue));
      } else {
        const setter = discountTarget.kind === "line" ? setCart : setQuoteCart;
        setter((prev) => setLineDiscount(prev, discountTarget.lineId, discountModeDraft, parsedValue));
      }
      setDiscountTarget(null);
      setDiscountValueDraft("");
    } catch (error) {
      console.error("Failed to apply discount", error);
      setErrorMessage(lang === "zh" ? "折扣输入有误，请重新输入。" : "El descuento no es valido. Intentalo de nuevo.");
    }
  }

  function getCashierSubtotal() {
    return cart.subtotal;
  }

  function getCashierLineDiscount() {
    return Number(cart.lines.reduce((sum, line) => sum + getLineDiscount(line), 0).toFixed(2));
  }

  function getCashierOrderDiscount() {
    if (!cart.orderDiscount) return 0;
    const base = Math.max(0, cart.subtotal - getCashierLineDiscount());
    if (cart.orderDiscount.type === "percent") return Number(((base * cart.orderDiscount.value) / 100).toFixed(2));
    return Math.min(base, cart.orderDiscount.value);
  }

  function getCashierTotal() {
    return cart.total;
  }

  function getQuoteSubtotal() {
    return quoteCart.subtotal;
  }

  function getQuoteLineDiscount() {
    return Number(quoteCart.lines.reduce((sum, line) => sum + getLineDiscount(line), 0).toFixed(2));
  }

  function getQuoteOrderDiscount() {
    if (!quoteCart.orderDiscount) return 0;
    const base = Math.max(0, quoteCart.subtotal - getQuoteLineDiscount());
    if (quoteCart.orderDiscount.type === "percent") return Number(((base * quoteCart.orderDiscount.value) / 100).toFixed(2));
    return Math.min(base, quoteCart.orderDiscount.value);
  }

  function getQuoteTotal() {
    return quoteCart.total;
  }

  const cashierChange = useMemo(() => cart.payment.change, [cart.payment.change]);
  const todayCashSalesTotal = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return Number(
      sales
        .filter((item) => (item.storeId || storeSnapshot.storeContext.storeId) === storeSnapshot.storeContext.storeId)
        .filter((item) => item.paymentMethod === "cash" && item.status !== "refunded")
        .filter((item) => item.createdAt.slice(0, 10) === today)
        .reduce((sum, item) => sum + item.total, 0)
        .toFixed(2),
    );
  }, [sales, storeSnapshot.storeContext.storeId]);
  const cashierOpeningDrawerBalance = useMemo(
    () => Number((openingCashAmount + todayCashSalesTotal).toFixed(2)),
    [openingCashAmount, todayCashSalesTotal],
  );

  function openOpeningCashModal() {
    setOpeningCashDraft(openingCashAmount > 0 ? String(openingCashAmount) : "");
    setOpeningCashModalOpen(true);
  }

  function openCashDrawerModal() {
    setCashDrawerPasswordDraft("");
    setCashDrawerMessage("");
    setCashDrawerModalOpen(true);
  }

  function openCashierUnlockModal() {
    setCashierUnlockPasswordDraft("");
    setCashierUnlockError("");
    setCashierUnlockModalOpen(true);
  }

  function confirmOpeningCash() {
    const rawValue = Number(String(openingCashDraft || "").trim() || 0);
    const parsedValue = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(openingCashStorageKey, String(parsedValue));
    }
    setOpeningCashAmount(parsedValue);
    setOpeningCashDraft(parsedValue > 0 ? String(parsedValue) : "");
    setOpeningCashModalOpen(false);
    setNoticeMessage(
      lang === "zh"
        ? `已记录开业现金：${formatCurrency(lang, parsedValue)}`
        : `Efectivo inicial guardado: ${formatCurrency(lang, parsedValue)}`,
    );
  }

  async function handleOpenCashDrawer() {
    try {
      const password = String(cashDrawerPasswordDraft || "").trim();
      if (!password) {
        setCashDrawerMessage(cashierPasswordRequiredLabel(lang));
        return;
      }

      setCashDrawerSubmitting(true);
      setCashDrawerMessage("");
      const verifyResponse = await fetch("/api/pos/cash-drawer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const verifyPayload = (await verifyResponse.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }))) as {
        ok?: boolean;
        error?: string;
      };

      if (!verifyResponse.ok || !verifyPayload.ok) {
        setCashDrawerMessage(cashierPasswordInvalidLabel(lang));
        return;
      }

      const openDrawer = window.parksonPos?.openCashDrawer || window.openCashDrawer;
      if (!openDrawer) {
        setCashDrawerMessage(cashDrawerInterfaceMissingLabel(lang));
        return;
      }
      await openDrawer();
      setCashDrawerModalOpen(false);
      setCashDrawerPasswordDraft("");
      setCashDrawerMessage("");
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setCashDrawerSubmitting(false);
    }
  }

  async function handleUnlockCashier() {
    try {
      const password = String(cashierUnlockPasswordDraft || "").trim();
      if (!password) {
        setCashierUnlockError(cashierPasswordRequiredLabel(lang));
        return;
      }
      setCashierUnlockSubmitting(true);
      setCashierUnlockError("");
      const verifyResponse = await fetch("/api/pos/cash-drawer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const verifyPayload = (await verifyResponse.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }))) as {
        ok?: boolean;
      };
      if (!verifyResponse.ok || !verifyPayload.ok) {
        setCashierUnlockError(cashierPasswordInvalidLabel(lang));
        return;
      }
      setCashierClosed(false);
      setCashierLastActiveAt(Date.now());
      setCashierUnlockModalOpen(false);
      setCashierUnlockPasswordDraft("");
      setCashierUnlockError("");
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setCashierUnlockSubmitting(false);
    }
  }

  async function openTicketPreview(saleId: string) {
    try {
      setTicketLoading(true);
      const ticket = await getPosSaleTicketService(saleId);
      setTicketPreview(ticket);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setTicketLoading(false);
    }
  }

  async function openSaleDetail(saleId: string) {
    try {
      const item = await getPosSaleDetailService(saleId);
      setSaleDetail(item);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    }
  }

  async function openInventoryDetail(inventoryId: string) {
    try {
      const item = await getPosInventoryDetailService(inventoryId);
      setInventoryDetail(item);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    }
  }

  async function openTransferDetail(transferId: string) {
    try {
      const item = await getPosTransferDetailService(transferId);
      setTransferDetail(item);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    }
  }

  async function submitInventoryAdjust() {
    if (!adjustTarget) return;
    try {
      setAdjustSubmitting(true);
      await adjustPosInventoryService(adjustTarget.id, adjustForm);
      setAdjustTarget(null);
      setInventoryDetail(null);
      setAdjustForm({
        adjustType: "increase",
        qty: 1,
        reason: "",
        note: "",
        operator: "",
      });
      await Promise.all([
        loadInventory(),
        loadInventoryMovements(),
        loadReplenishment(),
        loadReportData(),
      ]);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setAdjustSubmitting(false);
    }
  }

  function openInventoryCount(target: PosInventoryDetail) {
    setCountTarget(target);
    setCountForm({
      finalQty: target.onHandQty,
      reason: "",
      note: "",
      operator: "",
    });
  }

  async function submitInventoryCount() {
    if (!countTarget) return;
    try {
      setCountSubmitting(true);
      await countPosInventoryService(countTarget.id, countForm);
      setCountTarget(null);
      setInventoryDetail(null);
      await Promise.all([
        loadInventory(),
        loadInventoryMovements(),
        loadReplenishment(),
        loadReportData(),
      ]);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setCountSubmitting(false);
    }
  }

  function openInventoryDamage(target: PosInventoryDetail) {
    setDamageTarget(target);
    setDamageForm({
      qty: 1,
      reason: "",
      note: "",
      operator: "",
    });
  }

  async function submitInventoryDamage() {
    if (!damageTarget) return;
    try {
      setDamageSubmitting(true);
      await damagePosInventoryService(damageTarget.id, damageForm);
      setDamageTarget(null);
      setInventoryDetail(null);
      await Promise.all([
        loadInventory(),
        loadInventoryMovements(),
        loadReplenishment(),
        loadReportData(),
      ]);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setDamageSubmitting(false);
    }
  }

  async function submitRefund() {
    if (!refundTarget) return;
    try {
      setRefundSubmitting(true);
      const refund = await refundPosSaleService(refundTarget.id, refundReasonDraft.trim());
      setLastRefund(refund);
      setRefundTarget(null);
      setRefundReasonDraft("");
      setSaleDetail((prev) => (prev && prev.id === refund.saleRecordId ? { ...prev, status: "refunded" } : prev));
      await Promise.all([
        loadSales(),
        loadInventory(),
        loadInventoryMovements(),
        loadReplenishment(),
        loadReportData(),
      ]);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setRefundSubmitting(false);
    }
  }

  async function handleCharge() {
    if (!canCheckout) {
      setErrorMessage(t(lang, "pos.notice.permission_denied"));
      return;
    }
    if (cart.lines.length === 0) {
      setErrorMessage(t(lang, "pos.notice.cart_empty"));
      return;
    }
    if (!cart.payment.method) {
      setErrorMessage(t(lang, "pos.notice.payment_required"));
      return;
    }
    const total = getCashierTotal();
    if (cart.payment.method === "cash") {
      if (cart.payment.received < total) {
        setErrorMessage(t(lang, "pos.notice.payment_incomplete"));
        return;
      }
    }
    const pendingPrintWindow =
      typeof window !== "undefined"
        ? window.open("", "_blank", "width=420,height=840")
        : null;
    try {
      setCheckoutSubmitting(true);
      const normalizedCheckoutLines = cart.lines.map((line) => {
        const matchedProduct = products.find((product) =>
          product.id === line.productId
          || product.sourceProductId === line.productId
          || product.clave === line.clave
          || (!!line.barcode && product.barcode === line.barcode),
        );
        if (!matchedProduct) return line;
        return {
          ...line,
          sourceKind: matchedProduct.sourceKind || line.sourceKind,
          inventoryManaged: matchedProduct.inventoryManaged ?? line.inventoryManaged,
        };
      });
      const result = await checkoutPosSaleService({
        store: storeSnapshot.storeContext,
        cashier: storeSnapshot.cashierContext,
        customer: cart.customer,
        lines: normalizedCheckoutLines,
        orderDiscount: cart.orderDiscount,
        payment: cart.payment,
        sourceType: cart.sourceType,
        sourceId: cart.sourceId,
        subtotal: cart.subtotal,
        discountTotal: cart.discountTotal,
        total,
        note: cart.customer.notes,
      });
      if (cart.sourceType === "quote" && cart.sourceId) {
        setQuotes((prev) => prev.filter((item) => item.id !== cart.sourceId));
      }
      clearCashierOrder();
      setSales((prev) => [
        {
          id: result.saleId,
          folio: result.folio,
          sourceType: cart.sourceType,
          sourceId: cart.sourceId,
          customerName: cart.customer.name,
          customerPhone: cart.customer.phone,
          customerRfc: cart.customer.rfc,
          note: cart.customer.notes,
          subtotal: cart.subtotal,
          discountTotal: cart.discountTotal,
          total: result.total,
          paymentMethod: result.paymentMethod,
          receivedAmount: cart.payment.received,
          changeAmount: cart.payment.change,
          cashierName: storeSnapshot.cashierContext.cashierName,
          status: result.status,
          createdAt: result.createdAt,
          lines: normalizedCheckoutLines,
        },
        ...prev,
      ]);
      await Promise.all([
        loadInventory(),
        loadInventoryMovements(),
        loadReplenishment(),
        loadReportData(),
      ]);
      try {
        const ticket = await getPosSaleTicketService(result.saleId);
        await printPosTicket(ticket, lang, pendingPrintWindow);
      } catch (ticketError) {
        if (pendingPrintWindow && !pendingPrintWindow.closed) {
          pendingPrintWindow.close();
        }
        setErrorMessage(posErrorLabel(lang, ticketError instanceof Error ? ticketError.message : String(ticketError)));
      }
    } catch (error) {
      if (pendingPrintWindow && !pendingPrintWindow.closed) {
        pendingPrintWindow.close();
      }
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : "CHECKOUT_FAILED"));
    } finally {
      setCheckoutSubmitting(false);
    }
  }

  function handleSuspend() {
    if (cart.lines.length === 0) {
      setErrorMessage(t(lang, "pos.notice.cart_empty"));
      return;
    }
    setSuspendNoteDraft(cart.customer.notes);
    setSuspendModalOpen(true);
  }

  async function confirmSuspend() {
    const cartForSuspend = setCustomerField(cart, "notes", suspendNoteDraft.trim());
    const orderSource = cartForSuspend.customer.name ? cartForSuspend : setCustomerField(cartForSuspend, "name", t(lang, "pos.placeholder.walkin_customer"));
    try {
      const newOrder = await createPosSuspendedOrderService({
        store: storeSnapshot.storeContext,
        cashier: storeSnapshot.cashierContext,
        customer: orderSource.customer,
        lines: orderSource.lines,
        subtotal: orderSource.subtotal,
        discountTotal: orderSource.discountTotal,
        total: orderSource.total,
        note: suspendNoteDraft.trim(),
        paymentMethod: orderSource.payment.method,
      }, storeSnapshot.cashierContext);
      setSuspendedOrders((prev) => [newOrder, ...prev]);
      setSuspendModalOpen(false);
      clearCashierOrder();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function resumeSuspendedOrder(order: PosSuspendedOrder) {
    try {
      const result = await resumePosSuspendedOrderService(order.id);
      if (!result) {
        setErrorMessage(t(lang, "pos.notice.product_not_found"));
        return;
      }
      setCart(result.cart);
      setSuspendedOrders((prev) => prev.filter((item) => item.id !== order.id));
      setResumeTarget(null);
      switchTab("cashier");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveQuote() {
    if (quoteCart.lines.length === 0) {
      setErrorMessage(t(lang, "pos.notice.quote_empty"));
      return;
    }
    const quoteForSave = quoteCart.customer.name ? quoteCart : setCustomerField(quoteCart, "name", t(lang, "pos.placeholder.walkin_customer"));
    try {
      const record = await createPosQuoteService({
        store: storeSnapshot.storeContext,
        cashier: storeSnapshot.cashierContext,
        customer: quoteForSave.customer,
        lines: quoteForSave.lines,
        subtotal: quoteForSave.subtotal,
        discountTotal: quoteForSave.discountTotal,
        total: quoteForSave.total,
        note: quoteForSave.customer.notes,
      }, storeSnapshot.cashierContext);
      setQuotes((prev) => [record, ...prev]);
      clearQuoteDraft();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function quoteToCashier(record: PosQuoteDraft) {
    setCart(quoteToCartService(record));
    switchTab("cashier");
  }

  async function searchTransferProducts() {
    if (!transferSearch.trim()) {
      setErrorMessage(t(lang, "pos.notice.search_required"));
      return;
    }
    try {
      const results = await searchPosProductsService({ q: transferSearch }, transferForm.fromStoreId);
      setTransferSearchResults(results);
      if (!results.length) {
        setErrorMessage(t(lang, "pos.notice.product_not_found"));
      }
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    }
  }

  function addTransferLine(product: PosProduct) {
    setTransferForm((prev) => {
      const existing = prev.lines.find((line) => line.productId === product.id);
      if (existing) {
        return {
          ...prev,
          lines: prev.lines.map((line) =>
            line.productId === product.id
              ? { ...line, qty: line.qty + 1 }
              : line,
          ),
        };
      }
      return {
        ...prev,
        lines: [
          ...prev.lines,
          {
            productId: product.id,
            barcode: product.barcode,
            clave: product.clave,
            nameCn: product.nameCn,
            nameEs: product.nameEs,
            spec: product.spec,
            qty: 1,
          },
        ],
      };
    });
  }

  function updateTransferLineQty(productId: string, qty: number) {
    setTransferForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.productId === productId
          ? { ...line, qty }
          : line,
      ),
    }));
  }

  function removeTransferLine(productId: string) {
    setTransferForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((line) => line.productId !== productId),
    }));
  }

  function resetTransferForm() {
    setTransferForm({
      fromStoreId: storeSnapshot.storeContext.storeId,
      toStoreId: transferStores.find((item) => item !== storeSnapshot.storeContext.storeId) || "default",
      note: "",
      lines: [],
    });
    setTransferSearch("");
    setTransferSearchResults([]);
  }

  async function submitTransferCreate() {
    if (!transferForm.lines.length) {
      setErrorMessage(t(lang, "pos.notice.transfer_empty_lines"));
      return;
    }
    if (transferForm.fromStoreId === transferForm.toStoreId) {
      setErrorMessage(t(lang, "pos.notice.transfer_same_store"));
      return;
    }
    for (const line of transferForm.lines) {
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        setErrorMessage(t(lang, "pos.notice.transfer_invalid_qty"));
        return;
      }
    }
    try {
      setTransferSubmitting(true);
      const item = await createPosTransferService({
        fromStoreId: transferForm.fromStoreId,
        toStoreId: transferForm.toStoreId,
        note: transferForm.note,
        lines: transferForm.lines,
      });
      setTransferCreateOpen(false);
      resetTransferForm();
      setTransferDetail(item);
      await loadTransfers();
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setTransferSubmitting(false);
    }
  }

  async function sendTransferRecord(id: string) {
    try {
      setTransferActionSubmitting(true);
      const item = await sendPosTransferService(id);
      setTransferDetail(item);
      await Promise.all([
        loadTransfers(),
        loadInventory(),
        loadInventoryMovements(),
        loadReplenishment(),
        loadReportData(),
      ]);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setTransferActionSubmitting(false);
    }
  }

  async function receiveTransferRecord(id: string) {
    try {
      setTransferActionSubmitting(true);
      const item = await receivePosTransferService(id);
      setTransferDetail(item);
      await Promise.all([
        loadTransfers(),
        loadInventory(),
        loadInventoryMovements(),
        loadReplenishment(),
        loadReportData(),
      ]);
    } catch (error) {
      setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
    } finally {
      setTransferActionSubmitting(false);
    }
  }

  function renderNav() {
    return (
      <section className="-mt-[2px] flex items-center justify-between gap-3">
        <div className="flex shrink-0 flex-wrap gap-2">
            {POS_MAIN_NAV.map((section) => {
              const visible = POS_MAIN_NAV_TABS[section.id].some((id) => visibleTabs.some((tab) => tab.id === id));
              if (!visible) return null;
              const active = activeMainNav === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => switchMainNav(section.id)}
                  className={`inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-semibold transition ${
                    active
                      ? "bg-primary text-white shadow-soft"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-primary"
                  }`}
                >
                  {t(lang, section.labelKey)}
                </button>
              );
            })}
        </div>
        {visibleSecondaryTabs.length > 1 ? (
          <div className="ml-auto flex flex-wrap justify-end gap-1.5">
              {visibleSecondaryTabs.map((item) => {
                const active = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[11px] font-semibold transition ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-primary"
                    }`}
                  >
                    {t(lang, item.navKey)}
                  </button>
                );
              })}
          </div>
        ) : null}
      </section>
    );
  }

  function renderWorkbench() {
    const orderCountValue = dashboardSummary
      ? (
        workbenchOrderPeriod === "month"
          ? dashboardSummary.monthOrderCount
          : workbenchOrderPeriod === "day"
            ? dashboardSummary.todayOrderCount
            : dashboardSummary.weekOrderCount
      )
      : null;
    const orderPeriodOptions: Array<{ key: "month" | "week" | "day"; label: string }> = [
      { key: "month", label: t(lang, "common.month") },
      { key: "week", label: t(lang, "common.week") },
      { key: "day", label: t(lang, "common.day") },
    ];
    const workbenchCards = [
      { key: "today", label: t(lang, "pos.field.today_sales_total"), amount: dashboardSummary?.todaySalesTotal ?? null, rows: null },
      { key: "week", label: t(lang, "pos.field.week_sales_total"), amount: dashboardSummary?.weekSalesTotal ?? null, rows: null },
      { key: "month", label: t(lang, "pos.field.month_sales_total"), amount: dashboardSummary?.monthSalesTotal ?? null, rows: null },
      { key: "avg_ticket", label: t(lang, "pos.field.avg_ticket"), amount: dashboardSummary?.avgTicket ?? null, rows: null },
    ];
    const weeklyTrendLabel = getCurrentWeekLabel();
    const monthlyTrendLabel = getCurrentMonthLabel();
    const weeklyRange = getCurrentWeekDateRange();
    const monthlyRange = getCurrentMonthDateRange();
    const weeklyTrendMap = new Map(salesTrend.map((item) => [item.bucket, item]));
    const monthlyTrendMap = new Map(monthlySalesTrend.map((item) => [item.bucket, item]));
    const workbenchStoreWeeklyTrendMap = new Map(workbenchStoreWeeklySalesTrend.map((item) => [item.bucket, item]));
    const workbenchStoreMonthlyTrendMap = new Map(workbenchStoreMonthlySalesTrend.map((item) => [item.bucket, item]));
    const weeklyTrendPoints = getDateBuckets(weeklyRange.dateFrom, weeklyRange.dateTo).map((bucket) => (
      weeklyTrendMap.get(bucket) || { bucket, salesTotal: 0, refundTotal: 0, netSalesTotal: 0, orderCount: 0 }
    ));
    const monthlyTrendPoints = getDateBuckets(monthlyRange.dateFrom, monthlyRange.dateTo).map((bucket) => (
      monthlyTrendMap.get(bucket) || { bucket, salesTotal: 0, refundTotal: 0, netSalesTotal: 0, orderCount: 0 }
    ));
    const workbenchStoreWeeklyTrendPoints = getDateBuckets(weeklyRange.dateFrom, weeklyRange.dateTo).map((bucket) => (
      workbenchStoreWeeklyTrendMap.get(bucket) || { bucket, salesTotal: 0, refundTotal: 0, netSalesTotal: 0, orderCount: 0 }
    ));
    const workbenchStoreMonthlyTrendPoints = getDateBuckets(monthlyRange.dateFrom, monthlyRange.dateTo).map((bucket) => (
      workbenchStoreMonthlyTrendMap.get(bucket) || { bucket, salesTotal: 0, refundTotal: 0, netSalesTotal: 0, orderCount: 0 }
    ));
    const todayBucket = toDateInputValue(new Date());
    const openWorkbenchSalesDetail = (title: string, rows: WorkbenchSalesDetailRow[], storeName?: string) => {
      setWorkbenchSalesDetailPage(1);
      setWorkbenchSalesDetailModal({ title, storeName, rows });
    };
    const allStoreTodayRows = [{
      bucket: todayBucket,
      salesTotal: dashboardSummary?.todaySalesTotal || 0,
      refundTotal: 0,
      netSalesTotal: dashboardSummary?.todaySalesTotal || 0,
      orderCount: dashboardSummary?.todayOrderCount || 0,
    }];
    const workbenchStoreTodayRows = [{
      bucket: todayBucket,
      salesTotal: workbenchStoreSummary?.todaySalesTotal || 0,
      refundTotal: 0,
      netSalesTotal: workbenchStoreSummary?.todaySalesTotal || 0,
      orderCount: workbenchStoreSummary?.todayOrderCount || 0,
    }];
    const weeklySalesPoints = weeklyTrendPoints.filter((item) => item.netSalesTotal !== 0);
    const monthlySalesPoints = monthlyTrendPoints.filter((item) => item.netSalesTotal !== 0);
    const trendMax = Math.max(...weeklySalesPoints.map((item) => Math.abs(item.netSalesTotal)), 1);
    const monthlyTrendValues = monthlySalesPoints.map((item) => item.netSalesTotal);
    const monthlyTrendMin = monthlyTrendValues.length ? Math.min(...monthlyTrendValues) : 0;
    const monthlyTrendMax = monthlyTrendValues.length ? Math.max(...monthlyTrendValues) : 1;
    const monthlyTrendRange = monthlyTrendMax - monthlyTrendMin;
    const monthlyChartPoints = monthlyTrendPoints.map((item, index) => {
      const x = monthlyTrendPoints.length <= 1 ? 6 : 6 + (index / (monthlyTrendPoints.length - 1)) * 88;
      const hasSales = item.netSalesTotal !== 0;
      const scaledY = monthlyTrendRange === 0
        ? 44
        : 74 - ((item.netSalesTotal - monthlyTrendMin) / monthlyTrendRange) * 50;
      return {
        bucket: item.bucket,
        amount: item.netSalesTotal,
        x,
        y: hasSales && Number.isFinite(scaledY) ? Math.max(20, Math.min(74, scaledY)) : 74,
        hasSales,
      };
    });
    const monthlyChartSalesPoints = monthlyChartPoints.filter((point) => point.hasSales);
    const monthlyTrendRenderPath = (() => {
      if (monthlyChartSalesPoints.length === 0) return "";
      if (monthlyChartSalesPoints.length === 1) {
        return `M ${monthlyChartSalesPoints[0].x} ${monthlyChartSalesPoints[0].y}`;
      }

      const formatPoint = (value: number) => Number(value.toFixed(2));
      let path = `M ${formatPoint(monthlyChartSalesPoints[0].x)} ${formatPoint(monthlyChartSalesPoints[0].y)}`;
      for (let index = 0; index < monthlyChartSalesPoints.length - 1; index += 1) {
        const previousPoint = monthlyChartSalesPoints[Math.max(0, index - 1)];
        const currentPoint = monthlyChartSalesPoints[index];
        const nextPoint = monthlyChartSalesPoints[index + 1];
        const followingPoint = monthlyChartSalesPoints[Math.min(monthlyChartSalesPoints.length - 1, index + 2)];
        const controlOneX = currentPoint.x + (nextPoint.x - previousPoint.x) / 6;
        const controlOneY = currentPoint.y + (nextPoint.y - previousPoint.y) / 6;
        const controlTwoX = nextPoint.x - (followingPoint.x - currentPoint.x) / 6;
        const controlTwoY = nextPoint.y - (followingPoint.y - currentPoint.y) / 6;
        path += ` C ${formatPoint(controlOneX)} ${formatPoint(controlOneY)}, ${formatPoint(controlTwoX)} ${formatPoint(controlTwoY)}, ${formatPoint(nextPoint.x)} ${formatPoint(nextPoint.y)}`;
      }
      return path;
    })();
    const monthlyLabelPoints = monthlyChartPoints;
    const monthlyGuidePoints = monthlyChartPoints.map((point) => ({
      key: `guide-${point.bucket}`,
      x: point.x,
    }));
    const workbenchStoreSalesCards = [
      { key: "today", label: t(lang, "pos.field.today_sales_total"), amount: workbenchStoreSummary?.todaySalesTotal ?? null, rows: workbenchStoreTodayRows },
      { key: "week", label: t(lang, "pos.field.week_sales_total"), amount: workbenchStoreSummary?.weekSalesTotal ?? null, rows: workbenchStoreWeeklyTrendPoints },
      { key: "month", label: t(lang, "pos.field.month_sales_total"), amount: workbenchStoreSummary?.monthSalesTotal ?? null, rows: workbenchStoreMonthlyTrendPoints },
    ];
    const lowStockItems = workbenchLowStockOverview?.lowStockItems || [];
    const lowStockPreviewItems = lowStockItems.slice(0, 8);
    const lowStockPageSize = 8;
    const lowStockTotalPages = Math.max(1, Math.ceil(lowStockItems.length / lowStockPageSize));
    const lowStockCurrentPage = Math.min(workbenchLowStockPage, lowStockTotalPages);
    const lowStockPagedItems = lowStockItems.slice((lowStockCurrentPage - 1) * lowStockPageSize, lowStockCurrentPage * lowStockPageSize);
    const openLowStockPreviewImage = (item: PosInventoryOverview["lowStockItems"][number]) => {
      const sources = buildProductImageUrls(item.clave, ["jpg", "jpeg", "png", "webp"]);
      const src = buildProductImageUrl(item.clave, "jpg") || sources[0] || "";
      if (!src) return;
      setWorkbenchLowStockPreviewImage({
        src,
        title: item.productName || item.clave,
        fallbackSources: sources,
      });
    };
    const renderWorkbenchCurrencyValue = (amount: number | null, amountClassName: string) => {
      if (amount === null) return <>{t(lang, "common.loading")}</>;
      return (
        <>
          <span className="text-[0.62em] font-bold text-slate-400">$</span>
          <span className={amountClassName}>{amount.toFixed(2)}</span>
          <span className="ml-1 text-[0.62em] font-bold text-slate-400">MX</span>
        </>
      );
    };
    return (
      <div className="w-full max-w-none space-y-2 text-left">
        <div className="grid w-full justify-start gap-2 lg:grid-cols-5">
          {workbenchCards.map((item) => {
            const detailRows = item.key === "today"
              ? allStoreTodayRows
              : item.key === "week"
                ? weeklyTrendPoints
                : item.key === "month"
                  ? monthlyTrendPoints
                  : null;
            const clickable = Boolean(detailRows);
            const cardClassName = `flex min-h-[88px] flex-col justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-soft transition ${
              clickable ? "hover:border-primary/40 hover:shadow-md" : ""
            }`;
            const content = (
              <>
                <div className="text-[13px] font-semibold leading-tight text-slate-700">{item.label}</div>
                <div className="mt-1 text-[24px] font-bold leading-tight">
                  {renderWorkbenchCurrencyValue(item.amount, item.key === "today" ? "text-emerald-600" : "text-slate-900")}
                </div>
              </>
            );
            return clickable && detailRows ? (
              <button
                key={item.key}
                type="button"
                onClick={() => openWorkbenchSalesDetail(item.label, detailRows)}
                className={cardClassName}
              >
                {content}
              </button>
            ) : (
              <div key={item.key} className={cardClassName}>
                {content}
              </div>
            );
          })}
          <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] font-semibold leading-tight text-slate-700">{t(lang, "pos.field.order_count")}</div>
              <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {orderPeriodOptions.map((option) => {
                  const active = workbenchOrderPeriod === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setWorkbenchOrderPeriod(option.key)}
                      className={`inline-flex h-6 items-center justify-center rounded-md px-2 text-[10px] font-semibold transition ${
                        active ? "bg-primary text-white shadow-soft" : "text-slate-500 hover:bg-white hover:text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 text-[24px] font-bold leading-tight text-slate-900">
              {orderCountValue === null ? t(lang, "common.loading") : String(orderCountValue)}
            </div>
          </div>
        </div>
        <div className="grid w-full justify-start gap-2 xl:grid-cols-2">
          <PosSectionCard title={t(lang, "pos.section.weekly_trend")} className="h-full" actions={<div className="text-[11px] font-medium text-slate-500">{weeklyTrendLabel}</div>}>
            {weeklyTrendPoints.length === 0 ? (
              <PosEmptyState
                title={t(lang, "pos.empty.title")}
                description={t(lang, "pos.empty.description")}
              />
            ) : (
              <div className="px-1 py-1">
                <div
                  className="grid h-[118px] items-end gap-3"
                  style={{ gridTemplateColumns: `repeat(${Math.max(weeklyTrendPoints.length, 1)}, minmax(0, 1fr))` }}
                >
                  {weeklyTrendPoints.map((item) => {
                    const hasSales = item.netSalesTotal !== 0;
                    const barHeight = hasSales ? Math.max(8, Math.round((Math.abs(item.netSalesTotal) / trendMax) * 54)) : 0;
                    return (
                      <div key={item.bucket} className="flex h-full flex-col items-center justify-end gap-2">
                        <div className="w-full text-center text-[10px] font-semibold leading-none text-slate-600">
                          {hasSales ? formatTrendAmount(lang, item.netSalesTotal) : ""}
                        </div>
                        <div className="flex h-[58px] w-full items-end justify-center">
                          {hasSales ? (
                            <div className="w-[76%] rounded-[3px] bg-slate-200" style={{ height: `${barHeight}px` }} />
                          ) : null}
                        </div>
                        <div className="text-[10px] leading-none text-slate-500">{getDayLabel(item.bucket)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </PosSectionCard>
          <PosSectionCard title={t(lang, "pos.section.monthly_trend")} className="h-full" actions={<div className="text-[11px] font-medium text-slate-500">{monthlyTrendLabel}</div>}>
            {monthlyTrendPoints.length === 0 ? (
              <PosEmptyState
                title={t(lang, "pos.empty.title")}
                description={t(lang, "pos.empty.description")}
              />
            ) : (
              <div className="px-1 py-1">
                <div className="relative h-[118px]">
                  <svg viewBox="0 0 100 92" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[92px] w-full overflow-visible">
                    <defs>
                      <filter id="monthly-trend-shadow" x="-20%" y="-20%" width="140%" height="170%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" />
                      </filter>
                    </defs>
                    {monthlyGuidePoints.map((point) => (
                      <line
                        key={point.key}
                        x1={point.x}
                        y1="12"
                        x2={point.x}
                        y2="80"
                        stroke="rgb(230 236 247)"
                        strokeWidth="0.6"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {monthlyChartSalesPoints.length > 1 ? (
                      <>
                        <path
                          d={monthlyTrendRenderPath}
                          fill="none"
                          stroke="rgb(99 132 255)"
                          strokeOpacity="0.14"
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          filter="url(#monthly-trend-shadow)"
                          transform="translate(0 3)"
                          vectorEffect="non-scaling-stroke"
                        />
                        <path
                          d={monthlyTrendRenderPath}
                          fill="none"
                          stroke="rgb(99 132 255)"
                          strokeWidth="1.25"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </>
                    ) : null}
                  </svg>
                  {monthlyChartSalesPoints.map((point) => (
                    <span
                      key={point.bucket}
                      title={formatCurrency(lang, point.amount)}
                      className="absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#6384ff] shadow-[0_0_0_2px_rgba(99,132,255,0.14)]"
                      style={{ left: `${point.x}%`, top: `${point.y}px` }}
                    />
                  ))}
                  <div
                    className="absolute inset-x-0 bottom-0 grid gap-0 text-center text-[8px] leading-none text-[#bfCCE8]"
                    style={{ gridTemplateColumns: `repeat(${Math.max(monthlyLabelPoints.length, 1)}, minmax(0, 1fr))` }}
                  >
                    {monthlyLabelPoints.map((point) => (
                      <span key={`label-${point.bucket}`}>{getDayLabel(point.bucket)}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </PosSectionCard>
        </div>
        <div className="grid w-full justify-start gap-2 xl:grid-cols-2">
          <PosSectionCard
            title={t(lang, "pos.section.low_inventory_alerts")}
            description={t(lang, "pos.field.low_stock_count")}
            className="h-full"
            actions={
              <select
                value={workbenchLowStockStoreId}
                onChange={(event) => {
                  const nextStoreId = event.target.value;
                  setWorkbenchLowStockStoreId(nextStoreId);
                }}
                className="h-8 min-w-[128px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-700 outline-none focus:border-primary"
              >
                {storeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            }
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">
                {t(lang, "pos.field.store")}:
              </div>
              <div className="mt-1 text-[15px] font-bold leading-tight text-slate-800">
                {workbenchLowStockStoreName}
              </div>
              <div className="mt-3">
                {lowStockPreviewItems.length ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
                      {lowStockPreviewItems.map((item) => (
                        <div key={`${item.storeId}-${item.productId}`} className="relative flex h-[68px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-center">
                          <div className="relative h-[45px] w-full">
                            <ProductImage
                              sku={item.clave}
                              alt={item.productName}
                              size={44}
                              className="h-full w-full"
                              imageClassName="h-full w-full object-contain grayscale"
                              roundedClassName="rounded-t-lg rounded-b-none"
                              fill
                              onClick={() => openLowStockPreviewImage(item)}
                            />
                            <span className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold leading-none text-white shadow-sm">
                              {lang === "zh" ? "低" : "L"}
                            </span>
                          </div>
                          <div className="flex h-[23px] items-center justify-center px-1 text-[9px] font-semibold leading-none text-slate-700">
                            <span className="max-w-full truncate">{item.clave}</span>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setWorkbenchLowStockPage(1);
                          setWorkbenchLowStockModalOpen(true);
                        }}
                        className="flex h-[68px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-1 text-[10px] font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary"
                      >
                        {lang === "zh" ? "更多数据" : "More data"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
                    {reportsLoading ? t(lang, "common.loading") : t(lang, "pos.empty.description")}
                  </div>
                )}
              </div>
            </div>
          </PosSectionCard>
          <PosSectionCard
            title={t(lang, "pos.section.store_snapshot")}
            description={t(lang, "pos.section.store_snapshot.desc")}
            className="h-full"
            actions={
              <select
                value={workbenchSalesStoreId}
                onChange={(event) => {
                  setWorkbenchSalesStoreId(event.target.value);
                }}
                className="h-8 min-w-[128px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-700 outline-none focus:border-primary"
              >
                {storeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            }
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">
                {t(lang, "pos.field.store")}:
              </div>
              <div className="mt-1 text-[15px] font-bold leading-tight text-slate-800">
                {workbenchStoreName}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {workbenchStoreSalesCards.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => openWorkbenchSalesDetail(item.label, item.rows, workbenchStoreName)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="text-[11px] text-slate-500">{item.label}</div>
                    <div className="mt-1 text-[20px] font-bold leading-tight">
                      {renderWorkbenchCurrencyValue(item.amount, "text-slate-900")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </PosSectionCard>
        </div>
        <PosSectionCard title={t(lang, "pos.section.hot_products")} description={t(lang, "pos.field.top_products")} className="h-full">
          <div>
            {topProductsReport?.topByQty?.length ? (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {topProductsReport.topByQty.slice(0, 10).map((item, index) => (
                  <div key={item.productId} className="relative flex h-[180px] flex-col overflow-visible rounded-lg border border-slate-200 bg-white text-center">
                    <div className="relative h-[108px] w-full overflow-hidden rounded-t-lg">
                      <ProductImage
                        sku={item.clave}
                        alt={item.productName}
                        size={104}
                        className="h-full w-full"
                        imageClassName="h-full w-full object-contain grayscale"
                        roundedClassName="rounded-t-lg rounded-b-none"
                        fill
                      />
                    </div>
                    {index < 3 ? (
                      <span className="pointer-events-none absolute -right-5 -top-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_10px_24px_rgba(15,23,42,0.28)] ring-[4px] ring-white">
                        <img
                          src={`/icons/xl${index + 1}.svg`}
                          alt={lang === "zh" ? `销量第${index + 1}名` : `Top ${index + 1}`}
                          className="h-10 w-10 object-contain"
                        />
                      </span>
                    ) : null}
                    <div className="flex h-[32px] items-center justify-center px-1 text-[10px] font-semibold leading-none text-slate-700">
                      <span className="max-w-full truncate">{item.clave}</span>
                    </div>
                    <div className="flex h-[40px] items-center justify-center gap-1 px-1 text-[11px] font-normal leading-none text-slate-400">
                      <span>{lang === "zh" ? "销量" : "Sales"}</span>
                      <span className="text-[12px] font-bold text-slate-900">{item.qtyTotal}</span>
                      <span>{lang === "zh" ? "个" : "pcs"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
                {reportsLoading ? t(lang, "common.loading") : t(lang, "pos.empty.description")}
              </div>
            )}
          </div>
        </PosSectionCard>
      </div>
    );
  }

  function renderCartTable(items: PosCartLine[], mode: "cashier" | "quote") {
    if (items.length === 0) {
      return (
        <PosEmptyState
          title={t(lang, "pos.empty.cart_title")}
          description={t(lang, "pos.empty.cart_description")}
        />
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead className="bg-slate-50">
            <tr>
              {[t(lang, "pos.field.product"), t(lang, "pos.field.quantity"), t(lang, "pos.field.unit_price"), t(lang, "pos.field.discount"), t(lang, "pos.field.subtotal"), t(lang, "pos.field.actions")].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const lineBase = item.qty * item.unitPrice;
              const lineDiscount = getLineDiscount(item);
              const lineTotal = lineBase - lineDiscount;
              return (
                <tr key={`${mode}-${item.lineId}`} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">{lang === "zh" ? item.nameCn : item.nameEs}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.clave} / {item.barcode}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateItemQty(mode, item.lineId, item.qty - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">-</button>
                      <input
                        value={item.qty}
                        onChange={(event) => updateItemQty(mode, item.lineId, Number(event.target.value || 1))}
                        className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-center text-sm outline-none focus:border-primary"
                      />
                      <button type="button" onClick={() => updateItemQty(mode, item.lineId, item.qty + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">+</button>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(lang, item.unitPrice)}</td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openDiscount(mode === "cashier" ? { kind: "line", lineId: item.lineId } : { kind: "quote_line", lineId: item.lineId })}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"
                    >
                      {item.lineDiscount
                        ? item.lineDiscount.type === "percent"
                          ? `${item.lineDiscount.value}%`
                          : formatCurrency(lang, item.lineDiscount.value)
                        : t(lang, "pos.button.set_discount")}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-900">{formatCurrency(lang, lineTotal)}</td>
                  <td className="px-4 py-4">
                    <button type="button" onClick={() => removeItem(mode, item.lineId)} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
                      {t(lang, "pos.button.delete")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderCashier() {
    const subtotal = getCashierSubtotal();
    const lineDiscount = getCashierLineDiscount();
    const orderDiscount = getCashierOrderDiscount();
    const total = getCashierTotal();
    const searchKeyword = cashierSearch.query.trim().toLowerCase();
    const barcodeKeyword = cashierSearch.barcode.trim().toLowerCase();
    const cashierProductPageSize = 20;
    const layout1CategoryProducts = cashierViewMode !== "layout2" && cashierSyncYogoProducts && cashierPrimaryCategory && cashierCategoryProducts
      ? cashierCategoryProducts
      : null;
    const cashierBaseCatalogProducts = layout1CategoryProducts || cashierCatalogProducts;
    const cashierSearchSource = barcodeKeyword || searchKeyword ? products : cashierBaseCatalogProducts;
    const cashierFuzzySource = barcodeKeyword || searchKeyword
      ? cashierSearchSource.filter((item) => {
          const haystack = [
            item.barcode,
            item.clave,
            item.nameCn,
            item.nameEs,
            item.category,
            item.subcategory,
          ].join(" ").toLowerCase();
          return (!barcodeKeyword || haystack.includes(barcodeKeyword)) && (!searchKeyword || haystack.includes(searchKeyword));
        })
      : cashierBaseCatalogProducts;
    const productSource = barcodeKeyword || searchKeyword ? (cashierResults.length ? cashierResults : cashierFuzzySource) : cashierBaseCatalogProducts;
    const cashierProductTotalPages = Math.max(1, Math.ceil(productSource.length / cashierProductPageSize));
    const cashierProductCurrentPage = Math.min(cashierProductPage, cashierProductTotalPages);
    const productGrid = productSource.slice(
      (cashierProductCurrentPage - 1) * cashierProductPageSize,
      cashierProductCurrentPage * cashierProductPageSize,
    );
    const layout2CartPageSize = cashierFullscreenEnabled ? 10 : 5;
    const layout2CartTotalPages = Math.max(1, Math.ceil(cart.lines.length / layout2CartPageSize));
    const layout2CartCurrentPage = Math.min(layout2CartPage, layout2CartTotalPages);
    const layout2CartLines = cart.lines.slice(
      (layout2CartCurrentPage - 1) * layout2CartPageSize,
      layout2CartCurrentPage * layout2CartPageSize,
    );
    const layout2VisibleLineCount = Math.min(cart.lines.length, layout2CartPageSize);
    const layout2Density =
      layout2VisibleLineCount <= 4
        ? "large"
        : layout2VisibleLineCount <= 6
          ? "medium"
          : layout2VisibleLineCount <= 8
            ? "compact"
            : "dense";
    const itemCount = cart.lines.reduce((sum, item) => sum + item.qty, 0);
    const normalizedCustomerName = (cart.customer.name || "").trim();
    const hiddenCustomerPlaceholders = new Set(["散客", "PUBLICO GENERAL", "客户信息", "INFO CLIENTE"]);
    const displayCustomerName = hiddenCustomerPlaceholders.has(normalizedCustomerName) ? "" : normalizedCustomerName;
    const customerSummary = [displayCustomerName, cart.customer.phone].filter(Boolean).join(" / ");
    const cashierHeightClass = cashierFullscreenEnabled ? "h-full overflow-hidden" : "xl:h-[calc(100dvh-185px)] xl:overflow-hidden";
    const cashierGridHeightClass = cashierFullscreenEnabled ? "h-full xl:grid-cols-[minmax(338px,30%)_1fr]" : "xl:h-full xl:grid-cols-[minmax(338px,30%)_1fr]";
    const cashierColumnHeightClass = cashierFullscreenEnabled ? "xl:h-full" : "xl:h-[calc(100dvh-185px)]";
    const productGridClass = cashierFullscreenEnabled ? "auto-rows-[142px]" : "auto-rows-[118px]";
    const productCardClass = cashierFullscreenEnabled ? "h-[142px]" : "h-[118px]";
    const productImageSize = cashierFullscreenEnabled ? 82 : 70;
    const productImageClass = cashierFullscreenEnabled ? "h-[82px] w-[82px]" : "h-[70px] w-[70px]";
    const cashierLayout2Active = cashierViewMode === "layout2";
    const fullscreenText = {
      storeName: cashierFullscreenEnabled ? "text-[14px]" : "text-[13px]",
      fieldLabel: cashierFullscreenEnabled ? "text-[11px]" : "text-[10px]",
      fieldValue: cashierFullscreenEnabled ? "text-[16px]" : "text-[15px]",
      empty: cashierFullscreenEnabled ? "text-[13px] leading-6" : "text-[12px] leading-5",
      cartName: cashierFullscreenEnabled ? "text-[13px]" : "text-[12px]",
      cartMeta: cashierFullscreenEnabled ? "text-[11px]" : "text-[10px]",
      unitSymbol: cashierFullscreenEnabled ? "text-[9px]" : "text-[8px]",
      unitValue: cashierFullscreenEnabled ? "text-[11px]" : "text-[10px]",
      amountSymbol: cashierFullscreenEnabled ? "text-[10px]" : "text-[9px]",
      amountValue: cashierFullscreenEnabled ? "text-[14px]" : "text-[13px]",
      totalValue: cashierFullscreenEnabled ? "text-[15px]" : "text-[14px]",
      control: cashierFullscreenEnabled ? "text-[11px]" : "text-[10px]",
      input: cashierFullscreenEnabled ? "text-sm" : "text-xs",
      qtyInput: cashierFullscreenEnabled ? "text-[12px]" : "text-[11px]",
      category: cashierFullscreenEnabled ? "text-[12px]" : "text-[10px]",
      productName: cashierFullscreenEnabled ? "text-[13px] leading-5" : "text-[11px] leading-4",
      productCode: cashierFullscreenEnabled ? "text-[12px]" : "text-[10px]",
      productPriceSymbol: cashierFullscreenEnabled ? "text-[12px]" : "text-[10px]",
      productPriceValue: cashierFullscreenEnabled ? "text-[13px]" : "text-[11px]",
      productStock: cashierFullscreenEnabled ? "text-[12px]" : "text-[10px]",
      pager: cashierFullscreenEnabled ? "text-[12px]" : "text-[11px]",
    };
    const leftCardShellClass = cashierLayout2Active
      ? "flex h-full flex-col overflow-hidden !rounded-none !border-0 !bg-white !p-0 !shadow-none"
      : "flex h-full flex-col overflow-hidden";
    const rightCardShellClass = cashierLayout2Active
      ? "flex h-full flex-col overflow-hidden !rounded-none !border-0 !bg-[#eef5ff] !p-0 !shadow-none"
      : "flex h-full flex-col overflow-hidden";
    const headerMetricCardClass = cashierLayout2Active
      ? "bg-transparent px-0 py-0 shadow-none"
      : "rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5";
    const cartAreaClass = cashierLayout2Active
      ? "mt-3 min-h-0 flex-1 overflow-hidden bg-transparent"
      : "mt-2 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50";
    const cartLineCardClass = cashierLayout2Active
      ? "px-0 py-3"
      : "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5";
    const totalsCardClass = cashierLayout2Active
      ? "bg-transparent px-0 py-3 shadow-none"
      : "rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5";
    const paymentButtonBaseClass = cashierLayout2Active
      ? "inline-flex h-9 items-center justify-center border border-slate-300 bg-white font-semibold transition"
      : "inline-flex h-8 items-center justify-center rounded-lg border font-semibold transition";
    const cashierActionTextClass = cashierLayout2Active ? "text-[15px]" : "text-[12px]";
    const cashierFooterTextClass = "text-[12px]";
    const secondaryActionClass = cashierLayout2Active
      ? `inline-flex h-9 items-center justify-center bg-transparent text-slate-700 ${cashierActionTextClass}`
      : `inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 ${fullscreenText.control}`;
    const inputShellClass = cashierLayout2Active
      ? `h-9 w-full bg-transparent px-3 text-slate-700 outline-none ${cashierActionTextClass}`
      : `h-8 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-700 outline-none focus:border-primary ${fullscreenText.input}`;
    const searchInputClass = cashierLayout2Active
      ? `h-9 w-full border border-slate-300 bg-white pl-3 pr-9 outline-none focus:border-primary ${fullscreenText.input}`
      : `h-8 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-9 outline-none focus:border-primary ${fullscreenText.input}`;
    const fullscreenButtonClass = cashierLayout2Active
      ? `inline-flex h-9 w-9 items-center justify-center border transition ${
          cashierFullscreenEnabled
            ? "border-primary bg-primary text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
        }`
      : `inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
          cashierFullscreenEnabled
            ? "border-primary bg-primary text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
        }`;
    const categoryButtonClass = (active: boolean) => cashierLayout2Active
      ? `inline-flex h-8 items-center justify-center px-3 ${fullscreenText.category} font-semibold transition ${
          active
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:text-slate-900"
        }`
      : `inline-flex h-7 items-center justify-center rounded-lg px-2.5 ${fullscreenText.category} font-semibold ${
          active ? "bg-primary text-white" : "border border-slate-200 bg-slate-50 text-slate-600"
        }`;
    const productCardShellClass = cashierLayout2Active
      ? "px-0 py-2 text-left transition"
      : `${productCardClass} rounded-lg bg-white p-2.5 text-left shadow-[0_0_0_1px_rgba(15,23,42,0.035),0_0_6px_rgba(15,23,42,0.08)] transition hover:shadow-[0_0_0_1px_rgba(15,23,42,0.045),0_0_8px_rgba(15,23,42,0.1)]`;
    const rightInnerShellClass = cashierLayout2Active
      ? "mx-auto flex h-full w-full max-w-[calc(100%-12rem)] flex-col py-10"
      : "relative flex h-full min-h-0 flex-col";
    const layout2MetricWrapClass = cashierLayout2Active ? "mx-auto flex w-full max-w-[220px] flex-col items-start justify-center" : "";
    const layout2MetricRowClass = cashierLayout2Active ? "flex w-full items-baseline justify-start gap-3 text-left" : "";
    const layout2PaymentLabel = (method: "cash" | "transfer" | "card") => {
      const label = paymentLabel(lang, method);
      if (lang !== "zh" || label.length !== 2) return label;
      return (
        <span className="inline-flex items-center gap-1">
          <span>{label[0]}</span>
          <span>{label[1]}</span>
        </span>
      );
    };
    const layout2ImageClass =
      layout2Density === "large"
        ? "h-14 w-14"
        : layout2Density === "medium"
          ? "h-11 w-11"
          : layout2Density === "compact"
            ? "h-9 w-9"
            : "h-8 w-8";
    const layout2ImageWrapClass =
      layout2Density === "large"
        ? "w-[88px]"
        : layout2Density === "medium"
          ? "w-[72px]"
          : layout2Density === "compact"
            ? "w-[64px]"
            : "w-[58px]";
    const layout2CodeClass =
      layout2Density === "large"
        ? "text-[15px]"
        : layout2Density === "medium"
          ? "text-[13px]"
          : layout2Density === "compact"
            ? "text-[12px]"
            : "text-[11px]";
    const productImageWrapClass = cashierLayout2Active
      ? `flex ${layout2ImageWrapClass} shrink-0 items-center justify-center overflow-hidden bg-transparent`
      : `flex ${productImageClass} shrink-0 items-center justify-center overflow-hidden rounded-lg bg-transparent shadow-[0_1px_5px_rgba(15,23,42,0.10)]`;
    const layout2NameClass =
      layout2Density === "large"
        ? "text-[18px]"
        : layout2Density === "medium"
          ? "text-[15px]"
          : layout2Density === "compact"
            ? "text-[14px]"
            : "text-[13px]";
    const layout2QtyClass =
      layout2Density === "large"
        ? "text-[20px]"
        : layout2Density === "medium"
          ? "text-[16px]"
          : layout2Density === "compact"
            ? "text-[14px]"
            : "text-[13px]";
    const layout2PriceValueClass =
      layout2Density === "large"
        ? "text-[20px] font-semibold"
        : layout2Density === "medium"
          ? "text-[17px] font-semibold"
          : layout2Density === "compact"
            ? "text-[15px] font-semibold"
            : "text-[14px] font-semibold";
    const layout2PriceSymbolClass =
      layout2Density === "large"
        ? "text-[12px]"
        : layout2Density === "medium"
          ? "text-[10px]"
          : "text-[9px]";
    const layout2DeleteClass =
      layout2Density === "large"
        ? "text-[22px]"
        : layout2Density === "medium"
          ? "text-[20px]"
          : "text-[18px]";
    const cashierClosedLogoUrl = activeCashierTicketSetting?.logoUrl || "/BSLOGO.png";
    const layout2RowGridClass = cashierFullscreenEnabled
      ? layout2Density === "large"
        ? "grid-cols-[104px_168px_minmax(244px,2.2fr)_96px_96px_220px]"
        : layout2Density === "medium"
          ? "grid-cols-[88px_144px_minmax(196px,1.95fr)_92px_96px_196px]"
          : layout2Density === "compact"
            ? "grid-cols-[76px_132px_minmax(166px,1.85fr)_88px_92px_176px]"
            : "grid-cols-[70px_122px_minmax(148px,1.75fr)_80px_84px_160px]"
      : layout2Density === "large"
        ? "grid-cols-[112px_176px_minmax(114px,1.55fr)_72px_76px_148px]"
        : layout2Density === "medium"
          ? "grid-cols-[96px_148px_minmax(108px,1.45fr)_68px_72px_136px]"
          : layout2Density === "compact"
            ? "grid-cols-[84px_132px_minmax(96px,1.35fr)_62px_66px_124px]"
            : "grid-cols-[76px_124px_minmax(88px,1.25fr)_58px_62px_112px]";

    return (
      <div className={`space-y-2 ${cashierHeightClass}`}>
        {cashierClosed ? (
          <PosSectionCard title="" description="" className={cashierLayout2Active ? rightCardShellClass : "flex h-full overflow-hidden !p-0"}>
            <div className={`${cashierLayout2Active ? "flex h-full min-h-[calc(100dvh-185px)] flex-col items-center justify-center gap-6 bg-[#eef5ff] px-6 text-center" : cashierFullscreenEnabled ? "flex h-full min-h-full w-full flex-col items-center justify-center gap-6 px-6 text-center" : "flex min-h-[calc(100dvh-185px)] w-full flex-col items-center justify-center gap-6 px-6 text-center"}`}>
              <img src={cashierClosedLogoUrl} alt={storeSnapshot.storeContext.storeName} className="h-20 w-20 object-contain" />
              <div className="text-lg font-semibold text-slate-900">{formatCashierClosedDateTime(lang, cashierClockNow)}</div>
              <button
                type="button"
                onClick={openCashierUnlockModal}
                className={`inline-flex h-11 items-center justify-center bg-primary px-6 text-sm font-semibold text-white ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
              >
                {cashierClosedButtonLabel(lang)}
              </button>
            </div>
          </PosSectionCard>
        ) : (
        <div className={`grid ${cashierLayout2Active ? "gap-0" : "gap-2"} ${cashierGridHeightClass}`}>
          <div className={`min-h-0 xl:sticky xl:top-0 ${cashierColumnHeightClass}`}>
            <PosSectionCard title="" className={leftCardShellClass}>
              <div className={`grid gap-3 ${cashierLayout2Active ? "grid-cols-1 content-start px-3 pt-10" : "grid-cols-[1.2fr_0.55fr_0.55fr_1fr] items-end"}`}>
                {!cashierLayout2Active ? (
                  <div className="flex min-w-0 self-center items-center justify-center gap-2 px-1 text-center">
                    <img src="/BSLOGO.png" alt={storeSnapshot.storeContext.storeName} className="h-8 w-8 shrink-0 object-contain" />
                    <div className="min-w-0">
                      <div className={`truncate font-semibold text-slate-900 ${fullscreenText.storeName}`}>{storeSnapshot.storeContext.storeName}</div>
                    </div>
                  </div>
                ) : null}
                {cashierLayout2Active ? (
                  <>
                    <div className={`${layout2MetricWrapClass} gap-4`}>
                      <div className={layout2MetricRowClass}>
                        <div className="min-w-[56px] text-[14px] text-slate-900">{t(lang, "pos.field.product")}</div>
                        <div className="font-semibold leading-none text-slate-900 text-[22px]">{cart.lines.length}</div>
                      </div>
                      <div className={layout2MetricRowClass}>
                        <div className="min-w-[56px] text-[14px] text-slate-900">{t(lang, "pos.field.quantity")}</div>
                        <div className="font-semibold leading-none text-slate-900 text-[22px]">{itemCount}</div>
                      </div>
                      <div className={layout2MetricRowClass}>
                        <div className="min-w-[56px] text-[14px] text-slate-900">{t(lang, "pos.field.subtotal")}</div>
                        <div>
                          <CurrencyParts value={subtotal} symbolClassName="text-[11px] font-semibold text-slate-400" valueClassName="text-[22px] font-semibold leading-none text-slate-900" />
                        </div>
                      </div>
                      <div className={layout2MetricRowClass}>
                        <div className="min-w-[56px] text-[14px] text-slate-900">{t(lang, "pos.field.discount")}</div>
                        <div>
                          <CurrencyParts value={lineDiscount + orderDiscount} symbolClassName="text-[11px] font-semibold text-slate-400" valueClassName="text-[22px] font-semibold leading-none text-slate-900" />
                        </div>
                      </div>
                      <div className={layout2MetricRowClass}>
                        <div className="min-w-[56px] text-[14px] text-slate-900">{t(lang, "pos.field.total")}</div>
                        <div>
                          <CurrencyParts value={total} symbolClassName="text-[11px] font-semibold text-slate-400" valueClassName="text-[22px] font-semibold leading-none text-slate-900" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-10 flex w-full justify-center">
                      <div className="flex items-center justify-center gap-6">
                        {(["cash", "transfer", "card"] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setCart((prev) => setPaymentMethodService(prev, method))}
                            className="inline-flex h-7 items-center justify-center whitespace-nowrap bg-black px-1.5 text-[13px] font-normal text-white transition"
                          >
                            {layout2PaymentLabel(method)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => openDiscount({ kind: "order" })}
                          className="inline-flex h-7 items-center justify-center whitespace-nowrap bg-black px-1.5 text-[13px] font-normal text-white transition"
                        >
                          {t(lang, "pos.button.order_discount")}
                        </button>
                      </div>
                    </div>
                    <div className={`${layout2MetricWrapClass} mt-10 gap-4`}>
                      <div className="space-y-4">
                        <div className={layout2MetricRowClass}>
                          <div className="min-w-[56px] text-[14px] text-slate-900">{t(lang, "pos.field.received_amount")}</div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-[11px] font-semibold text-slate-400">$</span>
                            <input
                              data-cashier-focus-unlocked="true"
                              value={cart.payment.received > 0 ? String(cart.payment.received) : ""}
                              onChange={(event) => setCart((prev) => setReceivedAmountService(prev, Number(event.target.value || 0)))}
                              disabled={cart.payment.method !== "cash"}
                              placeholder="0.00"
                              className="w-[116px] bg-transparent p-0 text-[22px] font-semibold leading-none text-slate-900 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
                            />
                            <span className="text-[11px] font-semibold text-slate-400">MX</span>
                          </div>
                        </div>
                        <div className={layout2MetricRowClass}>
                          <div className="min-w-[56px] text-[14px] text-slate-900">{t(lang, "pos.field.change")}</div>
                          <div>
                            <CurrencyParts value={cashierChange} symbolClassName="text-[11px] font-semibold text-slate-400" valueClassName="text-[22px] font-semibold leading-none text-slate-900" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={headerMetricCardClass}>
                      <div className={`${fullscreenText.fieldLabel} text-slate-900`}>{t(lang, "pos.field.product")}</div>
                      <div className={`mt-1 font-semibold text-slate-900 ${fullscreenText.fieldValue}`}>{cart.lines.length}</div>
                    </div>
                    <div className={headerMetricCardClass}>
                      <div className={`${fullscreenText.fieldLabel} text-slate-900`}>{t(lang, "pos.field.quantity")}</div>
                      <div className={`mt-1 font-semibold text-slate-900 ${fullscreenText.fieldValue}`}>{itemCount}</div>
                    </div>
                    <div className={headerMetricCardClass}>
                      <div className="mt-0.5">
                        <div className={`${fullscreenText.fieldLabel} text-slate-900`}>{t(lang, "pos.field.total")}</div>
                        <CurrencyParts value={total} symbolClassName={`${fullscreenText.fieldLabel} font-semibold text-slate-400`} valueClassName={`${fullscreenText.fieldValue} font-semibold text-primary`} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className={cartAreaClass}>
                {cashierLayout2Active ? (
                  <div className="h-full" />
                ) : cart.lines.length === 0 ? (
                  <div className={`flex h-full min-h-[220px] items-center justify-center px-6 text-center text-slate-400 ${fullscreenText.empty}`}>
                    {lang === "zh"
                      ? "请扫产品条形码或搜索商品编号，商品名称加入商品。"
                      : "Escanea el código de barras o busca por código/nombre para agregar productos."}
                  </div>
                ) : (
                  <div className="space-y-1.5 p-2">
                    {cart.lines.map((item) => (
                      <div key={item.lineId} className={cartLineCardClass}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className={`truncate font-semibold text-slate-900 ${fullscreenText.cartName}`}>{lang === "zh" ? item.nameCn : item.nameEs}</div>
                            <div className={`mt-0.5 truncate text-slate-400 ${fullscreenText.cartMeta}`}>{item.clave} / {item.barcode}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <div className={`inline-flex h-7 items-center overflow-hidden ${cashierLayout2Active ? "rounded-2xl bg-slate-100" : "rounded-lg bg-slate-50"}`}>
                              <button type="button" onClick={() => updateItemQty("cashier", item.lineId, item.qty - 1)} className="inline-flex h-7 w-6 items-center justify-center bg-transparent text-slate-600 transition hover:bg-slate-100">-</button>
                              <input data-cashier-focus-unlocked="true" value={item.qty} onChange={(event) => updateItemQty("cashier", item.lineId, Number(event.target.value || 1))} className={`h-7 w-8 bg-transparent px-1 text-center outline-none ${fullscreenText.qtyInput}`} />
                              <button type="button" onClick={() => updateItemQty("cashier", item.lineId, item.qty + 1)} className="inline-flex h-7 w-6 items-center justify-center bg-transparent text-slate-600 transition hover:bg-slate-100">+</button>
                            </div>
                            <button
                              type="button"
                              onClick={() => openDiscount({ kind: "line", lineId: item.lineId })}
                              className={`inline-flex h-7 items-center justify-center ${cashierLayout2Active ? "rounded-2xl bg-slate-100" : "rounded-lg bg-slate-50"} px-2 font-semibold text-slate-600 transition hover:bg-slate-100 ${fullscreenText.control}`}
                            >
                              {item.lineDiscount
                                ? item.lineDiscount.type === "percent"
                                  ? `${item.lineDiscount.value}%`
                                  : formatCurrency(lang, item.lineDiscount.value)
                                : lang === "zh" ? "折扣" : "Desc."}
                            </button>
                            <div className="min-w-[68px] text-right">
                              <CurrencyParts value={item.subtotal} symbolClassName={`${fullscreenText.amountSymbol} font-semibold text-slate-400`} valueClassName={`${fullscreenText.amountValue} font-semibold text-slate-900`} />
                            </div>
                            <button type="button" onClick={() => removeItem("cashier", item.lineId)} className="inline-flex h-7 w-6 items-center justify-center rounded-lg bg-transparent text-sm font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">×</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                <div className={cashierLayout2Active ? "mt-2 space-y-2 bg-secondary-accent px-3 pb-3 pt-20" : "mt-2 space-y-2"}>
                {!cashierLayout2Active ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className={totalsCardClass}>
                      <div className={`${cashierLayout2Active ? "text-slate-900" : "text-slate-500"} ${fullscreenText.fieldLabel}`}>{t(lang, "pos.field.subtotal")}</div>
                      <div className="mt-0.5">
                        <CurrencyParts value={subtotal} symbolClassName={`${fullscreenText.amountSymbol} font-semibold text-slate-400`} valueClassName={`${fullscreenText.amountValue} font-semibold text-slate-900`} />
                      </div>
                    </div>
                    <div className={totalsCardClass}>
                      <div className={`${cashierLayout2Active ? "text-slate-900" : "text-slate-500"} ${fullscreenText.fieldLabel}`}>{t(lang, "pos.field.discount")}</div>
                      <div className="mt-0.5">
                        <CurrencyParts value={lineDiscount + orderDiscount} symbolClassName={`${fullscreenText.amountSymbol} font-semibold text-slate-400`} valueClassName={`${fullscreenText.amountValue} font-semibold text-slate-900`} />
                      </div>
                    </div>
                    <div className={totalsCardClass}>
                      <div className={`${cashierLayout2Active ? "text-slate-900" : "text-slate-500"} ${fullscreenText.fieldLabel}`}>{t(lang, "pos.field.total")}</div>
                      <div className="mt-0.5">
                        <CurrencyParts value={total} symbolClassName={`${fullscreenText.amountSymbol} font-semibold text-slate-400`} valueClassName={`${fullscreenText.totalValue} font-semibold text-primary`} />
                      </div>
                    </div>
                  </div>
                ) : null}

                {!cashierLayout2Active ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      data-cashier-focus-unlocked="true"
                      value={cart.payment.received > 0 ? String(cart.payment.received) : ""}
                      onChange={(event) => setCart((prev) => setReceivedAmountService(prev, Number(event.target.value || 0)))}
                      disabled={cart.payment.method !== "cash"}
                      placeholder={t(lang, "pos.field.received_amount")}
                      className={`${inputShellClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70`}
                    />
                    <div className={`flex ${cashierLayout2Active ? "h-9" : "h-8 rounded-lg border border-slate-300"} items-center justify-between bg-transparent px-3 ${cashierLayout2Active ? cashierActionTextClass : fullscreenText.input}`}>
                      <span className={cashierLayout2Active ? "text-slate-900" : "text-slate-500"}>{t(lang, "pos.field.change")}</span>
                      <CurrencyParts value={cashierChange} symbolClassName={`${fullscreenText.amountSymbol} font-semibold text-slate-400`} valueClassName="font-semibold text-slate-900" />
                    </div>
                  </div>
                ) : null}

                {cashierLayout2Active ? null : (
                  <div className="grid grid-cols-5 gap-1.5">
                    {(["cash", "transfer", "card"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setCart((prev) => setPaymentMethodService(prev, method))}
                        className={`inline-flex items-center justify-center bg-transparent transition h-8 ${cashierActionTextClass} ${
                          cart.payment.method === method
                            ? "text-primary shadow-[0_1px_4px_rgba(15,23,42,0.14)]"
                            : "text-slate-700"
                        }`}
                      >
                        {paymentLabel(lang, method)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashierCustomerModalOpen(true)}
                      className={`inline-flex h-8 items-center justify-center bg-transparent text-slate-700 ${cashierActionTextClass}`}
                    >
                      <span className="truncate">{customerSummary || cart.customer.notes || (lang === "zh" ? "客户信息" : t(lang, "pos.button.customer_note"))}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDiscount({ kind: "order" })}
                      className={`inline-flex h-8 items-center justify-center bg-transparent text-slate-700 ${cashierActionTextClass}`}
                    >
                      {t(lang, "pos.button.order_discount")}
                    </button>
                  </div>
                )}

                <div className={`grid gap-1.5 ${cashierLayout2Active ? "grid-cols-6" : "grid-cols-5"}`}>
                  <button type="button" onClick={handleSuspend} className={secondaryActionClass}>{lang === "zh" && cashierLayout2Active ? "此单挂起" : t(lang, "pos.button.suspend")}</button>
                  <button type="button" onClick={clearCashierOrder} className={secondaryActionClass}>{t(lang, "pos.button.clear_order")}</button>
                  <button type="button" onClick={openOpeningCashModal} className={secondaryActionClass}>{openingCashLabel(lang)}</button>
                  <button type="button" onClick={openCashDrawerModal} className={secondaryActionClass}>{openDrawerLabel(lang)}</button>
                  {cashierLayout2Active ? (
                    <button
                      type="button"
                      onClick={() => setCashierCustomerModalOpen(true)}
                      className={secondaryActionClass}
                      aria-label={lang === "zh" ? "客户信息" : t(lang, "pos.button.customer_note")}
                    >
                      <img src="/icons/user.svg" alt={lang === "zh" ? "客户信息" : t(lang, "pos.button.customer_note")} className="h-6 w-6 object-contain" />
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void handleCharge()} disabled={!canCheckout || checkoutSubmitting} className={`${cashierLayout2Active ? "inline-flex h-9 items-center justify-center bg-primary text-white" : "inline-flex h-8 items-center justify-center rounded-lg bg-primary font-semibold text-white shadow-soft"} disabled:cursor-not-allowed disabled:opacity-70 ${cashierActionTextClass}`}>{lang === "zh" ? "收款" : t(lang, "pos.button.charge")}</button>
                </div>
              </div>
            </PosSectionCard>
          </div>

          <div className={`min-h-0 ${cashierColumnHeightClass} xl:overflow-hidden`}>
            <PosSectionCard
              title=""
              description=""
              className={rightCardShellClass}
            >
              <div className={rightInnerShellClass}>
                {cashierLayout2Active ? (
                  <div className="mb-5 px-1">
                    <div className="text-[56px] font-semibold leading-none tracking-[-0.04em] text-white">
                      {storeSnapshot.storeContext.storeName}
                    </div>
                  </div>
                ) : null}

                <div className={`grid gap-2 ${cashierLayout2Active ? "xl:grid-cols-[minmax(480px,1fr)_minmax(240px,0.45fr)_36px]" : "xl:grid-cols-[minmax(520px,1fr)_minmax(260px,0.5fr)_32px]"}`}>
                  <div className="relative">
                    <input
                      ref={cashierBarcodeInputRef}
                      data-cashier-focus-unlocked="true"
                      autoFocus
                      value={cashierSearch.barcode}
                      onChange={(event) => {
                        setCashierSearch((prev) => ({ ...prev, barcode: event.target.value }));
                        setCashierResults([]);
                      }}
                      onPaste={(event) => {
                        const text = event.clipboardData?.getData("text") || "";
                        if (!text) return;
                        event.preventDefault();
                        setCashierSearch((prev) => ({ ...prev, barcode: `${prev.barcode}${text.trim()}` }));
                        setCashierResults([]);
                      }}
                      onBeforeInput={(event) => {
                        const native = event.nativeEvent as InputEvent;
                        const text = typeof native.data === "string" ? native.data : "";
                        if (!text.trim()) return;
                        event.preventDefault();
                        setCashierSearch((prev) => ({ ...prev, barcode: `${prev.barcode}${text}` }));
                        setCashierResults([]);
                      }}
                      onCompositionEnd={(event) => {
                        const text = event.data || "";
                        if (!text.trim()) return;
                        setCashierSearch((prev) => ({ ...prev, barcode: `${prev.barcode}${text}` }));
                        setCashierResults([]);
                      }}
                      onBlur={refocusCashierBarcodeUnlessUnlocked}
                      onKeyDown={(event) => {
                        if (event.defaultPrevented) return;
                        if (event.ctrlKey || event.metaKey || event.altKey) return;
                        if (event.key === "Backspace") {
                          event.preventDefault();
                          barcodeKeyHandledRef.current = { key: "Backspace", code: event.code || "", at: Date.now() };
                          setCashierSearch((prev) => ({ ...prev, barcode: prev.barcode.slice(0, -1) }));
                          setCashierResults([]);
                          return;
                        }
                        if (event.key === "Delete") {
                          event.preventDefault();
                          barcodeKeyHandledRef.current = { key: "Delete", code: event.code || "", at: Date.now() };
                          setCashierSearch((prev) => ({ ...prev, barcode: "" }));
                          setCashierResults([]);
                          return;
                        }
                        const key = resolveBarcodeKey(event);
                        if (key) {
                          event.preventDefault();
                          barcodeKeyHandledRef.current = { key, code: event.code || "", at: Date.now() };
                          setCashierSearch((prev) => ({ ...prev, barcode: `${prev.barcode}${key}` }));
                          setCashierResults([]);
                          return;
                        }
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void runSearch("cashier");
                        }
                      }}
                      placeholder={lang === "zh" ? "请输入商品编码 / 扫码" : "Ingresa codigo / escanea"}
                      className={`${searchInputClass} text-slate-900 caret-primary`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                      <Barcode className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="relative" data-cashier-focus-unlocked="true">
                    <input
                      data-cashier-focus-unlocked="true"
                      value={cashierSearch.query}
                      onChange={(event) => {
                        setCashierSearch((prev) => ({ ...prev, query: event.target.value }));
                        setCashierResults([]);
                      }}
                      onPaste={(event) => {
                        const text = event.clipboardData?.getData("text") || "";
                        if (!text) return;
                        event.preventDefault();
                        setCashierSearch((prev) => ({ ...prev, query: `${prev.query}${text.trim()}` }));
                        setCashierResults([]);
                      }}
                      onBeforeInput={(event) => {
                        const native = event.nativeEvent as InputEvent;
                        const text = typeof native.data === "string" ? native.data : "";
                        if (!text.trim()) return;
                        event.preventDefault();
                        setCashierSearch((prev) => ({ ...prev, query: `${prev.query}${text}` }));
                        setCashierResults([]);
                      }}
                      onCompositionEnd={(event) => {
                        const text = event.data || "";
                        if (!text.trim()) return;
                        setCashierSearch((prev) => ({ ...prev, query: `${prev.query}${text}` }));
                        setCashierResults([]);
                      }}
                      onKeyDown={(event) => {
                        if (event.defaultPrevented) return;
                        if (event.ctrlKey || event.metaKey || event.altKey) return;
                        if (event.key === "Backspace") {
                          event.preventDefault();
                          setCashierSearch((prev) => ({ ...prev, query: prev.query.slice(0, -1) }));
                          setCashierResults([]);
                          return;
                        }
                        if (event.key === "Delete") {
                          event.preventDefault();
                          setCashierSearch((prev) => ({ ...prev, query: "" }));
                          setCashierResults([]);
                          return;
                        }
                        const key = resolveBarcodeKey(event);
                        if (key) {
                          event.preventDefault();
                          setCashierSearch((prev) => ({ ...prev, query: `${prev.query}${key}` }));
                          setCashierResults([]);
                          return;
                        }
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void runSearch("cashier");
                        }
                      }}
                      placeholder={t(lang, "pos.placeholder.cashier_search")}
                      className={searchInputClass}
                    />
                    <button type="button" onClick={() => void runSearch("cashier")} className="absolute inset-y-0 right-2 inline-flex items-center justify-center text-slate-400 transition hover:text-primary">
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleCashierFullscreen()}
                    aria-label={cashierFullscreenEnabled ? t(lang, "pos.button.exit_fullscreen") : t(lang, "pos.button.enter_fullscreen")}
                    title={cashierFullscreenEnabled ? t(lang, "pos.button.exit_fullscreen") : t(lang, "pos.button.enter_fullscreen")}
                    className={fullscreenButtonClass}
                  >
                    {cashierFullscreenEnabled ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {!cashierLayout2Active ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
                    {visibleCashierPrimaryCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => {
                          setCashierPrimaryCategory(category);
                          setCashierSecondaryCategory("");
                        }}
                        className={categoryButtonClass(cashierPrimaryCategory === category)}
                      >
                        {category}
                      </button>
                    ))}
                    {!cashierLayout2Active && extraCashierPrimaryCategories.length && visibleCashierPrimaryCategories.length < cashierPrimaryCategories.length ? (
                      <button
                        type="button"
                        onClick={() => setCashierCategoryModalOpen(true)}
                        className={categoryButtonClass(false)}
                      >
                        {lang === "zh" ? "更多分类" : "Más categorías"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className={`mt-5 min-h-0 flex-1 ${cashierLayout2Active ? "overflow-hidden" : "overflow-hidden pb-16"} p-1`}>
                  {cashierLayout2Active ? (
                    cart.lines.length === 0 ? (
                      <div className="flex h-full min-h-[220px] items-center justify-center text-center text-slate-400">
                        {lang === "zh"
                          ? "请先扫码或搜索商品，右侧会显示可加入购物车的商品。"
                          : "Escanea o busca un producto para mostrarlo aqui."}
                      </div>
                    ) : (
                      <div className="bg-transparent">
                        {layout2CartLines.map((item) => {
                          const itemProduct = products.find((product) =>
                            product.id === item.productId
                            || product.sourceProductId === item.productId
                            || product.clave === item.clave,
                          ) || cashierCatalogProducts.find((product) =>
                            product.id === item.productId
                            || product.sourceProductId === item.productId
                            || product.clave === item.clave,
                          ) || null;

                          return (
                          <div key={item.lineId} className={productCardShellClass}>
                            <div className={`grid ${layout2RowGridClass} items-center gap-3`}>
                              <div className={productImageWrapClass}>
                                <ProductImage
                                  src={itemProduct?.imageUrl}
                                  sku={item.clave}
                                  alt={lang === "zh" ? item.nameCn : item.nameEs}
                                  size={80}
                                  className={layout2ImageClass}
                                  imageClassName="h-full w-full object-contain"
                                  roundedClassName="rounded-none"
                                  frameClassName="border-0 bg-transparent shadow-none"
                                  placeholderClassName="border-0 bg-transparent"
                                />
                              </div>
                              <div className={`${layout2CodeClass} text-left text-slate-900`}>
                                {item.clave}
                              </div>
                              <div className={`truncate text-left text-slate-900 ${layout2NameClass}`}>
                                {lang === "zh" ? item.nameCn : item.nameEs}
                              </div>
                              <div className="flex items-center justify-center gap-3 text-slate-900">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    updateItemQty("cashier", item.lineId, item.qty + 1);
                                  }}
                                  className={`inline-flex h-8 items-center justify-center px-1 leading-none text-slate-900 ${layout2QtyClass}`}
                                >
                                  +
                                </button>
                                <div className={`min-w-[24px] text-center text-slate-900 ${layout2QtyClass}`}>{item.qty}</div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    updateItemQty("cashier", item.lineId, item.qty - 1);
                                  }}
                                  className={`inline-flex h-8 items-center justify-center px-1 leading-none text-slate-900 ${layout2QtyClass}`}
                                >
                                  -
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => openDiscount({ kind: "line", lineId: item.lineId })}
                                className="flex items-center justify-center gap-1 text-center text-slate-900"
                              >
                                <span className={`${layout2CodeClass} text-slate-900`}>
                                  {item.lineDiscount
                                    ? item.lineDiscount.type === "percent"
                                      ? `${item.lineDiscount.value}%`
                                      : formatCurrency(lang, item.lineDiscount.value)
                                    : lang === "zh" ? "折扣" : "Desc."}
                                </span>
                              </button>
                              <div className="flex items-center justify-end gap-4 text-right">
                                <span className="inline-flex items-baseline">
                                  <span className={`${layout2PriceSymbolClass} font-semibold text-slate-400`}>$</span>
                                  <span className={`${layout2PriceValueClass} text-slate-900`}>{item.unitPrice.toFixed(2)}</span>
                                  <span className={`ml-1 ${layout2PriceSymbolClass} font-semibold text-slate-400`}>MX</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeItem("cashier", item.lineId)}
                                  className={`inline-flex h-8 items-center justify-center px-1 leading-none text-slate-900 ${layout2DeleteClass}`}
                                >
                                  <span className="text-[14px] leading-none text-slate-900">X</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );})}
                      </div>
                    )
                  ) : (
                    productGrid.length === 0 ? (
                      <PosEmptyState
                        title={t(lang, "pos.empty.title")}
                        description={t(lang, "pos.empty.description")}
                      />
                    ) : (
                      <div className={`grid gap-2 sm:grid-cols-2 xl:grid-cols-4 ${productGridClass}`}>
                        {productGrid.map((item) => (
                          <button key={item.id} type="button" onClick={() => addProductToCashierCart(item)} className={productCardShellClass}>
                            <div className="flex items-start gap-2.5">
                              <div className={productImageWrapClass}>
                                <ProductImage
                                  src={item.imageUrl}
                                  sku={item.clave}
                                  alt={lang === "zh" ? item.nameCn : item.nameEs}
                                  size={productImageSize}
                                  className={productImageClass}
                                  imageClassName="h-full w-full object-contain"
                                  roundedClassName="rounded-none"
                                  frameClassName="border-0 bg-transparent shadow-none"
                                  placeholderClassName="border-0 bg-transparent"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={`line-clamp-2 font-semibold text-slate-800 ${fullscreenText.productName}`}>{lang === "zh" ? (item.nameCn || item.nameEs) : (item.nameEs || item.nameCn)}</div>
                                <div className={`mt-1 text-slate-400 ${fullscreenText.productCode}`}>{item.clave}</div>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <div>
                                    <CurrencyParts value={item.price} symbolClassName={`${fullscreenText.productPriceSymbol} font-semibold text-slate-400`} valueClassName={`${fullscreenText.productPriceValue} font-semibold text-primary`} />
                                  </div>
                                  {item.inventoryManaged === false ? (
                                    <span className={`shrink-0 ${fullscreenText.productStock} font-semibold text-sky-600`}>
                                      {lang === "zh" ? "友购" : "Yogo"}
                                    </span>
                                  ) : (
                                    <span className={`shrink-0 ${fullscreenText.productStock} font-semibold ${item.stock <= 0 ? "text-rose-600" : item.stock <= 20 ? "text-amber-700" : "text-emerald-600"}`}>
                                      {item.stock <= 0 ? t(lang, "pos.status.out_of_stock") : item.stock <= 20 ? t(lang, "pos.status.low_inventory") : t(lang, "pos.status.inventory_ok")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
                <div className={`${cashierLayout2Active ? "mt-5 flex shrink-0 translate-y-4 items-end justify-between gap-3" : "absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-white pt-2"}`}>
                  <div className={`flex flex-wrap gap-2 ${cashierLayout2Active ? "items-end" : "items-center"}`}>
                    <div className={`inline-flex gap-1 ${cashierLayout2Active ? "items-end" : "items-center"}`}>
                      <button
                        type="button"
                        onClick={() => setCashierViewMode("layout1")}
                        className={`inline-flex ${cashierLayout2Active ? "h-9 items-end" : "h-6 items-center"} justify-center px-2.5 ${cashierLayout2Active ? cashierFooterTextClass : fullscreenText.category} font-semibold leading-none transition ${
                          cashierViewMode === "layout1" ? "text-primary" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {lang === "zh" ? "界面一" : "Vista 1"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashierViewMode("layout2")}
                        className={`inline-flex ${cashierLayout2Active ? "h-9 items-end" : "h-6 items-center"} justify-center px-2.5 ${cashierLayout2Active ? cashierFooterTextClass : fullscreenText.category} font-semibold leading-none transition ${
                          cashierViewMode === "layout2" ? "text-primary" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {lang === "zh" ? "界面二" : "Vista 2"}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCashierSyncYogoProducts((value) => !value)}
                      className={`inline-flex gap-2 px-1 transition ${cashierLayout2Active ? "h-9 items-end" : "h-6 items-center"}`}
                    >
                      <span className={`font-semibold leading-none text-slate-700 ${cashierLayout2Active ? cashierFooterTextClass : fullscreenText.category}`}>
                        {lang === "zh" ? "同步友购产品" : "Sincronizar Yogo"}
                      </span>
                      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${cashierSyncYogoProducts ? "bg-primary" : "bg-slate-200"}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${cashierSyncYogoProducts ? "translate-x-4" : "translate-x-0.5"}`} />
                      </span>
                    </button>
                  </div>

                  {(!cashierLayout2Active || layout2CartTotalPages > 1) ? (
                  <div className={`flex items-center gap-2 font-semibold text-slate-500 ${fullscreenText.pager}`}>
                    <button
                      type="button"
                      onClick={() => cashierLayout2Active ? setLayout2CartPage((page) => Math.max(1, page - 1)) : setCashierProductPage((page) => Math.max(1, page - 1))}
                      disabled={cashierLayout2Active ? layout2CartCurrentPage <= 1 : cashierProductCurrentPage <= 1}
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <span>{cashierLayout2Active ? layout2CartCurrentPage : cashierProductCurrentPage} / {cashierLayout2Active ? layout2CartTotalPages : cashierProductTotalPages}</span>
                    <button
                      type="button"
                      onClick={() => cashierLayout2Active ? setLayout2CartPage((page) => Math.min(layout2CartTotalPages, page + 1)) : setCashierProductPage((page) => Math.min(cashierProductTotalPages, page + 1))}
                      disabled={cashierLayout2Active ? layout2CartCurrentPage >= layout2CartTotalPages : cashierProductCurrentPage >= cashierProductTotalPages}
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                  ) : <div />}
                </div>
              </div>
            </PosSectionCard>
          </div>
        </div>
        )}
      </div>
    );
  }

  function renderSuspended() {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <PosSectionCard title={t(lang, "pos.section.list")}>
            {suspendedFiltered.length === 0 ? (
              <PosEmptyState
                title={t(lang, "pos.empty.suspended_title")}
                description={t(lang, "pos.empty.suspended_description")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[10%]" />
                    <col className="w-[6%]" />
                    <col className="w-[12%]" />
                    <col className="w-[18%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[19%]" />
                  </colgroup>
                  <thead className="bg-slate-50">
                    <tr>
                      {[t(lang, "pos.field.folio"), t(lang, "pos.field.customer"), t(lang, "pos.field.article_count"), t(lang, "pos.field.total"), t(lang, "pos.field.datetime"), t(lang, "pos.field.cashier"), t(lang, "pos.field.status"), t(lang, "pos.field.actions")].map((header) => (
                        <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suspendedFiltered.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedSuspendedOrderId(item.id)}
                        className={`cursor-pointer border-t border-slate-100 transition ${
                          selectedSuspendedOrderId === item.id ? "bg-primary/5" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.folio}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.customer.name}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.lines.reduce((sum, row) => sum + row.qty, 0)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(lang, item.total)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDateTime(lang, item.createdAt)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.cashierName}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{recordStatusLabel(lang, item.status)}</td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedSuspendedOrderId(item.id);
                                setResumeTarget(item);
                              }}
                              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                            >
                              {t(lang, "pos.button.resume")}
                            </button>
                            <button
                              type="button"
                              onClick={async (event) => {
                                event.stopPropagation();
                                try {
                                  await deletePosSuspendedOrderService(item.id);
                                  setSuspendedOrders((prev) => prev.filter((row) => row.id !== item.id));
                                  if (selectedSuspendedOrderId === item.id) {
                                    setSelectedSuspendedOrderId(null);
                                  }
                                } catch (error) {
                                  setErrorMessage(error instanceof Error ? error.message : String(error));
                                }
                              }}
                              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                            >
                              {t(lang, "pos.button.delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PosSectionCard>
          <PosSectionCard title={t(lang, "pos.section.detail")}>
            {selectedSuspendedOrder ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{selectedSuspendedOrder.folio}</div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{selectedSuspendedOrder.customer.name || "-"}</div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{formatCurrency(lang, selectedSuspendedOrder.total)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {selectedSuspendedOrder.note || "-"}
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full table-fixed">
                    <colgroup>
                      <col className="w-[58%]" />
                      <col className="w-[10%]" />
                      <col className="w-[16%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(lang, "pos.field.product")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(lang, "pos.field.quantity")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(lang, "pos.field.unit_price")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(lang, "pos.field.subtotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSuspendedOrder.lines.map((line) => (
                        <tr key={line.lineId} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-sm text-slate-700">
                            <div className="font-semibold text-slate-900">{line.clave || line.barcode || "-"}</div>
                            <div className="mt-1 truncate">{line.nameCn || line.nameEs || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{line.qty}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(lang, line.unitPrice)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(lang, line.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <PosEmptyState title={t(lang, "pos.empty.detail_title")} description={t(lang, "pos.empty.detail_description")} />
            )}
          </PosSectionCard>
        </div>
      </div>
    );
  }

  function renderQuote() {
    const subtotal = getQuoteSubtotal();
    const discount = getQuoteLineDiscount() + getQuoteOrderDiscount();
    const total = getQuoteTotal();
    const quoteProducts = (quoteSearch.barcode.trim() || quoteSearch.query.trim() ? quoteResults : products).slice(0, 24);
    return (
      <div className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.quote.subtitle")}>
              <div className="grid gap-2 lg:grid-cols-[164px_minmax(0,1fr)_auto_auto]">
                <div className="relative">
                  <input
                    value={quoteSearch.barcode}
                    onChange={(event) => setQuoteSearch((prev) => ({ ...prev, barcode: event.target.value }))}
                    placeholder=""
                    className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-xs outline-none focus:border-primary"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <Barcode className="h-4 w-4" />
                  </span>
                </div>
                <div className="relative">
                  <input
                    value={quoteSearch.query}
                    onChange={(event) => setQuoteSearch((prev) => ({ ...prev, query: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void runSearch("quote");
                      }
                    }}
                    placeholder={t(lang, "pos.placeholder.quote_search")}
                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary"
                  />
                </div>
                <button type="button" onClick={() => void runSearch("quote")} className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-[11px] font-semibold text-white">
                  {t(lang, "common.search")}
                </button>
                <button
                  type="button"
                  onClick={() => quoteImportFileRef.current?.click()}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
                >
                  {t(lang, "pos.button.quote_batch_upload")}
                </button>
              </div>
              <input
                ref={quoteImportFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleQuoteBatchUpload(file);
                  event.currentTarget.value = "";
                }}
              />
            </PosSectionCard>

            <PosSectionCard title={t(lang, "pos.section.search_results")} description={t(lang, "pos.page.quote.subtitle")}>
              {quoteProducts.length === 0 ? (
                <PosEmptyState title={t(lang, "pos.empty.title")} description={t(lang, "pos.empty.description")} />
              ) : (
                <div className="grid auto-rows-[118px] gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {quoteProducts.map((item) => (
                    <button key={item.id} type="button" onClick={() => addProductToQuoteCart(item)} className="h-[118px] rounded-lg bg-white p-2.5 text-left shadow-[0_0_0_1px_rgba(15,23,42,0.035),0_0_6px_rgba(15,23,42,0.08)] transition hover:shadow-[0_0_0_1px_rgba(15,23,42,0.045),0_0_8px_rgba(15,23,42,0.1)]">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-transparent shadow-[0_1px_5px_rgba(15,23,42,0.10)]">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.nameCn || item.nameEs} className="h-full w-full object-contain" /> : <div className="text-[10px] text-slate-300">IMG</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[11px] font-semibold leading-4 text-slate-800">{item.nameCn || item.nameEs}</div>
                          <div className="mt-1 text-[10px] text-slate-400">{item.clave}</div>
                          <div className="mt-1">
                            <CurrencyParts value={item.price} symbolClassName="text-[10px] font-semibold text-slate-400" valueClassName="text-[11px] font-semibold text-primary" />
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </PosSectionCard>
          </div>

          <div className="space-y-3">
            <PosSectionCard title={t(lang, "pos.section.quote_detail")} description={t(lang, "pos.page.quote.subtitle")}>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={quoteCart.customer.name} onChange={(event) => setQuoteCart((prev) => setCustomerField(prev, "name", event.target.value))} placeholder={t(lang, "pos.field.customer")} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary" />
                <input value={quoteCart.customer.phone} onChange={(event) => setQuoteCart((prev) => setCustomerField(prev, "phone", event.target.value))} placeholder={t(lang, "pos.field.phone")} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary" />
              </div>
              <textarea value={quoteCart.customer.notes} onChange={(event) => setQuoteCart((prev) => setCustomerField(prev, "notes", event.target.value))} placeholder={t(lang, "pos.field.remark")} className="mt-2 min-h-[72px] w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-primary" />
            </PosSectionCard>
            <PosSectionCard title={t(lang, "pos.section.cart_items")}>
              {renderCartTable(quoteCart.lines, "quote")}
            </PosSectionCard>
            <PosSectionCard title={t(lang, "pos.section.settlement_summary")}>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-xs text-slate-500">{t(lang, "pos.field.subtotal")}</span><span className="text-xs font-semibold text-slate-900">{formatCurrency(lang, subtotal)}</span></div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-xs text-slate-500">{t(lang, "pos.field.discount")}</span><span className="text-xs font-semibold text-slate-900">{formatCurrency(lang, discount)}</span></div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-xs text-slate-500">{t(lang, "pos.field.total")}</span><span className="text-sm font-semibold text-primary">{formatCurrency(lang, total)}</span></div>
                <button type="button" onClick={() => openDiscount({ kind: "quote_order" })} className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700">{t(lang, "pos.button.order_discount")}</button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={saveQuote} className="inline-flex h-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white shadow-soft">{t(lang, "pos.button.save_quote")}</button>
                  <button type="button" onClick={clearQuoteDraft} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700">{t(lang, "pos.button.clear_order")}</button>
                </div>
              </div>
            </PosSectionCard>
          </div>
        </div>

        <PosSectionCard title={t(lang, "pos.section.list")}>
          <div className="mb-3 flex flex-wrap gap-2">
            <input value={quoteKeyword} onChange={(event) => setQuoteKeyword(event.target.value)} placeholder={t(lang, "pos.placeholder.quote_filter")} className="h-8 min-w-[260px] rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary" />
          </div>
          {quotesFiltered.length === 0 ? (
            <PosEmptyState title={t(lang, "pos.empty.quote_title")} description={t(lang, "pos.empty.quote_description")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    {[t(lang, "pos.field.folio"), t(lang, "pos.field.customer"), t(lang, "pos.field.total"), t(lang, "pos.field.datetime"), t(lang, "pos.field.status"), t(lang, "pos.field.actions")].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotesFiltered.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.folio}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.customer.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(lang, item.total)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDateTime(lang, item.createdAt)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{recordStatusLabel(lang, item.status)}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => quoteToCashier(item)} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">{t(lang, "pos.button.to_cashier")}</button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deletePosQuoteService(item.id);
                                setQuotes((prev) => prev.filter((row) => row.id !== item.id));
                              } catch (error) {
                                setErrorMessage(error instanceof Error ? error.message : String(error));
                              }
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          >
                            {t(lang, "pos.button.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PosSectionCard>
      </div>
    );
  }

  function renderProductsPrices() {
    return (
      <div className="space-y-5">
        <PosSectionCard title={t(lang, "pos.section.actions")} description={t(lang, "pos.page.products_prices.future")}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">{t(lang, "pos.button.sync")}</button>
            <button type="button" className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">{t(lang, "pos.button.import")}</button>
            <button type="button" className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">{t(lang, "pos.button.export")}</button>
            {canLabelPrint ? (
              <button
                type="button"
                onClick={() => openLabelPrint("products", buildLabelItemsFromProducts(selectedProductRows))}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white"
              >
                {t(lang, "pos.button.print_labels")}
              </button>
            ) : null}
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.section.filters")}>
          <PosFilterBar items={[t(lang, "pos.field.product_code"), t(lang, "pos.field.barcode"), t(lang, "pos.field.keyword"), t(lang, "pos.field.status")]} />
        </PosSectionCard>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
          <table className="min-w-full table-fixed">
            <thead className="bg-slate-50">
              <tr>
                {["", t(lang, "pos.field.product_code"), t(lang, "pos.field.barcode"), t(lang, "pos.field.product"), t(lang, "pos.field.unit_price"), t(lang, "pos.field.inventory_status"), t(lang, "pos.field.actions")].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(item.id)}
                      onChange={() => toggleSelection("products", item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.clave}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.barcode}</td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">{lang === "zh" ? item.nameCn : item.nameEs}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.spec}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(lang, item.price)}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.stock <= 20 ? t(lang, "pos.status.low_inventory") : t(lang, "pos.status.enabled")}</td>
                  <td className="px-4 py-4">
                    {canLabelPrint ? (
                      <button
                        type="button"
                        onClick={() => openLabelPrint("products", buildLabelItemsFromProducts([item]))}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                      >
                        {t(lang, "pos.button.print_label")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          <PosSectionCard title={t(lang, "pos.section.form_placeholder")} description={t(lang, "pos.page.products_prices.future")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-11 rounded-xl border border-slate-200 bg-slate-50" />
              ))}
            </div>
          </PosSectionCard>
          <PosSectionCard title={t(lang, "pos.section.mapping_tip")} description={t(lang, "pos.page.products_prices.future")}>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.page.products_prices.future")}</div>
          </PosSectionCard>
        </div>
      </div>
    );
  }

  function renderStoreInventory() {
    return (
      <div className="space-y-5">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.store_inventory.future")}>
          <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <select
              value={inventoryFilters.storeId}
              onChange={(event) => setInventoryFilters((prev) => ({ ...prev, storeId: event.target.value, page: 1 }))}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            >
              {posAccess.allowAllStores ? <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option> : null}
              {storeOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input
              value={inventoryFilters.keyword}
              onChange={(event) => setInventoryFilters((prev) => ({ ...prev, keyword: event.target.value, page: 1 }))}
              placeholder={t(lang, "pos.field.keyword")}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <input
              value={inventoryFilters.clave}
              onChange={(event) => setInventoryFilters((prev) => ({ ...prev, clave: event.target.value, page: 1 }))}
              placeholder={t(lang, "pos.field.product_code")}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <input
              value={inventoryFilters.barcode}
              onChange={(event) => setInventoryFilters((prev) => ({ ...prev, barcode: event.target.value, page: 1 }))}
              placeholder={t(lang, "pos.field.barcode")}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <select
              value={inventoryFilters.status}
              onChange={(event) => setInventoryFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.status")}</option>
              <option value="ok">{t(lang, "pos.status.inventory_ok")}</option>
              <option value="low">{t(lang, "pos.status.low_inventory")}</option>
              <option value="out">{t(lang, "pos.status.out_of_stock")}</option>
            </select>
            <label className="inline-flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={inventoryFilters.lowStockOnly}
                onChange={(event) => setInventoryFilters((prev) => ({ ...prev, lowStockOnly: event.target.checked, page: 1 }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span>{t(lang, "pos.field.low_stock_only")}</span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadInventory()}
              disabled={inventoryLoading}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inventoryLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
            {canInventoryExport ? (
              <button
                type="button"
                onClick={() => void handleExportInventory()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {t(lang, "pos.button.export_current")}
              </button>
            ) : null}
            {canLabelPrint ? (
              <button
                type="button"
                onClick={() => openLabelPrint("inventory", buildLabelItemsFromInventory(selectedInventoryRows))}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                {t(lang, "pos.button.print_labels")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const next = {
                  storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
                  keyword: "",
                  clave: "",
                  barcode: "",
                  status: "",
                  lowStockOnly: false,
                  page: 1,
                  limit: 20,
                };
                setInventoryFilters(next);
                void loadInventory(next);
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              {t(lang, "common.cancel")}
            </button>
          </div>
        </PosSectionCard>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
          <table className="min-w-full table-fixed">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "",
                  t(lang, "pos.field.product"),
                  t(lang, "pos.field.product_code"),
                  t(lang, "pos.field.barcode"),
                  t(lang, "pos.field.store"),
                  t(lang, "pos.field.inventory_on_hand"),
                  t(lang, "pos.field.inventory_available"),
                  t(lang, "pos.field.status"),
                  t(lang, "pos.field.actions"),
                ].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedInventoryIds.includes(item.id)}
                      onChange={() => toggleSelection("inventory", item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">{item.productName}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.spec || "-"}</div>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.clave}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.barcode || "-"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.storeId}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.onHandQty}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.availableQty}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{inventoryStatusLabel(lang, item.status)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void openInventoryDetail(item.id)}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                      >
                        {t(lang, "pos.button.view_detail")}
                      </button>
                      {canInventoryAdjust ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget(item);
                            setAdjustForm({
                              adjustType: "increase",
                              qty: 1,
                              reason: "",
                              note: "",
                              operator: "",
                            });
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                        >
                          {t(lang, "pos.button.adjust_inventory")}
                        </button>
                      ) : null}
                      {canInventoryCount ? (
                        <button
                          type="button"
                          onClick={() => openInventoryCount(item)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                        >
                          {t(lang, "pos.button.count_inventory")}
                        </button>
                      ) : null}
                      {canInventoryDamage ? (
                        <button
                          type="button"
                          onClick={() => openInventoryDamage(item)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                        >
                          {t(lang, "pos.button.damage_inventory")}
                        </button>
                      ) : null}
                      {canLabelPrint ? (
                        <button
                          type="button"
                          onClick={() => openLabelPrint("inventory", buildLabelItemsFromInventory([item]))}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                        >
                          {t(lang, "pos.button.print_label")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr_0.9fr]">
          <PosSectionCard title={t(lang, "pos.section.low_inventory_panel")} description={t(lang, "pos.status.low_inventory")}>
            <div className="space-y-3">
              {inventoryOverview?.lowStockItems?.length ? inventoryOverview.lowStockItems.slice(0, 4).map((item) => (
                <div key={`${item.storeId}-${item.productId}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-700">{item.productName}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.availableQty}</div>
                </div>
              )) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "common.na")}</div>
              )}
            </div>
          </PosSectionCard>
          <PosSectionCard title={t(lang, "pos.section.adjust_entry")} description={t(lang, "pos.button.adjust_inventory")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.field.adjust_type")}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.field.adjust_qty")}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.field.reason_adjust")}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.field.remark")}</div>
            </div>
          </PosSectionCard>
          <PosSectionCard title={t(lang, "pos.section.detail")} description={t(lang, "pos.page.store_inventory.future")}>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.field.inventory_on_hand")}: {inventoryTotal}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.field.low_stock_count")}: {inventoryOverview?.lowStockCount || 0}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "pos.field.out_of_stock_count")}: {inventoryOverview?.outOfStockCount || 0}</div>
            </div>
          </PosSectionCard>
        </div>
      </div>
    );
  }

  function renderInventoryMovement() {
    return (
      <div className="space-y-5">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.inventory_movement.future")}>
          <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-5">
            <select
              value={inventoryMovementFilters.storeId}
              onChange={(event) => setInventoryMovementFilters((prev) => ({ ...prev, storeId: event.target.value, page: 1 }))}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            >
              {posAccess.allowAllStores ? <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option> : null}
              {storeOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input
              value={inventoryMovementFilters.dateFrom}
              onChange={(event) => setInventoryMovementFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))}
              type="date"
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <input
              value={inventoryMovementFilters.dateTo}
              onChange={(event) => setInventoryMovementFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))}
              type="date"
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <input
              value={inventoryMovementFilters.keyword}
              onChange={(event) => setInventoryMovementFilters((prev) => ({ ...prev, keyword: event.target.value, page: 1 }))}
              placeholder={t(lang, "pos.field.keyword")}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <select
              value={inventoryMovementFilters.moveType}
              onChange={(event) => setInventoryMovementFilters((prev) => ({ ...prev, moveType: event.target.value, page: 1 }))}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.move_type")}</option>
              <option value="sale">{inventoryMoveTypeLabel(lang, "sale")}</option>
              <option value="return">{inventoryMoveTypeLabel(lang, "return")}</option>
              <option value="adjust">{inventoryMoveTypeLabel(lang, "adjust")}</option>
              <option value="import">{inventoryMoveTypeLabel(lang, "import")}</option>
              <option value="count">{inventoryMoveTypeLabel(lang, "count")}</option>
              <option value="damage">{inventoryMoveTypeLabel(lang, "damage")}</option>
              <option value="transfer_out">{inventoryMoveTypeLabel(lang, "transfer_out")}</option>
              <option value="transfer_in">{inventoryMoveTypeLabel(lang, "transfer_in")}</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadInventoryMovements()}
              disabled={inventoryMovementLoading}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inventoryMovementLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
            {canReportExport ? (
              <button
                type="button"
                onClick={() => void handleExportInventoryMovements()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {t(lang, "pos.button.export_current")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const next = {
                  storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
                  keyword: "",
                  moveType: "",
                  dateFrom: getDefaultDateRange().dateFrom,
                  dateTo: getDefaultDateRange().dateTo,
                  page: 1,
                  limit: 20,
                };
                setInventoryMovementFilters(next);
                void loadInventoryMovements(next);
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              {t(lang, "common.cancel")}
            </button>
          </div>
        </PosSectionCard>

        <PosSectionCard title={t(lang, "pos.nav.inventory_movement")} description={t(lang, "pos.page.inventory_movement.future")}>
          <div className="mb-4 text-sm text-slate-500">{t(lang, "common.total")}: {inventoryMovementTotal}</div>
          {inventoryMovements.length === 0 ? (
            <PosEmptyState
              title={t(lang, "pos.empty.title")}
              description={t(lang, "pos.empty.description")}
              stage={t(lang, "pos.empty.stage")}
              future={t(lang, "pos.page.inventory_movement.future")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      t(lang, "pos.field.datetime"),
                      t(lang, "pos.field.product"),
                      t(lang, "pos.field.product_code"),
                      t(lang, "pos.field.store"),
                      t(lang, "pos.field.move_type"),
                      t(lang, "pos.field.quantity"),
                      t(lang, "pos.field.qty_before"),
                      t(lang, "pos.field.qty_after"),
                      t(lang, "pos.field.origin"),
                      t(lang, "pos.field.folio"),
                      t(lang, "pos.field.user"),
                      t(lang, "pos.field.remark"),
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventoryMovements.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDateTime(lang, item.createdAt)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.productName}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.clave}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.storeId}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{inventoryMoveTypeLabel(lang, item.moveType)}</td>
                      <td className={`px-4 py-4 text-sm font-semibold ${item.qtyChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{item.qtyChange}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.qtyBefore}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.qtyAfter}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.sourceType}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.sourceFolio || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.createdBy || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PosSectionCard>
      </div>
    );
  }

  function renderInventoryImport() {
    return (
      <div className="space-y-5">
        <PosSectionCard title={t(lang, "pos.section.actions")} description={t(lang, "pos.page.inventory_import.future")}>
          <div className="flex flex-wrap gap-3">
            {canImportInventory ? (
              <>
                <button
                  type="button"
                  onClick={() => void downloadPosInventoryImportTemplate(storeSnapshot.storeContext.storeId).catch((error) => {
                    setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
                  })}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {t(lang, "pos.button.download_template")}
                </button>
                <button
                  type="button"
                  onClick={() => inventoryImportFileRef.current?.click()}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {t(lang, "pos.button.import")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleInventoryImportPreview()}
                  disabled={!inventoryImportRows.length || inventoryImportLoading}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inventoryImportLoading ? t(lang, "common.loading") : t(lang, "pos.button.preview_import")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleInventoryImportCommit()}
                  disabled={!inventoryImportPreview || inventoryImportPreview.importableCount === 0 || inventoryImportPreview.invalidCount > 0 || inventoryImportSubmitting}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inventoryImportSubmitting ? t(lang, "common.processing") : t(lang, "pos.button.confirm_import")}
                </button>
              </>
            ) : (
              <div className="inline-flex h-10 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400">
                {t(lang, "pos.notice.permission_denied")}
              </div>
            )}
            <input
              ref={inventoryImportFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleInventoryImportFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {inventoryImportFileName || t(lang, "pos.page.inventory_import.future")}
          </div>
        </PosSectionCard>

        <PosStatsCards
          items={[
            { label: t(lang, "common.total"), hint: inventoryImportPreview ? String(inventoryImportPreview.total) : "0" },
            { label: t(lang, "pos.field.importable"), hint: inventoryImportPreview ? String(inventoryImportPreview.importableCount) : "0" },
            { label: t(lang, "pos.field.not_importable"), hint: inventoryImportPreview ? String(inventoryImportPreview.invalidCount) : "0" },
            { label: t(lang, "pos.field.import_result"), hint: inventoryImportResult ? String(inventoryImportResult.importedCount) : "0" },
          ]}
        />

        <PosSectionCard title={t(lang, "pos.field.import_preview")} description={t(lang, "pos.page.inventory_import.future")}>
          {!inventoryImportPreview?.items?.length ? (
            <PosEmptyState
              title={t(lang, "pos.empty.title")}
              description={t(lang, "pos.empty.description")}
              stage={t(lang, "pos.empty.stage")}
              future={t(lang, "pos.page.inventory_import.future")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    {["#", t(lang, "pos.field.store"), t(lang, "pos.field.product_code"), t(lang, "pos.field.barcode"), t(lang, "pos.field.product"), t(lang, "pos.field.import_qty"), t(lang, "pos.field.current_inventory"), t(lang, "pos.field.status"), t(lang, "pos.field.remark")].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventoryImportPreview.items.map((item) => (
                    <tr key={`${item.rowNumber}-${item.clave}-${item.barcode}`} className="border-t border-slate-100">
                      <td className="px-4 py-4 text-sm text-slate-700">{item.rowNumber}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.storeId || "-"}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.clave || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.barcode || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.productName || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.qty}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.currentQty ?? 0}</td>
                      <td className={`px-4 py-4 text-sm font-semibold ${item.canImport ? "text-emerald-600" : "text-rose-600"}`}>
                        {item.canImport ? t(lang, "pos.status.import_ready") : inventoryImportReasonLabel(lang, item.reason)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PosSectionCard>

        <PosSectionCard title={t(lang, "pos.field.import_result")} description={t(lang, "pos.status.move_import")}>
          {!inventoryImportResult?.items?.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">{t(lang, "common.na")}</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {t(lang, "pos.notice.import_success")}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed">
                  <thead className="bg-slate-50">
                    <tr>
                      {["#", t(lang, "pos.field.store"), t(lang, "pos.field.product"), t(lang, "pos.field.import_qty"), t(lang, "pos.field.qty_before"), t(lang, "pos.field.qty_after")].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryImportResult.items.map((item) => (
                      <tr key={`${item.rowNumber}-${item.productId}`} className="border-t border-slate-100">
                        <td className="px-4 py-4 text-sm text-slate-700">{item.rowNumber}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.storeId}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.productName}</td>
                        <td className="px-4 py-4 text-sm text-emerald-600">+{item.qtyChange}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.qtyBefore}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.qtyAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PosSectionCard>
      </div>
    );
  }

  function renderFinanceStats() {
    const trendMax = Math.max(...salesTrend.map((item) => item.netSalesTotal), 1);
    return (
      <div className="space-y-5">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.finance_stats.future")}>
          <div className="grid gap-3 lg:grid-cols-4">
            <select
              value={reportFilters.storeId}
              onChange={(event) => setReportFilters((prev) => ({ ...prev, storeId: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            >
              {posAccess.allowAllStores ? <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option> : null}
              {storeOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input value={reportFilters.dateFrom} onChange={(event) => setReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} type="date" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary" />
            <input value={reportFilters.dateTo} onChange={(event) => setReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))} type="date" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary" />
            <button type="button" onClick={() => void loadReportData()} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
              {reportsLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {canReportExport ? (
              <button
                type="button"
                onClick={() => void handleExportFinanceReport()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {t(lang, "pos.button.export_current")}
              </button>
            ) : null}
          </div>
        </PosSectionCard>

        <PosStatsCards
          items={[
            { label: t(lang, "pos.field.sales_total"), hint: dashboardSummary ? formatCurrency(lang, dashboardSummary.salesTotal) : t(lang, "common.loading") },
            { label: t(lang, "pos.field.refund_total"), hint: dashboardSummary ? formatCurrency(lang, dashboardSummary.refundTotal) : t(lang, "common.loading") },
            { label: t(lang, "pos.field.net_sales_total"), hint: dashboardSummary ? formatCurrency(lang, dashboardSummary.netSalesTotal) : t(lang, "common.loading") },
            { label: t(lang, "pos.field.avg_ticket"), hint: dashboardSummary ? formatCurrency(lang, dashboardSummary.avgTicket) : t(lang, "common.loading") },
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <PosSectionCard title={t(lang, "pos.field.payment_summary")} description={t(lang, "pos.page.finance_stats.future")}>
            <div className="space-y-3">
              {[
                [paymentLabel(lang, "cash"), paymentsSummary?.cashTotal || 0],
                [paymentLabel(lang, "transfer"), paymentsSummary?.transferTotal || 0],
                [paymentLabel(lang, "card"), paymentsSummary?.cardTotal || 0],
                [t(lang, "pos.field.refund_total"), paymentsSummary?.refundTotal || 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(lang, Number(value))}</span>
                </div>
              ))}
            </div>
          </PosSectionCard>

          <PosSectionCard title={t(lang, "pos.field.sales_trend")} description={t(lang, "pos.page.finance_stats.future")}>
            {salesTrend.length === 0 ? (
              <PosEmptyState title={t(lang, "pos.empty.title")} description={t(lang, "pos.empty.description")} stage={t(lang, "pos.empty.stage")} future={t(lang, "pos.field.sales_trend")} />
            ) : (
              <div className="grid h-[260px] grid-cols-7 items-end gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                {salesTrend.slice(-7).map((item) => (
                  <div key={item.bucket} className="flex h-full flex-col items-center justify-end gap-2">
                    <div className="flex h-full w-full items-end justify-center">
                      <div className="w-full rounded-t-xl bg-primary/80" style={{ height: `${Math.max(12, Math.round((item.netSalesTotal / trendMax) * 100))}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-500">{item.bucket.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </PosSectionCard>
        </div>
      </div>
    );
  }

  function renderInventoryStats() {
    return (
      <div className="space-y-5">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.inventory_stats.future")}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <select
              value={reportFilters.storeId}
              onChange={(event) => setReportFilters((prev) => ({ ...prev, storeId: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            >
              {posAccess.allowAllStores ? <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option> : null}
              {storeOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => void loadReportData()} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
              {reportsLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {canReportExport ? (
              <button
                type="button"
                onClick={() => void handleExportInventoryReport()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {t(lang, "pos.button.export_current")}
              </button>
            ) : null}
          </div>
        </PosSectionCard>

        <PosStatsCards
          items={[
            { label: t(lang, "pos.field.active_inventory_items"), hint: inventoryOverview ? String(inventoryOverview.totalActiveInventoryItems) : t(lang, "common.loading") },
            { label: t(lang, "pos.field.low_stock_count"), hint: inventoryOverview ? String(inventoryOverview.lowStockCount) : t(lang, "common.loading") },
            { label: t(lang, "pos.field.out_of_stock_count"), hint: inventoryOverview ? String(inventoryOverview.outOfStockCount) : t(lang, "common.loading") },
            { label: t(lang, "pos.field.top_products"), hint: topProductsReport ? String(topProductsReport.topByQty.length) : t(lang, "common.loading") },
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <PosSectionCard title={t(lang, "pos.field.top_products")} description={t(lang, "pos.page.inventory_stats.future")}>
            <div className="space-y-3">
              {topProductsReport?.topByQty?.length ? topProductsReport.topByQty.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{item.productName}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.clave}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-700">{item.qtyTotal}</div>
                    <div className="text-xs text-slate-400">{formatCurrency(lang, item.salesTotal)}</div>
                  </div>
                </div>
              )) : (
                <PosEmptyState title={t(lang, "pos.empty.title")} description={t(lang, "pos.empty.description")} stage={t(lang, "pos.empty.stage")} future={t(lang, "pos.field.top_products")} />
              )}
            </div>
          </PosSectionCard>

          <PosSectionCard title={t(lang, "pos.field.low_stock_items")} description={t(lang, "pos.page.inventory_stats.future")}>
            {inventoryOverview?.lowStockItems?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed">
                  <thead className="bg-slate-50">
                    <tr>
                      {[t(lang, "pos.field.store"), t(lang, "pos.field.product_code"), t(lang, "pos.field.product"), t(lang, "pos.field.quantity"), t(lang, "pos.field.inventory_status")].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryOverview.lowStockItems.map((item) => (
                      <tr key={`${item.storeId}-${item.productId}`} className="border-t border-slate-100">
                        <td className="px-4 py-4 text-sm text-slate-700">{item.storeId}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.clave}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.productName}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.availableQty}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{t(lang, "pos.status.low_inventory")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <PosEmptyState title={t(lang, "pos.empty.title")} description={t(lang, "pos.empty.description")} stage={t(lang, "pos.empty.stage")} future={t(lang, "pos.field.low_stock_items")} />
            )}
          </PosSectionCard>
        </div>
      </div>
    );
  }

  function renderReplenishment() {
    return (
      <div className="space-y-5">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.replenishment.future")}>
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_repeat(2,minmax(0,180px))_auto]">
            <select
              value={replenishmentFilters.storeId}
              onChange={(event) => setReplenishmentFilters((prev) => ({ ...prev, storeId: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option>
              {replenishmentStores.map((storeId) => (
                <option key={storeId} value={storeId}>{storeId}</option>
              ))}
            </select>
            <input
              value={replenishmentFilters.keyword}
              onChange={(event) => setReplenishmentFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder={`${t(lang, "pos.field.product")} / ${t(lang, "pos.field.product_code")} / ${t(lang, "pos.field.barcode")}`}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <input
              value={replenishmentFilters.dateFrom}
              onChange={(event) => setReplenishmentFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              type="date"
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <input
              value={replenishmentFilters.dateTo}
              onChange={(event) => setReplenishmentFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              type="date"
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
            />
            <button type="button" onClick={() => void loadReplenishment()} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
              {replenishmentLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[repeat(2,minmax(0,220px))_auto]">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={replenishmentFilters.lowStockOnly}
                onChange={(event) => setReplenishmentFilters((prev) => ({ ...prev, lowStockOnly: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              {t(lang, "pos.field.low_stock_only")}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={replenishmentFilters.suggestedOnly}
                onChange={(event) => setReplenishmentFilters((prev) => ({ ...prev, suggestedOnly: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              {t(lang, "pos.field.suggested_only")}
            </label>
            <div className="flex flex-wrap justify-end gap-3">
              {canReportExport ? (
                <button
                  type="button"
                  onClick={() => void handleExportReplenishment()}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {t(lang, "pos.button.export_current")}
                </button>
              ) : null}
            </div>
          </div>
        </PosSectionCard>

        <PosStatsCards
          items={[
            { label: t(lang, "pos.nav.replenishment"), hint: String(replenishmentTotal) },
            { label: t(lang, "pos.status.low_inventory"), hint: String(replenishmentRows.filter((item) => item.inventoryStatus === "low").length) },
            { label: t(lang, "pos.status.out_of_stock"), hint: String(replenishmentRows.filter((item) => item.inventoryStatus === "out").length) },
            { label: t(lang, "pos.status.replenishment_suggested"), hint: String(replenishmentRows.filter((item) => item.suggestedQty > 0).length) },
          ]}
        />

        <PosSectionCard title={t(lang, "pos.page.replenishment.title")} description={t(lang, "pos.page.replenishment.future")}>
          {replenishmentRows.length === 0 ? (
            <PosEmptyState
              title={t(lang, "pos.empty.title")}
              description={t(lang, "pos.empty.description")}
              stage={t(lang, "pos.empty.stage")}
              future={t(lang, "pos.empty.future", { feature: t(lang, "pos.page.replenishment.future") })}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      t(lang, "pos.field.store"),
                      t(lang, "pos.field.product"),
                      t(lang, "pos.field.product_code"),
                      t(lang, "pos.field.current_inventory"),
                      t(lang, "pos.field.min_stock"),
                      t(lang, "pos.field.sales_7d"),
                      t(lang, "pos.field.sales_30d"),
                      t(lang, "pos.field.avg_daily_sales"),
                      t(lang, "pos.field.suggested_qty"),
                      t(lang, "pos.field.status"),
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {replenishmentRows.map((item) => {
                    const statuses = [
                      item.inventoryStatus === "out"
                        ? t(lang, "pos.status.out_of_stock")
                        : item.inventoryStatus === "low"
                          ? t(lang, "pos.status.low_inventory")
                          : t(lang, "pos.status.inventory_ok"),
                      ...(item.suggestionStatus === "suggested" ? [t(lang, "pos.status.replenishment_suggested")] : []),
                    ];
                    return (
                      <tr key={`${item.storeId}-${item.productId}`} className="border-t border-slate-100">
                        <td className="px-4 py-4 text-sm text-slate-700">{item.storeId}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <div className="font-semibold text-slate-900">{item.productName}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.barcode || "-"}</div>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.clave || "-"}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.currentQty}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.minStock}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.sales7d}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.sales30d}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.avgDailySales.toFixed(2)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.suggestedQty}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{statuses.join(" / ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PosSectionCard>
      </div>
    );
  }

  function renderSalesDocs() {
    return (
      <div className="space-y-3">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.sales_docs.subtitle")}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadSales()}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
            >
              {t(lang, "common.refresh")}
            </button>
            {canSaleExport ? (
              <button
                type="button"
                onClick={() => void handleExportSales()}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
              >
                {t(lang, "pos.button.export_current")}
              </button>
            ) : null}
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-3 xl:grid-cols-7">
            {posAccess.allowAllStores ? (
              <select
                value={salesFilters.storeId}
                onChange={(event) => setSalesFilters((prev) => ({ ...prev, storeId: event.target.value }))}
                className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-[11px] text-slate-700 outline-none focus:border-primary"
              >
                <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option>
                {storeOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            ) : null}
            <input
              value={salesFilters.dateFrom}
              onChange={(event) => setSalesFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              type="date"
              aria-label={t(lang, "pos.field.date_from")}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-[11px] text-slate-700 outline-none focus:border-primary"
            />
            <input
              value={salesFilters.dateTo}
              onChange={(event) => setSalesFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              type="date"
              aria-label={t(lang, "pos.field.date_to")}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-[11px] text-slate-700 outline-none focus:border-primary"
            />
            <input
              value={salesFilters.folio}
              onChange={(event) => setSalesFilters((prev) => ({ ...prev, folio: event.target.value }))}
              placeholder={t(lang, "pos.field.folio")}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-[11px] outline-none focus:border-primary"
            />
            <input
              value={salesFilters.customer}
              onChange={(event) => setSalesFilters((prev) => ({ ...prev, customer: event.target.value }))}
              placeholder={t(lang, "pos.field.customer")}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-[11px] outline-none focus:border-primary"
            />
            <select
              value={salesFilters.paymentMethod}
              onChange={(event) => setSalesFilters((prev) => ({ ...prev, paymentMethod: event.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-[11px] outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.payment_method")}</option>
              <option value="cash">{paymentLabel(lang, "cash")}</option>
              <option value="transfer">{paymentLabel(lang, "transfer")}</option>
              <option value="card">{paymentLabel(lang, "card")}</option>
            </select>
            <select
              value={salesFilters.status}
              onChange={(event) => setSalesFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-[11px] outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.status")}</option>
              <option value="completed">{t(lang, "pos.status.completed")}</option>
              <option value="refunded">{t(lang, "pos.status.refunded")}</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadSales()}
              disabled={salesLoading}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salesLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = {
                  storeId: posAccess.allowAllStores ? "" : storeSnapshot.storeContext.storeId,
                  dateFrom: "",
                  dateTo: "",
                  folio: "",
                  customer: "",
                  paymentMethod: "",
                  status: "",
                };
                setSalesFilters(cleared);
                void loadSales(cleared);
              }}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
            >
              {t(lang, "common.cancel")}
            </button>
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.section.list")} description={t(lang, "pos.page.sales_docs.subtitle")}>
          {sales.length === 0 ? (
            <PosEmptyState
              title={t(lang, "pos.empty.sales_title")}
              description={t(lang, "pos.empty.sales_description")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      t(lang, "pos.field.folio"),
                      t(lang, "pos.field.datetime"),
                      t(lang, "pos.field.customer"),
                      t(lang, "pos.field.cashier"),
                      t(lang, "pos.field.payment_method"),
                      t(lang, "pos.field.total"),
                      t(lang, "pos.field.status"),
                      t(lang, "pos.field.source_type"),
                      t(lang, "pos.field.actions"),
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-900">{item.folio}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{formatDateTime(lang, item.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.customerName || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.cashierName}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{paymentLabel(lang, item.paymentMethod)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{formatCurrency(lang, item.total)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{recordStatusLabel(lang, item.status)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{sourceTypeLabel(lang, item.sourceType)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void openSaleDetail(item.id)}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
                          >
                            {t(lang, "pos.button.view_detail")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void openTicketPreview(item.id)}
                            disabled={ticketLoading}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t(lang, "pos.button.view_ticket")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void openTicketPreview(item.id)}
                            disabled={ticketLoading}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t(lang, "pos.button.reprint_ticket")}
                          </button>
                          {canRefund ? (
                            <button
                              type="button"
                              onClick={() => {
                                setRefundTarget(item);
                                setRefundReasonDraft("");
                              }}
                              disabled={item.status === "refunded"}
                              className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t(lang, "pos.button.refund")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PosSectionCard>
      </div>
    );
  }

  function renderTransfers() {
    return (
      <div className="space-y-4">
        <PosSectionCard title={t(lang, "pos.section.actions")} description={t(lang, "pos.page.transfers.subtitle")}>
          <div className="flex flex-wrap gap-2">
            {canTransferCreate ? (
              <button
                type="button"
                onClick={() => {
                  resetTransferForm();
                  setTransferCreateOpen(true);
                }}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white"
              >
                {t(lang, "pos.button.new_transfer")}
              </button>
            ) : (
              <div className="inline-flex h-9 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-400">
                {t(lang, "pos.notice.permission_denied")}
              </div>
            )}
            <button
              type="button"
              onClick={() => void loadTransfers()}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700"
            >
              {t(lang, "common.refresh")}
            </button>
          </div>
        </PosSectionCard>

        <PosSectionCard title={t(lang, "pos.section.filters")}>
          <div className="grid gap-2 lg:grid-cols-3 xl:grid-cols-6">
            <input
              value={transferFilters.dateFrom}
              onChange={(event) => setTransferFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))}
              type="date"
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary"
            />
            <input
              value={transferFilters.dateTo}
              onChange={(event) => setTransferFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))}
              type="date"
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary"
            />
            <select
              value={transferFilters.fromStoreId}
              onChange={(event) => setTransferFilters((prev) => ({ ...prev, fromStoreId: event.target.value, page: 1 }))}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.from_store")}</option>
              {transferStores.map((storeId) => (
                <option key={`from-${storeId}`} value={storeId}>{storeId}</option>
              ))}
            </select>
            <select
              value={transferFilters.toStoreId}
              onChange={(event) => setTransferFilters((prev) => ({ ...prev, toStoreId: event.target.value, page: 1 }))}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.to_store")}</option>
              {transferStores.map((storeId) => (
                <option key={`to-${storeId}`} value={storeId}>{storeId}</option>
              ))}
            </select>
            <select
              value={transferFilters.status}
              onChange={(event) => setTransferFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary"
            >
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.status")}</option>
              <option value="draft">{t(lang, "pos.status.transfer_draft")}</option>
              <option value="sent">{t(lang, "pos.status.transfer_sent")}</option>
              <option value="received">{t(lang, "pos.status.transfer_received")}</option>
            </select>
            <input
              value={transferFilters.folio}
              onChange={(event) => setTransferFilters((prev) => ({ ...prev, folio: event.target.value, page: 1 }))}
              placeholder={t(lang, "pos.placeholder.transfer_filter")}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadTransfers()}
              disabled={transferLoading}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {transferLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = {
                  fromStoreId: "",
                  toStoreId: "",
                  status: "",
                  folio: "",
                  dateFrom: "",
                  dateTo: "",
                  page: 1,
                  limit: transferFilters.limit,
                };
                setTransferFilters(cleared);
                void loadTransfers(cleared);
              }}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700"
            >
              {t(lang, "pos.button.cancel")}
            </button>
          </div>
        </PosSectionCard>

        <PosSectionCard title={t(lang, "pos.section.list")} description={t(lang, "pos.page.transfers.subtitle")}>
          {transferRows.length === 0 ? (
            <PosEmptyState
              title={t(lang, "pos.empty.title")}
              description={t(lang, "pos.empty.description")}
              stage={t(lang, "pos.empty.stage")}
              future={t(lang, "pos.empty.future", { feature: t(lang, "pos.page.transfers.future") })}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      t(lang, "pos.field.folio"),
                      t(lang, "pos.field.from_store"),
                      t(lang, "pos.field.to_store"),
                      t(lang, "pos.field.status"),
                      t(lang, "pos.field.datetime"),
                      t(lang, "pos.field.sent_at"),
                      t(lang, "pos.field.received_at"),
                      t(lang, "pos.field.user"),
                      t(lang, "pos.field.actions"),
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transferRows.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-900">{item.folio}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.fromStoreId}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.toStoreId}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{transferStatusLabel(lang, item.status)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{formatDateTime(lang, item.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.sentAt ? formatDateTime(lang, item.sentAt) : "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.receivedAt ? formatDateTime(lang, item.receivedAt) : "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.createdByName}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void openTransferDetail(item.id)}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
                          >
                            {t(lang, "pos.button.view_detail")}
                          </button>
                          {canTransferSend ? (
                            <button
                              type="button"
                              onClick={() => void sendTransferRecord(item.id)}
                              disabled={item.status !== "draft" || transferActionSubmitting}
                              className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t(lang, "pos.button.send_transfer")}
                            </button>
                          ) : null}
                          {canTransferReceive ? (
                            <button
                              type="button"
                              onClick={() => void receiveTransferRecord(item.id)}
                              disabled={item.status !== "sent" || transferActionSubmitting}
                              className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t(lang, "pos.button.receive_transfer")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PosSectionCard>
      </div>
    );
  }

  function renderGenericPage() {
    return (
      <div className="space-y-3">
        <PosSectionCard title={t(lang, "pos.section.filters")}>
          <PosFilterBar items={[t(lang, "pos.field.date"), t(lang, "pos.field.status"), t(lang, "pos.field.keyword")]} />
        </PosSectionCard>
        <PosDataTableShell title={t(lang, currentTab.navKey)} columns={[t(lang, "pos.field.product_code"), t(lang, "pos.field.product"), t(lang, "pos.field.status"), t(lang, "pos.field.datetime")]} rows={6} />
        <PosSectionCard title={t(lang, "pos.section.content")} description={t(lang, "pos.section.content.desc")}>
          <PosEmptyState
            title={t(lang, "pos.empty.title")}
            description={t(lang, "pos.empty.description")}
            stage={t(lang, "pos.empty.stage")}
            future={t(lang, "pos.empty.future", { feature: t(lang, currentTab.futureKey) })}
          />
        </PosSectionCard>
      </div>
    );
  }

  function renderStoreSettings() {
    return (
      <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
        <PosSectionCard title={t(lang, "pos.section.store_list")} description={t(lang, "pos.page.store_settings.subtitle")}>
          <div className="space-y-2.5">
            {storeSettingsRows.map((item) => {
              const active = item.storeId === selectedStoreSettingId;
              return (
                <button
                  key={item.storeId}
                  type="button"
                  onClick={() => {
                    setSelectedStoreSettingId(item.storeId);
                    setStoreSettingForm(item);
                  }}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${active ? "border-primary bg-primary/5" : "border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-slate-800">{item.storeName}</div>
                      <div className="mt-1 text-xs text-slate-400">{item.storeId}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {item.active ? t(lang, "pos.status.active") : t(lang, "pos.status.inactive")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.section.store_detail")} description={t(lang, "pos.page.store_settings.subtitle")}>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={storeSettingForm.storeId} disabled className="h-9 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500" />
            <input disabled={!canStoreManage} value={storeSettingForm.storeName} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, storeName: event.target.value }))} placeholder={t(lang, "pos.field.store_name")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canStoreManage} value={storeSettingForm.storeCode} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, storeCode: event.target.value }))} placeholder={t(lang, "pos.field.store_code")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canStoreManage} value={storeSettingForm.phone} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder={t(lang, "pos.field.phone")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canStoreManage} value={storeSettingForm.rfc} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, rfc: event.target.value }))} placeholder={t(lang, "pos.field.rfc")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
              <input disabled={!canStoreManage} type="checkbox" checked={storeSettingForm.active} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, active: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
              {t(lang, "pos.field.active")}
            </label>
            <input disabled={!canStoreManage} value={storeSettingForm.defaultTicketHeader} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, defaultTicketHeader: event.target.value }))} placeholder={t(lang, "pos.field.default_ticket_header")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 md:col-span-2" />
            <input disabled={!canStoreManage} value={storeSettingForm.ticketSubtitle} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, ticketSubtitle: event.target.value }))} placeholder={t(lang, "pos.field.ticket_subtitle")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 md:col-span-2" />
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 md:col-span-2">
              <input
                disabled={!canStoreManage}
                type="checkbox"
                checked={storeSettingForm.cashierAutoCloseEnabled}
                onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, cashierAutoCloseEnabled: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span>{cashierAutoCloseEnabledLabel(lang)}</span>
            </label>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">{cashierAutoCloseMinutesLabel(lang)}</div>
              <input
                disabled={!canStoreManage || !storeSettingForm.cashierAutoCloseEnabled}
                type="number"
                min={1}
                step={1}
                value={storeSettingForm.cashierAutoCloseMinutes}
                onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, cashierAutoCloseMinutes: Math.max(1, Math.trunc(Number(event.target.value || 1))) }))}
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
              />
              <div className="text-[11px] text-slate-400">{cashierAutoCloseHintLabel(lang)}</div>
            </div>
            <textarea disabled={!canStoreManage} value={storeSettingForm.address} onChange={(event) => setStoreSettingForm((prev) => ({ ...prev, address: event.target.value }))} placeholder={t(lang, "pos.field.address")} className="min-h-[72px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 md:col-span-2" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">{t(lang, "pos.field.updated_at")}: {storeSettingForm.updatedAt ? formatDateTime(lang, storeSettingForm.updatedAt) : "-"}</div>
            {canStoreManage ? (
              <button type="button" onClick={() => void submitStoreSetting()} disabled={storeSettingsSaving} className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {storeSettingsSaving ? t(lang, "common.saving") : t(lang, "common.save")}
              </button>
            ) : (
              <div className="text-xs font-semibold text-slate-400">{t(lang, "pos.notice.permission_denied")}</div>
            )}
          </div>
        </PosSectionCard>
      </div>
    );
  }

  function renderTicketSettings() {
    return (
      <div className="grid gap-3 xl:grid-cols-[0.7fr_0.98fr_0.9fr]">
        <PosSectionCard title={t(lang, "pos.section.store_list")} description={t(lang, "pos.page.receipt_template.subtitle")}>
          <div className="space-y-2.5">
            {ticketSettingRows.map((item) => {
              const active = item.storeId === selectedTicketStoreId;
              return (
                <button
                  key={item.storeId}
                  type="button"
                  onClick={() => {
                    setSelectedTicketStoreId(item.storeId);
                    setTicketSettingForm(item);
                  }}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${active ? "border-primary bg-primary/5" : "border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-white"}`}
                >
                  <div className="text-[13px] font-semibold text-slate-800">{item.ticketHeaderName || item.storeId}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.storeId}</div>
                </button>
              );
            })}
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.section.ticket_settings")} description={t(lang, "pos.page.receipt_template.subtitle")}>
          <input
            ref={ticketLogoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleTicketLogoUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input value={ticketSettingForm.storeId} disabled className="h-9 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500 md:col-span-2" />
            <input disabled={!canTicketManage} value={ticketSettingForm.ticketHeaderName} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, ticketHeaderName: event.target.value }))} placeholder={t(lang, "pos.field.ticket_header_name")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canTicketManage} value={ticketSettingForm.ticketHeaderSubtitle} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, ticketHeaderSubtitle: event.target.value }))} placeholder={t(lang, "pos.field.ticket_header_subtitle")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canTicketManage} value={ticketSettingForm.companyFullName} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, companyFullName: event.target.value }))} placeholder={t(lang, "pos.field.company_full_name")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 md:col-span-2" />
            <div className="md:col-span-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {ticketSettingForm.logoUrl ? <img src={ticketSettingForm.logoUrl} alt="logo" className="h-full w-full object-contain" /> : <span className="text-[10px] text-slate-300">LOGO</span>}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700">{t(lang, "pos.field.logo")}</div>
                      <div className="mt-1 text-[10px] text-slate-400">{t(lang, "pos.section.live_preview")}</div>
                    </div>
                  </div>
                  {canTicketManage ? (
                    <button type="button" onClick={() => ticketLogoInputRef.current?.click()} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700">
                      {ticketSettingForm.logoUrl ? t(lang, "common.edit") : t(lang, "common.upload")}
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700">
                    <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showLogo} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showLogo: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                    {t(lang, "pos.field.show_logo")}
                  </label>
                  <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700">
                    <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showTicketBarcode} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showTicketBarcode: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                    {t(lang, "pos.field.show_ticket_barcode")}
                  </label>
                </div>
              </div>
            </div>
            <textarea disabled={!canTicketManage} value={ticketSettingForm.address} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, address: event.target.value }))} placeholder={t(lang, "pos.field.address")} className="min-h-[68px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 md:col-span-2" />
            <input disabled={!canTicketManage} value={ticketSettingForm.phone} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder={t(lang, "pos.field.phone")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canTicketManage} value={ticketSettingForm.whatsapp} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, whatsapp: event.target.value }))} placeholder={t(lang, "pos.field.whatsapp")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canTicketManage} value={ticketSettingForm.website} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, website: event.target.value }))} placeholder={t(lang, "pos.field.website")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canTicketManage} value={ticketSettingForm.rfc} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, rfc: event.target.value }))} placeholder={t(lang, "pos.field.rfc")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <textarea disabled={!canTicketManage} value={ticketSettingForm.qrContent} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, qrContent: event.target.value }))} placeholder={t(lang, "pos.field.qr_content")} className="min-h-[68px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 md:col-span-2" />
            <input disabled={!canTicketManage} value={ticketSettingForm.footerLine1} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, footerLine1: event.target.value }))} placeholder={t(lang, "pos.field.footer_line_1")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <input disabled={!canTicketManage} value={ticketSettingForm.footerLine2} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, footerLine2: event.target.value }))} placeholder={t(lang, "pos.field.footer_line_2")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500" />
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
              <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showRfc} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showRfc: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
              {t(lang, "pos.field.show_rfc")}
            </label>
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
              <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showCashier} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showCashier: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
              {t(lang, "pos.field.show_cashier")}
            </label>
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
              <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showWhatsapp} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showWhatsapp: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
              {t(lang, "pos.field.show_whatsapp")}
            </label>
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
              <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showWebsite} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showWebsite: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
              {t(lang, "pos.field.show_website")}
            </label>
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
              <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showQr} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showQr: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
              {t(lang, "pos.field.show_qr")}
            </label>
            <label className="inline-flex h-9 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 md:col-span-2">
              <input disabled={!canTicketManage} type="checkbox" checked={ticketSettingForm.showCustomer} onChange={(event) => setTicketSettingForm((prev) => ({ ...prev, showCustomer: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
              {t(lang, "pos.field.show_customer")}
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">{t(lang, "pos.field.updated_at")}: {ticketSettingForm.updatedAt ? formatDateTime(lang, ticketSettingForm.updatedAt) : "-"}</div>
            {canTicketManage ? (
              <button type="button" onClick={() => void submitTicketSetting()} disabled={ticketSettingsSaving} className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {ticketSettingsSaving ? t(lang, "common.saving") : t(lang, "common.save")}
              </button>
            ) : (
              <div className="text-xs font-semibold text-slate-400">{t(lang, "pos.notice.permission_denied")}</div>
            )}
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.section.ticket_preview")} description={t(lang, "pos.section.live_preview")}>
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {t(lang, "pos.section.preview_panel")}
            </div>
            <div className="rounded-[16px] bg-white px-3 py-4 shadow-sm">
              <PosTicketPreview lang={lang} ticket={ticketPreviewDraft} />
            </div>
          </div>
        </PosSectionCard>
      </div>
    );
  }

  function renderCashiers() {
    return (
      <div className="space-y-4">
        <PosSectionCard title={t(lang, "pos.section.filters")} description={t(lang, "pos.page.cashiers.subtitle")}>
          <div className="grid gap-2 lg:grid-cols-4">
            {posAccess.allowAllStores ? (
              <select value={cashierFilters.storeId} onChange={(event) => setCashierFilters((prev) => ({ ...prev, storeId: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary">
                <option value="">{t(lang, "common.all")} {t(lang, "pos.field.store")}</option>
                {storeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            ) : null}
            <input value={cashierFilters.keyword} onChange={(event) => setCashierFilters((prev) => ({ ...prev, keyword: event.target.value }))} placeholder={t(lang, "pos.field.keyword")} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary" />
            <select value={cashierFilters.role} onChange={(event) => setCashierFilters((prev) => ({ ...prev, role: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary">
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.role")}</option>
              {posAccess.role === "admin_general" ? <option value="admin_general">{t(lang, "pos.role.admin_general")}</option> : null}
              <option value="store_admin">{t(lang, "pos.role.store_admin")}</option>
              <option value="cashier">{t(lang, "pos.role.cashier")}</option>
            </select>
            <select value={cashierFilters.status} onChange={(event) => setCashierFilters((prev) => ({ ...prev, status: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary">
              <option value="">{t(lang, "common.all")} {t(lang, "pos.field.status")}</option>
              <option value="active">{t(lang, "pos.status.active")}</option>
              <option value="inactive">{t(lang, "pos.status.inactive")}</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadCashiers()} disabled={cashiersLoading} className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {cashiersLoading ? t(lang, "common.loading") : t(lang, "common.search")}
            </button>
            {canCashierManage ? (
              <button type="button" onClick={() => void openCashierEditor()} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700">
                {t(lang, "pos.button.new_cashier")}
              </button>
            ) : null}
          </div>
        </PosSectionCard>
        <PosSectionCard title={t(lang, "pos.section.list")} description={t(lang, "pos.page.cashiers.subtitle")}>
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  {[t(lang, "pos.field.user"), t(lang, "pos.field.account"), t(lang, "pos.field.store"), t(lang, "pos.field.role"), t(lang, "pos.field.status"), t(lang, "pos.field.updated_at"), t(lang, "pos.field.actions")].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashierRows.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {item.avatarUrl ? <img src={item.avatarUrl} alt={item.name} className="h-full w-full object-cover" /> : item.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="text-[13px] font-semibold text-slate-800">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{item.account}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{storeOptions.find((option) => option.id === item.storeId)?.name || item.storeId}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{posRoleLabel(lang, item.role)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{item.active ? t(lang, "pos.status.active") : t(lang, "pos.status.inactive")}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{formatDateTime(lang, item.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canCashierManage ? (
                          <>
                            <button type="button" onClick={() => void openCashierEditor(item)} className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700">
                              {t(lang, "common.edit")}
                            </button>
                            <button type="button" onClick={() => void toggleCashierStatus(item)} className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700">
                              {item.active ? t(lang, "pos.button.deactivate") : t(lang, "pos.button.activate")}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PosSectionCard>
      </div>
    );
  }

  function renderCurrentTab() {
    switch (activeTab) {
      case "workbench":
        return renderWorkbench();
      case "cashier":
        return renderCashier();
      case "suspended":
        return renderSuspended();
      case "quote":
        return renderQuote();
      case "products_prices":
        return renderProductsPrices();
      case "store_inventory":
        return renderStoreInventory();
      case "inventory_movement":
        return renderInventoryMovement();
      case "inventory_import":
        return renderInventoryImport();
      case "transfers":
        return renderTransfers();
      case "finance_stats":
        return renderFinanceStats();
      case "inventory_stats":
        return renderInventoryStats();
      case "replenishment":
        return renderReplenishment();
      case "audit_logs":
        return renderAuditLogs();
      case "sales_docs":
        return renderSalesDocs();
      case "cashiers":
        return renderCashiers();
      case "store_settings":
        return renderStoreSettings();
      case "receipt_template":
        return renderTicketSettings();
      case "system_settings":
        return renderSystemSettings();
      default:
        return renderGenericPage();
    }
  }

  const modalLowStockItems = workbenchLowStockOverview?.lowStockItems || [];
  const modalLowStockPageSize = 8;
  const modalLowStockTotalPages = Math.max(1, Math.ceil(modalLowStockItems.length / modalLowStockPageSize));
  const modalLowStockCurrentPage = Math.min(workbenchLowStockPage, modalLowStockTotalPages);
  const modalLowStockPagedItems = modalLowStockItems.slice(
    (modalLowStockCurrentPage - 1) * modalLowStockPageSize,
    modalLowStockCurrentPage * modalLowStockPageSize,
  );
  const salesDetailRows = workbenchSalesDetailModal?.rows || [];
  const salesDetailPageSize = 8;
  const salesDetailTotalPages = Math.max(1, Math.ceil(salesDetailRows.length / salesDetailPageSize));
  const salesDetailCurrentPage = Math.min(workbenchSalesDetailPage, salesDetailTotalPages);
  const salesDetailPagedRows = salesDetailRows.slice(
    (salesDetailCurrentPage - 1) * salesDetailPageSize,
    salesDetailCurrentPage * salesDetailPageSize,
  );

  return (
    <div
      ref={posFullscreenRef}
      className={`${
        cashierFullscreenFallback
          ? "fixed inset-0 z-[60] overflow-hidden bg-slate-100 p-2"
          : cashierFullscreenActive
            ? "h-screen overflow-hidden bg-slate-100 p-2"
            : ""
      }`}
    >
      {!cashierFullscreenEnabled ? (
        <>
          {renderNav()}
        </>
      ) : null}

      <div className={cashierFullscreenEnabled ? "mt-0 h-full" : "mt-2"}>{renderCurrentTab()}</div>

      {selectedProductsModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-2xl">
            <PosModalShell
              title={t(lang, "pos.modal.select_product")}
              footer={
                <div className="flex justify-end">
                  <button type="button" onClick={() => setSelectedProductsModal(null)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                {selectedProductsModal.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      selectedProductsModal.mode === "cashier" ? addProductToCashierCart(item) : addProductToQuoteCart(item);
                      setSelectedProductsModal(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-white"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{lang === "zh" ? (item.nameCn || item.nameEs) : (item.nameEs || item.nameCn)}</div>
                      <div className="mt-1 text-xs text-slate-400">{item.clave} / {item.barcode}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-500">{formatCurrency(lang, item.price)}</div>
                  </button>
                ))}
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {workbenchLowStockModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-3xl">
            <PosModalShell
              title={lang === "zh" ? "库存列表" : "Inventory list"}
              footer={
                <div className="flex justify-end">
                  <button type="button" onClick={() => setWorkbenchLowStockModalOpen(false)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-[11px] text-slate-500">{t(lang, "pos.field.store")}:</div>
                  <div className="text-sm font-bold text-slate-800">{workbenchLowStockStoreName}</div>
                </div>
              </div>
              {workbenchLowStockOverview?.lowStockItems?.length ? (
                <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-200">
                  {modalLowStockPagedItems.map((item) => {
                    const soldQty = item.onHandQty - item.availableQty;
                    const remainingQty = item.availableQty;
                    const lowStockThreshold = item.minStock > 0 ? item.minStock : 0;
                    const statusLabel = remainingQty < 0
                      ? (lang === "zh" ? "超库存售卖" : "Oversold")
                      : remainingQty === 0
                        ? (lang === "zh" ? "无库存" : "Out of stock")
                        : remainingQty <= lowStockThreshold
                          ? (lang === "zh" ? "低库存" : "Low stock")
                          : (lang === "zh" ? "充足" : "Sufficient");
                    const statusDanger = remainingQty <= lowStockThreshold;
                    return (
                      <div key={`${item.storeId}-${item.productId}`} className="flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-2.5 last:border-b-0">
                        <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          <ProductImage
                            sku={item.clave}
                            alt={item.productName}
                            size={40}
                            className="h-10 w-10"
                            imageClassName="grayscale"
                            roundedClassName="rounded-none"
                            onClick={() => {
                              const sources = buildProductImageUrls(item.clave, ["jpg", "jpeg", "png", "webp"]);
                              const src = buildProductImageUrl(item.clave, "jpg") || sources[0] || "";
                              if (!src) return;
                              setWorkbenchLowStockPreviewImage({
                                src,
                                title: item.productName || item.clave,
                                fallbackSources: sources,
                              });
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-800">{item.clave}</div>
                          <div className="truncate text-[11px] text-slate-400">{item.productName}</div>
                        </div>
                        <div className="grid min-w-[260px] grid-cols-4 gap-2 text-center text-[11px] text-slate-500">
                          <div>
                            <div className="text-slate-400">{lang === "zh" ? "现有库存" : "On hand"}</div>
                            <div className="mt-0.5 font-bold text-slate-800">{item.onHandQty}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">{lang === "zh" ? "已销数量" : "Sold"}</div>
                            <div className="mt-0.5">{soldQty}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">{lang === "zh" ? "剩余库存" : "Remaining"}</div>
                            <div className={`mt-0.5 ${remainingQty <= lowStockThreshold ? "text-rose-600" : "text-slate-500"}`}>{remainingQty}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">{lang === "zh" ? "状态" : "Status"}</div>
                            <div className={`mt-0.5 ${statusDanger ? "font-semibold text-rose-600" : "text-slate-500"}`}>{statusLabel}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                  {reportsLoading ? t(lang, "common.loading") : t(lang, "pos.empty.description")}
                </div>
              )}
              {workbenchLowStockOverview?.lowStockItems?.length ? (
                <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-500">
                  <button
                    type="button"
                    disabled={modalLowStockCurrentPage <= 1}
                    onClick={() => setWorkbenchLowStockPage((page) => Math.max(1, page - 1))}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {lang === "zh" ? "上一页" : "Prev"}
                  </button>
                  <div className="min-w-[64px] text-center font-semibold text-slate-700">
                    {modalLowStockCurrentPage} / {modalLowStockTotalPages}
                  </div>
                  <button
                    type="button"
                    disabled={modalLowStockCurrentPage >= modalLowStockTotalPages}
                    onClick={() => setWorkbenchLowStockPage((page) => Math.min(modalLowStockTotalPages, page + 1))}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {lang === "zh" ? "下一页" : "Next"}
                  </button>
                </div>
              ) : null}
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {workbenchSalesDetailModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-3xl">
            <PosModalShell
              title={workbenchSalesDetailModal.title}
              footer={
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setWorkbenchSalesDetailModal(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              {workbenchSalesDetailModal.storeName ? (
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{t(lang, "pos.field.store")}:</div>
                  <div className="text-sm font-bold text-slate-800">{workbenchSalesDetailModal.storeName}</div>
                </div>
              ) : null}
              {salesDetailRows.length ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-5 gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-center text-[11px] font-semibold text-slate-500">
                    <div>{lang === "zh" ? "日期" : "Date"}</div>
                    <div>{t(lang, "pos.field.sales_total")}</div>
                    <div>{t(lang, "pos.field.refund_total")}</div>
                    <div>{t(lang, "pos.field.net_sales_total")}</div>
                    <div>{t(lang, "pos.field.order_count")}</div>
                  </div>
                  {salesDetailPagedRows.map((item) => (
                    <div key={item.bucket} className="grid grid-cols-5 gap-2 border-b border-slate-100 bg-white px-3 py-2.5 text-center text-[12px] text-slate-600 last:border-b-0">
                      <div className="font-semibold text-slate-700">{formatSalesDetailDate(lang, item.bucket)}</div>
                      <div>{formatCurrencyWithSymbolGap(item.salesTotal)}</div>
                      <div>{formatCurrencyWithSymbolGap(item.refundTotal)}</div>
                      <div className="font-bold text-slate-900">{formatCurrencyWithSymbolGap(item.netSalesTotal)}</div>
                      <div>{item.orderCount}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                  {reportsLoading ? t(lang, "common.loading") : t(lang, "pos.empty.description")}
                </div>
              )}
              {salesDetailRows.length ? (
                <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-500">
                  <button
                    type="button"
                    disabled={salesDetailCurrentPage <= 1}
                    onClick={() => setWorkbenchSalesDetailPage((page) => Math.max(1, page - 1))}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {lang === "zh" ? "上一页" : "Prev"}
                  </button>
                  <div className="min-w-[64px] text-center font-semibold text-slate-700">
                    {salesDetailCurrentPage} / {salesDetailTotalPages}
                  </div>
                  <button
                    type="button"
                    disabled={salesDetailCurrentPage >= salesDetailTotalPages}
                    onClick={() => setWorkbenchSalesDetailPage((page) => Math.min(salesDetailTotalPages, page + 1))}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {lang === "zh" ? "下一页" : "Next"}
                  </button>
                </div>
              ) : null}
            </PosModalShell>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        open={Boolean(workbenchLowStockPreviewImage)}
        src={workbenchLowStockPreviewImage?.src || ""}
        fallbackSources={workbenchLowStockPreviewImage?.fallbackSources}
        title={workbenchLowStockPreviewImage?.title}
        alt={workbenchLowStockPreviewImage?.title}
        overlayClassName="z-[90]"
        onClose={() => setWorkbenchLowStockPreviewImage(null)}
      />

      {discountTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.set_discount")}
              shellClassName={cashierLayout2Active ? "!rounded-none" : ""}
              titleBarClassName={cashierLayout2Active ? "!rounded-none" : ""}
              bodyClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footerClassName={cashierLayout2Active ? "!rounded-none" : ""}
              fieldClassName={cashierLayout2Active ? "!rounded-none" : ""}
              emptyClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footer={
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDiscountTarget(null)} className={`inline-flex h-10 items-center justify-center border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}>{t(lang, "pos.button.cancel")}</button>
                  <button type="button" onClick={applyDiscount} className={`inline-flex h-10 items-center justify-center bg-primary px-4 text-sm font-semibold text-white ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}>{t(lang, "pos.button.confirm")}</button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setDiscountModeDraft("percent")} className={`inline-flex h-11 items-center justify-center border text-sm font-semibold ${cashierLayout2Active ? "rounded-none" : "rounded-xl"} ${discountModeDraft === "percent" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>{t(lang, "pos.discount.percent")}</button>
                  <button type="button" onClick={() => setDiscountModeDraft("amount")} className={`inline-flex h-11 items-center justify-center border text-sm font-semibold ${cashierLayout2Active ? "rounded-none" : "rounded-xl"} ${discountModeDraft === "amount" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>{t(lang, "pos.discount.amount")}</button>
                </div>
                <input
                  value={discountValueDraft}
                  onChange={(event) => setDiscountValueDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    event.stopPropagation();
                    window.setTimeout(() => {
                      applyDiscount();
                    }, 0);
                  }}
                  autoFocus
                  placeholder={t(lang, "pos.placeholder.discount_value")}
                  className={`h-11 w-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                />
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {suspendModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.suspend_order")}
              shellClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footer={
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setSuspendModalOpen(false)} className={`inline-flex h-10 items-center justify-center border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}>{t(lang, "pos.button.cancel")}</button>
                  <button type="button" onClick={confirmSuspend} className={`inline-flex h-10 items-center justify-center bg-primary px-4 text-sm font-semibold text-white ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}>{t(lang, "pos.button.suspend")}</button>
                </div>
              }
            >
              <div className="space-y-3">
                <input value={cart.customer.name} onChange={(event) => setCart((prev) => setCustomerField(prev, "name", event.target.value))} placeholder={t(lang, "pos.field.customer")} className={`h-11 w-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`} />
                <textarea value={suspendNoteDraft} onChange={(event) => setSuspendNoteDraft(event.target.value)} placeholder={t(lang, "pos.field.remark")} className={`h-24 w-full resize-none border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`} />
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {resumeTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.resume_order")}
              footer={
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setResumeTarget(null)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">{t(lang, "pos.button.cancel")}</button>
                  <button type="button" onClick={() => resumeSuspendedOrder(resumeTarget)} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">{t(lang, "pos.button.resume")}</button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{resumeTarget.folio}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{resumeTarget.customer.name}</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{formatCurrency(lang, resumeTarget.total)}</div>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {saleDetail ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-5xl">
            <PosModalShell
              title={t(lang, "pos.modal.sale_detail")}
              footer={
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void openTicketPreview(saleDetail.id)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.view_ticket")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openTicketPreview(saleDetail.id)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.reprint_ticket")}
                  </button>
                  {canRefund ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRefundTarget(saleDetail);
                        setRefundReasonDraft("");
                      }}
                      disabled={saleDetail.status === "refunded"}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t(lang, "pos.button.refund")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSaleDetail(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                  >
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.folio")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{saleDetail.folio}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.datetime")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(lang, saleDetail.createdAt)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.status")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{recordStatusLabel(lang, saleDetail.status)}</div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <PosSectionCard title={t(lang, "pos.section.detail")}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.cashier")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{saleDetail.cashierName || "-"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.source_type")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{sourceTypeLabel(lang, saleDetail.sourceType)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.source_folio")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{saleDetail.sourceFolio || saleDetail.sourceId || "-"}</div>
                      </div>
                    </div>
                  </PosSectionCard>

                  <PosSectionCard title={t(lang, "pos.section.customer_info")}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.customer")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{saleDetail.customerName || "-"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.phone")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{saleDetail.customerPhone || "-"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.rfc")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{saleDetail.customerRfc || "-"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.remark")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{saleDetail.note || "-"}</div>
                      </div>
                    </div>
                  </PosSectionCard>
                </div>

                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <PosSectionCard title={t(lang, "pos.field.payment_method")}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.payment_method")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{paymentLabel(lang, saleDetail.paymentMethod)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.received_amount")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(lang, saleDetail.receivedAmount || 0)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.change")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(lang, saleDetail.changeAmount || 0)}</div>
                      </div>
                    </div>
                  </PosSectionCard>

                  <PosSectionCard title={t(lang, "pos.section.settlement_summary")}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.subtotal")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(lang, saleDetail.subtotal || 0)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.discount")}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(lang, saleDetail.discountTotal || 0)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{t(lang, "pos.field.total")}</div>
                        <div className="mt-2 text-sm font-semibold text-primary">{formatCurrency(lang, saleDetail.total)}</div>
                      </div>
                    </div>
                  </PosSectionCard>
                </div>

                <PosSectionCard title={t(lang, "pos.section.cart_items")}>
                  {saleDetail.lines?.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full table-fixed">
                        <thead className="bg-slate-50">
                          <tr>
                            {[t(lang, "pos.field.product"), t(lang, "pos.field.product_code"), t(lang, "pos.field.quantity"), t(lang, "pos.field.unit_price"), t(lang, "pos.field.discount"), t(lang, "pos.field.subtotal")].map((header) => (
                              <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {saleDetail.lines.map((line) => (
                            <tr key={line.lineId} className="border-t border-slate-100">
                              <td className="px-4 py-4">
                                <div className="text-sm font-semibold text-slate-900">{lang === "zh" ? line.nameCn : line.nameEs}</div>
                                <div className="mt-1 text-xs text-slate-400">{line.spec || "-"}</div>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">{line.clave || "-"}</td>
                              <td className="px-4 py-4 text-sm text-slate-700">{line.qty}</td>
                              <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(lang, line.unitPrice)}</td>
                              <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(lang, getLineDiscount(line))}</td>
                              <td className="px-4 py-4 text-sm font-semibold text-slate-900">{formatCurrency(lang, line.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <PosEmptyState
                      title={t(lang, "pos.empty.detail_title")}
                      description={t(lang, "pos.empty.detail_description")}
                      stage={t(lang, "pos.empty.stage")}
                      future={t(lang, "pos.empty.future", { feature: t(lang, "pos.page.sales_docs.future") })}
                    />
                  )}
                </PosSectionCard>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {refundTarget ? (
        <div className="fixed inset-0 z-[73] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.confirm_refund")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRefundTarget(null);
                      setRefundReasonDraft("");
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitRefund()}
                    disabled={refundSubmitting}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refundSubmitting ? t(lang, "common.processing") : t(lang, "pos.button.confirm_refund")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {refundTarget.folio} · {refundTarget.customerName || "-"} · {formatCurrency(lang, refundTarget.total)}
                </div>
                <textarea
                  value={refundReasonDraft}
                  onChange={(event) => setRefundReasonDraft(event.target.value)}
                  placeholder={t(lang, "pos.field.reason_refund")}
                  className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {lastRefund ? (
        <div className="fixed inset-0 z-[74] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.return_order")}
              footer={
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setLastRefund(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                  >
                    {t(lang, "pos.button.ok")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  {t(lang, "pos.notice.refund_success")}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {t(lang, "pos.field.folio")}: {lastRefund.folio}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {t(lang, "pos.field.total")}: {formatCurrency(lang, lastRefund.total)}
                </div>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {inventoryDetail ? (
        <div className="fixed inset-0 z-[74] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-3xl">
            <PosModalShell
              title={t(lang, "pos.modal.inventory_detail")}
              footer={
                <div className="flex justify-end gap-2">
                  {canInventoryDamage ? (
                    <button
                      type="button"
                      onClick={() => openInventoryDamage(inventoryDetail)}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      {t(lang, "pos.button.damage_inventory")}
                    </button>
                  ) : null}
                  {canInventoryCount ? (
                    <button
                      type="button"
                      onClick={() => openInventoryCount(inventoryDetail)}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      {t(lang, "pos.button.count_inventory")}
                    </button>
                  ) : null}
                  {canInventoryAdjust ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustTarget(inventoryDetail);
                        setAdjustForm({
                          adjustType: "increase",
                          qty: 1,
                          reason: "",
                          note: "",
                          operator: "",
                        });
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      {t(lang, "pos.button.adjust_inventory")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setInventoryDetail(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                  >
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.product")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryDetail.productName}</div>
                  <div className="mt-1 text-xs text-slate-400">{inventoryDetail.spec || "-"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.product_code")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryDetail.clave}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.barcode")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryDetail.barcode || "-"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.store")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryDetail.storeId}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.inventory_on_hand")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryDetail.onHandQty}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.inventory_available")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryDetail.availableQty}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.status")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryStatusLabel(lang, inventoryDetail.status)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.quantity")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{inventoryDetail.reservedQty}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.datetime")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(lang, inventoryDetail.updatedAt)}</div>
                </div>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {damageTarget ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.inventory_damage")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDamageTarget(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitInventoryDamage()}
                    disabled={damageSubmitting}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {damageSubmitting ? t(lang, "common.processing") : t(lang, "pos.button.confirm")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.product")}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{damageTarget.productName}</div>
                  <div className="mt-1 text-xs text-slate-400">{damageTarget.clave}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {t(lang, "pos.field.current_inventory")}: {damageTarget.onHandQty}
                </div>
                <input
                  type="number"
                  min={1}
                  value={damageForm.qty}
                  onChange={(event) => setDamageForm((prev) => ({ ...prev, qty: Number(event.target.value || 0) }))}
                  placeholder={t(lang, "pos.field.damage_qty")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                />
                <input
                  value={damageForm.reason}
                  onChange={(event) => setDamageForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder={t(lang, "pos.field.reason_damage")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={damageForm.note || ""}
                  onChange={(event) => setDamageForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={t(lang, "pos.field.remark")}
                  className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {countTarget ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.inventory_count")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCountTarget(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitInventoryCount()}
                    disabled={countSubmitting}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {countSubmitting ? t(lang, "common.processing") : t(lang, "pos.button.confirm")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.product")}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{countTarget.productName}</div>
                  <div className="mt-1 text-xs text-slate-400">{countTarget.clave}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {t(lang, "pos.field.current_inventory")}: {countTarget.onHandQty}
                </div>
                <input
                  type="number"
                  min={0}
                  value={countForm.finalQty}
                  onChange={(event) => setCountForm((prev) => ({ ...prev, finalQty: Number(event.target.value || 0) }))}
                  placeholder={t(lang, "pos.field.final_inventory")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {t(lang, "pos.field.diff_qty")}: {countForm.finalQty - countTarget.onHandQty}
                </div>
                <input
                  value={countForm.reason}
                  onChange={(event) => setCountForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder={t(lang, "pos.field.reason_count")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={countForm.note || ""}
                  onChange={(event) => setCountForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={t(lang, "pos.field.remark")}
                  className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {adjustTarget ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.adjust_inventory")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustTarget(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitInventoryAdjust()}
                    disabled={adjustSubmitting}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {adjustSubmitting ? t(lang, "common.processing") : t(lang, "pos.button.confirm")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.product")}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{adjustTarget.productName}</div>
                  <div className="mt-1 text-xs text-slate-400">{adjustTarget.clave}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {t(lang, "pos.field.current_inventory")}: {adjustTarget.onHandQty}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustForm((prev) => ({ ...prev, adjustType: "increase" }))}
                    className={`inline-flex h-11 items-center justify-center rounded-xl border text-sm font-semibold ${adjustForm.adjustType === "increase" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    {t(lang, "pos.button.increase_inventory")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm((prev) => ({ ...prev, adjustType: "decrease" }))}
                    className={`inline-flex h-11 items-center justify-center rounded-xl border text-sm font-semibold ${adjustForm.adjustType === "decrease" ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    {t(lang, "pos.button.decrease_inventory")}
                  </button>
                </div>
                <input
                  type="number"
                  min={1}
                  value={adjustForm.qty}
                  onChange={(event) => setAdjustForm((prev) => ({ ...prev, qty: Number(event.target.value || 0) }))}
                  placeholder={t(lang, "pos.field.adjust_qty")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                />
                <input
                  value={adjustForm.reason}
                  onChange={(event) => setAdjustForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder={t(lang, "pos.field.reason_adjust")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={adjustForm.note || ""}
                  onChange={(event) => setAdjustForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={t(lang, "pos.field.remark")}
                  className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {transferCreateOpen ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-5xl">
            <PosModalShell
              title={t(lang, "pos.modal.create_transfer")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferCreateOpen(false);
                      resetTransferForm();
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitTransferCreate()}
                    disabled={transferSubmitting}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transferSubmitting ? t(lang, "common.processing") : t(lang, "pos.button.create_transfer")}
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <select
                    value={transferForm.fromStoreId}
                    onChange={(event) => setTransferForm((prev) => ({ ...prev, fromStoreId: event.target.value }))}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                  >
                    {transferStores.map((storeId) => (
                      <option key={`create-from-${storeId}`} value={storeId}>{storeId}</option>
                    ))}
                  </select>
                  <select
                    value={transferForm.toStoreId}
                    onChange={(event) => setTransferForm((prev) => ({ ...prev, toStoreId: event.target.value }))}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                  >
                    {transferStores.map((storeId) => (
                      <option key={`create-to-${storeId}`} value={storeId}>{storeId}</option>
                    ))}
                  </select>
                  <input
                    value={transferForm.note}
                    onChange={(event) => setTransferForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder={t(lang, "pos.placeholder.transfer_note")}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap gap-3">
                    <input
                      value={transferSearch}
                      onChange={(event) => setTransferSearch(event.target.value)}
                      placeholder={t(lang, "pos.placeholder.transfer_search")}
                      className="h-11 min-w-[280px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void searchTransferProducts()}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                    >
                      {t(lang, "pos.button.search")}
                    </button>
                  </div>
                  {transferSearchResults.length ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {transferSearchResults.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addTransferLine(item)}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-primary/40"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{lang === "zh" ? item.nameCn : item.nameEs}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.clave} / {item.barcode}</div>
                          </div>
                          <div className="text-xs font-semibold text-primary">{t(lang, "pos.button.new")}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed">
                      <thead className="bg-slate-50">
                        <tr>
                          {[t(lang, "pos.field.product"), t(lang, "pos.field.product_code"), t(lang, "pos.field.barcode"), t(lang, "pos.field.quantity"), t(lang, "pos.field.actions")].map((header) => (
                            <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {transferForm.lines.length ? transferForm.lines.map((line) => (
                          <tr key={line.productId} className="border-t border-slate-100">
                            <td className="px-4 py-4">
                              <div className="text-sm font-semibold text-slate-900">{lang === "zh" ? line.nameCn : line.nameEs}</div>
                              <div className="mt-1 text-xs text-slate-400">{line.spec || "-"}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">{line.clave || "-"}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{line.barcode || "-"}</td>
                            <td className="px-4 py-4">
                              <input
                                type="number"
                                min={1}
                                value={line.qty}
                                onChange={(event) => updateTransferLineQty(line.productId, Number(event.target.value || 0))}
                                className="h-10 w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                              />
                            </td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() => removeTransferLine(line.productId)}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                              >
                                {t(lang, "pos.button.delete")}
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-10">
                              <PosEmptyState
                                title={t(lang, "pos.empty.detail_title")}
                                description={t(lang, "pos.empty.detail_description")}
                                stage={t(lang, "pos.empty.stage")}
                                future={t(lang, "pos.page.transfers.future")}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {transferDetail ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-5xl">
            <PosModalShell
              title={t(lang, "pos.modal.transfer_detail")}
              footer={
                <div className="flex flex-wrap justify-end gap-2">
                  {canTransferSend ? (
                    <button
                      type="button"
                      onClick={() => void sendTransferRecord(transferDetail.id)}
                      disabled={transferDetail.status !== "draft" || transferActionSubmitting}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t(lang, "pos.button.send_transfer")}
                    </button>
                  ) : null}
                  {canTransferReceive ? (
                    <button
                      type="button"
                      onClick={() => void receiveTransferRecord(transferDetail.id)}
                      disabled={transferDetail.status !== "sent" || transferActionSubmitting}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t(lang, "pos.button.receive_transfer")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setTransferDetail(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                  >
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.folio")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{transferDetail.folio}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.from_store")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{transferDetail.fromStoreId}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.to_store")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{transferDetail.toStoreId}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.status")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{transferStatusLabel(lang, transferDetail.status)}</div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.datetime")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(lang, transferDetail.createdAt)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.sent_at")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{transferDetail.sentAt ? formatDateTime(lang, transferDetail.sentAt) : "-"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.received_at")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{transferDetail.receivedAt ? formatDateTime(lang, transferDetail.receivedAt) : "-"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">{t(lang, "pos.field.user")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{transferDetail.createdByName}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t(lang, "pos.field.remark")}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{transferDetail.note || "-"}</div>
                </div>

                <PosSectionCard title={t(lang, "pos.section.list")}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed">
                      <thead className="bg-slate-50">
                        <tr>
                          {[t(lang, "pos.field.product"), t(lang, "pos.field.product_code"), t(lang, "pos.field.barcode"), t(lang, "pos.field.quantity")].map((header) => (
                            <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(transferDetail.lines || []).map((line) => (
                          <tr key={line.lineId} className="border-t border-slate-100">
                            <td className="px-4 py-4">
                              <div className="text-sm font-semibold text-slate-900">{lang === "zh" ? line.nameCn : line.nameEs}</div>
                              <div className="mt-1 text-xs text-slate-400">{line.spec || "-"}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">{line.clave || "-"}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{line.barcode || "-"}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{line.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </PosSectionCard>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {ticketPreview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-2xl">
            <PosModalShell
              title={t(lang, "pos.modal.print_ticket")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketPreview(null)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.close")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        try {
                          await printPosTicket(ticketPreview, lang);
                        } catch (error) {
                          setErrorMessage(posErrorLabel(lang, error instanceof Error ? error.message : String(error)));
                        }
                      })();
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                  >
                    {t(lang, "pos.button.print_ticket")}
                  </button>
                </div>
              }
            >
              <PosTicketPreview lang={lang} ticket={ticketPreview} />
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {auditDetail ? (
        <div className="fixed inset-0 z-[81] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-3xl">
            <PosModalShell
              title={t(lang, "pos.modal.audit_detail")}
              footer={
                <div className="flex justify-end">
                  <button type="button" onClick={() => setAuditDetail(null)} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="grid gap-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.datetime")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{formatDateTime(lang, auditDetail.createdAt)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.action")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{auditActionLabel(lang, auditDetail.actionType)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.result")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{auditResultLabel(lang, auditDetail.resultStatus)}</div>
                  </div>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.user")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{auditDetail.actorName}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.role")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{posRoleLabel(lang, auditDetail.actorRole)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.module")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{auditModuleLabel(lang, auditDetail.module)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.store")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{auditDetail.storeId || "-"}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.target")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{auditTargetLabel(lang, auditDetail.targetType)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.target_id")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900 break-all">{auditFieldValue(auditDetail.targetId)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">{t(lang, "pos.field.folio")}</div>
                    <div className="mt-1 text-[13px] font-semibold text-slate-900">{auditFieldValue(auditDetail.targetFolio)}</div>
                  </div>
                </div>
                <PosSectionCard title={t(lang, "pos.field.summary")}>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] leading-5 text-slate-700">{auditDetail.summary}</div>
                </PosSectionCard>
                {auditDetail.keyFields?.length ? (
                  <PosSectionCard title={t(lang, "pos.section.key_fields")}>
                    <div className="grid gap-2 md:grid-cols-2">
                      {auditDetail.keyFields.map((field, index) => (
                        <div key={`${field.labelKey}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                          <div className="text-[11px] text-slate-500">{t(lang, field.labelKey)}</div>
                          <div className="mt-1 text-[13px] font-semibold text-slate-900 break-words">{auditDisplayValue(lang, field.labelKey, field.value)}</div>
                        </div>
                      ))}
                    </div>
                  </PosSectionCard>
                ) : null}
                {auditDetail.changeFields?.length ? (
                  <PosSectionCard title={t(lang, "pos.field.changes")}>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            {[t(lang, "pos.field.field_name"), t(lang, "pos.field.before"), t(lang, "pos.field.after"), t(lang, "pos.field.diff_qty")].map((header) => (
                              <th key={header} className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {auditDetail.changeFields.map((field, index) => (
                            <tr key={`${field.labelKey}-${index}`} className="border-t border-slate-100">
                              <td className="px-2.5 py-2 text-[11px] text-slate-700">{t(lang, field.labelKey)}</td>
                              <td className="px-2.5 py-2 text-[11px] text-slate-700">{auditDisplayValue(lang, field.labelKey, field.before)}</td>
                              <td className="px-2.5 py-2 text-[11px] text-slate-700">{auditDisplayValue(lang, field.labelKey, field.after)}</td>
                              <td className="px-2.5 py-2 text-[11px] text-slate-700">{auditFieldValue(field.change)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </PosSectionCard>
                ) : null}
                {auditDetail.detailFields?.length ? (
                  <PosSectionCard title={t(lang, "pos.field.details")}>
                    <div className="space-y-1.5">
                      {auditDetail.detailFields.map((field, index) => (
                        <div key={`${field.labelKey}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                          <div className="text-[11px] text-slate-500">{t(lang, field.labelKey)}</div>
                          <div className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-700">{auditDisplayValue(lang, field.labelKey, field.value)}</div>
                        </div>
                      ))}
                    </div>
                  </PosSectionCard>
                ) : null}
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {cashierCategoryModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-xl">
            <PosModalShell
              title={lang === "zh" ? "更多分类" : "Más categorías"}
              footer={
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <button
                      type="button"
                      onClick={() => setCashierCategoryPage((page) => Math.max(1, page - 1))}
                      disabled={cashierCategoryCurrentPage <= 1}
                      className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <span>{cashierCategoryCurrentPage} / {cashierCategoryTotalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCashierCategoryPage((page) => Math.min(cashierCategoryTotalPages, page + 1))}
                      disabled={cashierCategoryCurrentPage >= cashierCategoryTotalPages}
                      className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                  <button type="button" onClick={() => setCashierCategoryModalOpen(false)} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                    {t(lang, "pos.button.close")}
                  </button>
                </div>
              }
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {cashierCategoryPagedItems.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setCashierPrimaryCategory(category);
                      setCashierSecondaryCategory("");
                      setCashierCategoryModalOpen(false);
                    }}
                    className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold transition ${
                      cashierPrimaryCategory === category
                        ? "bg-primary text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-primary"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {openingCashModalOpen ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-md">
            <PosModalShell
              title={openingCashLabel(lang)}
              shellClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpeningCashModalOpen(false)}
                    className={`inline-flex h-8 items-center justify-center border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={confirmOpeningCash}
                    className={`inline-flex h-8 items-center justify-center bg-primary px-3 text-xs font-semibold text-white ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {t(lang, "pos.button.confirm")}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  {lang === "zh" ? "录入当天开业现金，系统会用于计算当日钱箱现金。" : "Ingresa el efectivo inicial del dia para calcular el efectivo actual del cajon."}
                </div>
                <input
                  data-cashier-focus-unlocked="true"
                  value={openingCashDraft}
                  onChange={(event) => setOpeningCashDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      confirmOpeningCash();
                    }
                  }}
                  placeholder={lang === "zh" ? "请输入开业现金" : "Ingresa el efectivo inicial"}
                  className={`h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                />
                <div className={`border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}>
                  {lang === "zh"
                    ? `当前钱箱现金 = 开业现金 + 今日现金营业额 = ${formatCurrency(lang, cashierOpeningDrawerBalance)}`
                    : `Efectivo actual del cajon = efectivo inicial + ventas en efectivo del dia = ${formatCurrency(lang, cashierOpeningDrawerBalance)}`}
                </div>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {cashDrawerModalOpen ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-md">
            <PosModalShell
              title={openDrawerLabel(lang)}
              shellClassName={cashierLayout2Active ? "!rounded-none" : ""}
              titleBarClassName={`${cashierLayout2Active ? "!rounded-none " : ""}hidden`}
              bodyClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footerClassName={cashierLayout2Active ? "!rounded-none" : ""}
              fieldClassName={cashierLayout2Active ? "!rounded-none" : ""}
              emptyClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCashDrawerModalOpen(false);
                      setCashDrawerPasswordDraft("");
                      setCashDrawerMessage("");
                    }}
                    className={`inline-flex h-8 items-center justify-center border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr] md:items-stretch">
                <div className={`border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}>
                  <div className="space-y-2">
                    <div className="text-base font-semibold text-slate-900">
                      {lang === "zh" ? "当前钱箱现金" : "Efectivo actual del cajon"}
                    </div>
                    <div>{openingCashLabel(lang)}：{formatCurrency(lang, openingCashAmount)}</div>
                    <div className="text-left text-base font-bold text-slate-500">+</div>
                    <div>{lang === "zh" ? "当天营业现金" : "Ventas en efectivo del dia"}：{formatCurrency(lang, todayCashSalesTotal)}</div>
                    <div className="text-left text-base font-bold text-slate-500">+</div>
                    <div className="text-base font-semibold text-slate-900">{lang === "zh" ? "合计" : "Total"}：{formatCurrency(lang, cashierOpeningDrawerBalance)}</div>
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-3">
                  <div className="text-sm font-medium text-slate-600">{cashierPasswordPromptLabel(lang)}</div>
                  <input
                    data-cashier-focus-unlocked="true"
                    type="password"
                    value={cashDrawerPasswordDraft}
                    onChange={(event) => setCashDrawerPasswordDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleOpenCashDrawer();
                      }
                    }}
                    placeholder={t(lang, "pos.field.password")}
                    className={`h-10 w-full border border-slate-300 bg-white px-3 text-base text-slate-700 outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  />
                  {cashDrawerMessage ? (
                    <div className="text-base text-red-500">{cashDrawerMessage}</div>
                  ) : <div className="min-h-[20px]" />}
                  <button
                    type="button"
                    onClick={() => void handleOpenCashDrawer()}
                    disabled={cashDrawerSubmitting}
                    className={`inline-flex h-10 w-full items-center justify-center bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {cashDrawerSubmitting ? t(lang, "common.processing") : openDrawerConfirmLabel(lang)}
                  </button>
                </div>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {cashierUnlockModalOpen ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-md">
            <PosModalShell
              title={cashierClosedPasswordTitle(lang)}
              shellClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCashierUnlockModalOpen(false);
                      setCashierUnlockPasswordDraft("");
                      setCashierUnlockError("");
                    }}
                    className={`inline-flex h-9 items-center justify-center border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUnlockCashier()}
                    disabled={cashierUnlockSubmitting}
                    className={`inline-flex h-9 items-center justify-center bg-primary px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {cashierUnlockSubmitting ? t(lang, "common.processing") : cashierClosedButtonLabel(lang)}
                  </button>
                </div>
              }
            >
              <div className="space-y-3">
                <input
                  data-cashier-focus-unlocked="true"
                  type="password"
                  value={cashierUnlockPasswordDraft}
                  onChange={(event) => setCashierUnlockPasswordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleUnlockCashier();
                    }
                  }}
                  placeholder={t(lang, "pos.field.password")}
                  className={`h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                />
                {cashierUnlockError ? (
                  <div className="text-sm text-red-500">{cashierUnlockError}</div>
                ) : null}
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {cashierCustomerModalOpen ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-lg">
            <PosModalShell
              title={t(lang, "pos.button.customer_note")}
              shellClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCashierCustomerModalOpen(false)}
                    className={`inline-flex h-8 items-center justify-center border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashierCustomerModalOpen(false)}
                    className={`inline-flex h-8 items-center justify-center bg-primary px-3 text-xs font-semibold text-white ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                  >
                    {t(lang, "common.save")}
                  </button>
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={cart.customer.name}
                  onChange={(event) => setCart((prev) => setCustomerField(prev, "name", event.target.value))}
                  placeholder={t(lang, "pos.field.customer")}
                  className={`h-9 border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary md:col-span-2 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                />
                <input
                  value={cart.customer.phone}
                  onChange={(event) => setCart((prev) => setCustomerField(prev, "phone", event.target.value))}
                  placeholder={t(lang, "pos.field.phone")}
                  className={`h-9 border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                />
                <input
                  value={cart.customer.rfc || ""}
                  onChange={(event) => setCart((prev) => setCustomerField(prev, "rfc", event.target.value))}
                  placeholder={t(lang, "pos.field.rfc")}
                  className={`h-9 border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                />
                <textarea
                  value={cart.customer.notes || ""}
                  onChange={(event) => setCart((prev) => setCustomerField(prev, "notes", event.target.value))}
                  placeholder={t(lang, "pos.field.remark")}
                  className={`min-h-[92px] border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-primary md:col-span-2 ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}
                />
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {cashierEditorOpen ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-[1100px]">
            <PosModalShell
              title={editingCashierId ? t(lang, "common.edit") : t(lang, "pos.button.new_cashier")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCashierEditorOpen(false);
                      resetCashierForm();
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  {canCashierManage ? (
                    <button
                      type="button"
                      onClick={() => void submitCashier()}
                      disabled={cashierSaving}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cashierSaving ? t(lang, "common.saving") : t(lang, "common.save")}
                    </button>
                  ) : (
                    <div className="inline-flex h-9 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-400">
                      {t(lang, "pos.notice.permission_denied")}
                    </div>
                  )}
                </div>
              }
            >
              <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-3">
              <PosSectionCard title={lang === "zh" ? "基本资料" : "DATOS BASE"}>
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                <input
                  value={cashierForm.name}
                  disabled={!canCashierManage}
                  onChange={(event) => setCashierForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={t(lang, "pos.field.user")}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
                />
                <input
                  value={cashierForm.account}
                  disabled={!canCashierManage}
                  onChange={(event) => setCashierForm((prev) => ({ ...prev, account: event.target.value }))}
                  placeholder={t(lang, "pos.field.account")}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
                />
                <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-2.5">
                  <select
                    value={cashierForm.phoneCountry || "MX"}
                    disabled={!canCashierManage}
                    onChange={(event) => setCashierForm((prev) => ({ ...prev, phoneCountry: event.target.value }))}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {PHONE_COUNTRIES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {lang === "zh" ? item.labelZh : item.labelEs}
                      </option>
                    ))}
                  </select>
                  <input
                    value={cashierForm.phone}
                    disabled={!canCashierManage}
                    onChange={(event) => setCashierForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder={lang === "zh" ? "WhatsApp / 联系电话" : "WHATSAPP / TEL."}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <input
                  value={cashierForm.email || ""}
                  disabled={!canCashierManage}
                  onChange={(event) => setCashierForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Email"
                  className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
                />
                <select
                  value={cashierForm.storeId}
                  onChange={(event) => setCashierForm((prev) => ({ ...prev, storeId: event.target.value }))}
                  disabled={!canCashierManage || !posAccess.allowAllStores}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {storeOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <select
                  value={cashierForm.role}
                  onChange={(event) => setCashierForm((prev) => ({ ...prev, role: event.target.value as PosCashierRole }))}
                  disabled={!canCashierManage || posAccess.role !== "admin_general"}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {posAccess.role === "admin_general" ? <option value="admin_general">{t(lang, "pos.role.admin_general")}</option> : null}
                  {posAccess.role === "admin_general" ? <option value="store_admin">{t(lang, "pos.role.store_admin")}</option> : null}
                  <option value="cashier">{t(lang, "pos.role.cashier")}</option>
                </select>
                <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 md:col-span-2 xl:col-span-3">
                  <input
                    type="checkbox"
                    checked={cashierForm.active}
                    disabled={!canCashierManage}
                    onChange={(event) => setCashierForm((prev) => ({ ...prev, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  {t(lang, "pos.field.active")}
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 md:col-span-2 xl:col-span-3">
                  <div className="text-xs font-semibold text-slate-700">
                    {editingCashierId ? (lang === "zh" ? "密码修改" : "CAMBIO DE CLAVE") : t(lang, "pos.field.password")}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {editingCashierId
                      ? t(lang, "pos.placeholder.password_optional")
                      : (lang === "zh" ? "请输入收银员登录密码" : "Ingresa la clave de acceso del cajero")}
                  </div>
                  <input
                    value={cashierForm.password || ""}
                    disabled={!canCashierManage}
                    onChange={(event) => setCashierForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder={editingCashierId ? t(lang, "pos.placeholder.password_optional") : t(lang, "pos.field.password")}
                    type="password"
                    className="mt-2 h-8 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>
              </PosSectionCard>
              <div className="grid gap-3 xl:grid-cols-[0.74fr_1.26fr]">
                <PosSectionCard title={t(lang, "pos.field.role_default_permissions")}>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(cashierForm.role ? [...getDefaultPosActionPermissionKeysByRole(cashierForm.role)] : [])).map((permissionKey) => {
                      const definition = getAppPermissionDefinition(permissionKey);
                      return (
                        <span key={permissionKey} className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {definition?.label || permissionKey}
                        </span>
                      );
                    })}
                  </div>
                </PosSectionCard>
                <PosSectionCard title={t(lang, "pos.field.permission_effect")}>
                  <div className="space-y-2">
                    {POS_PERMISSION_GROUPS.map((group) => (
                      <div key={group.key} className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t(lang, group.titleKey)}</div>
                        <div className="grid gap-1.5 md:grid-cols-2">
                          {group.permissions.map((permissionKey) => {
                            const effect = getCashierPermissionEffect(permissionKey);
                            const definition = getAppPermissionDefinition(permissionKey);
                            return (
                              <div key={permissionKey} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <div className="text-[11px] font-semibold leading-4 text-slate-800">{definition?.label || permissionKey}</div>
                                <div className="mt-1.5 grid grid-cols-3 gap-1">
                                  <button
                                    type="button"
                                    disabled={!canCashierManage}
                                    onClick={() => setCashierPermissionEffect(permissionKey, "inherit")}
                                    className={`inline-flex h-6 items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold ${effect === null ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {t(lang, "pos.field.permission_inherit")}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canCashierManage}
                                    onClick={() => setCashierPermissionEffect(permissionKey, "grant")}
                                    className={`inline-flex h-6 items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold ${effect === "grant" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {t(lang, "pos.field.extra_grants")}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canCashierManage}
                                    onClick={() => setCashierPermissionEffect(permissionKey, "deny")}
                                    className={`inline-flex h-6 items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold ${effect === "deny" ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {t(lang, "pos.field.explicit_denies")}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </PosSectionCard>
              </div>
              </div>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {labelPrintState.open ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="w-full max-w-6xl">
            <PosModalShell
              title={t(lang, "pos.modal.print_labels")}
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLabelPrintState((prev) => ({ ...prev, open: false }))}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {t(lang, "pos.button.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintLabels}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                  >
                    {t(lang, "pos.button.print_labels")}
                  </button>
                </div>
              }
            >
              <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-3">
                  <PosSectionCard title={t(lang, "pos.field.label_template")}>
                    <div className="grid grid-cols-2 gap-2">
                      {(["product", "shelf"] as PosLabelTemplateType[]).map((template) => (
                        <button
                          key={template}
                          type="button"
                          onClick={() => setLabelPrintState((prev) => ({ ...prev, template }))}
                          className={`inline-flex h-9 items-center justify-center rounded-lg border text-xs font-semibold ${labelPrintState.template === template ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}
                        >
                          {t(lang, template === "product" ? "pos.label.product" : "pos.label.shelf")}
                        </button>
                      ))}
                    </div>
                  </PosSectionCard>
                  <PosSectionCard title={t(lang, "pos.field.label_size")}>
                    <div className="grid grid-cols-2 gap-2">
                      {(["40x50", "80x50"] as PosLabelSize[]).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setLabelPrintState((prev) => ({ ...prev, size }))}
                          className={`inline-flex min-h-[52px] items-center justify-center rounded-lg border px-3 text-center text-xs font-semibold leading-4 ${labelPrintState.size === size ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}
                        >
                          {labelSizeLabel(lang, size)}
                        </button>
                      ))}
                    </div>
                  </PosSectionCard>
                  <PosSectionCard title={t(lang, "pos.field.copies")}>
                    <div className="space-y-2">
                      {labelPrintState.items.map((item, index) => (
                        <div key={`${item.productId}-${index}`} className="grid grid-cols-[1fr_96px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div>
                            <div className="text-[13px] font-semibold text-slate-800">{item.nameCn || item.nameEs}</div>
                            <div className="mt-1 text-[11px] text-slate-400">{item.clave}</div>
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={item.copies}
                            onChange={(event) => {
                              const copies = Math.max(1, Number(event.target.value || 1));
                              setLabelPrintState((prev) => ({
                                ...prev,
                                items: prev.items.map((row, rowIndex) => rowIndex === index ? { ...row, copies } : row),
                              }));
                            }}
                            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </PosSectionCard>
                  <PosSectionCard title={t(lang, "pos.field.display_fields")}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(labelPrintState.fields).map(([fieldKey, enabled]) => {
                        const fieldLabelKey =
                          fieldKey === "price"
                            ? "pos.field.price"
                            : fieldKey === "nameCn"
                              ? "pos.field.name_cn"
                              : fieldKey === "nameEs"
                                ? "pos.field.name_es"
                                : fieldKey === "shortDescription"
                                  ? "pos.field.short_description"
                                  : (`pos.field.${fieldKey}` as const);
                        return (
                        <label key={fieldKey} className="inline-flex h-9 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => setLabelPrintState((prev) => ({
                              ...prev,
                              fields: { ...prev.fields, [fieldKey]: event.target.checked },
                            }))}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span>{t(lang, fieldLabelKey as never)}</span>
                        </label>
                      )})}
                    </div>
                  </PosSectionCard>
                </div>
                <PosSectionCard title={t(lang, "pos.section.preview_panel")} description={t(lang, "pos.section.live_preview")}>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                    <div className={`grid gap-3 ${labelPrintState.size === "80x50" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                      {labelPrintState.items.slice(0, 4).map((item, index) => (
                        <div key={`${item.productId}-preview-${index}`} className={`overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-sm ${labelPrintState.size === "80x50" ? "min-h-[178px] px-4 py-3" : "min-h-[222px] px-3 py-2.5"}`}>
                          <div className={`grid gap-2 ${labelPrintState.size === "80x50" ? "grid-cols-[72px_minmax(0,1fr)] items-start" : "grid-cols-1"}`}>
                            <div className={`overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${labelPrintState.size === "80x50" ? "h-16 w-[72px]" : "h-20 w-full"}`}>
                              {item.imageUrl ? <img src={item.imageUrl} alt={item.nameCn || item.nameEs} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-300">IMG</div>}
                            </div>
                            <div className="min-w-0">
                              {labelPrintState.fields.price ? <div className={`${labelPrintState.size === "80x50" ? "text-xl" : "text-lg"} font-bold leading-none text-slate-900`}>{formatCurrency(lang, item.price)}</div> : null}
                              {labelPrintState.fields.nameCn ? <div className={`mt-2 line-clamp-2 font-semibold text-slate-800 ${labelPrintState.size === "80x50" ? "text-sm" : "text-[13px]"}`}>{item.nameCn}</div> : null}
                              {labelPrintState.fields.nameEs ? <div className={`mt-1 line-clamp-2 text-slate-500 ${labelPrintState.size === "80x50" ? "text-[11px]" : "text-[10px]"}`}>{item.nameEs}</div> : null}
                              {labelPrintState.fields.clave ? <div className="mt-1.5 text-[10px] font-medium text-slate-500">{t(lang, "pos.field.clave")}: {item.clave}</div> : null}
                              {labelPrintState.fields.origin && item.origin ? <div className="mt-1 text-[10px] text-slate-500">{t(lang, "pos.field.origin")}: {item.origin}</div> : null}
                              {labelPrintState.fields.importer && item.importer ? <div className="mt-1 text-[10px] text-slate-500">{t(lang, "pos.field.importer")}: {item.importer}</div> : null}
                              {labelPrintState.fields.shortDescription && item.shortDescription ? <div className="mt-1.5 line-clamp-2 text-[10px] text-slate-400">{item.shortDescription}</div> : null}
                            </div>
                          </div>
                          {labelPrintState.fields.barcode ? (
                            canRenderEan13Barcode(item.barcode || "") ? (
                              <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white px-1 py-1" dangerouslySetInnerHTML={{ __html: buildBarcodeSvgMarkup(normalizeEan13Barcode(item.barcode || ""), { width: labelPrintState.size === "80x50" ? 1.32 : 1.02, height: labelPrintState.size === "80x50" ? 30 : 24, displayValue: true, margin: 0 }) }} />
                            ) : (
                              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-700">{t(lang, "pos.notice.barcode_not_printable")}</div>
                            )
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </PosSectionCard>
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {noticeMessage ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "common.success")}
              footer={
                <div className="flex justify-end">
                  <button type="button" onClick={() => setNoticeMessage("")} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
                    {t(lang, "pos.button.ok")}
                  </button>
                </div>
              }
            >
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                {noticeMessage}
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md">
            <PosModalShell
              title={t(lang, "pos.modal.error_notice")}
              shellClassName={cashierLayout2Active ? "!rounded-none" : ""}
              footer={
                <div className="flex justify-end">
                  <button type="button" onClick={() => setErrorMessage("")} className={`inline-flex h-10 items-center justify-center bg-primary px-4 text-sm font-semibold text-white ${cashierLayout2Active ? "rounded-none" : "rounded-xl"}`}>
                    {t(lang, "pos.button.ok")}
                  </button>
                </div>
              }
            >
              <div className={`${cashierLayout2Active ? "rounded-none" : "rounded-xl"} border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700`}>
                {errorMessage}
              </div>
            </PosModalShell>
          </div>
        </div>
      ) : null}
    </div>
  );
}
