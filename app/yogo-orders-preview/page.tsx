// @ts-nocheck
﻿import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { parseBillingRemark } from "@/lib/billing-meta";
import { ProductImage } from "@/components/product-image";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { parseYogoDiscountParts } from "@/lib/yogo-product-utils";

function toMoney(value: unknown) {
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
  return Number.isFinite(num) ? num.toFixed(2) : "-";
}

function toNumberSafe(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const text = String(value);
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function splitMixedProductName(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return { zh: "", es: "" };
  const zhTokens = raw.match(/[\u4e00-\u9fff][^A-Za-z]*/g) || [];
  const zh = zhTokens.join("").replace(/\s+/g, " ").trim();
  const es = raw
    .replace(/[\u4e00-\u9fff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { zh, es };
}

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return "-";
  const cleaned = value
    .replace(/[\[\]"]/g, " ")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "-";
}

function extractPhone(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "");
    if (!text) continue;
    const match = text.match(/\+?\d{8,15}/g);
    if (match && match.length > 0) {
      return normalizePhone(match[0]);
    }
  }
  return "-";
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOrderStatus(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  if (key === "1" || key === "new" || key === "new_order" || key === "new order" || raw === "新订单") return "新订单";
  if (key === "2" || key === "packing" || key === "picking" || raw === "配货中") return "配货中";
  if (/^\s*鏂/.test(raw)) return "新订单";
  if (/^\s*閰/.test(raw)) return "配货中";
  return raw;
}

function deriveFallbackStatus(
  rowId: string,
  explicitStatusById: Map<string, string>,
  latestImplicitNewId: string | null,
) {
  const explicit = normalizeOrderStatus(explicitStatusById.get(rowId));
  if (explicit) return explicit;
  if (latestImplicitNewId && rowId === latestImplicitNewId) return "新订单";
  return "配货中";
}

export default async function YogoOrdersPreviewPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const searchParams = (await props.searchParams) || {};
  const selectedOrderKey = firstValue(searchParams.order_key) || "";

  const rows = await prisma.ygOrderImport.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: { updated_at: "desc" },
    take: 200,
    select: {
      id: true,
      order_no: true,
      created_at: true,
      company_name: true,
      customer_name: true,
      contact_name: true,
      contact_phone: true,
      order_amount: true,
      order_remark: true,
      item_count: true,
    },
  });
  const rowIds = rows.map((r) => r.id);
  const supplierOrderAmountSums =
    rowIds.length > 0
      ? await prisma.ygSupplierOrder.groupBy({
          by: ["import_id"],
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            import_id: { in: rowIds },
          },
          _sum: { order_amount: true },
        })
      : [];
  const supplierAmountByImportId = new Map(
    supplierOrderAmountSums.map((r) => [r.import_id, r._sum.order_amount]),
  );
  const itemLineTotalRows =
    rowIds.length > 0
      ? await prisma.$queryRawUnsafe<Array<{ import_id: string; line_sum: number | null }>>(
          `
            SELECT
              CAST(so.import_id AS text) AS import_id,
              SUM(
                COALESCE(i.line_total, (COALESCE(i.unit_price, 0) * COALESCE(i.total_qty, 0)))
              )::float AS line_sum
            FROM yg_supplier_orders so
            LEFT JOIN yg_supplier_order_items i ON i.supplier_order_id = so.id
            WHERE so.tenant_id = $1::uuid
              AND so.company_id = $2::uuid
              AND so.import_id = ANY($3::uuid[])
            GROUP BY so.import_id
          `,
          session.tenantId,
          session.companyId,
          rowIds,
        )
      : [];
  const itemLineSumByImportId = new Map(
    itemLineTotalRows.map((r) => [r.import_id, r.line_sum]),
  );

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
  if (hasHeaderStatus || hasHeaderStatusId || hasLatestStatus) {
    const statusExpr = hasHeaderStatus
      ? `
        CASE
          WHEN header_status IS NULL THEN NULL
          WHEN LOWER(TRIM(CAST(header_status AS text))) IN ('', '-', '—', 'n/a', 'null', 'none')
            THEN NULL
          ELSE TRIM(CAST(header_status AS text))
        END
      `
      : "NULL";
    const statusIdExpr = hasHeaderStatusId
      ? `
        CASE
          WHEN header_status_id IS NULL THEN NULL
          WHEN LOWER(TRIM(CAST(header_status_id AS text))) IN ('', '-', '—', 'n/a', 'null', 'none')
            THEN NULL
          ELSE TRIM(CAST(header_status_id AS text))
        END
      `
      : "NULL";
    const latestStatusExpr = hasLatestStatus
      ? `
        CASE
          WHEN latest_status IS NULL THEN NULL
          WHEN LOWER(TRIM(CAST(latest_status AS text))) IN ('', '-', '—', 'n/a', 'null', 'none')
            THEN NULL
          ELSE TRIM(CAST(latest_status AS text))
        END
      `
      : "NULL";
    const createdAtExpr = hasOrderCreatedAt
      ? "order_created_at"
      : "created_at";
    const statusRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; header_status: string | null; order_created_at: Date | null }>
    >(
      `
        SELECT
          CAST(id AS text) AS id,
          COALESCE(${statusExpr}, ${statusIdExpr}, ${latestStatusExpr}) AS header_status,
          ${createdAtExpr} AS order_created_at
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

  const latestImplicitNewId =
    rows
      .filter((row) => !normalizeOrderStatus(statusById.get(row.id)))
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
        if (leftTime !== rightTime) return rightTime - leftTime;
        return String(right.order_no || "").localeCompare(String(left.order_no || ""));
      })[0]?.id || null;

  const selectedOrder = selectedOrderKey
    ? await prisma.ygOrderImport.findFirst({
        where: {
          id: selectedOrderKey,
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
        select: {
          id: true,
          order_no: true,
          order_amount: true,
          supplierOrders: {
            orderBy: [{ supplier_code: "asc" }],
            select: {
              id: true,
              supplier_code: true,
              items: {
                orderBy: [{ line_no: "asc" }],
                select: {
                  id: true,
                  product_name: true,
                  location: true,
                  item_no: true,
                  barcode: true,
                  total_qty: true,
                  unit_price: true,
                  line_total: true,
                },
              },
            },
          },
        },
      })
    : null;

  const detailItems =
    selectedOrder?.supplierOrders.flatMap((supplierOrder) =>
      supplierOrder.items.map((item) => ({
        ...item,
        supplier_code: supplierOrder.supplier_code,
      })),
    ) || [];

  const skuSet = new Set(
    detailItems.map((item) => String(item.item_no || "").trim()).filter(Boolean),
  );
  const barcodeSet = new Set(
    detailItems.map((item) => String(item.barcode || "").trim()).filter(Boolean),
  );

  const yogoNameRows =
    selectedOrder && (skuSet.size > 0 || barcodeSet.size > 0)
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
  const skuByBarcode = new Map(
    yogoNameRows
      .filter((row) => row.product_no && row.product_code)
      .map((row) => [String(row.product_no || "").trim(), String(row.product_code || "").trim()]),
  );

  const detailSum = detailItems.reduce((sum, item) => {
    const line =
      typeof item.line_total === "object" &&
      item.line_total !== null &&
      "toNumber" in item.line_total &&
      typeof (item.line_total as { toNumber: unknown }).toNumber === "function"
        ? (item.line_total as { toNumber: () => number }).toNumber()
        : Number(item.line_total || 0);
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0);

  return (
    <AppShell>
      <section className="mt-5 overflow-hidden rounded-xl bg-white shadow-soft">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-[18px] font-semibold tracking-tight text-slate-900">
            YOGO 订单预览
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            仅用于查看订单同步效果，不影响正式订单页面。
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">订单编号</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">订单状态</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">订单日期</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">公司名称</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">联系人</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">联系电话</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">订单金额</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">备注</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">详情</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                    暂无订单预览数据
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const parsedRemark = parseBillingRemark(row.order_remark);
                  return (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 ${selectedOrderKey === row.id ? "bg-indigo-50/40" : ""}`}
                  >
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.order_no}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {deriveFallbackStatus(row.id, statusById, latestImplicitNewId)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatDateTime(orderCreatedAtById.get(row.id) || row.created_at)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.company_name || row.customer_name || row.contact_name || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.contact_name || row.customer_name || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {extractPhone(row.contact_phone, row.contact_name, parsedRemark.noteText)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {toMoney(
                        row.order_amount ??
                          supplierAmountByImportId.get(row.id) ??
                          itemLineSumByImportId.get(row.id) ??
                          null,
                      )}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-slate-600">
                      {parsedRemark.noteText || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <Link
                        href={`/yogo-orders-preview?order_key=${row.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-xl bg-white shadow-soft">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">订单详情预览</h3>
          <p className="mt-1 text-sm text-slate-500">
            {selectedOrder ? `当前订单：${selectedOrder.order_no}` : "请在上方列表点击“查看详情”"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">产品图片</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">商品</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">条形码</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">供应商</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">中文名</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">西文名</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">数量</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">单价</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">普通折扣</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">VIP折扣</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">行金额 / 小计</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {!selectedOrder ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-slate-500">
                    暂未选择订单
                  </td>
                </tr>
              ) : detailItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-slate-500">
                    当前订单暂无明细
                  </td>
                </tr>
              ) : (
                detailItems.map((item) => {
                  const sku = String(item.item_no || "").trim();
                  const barcode = String(item.barcode || "").trim();
                  const mapped =
                    nameBySku.get(sku) ||
                    nameByBarcode.get(barcode) || { zh: "", es: "", normal: "-", vip: "-" };
                  const splitName = splitMixedProductName(item.product_name || "");
                  const safeQty = toNumberSafe(item.total_qty) ?? 0;
                  const safeUnitPrice = toNumberSafe(item.unit_price) ?? 0;
                  const safeLineTotal = toNumberSafe(item.line_total) ?? 0;
                  const computedLineTotal =
                    Number.isFinite(safeLineTotal) && safeLineTotal > 0
                      ? safeLineTotal
                      : Number.isFinite(safeQty) && Number.isFinite(safeUnitPrice)
                        ? safeQty * safeUnitPrice
                        : 0;
                  const displayLineTotal =
                    computedLineTotal > 0 ? computedLineTotal : item.line_total;
                  const imageSku = sku || skuByBarcode.get(barcode) || "";
                  const hasImage = Boolean(imageSku && (nameBySku.has(imageSku) || nameByBarcode.has(barcode)));
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <ProductImage
                          sku={imageSku || undefined}
                          hasImage={hasImage}
                          size={40}
                          roundedClassName="rounded-md"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {item.product_name || item.item_no || item.barcode || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{item.barcode || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {item.location || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {mapped.zh || splitName.zh || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {mapped.es || splitName.es || "-"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.total_qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {toMoney(item.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{mapped.normal || "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{mapped.vip || "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {toMoney(displayLineTotal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {selectedOrder ? (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-3 py-2.5 text-sm font-semibold text-slate-900" colSpan={9}>
                    订单总金额
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900">
                    {toMoney(selectedOrder.order_amount) !== "-"
                      ? toMoney(selectedOrder.order_amount)
                      : toMoney(detailSum)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </AppShell>
  );
}
