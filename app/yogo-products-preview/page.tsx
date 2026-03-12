import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import { ProductThumb } from "./ProductThumb";

const PAGE_SIZE = 50;

type SearchParams = {
  page?: string | string[];
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function parsePage(input: string | string[] | undefined) {
  const raw = Array.isArray(input) ? input[0] : input;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

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

export default async function YogoProductsPreviewPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await hasPermission(session, "manageProducts"))) redirect("/dashboard");

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedPage = parsePage(resolvedSearchParams.page);

  const where = {
    tenant_id: session.tenantId,
    company_id: session.companyId,
  };

  const totalCount = await prisma.yogoProductSource.count({ where });
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const rows = await prisma.yogoProductSource.findMany({
    where,
    orderBy: [{ updated_at: "desc" }, { product_code: "asc" }],
    skip,
    take: PAGE_SIZE,
  });

  const hasPrev = currentPage > 1;
  const hasNext = totalPages > 0 && currentPage < totalPages;

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">YOGO 商品来源预览</h1>
          <p className="mt-1 text-sm text-slate-500">
            仅用于本地/联调验证新增来源层，现有产品管理页数据源未切换。
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-600">
            <div>
              当前页: <span className="font-semibold">{currentPage}</span>
            </div>
            <div>
              总记录数: <span className="font-semibold">{totalCount}</span>
            </div>
            <div>
              总页数: <span className="font-semibold">{totalPages}</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">图片</th>
                  <th className="px-3 py-2">来源</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">条形码</th>
                  <th className="px-3 py-2">中文名</th>
                  <th className="px-3 py-2">西文名</th>
                  <th className="px-3 py-2">分类</th>
                  <th className="px-3 py-2">子分类</th>
                  <th className="px-3 py-2">供应商</th>
                  <th className="px-3 py-2">售价</th>
                  <th className="px-3 py-2">折扣</th>
                  <th className="px-3 py-2">状态</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <ProductThumb sku={row.product_code} size={56} />
                    </td>
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
                    <td className="px-3 py-2">{row.source_disabled ? "下架" : "启用"}</td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={12}>
                      暂无 YOGO 来源数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            {hasPrev ? (
              <Link
                href={`/yogo-products-preview?page=${currentPage - 1}`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                上一页
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-300">上一页</span>
            )}

            {hasNext ? (
              <Link
                href={`/yogo-products-preview?page=${currentPage + 1}`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                下一页
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-300">下一页</span>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
