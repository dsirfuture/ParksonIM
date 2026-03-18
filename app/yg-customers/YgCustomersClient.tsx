"use client";

import { useMemo, useState } from "react";
import { TableCard } from "@/components/table-card";

type YgCustomerRow = {
  key: string;
  displayName: string;
  companyName: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  addressText: string;
  orderCount: number;
  totalAmountText: string;
  latestOrderNo: string;
  latestUpdatedAtText: string;
};

type YgCustomersSummary = {
  totalCustomers: number;
  totalOrders: number;
  customersWithPhone: number;
  latestUpdatedAtText: string;
};

type YgCustomersClientProps = {
  initialRows: YgCustomerRow[];
  summary: YgCustomersSummary;
};

const PAGE_SIZE = 12;

export function YgCustomersClient({
  initialRows,
  summary,
}: YgCustomersClientProps) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return initialRows;

    return initialRows.filter((row) =>
      [
        row.displayName,
        row.companyName,
        row.customerName,
        row.contactName,
        row.contactPhone,
        row.addressText,
        row.latestOrderNo,
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

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">顾客数量</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.totalCustomers}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">订单总数</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.totalOrders}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">有电话顾客</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.customersWithPhone}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">最近同步</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {summary.latestUpdatedAtText}
          </div>
        </div>
      </section>

      <TableCard
        title="友购顾客列表"
        description="由友购订单同步自动汇总顾客资料。"
        right={
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
              共 {filteredRows.length} 位
            </div>
            <div className="flex h-11 min-w-[320px] items-center rounded-xl border border-slate-200 bg-white px-4">
              <svg
                className="mr-3 h-4 w-4 shrink-0 text-slate-400"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M14.5 14.5L18 18" />
                <circle cx="8.5" cy="8.5" r="5.75" />
              </svg>
              <input
                value={keyword}
                onChange={(e) => changeKeyword(e.target.value)}
                placeholder="搜索顾客、联系人、电话、地址、订单号"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        }
      >
        {pagedRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            当前没有匹配到顾客数据
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="px-4 py-3 font-semibold">顾客</th>
                    <th className="px-4 py-3 font-semibold">公司名</th>
                    <th className="px-4 py-3 font-semibold">联系人</th>
                    <th className="px-4 py-3 font-semibold">电话</th>
                    <th className="px-4 py-3 font-semibold">地址</th>
                    <th className="px-4 py-3 font-semibold">订单数</th>
                    <th className="px-4 py-3 font-semibold">累计金额</th>
                    <th className="px-4 py-3 font-semibold">最近订单</th>
                    <th className="px-4 py-3 font-semibold">最近同步</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-t border-slate-100 transition hover:bg-rose-50/60"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {row.displayName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.companyName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.contactName || row.customerName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.contactPhone || "-"}
                      </td>
                      <td className="max-w-[320px] px-4 py-3 text-sm text-slate-700">
                        <div className="truncate" title={row.addressText || "-"}>
                          {row.addressText || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.orderCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        $ {row.totalAmountText}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.latestOrderNo || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.latestUpdatedAtText || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredRows.length > PAGE_SIZE ? (
              <div className="border-t border-slate-200 px-5 py-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                    (pageNumber) => {
                      const active = pageNumber === currentPage;

                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => goToPage(pageNumber)}
                          className={`inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border px-3 text-sm transition ${
                            active
                              ? "border-slate-300 bg-slate-100 text-slate-900"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    },
                  )}

                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </TableCard>
    </div>
  );
}
