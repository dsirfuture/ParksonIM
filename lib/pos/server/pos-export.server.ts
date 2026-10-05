import ExcelJS from "exceljs";
import { type Lang, t } from "@/lib/i18n";
import { getPosAuditActionLabelKey, getPosAuditModuleLabelKey, getPosAuditTargetLabelKey } from "@/lib/pos/audit-labels";
import { type PosAuditLogItem, type PosDashboardSummary, type PosInventoryItem, type PosInventoryMovementItem, type PosInventoryOverview, type PosPaymentsSummary, type PosReplenishmentSuggestionItem, type PosSaleListItem, type PosSalesTrendPoint, type PosTopProductsReport } from "@/lib/pos/types";

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(",", "");
}

function formatDateStamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
  return parts;
}

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .trim();
}

function paymentLabel(lang: Lang, method: string | null | undefined) {
  if (method === "cash") return t(lang, "pos.payment.cash");
  if (method === "transfer") return t(lang, "pos.payment.transfer");
  if (method === "card") return t(lang, "pos.payment.card");
  return "-";
}

function recordStatusLabel(lang: Lang, status: string | null | undefined) {
  if (status === "refunded") return t(lang, "pos.status.refunded");
  if (status === "completed") return t(lang, "pos.status.completed");
  if (status === "converted") return t(lang, "pos.status.converted");
  return status || "-";
}

function sourceTypeLabel(lang: Lang, sourceType: string | null | undefined) {
  if (sourceType === "suspended") return t(lang, "pos.status.source_suspended");
  if (sourceType === "quote") return t(lang, "pos.status.source_quote");
  return t(lang, "pos.status.source_direct");
}

function inventoryStatusLabel(lang: Lang, status: string | null | undefined) {
  if (status === "low") return t(lang, "pos.status.low_inventory");
  if (status === "out") return t(lang, "pos.status.out_of_stock");
  return t(lang, "pos.status.inventory_ok");
}

function replenishmentStatusLabel(lang: Lang, item: PosReplenishmentSuggestionItem) {
  const parts: string[] = [];
  if (item.inventoryStatus === "out") parts.push(t(lang, "pos.status.out_of_stock"));
  else if (item.inventoryStatus === "low") parts.push(t(lang, "pos.status.low_inventory"));
  else parts.push(t(lang, "pos.status.inventory_ok"));
  if (item.suggestionStatus === "suggested") parts.push(t(lang, "pos.status.replenishment_suggested"));
  return parts.join(" / ");
}

function inventoryMoveTypeLabel(lang: Lang, moveType: string | null | undefined) {
  if (moveType === "sale") return t(lang, "pos.status.move_sale");
  if (moveType === "return") return t(lang, "pos.status.move_return");
  if (moveType === "adjust") return t(lang, "pos.status.move_adjust");
  if (moveType === "import") return t(lang, "pos.status.move_import");
  if (moveType === "count") return t(lang, "pos.status.move_count");
  if (moveType === "damage") return t(lang, "pos.status.move_damage");
  if (moveType === "transfer_out") return t(lang, "pos.status.move_transfer_out");
  if (moveType === "transfer_in") return t(lang, "pos.status.move_transfer_in");
  return moveType || "-";
}

function splitReasonAndNote(note: string | null | undefined) {
  const value = String(note || "").trim();
  if (!value) return { reason: "", note: "" };
  const [reason, ...rest] = value.split("|").map((item) => item.trim()).filter(Boolean);
  return {
    reason: reason || "",
    note: rest.join(" | "),
  };
}

function auditResultLabel(lang: Lang, status: string | null | undefined) {
  if (status === "success") return t(lang, "pos.status.audit_success");
  if (status === "failed") return t(lang, "pos.status.audit_failed");
  if (status === "denied") return t(lang, "pos.status.audit_denied");
  return status || "-";
}

function stringifyJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, size: 11, color: { argb: "FF475569" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });
}

function styleBody(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        left: { style: "thin", color: { argb: "FFF1F5F9" } },
        bottom: { style: "thin", color: { argb: "FFF1F5F9" } },
        right: { style: "thin", color: { argb: "FFF1F5F9" } },
      };
      cell.alignment = { vertical: "middle" };
      cell.font = { size: 10, color: { argb: "FF0F172A" } };
    });
  });
}

function makeWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ParksonIM";
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

export function buildPosExportFileName(prefix: string) {
  return sanitizeFileName(`${prefix}-${formatDateStamp()}.xlsx`);
}

export async function buildPosSalesExportXlsx(lang: Lang, items: PosSaleListItem[]) {
  const workbook = makeWorkbook();
  const sheet = workbook.addWorksheet(lang === "zh" ? "销售单据" : "VTAS.");
  sheet.columns = [
    { header: t(lang, "pos.field.folio"), key: "folio", width: 24 },
    { header: t(lang, "pos.field.datetime"), key: "createdAt", width: 20 },
    { header: t(lang, "pos.field.status"), key: "status", width: 14 },
    { header: t(lang, "pos.field.customer"), key: "customer", width: 20 },
    { header: t(lang, "pos.field.cashier"), key: "cashier", width: 18 },
    { header: t(lang, "pos.field.payment_method"), key: "payment", width: 16 },
    { header: t(lang, "pos.field.subtotal"), key: "subtotal", width: 14 },
    { header: t(lang, "pos.field.discount"), key: "discount", width: 14 },
    { header: t(lang, "pos.field.total"), key: "total", width: 14 },
    { header: t(lang, "pos.field.source_type"), key: "sourceType", width: 14 },
    { header: t(lang, "pos.field.source_folio"), key: "sourceFolio", width: 24 },
    { header: t(lang, "pos.field.remark"), key: "note", width: 28 },
  ];
  styleHeader(sheet.getRow(1));
  items.forEach((item) => {
    sheet.addRow({
      folio: item.folio,
      createdAt: formatDateTime(item.createdAt),
      status: recordStatusLabel(lang, item.status),
      customer: item.customerName || "-",
      cashier: item.cashierName || "-",
      payment: paymentLabel(lang, item.paymentMethod),
      subtotal: formatMoney(item.subtotal),
      discount: formatMoney(item.discountTotal),
      total: formatMoney(item.total),
      sourceType: sourceTypeLabel(lang, item.sourceType),
      sourceFolio: item.sourceFolio || item.sourceId || "-",
      note: item.note || "-",
    });
  });
  styleBody(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildPosInventoryExportXlsx(lang: Lang, items: PosInventoryItem[]) {
  const workbook = makeWorkbook();
  const sheet = workbook.addWorksheet(lang === "zh" ? "门店库存" : "INV. TIENDA");
  sheet.columns = [
    { header: t(lang, "pos.field.store"), key: "store", width: 18 },
    { header: t(lang, "pos.field.product"), key: "product", width: 28 },
    { header: t(lang, "pos.field.product_code"), key: "clave", width: 18 },
    { header: t(lang, "pos.field.barcode"), key: "barcode", width: 20 },
    { header: t(lang, "pos.field.inventory_on_hand"), key: "onHandQty", width: 12 },
    { header: t(lang, "pos.field.inventory_available"), key: "availableQty", width: 14 },
    { header: t(lang, "pos.field.status"), key: "status", width: 14 },
    { header: t(lang, "pos.field.updated_at"), key: "updatedAt", width: 20 },
  ];
  styleHeader(sheet.getRow(1));
  items.forEach((item) => {
    sheet.addRow({
      store: item.storeId,
      product: item.productName,
      clave: item.clave,
      barcode: item.barcode || "-",
      onHandQty: item.onHandQty,
      availableQty: item.availableQty,
      status: inventoryStatusLabel(lang, item.status),
      updatedAt: formatDateTime(item.updatedAt),
    });
  });
  styleBody(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildPosInventoryMovementsExportXlsx(lang: Lang, items: PosInventoryMovementItem[]) {
  const workbook = makeWorkbook();
  const sheet = workbook.addWorksheet(lang === "zh" ? "库存流水" : "MOV. INV.");
  sheet.columns = [
    { header: t(lang, "pos.field.datetime"), key: "createdAt", width: 20 },
    { header: t(lang, "pos.field.store"), key: "store", width: 18 },
    { header: t(lang, "pos.field.product"), key: "product", width: 28 },
    { header: t(lang, "pos.field.product_code"), key: "clave", width: 18 },
    { header: t(lang, "pos.field.move_type"), key: "moveType", width: 18 },
    { header: t(lang, "pos.field.quantity"), key: "qtyChange", width: 12 },
    { header: t(lang, "pos.field.qty_before"), key: "qtyBefore", width: 12 },
    { header: t(lang, "pos.field.qty_after"), key: "qtyAfter", width: 12 },
    { header: t(lang, "pos.field.source_type"), key: "sourceType", width: 16 },
    { header: t(lang, "pos.field.folio"), key: "sourceFolio", width: 24 },
    { header: t(lang, "pos.field.user"), key: "user", width: 18 },
    { header: t(lang, "pos.field.reason"), key: "reason", width: 20 },
    { header: t(lang, "pos.field.remark"), key: "note", width: 28 },
  ];
  styleHeader(sheet.getRow(1));
  items.forEach((item) => {
    const { reason, note } = splitReasonAndNote(item.note);
    sheet.addRow({
      createdAt: formatDateTime(item.createdAt),
      store: item.storeId,
      product: item.productName,
      clave: item.clave,
      moveType: inventoryMoveTypeLabel(lang, item.moveType),
      qtyChange: item.qtyChange,
      qtyBefore: item.qtyBefore,
      qtyAfter: item.qtyAfter,
      sourceType: item.sourceType || "-",
      sourceFolio: item.sourceFolio || "-",
      user: item.createdBy || "-",
      reason: reason || "-",
      note: note || "-",
    });
  });
  styleBody(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildPosFinanceExportXlsx(
  lang: Lang,
  input: {
    summary: PosDashboardSummary;
    payments: PosPaymentsSummary;
    trend: PosSalesTrendPoint[];
  },
) {
  const workbook = makeWorkbook();
  const summarySheet = workbook.addWorksheet(lang === "zh" ? "财务统计" : "EST. FIN.");
  summarySheet.columns = [
    { header: lang === "zh" ? "指标" : "INDICADOR", key: "label", width: 26 },
    { header: lang === "zh" ? "数值" : "VALOR", key: "value", width: 18 },
  ];
  styleHeader(summarySheet.getRow(1));
  [
    [t(lang, "pos.field.sales_total"), formatMoney(input.summary.salesTotal)],
    [t(lang, "pos.field.refund_total"), formatMoney(input.summary.refundTotal)],
    [t(lang, "pos.field.net_sales_total"), formatMoney(input.summary.netSalesTotal)],
    [t(lang, "pos.field.order_count"), String(input.summary.orderCount)],
    [t(lang, "pos.field.refunded_order_count"), String(input.summary.refundedOrderCount)],
    [t(lang, "pos.field.avg_ticket"), formatMoney(input.summary.avgTicket)],
    [paymentLabel(lang, "cash"), formatMoney(input.payments.cashTotal)],
    [paymentLabel(lang, "transfer"), formatMoney(input.payments.transferTotal)],
    [paymentLabel(lang, "card"), formatMoney(input.payments.cardTotal)],
  ].forEach(([label, value]) => summarySheet.addRow({ label, value }));
  styleBody(summarySheet);

  const paymentsSheet = workbook.addWorksheet(lang === "zh" ? "支付方式" : "FORMA PAGO");
  paymentsSheet.columns = [
    { header: t(lang, "pos.field.payment_method"), key: "label", width: 20 },
    { header: t(lang, "pos.field.total"), key: "value", width: 18 },
  ];
  styleHeader(paymentsSheet.getRow(1));
  [
    [paymentLabel(lang, "cash"), formatMoney(input.payments.cashTotal)],
    [paymentLabel(lang, "transfer"), formatMoney(input.payments.transferTotal)],
    [paymentLabel(lang, "card"), formatMoney(input.payments.cardTotal)],
    [t(lang, "pos.field.refund_total"), formatMoney(input.payments.refundTotal)],
  ].forEach(([label, value]) => paymentsSheet.addRow({ label, value }));
  styleBody(paymentsSheet);

  const trendSheet = workbook.addWorksheet(lang === "zh" ? "销售趋势" : "TEND. VTAS.");
  trendSheet.columns = [
    { header: t(lang, "pos.field.datetime"), key: "bucket", width: 16 },
    { header: t(lang, "pos.field.sales_total"), key: "salesTotal", width: 16 },
    { header: t(lang, "pos.field.refund_total"), key: "refundTotal", width: 16 },
    { header: t(lang, "pos.field.net_sales_total"), key: "netSalesTotal", width: 16 },
    { header: t(lang, "pos.field.order_count"), key: "orderCount", width: 16 },
  ];
  styleHeader(trendSheet.getRow(1));
  input.trend.forEach((item) => trendSheet.addRow({
    bucket: item.bucket,
    salesTotal: formatMoney(item.salesTotal),
    refundTotal: formatMoney(item.refundTotal),
    netSalesTotal: formatMoney(item.netSalesTotal),
    orderCount: item.orderCount,
  }));
  styleBody(trendSheet);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildPosInventoryStatsExportXlsx(
  lang: Lang,
  input: {
    overview: PosInventoryOverview;
    topProducts: PosTopProductsReport;
  },
) {
  const workbook = makeWorkbook();

  const summarySheet = workbook.addWorksheet(lang === "zh" ? "库存统计" : "EST. INV.");
  summarySheet.columns = [
    { header: lang === "zh" ? "指标" : "INDICADOR", key: "label", width: 28 },
    { header: lang === "zh" ? "数值" : "VALOR", key: "value", width: 18 },
  ];
  styleHeader(summarySheet.getRow(1));
  [
    [t(lang, "pos.field.active_inventory_items"), String(input.overview.totalActiveInventoryItems)],
    [t(lang, "pos.field.low_stock_count"), String(input.overview.lowStockCount)],
    [t(lang, "pos.field.out_of_stock_count"), String(input.overview.outOfStockCount)],
  ].forEach(([label, value]) => summarySheet.addRow({ label, value }));
  styleBody(summarySheet);

  const topSheet = workbook.addWorksheet(lang === "zh" ? "热销商品" : "PROD. TOP");
  topSheet.columns = [
    { header: t(lang, "pos.field.product_code"), key: "clave", width: 18 },
    { header: t(lang, "pos.field.product"), key: "productName", width: 28 },
    { header: t(lang, "pos.field.quantity"), key: "qtyTotal", width: 12 },
    { header: t(lang, "pos.field.sales_total"), key: "salesTotal", width: 16 },
  ];
  styleHeader(topSheet.getRow(1));
  input.topProducts.topByQty.forEach((item) => topSheet.addRow({
    clave: item.clave,
    productName: item.productName,
    qtyTotal: item.qtyTotal,
    salesTotal: formatMoney(item.salesTotal),
  }));
  styleBody(topSheet);

  const lowStockSheet = workbook.addWorksheet(lang === "zh" ? "低库存列表" : "LISTA INV. BAJA");
  lowStockSheet.columns = [
    { header: t(lang, "pos.field.store"), key: "storeId", width: 18 },
    { header: t(lang, "pos.field.product_code"), key: "clave", width: 18 },
    { header: t(lang, "pos.field.product"), key: "productName", width: 28 },
    { header: t(lang, "pos.field.inventory_on_hand"), key: "onHandQty", width: 12 },
    { header: t(lang, "pos.field.inventory_available"), key: "availableQty", width: 14 },
  ];
  styleHeader(lowStockSheet.getRow(1));
  input.overview.lowStockItems.forEach((item) => lowStockSheet.addRow({
    storeId: item.storeId,
    clave: item.clave,
    productName: item.productName,
    onHandQty: item.onHandQty,
    availableQty: item.availableQty,
  }));
  styleBody(lowStockSheet);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildPosReplenishmentExportXlsx(
  lang: Lang,
  input: {
    items: PosReplenishmentSuggestionItem[];
    targetDays: number;
  },
) {
  const workbook = makeWorkbook();
  const sheet = workbook.addWorksheet(lang === "zh" ? "补货建议" : "SUG. RESURT.");
  sheet.columns = [
    { header: t(lang, "pos.field.store"), key: "storeId", width: 18 },
    { header: t(lang, "pos.field.product"), key: "productName", width: 28 },
    { header: t(lang, "pos.field.product_code"), key: "clave", width: 18 },
    { header: t(lang, "pos.field.current_inventory"), key: "currentQty", width: 14 },
    { header: t(lang, "pos.field.min_stock"), key: "minStock", width: 12 },
    { header: t(lang, "pos.field.sales_7d"), key: "sales7d", width: 12 },
    { header: t(lang, "pos.field.sales_30d"), key: "sales30d", width: 12 },
    { header: t(lang, "pos.field.avg_daily_sales"), key: "avgDailySales", width: 14 },
    { header: t(lang, "pos.field.suggested_qty"), key: "suggestedQty", width: 14 },
    { header: t(lang, "pos.field.status"), key: "status", width: 22 },
  ];
  styleHeader(sheet.getRow(1));
  input.items.forEach((item) => {
    sheet.addRow({
      storeId: item.storeId,
      productName: item.productName,
      clave: item.clave,
      currentQty: item.currentQty,
      minStock: item.minStock,
      sales7d: item.sales7d,
      sales30d: item.sales30d,
      avgDailySales: item.avgDailySales,
      suggestedQty: item.suggestedQty,
      status: replenishmentStatusLabel(lang, item),
    });
  });
  styleBody(sheet);

  const noteSheet = workbook.addWorksheet(lang === "zh" ? "规则" : "REGLA");
  noteSheet.columns = [
    { header: lang === "zh" ? "项目" : "ITEM", key: "label", width: 24 },
    { header: lang === "zh" ? "说明" : "DESC.", key: "value", width: 52 },
  ];
  styleHeader(noteSheet.getRow(1));
  noteSheet.addRow({
    label: t(lang, "pos.field.avg_daily_sales"),
    value: lang === "zh" ? "近7天销量 / 7" : "VTAS. 7D / 7",
  });
  noteSheet.addRow({
    label: t(lang, "pos.field.suggested_qty"),
    value: lang === "zh"
      ? `MAX(0, ${input.targetDays} * 日均销量 - 当前库存)，结果向上取整`
      : `MAX(0, ${input.targetDays} * PROM. DIA - INV. ACTUAL), REDONDEO HACIA ARRIBA`,
  });
  styleBody(noteSheet);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildPosAuditLogsExportXlsx(lang: Lang, items: PosAuditLogItem[]) {
  const workbook = makeWorkbook();
  const summarySheet = workbook.addWorksheet(lang === "zh" ? "操作日志" : "BITÁCORA");
  summarySheet.columns = [
    { header: t(lang, "pos.field.datetime"), key: "createdAt", width: 22 },
    { header: t(lang, "pos.field.action"), key: "actionType", width: 26 },
    { header: t(lang, "pos.field.module"), key: "module", width: 18 },
    { header: t(lang, "pos.field.user"), key: "actorName", width: 18 },
    { header: t(lang, "pos.field.role"), key: "actorRole", width: 18 },
    { header: t(lang, "pos.field.store"), key: "storeId", width: 18 },
    { header: t(lang, "pos.field.target"), key: "targetType", width: 18 },
    { header: t(lang, "pos.field.target_id"), key: "targetId", width: 28 },
    { header: t(lang, "pos.field.folio"), key: "targetFolio", width: 24 },
    { header: t(lang, "pos.field.result"), key: "resultStatus", width: 14 },
    { header: t(lang, "pos.field.summary"), key: "summary", width: 36 },
  ];
  styleHeader(summarySheet.getRow(1));
  items.forEach((item) => {
    const actionLabelKey = getPosAuditActionLabelKey(item.actionType);
    const moduleLabelKey = getPosAuditModuleLabelKey(item.module);
    const targetLabelKey = getPosAuditTargetLabelKey(item.targetType);
    summarySheet.addRow({
      createdAt: formatDateTime(item.createdAt),
      actionType: actionLabelKey ? t(lang, actionLabelKey) : item.actionType,
      module: moduleLabelKey ? t(lang, moduleLabelKey) : item.module,
      actorName: item.actorName,
      actorRole: item.actorRole,
      storeId: item.storeId || "-",
      targetType: targetLabelKey ? t(lang, targetLabelKey) : (item.targetType || "-"),
      targetId: item.targetId || "-",
      targetFolio: item.targetFolio || "-",
      resultStatus: auditResultLabel(lang, item.resultStatus),
      summary: item.summary,
    });
  });
  styleBody(summarySheet);

  const detailsSheet = workbook.addWorksheet(lang === "zh" ? "日志详情" : "DETALLES");
  detailsSheet.columns = [
    { header: t(lang, "pos.field.folio"), key: "folio", width: 24 },
    { header: t(lang, "pos.field.action"), key: "actionType", width: 24 },
    { header: t(lang, "pos.field.details"), key: "details", width: 120 },
  ];
  styleHeader(detailsSheet.getRow(1));
  items.forEach((item) => {
    const actionLabelKey = getPosAuditActionLabelKey(item.actionType);
    detailsSheet.addRow({
      folio: item.targetFolio || item.id,
      actionType: actionLabelKey ? t(lang, actionLabelKey) : item.actionType,
      details: stringifyJson(item.detailsJson || {}),
    });
  });
  styleBody(detailsSheet);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
