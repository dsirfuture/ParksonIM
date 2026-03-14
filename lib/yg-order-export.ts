import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { buildProductImageUrls } from "@/lib/product-image-url";

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function getDocumentFontName(value: string, options?: { chineseBold?: boolean }) {
  if (hasChineseGlyph(value)) {
    return options?.chineseBold ? "Noto Sans SC Bold" : "Noto Sans SC";
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

export async function getSupplierOrderForExport(
  id: string,
  tenantId: string,
  companyId: string,
) {
  return prisma.ygSupplierOrder.findFirst({
    where: {
      id,
      tenant_id: tenantId,
      company_id: companyId,
    },
    include: {
      import: true,
      items: {
        orderBy: {
          line_no: "asc",
        },
      },
    },
  });
}

export async function getImportForZip(
  id: string,
  tenantId: string,
  companyId: string,
) {
  return prisma.ygOrderImport.findFirst({
    where: {
      id,
      tenant_id: tenantId,
      company_id: companyId,
    },
    include: {
      supplierOrders: {
        orderBy: {
          supplier_code: "asc",
        },
        include: {
          import: true,
          items: {
            orderBy: {
              line_no: "asc",
            },
          },
        },
      },
    },
  });
}

function moneyText(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "-";
  return num.toFixed(2);
}

function getOrderSuffix(orderNo: string) {
  const parts = (orderNo || "").split("-");
  const tail = parts[parts.length - 1] || "";
  const digits = tail.replace(/\D/g, "");
  return digits.slice(-3);
}

function imageKeyCandidates(itemNo: string | null, barcode: string | null) {
  return [itemNo || "", barcode || ""]
    .map((value) => value.trim())
    .filter(Boolean);
}

async function loadProductImageForExport(itemNo: string | null, barcode: string | null) {
  const keys = imageKeyCandidates(itemNo, barcode);
  if (keys.length === 0) return null;

  const extensions: Array<"jpg" | "jpeg" | "png"> = ["jpg", "jpeg", "png"];

  for (const key of keys) {
    for (const ext of extensions) {
      const filePath = path.join(process.cwd(), "public", "products", `${key}.${ext}`);
      try {
        const buffer = await fs.readFile(filePath);
        return {
          buffer,
          extension: ext === "png" ? ("png" as const) : ("jpeg" as const),
        };
      } catch {
        // continue searching
      }
    }
  }

  const remoteExts = ["jpg", "jpeg", "png", "webp"];
  for (const key of keys) {
    const remoteUrls = buildProductImageUrls(key, remoteExts);
    for (const url of remoteUrls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("image")) continue;
        const arr = await res.arrayBuffer();
        const buffer = Buffer.from(arr);
        const extByType = contentType.includes("png") ? "png" : "jpeg";
        return {
          buffer,
          extension: extByType as "png" | "jpeg",
        };
      } catch {
        // continue searching
      }
    }
  }

  return null;
}

async function loadPdfFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf"),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/arphic/uming.ttc",
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
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Bold.ttf"),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
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
  if (unicodeSafe) return value || "";
  return (value || "").replace(/[^\x20-\x7E]/g, " ");
}

export async function buildSupplierOrderXlsx(
  order: Awaited<ReturnType<typeof getSupplierOrderForExport>>,
) {
  if (!order) throw new Error("未找到拆分订单");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("订单");

  const skuSet = new Set(
    order.items.map((item) => (item.item_no || "").trim()).filter(Boolean),
  );
  const barcodeSet = new Set(
    order.items.map((item) => (item.barcode || "").trim()).filter(Boolean),
  );
  const yogoRows =
    skuSet.size > 0 || barcodeSet.size > 0
      ? await prisma.yogoProductSource.findMany({
          where: {
            tenant_id: order.tenant_id,
            company_id: order.company_id,
            OR: [
              ...(skuSet.size > 0 ? [{ product_code: { in: Array.from(skuSet) } }] : []),
              ...(barcodeSet.size > 0 ? [{ product_no: { in: Array.from(barcodeSet) } }] : []),
            ],
          },
          select: {
            product_code: true,
            product_no: true,
            name_cn: true,
            name_es: true,
          },
        })
      : [];
  const nameBySku = new Map(
    yogoRows.map((row) => [String(row.product_code || "").trim(), { zh: row.name_cn || "", es: row.name_es || "" }]),
  );
  const nameByBarcode = new Map(
    yogoRows
      .filter((row) => row.product_no)
      .map((row) => [String(row.product_no || "").trim(), { zh: row.name_cn || "", es: row.name_es || "" }]),
  );

  worksheet.columns = [
    { key: "image", width: 12 },
    { key: "itemNo", width: 16 },
    { key: "barcode", width: 22 },
    { key: "nameCn", width: 28 },
    { key: "nameEs", width: 32 },
    { key: "totalQty", width: 10 },
    { key: "unitPrice", width: 10 },
    { key: "lineTotal", width: 12 },
  ];

  worksheet.getCell("A1").value = "ParksonMX";
  worksheet.mergeCells("A1:C1");
  worksheet.getCell("A1").font = {
    name: getDocumentFontName("ParksonMX", { chineseBold: true }),
    size: 16,
    bold: true,
    color: { argb: "FF111827" },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  worksheet.getRow(1).height = 30;

  worksheet.getCell("A2").value = "订单号";
  worksheet.getCell("B2").value = order.derived_order_no;
  worksheet.getCell("A3").value = "订单金额";
  const fallbackOrderAmount = order.items.reduce((sum, item) => {
    const line = toNumber(item.line_total);
    if (line !== null) return sum + line;
    const qty = Number(item.total_qty || 0);
    const unit = toNumber(item.unit_price) || 0;
    return sum + qty * unit;
  }, 0);
  worksheet.getCell("B3").value = moneyText(
    order.order_amount !== null && order.order_amount !== undefined
      ? order.order_amount
      : fallbackOrderAmount > 0
        ? fallbackOrderAmount
        : null,
  );

  for (let row = 2; row <= 3; row += 1) {
    worksheet.getCell(`A${row}`).font = {
      name: getDocumentFontName(String(worksheet.getCell(`A${row}`).value || ""), { chineseBold: true }),
      size: 11,
      bold: true,
      color: { argb: "FF111827" },
    };
    worksheet.getCell(`B${row}`).font = {
      name: getDocumentFontName(String(worksheet.getCell(`B${row}`).value || ""), { chineseBold: true }),
      size: 12,
      bold: true,
      color: { argb: "FF111827" },
    };
    worksheet.getCell(`A${row}`).alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    worksheet.getCell(`B${row}`).alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    worksheet.getRow(row).height = 24;
  }

  const orderSuffix = getOrderSuffix(order.order_no);
  if (orderSuffix) {
    worksheet.getCell("A5").value = {
      richText: [
        {
          text: 'PARKSON : 请安排配货，包装上标明 "ParksonMX-',
          font: {
            name: getDocumentFontName('PARKSON : 请安排配货，包装上标明 "ParksonMX-'),
            size: 11,
            color: { argb: "FF111827" },
          },
        },
        {
          text: orderSuffix,
          font: {
            name: getDocumentFontName(orderSuffix, { chineseBold: true }),
            size: 11,
            bold: true,
            color: { argb: "FF111827" },
          },
        },
        {
          text: '"',
          font: {
            name: getDocumentFontName('"'),
            size: 11,
            color: { argb: "FF111827" },
          },
        },
      ],
    };
    worksheet.mergeCells("A5:H5");
    worksheet.getCell("A5").alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    worksheet.getRow(5).height = 24;
  }

  const headerRowNumber = 7;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = ["图片", "编号", "条形码", "中文名", "西文名", "总数量", "价格", "合计"];
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

  for (let i = 0; i < order.items.length; i += 1) {
    const item = order.items[i];
    const mapped =
      nameBySku.get((item.item_no || "").trim()) ||
      nameByBarcode.get((item.barcode || "").trim()) ||
      { zh: "", es: "" };
    const lineTotal = toNumber(item.line_total);
    const qty = Number(item.total_qty || 0);
    const unit = toNumber(item.unit_price) || 0;
    const row = worksheet.getRow(headerRowNumber + 1 + i);
    row.values = [
      "",
      item.item_no || "",
      item.barcode || "",
      mapped.zh || "",
      mapped.es || "",
      qty,
      unit || "",
      lineTotal !== null ? lineTotal : qty * unit,
    ];
    row.height = 56;

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const text = String(cell.value ?? "");
      let fontName = getDocumentFontName(text);
      if (col === 4 || col === 5) {
        fontName = hasChineseGlyph(text) ? "Noto Sans SC" : "Source Sans 3";
      }
      cell.font = {
        name: fontName,
        size: 11,
        color: { argb: "FF111827" },
      };
      cell.alignment =
        col === 4 || col === 5
          ? { vertical: "middle", horizontal: "left" }
          : { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    const image = await loadProductImageForExport(item.item_no, item.barcode);
    if (image) {
      const imageBase64 = `data:image/${image.extension};base64,${image.buffer.toString("base64")}`;
      const imageId = workbook.addImage({
        base64: imageBase64,
        extension: image.extension,
      });
      worksheet.addImage(imageId, `A${headerRowNumber + 1 + i}:A${headerRowNumber + 1 + i}`);
    } else {
      row.getCell(1).value = "-";
    }
  }

  return workbook.xlsx.writeBuffer();
}
export async function buildSupplierOrderPdf(
  order: Awaited<ReturnType<typeof getSupplierOrderForExport>>,
) {
  if (!order) throw new Error("未找到拆分订单");

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  let page = pdfDoc.addPage([842, 595]);
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
    : fontBytes
    ? await pdfDoc.embedFont(fontBytes, { subset: false })
    : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontForText = (text: string, preferBold = false) => {
    if (hasChineseGlyph(text)) return preferBold ? boldFont : bodyFont;
    return preferBold ? latinBoldFont : esFont;
  };

  const skuSet = new Set(
    order.items.map((item) => (item.item_no || "").trim()).filter(Boolean),
  );
  const barcodeSet = new Set(
    order.items.map((item) => (item.barcode || "").trim()).filter(Boolean),
  );
  const yogoRows =
    skuSet.size > 0 || barcodeSet.size > 0
      ? await prisma.yogoProductSource.findMany({
          where: {
            tenant_id: order.tenant_id,
            company_id: order.company_id,
            OR: [
              ...(skuSet.size > 0 ? [{ product_code: { in: Array.from(skuSet) } }] : []),
              ...(barcodeSet.size > 0 ? [{ product_no: { in: Array.from(barcodeSet) } }] : []),
            ],
          },
          select: {
            product_code: true,
            product_no: true,
            name_cn: true,
            name_es: true,
          },
        })
      : [];
  const nameBySku = new Map(
    yogoRows.map((row) => [String(row.product_code || "").trim(), { zh: row.name_cn || "", es: row.name_es || "" }]),
  );
  const nameByBarcode = new Map(
    yogoRows
      .filter((row) => row.product_no)
      .map((row) => [String(row.product_no || "").trim(), { zh: row.name_cn || "", es: row.name_es || "" }]),
  );

  let y = 560;
  const contentX = 74;
  const labels = {
    orderAmount: "订单金额",
    packingHint: "PARKSON : 请安排配货，包装上标明",
    image: "图片",
    code: "编号",
    barcode: "条形码",
    nameCn: "中文名",
    nameEs: "西文名",
    qty: "总数量",
    unitPrice: "价格",
    total: "合计",
  };

  page.drawText(safePdfText("ParksonMX", unicodeSafe), {
    x: contentX,
    y,
    size: 18,
    font: fontForText("ParksonMX", true),
    color: rgb(0.12, 0.22, 0.43),
  });

  y -= 30;

  page.drawText(safePdfText(order.derived_order_no, unicodeSafe), {
    x: contentX,
    y,
    size: 14,
    font: fontForText(order.derived_order_no, true),
    color: rgb(0.12, 0.22, 0.43),
  });

  y -= 26;

  const orderSuffix = getOrderSuffix(order.order_no);
  const fallbackOrderAmount = order.items.reduce((sum, item) => {
    const line = toNumber(item.line_total);
    if (line !== null) return sum + line;
    const qty = Number(item.total_qty || 0);
    const unit = toNumber(item.unit_price) || 0;
    return sum + qty * unit;
  }, 0);
  const resolvedOrderAmount =
    order.order_amount !== null && order.order_amount !== undefined
      ? order.order_amount
      : fallbackOrderAmount > 0
        ? fallbackOrderAmount
        : null;
  const amountLine = `${labels.orderAmount}: ${moneyText(resolvedOrderAmount)}`;
  page.drawText(safePdfText(amountLine, unicodeSafe), {
    x: contentX,
    y,
    size: 9,
    font: fontForText(amountLine),
    color: rgb(0.15, 0.2, 0.3),
  });
  y -= 16;

  const packingPrefix = `${labels.packingHint} "ParksonMX-`;
  const packingSuffix = orderSuffix || "***";
  const packingQuoteEnd = '"';
  const packingPrefixSafe = safePdfText(packingPrefix, unicodeSafe);
  const packingSuffixSafe = safePdfText(packingSuffix, unicodeSafe);
  const packingQuoteEndSafe = safePdfText(packingQuoteEnd, unicodeSafe);

  let packingX = contentX;
  page.drawText(packingPrefixSafe, {
    x: packingX,
    y,
    size: 9,
    font: fontForText(packingPrefix),
    color: rgb(0.15, 0.2, 0.3),
  });
  packingX += fontForText(packingPrefix).widthOfTextAtSize(packingPrefixSafe, 9);

  page.drawText(packingSuffixSafe, {
    x: packingX,
    y,
    size: 9,
    font: latinBoldFont,
    color: rgb(0.15, 0.2, 0.3),
  });
  packingX += latinBoldFont.widthOfTextAtSize(packingSuffixSafe, 9);

  page.drawText(packingQuoteEndSafe, {
    x: packingX,
    y,
    size: 9,
    font: esFont,
    color: rgb(0.15, 0.2, 0.3),
  });
  y -= 16;

  y -= 8;

  const headers = [
    labels.image,
    labels.code,
    labels.barcode,
    labels.nameCn,
    labels.nameEs,
    labels.qty,
    labels.unitPrice,
    labels.total,
  ];
  const maxItemNo = order.items.reduce((max, item) => {
    const value = (item.item_no || "").trim();
    return value.length > max.length ? value : max;
  }, "");
  const maxBarcode = order.items.reduce((max, item) => {
    const value = (item.barcode || "").trim();
    return value.length > max.length ? value : max;
  }, "");
  const itemNoWidth = Math.max(
    64,
    Math.min(96, Math.ceil(bodyFont.widthOfTextAtSize(maxItemNo || "编号", 8) + 16)),
  );
  const barcodeWidth = Math.max(
    64,
    Math.min(
      106,
      Math.ceil(bodyFont.widthOfTextAtSize(maxBarcode || "条形码", 8) + 12),
    ),
  );
  const imageWidth = Math.max(44, itemNoWidth - 20);
  const fixedTailWidth = 56 + 56 + 68;
  const totalTableWidth = 694;
  const nameCnWidth = 220;
  const nameEsWidth = totalTableWidth - (imageWidth + itemNoWidth + barcodeWidth + fixedTailWidth + nameCnWidth);
  const widths = [imageWidth, itemNoWidth, barcodeWidth, nameCnWidth, nameEsWidth, 56, 56, 68];
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  const tableX = Math.max((842 - tableWidth) / 2, 28);
  const drawTableHeader = () => {
    let x = tableX;
    for (let i = 0; i < headers.length; i += 1) {
      page.drawRectangle({
        x,
        y: y - 4,
        width: widths[i],
        height: 22,
        borderColor: rgb(0.86, 0.89, 0.92),
        borderWidth: 0.6,
        color: rgb(0.95, 0.96, 0.98),
      });

      page.drawText(safePdfText(headers[i], unicodeSafe), {
        x: x + 6,
        y: y + 3,
        size: 8,
        font: fontForText(headers[i], true),
        color: rgb(0.15, 0.2, 0.3),
      });

      x += widths[i];
    }

    y -= 28;
  };

  drawTableHeader();

  for (const item of order.items) {
    let colX = tableX;
    const mapped =
      nameBySku.get((item.item_no || "").trim()) ||
      nameByBarcode.get((item.barcode || "").trim()) ||
      { zh: "", es: "" };
    const nameCn = mapped.zh || "";
    const nameEs = mapped.es || "";
    const qty = Number(item.total_qty || 0);
    const unitPrice = toNumber(item.unit_price);
    const lineTotal = toNumber(item.line_total);
    const resolvedLineTotal =
      lineTotal !== null ? lineTotal : qty * (unitPrice || 0);
    const values = [
      "",
      item.item_no || "",
      item.barcode || "",
      nameCn,
      nameEs,
      String(qty),
      moneyText(unitPrice),
      moneyText(resolvedLineTotal),
    ];

    for (let i = 0; i < values.length; i += 1) {
      page.drawRectangle({
        x: colX,
        y: y - 4,
        width: widths[i],
        height: 22,
        borderColor: rgb(0.86, 0.89, 0.92),
        borderWidth: 0.6,
        color: rgb(1, 1, 1),
      });

      if (i === 0) {
        const image = await loadProductImageForExport(item.item_no, item.barcode);
        if (image) {
          const embedded =
            image.extension === "png"
              ? await pdfDoc.embedPng(image.buffer)
              : await pdfDoc.embedJpg(image.buffer);
          const cellX = colX;
          const cellY = y - 4;
          const cellWidth = widths[i];
          const cellHeight = 22;
          const innerWidth = Math.max(cellWidth - 4, 1);
          const innerHeight = Math.max(cellHeight - 4, 1);
          const imageScale = Math.min(
            innerWidth / embedded.width,
            innerHeight / embedded.height,
          );
          const imageWidth = Math.max(1, embedded.width * imageScale);
          const imageHeight = Math.max(1, embedded.height * imageScale);
          page.drawImage(embedded, {
            x: cellX + 2 + (innerWidth - imageWidth) / 2,
            y: cellY + 2 + (innerHeight - imageHeight) / 2,
            width: imageWidth,
            height: imageHeight,
          });
        }
      } else {
        page.drawText(safePdfText(String(values[i]).slice(0, 46), unicodeSafe), {
          x: colX + 6,
          y: y + 3,
          size: 8,
          font: fontForText(String(values[i])),
          color: rgb(0.15, 0.2, 0.3),
        });
      }

      colX += widths[i];
    }

    y -= 24;
    if (y < 40) {
      page = pdfDoc.addPage([842, 595]);
      y = 560;
      drawTableHeader();
    }
  }

  return pdfDoc.save();
}

export async function buildImportZipFile(
  importRow: Awaited<ReturnType<typeof getImportForZip>>,
) {
  if (!importRow) throw new Error("未找到友购订单");

  const zip = new JSZip();

  for (const item of importRow.supplierOrders) {
    const xlsxBuffer = await buildSupplierOrderXlsx(item as never);
    const pdfBuffer = await buildSupplierOrderPdf(item as never);

    zip.file(`${item.derived_order_no}.xlsx`, Buffer.from(xlsxBuffer));
    zip.file(`${item.derived_order_no}.pdf`, Buffer.from(pdfBuffer));
  }

  return zip.generateAsync({ type: "nodebuffer" });
}


