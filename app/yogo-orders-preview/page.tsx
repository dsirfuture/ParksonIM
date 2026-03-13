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

export default async function YogoOrdersPreviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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
      customer_name: true,
      company_name: true,
      order_amount: true,
      item_count: true,
      updated_at: true,
    },
  });

  return (
    <AppShell>
      <section className="mt-5 overflow-hidden rounded-xl bg-white shadow-soft">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-[18px] font-semibold tracking-tight text-slate-900">
            YOGO 订单预览
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            仅用于订单同步效果预览，不影响正式订单页面。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">order_key</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">order_no</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">customer_id</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">customer_name</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">header_status</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">header_amount</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">latest_status</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">items_count</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">header_updated_at</th>
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
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{row.id}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.order_no}</td>
                    <td className="px-3 py-2 text-slate-600">-</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.customer_name || row.company_name || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">-</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {toMoney(row.order_amount)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">-</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {row.item_count}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatDateTime(row.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

