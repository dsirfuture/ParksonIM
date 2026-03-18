"use client";

import { useEffect, useMemo, useState } from "react";
import { TableCard } from "@/components/table-card";

type OrderDetailRow = {
  orderNo: string;
  orderDateText: string;
  orderAmountText: string;
  latestStatus: string;
};

type YgCustomerRow = {
  customerKey: string;
  customerId: string;
  registeredPhone: string;
  companyName: string;
  noteText: string;
  relationNo: string;
  relationName: string;
  groupName: string;
  provinceName: string;
  regionName: string;
  statusText: string;
  salesRepName: string;
  registeredAtText: string;
  lastVisitedAtText: string;
  lastOrderAtText: string;
  lastOrderNo: string;
  syncedAtText: string;
  detailRows: OrderDetailRow[];
  totalOrderAmountText: string;
  totalOrderCount: number;
};

type YgCustomersSummary = {
  totalCustomers: number;
  customersWithOrders: number;
  totalOrders: number;
  totalOrderAmountText: string;
  latestSyncedAtText: string;
  monthlyRegisteredCount: number;
  monthlyRegisteredLabel: string;
};

type YgCustomersClientProps = {
  initialRows: YgCustomerRow[];
  summary: YgCustomersSummary;
};

const PAGE_SIZE = 10;

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path d="M1.75 10s2.75-4.75 8.25-4.75S18.25 10 18.25 10 15.5 14.75 10 14.75 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

export function YgCustomersClient({ initialRows, summary }: YgCustomersClientProps) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [detailCustomerKey, setDetailCustomerKey] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return initialRows;

    return initialRows.filter((row) =>
      [
        row.registeredPhone,
        row.companyName,
        row.relationName,
        row.regionName,
        row.statusText,
        row.customerId,
        row.lastOrderNo,
        ...row.detailRows.flatMap((detail) => [detail.orderNo, detail.orderDateText]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [initialRows, keyword]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  function changeKeyword(value: string) {
    setKeyword(value);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  }

  const detailRow = useMemo(
    () => initialRows.find((row) => row.customerKey === detailCustomerKey) ?? null,
    [detailCustomerKey, initialRows],
  );

  useEffect(() => {
    if (!detailCustomerKey) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailCustomerKey]);

  const visiblePageNumbers = useMemo(() => {
    const numbers: Array<number | string> = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
      numbers.push(1);
      if (start > 2) numbers.push("left-ellipsis");
    }
    for (let index = start; index <= end; index += 1) {
      numbers.push(index);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) numbers.push("right-ellipsis");
      numbers.push(totalPages);
    }

    return numbers;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">注册客户</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalCustomers}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">下单客户</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{summary.customersWithOrders}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">订单总数</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalOrders}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">累计订单金额</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">$ {summary.totalOrderAmountText}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">{summary.monthlyRegisteredLabel}</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{summary.monthlyRegisteredCount}</div>
        </div>
      </section>

      <TableCard
        title="友购客户列表"
        description={`最近一次友购客户更新时间是：${summary.latestSyncedAtText}`}
        right={
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">共 {filteredRows.length} 位</div>
            <div className="flex h-11 min-w-[320px] items-center rounded-xl border border-slate-200 bg-white px-4">
              <svg className="mr-3 h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14.5 14.5L18 18" />
                <circle cx="8.5" cy="8.5" r="5.75" />
              </svg>
              <input
                value={keyword}
                onChange={(e) => changeKeyword(e.target.value)}
                placeholder="搜索电话、公司名、关联名称、地区、订单号"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        }
      >
        {pagedRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">当前没有匹配到友购客户数据</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">注册手机</th>
                    <th className="px-3 py-2.5 font-semibold">公司名称</th>
                    <th className="px-3 py-2.5 font-semibold">关联名称</th>
                    <th className="px-3 py-2.5 font-semibold">地区</th>
                    <th className="px-3 py-2.5 font-semibold">最后访问</th>
                    <th className="px-3 py-2.5 font-semibold">最近订单</th>
                    <th className="px-3 py-2.5 font-semibold">累计订单金额</th>
                    <th className="px-3 py-2.5 font-semibold">累计订单次数</th>
                    <th className="px-3 py-2.5 text-center font-semibold">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => {
                    return (
                      <tr key={row.customerKey} className="border-t border-slate-100 transition hover:bg-rose-50/50">
                        <td className="px-3 py-2 text-sm text-slate-700">{row.registeredPhone || "-"}</td>
                        <td className="max-w-[280px] px-3 py-2 text-sm font-medium leading-5 text-slate-900">
                          <div className="line-clamp-2" title={row.companyName || "-"}>
                            {row.companyName || "-"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.relationName || "-"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.regionName || "-"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.lastVisitedAtText || "-"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.lastOrderAtText || "-"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">$ {row.totalOrderAmountText}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.totalOrderCount}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setDetailCustomerKey(row.customerKey)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-slate-900"
                            title="查看客户详情"
                          >
                            <EyeIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRows.length > PAGE_SIZE ? (
              <div className="border-t border-slate-200 px-5 py-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    回首页
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>
                  {visiblePageNumbers.map((item, index) =>
                    typeof item === "number" ? (
                      <button
                        key={item}
                        type="button"
                        onClick={() => goToPage(item)}
                        className={`inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border px-3 text-sm transition ${
                          item === currentPage
                            ? "border-slate-300 bg-slate-100 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {item}
                      </button>
                    ) : (
                      <span
                        key={`${item}-${index}`}
                        className="inline-flex h-9 min-w-[40px] items-center justify-center px-2 text-sm text-slate-400"
                      >
                        ...
                      </span>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    去尾页
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </TableCard>

      {detailRow ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">客户详情</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {detailRow.companyName || "-"} / {detailRow.registeredPhone || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailCustomerKey(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                title="关闭"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">注册手机</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{detailRow.registeredPhone || "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">关联名称</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{detailRow.relationName || "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">累计订单金额</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">$ {detailRow.totalOrderAmountText}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">累计订单次数</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{detailRow.totalOrderCount}</div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">注册客户</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{detailRow.companyName || "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">注册日期</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{detailRow.registeredAtText || "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">地区</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{detailRow.regionName || "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">最近一次友购客户更新时间</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{detailRow.syncedAtText || "-"}</div>
                </div>
              </section>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-4 py-2.5 font-semibold">订单日期</th>
                      <th className="px-4 py-2.5 font-semibold">订单号</th>
                      <th className="px-4 py-2.5 font-semibold">订单金额</th>
                      <th className="px-4 py-2.5 font-semibold">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRow.detailRows.length > 0 ? (
                      detailRow.detailRows.map((detail, index) => (
                        <tr key={`${detailRow.customerKey}-${detail.orderNo}-${index}`} className="border-t border-slate-100">
                          <td className="px-4 py-2.5 text-sm text-slate-700">{detail.orderDateText}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-700">{detail.orderNo}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-700">$ {detail.orderAmountText}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-700">{detail.latestStatus}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                          当前客户还没有匹配到友购订单
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
