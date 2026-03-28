import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type CustomerFinanceOrderExportRow = {
  orderNo: string;
  channelText: string;
  orderDateText: string;
  orderAmountText: string;
  packingAmountText: string;
  shippedAtText: string;
};

export type CustomerFinanceDetailExportPayload = {
  customerName: string;
  linkedYgName: string;
  realName: string;
  contact: string;
  phone: string;
  stores: string;
  address: string;
  vipLevel: string;
  creditLevel: string;
  totalOrderCount: string;
  totalOrderAmountText: string;
  totalPackingAmountText: string;
  orderRows: CustomerFinanceOrderExportRow[];
};

type EmbeddedFonts = {
  zhRegular: PDFFont;
  zhBold: PDFFont;
  latinRegular: PDFFont;
  latinBold: PDFFont;
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const PAGE_PADDING_X = 34;
const PAGE_PADDING_TOP = 34;
const PAGE_PADDING_BOTTOM = 28;
const PRIMARY_COLOR = rgb(47 / 255, 60 / 255, 127 / 255);
const BORDER_COLOR = rgb(226 / 255, 232 / 255, 240 / 255);
const HEADER_FILL = rgb(248 / 255, 250 / 255, 252 / 255);
const SUBTLE_FILL = rgb(251 / 255, 234 / 255, 235 / 255);
const TEXT_COLOR = rgb(51 / 255, 65 / 255, 85 / 255);
const MUTED_COLOR = rgb(100 / 255, 116 / 255, 139 / 255);

function sanitizeFileName(value: string) {
  return String(value || "customer-finance")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

async function loadFontBytes(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

async function embedFonts(pdfDoc: PDFDocument): Promise<EmbeddedFonts> {
  pdfDoc.registerFontkit(fontkit);

  const zhRegularBytes = await loadFontBytes([
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf"),
    "C:\\Windows\\Fonts\\msyh.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ]);
  const zhBoldBytes = await loadFontBytes([
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Bold.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Bold.ttf"),
    "C:\\Windows\\Fonts\\msyhbd.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ]);
  const latinRegularBytes = await loadFontBytes([
    path.join(process.cwd(), "public", "fonts", "SourceSans3-Regular.ttf"),
    path.join(process.cwd(), "public", "fonts", "SourceSans3-VariableFont_wght.ttf"),
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
  ]);
  const latinBoldBytes = await loadFontBytes([
    path.join(process.cwd(), "public", "fonts", "SourceSans3-SemiBold.ttf"),
    path.join(process.cwd(), "public", "fonts", "SourceSans3-VariableFont_wght.ttf"),
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\calibrib.ttf",
  ]);

  return {
    zhRegular: zhRegularBytes
      ? await pdfDoc.embedFont(zhRegularBytes, { subset: false })
      : await pdfDoc.embedFont(StandardFonts.Helvetica),
    zhBold: zhBoldBytes
      ? await pdfDoc.embedFont(zhBoldBytes, { subset: false })
      : zhRegularBytes
        ? await pdfDoc.embedFont(zhRegularBytes, { subset: false })
        : await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    latinRegular: latinRegularBytes
      ? await pdfDoc.embedFont(latinRegularBytes, { subset: false })
      : await pdfDoc.embedFont(StandardFonts.Helvetica),
    latinBold: latinBoldBytes
      ? await pdfDoc.embedFont(latinBoldBytes, { subset: false })
      : await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function getFont(fonts: EmbeddedFonts, value: string, bold = false) {
  if (hasChineseGlyph(value)) {
    return bold ? fonts.zhBold : fonts.zhRegular;
  }
  return bold ? fonts.latinBold : fonts.latinRegular;
}

function formatDateLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/\//g, "/");
}

function wrapText(text: string, width: number, font: PDFFont, size: number) {
  const content = String(text || "-").trim() || "-";
  const lines: string[] = [];
  let current = "";
  for (const char of content) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) <= width || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = char;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function drawText(page: PDFPage, fonts: EmbeddedFonts, value: string, options: {
  x: number;
  y: number;
  size?: number;
  color?: ReturnType<typeof rgb>;
  bold?: boolean;
}) {
  const text = String(value || "");
  const font = getFont(fonts, text, options.bold);
  page.drawText(text, {
    x: options.x,
    y: options.y,
    size: options.size ?? 10,
    font,
    color: options.color ?? TEXT_COLOR,
  });
}

function drawRoundedRect(page: PDFPage, x: number, y: number, width: number, height: number, fill?: ReturnType<typeof rgb>) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fill,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });
}

function drawFieldCard(page: PDFPage, fonts: EmbeddedFonts, input: {
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
}) {
  const cardHeight = 48;
  drawRoundedRect(page, input.x, input.y - cardHeight, input.width, cardHeight, rgb(1, 1, 1));
  drawText(page, fonts, input.label, {
    x: input.x + 10,
    y: input.y - 14,
    size: 9,
    color: MUTED_COLOR,
    bold: false,
  });
  const lines = wrapText(input.value, input.width - 20, getFont(fonts, input.value, false), 9);
  lines.slice(0, 2).forEach((line, index) => {
    drawText(page, fonts, line, {
      x: input.x + 10,
      y: input.y - 30 - index * 10,
      size: 9,
      color: TEXT_COLOR,
      bold: false,
    });
  });
}

function drawSummaryCard(page: PDFPage, fonts: EmbeddedFonts, input: {
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
}) {
  const cardHeight = 52;
  drawRoundedRect(page, input.x, input.y - cardHeight, input.width, cardHeight, HEADER_FILL);
  drawText(page, fonts, input.label, {
    x: input.x + input.width / 2 - getFont(fonts, input.label, true).widthOfTextAtSize(input.label, 9) / 2,
    y: input.y - 16,
    size: 9,
    color: MUTED_COLOR,
    bold: true,
  });
  const font = getFont(fonts, input.value, false);
  drawText(page, fonts, input.value, {
    x: input.x + input.width / 2 - font.widthOfTextAtSize(input.value, 11) / 2,
    y: input.y - 35,
    size: 11,
    color: TEXT_COLOR,
    bold: false,
  });
}

export function buildCustomerFinancePdfFileName(customerName: string) {
  return `${sanitizeFileName(customerName || "customer-finance")}-PARKSONMX.pdf`;
}

export async function buildCustomerFinanceDetailPdf(payload: CustomerFinanceDetailExportPayload) {
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - PAGE_PADDING_TOP;

  const addNewPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - PAGE_PADDING_TOP;
  };

  const drawSectionTitle = (title: string) => {
    drawText(page, fonts, title, { x: PAGE_PADDING_X, y: cursorY, size: 13, color: PRIMARY_COLOR, bold: true });
    cursorY -= 16;
    page.drawLine({
      start: { x: PAGE_PADDING_X, y: cursorY },
      end: { x: PAGE_WIDTH - PAGE_PADDING_X, y: cursorY },
      color: BORDER_COLOR,
      thickness: 1,
    });
    cursorY -= 14;
  };

  drawText(page, fonts, "PARKSONMX", { x: PAGE_PADDING_X, y: cursorY, size: 20, color: PRIMARY_COLOR, bold: true });
  drawText(page, fonts, payload.customerName || "-", {
    x: PAGE_PADDING_X,
    y: cursorY - 20,
    size: 13,
    color: TEXT_COLOR,
    bold: false,
  });
  const exportDate = `导出日期 ${formatDateLabel()}`;
  const exportDateFont = getFont(fonts, exportDate, false);
  drawText(page, fonts, exportDate, {
    x: PAGE_WIDTH - PAGE_PADDING_X - exportDateFont.widthOfTextAtSize(exportDate, 9),
    y: cursorY - 2,
    size: 9,
    color: MUTED_COLOR,
    bold: false,
  });
  cursorY -= 38;

  cursorY -= 6;

  drawSectionTitle("客户信息");

  const infoFieldWidth = [145, 145, 120, 120, 120];
  let infoX = PAGE_PADDING_X;
  [
    ["友购客户名称", payload.linkedYgName],
    ["真实客户名称", payload.realName],
    ["联系人", payload.contact],
    ["手机", payload.phone],
    ["门店编号", payload.stores],
  ].forEach(([label, value], index) => {
    drawFieldCard(page, fonts, {
      x: infoX,
      y: cursorY,
      width: infoFieldWidth[index]!,
      label,
      value,
    });
    infoX += infoFieldWidth[index]! + 8;
  });
  cursorY -= 62;

  drawFieldCard(page, fonts, {
    x: PAGE_PADDING_X,
    y: cursorY,
    width: PAGE_WIDTH - PAGE_PADDING_X * 2,
    label: "客户地址",
    value: payload.address,
  });
  cursorY -= 66;

  const summaryWidth = (PAGE_WIDTH - PAGE_PADDING_X * 2 - 32) / 5;
  let summaryX = PAGE_PADDING_X;
  [
    ["VIP等级", payload.vipLevel],
    ["信用等级", payload.creditLevel],
    ["下单次数", payload.totalOrderCount],
    ["下单金额", payload.totalOrderAmountText],
    ["累计配货金额", payload.totalPackingAmountText],
  ].forEach(([label, value]) => {
    drawSummaryCard(page, fonts, {
      x: summaryX,
      y: cursorY,
      width: summaryWidth,
      label,
      value,
    });
    summaryX += summaryWidth + 8;
  });
  cursorY -= 74;

  drawSectionTitle("订单列表");

  const columns = [
    { key: "orderNo", label: "订单号", width: 200 },
    { key: "channelText", label: "渠道", width: 82 },
    { key: "orderDateText", label: "下单日期", width: 90 },
    { key: "orderAmountText", label: "下单金额", width: 102 },
    { key: "packingAmountText", label: "配货金额", width: 102 },
    { key: "shippedAtText", label: "发货日期", width: 100 },
  ] as const;

  const drawTableHeader = () => {
    let colX = PAGE_PADDING_X;
    const headerHeight = 24;
    page.drawRectangle({
      x: PAGE_PADDING_X,
      y: cursorY - headerHeight,
      width: PAGE_WIDTH - PAGE_PADDING_X * 2,
      height: headerHeight,
      color: HEADER_FILL,
      borderColor: BORDER_COLOR,
      borderWidth: 1,
    });
    for (const column of columns) {
      drawText(page, fonts, column.label, {
        x: colX + 8,
        y: cursorY - 16,
        size: 9,
        color: MUTED_COLOR,
        bold: true,
      });
      colX += column.width;
    }
    cursorY -= headerHeight;
  };

  const ensureTableSpace = (neededHeight: number) => {
    if (cursorY - neededHeight >= PAGE_PADDING_BOTTOM) return;
    addNewPage();
    drawSectionTitle("订单列表");
    drawTableHeader();
  };

  drawTableHeader();

  for (const row of payload.orderRows) {
    const rowValues = [
      row.orderNo || "-",
      row.channelText || "-",
      row.orderDateText || "-",
      row.orderAmountText || "-",
      row.packingAmountText || "-",
      row.shippedAtText || "-",
    ];
    const wrapped = rowValues.map((value, index) =>
      wrapText(value, columns[index]!.width - 16, getFont(fonts, value, false), 9),
    );
    const lineCount = Math.max(...wrapped.map((lines) => lines.length), 1);
    const rowHeight = Math.max(24, 8 + lineCount * 11);
    ensureTableSpace(rowHeight);

    page.drawRectangle({
      x: PAGE_PADDING_X,
      y: cursorY - rowHeight,
      width: PAGE_WIDTH - PAGE_PADDING_X * 2,
      height: rowHeight,
      borderColor: BORDER_COLOR,
      borderWidth: 1,
    });

    let colX = PAGE_PADDING_X;
    wrapped.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        drawText(page, fonts, line, {
          x: colX + 8,
          y: cursorY - 16 - lineIndex * 10,
          size: 9,
          color: TEXT_COLOR,
          bold: false,
        });
      });
      colX += columns[index]!.width;
    });

    cursorY -= rowHeight;
  }

  if (payload.orderRows.length === 0) {
    const emptyHeight = 32;
    ensureTableSpace(emptyHeight);
    page.drawRectangle({
      x: PAGE_PADDING_X,
      y: cursorY - emptyHeight,
      width: PAGE_WIDTH - PAGE_PADDING_X * 2,
      height: emptyHeight,
      borderColor: BORDER_COLOR,
      borderWidth: 1,
    });
    drawText(page, fonts, "当前没有匹配到下单记录", {
      x: PAGE_PADDING_X + 12,
      y: cursorY - 20,
      size: 9,
      color: MUTED_COLOR,
      bold: false,
    });
    cursorY -= emptyHeight;
  }

  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i += 1) {
    const targetPage = pdfDoc.getPage(i);
    const footer = `PARKSONMX · ${i + 1}/${pageCount}`;
    const footerFont = getFont(fonts, footer, false);
    targetPage.drawText(footer, {
      x: PAGE_WIDTH - PAGE_PADDING_X - footerFont.widthOfTextAtSize(footer, 8),
      y: 14,
      size: 8,
      font: footerFont,
      color: MUTED_COLOR,
    });
  }

  return pdfDoc.save({ useObjectStreams: true });
}
