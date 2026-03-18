"use client";

import { Fragment, useMemo, useState } from "react";
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
};

type YgCustomersClientProps = {
  initialRows: YgCustomerRow[];
  summary: YgCustomersSummary;
};

const PAGE_SIZE = 12;

function PlusBadge({ open }: { open: boolean }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
      {open ? "-" : "+"}
    </span>
  );
}

export function YgCustomersClient({ initialRows, summary }: YgCustomersClientProps) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const filteredRows = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return initialRows;

    return initialRows.filter((row) =>
      [
        row.registeredPhone,
        row.companyName,
        row.noteText,
        row.relationNo,
        row.relationName,
        row.groupName,
        row.provinceName,
        row.regionName,
        row.statusText,
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

  function toggleExpanded(customerKey: string) {
    setExpandedKeys((prev) =>
      prev.includes(customerKey) ? prev.filter((key) => key !== customerKey) : [...prev, customerKey],
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">顾客数量</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalCustomers}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <div className="text-sm text-slate-500">有订单顾客</div>
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
          <div className="text-sm text-slate-500">最近同步</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{summary.latestSyncedAtText}</div>
        </div>
      </section>

      <TableCard
        title="友购顾客列表"
        description="以友购顾客资料为主；若顾客有关联订单，可展开查看订单详情。"
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
                placeholder="搜索电话、公司名、备注、分组、地区、订单号"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        }
      >
        {pagedRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">当前没有匹配到友购顾客数据</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="px-4 py-3 font-semibold">详情</th>
                    <th className="px-4 py-3 font-semibold">注册手机</th>
                    <th className="px-4 py-3 font-semibold">公司名称</th>
                    <th className="px-4 py-3 font-semibold">备注</th>
                    <th className="px-4 py-3 font-semibold">关联编号</th>
                    <th className="px-4 py-3 font-semibold">关联名称</th>
                    <th className="px-4 py-3 font-semibold">分组</th>
                    <th className="px-4 py-3 font-semibold">省份</th>
                    <th className="px-4 py-3 font-semibold">地区</th>
                    <th className="px-4 py-3 font-semibold">最后访问</th>
                    <th className="px-4 py-3 font-semibold">最后订单</th>
                    <th className="px-4 py-3 font-semibold">累计订单金额</th>
                    <th className="px-4 py-3 font-semibold">累计订单次数</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => {
                    const expanded = expandedKeys.includes(row.customerKey);
                    const hasOrders = row.detailRows.length > 0;
                    return (
                      <Fragment key={row.customerKey}>
                        <tr className="border-t border-slate-100 transition hover:bg-rose-50/60">
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {hasOrders ? (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(row.customerKey)}
                                className="inline-flex items-center"
                                title={expanded ? "收起订单详情" : "展开订单详情"}
                              >
                                <PlusBadge open={expanded} />
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.registeredPhone || "-"}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.companyName || "-"}</td>
                          <td className="max-w-[220px] px-4 py-3 text-sm text-slate-700">
                            <div className="truncate" title={row.noteText || "-"}>
                              {row.noteText || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.relationNo || row.customerId || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.relationName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.groupName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.provinceName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.regionName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.lastVisitedAtText || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.lastOrderAtText || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">$ {row.totalOrderAmountText}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.totalOrderCount}</td>
                        </tr>
                        {expanded ? (
                          <tr className="border-t border-slate-100 bg-slate-50/70">
                            <td className="px-4 py-3" />
                            <td colSpan={12} className="px-4 py-3">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                  <span>顾客：{row.companyName || "-"}</span>
                                  <span>累计订单金额：$ {row.totalOrderAmountText}</span>
                                  <span>累计订单次数：{row.totalOrderCount}</span>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                                      {row.detailRows.map((detail, index) => (
                                        <tr key={`${row.customerKey}-${detail.orderNo}-${index}`} className="border-t border-slate-100">
                                          <td className="px-4 py-2.5 text-sm text-slate-700">{detail.orderDateText}</td>
                                          <td className="px-4 py-2.5 text-sm text-slate-700">{detail.orderNo}</td>
                                          <td className="px-4 py-2.5 text-sm text-slate-700">$ {detail.orderAmountText}</td>
                                          <td className="px-4 py-2.5 text-sm text-slate-700">{detail.latestStatus}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
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
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => {
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
                  })}
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
