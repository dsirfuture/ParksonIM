import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

type ParsedRow = {
  lineNo: number;
  location: string;
  itemNo: string;
  barcode: string;
  productName: string;
  totalQty: number;
  unitPrice: number | null;
  lineTotal: number | null;
  imageFormula: string;
};

function cellText(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, "").replace(/：/g, ":").trim();
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : null;
}

function findHeaderRowIndex(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const values = row.map((cell) => cellText(cell));
    return values.includes("位置") && values.includes("编号") && values.includes("条形码");
  });
}

function mapHeaderIndexes(headerRow: string[]) {
  const findIndex = (label: string) => headerRow.findIndex((item) => item === label);

  return {
    image: findIndex("图片"),
    location: findIndex("位置"),
    itemNo: findIndex("编号"),
    barcode: findIndex("条形码"),
    productName: findIndex("产品品名"),
    totalQty: findIndex("总数量"),
    unitPrice: findIndex("价格"),
    lineTotal: findIndex("合计"),
  };
}

function extractValueByLabels(rows: unknown[][], labels: string[]) {
  const normalizedLabels = labels.map((label) => normalizeText(label));

  for (const row of rows.slice(0, 20)) {
    for (let i = 0; i < row.length; i += 1) {
      const currentRaw = cellText(row[i]);
      const current = normalizeText(currentRaw);

      if (!current) continue;

      for (const label of normalizedLabels) {
        if (current.startsWith(`${label}:`)) {
          return currentRaw.split(/[:：]/).slice(1).join(":").trim();
        }

        if (current === label) {
          const next = cellText(row[i + 1]);
          if (next) return next;
        }

        const regex = new RegExp(`${label}\\s*[:：]\\s*(.*)$`, "i");
        const match = currentRaw.match(regex);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
    }
  }

  return "";
}

function isHeaderLikeRow(location: string, itemNo: string, barcode: string, productName: string) {
  const a = normalizeText(location);
  const b = normalizeText(itemNo);
  const c = normalizeText(barcode);
  const d = normalizeText(productName);

  return (
    a === "位置" ||
    b === "编号" ||
    c === "条形码" ||
    d === "产品品名" ||
    (a === "位置" && b === "编号") ||
    (a === "位置" && c === "条形码")
  );
}

function isInvalidSupplierCode(value: string) {
  const normalized = normalizeText(value).toUpperCase();

  if (!normalized) return true;

  return (
    normalized === "位置" ||
    normalized === "POSITION" ||
    normalized === "POSICION" ||
    normalized === "UBICACION"
  );
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) return "-";

  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : typeof value === "object" &&
            value !== null &&
            "toNumber" in value &&
            typeof (value as { toNumber: unknown }).toNumber === "function"
          ? (value as { toNumber: () => number }).toNumber()
          : Number(value);

  if (!Number.isFinite(num)) return "-";
  return num.toFixed(2);
}

function buildImportResponse(row: {
  id: string;
  order_no: string;
  order_amount: unknown;
  customer_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address_text: string | null;
  order_remark: string | null;
  store_label: string | null;
  created_at: Date;
  supplierOrders: Array<{
    id: string;
    supplier_code: string;
    derived_order_no: string;
    order_amount: unknown;
    item_count: number;
    note_text: string | null;
    items: Array<{
      id: string;
      location: string;
      item_no: string | null;
      barcode: string | null;
      product_name: string | null;
      total_qty: number;
      unit_price: unknown;
      line_total: unknown;
    }>;
  }>;
}) {
  return {
    id: row.id,
    orderNo: row.order_no,
    orderAmountText: formatMoney(row.order_amount),
    customerName: row.customer_name || "",
    contactText: [row.contact_name || "", row.contact_phone || ""].filter(Boolean).join(" / "),
    addressText: row.address_text || "",
    remarkText: row.order_remark || "",
    storeLabelText: row.store_label || "",
    createdAtText: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(row.created_at),
    supplierCount: row.supplierOrders.length,
    itemCount: row.supplierOrders.reduce((sum, item) => sum + item.item_count, 0),
    supplierOrders: row.supplierOrders.map((item) => ({
      id: item.id,
      supplierCode: item.supplier_code,
      derivedOrderNo: item.derived_order_no,
      orderAmountText: formatMoney(item.order_amount),
      itemCount: item.item_count,
      noteText: item.note_text || "",
      items: item.items.map((detail) => ({
        id: detail.id,
        location: detail.location,
        itemNo: detail.item_no || "",
        barcode: detail.barcode || "",
        productName: detail.product_name || "",
        totalQty: detail.total_qty,
        unitPriceText: formatMoney(detail.unit_price),
        lineTotalText: formatMoney(detail.line_total),
      })),
    })),
  };
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "请先选择订单总表" }, { status: 400 });
    }

    const fileName = file.name || "yg-order.xlsx";
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ ok: false, error: "文件中未找到工作表" }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const orderNo = extractValueByLabels(rows, ["订单号"]);
    const orderAmount = parseNumber(extractValueByLabels(rows, ["订单金额"]));
    const companyName = extractValueByLabels(rows, ["公司名称"]);
    const customerName = extractValueByLabels(rows, ["客户名称", "客户", "收货方"]);
    const contactName = extractValueByLabels(rows, ["联系人", "联络人"]);
    const contactPhone = extractValueByLabels(rows, ["联系电话", "电话", "手机"]);
    const addressText = extractValueByLabels(rows, ["联系地址", "地址", "送货地址", "收货地址"]);
    const orderRemark = extractValueByLabels(rows, ["订单备注", "备注"]);
    const lastThree = orderNo.slice(-3);

    const headerRowIndex = findHeaderRowIndex(rows);

    if (!orderNo) {
      return NextResponse.json({ ok: false, error: "未识别到订单号" }, { status: 400 });
    }

    if (headerRowIndex < 0) {
      return NextResponse.json({ ok: false, error: "未识别到明细表头" }, { status: 400 });
    }

    const headerRow = rows[headerRowIndex].map((item) => cellText(item));
    const indexes = mapHeaderIndexes(headerRow);

    if (
      indexes.location < 0 ||
      indexes.itemNo < 0 ||
      indexes.barcode < 0 ||
      indexes.productName < 0 ||
      indexes.totalQty < 0 ||
      indexes.unitPrice < 0 ||
      indexes.lineTotal < 0
    ) {
      return NextResponse.json(
        { ok: false, error: "明细表头不完整，无法拆分供应商订单" },
        { status: 400 },
      );
    }

    const items: ParsedRow[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
      const row = rows[i];
      const location = cellText(row[indexes.location]);
      const itemNo = cellText(row[indexes.itemNo]);
      const barcode = cellText(row[indexes.barcode]);
      const productName = cellText(row[indexes.productName]);
      const totalQty = parseNumber(row[indexes.totalQty]);
      const unitPrice = parseNumber(row[indexes.unitPrice]);
      const lineTotal = parseNumber(row[indexes.lineTotal]);
      const imageFormula = indexes.image >= 0 ? cellText(row[indexes.image]) : "";

      const emptyRow =
        !location &&
        !itemNo &&
        !barcode &&
        !productName &&
        totalQty === null &&
        unitPrice === null &&
        lineTotal === null;

      if (emptyRow) continue;

      if (isHeaderLikeRow(location, itemNo, barcode, productName)) continue;
      if (isInvalidSupplierCode(location)) continue;

      items.push({
        lineNo: items.length + 1,
        location,
        itemNo,
        barcode,
        productName,
        totalQty: totalQty ?? 0,
        unitPrice,
        lineTotal,
        imageFormula,
      });
    }

    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "未读取到商品明细" }, { status: 400 });
    }

    const groups = new Map<string, ParsedRow[]>();

    for (const item of items) {
      const supplierCode = item.location.trim().toUpperCase();

      if (isInvalidSupplierCode(supplierCode)) continue;

      const current = groups.get(supplierCode) || [];
      current.push(item);
      groups.set(supplierCode, current);
    }

    if (groups.size === 0) {
      return NextResponse.json(
        { ok: false, error: "未从位置列识别到供应商" },
        { status: 400 },
      );
    }

    const noteText = `PARKSON : 配货，请包装上标明此订单号最后“三位数”。${lastThree}`;

    const existing = await prisma.ygOrderImport.findFirst({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        order_no: orderNo,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.ygOrderImport.delete({
        where: { id: existing.id },
      });
    }

    const created = await prisma.ygOrderImport.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        order_no: orderNo,
        source_file_name: fileName,
        sheet_name: sheetName,
        order_amount: orderAmount,
        last_three: lastThree,
        company_name: companyName || null,
        customer_name: customerName || companyName || null,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        address_text: addressText || null,
        order_remark: orderRemark || null,
        supplier_count: groups.size,
        item_count: items.length,
        created_by: session.userId,
        supplierOrders: {
          create: Array.from(groups.entries()).map(([supplierCode, supplierItems]) => ({
            tenant_id: session.tenantId,
            company_id: session.companyId,
            order_no: orderNo,
            supplier_code: supplierCode,
            derived_order_no: `${orderNo}-${supplierCode}-${lastThree}`,
            order_amount: supplierItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0),
            note_text: noteText,
            item_count: supplierItems.length,
            items: {
              create: supplierItems.map((item) => ({
                tenant_id: session.tenantId,
                company_id: session.companyId,
                line_no: item.lineNo,
                location: item.location,
                item_no: item.itemNo || null,
                barcode: item.barcode || null,
                product_name: item.productName || null,
                total_qty: item.totalQty,
                unit_price: item.unitPrice,
                line_total: item.lineTotal,
                image_formula: item.imageFormula || null,
              })),
            },
          })),
        },
      },
      include: {
        supplierOrders: {
          orderBy: { supplier_code: "asc" },
          include: {
            items: {
              orderBy: { line_no: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      data: buildImportResponse(created),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "导入失败",
      },
      { status: 500 },
    );
  }
}
