import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { buildProductImageUrls } from "@/lib/product-image-url";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

type SupplierMiscExportRow = {
  customerName: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  unitPrice: number | null;
  quantity: number;
  supplierName: string;
  recordedDate: string;
  remark: string;
};

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function getDocumentFontName(value: string, options?: { chineseBold?: boolean }) {
  if (hasChineseGlyph(value)) {
    return options?.chineseBold ? "Noto Sans SC Bold" : "Noto Sans SC";
  }
  return "Source Sans 3";
}

function fmtDateOnly(value: string | null | undefined, lang: "zh" | "es") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return lang === "zh" ? `${yyyy}/${mm}/${dd}` : `${dd}/${mm}/${yyyy}`;
}

function fmtMoney(value: number) {
  return Number(value || 0).toFixed(2);
}

async function loadProductImageBuffer(sku: string) {
  if (!sku) return null;

  const localExts = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"];
  for (const ext of localExts) {
    const imagePath = path.join(process.cwd(), "public", "products", `${sku}.${ext}`);
    try {
      const buffer = await fs.readFile(imagePath);
      return {
        buffer,
        extension: ext.toLowerCase() === "png" ? ("png" as const) : ("jpeg" as const),
      };
    } catch {
      // continue searching
    }
  }

  const remoteUrls = buildProductImageUrls(sku, ["jpg", "jpeg", "png", "webp"]);
  for (const url of remoteUrls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("image")) continue;
      const data = await response.arrayBuffer();
      if (data.byteLength <= 0) continue;
      return {
        buffer: Buffer.from(data),
        extension: contentType.includes("png") ? ("png" as const) : ("jpeg" as const),
      };
    } catch {
      // try next url
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const lang = body?.lang === "es" ? "es" : "zh";
    const records = Array.isArray(body?.records) ? (body.records as SupplierMiscExportRow[]) : [];
    if (records.length === 0) {
      return NextResponse.json({ ok: false, error: lang === "zh" ? "没有可导出的记录" : "Sin registros" }, { status: 400 });
    }

    const supplierNames = Array.from(new Set(records.map((row) => String(row.supplierName || "").trim()).filter(Boolean)));
    const supplierName =
      supplierNames.length === 1
        ? supplierNames[0]
        : supplierNames.length > 1
          ? "多个供应商"
          : "未命名供应商";
    const recordedDates = Array.from(new Set(records.map((row) => String(row.recordedDate || "").trim()).filter(Boolean)));
    const orderDateText =
      recordedDates.length === 1
        ? fmtDateOnly(recordedDates[0], lang)
        : recordedDates.length > 1
          ? (lang === "zh" ? "多日期" : "Varias fechas")
          : fmtDateOnly(new Date().toISOString(), lang);
    const skuCount = records.length;
    const totalQuantity = records.reduce((sum, row) => sum + Math.max(Number(row.quantity || 0), 0), 0);
    const exportDateCode = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeSupplierName = supplierName.replace(/[\\/:*?"<>|]/g, "_").trim() || "未命名供应商";

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(lang === "zh" ? "供应商散单" : "Proveedor");
    const headerLabels = [
      lang === "zh" ? "图片" : "Imagen",
      lang === "zh" ? "编码" : "Codigo",
      lang === "zh" ? "条形码" : "Codigo de barras",
      lang === "zh" ? "中文名" : "Nombre CN",
      lang === "zh" ? "西文名" : "Nombre ES",
      lang === "zh" ? "单价" : "Precio",
      lang === "zh" ? "数量" : "Cantidad",
      lang === "zh" ? "供应商" : "Proveedor",
      lang === "zh" ? "备注" : "Nota",
    ];

    worksheet.getRow(1).height = 24;

    worksheet.mergeCells(2, 1, 2, headerLabels.length);
    const companyCell = worksheet.getCell(2, 1);
    companyCell.value = "百盛供应链";
    companyCell.font = {
      name: getDocumentFontName("百盛供应链", { chineseBold: true }),
      size: 15,
      bold: true,
      color: { argb: "FF111827" },
    };
    companyCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(2).height = 24;

    worksheet.mergeCells(3, 1, 3, headerLabels.length);
    const summaryCell = worksheet.getCell(3, 1);
    const summaryText =
      lang === "zh"
        ? `电商订单   订单日期：${orderDateText}   SKU数量：${skuCount}   产品数量：${totalQuantity}`
        : `Pedido ecommerce   Fecha: ${orderDateText}   SKU: ${skuCount}   Cantidad: ${totalQuantity}`;
    summaryCell.value = summaryText;
    summaryCell.font = {
      name: getDocumentFontName(summaryText, { chineseBold: true }),
      size: 11,
      bold: true,
      color: { argb: "FF374151" },
    };
    summaryCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(3).height = 20;

    worksheet.mergeCells(4, 1, 4, headerLabels.length);
    const noteCell = worksheet.getCell(4, 1);
    const notePrefix = lang === "zh" ? "请在包装上写    " : "Escriba en el paquete    ";
    const noteOpenQuote = "“";
    const noteKeyword = "BS-电商";
    const noteCloseQuote = "”，谢谢！";
    noteCell.value = {
      richText: [
        {
          text: notePrefix,
          font: {
            name: getDocumentFontName(notePrefix),
            size: 11,
            bold: false,
            color: { argb: "FF374151" },
          },
        },
        {
          text: noteOpenQuote,
          font: {
            name: getDocumentFontName(noteOpenQuote),
            size: 11,
            bold: false,
            color: { argb: "FF374151" },
          },
        },
        {
          text: noteKeyword,
          font: {
            name: getDocumentFontName(noteKeyword, { chineseBold: true }),
            size: 11,
            bold: true,
            color: { argb: "FF111827" },
          },
        },
        {
          text: noteCloseQuote,
          font: {
            name: getDocumentFontName(noteCloseQuote),
            size: 11,
            bold: false,
            color: { argb: "FF374151" },
          },
        },
      ],
    };
    noteCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(4).height = 20;
    worksheet.getRow(5).height = 16;

    const headerRow = worksheet.getRow(6);
    headerLabels.forEach((label, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = label;
      cell.font = {
        name: getDocumentFontName(label, { chineseBold: true }),
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

    const imageColumnIndex = 1;
    for (const item of records) {
      const row = worksheet.addRow([
        "",
        item.sku || "-",
        item.barcode || "-",
        item.nameZh || "-",
        item.nameEs || "-",
        item.unitPrice === null || item.unitPrice === undefined ? "-" : `$${fmtMoney(Number(item.unitPrice || 0))}`,
        Number(item.quantity || 0),
        item.supplierName || "-",
        item.remark || "-",
      ]);
      row.height = 48;
      row.eachCell((cell, columnNumber) => {
        const text = String(cell.value ?? "");
        cell.font = {
          name: getDocumentFontName(text),
          size: 10.5,
          bold: false,
          color: { argb: "FF111827" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: [6, 7, 8].includes(columnNumber) ? "center" : "left",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5EAF1" } },
          left: { style: "thin", color: { argb: "FFE5EAF1" } },
          bottom: { style: "thin", color: { argb: "FFE5EAF1" } },
          right: { style: "thin", color: { argb: "FFE5EAF1" } },
        };
      });

      const image = await loadProductImageBuffer(item.sku || "");
      if (image) {
        const imageId = workbook.addImage({
          base64: `data:image/${image.extension};base64,${image.buffer.toString("base64")}`,
          extension: image.extension,
        });
        worksheet.addImage(imageId, {
          tl: { col: imageColumnIndex - 1 + 0.08, row: row.number - 0.92 },
          ext: { width: 48, height: 48 },
          editAs: "oneCell",
        });
      }
    }

    worksheet.columns = [
      { width: 9 },
      { width: 16 },
      { width: 18 },
      { width: 24 },
      { width: 26 },
      { width: 10 },
      { width: 8 },
      { width: 12 },
      { width: 22 },
    ];
    worksheet.views = [{ state: "frozen", ySplit: 6, showGridLines: false }];

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `百盛供应链-电商-${safeSupplierName}-${exportDateCode}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导出散单失败" },
      { status: 500 },
    );
  }
}
