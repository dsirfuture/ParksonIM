import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { parseYogoDiscountParts } from "@/lib/yogo-product-utils";
import { getSession } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { YgOrdersClient } from "./YgOrdersClient";

function formatDateTime(value: Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
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

export default async function YgOrdersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

  const [summaryRows, customerCountRows] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        total_orders: number | string | bigint;
        total_amount: unknown;
        year_orders: number | string | bigint;
        year_amount: unknown;
        latest_updated_at: Date | null;
      }>
    >(
      `
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(order_amount), 0) AS total_amount,
          COUNT(*) FILTER (WHERE created_at >= $3::timestamptz) AS year_orders,
          COALESCE(SUM(order_amount) FILTER (WHERE created_at >= $3::timestamptz), 0) AS year_amount,
          MAX(updated_at) AS latest_updated_at
        FROM yg_order_imports
        WHERE tenant_id = $1::uuid
          AND company_id = $2::uuid
      `,
      session.tenantId,
      session.companyId,
      yearStart,
    ),
    prisma.$queryRawUnsafe<Array<{ customer_count: number | string | bigint }>>(
      `
        SELECT
          COUNT(DISTINCT NULLIF(TRIM(company_name), '')) AS customer_count
        FROM yg_order_imports
        WHERE tenant_id = $1::uuid
          AND company_id = $2::uuid
      `,
      session.tenantId,
      session.companyId,
    ),
  ]);

  const summary = summaryRows[0];
  const customerCount = Number(customerCountRows[0]?.customer_count || 0);

  const rows = await prisma.ygOrderImport.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: {
      created_at: "desc",
    },
    include: {
      supplierOrders: {
        orderBy: {
          supplier_code: "asc",
        },
        include: {
          items: {
            orderBy: {
              line_no: "asc",
            },
          },
        },
      },
    },
    take: 50,
  });

  const statusColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'yg_order_imports'
        AND column_name IN ('header_status', 'header_status_id', 'order_created_at')
    `,
  );
  const hasHeaderStatus = statusColumns.some((col) => col.column_name === "header_status");
  const hasHeaderStatusId = statusColumns.some((col) => col.column_name === "header_status_id");
  const hasOrderCreatedAt = statusColumns.some((col) => col.column_name === "order_created_at");

  let statusById = new Map<string, string>();
  let orderCreatedAtById = new Map<string, Date>();

  if (hasHeaderStatus || hasHeaderStatusId || hasOrderCreatedAt) {
    const statusExpr = hasHeaderStatus
      ? "NULLIF(TRIM(CAST(header_status AS text)), '')"
      : "NULL";
    const statusIdExpr = hasHeaderStatusId
      ? "NULLIF(TRIM(CAST(header_status_id AS text)), '')"
      : "NULL";
    const createdExpr = hasOrderCreatedAt ? "order_created_at" : "created_at";

    const statusRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; header_status: string | null; order_created_at: Date | null }>
    >(
      `
        SELECT
          CAST(id AS text) AS id,
          COALESCE(${statusExpr}, ${statusIdExpr}) AS header_status,
          ${createdExpr} AS order_created_at
        FROM yg_order_imports
        WHERE tenant_id = $1::uuid
          AND company_id = $2::uuid
      `,
      session.tenantId,
      session.companyId,
    );

    statusById = new Map(
      statusRows
        .filter((row) => row.header_status)
        .map((row) => [row.id, String(row.header_status || "").trim()]),
    );
    orderCreatedAtById = new Map(
      statusRows
        .filter((row) => row.order_created_at)
        .map((row) => [row.id, row.order_created_at as Date]),
    );
  }

  const skuSet = new Set<string>();
  const barcodeSet = new Set<string>();
  for (const row of rows) {
    for (const so of row.supplierOrders) {
      for (const item of so.items) {
        if (item.item_no) skuSet.add(item.item_no.trim());
        if (item.barcode) barcodeSet.add(item.barcode.trim());
      }
    }
  }

  const yogoNameRows =
    skuSet.size > 0 || barcodeSet.size > 0
      ? await prisma.yogoProductSource.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
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
            category_name: true,
            source_discount: true,
          },
        })
      : [];

  const nameBySku = new Map(
    yogoNameRows.map((row) => [
      String(row.product_code || "").trim(),
      {
        zh: row.name_cn || "",
        es: row.name_es || "",
        ...parseYogoDiscountParts(row.category_name, row.source_discount),
      },
    ]),
  );
  const nameByBarcode = new Map(
    yogoNameRows
      .filter((row) => row.product_no)
      .map((row) => [
        String(row.product_no || "").trim(),
        {
          zh: row.name_cn || "",
          es: row.name_es || "",
          ...parseYogoDiscountParts(row.category_name, row.source_discount),
        },
      ]),
  );

  const initialRows = rows.map((row) => ({
    id: row.id,
    orderNo: row.order_no,
    orderStatus: statusById.get(row.id) || "-",
    orderDateText: formatDateTime(orderCreatedAtById.get(row.id) || row.created_at),
    orderAmountText: formatMoney(row.order_amount),
    companyName: row.company_name || row.customer_name || "-",
    customerName: row.customer_name || "",
    contactName: row.contact_name || row.customer_name || "-",
    contactPhone: row.contact_phone || "",
    addressText: row.address_text || "",
    remarkText: row.order_remark || "",
    storeLabelText: row.store_label || "",
    createdAtText: formatDateTime(row.created_at),
    supplierCount: row.supplier_count,
    itemCount: row.item_count,
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
          nameCn:
            nameBySku.get(detail.item_no || "")?.zh ||
            nameByBarcode.get(detail.barcode || "")?.zh ||
            "",
          nameEs:
            nameBySku.get(detail.item_no || "")?.es ||
            nameByBarcode.get(detail.barcode || "")?.es ||
            "",
          normalDiscount:
            nameBySku.get(detail.item_no || "")?.normal ||
            nameByBarcode.get(detail.barcode || "")?.normal ||
            "-",
          vipDiscount:
            nameBySku.get(detail.item_no || "")?.vip ||
            nameByBarcode.get(detail.barcode || "")?.vip ||
            "-",
          totalQty: detail.total_qty,
          unitPriceText: formatMoney(detail.unit_price),
          lineTotalText: formatMoney(detail.line_total),
      })),
    })),
  }));

  return (
    <AppShell>
      <YgOrdersClient
        initialRows={initialRows}
        summary={{
          totalOrders: Number(summary?.total_orders || 0),
          totalAmountText: formatMoney(summary?.total_amount || 0),
          yearOrders: Number(summary?.year_orders || 0),
          yearAmountText: formatMoney(summary?.year_amount || 0),
          customerCount,
          latestUpdatedAtText: formatDateTime(summary?.latest_updated_at || null),
        }}
      />
    </AppShell>
  );
}
