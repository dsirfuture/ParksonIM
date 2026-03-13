import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

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

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
      order_amount: true,
      order_remark: true,
    },
  });

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
              items: {
                orderBy: [{ line_no: "asc" }],
                select: {
                  id: true,
                  product_name: true,
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
    selectedOrder?.supplierOrders.flatMap((supplierOrder) => supplierOrder.items) || [];

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
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">订单金额</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">备注</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">order_key</th>
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
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 ${selectedOrderKey === row.id ? "bg-indigo-50/40" : ""}`}
                  >
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.order_no}</td>
                    <td className="px-3 py-2 text-slate-600">-</td>
                    <td className="px-3 py-2 text-slate-600">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2 text-slate-700">{row.company_name || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.contact_name || row.customer_name || "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {toMoney(row.order_amount)}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-slate-600">
                      {row.order_remark || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.id}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <Link
                        href={`/yogo-orders-preview?order_key=${row.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))
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
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">商品</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">数量</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">单价</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">行金额 / 小计</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {!selectedOrder ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                    暂未选择订单
                  </td>
                </tr>
              ) : detailItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                    当前订单暂无明细
                  </td>
                </tr>
              ) : (
                detailItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">
                      {item.product_name || item.item_no || item.barcode || "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.total_qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {toMoney(item.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {toMoney(item.line_total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {selectedOrder ? (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-3 py-2.5 text-sm font-semibold text-slate-900" colSpan={3}>
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
