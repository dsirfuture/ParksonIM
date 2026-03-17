import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DsExchangeRatePayload, DsFinanceRow } from "@/lib/dropshipping-types";

type EmbeddedFonts = {
  regular: PDFFont;
  bold: PDFFont;
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

function formatDateOnly(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function safeRateLabel(rate: DsExchangeRatePayload) {
  return rate.rateValue ? rate.rateValue.toFixed(4) : "-";
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
  const boldBytes = await loadFontCandidates([
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Bold.otf"),
    "C:\\Windows\\Fonts\\msyhbd.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ]);

  if (regularBytes && boldBytes) {
    return {
      regular: await pdfDoc.embedFont(regularBytes, { subset: true }),
      bold: await pdfDoc.embedFont(boldBytes, { subset: true }),
    };
  }

  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function drawText(
  page: PDFPage,
  value: string,
  options: {
    x: number;
    y: number;
    size?: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
  },
) {
  page.drawText(value, {
    x: options.x,
    y: options.y,
    size: options.size || 10,
    font: options.font,
    color: options.color || rgb(0.15, 0.18, 0.25),
  });
}

function drawSummaryCard(
  page: PDFPage,
  fonts: EmbeddedFonts,
  x: number,
  label: string,
  value: string,
  accent = rgb(0.07, 0.12, 0.24),
) {
  page.drawRectangle({
    x,
    y: 438,
    width: 182,
    height: 58,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.9, 0.93, 0.97),
    borderWidth: 1,
  });
  drawText(page, label, {
    x: x + 12,
    y: 474,
    size: 9,
    font: fonts.regular,
    color: rgb(0.39, 0.45, 0.56),
  });
  drawText(page, value, {
    x: x + 12,
    y: 450,
    size: 16,
    font: fonts.bold,
    color: accent,
  });
}

function drawTableHeader(page: PDFPage, fonts: EmbeddedFonts, y: number) {
  const columns = [
    { label: "\u8ba2\u5355\u53f7", x: 36 },
    { label: "\u7f16\u7801", x: 182 },
    { label: "\u4ea7\u54c1\u4e2d\u6587\u540d", x: 278 },
    { label: "\u7269\u6d41\u53f7", x: 454 },
    { label: "\u53d1\u8d27\u65e5\u671f", x: 588 },
    { label: "\u7ed3\u7b97\u65e5\u671f", x: 670 },
    { label: "\u5df2\u7ed3\u91d1\u989d", x: 752 },
  ];

  page.drawRectangle({
    x: 28,
    y: y - 8,
    width: 786,
    height: 24,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.88, 0.91, 0.96),
    borderWidth: 1,
  });

  for (const column of columns) {
    drawText(page, column.label, {
      x: column.x,
      y,
      size: 8.5,
      font: fonts.bold,
      color: rgb(0.32, 0.39, 0.49),
    });
  }
}

function drawHeader(
  page: PDFPage,
  fonts: EmbeddedFonts,
  financeRow: DsFinanceRow,
  exchangeRate: DsExchangeRatePayload,
) {
  page.drawRectangle({
    x: 28,
    y: 520,
    width: 786,
    height: 40,
    color: rgb(0.95, 0.97, 1),
    borderColor: rgb(0.84, 0.89, 0.97),
    borderWidth: 1,
  });
  drawText(page, "\u5ba2\u6237\u7ed3\u7b97\u5355", {
    x: 36,
    y: 535,
    size: 20,
    font: fonts.bold,
    color: rgb(0.07, 0.12, 0.24),
  });
  drawText(page, financeRow.customerName, {
    x: 36,
    y: 515,
    size: 11,
    font: fonts.regular,
    color: rgb(0.39, 0.45, 0.56),
  });
  drawText(page, `\u6c47\u7387 MXN -> RMB: ${safeRateLabel(exchangeRate)}`, {
    x: 520,
    y: 536,
    size: 10,
    font: fonts.bold,
    color: rgb(0.1, 0.24, 0.53),
  });
  drawText(page, `\u6765\u6e90: ${exchangeRate.sourceName || "-"}`, {
    x: 520,
    y: 520,
    size: 9,
    font: fonts.regular,
    color: rgb(0.39, 0.45, 0.56),
  });
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

  let page = pdfDoc.addPage([842, 595]);
  drawHeader(page, fonts, input.financeRow, input.exchangeRate);

  drawSummaryCard(page, fonts, 36, "\u5ba2\u6237\u8ba2\u5355\u603b\u989d", formatMoney(input.financeRow.totalAmount));
  drawSummaryCard(page, fonts, 232, "\u7ed3\u6b3e\u603b\u989d", formatMoney(input.financeRow.paidAmount), rgb(0.02, 0.55, 0.35));
  drawSummaryCard(page, fonts, 428, "\u672a\u7ed3\u603b\u989d", formatMoney(input.financeRow.unpaidAmount), rgb(0.82, 0.14, 0.22));
  drawSummaryCard(page, fonts, 624, "\u5907\u8d27\u91d1\u989d", formatMoney(input.financeRow.stockAmount), rgb(0.1, 0.24, 0.53));

  let y = 405;
  drawText(page, "\u5df2\u7ed3\u7b97\u660e\u7ec6", {
    x: 36,
    y,
    size: 12,
    font: fonts.bold,
    color: rgb(0.07, 0.12, 0.24),
  });
  y -= 18;
  drawTableHeader(page, fonts, y);
  y -= 28;

  for (const item of input.financeRow.settledOrders) {
    if (y < 54) {
      page = pdfDoc.addPage([842, 595]);
      drawHeader(page, fonts, input.financeRow, input.exchangeRate);
      y = 505;
      drawTableHeader(page, fonts, y);
      y -= 28;
    }

    page.drawLine({
      start: { x: 28, y: y - 8 },
      end: { x: 814, y: y - 8 },
      thickness: 0.7,
      color: rgb(0.9, 0.93, 0.97),
    });

    drawText(page, sanitizeFileName(item.platformOrderNo).slice(0, 20) || "-", {
      x: 36,
      y,
      size: 8.5,
      font: fonts.regular,
    });
    drawText(page, sanitizeFileName(item.sku).slice(0, 12) || "-", {
      x: 182,
      y,
      size: 8.5,
      font: fonts.regular,
    });
    drawText(page, sanitizeFileName(item.productNameZh).slice(0, 20) || "-", {
      x: 278,
      y,
      size: 8.5,
      font: fonts.regular,
    });
    drawText(page, sanitizeFileName(item.trackingNo).slice(0, 18) || "-", {
      x: 454,
      y,
      size: 8.5,
      font: fonts.regular,
    });
    drawText(page, formatDateOnly(item.shippedAt), {
      x: 588,
      y,
      size: 8.5,
      font: fonts.regular,
    });
    drawText(page, formatDateOnly(item.settledAt), {
      x: 670,
      y,
      size: 8.5,
      font: fonts.regular,
    });
    drawText(page, formatMoney(item.paidAmount), {
      x: 752,
      y,
      size: 8.5,
      font: fonts.bold,
      color: rgb(0.02, 0.55, 0.35),
    });

    y -= 22;
  }

  if (input.financeRow.settledOrders.length === 0) {
    drawText(page, "\u5f53\u524d\u5ba2\u6237\u6682\u65e0\u5df2\u7ed3\u7b97\u8ba2\u5355\u3002", {
      x: 36,
      y: y - 6,
      size: 10,
      font: fonts.regular,
      color: rgb(0.39, 0.45, 0.56),
    });
  }

  return pdfDoc.save();
}
