import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

type TabKey = "customer" | "supplier";
type ListKey = "pending";
type SearchParams = Record<string, string | string[] | undefined>;

const TAB_LIST: TabKey[] = ["customer", "supplier"];
const PAGE_SIZE = 8;

function normalizeTab(tab: string | null | undefined): TabKey {
  return tab === "supplier" ? "supplier" : "customer";
}

function normalizeListType(listType: string | null | undefined): ListKey {
  return listType === "pending" ? "pending" : "pending";
}

function parseIntOr(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(value);
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(value);
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function baseOrderNo(receiptNo: string) {
  const head = String(receiptNo || "").trim().split("-")[0];
  return head || String(receiptNo || "").trim();
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path d="M1.75 10s2.75-4.75 8.25-4.75S18.25 10 18.25 10 15.5 14.75 10 14.75 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" />
      <path d="M10.75 6.5 13.5 9.25" />
      <path d="M11.5 3.75 16.25 8.5" />
    </svg>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) {
    return (
      <AppShell>
        <section className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600">
          未获取到租户会话，请先登录。
        </section>
      </AppShell>
    );
  }

  const params = (await searchParams) || {};
  const tabRaw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const listRaw = Array.isArray(params.list) ? params.list[0] : params.list;
  const pageRaw = Array.isArray(params.page) ? params.page[0] : params.page;
  const detailRaw = Array.isArray(params.detail) ? params.detail[0] : params.detail;

  const activeTab = normalizeTab(tabRaw || null);
  const activeList = normalizeListType(listRaw || null);
  const page = parseIntOr(pageRaw || "1", 1);
  const detailOrderNo = (detailRaw || "").trim();

  const theme =
    activeTab === "supplier"
      ? {
          panel: "border-amber-300 bg-amber-50/40",
          tabActive: "border-amber-300 bg-amber-100 text-amber-900",
          tabInactive: "border-transparent bg-slate-200 text-slate-600 hover:bg-slate-300",
          heading: "text-amber-900",
          accentValue: "text-amber-700",
        }
      : {
          panel: "border-sky-300 bg-sky-50/40",
          tabActive: "border-sky-300 bg-sky-100 text-sky-900",
          tabInactive: "border-transparent bg-slate-200 text-slate-600 hover:bg-slate-300",
          heading: "text-sky-900",
          accentValue: "text-sky-700",
        };

  const completedReceipts = await prisma.receipt.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      status: "completed",
    },
    select: {
      receipt_no: true,
      updated_at: true,
      items: {
        select: {
          sku: true,
          barcode: true,
          name_zh: true,
          name_es: true,
          expected_qty: true,
          sell_price: true,
          line_total: true,
        },
      },
    },
    orderBy: { updated_at: "desc" },
  });

  const grouped = new Map<
    string,
    {
      orderNo: string;
      totalAmount: number;
      latestAt: Date | null;
    }
  >();

  const detailMap = new Map<
    string,
    Map<
      string,
      {
        sku: string;
        barcode: string;
        nameZh: string;
        nameEs: string;
        qty: number;
        unitPrice: number;
        lineTotal: number;
      }
    >
  >();

  for (const receipt of completedReceipts) {
    const orderNo = baseOrderNo(receipt.receipt_no);
    const row =
      grouped.get(orderNo) ||
      ({
        orderNo,
        totalAmount: 0,
        latestAt: null,
      } as const);

    const orderDetail = detailMap.get(orderNo) || new Map();
    let receiptAmount = 0;

    for (const item of receipt.items) {
      const qty = Number(item.expected_qty || 0);
      const unitPrice = item.sell_price ? Number(item.sell_price) : 0;
      const lineTotalRaw = item.line_total ? Number(item.line_total) : null;
      const lineTotal = lineTotalRaw !== null && Number.isFinite(lineTotalRaw) ? lineTotalRaw : qty * unitPrice;

      receiptAmount += lineTotal;

      const sku = String(item.sku || "").trim();
      const barcode = String(item.barcode || "").trim();
      const key = `${sku}|${barcode}`;
      const old = orderDetail.get(key);
      if (!old) {
        orderDetail.set(key, {
          sku,
          barcode,
          nameZh: String(item.name_zh || "").trim(),
          nameEs: String(item.name_es || "").trim(),
          qty,
          unitPrice,
          lineTotal,
        });
      } else {
        old.qty += qty;
        old.lineTotal += lineTotal;
      }
    }

    detailMap.set(orderNo, orderDetail);

    const latestAt =
      !row.latestAt || row.latestAt.getTime() < receipt.updated_at.getTime()
        ? receipt.updated_at
        : row.latestAt;

    grouped.set(orderNo, {
      orderNo,
      totalAmount: row.totalAmount + receiptAmount,
      latestAt,
    });
  }

  const orderNos = Array.from(grouped.keys());
  const ygOrders =
    orderNos.length > 0
      ? await prisma.ygOrderImport.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            order_no: { in: orderNos },
          },
          select: {
            order_no: true,
            company_name: true,
            contact_name: true,
            contact_phone: true,
          },
        })
      : [];

  const orderMap = new Map(
    ygOrders.map((row) => [
      row.order_no,
      {
        companyName: row.company_name || "-",
        contactName: row.contact_name || "-",
        contactPhone: row.contact_phone || "-",
      },
    ]),
  );

  const pendingRows = Array.from(grouped.values())
    .map((row) => {
      const order = orderMap.get(row.orderNo);
      return {
        orderNo: row.orderNo,
        companyName: order?.companyName || "-",
        contactName: order?.contactName || "-",
        contactPhone: order?.contactPhone || "-",
        amountText: formatMoney(row.totalAmount),
        updatedAtText: formatDateOnly(row.latestAt),
      };
    })
    .sort((a, b) => b.orderNo.localeCompare(a.orderNo));

  const pendingCount = pendingRows.length;
  const totalPages = Math.max(1, Math.ceil(pendingRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pagedRows = pendingRows.slice(start, start + PAGE_SIZE);

  const activeRows = activeList === "pending" ? pagedRows : pagedRows;
  const activeCount = activeList === "pending" ? pendingCount : pendingCount;

  const detailItems = detailOrderNo ? Array.from(detailMap.get(detailOrderNo)?.values() || []) : [];
  const detailTotalAmount = detailItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <AppShell>
      <section className={`mt-4 overflow-hidden rounded-[30px] border-2 ${theme.panel}`}>
        <div className="px-4 pt-3">
          <div className="flex flex-wrap items-end gap-2">
            {TAB_LIST.map((tab) => {
              const selected = activeTab === tab;
              const label = tab === "customer" ? "客户出账单" : "供应商账单";
              return (
                <Link
                  key={tab}
                  href={`/billing?tab=${tab}&list=pending&page=1`}
                  className={[
                    "inline-flex min-w-[148px] items-center justify-center rounded-t-2xl border px-4 py-2 text-sm font-semibold transition",
                    selected ? theme.tabActive : theme.tabInactive,
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href={`/billing?tab=${activeTab}&list=pending&page=1`} className="block">
              <div className="transition hover:opacity-95">
                <StatCard
                  label="待出账单"
                  value={pendingCount}
                  hint="验货完毕待汇总"
                  valueClassName={theme.accentValue}
                />
              </div>
            </Link>
            <StatCard label="待生成" value="0" hint="等待生成汇总结果" valueClassName="text-amber-600" />
            <StatCard label="待复核" value="0" hint="等待人工确认或复核" valueClassName="text-blue-600" />
            <StatCard label="可输出" value="0" hint="可下载或分享的账单" valueClassName="text-emerald-600" />
          </section>

          <div className="mt-4">
            <TableCard
              title={activeList === "pending" ? "待出账单列表" : "账单列表"}
              description={`共 ${activeCount} 条`}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 text-left text-sm text-slate-500">
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">账单名称</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">公司名称</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">联系人</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">联系电话</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-right">配货金额</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">汇总时间</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                          当前没有待出账单记录
                        </td>
                      </tr>
                    ) : (
                      activeRows.map((row) => (
                        <tr key={row.orderNo} className="border-t border-slate-100 hover:bg-secondary-accent/20">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">{row.orderNo}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.companyName}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.contactName}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.contactPhone}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-800">{row.amountText}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.updatedAtText}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                href={`/billing?tab=${activeTab}&list=${activeList}&page=${currentPage}&detail=${encodeURIComponent(row.orderNo)}`}
                                className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-800"
                                title="查看明细"
                                aria-label="查看明细"
                              >
                                <EyeIcon />
                              </Link>
                              <Link
                                href={`/yg-orders`}
                                className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-800"
                                title="编辑"
                                aria-label="编辑"
                              >
                                <PencilIcon />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {activeCount > 0 ? (
                <div className="border-t border-slate-200 px-5 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href={`/billing?tab=${activeTab}&list=${activeList}&page=1`}
                      className={`inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border px-3 text-sm ${
                        currentPage === 1
                          ? "cursor-not-allowed border-slate-200 text-slate-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      首页
                    </Link>
                    <Link
                      href={`/billing?tab=${activeTab}&list=${activeList}&page=${Math.max(1, currentPage - 1)}`}
                      className={`inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border px-3 text-sm ${
                        currentPage === 1
                          ? "cursor-not-allowed border-slate-200 text-slate-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      上一页
                    </Link>
                    <span className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                      {currentPage} / {totalPages}
                    </span>
                    <Link
                      href={`/billing?tab=${activeTab}&list=${activeList}&page=${Math.min(totalPages, currentPage + 1)}`}
                      className={`inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border px-3 text-sm ${
                        currentPage >= totalPages
                          ? "cursor-not-allowed border-slate-200 text-slate-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      下一页
                    </Link>
                    <Link
                      href={`/billing?tab=${activeTab}&list=${activeList}&page=${totalPages}`}
                      className={`inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border px-3 text-sm ${
                        currentPage >= totalPages
                          ? "cursor-not-allowed border-slate-200 text-slate-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      末页
                    </Link>
                  </div>
                </div>
              ) : null}
            </TableCard>
          </div>

          {detailOrderNo ? (
            <div className="mt-4">
              <TableCard title={`账单明细：${detailOrderNo}`} description={`商品数 ${detailItems.length} · 合计 ${formatMoney(detailTotalAmount)}`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-500">
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">编码</th>
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">条形码</th>
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">中文名</th>
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">西文名</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">数量</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">单价</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                            当前账单没有可显示的商品明细
                          </td>
                        </tr>
                      ) : (
                        detailItems.map((item, idx) => (
                          <tr key={`${item.sku}-${item.barcode}-${idx}`} className="border-t border-slate-100">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.sku || "-"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.barcode || "-"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.nameZh || "-"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.nameEs || "-"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">{item.qty}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">{formatMoney(item.unitPrice)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatMoney(item.lineTotal)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-200 px-5 py-3 text-right text-sm">
                  <Link
                    href={`/billing?tab=${activeTab}&list=${activeList}&page=${currentPage}`}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    收起明细
                  </Link>
                </div>
              </TableCard>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
