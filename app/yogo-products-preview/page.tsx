import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

function toNumber(value: unknown) {
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
  return null;
}

function moneyText(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "-";
  return num.toFixed(2);
}

function discountText(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "-";
  return `${Number.isInteger(num) ? num : num.toFixed(2)}%`;
}

function dtText(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

export default async function YogoProductsPreviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await hasPermission(session, "manageProducts"))) redirect("/dashboard");

  const rows = await prisma.yogoProductSource.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: [{ updated_at: "desc" }, { product_code: "asc" }],
    take: 200,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">YOGO 商品来源预览</h1>
          <p className="mt-1 text-sm text-slate-500">
            仅用于本地验证新增来源层，现有产品管理页数据源未切换。
          </p>
          <div className="mt-3 text-sm text-slate-600">
            当前记录数: <span className="font-semibold">{rows.length}</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">source</th>
                  <th className="px-3 py-2">product_code</th>
                  <th className="px-3 py-2">product_no</th>
                  <th className="px-3 py-2">name_cn</th>
                  <th className="px-3 py-2">name_es</th>
                  <th className="px-3 py-2">category_name</th>
                  <th className="px-3 py-2">subcategory_name</th>
                  <th className="px-3 py-2">supplier</th>
                  <th className="px-3 py-2">source_price</th>
                  <th className="px-3 py-2">source_discount</th>
                  <th className="px-3 py-2">source_disabled</th>
                  <th className="px-3 py-2">source_updated_at</th>
                  <th className="px-3 py-2">synced_at</th>
                  <th className="px-3 py-2">updated_at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.source}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.product_code}</td>
                    <td className="px-3 py-2">{row.product_no || "-"}</td>
                    <td className="px-3 py-2">{row.name_cn || "-"}</td>
                    <td className="px-3 py-2">{row.name_es || "-"}</td>
                    <td className="px-3 py-2">{row.category_name || "-"}</td>
                    <td className="px-3 py-2">{row.subcategory_name || "-"}</td>
                    <td className="px-3 py-2">{row.supplier || "-"}</td>
                    <td className="px-3 py-2">{moneyText(row.source_price)}</td>
                    <td className="px-3 py-2">{discountText(row.source_discount)}</td>
                    <td className="px-3 py-2">{row.source_disabled ? "禁用" : "启用"}</td>
                    <td className="px-3 py-2">{dtText(row.source_updated_at)}</td>
                    <td className="px-3 py-2">{dtText(row.synced_at)}</td>
                    <td className="px-3 py-2">{dtText(row.updated_at)}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={14}>
                      暂无 YOGO 来源数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </AppShell>
  );
}
