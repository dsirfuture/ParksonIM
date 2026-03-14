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

function parseOrderNoDateText(orderNo: string | null | undefined) {
  if (!orderNo) return null;
  const clean = String(orderNo).trim();
  const match = clean.match(/^YGO(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/i);
  if (!match) {
    const fallback = clean.match(/^YGO(\d{2})(\d{2})(\d{2})/i);
    if (!fallback) return null;
    const [, yy2, mm2, dd2] = fallback;
    const year2 = 2000 + Number(yy2);
    const month2 = Number(mm2);
    const day2 = Number(dd2);
    if (
      !Number.isFinite(year2) ||
      month2 < 1 ||
      month2 > 12 ||
      day2 < 1 ||
      day2 > 31
    ) {
      return null;
    }
    return `${year2}/${String(month2).padStart(2, "0")}/${String(day2).padStart(2, "0")} 00:00`;
  }

  const [, yy, mm, dd, hh, mi] = match;
  const year = 2000 + Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(mi);

  if (
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

function normalizeOrderStatus(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const key = raw.toLowerCase();
  if (key === "1" || raw === "新订单") return "新订单";
  if (key === "2" || raw === "配货中") return "配货中";
  return raw;
}

export default async function YgOrdersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [summaryRows, customerCountRows, periodRows] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        total_orders: number | string | bigint;
        total_amount: unknown;
        latest_updated_at: Date | null;
      }>
    >(
      `
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(order_amount), 0) AS total_amount,
          MAX(updated_at) AS latest_updated_at
        FROM yg_order_imports
        WHERE tenant_id = $1::uuid
          AND company_id = $2::uuid
      `,
      session.tenantId,
      session.companyId,
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
    prisma.$queryRawUnsafe<
      Array<{
        stat_year: number;
        stat_month: number;
        period_orders: number | string | bigint;
        period_amount: unknown;
      }>
    >(
      `
        SELECT
          COALESCE(
            CASE
              WHEN order_no ~ '^YGO[0-9]{2}' THEN 2000 + SUBSTRING(order_no FROM 4 FOR 2)::int
              ELSE NULL
            END,
            EXTRACT(YEAR FROM created_at)::int
          ) AS stat_year,
          COALESCE(
            CASE
              WHEN order_no ~ '^YGO[0-9]{6}' THEN SUBSTRING(order_no FROM 6 FOR 2)::int
              ELSE NULL
            END,
            EXTRACT(MONTH FROM created_at)::int
          ) AS stat_month,
          COUNT(*) AS period_orders,
          COALESCE(SUM(order_amount), 0) AS period_amount
        FROM yg_order_imports
        WHERE tenant_id = $1::uuid
          AND company_id = $2::uuid
        GROUP BY
          COALESCE(
            CASE
              WHEN order_no ~ '^YGO[0-9]{2}' THEN 2000 + SUBSTRING(order_no FROM 4 FOR 2)::int
              ELSE NULL
            END,
            EXTRACT(YEAR FROM created_at)::int
          ),
          COALESCE(
            CASE
              WHEN order_no ~ '^YGO[0-9]{6}' THEN SUBSTRING(order_no FROM 6 FOR 2)::int
              ELSE NULL
            END,
            EXTRACT(MONTH FROM created_at)::int
          )
        ORDER BY stat_year DESC, stat_month DESC
      `,
      session.tenantId,
      session.companyId,
    ),
  ]);

  const summary = summaryRows[0];
  const customerCount = Number(customerCountRows[0]?.customer_count || 0);
  const periodStats = periodRows.map((row) => ({
    year: Number(row.stat_year),
    month: Number(row.stat_month),
    orders: Number(row.period_orders || 0),
    amountText: formatMoney(row.period_amount || 0),
  }));
  const yearOptions = Array.from(new Set(periodStats.map((row) => row.year))).sort((a, b) => b - a);
  const monthsByYear: Record<number, number[]> = {};
  for (const row of periodStats) {
    if (!monthsByYear[row.year]) monthsByYear[row.year] = [];
    if (!monthsByYear[row.year].includes(row.month)) monthsByYear[row.year].push(row.month);
  }
  Object.keys(monthsByYear).forEach((year) => {
    monthsByYear[Number(year)].sort((a, b) => b - a);
  });
  const defaultYear = periodStats.length > 0 ? periodStats[0].year : null;
  const defaultMonth = periodStats.length > 0 ? periodStats[0].month : null;

  const rows = await prisma.ygOrderImport.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: [{ order_no: "desc" }, { created_at: "desc" }],
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
  });

  const statusColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'yg_order_imports'
        AND column_name IN ('header_status', 'header_status_id', 'latest_status', 'order_created_at')
    `,
  );
  const hasHeaderStatus = statusColumns.some((col) => col.column_name === "header_status");
  const hasHeaderStatusId = statusColumns.some((col) => col.column_name === "header_status_id");
  const hasLatestStatus = statusColumns.some((col) => col.column_name === "latest_status");
  const hasOrderCreatedAt = statusColumns.some((col) => col.column_name === "order_created_at");

  let statusById = new Map<string, string>();
  let orderCreatedAtById = new Map<string, Date>();

  if (hasHeaderStatus || hasHeaderStatusId || hasLatestStatus || hasOrderCreatedAt) {
    const statusExpr = hasHeaderStatus
      ? "NULLIF(TRIM(CAST(header_status AS text)), '')"
      : "NULL";
    const statusIdExpr = hasHeaderStatusId
      ? "NULLIF(TRIM(CAST(header_status_id AS text)), '')"
      : "NULL";
    const latestStatusExpr = hasLatestStatus
      ? "NULLIF(TRIM(CAST(latest_status AS text)), '')"
      : "NULL";
    const createdExpr = hasOrderCreatedAt ? "order_created_at" : "created_at";

    const statusRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; header_status: string | null; order_created_at: Date | null }>
    >(
      `
        SELECT
          CAST(id AS text) AS id,
          COALESCE(${statusExpr}, ${statusIdExpr}, ${latestStatusExpr}) AS header_status,
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
        .map((row) => [row.id, normalizeOrderStatus(row.header_status)]),
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

  const initialRows = rows.map((row) => {
    const uniqueLocations = new Set(
      row.supplierOrders
        .flatMap((supplierOrder) =>
          supplierOrder.items.map((detail) => (detail.location || "").trim().toUpperCase()),
        )
        .filter(Boolean),
    );

    const orderCreatedAt = orderCreatedAtById.get(row.id);
    const orderDateText = orderCreatedAt
      ? formatDateTime(orderCreatedAt)
      : parseOrderNoDateText(row.order_no) || "-";
    return {
    id: row.id,
    orderNo: row.order_no,
    orderStatus: normalizeOrderStatus(statusById.get(row.id)),
    orderDateText,
    orderAmountText: formatMoney(row.order_amount),
    companyName: row.company_name || row.customer_name || "-",
    customerName: row.customer_name || "",
    contactName: row.contact_name || row.customer_name || "-",
    contactPhone: row.contact_phone || "",
    addressText: row.address_text || "",
    remarkText: row.order_remark || "",
    storeLabelText: row.store_label || "",
    createdAtText: formatDateTime(row.created_at),
    supplierCount: uniqueLocations.size > 0 ? uniqueLocations.size : row.supplier_count,
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
          lineTotalText:
            formatMoney(detail.line_total) !== "-"
              ? formatMoney(detail.line_total)
              : formatMoney((detail.total_qty || 0) * Number(detail.unit_price || 0)),
        })),
      })),
    };
  });

  return (
    <AppShell>
      <YgOrdersClient
        initialRows={initialRows}
        summary={{
          totalOrders: Number(summary?.total_orders || 0),
          totalAmountText: formatMoney(summary?.total_amount || 0),
          periodStats,
          yearOptions,
          monthsByYear,
          defaultYear,
          defaultMonth,
          customerCount,
          latestUpdatedAtText: formatDateTime(summary?.latest_updated_at || null),
        }}
      />
    </AppShell>
  );
}
