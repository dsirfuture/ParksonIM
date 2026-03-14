import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
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

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

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

function formatTime(value: Date | string | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mi = `${date.getMinutes()}`.padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function computeRow(item: {
  sku: string | null;
  barcode: string | null;
  name_zh: string | null;
  name_es: string | null;
  expected_qty: number | null;
  good_qty: number | null;
  damaged_qty: number | null;
  excess_qty: number | null;
  unexpected: boolean;
  sell_price: unknown;
}) {
  const expectedQty = toNumber(item.expected_qty) ?? 0;
  const goodQty = item.unexpected ? 0 : (item.good_qty ?? 0);
  const damagedQty = item.unexpected ? 0 : (item.damaged_qty ?? 0);
  const excessQty = item.unexpected ? 0 : (item.excess_qty ?? 0);
  const checkedQty = goodQty + damagedQty;
  const diffQty = item.unexpected
    ? 0
    : Math.max(expectedQty - Math.min(checkedQty, expectedQty), 0);

  return {
    sku: item.sku || "",
    barcode: item.barcode || "",
    nameZh: item.name_zh || "",
    nameEs: item.name_es || "",
    expectedQty,
    unitPrice: toNumber(item.sell_price),
    goodQty,
    diffQty,
    damagedQty,
    excessQty,
    remark: item.unexpected ? "新增" : "",
  };
}

async function loadProductImageBuffer(sku: string) {
  if (!sku) return null;

  const localExts = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"];
  for (const ext of localExts) {
    const imagePath = path.join(
      process.cwd(),
      "public",
      "products",
      `${sku}.${ext}`,
    );
    try {
      return await fs.readFile(imagePath);
    } catch {
      // try next ext
    }
  }

  const remoteUrls = buildProductImageUrls(sku, ["jpg", "jpeg", "png", "webp"]);
  for (const url of remoteUrls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.arrayBuffer();
      if (data.byteLength > 0) return Buffer.from(data);
    } catch {
      // try next url
    }
  }

  return null;
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFD9E1EA" } },
    left: { style: "thin", color: { argb: "FFD9E1EA" } },
    bottom: { style: "thin", color: { argb: "FFD9E1EA" } },
    right: { style: "thin", color: { argb: "FFD9E1EA" } },
  };
}

function applyFont(cell: ExcelJS.Cell, bold = false, size = 11) {
  const value =
    typeof cell.value === "object" && cell.value !== null && "richText" in cell.value
      ? String((cell.value as { richText: Array<{ text?: string }> }).richText.map((part) => part.text || "").join(""))
      : String(cell.value ?? "");
  cell.font = {
    name: getDocumentFontName(value, { chineseBold: bold }),
    size,
    bold,
    color: { argb: "FF111827" },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      include: {
        items: {
          select: {
            sku: true,
            barcode: true,
            name_zh: true,
            name_es: true,
            expected_qty: true,
            good_qty: true,
            damaged_qty: true,
            excess_qty: true,
            unexpected: true,
            sell_price: true,
            created_at: true,
          },
          orderBy: {
            created_at: "asc",
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "未找到验货单" }, { status: 404 });
    }

    const rows = receipt.items.map(computeRow);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("商品明细", {
      views: [{ state: "frozen", ySplit: 6, showGridLines: true }],
    });

    worksheet.properties.defaultRowHeight = 24;

    worksheet.columns = [
      { key: "image", width: 13 },
      { key: "sku", width: 16 },
      { key: "barcode", width: 20 },
      { key: "nameZh", width: 18 },
      { key: "nameEs", width: 18 },
      { key: "expectedQty", width: 10 },
      { key: "unitPrice", width: 10 },
      { key: "goodQty", width: 10 },
      { key: "diffQty", width: 10 },
      { key: "damagedQty", width: 10 },
      { key: "excessQty", width: 10 },
      { key: "remark", width: 12 },
    ];

    worksheet.mergeCells("A1:B1");
    worksheet.getCell("A1").value = "ParksonMX";
    worksheet.getCell("A1").font = {
      name: "Microsoft YaHei",
      size: 20,
      bold: true,
      color: { argb: "FF111827" },
    };
    worksheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    worksheet.getRow(1).height = 34;

    worksheet.getCell("A2").value = "验货单号:";
    worksheet.getCell("B2").value = receipt.receipt_no || "";
    worksheet.getCell("A3").value = "供应商名称:";
    worksheet.getCell("B3").value = receipt.supplier_name || "";
    worksheet.getCell("A4").value = "验货时间:";
    worksheet.getCell("B4").value = formatTime(receipt.last_activity_at);

    for (let rowNumber = 2; rowNumber <= 4; rowNumber += 1) {
      const leftCell = worksheet.getCell(`A${rowNumber}`);
      const rightCell = worksheet.getCell(`B${rowNumber}`);

      applyFont(leftCell, true, 11);
      applyFont(rightCell, false, 11);

      leftCell.alignment = {
        vertical: "middle",
        horizontal: "left",
      };
      rightCell.alignment = {
        vertical: "middle",
        horizontal: "left",
      };

      worksheet.getRow(rowNumber).height = 24;
    }

    const headerRowNumber = 6;
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.values = [
      "图片",
      "SKU",
      "条码",
      "中文名",
      "西文名",
      "应验",
      "单价",
      "良品",
      "相差",
      "破损",
      "超收",
      "备注",
    ];
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      applyFont(cell, true, 11);
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      applyBorder(cell);
    });

    for (let i = 0; i < rows.length; i += 1) {
      const rowData = rows[i];
      const excelRowNumber = headerRowNumber + 1 + i;
      const row = worksheet.getRow(excelRowNumber);
      row.height = 44;

      row.getCell(1).value = "";
      row.getCell(2).value = rowData.sku;
      row.getCell(3).value = rowData.barcode;
      row.getCell(4).value = rowData.nameZh;
      row.getCell(5).value = rowData.nameEs;
      row.getCell(6).value = rowData.expectedQty;
      row.getCell(7).value =
        rowData.unitPrice === null ? "" : round2(rowData.unitPrice);
      row.getCell(8).value = rowData.goodQty;
      row.getCell(9).value = rowData.diffQty;
      row.getCell(10).value = rowData.damagedQty;
      row.getCell(11).value = rowData.excessQty;
      row.getCell(12).value = rowData.remark;

      row.eachCell((cell, colNumber) => {
        applyFont(cell, false, 11);

        if (colNumber === 4 || colNumber === 5) {
          cell.alignment = {
            vertical: "middle",
            horizontal: "left",
          };
        } else {
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
          };
        }

        applyBorder(cell);
      });

      const imageBuffer = await loadProductImageBuffer(rowData.sku);

      if (imageBuffer) {
        const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
        const imageId = workbook.addImage({
          base64: imageBase64,
          extension: "jpeg",
        });

        worksheet.addImage(imageId, `A${excelRowNumber}:A${excelRowNumber}`);
      } else {
        row.getCell(1).value = "空";
        applyFont(row.getCell(1), false, 11);
        row.getCell(1).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `${receipt.receipt_no || receipt.id}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          fileName,
        )}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出表格失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
