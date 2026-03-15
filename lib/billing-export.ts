import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { prisma } from "@/lib/prisma";
import { buildProductImageUrls } from "@/lib/product-image-url";

export type BillingExportItem = {
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  qty: number;
  unitPrice: number;
  normalDiscount: number | null;
  vipDiscount: number | null;
  lineTotal: number;
};

export type BillingExportData = {
  orderNo: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  addressText: string;
  remarkText: string;
  storeLabelText: string;
  updatedAt: Date | null;
  itemCount: number;
  totalAmount: number;
  vipDiscountEnabled: boolean;
  items: BillingExportItem[];
};

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function getDocumentFontName(value: string, options?: { chineseBold?: boolean }) {
  if (hasChineseGlyph(value)) {
    return options?.chineseBold ? "Microsoft YaHei Bold" : "Microsoft YaHei";
  }
  return "Source Sans 3";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return null;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function toPercentText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const percent = value <= 1 ? value * 100 : value;
  const rounded = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded}%`;
}

function toDiscountFactor(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value > 1 ? value / 100 : value;
}

function computeLineTotal(
  qty: number,
  unitPrice: number,
  normalDiscount: number | null,
  vipDiscount: number | null,
  vipDiscountEnabled: boolean,
) {
  let factor = 1;
  if (normalDiscount !== null) factor *= 1 - normalDiscount;
  if (vipDiscountEnabled && vipDiscount !== null) factor *= 1 - vipDiscount;
  return qty * unitPrice * factor;
}

function baseOrderNo(receiptNo: string) {
  const head = String(receiptNo || "")
    .trim()
    .split("-")[0];
  return head || String(receiptNo || "").trim();
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(value);
}

async function loadProductImageBuffer(sku: string, barcode: string) {
  const keys = [sku, barcode].map((item) => item.trim()).filter(Boolean);
  if (keys.length === 0) return null;

  const localExts = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"];
  for (const key of keys) {
    for (const ext of localExts) {
      const filePath = path.join(process.cwd(), "public", "products", `${key}.${ext}`);
      try {
        const buffer = await fs.readFile(filePath);
        return {
          buffer,
          extension: (ext.toLowerCase() === "png" ? "png" : "jpeg") as "png" | "jpeg",
        };
      } catch {
        // try next candidate
      }
    }
  }

  for (const key of keys) {
    const remoteUrls = buildProductImageUrls(key, ["jpg", "jpeg", "png", "webp"]);
    for (const url of remoteUrls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("image")) continue;
        const data = await response.arrayBuffer();
        if (data.byteLength === 0) continue;
        return {
          buffer: Buffer.from(data),
          extension: (contentType.includes("png") ? "png" : "jpeg") as "png" | "jpeg",
        };
      } catch {
        // try next url
      }
    }
  }

  return null;
}

async function loadPdfFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf"),
    "C:\\Windows\\Fonts\\msyh.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ];

  for (const fontPath of fontCandidates) {
    try {
      return await fs.readFile(fontPath);
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function loadPdfBoldFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Bold.otf"),
    "C:\\Windows\\Fonts\\msyhbd.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ];

  for (const fontPath of fontCandidates) {
    try {
      return await fs.readFile(fontPath);
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function loadPdfLatinFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "SourceSans3-Regular.ttf"),
    path.join(process.cwd(), "public", "fonts", "SourceSans3-VariableFont_wght.ttf"),
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
  ];

  for (const fontPath of fontCandidates) {
    try {
      return await fs.readFile(fontPath);
    } catch {
      // try next candidate
    }
  }

  return null;
}

function safePdfText(value: string, unicodeSafe: boolean) {
  const normalized = String(value || "").replace(/[\r\n\t]+/g, " ");
  if (unicodeSafe) return normalized;
  return normalized.replace(/[^\x20-\x7E]/g, " ");
}

function wrapTextByWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  unicodeSafe: boolean,
) {
  const normalized = safePdfText(text || "", unicodeSafe).trim();
  if (!normalized) return ["-"];

  const lines: string[] = [];
  let current = "";

  for (const char of normalized) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || current.length === 0) {
      current = next;
      continue;
    }
    lines.push(current);
    current = char;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["-"];
}

export async function getBillingExportData(params: {
  orderNo: string;
  tenantId: string;
  companyId: string;
  vipDiscountEnabled: boolean;
}) {
  const { orderNo, tenantId, companyId, vipDiscountEnabled } = params;

  const receipts = await prisma.receipt.findMany({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      status: "completed",
      receipt_no: {
        startsWith: orderNo,
      },
    },
    select: {
      receipt_no: true,
      updated_at: true,
      items: {
        select: {
          sku: true,
          barcode: true,
          name_zh: true,
          name_es: true,
          expected_qty: true,
          sell_price: true,
          normal_discount: true,
          vip_discount: true,
          line_total: true,
        },
      },
    },
    orderBy: { updated_at: "desc" },
  });

  const matchedReceipts = receipts.filter((receipt) => baseOrderNo(receipt.receipt_no) === orderNo);
  if (matchedReceipts.length === 0) return null;

  const skuList = Array.from(
    new Set(
      matchedReceipts.flatMap((receipt) =>
        receipt.items
          .map((item) => String(item.sku || "").trim())
          .filter((sku) => sku.length > 0),
      ),
    ),
  );

  const productDiscountRows =
    skuList.length > 0
      ? await prisma.productCatalog.findMany({
          where: {
            tenant_id: tenantId,
            company_id: companyId,
            sku: { in: skuList },
          },
          select: {
            sku: true,
            normal_discount: true,
            vip_discount: true,
          },
        })
      : [];

  const productDiscountMap = new Map(
    productDiscountRows.map((row) => [
      String(row.sku || "").trim(),
      {
        normalDiscount: row.normal_discount === null ? null : Number(row.normal_discount),
        vipDiscount: row.vip_discount === null ? null : Number(row.vip_discount),
      },
    ]),
  );

  const itemsMap = new Map<string, BillingExportItem>();
  let totalAmount = 0;
  let updatedAt: Date | null = null;

  for (const receipt of matchedReceipts) {
    if (!updatedAt || updatedAt.getTime() < receipt.updated_at.getTime()) {
      updatedAt = receipt.updated_at;
    }

    for (const item of receipt.items) {
      const sku = String(item.sku || "").trim();
      const barcode = String(item.barcode || "").trim();
      const qty = Number(item.expected_qty || 0);
      const unitPrice = toNumber(item.sell_price) || 0;
      const catalogDiscount = productDiscountMap.get(sku);
      const normalDiscountRaw =
        catalogDiscount?.normalDiscount ??
        (item.normal_discount === null ? null : Number(item.normal_discount));
      const vipDiscountRaw =
        catalogDiscount?.vipDiscount ??
        (item.vip_discount === null ? null : Number(item.vip_discount));
      const normalDiscount = toDiscountFactor(normalDiscountRaw);
      const vipDiscount = toDiscountFactor(vipDiscountRaw);
      const lineTotal = computeLineTotal(
        qty,
        unitPrice,
        normalDiscount,
        vipDiscount,
        vipDiscountEnabled,
      );

      totalAmount += lineTotal;

      const key = `${sku}|${barcode}`;
      const old = itemsMap.get(key);
      if (!old) {
        itemsMap.set(key, {
          sku,
          barcode,
          nameZh: String(item.name_zh || "").trim(),
          nameEs: String(item.name_es || "").trim(),
          qty,
          unitPrice,
          normalDiscount:
            normalDiscountRaw !== null && Number.isFinite(normalDiscountRaw) ? normalDiscountRaw : null,
          vipDiscount:
            vipDiscountRaw !== null && Number.isFinite(vipDiscountRaw) ? vipDiscountRaw : null,
          lineTotal,
        });
      } else {
        old.qty += qty;
        old.lineTotal += lineTotal;
        if (!old.nameZh) old.nameZh = String(item.name_zh || "").trim();
        if (!old.nameEs) old.nameEs = String(item.name_es || "").trim();
        if (old.normalDiscount === null && normalDiscountRaw !== null && Number.isFinite(normalDiscountRaw)) {
          old.normalDiscount = normalDiscountRaw;
        }
        if (old.vipDiscount === null && vipDiscountRaw !== null && Number.isFinite(vipDiscountRaw)) {
          old.vipDiscount = vipDiscountRaw;
        }
      }
    }
  }

  const orderRow = await prisma.ygOrderImport.findFirst({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      order_no: orderNo,
    },
    select: {
      company_name: true,
      customer_name: true,
      contact_name: true,
      contact_phone: true,
      address_text: true,
      order_remark: true,
      store_label: true,
    },
  });

  return {
    orderNo,
    companyName: orderRow?.company_name || orderRow?.customer_name || "-",
    contactName: orderRow?.contact_name || orderRow?.customer_name || orderRow?.company_name || "-",
    contactPhone: orderRow?.contact_phone || "-",
    addressText: orderRow?.address_text || "",
    remarkText: orderRow?.order_remark || "",
    storeLabelText: orderRow?.store_label || "",
    updatedAt,
    itemCount: itemsMap.size,
    totalAmount,
    vipDiscountEnabled,
    items: Array.from(itemsMap.values()),
  } satisfies BillingExportData;
}

export async function buildBillingXlsx(data: BillingExportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("账单明细", {
    views: [{ state: "frozen", ySplit: 7, showGridLines: true }],
  });

  worksheet.properties.defaultRowHeight = 24;
  worksheet.columns = [
    { key: "image", width: 12 },
    { key: "sku", width: 16 },
    { key: "barcode", width: 20 },
    { key: "nameZh", width: 20 },
    { key: "nameEs", width: 30 },
    { key: "qty", width: 10 },
    { key: "unitPrice", width: 10 },
    { key: "normalDiscount", width: 12 },
    ...(data.vipDiscountEnabled ? [{ key: "vipDiscount", width: 12 }] : []),
    { key: "lineTotal", width: 12 },
  ];

  worksheet.mergeCells("A1:B1");
  worksheet.getCell("A1").value = "ParksonMX";
  worksheet.getCell("A1").font = {
    name: getDocumentFontName("ParksonMX", { chineseBold: true }),
    size: 20,
    bold: true,
    color: { argb: "FF111827" },
  };
  worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(1).height = 34;

  const infoRows = [
    ["账单号", data.orderNo],
    ["商品数", String(data.itemCount)],
    ["合计", toMoney(data.totalAmount)],
    ["VIP折扣", data.vipDiscountEnabled ? "启用" : "关闭"],
    ["更新时间", formatDateOnly(data.updatedAt)],
  ];

  infoRows.forEach(([label, value], index) => {
    const rowNumber = index + 2;
    worksheet.getCell(`A${rowNumber}`).value = label;
    worksheet.getCell(`B${rowNumber}`).value = value;
    worksheet.getCell(`A${rowNumber}`).font = {
      name: getDocumentFontName(label, { chineseBold: true }),
      size: 11,
      bold: true,
      color: { argb: "FF111827" },
    };
    worksheet.getCell(`B${rowNumber}`).font = {
      name: getDocumentFontName(String(value || "")),
      size: 11,
      color: { argb: "FF111827" },
    };
    worksheet.getCell(`A${rowNumber}`).alignment = { vertical: "middle", horizontal: "left" };
    worksheet.getCell(`B${rowNumber}`).alignment = { vertical: "middle", horizontal: "left" };
  });

  const headerRowNumber = 7;
  const headerValues = [
    "图片",
    "编号",
    "条形码",
    "中文名",
    "西文名",
    "数量",
    "单价",
    "普通折扣",
    ...(data.vipDiscountEnabled ? ["VIP折扣"] : []),
    "金额",
  ];
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = headerValues;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: getDocumentFontName(String(cell.value || ""), { chineseBold: true }),
      size: 11,
      bold: true,
      color: { argb: "FF334155" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9E1EA" } },
      left: { style: "thin", color: { argb: "FFD9E1EA" } },
      bottom: { style: "thin", color: { argb: "FFD9E1EA" } },
      right: { style: "thin", color: { argb: "FFD9E1EA" } },
    };
  });

  for (let i = 0; i < data.items.length; i += 1) {
    const item = data.items[i];
    const rowNumber = headerRowNumber + 1 + i;
    const row = worksheet.getRow(rowNumber);
    row.height = 44;

    const values = [
      "",
      item.sku || "",
      item.barcode || "",
      item.nameZh || "",
      item.nameEs || "",
      item.qty,
      item.unitPrice,
      toPercentText(item.normalDiscount),
      ...(data.vipDiscountEnabled ? [toPercentText(item.vipDiscount)] : []),
      Number(toMoney(item.lineTotal)),
    ];
    row.values = values;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const text = String(cell.value ?? "");
      cell.font = {
        name: getDocumentFontName(text),
        size: 11,
        color: { argb: "FF111827" },
      };
      cell.alignment =
        colNumber === 4 || colNumber === 5
          ? { vertical: "middle", horizontal: "left" }
          : { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    const image = await loadProductImageBuffer(item.sku, item.barcode);
    if (image) {
      const imageId = workbook.addImage({
        base64: `data:image/${image.extension};base64,${image.buffer.toString("base64")}`,
        extension: image.extension,
      });
      worksheet.addImage(imageId, `A${rowNumber}:A${rowNumber}`);
    } else {
      row.getCell(1).value = "-";
    }
  }

  return workbook.xlsx.writeBuffer();
}

export async function buildBillingPdf(data: BillingExportData) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadPdfFontBytes();
  const boldFontBytes = await loadPdfBoldFontBytes();
  const latinFontBytes = await loadPdfLatinFontBytes();
  const unicodeSafe = Boolean(fontBytes);

  const bodyFont = fontBytes
    ? await pdfDoc.embedFont(fontBytes, { subset: false })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const esFont = latinFontBytes
    ? await pdfDoc.embedFont(latinFontBytes, { subset: false })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const boldFont = boldFontBytes
    ? await pdfDoc.embedFont(boldFontBytes, { subset: false })
    : bodyFont;

  const pageWidth = 842;
  const pageHeight = 595;
  const marginLeft = 26;
  const topMargin = 36;
  const bottomMargin = 24;
  const tableFontSize = 8;
  const lineGap = 10;
  const cellPaddingX = 5;
  const cellPaddingY = 6;

  const columns = [
    { label: "图片", width: 42, align: "center" as const },
    { label: "编号", width: 64, align: "center" as const },
    { label: "条形码", width: 88, align: "center" as const },
    { label: "中文名", width: 120, align: "left" as const },
    { label: "西文名", width: 180, align: "left" as const },
    { label: "数量", width: 44, align: "center" as const },
    { label: "单价", width: 50, align: "center" as const },
    { label: "普通折扣", width: 56, align: "center" as const },
    ...(data.vipDiscountEnabled ? [{ label: "VIP折扣", width: 56, align: "center" as const }] : []),
    { label: "金额", width: 60, align: "center" as const },
  ];
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - topMargin;

  const fontForText = (text: string, preferBold = false) => {
    if (hasChineseGlyph(text)) return preferBold ? boldFont : bodyFont;
    return preferBold ? latinBoldFont : esFont;
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; font?: PDFFont; color?: { r: number; g: number; b: number } },
  ) => {
    page.drawText(safePdfText(text, unicodeSafe), {
      x,
      y,
      size: options?.size ?? tableFontSize,
      font: options?.font ?? fontForText(text),
      color: rgb(options?.color?.r ?? 0.15, options?.color?.g ?? 0.2, options?.color?.b ?? 0.3),
    });
  };

  const drawCenteredText = (
    text: string,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    size = tableFontSize,
    font?: PDFFont,
  ) => {
    const safeText = safePdfText(text, unicodeSafe);
    const actualFont = font ?? fontForText(text);
    const textWidth = actualFont.widthOfTextAtSize(safeText, size);
    const x = cellX + Math.max((cellWidth - textWidth) / 2, 2);
    const y = cellY + (cellHeight - size) / 2 + 1;
    drawText(safeText, x, y, { size, font: actualFont });
  };

  const drawLeftAlignedWrappedText = (
    lines: string[],
    cellX: number,
    cellY: number,
    cellHeight: number,
    font: PDFFont,
  ) => {
    const blockHeight = lines.length * lineGap;
    let lineY = cellY + (cellHeight + blockHeight) / 2 - tableFontSize;
    for (const line of lines) {
      drawText(line, cellX + cellPaddingX, lineY, { size: tableFontSize, font });
      lineY -= lineGap;
    }
  };

  const drawHeaderInfo = () => {
    drawText("ParksonMX", marginLeft, cursorY, {
      size: 18,
      font: fontForText("ParksonMX", true),
      color: { r: 0.12, g: 0.22, b: 0.43 },
    });
    cursorY -= 28;
    drawText(`账单号: ${data.orderNo}`, marginLeft, cursorY, { size: 10, font: fontForText(data.orderNo, true) });
    cursorY -= 18;
    drawText(`商品数: ${data.itemCount}    合计: ${toMoney(data.totalAmount)}`, marginLeft, cursorY, { size: 9 });
    cursorY -= 16;
    drawText(`VIP折扣: ${data.vipDiscountEnabled ? "启用" : "关闭"}    更新时间: ${formatDateOnly(data.updatedAt)}`, marginLeft, cursorY, { size: 9 });
    cursorY -= 22;
  };

  const drawTableHeader = () => {
    const headerHeight = 22;
    let x = marginLeft;
    for (const col of columns) {
      page.drawRectangle({
        x,
        y: cursorY - headerHeight + 4,
        width: col.width,
        height: headerHeight,
        color: rgb(0.95, 0.96, 0.98),
        borderColor: rgb(0.86, 0.89, 0.92),
        borderWidth: 0.6,
      });
      drawCenteredText(col.label, x, cursorY - headerHeight + 4, col.width, headerHeight, 8, fontForText(col.label, true));
      x += col.width;
    }
    cursorY -= headerHeight + 6;
  };

  const createNewPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - topMargin;
    drawHeaderInfo();
    drawTableHeader();
  };

  drawHeaderInfo();
  drawTableHeader();

  for (const item of data.items) {
    const zhLines = wrapTextByWidth(item.nameZh || "-", bodyFont, tableFontSize, 120 - cellPaddingX * 2, unicodeSafe);
    const esLines = wrapTextByWidth(item.nameEs || "-", esFont, tableFontSize, 180 - cellPaddingX * 2, unicodeSafe);
    const maxLineCount = Math.max(1, zhLines.length, esLines.length);
    const rowHeight = Math.max(34, maxLineCount * lineGap + cellPaddingY * 2);

    if (cursorY - rowHeight < bottomMargin) {
      createNewPage();
    }

    const rowBottomY = cursorY - rowHeight + 2;
    let x = marginLeft;
    for (const col of columns) {
      page.drawRectangle({
        x,
        y: rowBottomY,
        width: col.width,
        height: rowHeight,
        borderColor: rgb(0.86, 0.89, 0.92),
        borderWidth: 0.6,
        color: rgb(1, 1, 1),
      });
      x += col.width;
    }

    const imageBuffer = await loadProductImageBuffer(item.sku, item.barcode);
    if (imageBuffer) {
      try {
        const embedded =
          imageBuffer.extension === "png"
            ? await pdfDoc.embedPng(imageBuffer.buffer)
            : await pdfDoc.embedJpg(imageBuffer.buffer);
        const imageSize = Math.min(26, columns[0].width - 8, rowHeight - 8);
        page.drawImage(embedded, {
          x: marginLeft + (columns[0].width - imageSize) / 2,
          y: rowBottomY + (rowHeight - imageSize) / 2,
          width: imageSize,
          height: imageSize,
        });
      } catch {
        drawCenteredText("-", marginLeft, rowBottomY, columns[0].width, rowHeight);
      }
    } else {
      drawCenteredText("-", marginLeft, rowBottomY, columns[0].width, rowHeight);
    }

    let currentX = marginLeft + columns[0].width;
    drawCenteredText(item.sku || "-", currentX, rowBottomY, columns[1].width, rowHeight);
    currentX += columns[1].width;
    drawCenteredText(item.barcode || "-", currentX, rowBottomY, columns[2].width, rowHeight);
    currentX += columns[2].width;
    drawLeftAlignedWrappedText(zhLines, currentX, rowBottomY, rowHeight, bodyFont);
    currentX += columns[3].width;
    drawLeftAlignedWrappedText(esLines, currentX, rowBottomY, rowHeight, esFont);
    currentX += columns[4].width;
    drawCenteredText(String(item.qty), currentX, rowBottomY, columns[5].width, rowHeight);
    currentX += columns[5].width;
    drawCenteredText(toMoney(item.unitPrice), currentX, rowBottomY, columns[6].width, rowHeight);
    currentX += columns[6].width;
    drawCenteredText(toPercentText(item.normalDiscount), currentX, rowBottomY, columns[7].width, rowHeight);
    currentX += columns[7].width;
    if (data.vipDiscountEnabled) {
      drawCenteredText(toPercentText(item.vipDiscount), currentX, rowBottomY, columns[8].width, rowHeight);
      currentX += columns[8].width;
    }
    drawCenteredText(toMoney(item.lineTotal), currentX, rowBottomY, columns[columns.length - 1].width, rowHeight);

    cursorY -= rowHeight;
  }

  return pdfDoc.save();
}
