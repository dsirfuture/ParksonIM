"use client";

import { useEffect, useMemo, useState } from "react";
import { TableCard } from "@/components/table-card";
import { buildProductImageUrls } from "@/lib/product-image-url";

type SupplierOrderItem = {
  id: string;
  location: string;
  itemNo: string;
  barcode: string;
  productName: string;
  nameCn: string;
  nameEs: string;
  normalDiscount: string;
  vipDiscount: string;
  totalQty: number;
  unitPriceText: string;
  lineTotalText: string;
};

type SupplierOrderRow = {
  id: string;
  supplierCode: string;
  derivedOrderNo: string;
  orderAmountText: string;
  itemCount: number;
  noteText: string;
  items: SupplierOrderItem[];
};

type ImportRow = {
  id: string;
  orderNo: string;
  orderStatus: string;
  orderDateText: string;
  orderAmountText: string;
  companyName: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  addressText: string;
  remarkText: string;
  storeLabelText: string;
  createdAtText: string;
  supplierCount: number;
  itemCount: number;
  supplierOrders: SupplierOrderRow[];
};

type EditState = {
  id: string;
  customerName: string;
  addressText: string;
  contactText: string;
  remarkText: string;
  storeLabelText: string;
};

type DetailState = {
  importId: string;
  orderNo: string;
  orderAmountText: string;
  itemCount: number;
  remarkText: string;
  items: SupplierOrderItem[];
  supplierOrders: SupplierOrderRow[];
};

type YgOrdersSummary = {
  totalOrders: number;
  totalAmountText: string;
  customerCount: number;
  latestUpdatedAtText: string;
  periodStats: Array<{ year: number; month: number; orders: number; amountText: string }>;
  yearOptions: number[];
  monthsByYear: Record<number, number[]>;
  defaultYear: number | null;
  defaultMonth: number | null;
};

type YgOrdersClientProps = {
  initialRows: ImportRow[];
  summary: YgOrdersSummary;
};

const ORDER_PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 10;

function normalizeMexicoPhone(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return `+52${digits.slice(-10)}`;
}

function extractPhone(contactPhone: string, remarkText: string) {
  if (contactPhone) return contactPhone;
  const matched = (remarkText || "").match(/\+?\d{8,15}/g);
  if (!matched || matched.length === 0) return "-";
  return normalizeMexicoPhone(matched[0]) || "-";
}

function cleanRemarkText(value: string) {
  return (value || "")
    .replace(/[\[\]【】]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function mapSearchUrl(address: string) {
  const text = (address || "").trim();
  if (!text) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

function PreviewProductImage({
  itemNo,
  barcode,
  onPreview,
}: {
  itemNo: string;
  barcode: string;
  onPreview?: (src: string) => void;
}) {
  const cacheRef = globalThis as unknown as { __ygImgCache?: Map<string, string | null> };
  if (!cacheRef.__ygImgCache) cacheRef.__ygImgCache = new Map();
  const cache = cacheRef.__ygImgCache;

  const sources = useMemo(() => {
    const keys = [itemNo, barcode].map((x) => x.trim()).filter(Boolean);
    const exts = ["jpg", "jpeg", "png", "webp"];
    return keys.flatMap((key) => buildProductImageUrls(key, exts));
  }, [itemNo, barcode]);

  const cacheKey = useMemo(() => sources.join("|"), [sources]);
  const [src, setSrc] = useState<string | null | undefined>(sources.length === 0 ? null : undefined);

  useEffect(() => {
    if (sources.length === 0) {
      setSrc(null);
      return;
    }

    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      setSrc(cached);
      return;
    }

    let canceled = false;
    (async () => {
      for (const url of sources) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });

        if (ok) {
          if (!canceled) {
            cache.set(cacheKey, url);
            setSrc(url);
          }
          return;
        }
      }

      if (!canceled) {
        cache.set(cacheKey, null);
        setSrc(null);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [cache, cacheKey, sources]);

  if (!src) return <span className="text-slate-400">-</span>;

  return (
    <img
      src={src}
      alt={itemNo || barcode || "product"}
      className="h-10 w-10 cursor-zoom-in rounded border border-slate-200 object-contain"
      onClick={() => {
        if (src && onPreview) onPreview(src);
      }}
      onError={() => {
        cache.set(cacheKey, null);
        setSrc(null);
      }}
    />
  );
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

function FileIcon({ label }: { label: string }) {
  return (
    <div className="relative flex h-14 w-12 items-center justify-center">
      <svg viewBox="0 0 48 56" className="h-14 w-12 text-slate-300" fill="none">
        <path d="M12 4h16l12 12v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M28 4v10a2 2 0 0 0 2 2h10" stroke="currentColor" strokeWidth="2" />
      </svg>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{label}</div>
    </div>
  );
}

export function YgOrdersClient({ initialRows, summary }: YgOrdersClientProps) {
  const [rows, setRows] = useState<ImportRow[]>(initialRows);
  const [keyword, setKeyword] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [detailState, setDetailState] = useState<DetailState | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [splitState, setSplitState] = useState<{ importId: string; orderNo: string; supplierOrders: SupplierOrderRow[] } | null>(null);
  const [exportState, setExportState] = useState<{ importId: string; supplierOrderId: string } | null>(null);
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | "">(summary.defaultYear ?? "");
  const [selectedMonth, setSelectedMonth] = useState<number | "">(summary.defaultMonth ?? "");
  const monthOptions = useMemo(
    () => (selectedYear === "" ? [] : summary.monthsByYear[selectedYear] || []),
    [selectedYear, summary.monthsByYear],
  );
  useEffect(() => {
    if (selectedYear === "") return;
    if (!monthOptions.includes(Number(selectedMonth))) {
      setSelectedMonth(monthOptions[0] ?? "");
    }
  }, [selectedMonth, selectedYear, monthOptions]);

  const activePeriodStat = useMemo(
    () =>
      selectedYear === "" || selectedMonth === ""
        ? null
        : summary.periodStats.find((x) => x.year === selectedYear && x.month === selectedMonth) || null,
    [selectedMonth, selectedYear, summary.periodStats],
  );
  const activeYearStat = useMemo(() => {
    if (selectedYear === "") return null;
    const rows = summary.periodStats.filter((x) => x.year === selectedYear);
    if (rows.length === 0) return null;
    const orders = rows.reduce((sum, row) => sum + row.orders, 0);
    const amount = rows.reduce((sum, row) => sum + Number(row.amountText || 0), 0);
    return {
      orders,
      amountText: Number.isFinite(amount) ? amount.toFixed(2) : "-",
    };
  }, [selectedYear, summary.periodStats]);
  const periodLabel =
    selectedYear === "" || selectedMonth === ""
      ? "-"
      : `${selectedYear}/${String(selectedMonth).padStart(2, "0")}`;

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.orderNo,
        row.orderStatus,
        row.orderDateText,
        row.companyName,
        row.customerName,
        row.contactName,
        row.contactPhone,
        row.orderAmountText,
        row.remarkText,
        row.storeLabelText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredRows.length / ORDER_PAGE_SIZE));
  const pagedRows = useMemo(
    () => filteredRows.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE),
    [filteredRows, orderPage],
  );

  useEffect(() => {
    setOrderPage(1);
  }, [keyword]);

  useEffect(() => {
    if (orderPage > orderTotalPages) setOrderPage(orderTotalPages);
  }, [orderPage, orderTotalPages]);

  async function saveEdit() {
    if (!editState) return;

    try {
      setEditSaving(true);
      setEditError("");

      const response = await fetch(`/api/yg-orders/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: editState.customerName.trim(),
          addressText: editState.addressText.trim(),
          contactPhone: editState.contactText.trim(),
          remarkText: editState.remarkText.trim(),
          storeLabel: editState.storeLabelText.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || "保存失败");

      setRows((prev) =>
        prev.map((row) =>
          row.id === editState.id
            ? {
                ...row,
                customerName: result.data.customerName ?? row.customerName,
                companyName: result.data.customerName ?? row.companyName,
                contactName: result.data.customerName ?? row.contactName,
                contactPhone: result.data.contactText ?? row.contactPhone,
                addressText: result.data.addressText ?? row.addressText,
                remarkText: result.data.remarkText ?? row.remarkText,
                storeLabelText: result.data.storeLabelText ?? row.storeLabelText,
              }
            : row,
        ),
      );

      setEditState(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setEditSaving(false);
    }
  }

  const detailItems = detailState?.items || [];
  const detailTotalPages = Math.max(1, Math.ceil(detailItems.length / DETAIL_PAGE_SIZE));
  const pagedDetailItems = useMemo(
    () => detailItems.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE),
    [detailItems, detailPage],
  );

  useEffect(() => {
    if (detailPage > detailTotalPages) setDetailPage(detailTotalPages);
  }, [detailPage, detailTotalPages]);

  return (
    <>
      <div className="grid gap-5">
        <TableCard title="" description="" className="!mt-0">
          <div className="space-y-3 px-5 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">总订单数</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.totalOrders.toLocaleString("zh-CN")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">总订单金额</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.totalAmountText}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">订单额（{periodLabel}）</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{activePeriodStat?.amountText || "-"}</div>
                <div className="mt-1 text-xs text-slate-500">全年（{selectedYear || "-"}）：{activeYearStat?.amountText || "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">订单数（{periodLabel}）</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{(activePeriodStat?.orders ?? 0).toLocaleString("zh-CN")}</div>
                <div className="mt-1 text-xs text-slate-500">全年（{selectedYear || "-"}）：{(activeYearStat?.orders ?? 0).toLocaleString("zh-CN")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">客户数量</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.customerCount.toLocaleString("zh-CN")}</div>
              </div>
              </div>
              <div className="flex items-center gap-2 lg:pt-1">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : "")}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                >
                  {summary.yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : "")}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                >
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {String(month).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </TableCard>

        <TableCard title="" description="" className="!mt-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4 whitespace-nowrap">
                <h2 className="text-[18px] font-semibold tracking-tight text-slate-900">友购订单列表</h2>
                <div className="text-xs text-slate-500">最近一次友购订单更新时间是：{summary.latestUpdatedAtText || "-"}</div>
              </div>
              <div className="w-full lg:ml-auto lg:w-[420px]">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索订单号、状态、客户、电话、备注"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary/40"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="overflow-x-hidden">
              <table className="w-full table-auto border-separate border-spacing-0">
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[72px]" />
                  <col className="w-[9%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[1%]" />
                  <col className="w-[1%]" />
                  <col className="w-[18%]" />
                  <col className="w-[4%]" />
                  <col className="w-[4%]" />
                  <col className="w-[3%]" />
                  <col className="w-[3%]" />
                </colgroup>
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
                    <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-slate-700">商品数量</th>
                    <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-slate-700">供应商</th>
                    <th className="whitespace-nowrap px-2 py-2.5 font-semibold text-slate-700">第几门店</th>
                    <th className="whitespace-nowrap px-1 py-2.5 text-right font-semibold text-slate-700"></th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-10 text-center text-slate-500">
                        暂无订单数据
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => {
                      const allItems = row.supplierOrders.flatMap((s) => s.items);
                      return (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{row.orderNo}</td>
                          <td className={`whitespace-nowrap px-3 py-2 ${row.orderStatus === "新订单" ? "font-semibold text-rose-600" : "text-slate-700"}`}>
                            {row.orderStatus || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.orderDateText || row.createdAtText}</td>
                          <td className="px-3 py-2 text-slate-700">
                            <div className="truncate whitespace-nowrap">{row.companyName || "-"}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            <div className="truncate whitespace-nowrap">{row.contactName || row.customerName || "-"}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700">{extractPhone(row.contactPhone, row.remarkText)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">{row.orderAmountText}</td>
                          <td className="max-w-[420px] truncate whitespace-nowrap px-3 py-2 text-slate-700">
                            {cleanRemarkText(row.remarkText || "") || "-"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">{row.itemCount}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">{row.supplierCount}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-slate-700">{row.storeLabelText || "-"}</td>
                          <td className="px-1 py-2">
                            <div className="flex items-center justify-end gap-2 pr-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailState({
                                    importId: row.id,
                                    orderNo: row.orderNo,
                                    orderAmountText: row.orderAmountText,
                                    itemCount: row.itemCount,
                                    remarkText: row.remarkText || "",
                                    items: allItems,
                                    supplierOrders: row.supplierOrders,
                                  });
                                  setDetailPage(1);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:text-slate-900"
                              >
                                <EyeIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditState({
                                    id: row.id,
                                    customerName: row.customerName || "",
                                    addressText: row.addressText || "",
                                    contactText: row.contactPhone || "",
                                    remarkText: cleanRemarkText(row.remarkText || ""),
                                    storeLabelText: row.storeLabelText || "",
                                  })
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:text-slate-900"
                              >
                                <PencilIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setOrderPage(1)}
                disabled={orderPage <= 1}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                回到首页
              </button>
              <button
                type="button"
                onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                disabled={orderPage <= 1}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <div className="inline-flex h-9 min-w-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                {orderPage} / {orderTotalPages}
              </div>
              <button
                type="button"
                onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))}
                disabled={orderPage >= orderTotalPages}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
              <button
                type="button"
                onClick={() => setOrderPage(orderTotalPages)}
                disabled={orderPage >= orderTotalPages}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                最后一页
              </button>
            </div>
          </div>
        </TableCard>
      </div>

      {detailState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[1240px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">订单详情预览</h3>
              <div className="mt-2 flex flex-wrap items-center gap-6 text-sm text-slate-600">
                <span>当前订单：{detailState.orderNo}</span>
                <span>订单金额：{detailState.orderAmountText}</span>
                <span>商品数量：{detailState.itemCount}</span>
                <span className="max-w-[420px] truncate">订单备注：{detailState.remarkText || "-"}</span>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">产品图片</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">商品编号</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">条形码</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">供应商</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">中文名</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">西文名</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">数量</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">单价</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">普通折扣</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">VIP折扣</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">小计</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {pagedDetailItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <PreviewProductImage
                            itemNo={item.itemNo}
                            barcode={item.barcode}
                            onPreview={(src) => setImagePreviewSrc(src)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">{item.itemNo || "-"}</td>
                        <td className="px-3 py-2 text-slate-700">{item.barcode || item.itemNo || "-"}</td>
                        <td className="px-3 py-2 text-slate-700">{item.location || "-"}</td>
                        <td className="px-3 py-2 text-slate-700">{item.nameCn || (/[\u4e00-\u9fa5]/.test(item.productName || "") ? item.productName : "-")}</td>
                        <td className="px-3 py-2 text-slate-700">{item.nameEs || (!/[\u4e00-\u9fa5]/.test(item.productName || "") ? item.productName || "-" : "-")}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.totalQty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.unitPriceText}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.normalDiscount || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.vipDiscount || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.lineTotalText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  disabled={detailPage <= 1}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <div className="inline-flex h-9 min-w-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                  {detailPage} / {detailTotalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailPage((p) => Math.min(detailTotalPages, p + 1))}
                  disabled={detailPage >= detailTotalPages}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  const legacySingleYogo =
                    detailState.supplierOrders.length === 1 &&
                    detailState.supplierOrders[0]?.supplierCode?.toUpperCase() === "YOGO";

                  if (!legacySingleYogo) {
                    setSplitState({
                      importId: detailState.importId,
                      orderNo: detailState.orderNo,
                      supplierOrders: detailState.supplierOrders,
                    });
                    return;
                  }

                  const grouped = new Map<string, SupplierOrderItem[]>();
                  for (const item of detailState.items) {
                    const supplier = (item.location || "").trim().toUpperCase() || "UNKNOWN";
                    const list = grouped.get(supplier) || [];
                    list.push(item);
                    grouped.set(supplier, list);
                  }

                  const virtualRows: SupplierOrderRow[] = Array.from(grouped.entries()).map(
                    ([supplier, items], idx) => {
                      const amount = items.reduce((sum, item) => {
                        const num = Number(item.lineTotalText);
                        return sum + (Number.isFinite(num) ? num : 0);
                      }, 0);
                      return {
                        id: `${detailState.supplierOrders[0].id}::${supplier}::${idx}`,
                        supplierCode: supplier,
                        derivedOrderNo: `${detailState.orderNo}-${supplier}`,
                        orderAmountText: amount > 0 ? amount.toFixed(2) : "-",
                        itemCount: items.length,
                        noteText: detailState.supplierOrders[0].noteText,
                        items,
                      };
                    },
                  );

                  setSplitState({
                    importId: detailState.importId,
                    orderNo: detailState.orderNo,
                    supplierOrders: virtualRows.length > 0 ? virtualRows : detailState.supplierOrders,
                  });
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                拆分订单
              </button>
              <button
                type="button"
                onClick={() => setDetailState(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {splitState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[900px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">拆分结果</h3>
              <p className="mt-1 text-sm text-slate-500">订单：{splitState.orderNo}</p>
            </div>
            <div className="px-5 py-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">拆分订单号</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">供应商</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">订单金额</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-700">商品数量</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-slate-700">预览</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-slate-700">导出</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {splitState.supplierOrders.map((so) => (
                      <tr key={so.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{so.derivedOrderNo}</td>
                        <td className="px-3 py-2 text-slate-700">{so.supplierCode}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{so.orderAmountText}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{so.itemCount}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailState({
                                importId: splitState.importId,
                                orderNo: so.derivedOrderNo,
                                orderAmountText: so.orderAmountText,
                                itemCount: so.itemCount,
                                remarkText: so.noteText || "",
                                items: so.items,
                                supplierOrders: splitState.supplierOrders,
                              });
                              setDetailPage(1);
                              setSplitState(null);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:text-slate-900"
                          >
                            <EyeIcon />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {so.id.includes("::") ? (
                            <span className="text-xs text-slate-400">请同步后导出</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setExportState({ importId: splitState.importId, supplierOrderId: so.id })}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                            >
                              导出文件
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setSplitState(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[560px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">编辑客户信息</h3>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="text-xs text-slate-500">客户名称</label>
                <input
                  value={editState.customerName}
                  onChange={(e) => setEditState({ ...editState, customerName: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">地址</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={editState.addressText}
                    onChange={(e) => setEditState({ ...editState, addressText: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"
                  />
                  <a
                    href={mapSearchUrl(editState.addressText)}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
                      editState.addressText.trim()
                        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
                    }`}
                    title="Google Maps 导航"
                    aria-label="Google Maps 导航"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                      <path d="M10 17s5-4.8 5-9a5 5 0 1 0-10 0c0 4.2 5 9 5 9Z" />
                      <circle cx="10" cy="8" r="1.8" />
                    </svg>
                  </a>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div>
                  <label className="text-xs text-slate-500">联系电话</label>
                  <input
                    value={editState.contactText}
                    onChange={(e) => setEditState({ ...editState, contactText: e.target.value })}
                    placeholder="+52XXXXXXXXXX"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">备注</label>
                  <input
                    value={editState.remarkText}
                    onChange={(e) => setEditState({ ...editState, remarkText: cleanRemarkText(e.target.value) })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">第几门店</label>
                  <input
                    value={editState.storeLabelText}
                    onChange={(e) => setEditState({ ...editState, storeLabelText: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"
                  />
                </div>
              </div>
              {editError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{editError}</div> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditState(null)}
                disabled={editSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={editSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imagePreviewSrc ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 px-4"
          onClick={() => setImagePreviewSrc(null)}
        >
          <img
            src={imagePreviewSrc}
            alt="preview"
            className="max-h-[86vh] max-w-[86vw] rounded-lg bg-white object-contain"
            onClick={() => setImagePreviewSrc(null)}
          />
        </div>
      ) : null}

      {exportState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[460px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">导出文件</h3>
            </div>
            <div className="px-5 py-6">
              <div className="grid grid-cols-3 gap-4">
                <a
                  href={`/api/yg-orders/supplier-orders/${exportState.supplierOrderId}/export/xlsx`}
                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"
                  onClick={() => setExportState(null)}
                >
                  <FileIcon label="XLSX" />
                  <div className="mt-3 text-sm font-semibold text-slate-700">XLSX</div>
                </a>
                <a
                  href={`/api/yg-orders/supplier-orders/${exportState.supplierOrderId}/export/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"
                  onClick={() => setExportState(null)}
                >
                  <FileIcon label="PDF" />
                  <div className="mt-3 text-sm font-semibold text-slate-700">PDF</div>
                </a>
                <a
                  href={`/api/yg-orders/${exportState.importId}/export/zip`}
                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"
                  onClick={() => setExportState(null)}
                >
                  <FileIcon label="ZIP" />
                  <div className="mt-3 text-sm font-semibold text-slate-700">全部压缩包</div>
                </a>
              </div>
            </div>
            <div className="flex justify-end px-5 py-4">
              <button
                type="button"
                onClick={() => setExportState(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
