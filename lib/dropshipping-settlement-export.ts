import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DsExchangeRatePayload, DsFinanceOrderItem, DsFinanceRow } from "@/lib/dropshipping-types";

type EmbeddedFonts = {
  zhRegular: PDFFont;
  zhBold: PDFFont;
  latinRegular: PDFFont;
  latinBold: PDFFont;
};

type PreparedSettlementItem = DsFinanceOrderItem & {
  effectiveShippingFee: number;
  mxnLineAmount: number;
  cnyLineAmount: number;
};

function sanitizeFileName(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(2)}%`;
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateCode(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}${map.month}${map.day}`;
}

async function loadFontCandidates(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate);
    } catch {
      // try next font
    }
  }
  return null;
}

async function embedFonts(pdfDoc: PDFDocument): Promise<EmbeddedFonts> {
  pdfDoc.registerFontkit(fontkit);
  const regularBytes = await loadFontCandidates([
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    "C:\\Windows\\Fonts\\msyh.ttf",
  ]);
  const latinRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (regularBytes) {
    const zhRegular = await pdfDoc.embedFont(regularBytes, { subset: false });
    return {
      zhRegular,
      zhBold: zhRegular,
      latinRegular,
      latinBold,
    };
  }

  return {
    zhRegular: latinRegular,
    zhBold: latinBold,
    latinRegular,
    latinBold,
  };
}

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function requiresUnicodeFont(value: string) {
  return /[^\u0000-\u00FF]/.test(String(value || ""));
}

function getFontForText(fonts: EmbeddedFonts, value: string, bold = false) {
  if (hasChineseGlyph(value) || requiresUnicodeFont(value)) {
    return bold ? fonts.zhBold : fonts.zhRegular;
  }
  return bold ? fonts.latinBold : fonts.latinRegular;
}

function drawText(
  page: PDFPage,
  value: string,
  options: {
    x: number;
    y: number;
    size?: number;
    fonts: EmbeddedFonts;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
  },
) {
  const chunks = String(value || "").match(/([^\u0000-\u00FF]+|[\u0000-\u00FF]+)/g) || [];
  let cursorX = options.x;
  for (const chunk of chunks) {
    const font = getFontForText(options.fonts, chunk, options.bold);
    page.drawText(chunk, {
      x: cursorX,
      y: options.y,
      size: options.size || 10,
      font,
      color: options.color || rgb(0.15, 0.18, 0.25),
    });
    cursorX += font.widthOfTextAtSize(chunk, options.size || 10);
  }
}

function drawHeavyText(
  page: PDFPage,
  value: string,
  options: {
    x: number;
    y: number;
    size?: number;
    fonts: EmbeddedFonts;
    color?: ReturnType<typeof rgb>;
  },
) {
  const offsets = [
    { x: 0, y: 0 },
    { x: 0.24, y: 0 },
    { x: 0, y: 0.14 },
    { x: 0.24, y: 0.14 },
  ];

  for (const offset of offsets) {
    drawText(page, value, {
      x: options.x + offset.x,
      y: options.y + offset.y,
      size: options.size,
      fonts: options.fonts,
      bold: true,
      color: options.color,
    });
  }
}

function measureTextWidth(
  value: string,
  options: {
    size?: number;
    fonts: EmbeddedFonts;
    bold?: boolean;
  },
) {
  const chunks = String(value || "").match(/([^\u0000-\u00FF]+|[\u0000-\u00FF]+)/g) || [];
  return chunks.reduce((total, chunk) => {
    const font = getFontForText(options.fonts, chunk, options.bold);
    return total + font.widthOfTextAtSize(chunk, options.size || 10);
  }, 0);
}

function prepareSettlementItems(financeRow: DsFinanceRow) {
  const seenTracking = new Set<string>();
  const items: PreparedSettlementItem[] = financeRow.settledOrders.map((item) => {
    const trackingKey = String(item.trackingNo || "").trim().toLowerCase() || `order:${item.orderId}`;
    const countShipping = !seenTracking.has(trackingKey);
    if (countShipping) seenTracking.add(trackingKey);
    const effectiveShippingFee = countShipping ? item.shippingFee : 0;
    return {
      ...item,
      effectiveShippingFee,
      mxnLineAmount: item.rawProductAmount,
      cnyLineAmount: item.productAmount + effectiveShippingFee,
    };
  });

  const mxnSubtotal = items.reduce((sum, item) => sum + item.mxnLineAmount, 0);
  const cnySubtotal = items.reduce((sum, item) => sum + item.productAmount, 0);
  const serviceFeeTotal = items.reduce((sum, item) => sum + item.effectiveShippingFee, 0);
  const payableTotal = items.reduce((sum, item) => sum + item.cnyLineAmount, 0);

  const shippedDates = items.map((item) => item.shippedAt).filter(Boolean) as string[];
  const minShippedAt = shippedDates.length ? shippedDates.slice().sort()[0] : null;
  const maxShippedAt = shippedDates.length ? shippedDates.slice().sort().reverse()[0] : null;

  return {
    items,
    mxnSubtotal,
    cnySubtotal,
    serviceFeeTotal,
    payableTotal,
    minShippedAt,
    maxShippedAt,
    orderCount: items.length,
    hasUnpaid: items.some((item) => item.settlementStatus === "unpaid"),
  };
}

function drawPill(
  page: PDFPage,
  fonts: EmbeddedFonts,
  x: number,
  y: number,
  text: string,
  options?: {
    width?: number;
    height?: number;
    bg?: ReturnType<typeof rgb>;
    border?: ReturnType<typeof rgb>;
    color?: ReturnType<typeof rgb>;
  },
) {
  const width = options?.width ?? 88;
  const height = options?.height ?? 22;
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: options?.bg ?? rgb(0.17, 0.22, 0.31),
    borderColor: options?.border ?? rgb(0.42, 0.47, 0.56),
    borderWidth: 1,
  });
  const textWidth = measureTextWidth(text, { fonts, size: 9, bold: true });
  drawText(page, text, {
    x: x + (width - textWidth) / 2,
    y: y + 7,
    size: 9,
    fonts,
    bold: true,
    color: options?.color ?? rgb(1, 1, 1),
  });
}

function drawInfoCard(
  page: PDFPage,
  fonts: EmbeddedFonts,
  x: number,
  y: number,
  width: number,
  rows: Array<{ label: string; value: string; valueColor?: ReturnType<typeof rgb> }>,
) {
  const rowHeight = 28;
  const height = rows.length * rowHeight + 16;
  page.drawRectangle({ x, y, width, height, color: rgb(0.27, 0.33, 0.43) });

  let cursorY = y + height - 22;
  for (const [index, row] of rows.entries()) {
    drawText(page, row.label, {
      x: x + 14,
      y: cursorY,
      size: 10,
      fonts,
      bold: true,
      color: rgb(0.84, 0.88, 0.95),
    });
    const valueWidth = measureTextWidth(row.value, { fonts, size: 10.5, bold: true });
    drawText(page, row.value, {
      x: x + width - 14 - valueWidth,
      y: cursorY,
      size: 10.5,
      fonts,
      bold: true,
      color: row.valueColor ?? rgb(1, 1, 1),
    });
    if (index < rows.length - 1) {
      page.drawLine({
        start: { x: x + 12, y: cursorY - 8 },
        end: { x: x + width - 12, y: cursorY - 8 },
        thickness: 0.8,
        color: rgb(0.42, 0.47, 0.56),
      });
    }
    cursorY -= rowHeight;
  }
}

function drawHero(
  page: PDFPage,
  fonts: EmbeddedFonts,
  financeRow: DsFinanceRow,
  exchangeRate: DsExchangeRatePayload,
  prepared: ReturnType<typeof prepareSettlementItems>,
) {
  page.drawRectangle({ x: 0, y: 612, width: 842, height: 230, color: rgb(0.12, 0.17, 0.27) });

  drawPill(page, fonts, 28, 804, "PARKSONMX");
  drawHeavyText(page, "代发结算单", {
    x: 28,
    y: 758,
    size: 30,
    fonts,
    color: rgb(1, 1, 1),
  });
  drawText(page, "BS-墨西哥仓库", {
    x: 28,
    y: 730,
    size: 13,
    fonts,
    bold: true,
    color: rgb(0.87, 0.91, 0.97),
  });

  drawText(page, `客户：${financeRow.customerName}`, {
    x: 28,
    y: 694,
    size: 12,
    fonts,
    bold: true,
    color: rgb(1, 1, 1),
  });
  drawText(page, `结算周期：${formatDateOnly(prepared.minShippedAt)} 至 ${formatDateOnly(prepared.maxShippedAt)}`, {
    x: 290,
    y: 694,
    size: 12,
    fonts,
    bold: true,
    color: rgb(1, 1, 1),
  });
  drawText(page, `结算汇率：1 RMB = ${exchangeRate.rateValue ? (1 / exchangeRate.rateValue).toFixed(4) : "-"} MXN`, {
    x: 28,
    y: 666,
    size: 12,
    fonts,
    bold: true,
    color: rgb(1, 1, 1),
  });
  drawText(page, `代发费：￥${formatMoney(prepared.orderCount > 0 ? prepared.serviceFeeTotal / prepared.orderCount : 0)} / 单`, {
    x: 290,
    y: 666,
    size: 12,
    fonts,
    bold: true,
    color: rgb(1, 1, 1),
  });

  const statementNumber = `BS-${formatDateCode(new Date())}-001`;
  drawInfoCard(page, fonts, 648, 644, 166, [
    { label: "对账单号", value: statementNumber },
    { label: "生成日期", value: formatDateOnly(new Date().toISOString()) },
    { label: "订单数", value: String(prepared.orderCount) },
    {
      label: "状态",
      value: prepared.hasUnpaid ? "含未结 / 待跟进" : "已生成 / 已锁定",
      valueColor: prepared.hasUnpaid ? rgb(1, 0.83, 0.35) : rgb(0.39, 0.94, 0.69),
    },
  ]);
}

function drawSummaryCards(page: PDFPage, fonts: EmbeddedFonts, prepared: ReturnType<typeof prepareSettlementItems>) {
  const cards = [
    { label: "商品小计（比索）", value: `$${formatMoney(prepared.mxnSubtotal)}`, color: rgb(0.07, 0.12, 0.24), fill: rgb(1, 1, 1), border: rgb(0.86, 0.89, 0.94) },
    { label: "商品折算（人民币）", value: `￥${formatMoney(prepared.cnySubtotal)}`, color: rgb(0.07, 0.12, 0.24), fill: rgb(1, 1, 1), border: rgb(0.86, 0.89, 0.94) },
    { label: "代发服务费（人民币）", value: `￥${formatMoney(prepared.serviceFeeTotal)}`, color: rgb(0.07, 0.12, 0.24), fill: rgb(1, 1, 1), border: rgb(0.86, 0.89, 0.94) },
    { label: "应付总额（人民币）", value: `￥${formatMoney(prepared.payableTotal)}`, color: rgb(0.82, 0.08, 0.28), fill: rgb(1, 0.96, 0.97), border: rgb(0.98, 0.78, 0.82) },
  ];

  const cardWidth = 196;
  const gap = 16;
  const startX = 28;
  const y = 472;

  cards.forEach((card, index) => {
    const x = startX + index * (cardWidth + gap);
    page.drawRectangle({ x, y, width: cardWidth, height: 74, color: card.fill, borderColor: card.border, borderWidth: 1 });
    drawText(page, card.label, { x: x + 14, y: y + 48, size: 10, fonts, color: rgb(0.39, 0.45, 0.56) });
    drawText(page, card.value, { x: x + 14, y: y + 18, size: 16, fonts, bold: true, color: card.color });
  });
}

function drawTableHeader(page: PDFPage, fonts: EmbeddedFonts, y: number) {
  const columns = [
    { label: "订单号", x: 40 },
    { label: "物流号", x: 124 },
    { label: "发货日期", x: 206 },
    { label: "编码", x: 292 },
    { label: "数量", x: 386 },
    { label: "单价（比索）", x: 434 },
    { label: "普通折扣", x: 514 },
    { label: "VIP折扣", x: 586 },
    { label: "金额（比索）", x: 654 },
    { label: "折算人民币", x: 738 },
  ];

  page.drawRectangle({ x: 28, y: y - 12, width: 786, height: 34, color: rgb(0.09, 0.09, 0.1) });
  for (const column of columns) {
    drawText(page, column.label, { x: column.x, y, size: 9, fonts, bold: true, color: rgb(1, 1, 1) });
  }
}

function drawTableRow(page: PDFPage, fonts: EmbeddedFonts, y: number, item: PreparedSettlementItem, index: number) {
  page.drawRectangle({ x: 28, y: y - 13, width: 786, height: 34, color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.985, 0.987, 0.992) });
  drawText(page, sanitizeFileName(item.platformOrderNo).slice(0, 12) || "-", { x: 40, y, size: 9, fonts, bold: true });
  drawText(page, sanitizeFileName(item.trackingNo).slice(0, 12) || "-", { x: 124, y, size: 9, fonts });
  drawText(page, formatDateOnly(item.shippedAt), { x: 206, y, size: 9, fonts });
  drawText(page, sanitizeFileName(item.sku).slice(0, 12) || "-", { x: 292, y, size: 9, fonts });
  drawText(page, String(item.quantity || 0), { x: 392, y, size: 9, fonts });
  drawText(page, `$${formatMoney(item.unitPrice || 0)}`, { x: 430, y, size: 9, fonts });
  drawText(page, formatPercent(item.normalDiscount), { x: 522, y, size: 9, fonts });
  drawText(page, item.vipDiscount > 0 ? formatPercent(item.vipDiscount) : "-", { x: 596, y, size: 9, fonts });
  drawText(page, `$${formatMoney(item.mxnLineAmount)}`, { x: 662, y, size: 9, fonts, bold: true });
  drawText(page, `￥${formatMoney(item.cnyLineAmount)}`, { x: 744, y, size: 9, fonts, bold: true, color: rgb(0.82, 0.08, 0.28) });
}

function drawNotesBox(page: PDFPage, fonts: EmbeddedFonts, y: number, prepared: ReturnType<typeof prepareSettlementItems>) {
  page.drawRectangle({ x: 28, y, width: 500, height: 146, color: rgb(1, 1, 1), borderColor: rgb(0.86, 0.89, 0.94), borderWidth: 1 });
  drawText(page, "备注说明", { x: 44, y: y + 114, size: 16, fonts, bold: true, color: rgb(0.07, 0.12, 0.24) });
  const notes = [
    "1. 商品按墨西哥比索（MXN）计价。",
    "2. 产品金额按单价、发货数量、普通折扣和 VIP 折扣计算。",
    "3. 代发费按唯一物流单计入人民币费用。",
    "4. ￥合计金额 = 折算人民币 + 当行代发费。",
    `5. 本次对账共 ${prepared.orderCount} 条记录，生成于墨西哥时间。`,
  ];
  notes.forEach((line, index) => {
    drawText(page, line, { x: 44, y: y + 78 - index * 24, size: 10.5, fonts, color: rgb(0.28, 0.32, 0.39) });
  });
}

function drawSummaryPanel(page: PDFPage, fonts: EmbeddedFonts, y: number, prepared: ReturnType<typeof prepareSettlementItems>) {
  page.drawRectangle({ x: 544, y, width: 270, height: 146, color: rgb(0.06, 0.06, 0.07) });
  drawText(page, "结算汇总", { x: 560, y: y + 114, size: 16, fonts, bold: true, color: rgb(1, 1, 1) });

  const rows = [
    ["商品金额（比索）", `$${formatMoney(prepared.mxnSubtotal)}`],
    ["商品折算（人民币）", `￥${formatMoney(prepared.cnySubtotal)}`],
    ["代发服务费（人民币）", `￥${formatMoney(prepared.serviceFeeTotal)}`],
  ];

  rows.forEach(([label, value], index) => {
    const baseY = y + 84 - index * 30;
    drawText(page, label, { x: 560, y: baseY, size: 10.5, fonts, bold: true, color: rgb(1, 1, 1) });
    const width = measureTextWidth(value, { fonts, size: 10.5, bold: true });
    drawText(page, value, { x: 798 - width, y: baseY, size: 10.5, fonts, bold: true, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: 560, y: baseY - 10 }, end: { x: 798, y: baseY - 10 }, thickness: 0.8, color: rgb(0.23, 0.23, 0.26) });
  });

  drawText(page, "应付总额", { x: 560, y: y + 8, size: 18, fonts, bold: true, color: rgb(1, 1, 1) });
  const totalText = `￥${formatMoney(prepared.payableTotal)}`;
  const totalWidth = measureTextWidth(totalText, { fonts, size: 18, bold: true });
  drawText(page, totalText, { x: 798 - totalWidth, y: y + 8, size: 18, fonts, bold: true, color: rgb(1, 0.35, 0.5) });
}

function drawFooterNote(page: PDFPage, fonts: EmbeddedFonts) {
  drawText(page, "PARKSONMX / Dropshipping Settlement Statement", { x: 28, y: 18, size: 8.5, fonts, color: rgb(0.58, 0.62, 0.69) });
}

export function buildDropshippingSettlementPdfName(customerName: string) {
  const safeCustomerName = sanitizeFileName(customerName) || "customer";
  return `dropshipping_settlement_${safeCustomerName}.pdf`;
}

export async function buildDropshippingSettlementPdf(input: {
  financeRow: DsFinanceRow;
  exchangeRate: DsExchangeRatePayload;
}) {
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const prepared = prepareSettlementItems(input.financeRow);

  let page = pdfDoc.addPage([842, 842]);
  drawHero(page, fonts, input.financeRow, input.exchangeRate, prepared);
  drawSummaryCards(page, fonts, prepared);

  let y = 420;
  drawTableHeader(page, fonts, y);
  y -= 32;

  for (const [index, item] of prepared.items.entries()) {
    if (y < 112) {
      page = pdfDoc.addPage([842, 842]);
      y = 792;
      drawTableHeader(page, fonts, y);
      y -= 32;
    }
    drawTableRow(page, fonts, y, item, index);
    y -= 34;
  }

  if (prepared.items.length === 0) {
    drawText(page, "当前客户暂无可导出的结算记录。", {
      x: 36,
      y: y - 4,
      size: 11,
      fonts,
      color: rgb(0.39, 0.45, 0.56),
    });
    y -= 28;
  }

  if (y < 190) {
    page = pdfDoc.addPage([842, 842]);
    y = 220;
  } else {
    y -= 16;
  }

  drawNotesBox(page, fonts, y - 146, prepared);
  drawSummaryPanel(page, fonts, y - 146, prepared);
  drawFooterNote(page, fonts);

  return pdfDoc.save();
}
