"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TableCard } from "@/components/table-card";
import { ProductImage } from "@/components/product-image";
import { ImageLightbox } from "@/components/image-lightbox";
import { formatStoreLabelDisplay, getPaymentTermDisplayLines, normalizeStoreLabelInput } from "@/lib/billing-meta";
import { buildProductImageUrl } from "@/lib/product-image-url";

type TabKey = "customer" | "supplier";

type BillingRow = {
  id: string;
  orderNo: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  originalAmountText: string;
  discountedAmountText: string;
  updatedAtText: string;
  customerName: string;
  addressText: string;
  remarkText: string;
  storeLabelText: string;
  issueDateText: string;
  boxCountText: string;
  shipDateText: string;
  warehouseText: string;
  shippingMethodText: string;
  recipientNameText: string;
  recipientPhoneText: string;
  carrierCompanyText: string;
  paymentTermText: string;
  generatedAtText: string;
  generatedVipEnabled: boolean;
};

type DetailItem = {
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  qty: number;
  unitPrice: number;
  normalDiscount: number | null;
  vipDiscount: number | null;
  lineTotal: number;
};

type DetailMap = Record<string, DetailItem[]>;

type EditState = {
  id: string;
  orderNo: string;
  companyName: string;
  contactPhone: string;
  addressText: string;
  remarkText: string;
  storeLabelText: string;
  issueDateText: string;
  boxCountText: string;
  shipDateText: string;
  warehouseText: string;
  shippingMethodText: string;
  recipientNameText: string;
  recipientPhoneText: string;
  carrierCompanyText: string;
  paymentTermText: string;
};

type RevokeState = {
  confirmOrderNo: string;
  reason: string;
  error: string;
};

const PAGE_SIZE = 8;

function EyeIcon() {
  return <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8"><path d="M1.75 10s2.75-4.75 8.25-4.75S18.25 10 18.25 10 15.5 14.75 10 14.75 1.75 10 1.75 10Z" /><circle cx="10" cy="10" r="2.25" /></svg>;
}

function PencilIcon() {
  return <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8"><path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" /><path d="M10.75 6.5 13.5 9.25" /><path d="M11.5 3.75 16.25 8.5" /></svg>;
}

function MapPinIcon() {
  return <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8"><path d="M10 18s5-4.86 5-9a5 5 0 1 0-10 0c0 4.14 5 9 5 9Z" /><circle cx="10" cy="9" r="1.75" /></svg>;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function toPercentText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const percent = value <= 1 ? value * 100 : value;
  const rounded = Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded}%`;
}

function toDiscountFactor(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return value > 1 ? value / 100 : value;
}

function calcLineTotal(item: DetailItem, vipEnabled: boolean) {
  const qty = Number(item.qty || 0);
  const unitPrice = Number(item.unitPrice || 0);
  let factor = 1;
  const normal = toDiscountFactor(item.normalDiscount);
  const vip = toDiscountFactor(item.vipDiscount);
  if (normal !== null) factor *= 1 - normal;
  if (vipEnabled && vip !== null) factor *= 1 - vip;
  return qty * unitPrice * factor;
}

function VipBadgeIcon() {
  return (
    <Image src="/icons/vip.svg" alt="" aria-hidden="true" width={18} height={18} className="h-[18px] w-[18px] shrink-0" />
  );
}

function InvoiceField({
  label,
  value,
  emphasize = false,
  valueClassName = "",
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className={`${emphasize ? "text-[15px] font-medium text-slate-900" : "text-sm leading-6 text-slate-700"} ${valueClassName}`}>{value || "-"}</div>
    </div>
  );
}

function InvoiceSummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-end justify-between gap-6 ${strong ? "pt-4" : ""}`}>
      <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <span className={strong ? "text-3xl font-semibold tracking-tight text-slate-950" : "text-sm font-medium text-slate-700"}>{value}</span>
    </div>
  );
}

function InvoiceHighlightField({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className={emphasize ? "text-[18px] font-medium tracking-tight text-slate-900" : "text-[14px] font-medium text-slate-700"}>{value}</div>
    </div>
  );
}

function InvoiceSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-full flex-col rounded-[24px] border border-slate-200/70 bg-white/80 p-6 ${className}`}>
      <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{title}</div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function BillingClient({
  initialRows,
  detailsByOrderNo,
  activeTab,
}: {
  initialRows: BillingRow[];
  detailsByOrderNo: DetailMap;
  activeTab: TabKey;
}) {
  const [rows, setRows] = useState(initialRows);
  const [currentTab, setCurrentTab] = useState<TabKey>(activeTab);
  const [page, setPage] = useState(1);
  const [detailOrderNo, setDetailOrderNo] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string; title: string } | null>(null);
  const [vipDiscountEnabled, setVipDiscountEnabled] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [statusActionLoading, setStatusActionLoading] = useState<"generate" | "revoke" | "">("");
  const [statusActionError, setStatusActionError] = useState("");
  const [revokeState, setRevokeState] = useState<RevokeState | null>(null);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  const theme = currentTab === "supplier"
    ? {
        panel: "bg-transparent",
        tabActive: "border-amber-200 bg-amber-50 text-amber-900 before:border-amber-100 after:border-amber-100",
        tabInactive: "border-stone-200 bg-stone-100/95 text-stone-500",
        contentBg: "border-amber-100 bg-[linear-gradient(180deg,#fffaf1_0%,#fffdf9_100%)]",
        tabHalo: "shadow-[0_14px_30px_rgba(245,158,11,0.08)]",
      }
    : {
        panel: "bg-transparent",
        tabActive: "border-sky-200 bg-sky-50 text-sky-950 before:border-sky-100 after:border-sky-100",
        tabInactive: "border-stone-200 bg-stone-100/95 text-stone-500",
        contentBg: "border-sky-100 bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_100%)]",
        tabHalo: "shadow-[0_14px_30px_rgba(14,165,233,0.08)]",
      };

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [rows, currentPage]);
  const detailItems = useMemo(() => (detailOrderNo ? detailsByOrderNo[detailOrderNo] || [] : []), [detailOrderNo, detailsByOrderNo]);
  const detailTotal = useMemo(() => detailItems.reduce((sum, item) => sum + calcLineTotal(item, vipDiscountEnabled), 0), [detailItems, vipDiscountEnabled]);
  const detailSubtotal = useMemo(() => detailItems.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0), [detailItems]);
  const detailDiscountAmount = useMemo(() => Math.max(detailSubtotal - detailTotal, 0), [detailSubtotal, detailTotal]);
  const detailQtyTotal = useMemo(() => detailItems.reduce((sum, item) => sum + Number(item.qty || 0), 0), [detailItems]);
  const exportLinks = useMemo(() => {
    if (!detailOrderNo) return null;
    const encodedOrderNo = encodeURIComponent(detailOrderNo);
    return { xlsx: `/api/billing/${encodedOrderNo}/export/xlsx`, pdf: `/api/billing/${encodedOrderNo}/export/pdf` };
  }, [detailOrderNo]);
  const detailRow = useMemo(() => (detailOrderNo ? rows.find((row) => row.orderNo === detailOrderNo) || null : null), [detailOrderNo, rows]);
  const detailGenerated = Boolean(detailRow?.generatedAtText);
  const rowAmountMap = useMemo(() => {
    const map = new Map<string, { originalAmountText: string; discountedAmountText: string }>();
    for (const row of rows) {
      const items = detailsByOrderNo[row.orderNo] || [];
      if (items.length === 0) {
        map.set(row.orderNo, {
          originalAmountText: row.originalAmountText,
          discountedAmountText: row.discountedAmountText,
        });
        continue;
      }

      const originalAmount = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0);
      const effectiveVipEnabled =
        row.orderNo === detailOrderNo
          ? vipDiscountEnabled
          : Boolean(row.generatedAtText && row.generatedVipEnabled);
      const discountedAmount = items.reduce((sum, item) => sum + calcLineTotal(item, effectiveVipEnabled), 0);
      map.set(row.orderNo, {
        originalAmountText: toMoney(originalAmount),
        discountedAmountText: toMoney(discountedAmount),
      });
    }
    return map;
  }, [detailOrderNo, detailsByOrderNo, rows, vipDiscountEnabled]);

  useEffect(() => {
    if (!detailRow?.generatedAtText) return;
    setVipDiscountEnabled(detailRow.generatedVipEnabled);
  }, [detailRow?.generatedAtText, detailRow?.generatedVipEnabled]);

  function handleExport(kind: "xlsx" | "pdf") {
    if (!detailGenerated || !exportLinks) return;
    window.location.assign(exportLinks[kind]);
  }

  async function updateGeneratedState(action: "generate" | "revoke", options?: { confirmOrderNo?: string; revokeReason?: string }) {
    if (!detailRow) return;
    setStatusActionError("");
    setStatusActionLoading(action);
    try {
      const res = await fetch(`/api/yg-orders/${detailRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          generatedVipEnabled: vipDiscountEnabled,
          confirmOrderNo: options?.confirmOrderNo,
          revokeReason: options?.revokeReason,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.ok) {
        throw new Error(result?.error || (action === "generate" ? "生成账单失败" : "撤销生成失败"));
      }

      setRows((prev) => prev.map((row) => row.id !== detailRow.id ? row : {
        ...row,
        generatedAtText: result.data.generatedAtText || "",
        generatedVipEnabled: Boolean(result.data.generatedVipEnabled),
      }));

      if (action === "revoke") {
        setRevokeState(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : (action === "generate" ? "生成账单失败" : "撤销生成失败");
      if (action === "revoke") {
        setRevokeState((prev) => prev ? { ...prev, error: message } : prev);
      } else {
        setStatusActionError(message);
      }
    } finally {
      setStatusActionLoading("");
    }
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/yg-orders/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: editState.companyName.trim(),
          contactPhone: editState.contactPhone.trim(),
          addressText: editState.addressText.trim(),
          remarkText: editState.remarkText.trim(),
          storeLabel: normalizeStoreLabelInput(editState.storeLabelText),
          headerMeta: {
            boxCount: editState.boxCountText.trim(),
            shipDate: editState.shipDateText.trim(),
            shippingMethod: editState.shippingMethodText.trim(),
            recipientName: editState.recipientNameText.trim(),
            recipientPhone: editState.recipientPhoneText.trim(),
            carrierCompany: editState.carrierCompanyText.trim(),
            paymentTerm: editState.paymentTermText.trim(),
          },
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.ok) throw new Error(result?.error || "保存失败");

      setRows((prev) => prev.map((row) => row.id !== editState.id ? row : {
        ...row,
        companyName: result.data.customerName || row.companyName,
        customerName: result.data.customerName || row.customerName,
        contactPhone: result.data.contactText || row.contactPhone,
        addressText: result.data.addressText || row.addressText,
        remarkText: result.data.remarkText || row.remarkText,
        storeLabelText: normalizeStoreLabelInput(result.data.storeLabelText || row.storeLabelText),
        issueDateText: result.data.issueDateText || row.issueDateText,
        boxCountText: result.data.boxCountText || row.boxCountText,
        shipDateText: result.data.shipDateText || row.shipDateText,
        warehouseText: result.data.warehouseText || row.warehouseText,
        shippingMethodText: result.data.shippingMethodText || row.shippingMethodText,
        recipientNameText: result.data.recipientNameText || row.recipientNameText,
        recipientPhoneText: result.data.recipientPhoneText || row.recipientPhoneText,
        carrierCompanyText: result.data.carrierCompanyText || row.carrierCompanyText,
        paymentTermText: result.data.paymentTermText || row.paymentTermText,
      }));
      setEditState(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`mt-0 ${theme.panel}`}>
      <div className="relative px-3 pt-3">
        <div className="relative z-10 flex flex-wrap items-end gap-2 px-4">
          <button
            type="button"
            onClick={() => setCurrentTab("customer")}
            className={`relative inline-flex min-w-[148px] items-center justify-center rounded-t-[18px] border px-5 py-2.5 text-sm font-semibold transition before:pointer-events-none before:absolute before:-bottom-px before:-left-[14px] before:h-[14px] before:w-[14px] before:rounded-br-[14px] before:border-b before:border-r before:bg-transparent before:content-[''] after:pointer-events-none after:absolute after:-bottom-px after:-right-[14px] after:h-[14px] after:w-[14px] after:rounded-bl-[14px] after:border-b after:border-l after:bg-transparent after:content-[''] ${currentTab === "customer" ? `${theme.tabActive} ${theme.tabHalo} z-20 border-b-transparent` : `${theme.tabInactive} z-0 translate-y-[6px] before:hidden after:hidden`}`}
          >
            客户出账单
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab("supplier")}
            className={`relative inline-flex min-w-[148px] items-center justify-center rounded-t-[18px] border px-5 py-2.5 text-sm font-semibold transition before:pointer-events-none before:absolute before:-bottom-px before:-left-[14px] before:h-[14px] before:w-[14px] before:rounded-br-[14px] before:border-b before:border-r before:bg-transparent before:content-[''] after:pointer-events-none after:absolute after:-bottom-px after:-right-[14px] after:h-[14px] after:w-[14px] after:rounded-bl-[14px] after:border-b after:border-l after:bg-transparent after:content-[''] ${currentTab === "supplier" ? `${theme.tabActive} ${theme.tabHalo} z-20 border-b-transparent` : `${theme.tabInactive} z-0 translate-y-[6px] before:hidden after:hidden`}`}
          >
            供应商账单
          </button>
        </div>

        <div className={`relative z-0 -mt-px rounded-[30px] border p-5 pt-7 shadow-[0_16px_40px_rgba(15,23,42,0.05)] ${theme.contentBg}`}>
          <div className="absolute inset-x-0 top-0 h-6 rounded-t-[30px] bg-inherit" />
        <div>
          <TableCard title="待出账单列表" description={`共 ${totalCount} 条待导出账单`}>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-sm text-stone-500">
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">账单名称</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">公司名称</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">联系人</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">联系电话</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">原金额</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">折扣后金额</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">账单汇总时间</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">账单生成</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-stone-500">当前没有待出账单记录</td></tr>
                  ) : pageRows.map((row) => (
                    <tr key={row.orderNo} className="border-t border-stone-200/70 bg-white/80">
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-900">{row.orderNo}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-700">{row.companyName || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-700">{row.contactName || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-700">{row.contactPhone || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-left text-sm text-stone-700">{rowAmountMap.get(row.orderNo)?.originalAmountText || row.originalAmountText}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-left text-sm font-semibold text-slate-900">{rowAmountMap.get(row.orderNo)?.discountedAmountText || row.discountedAmountText}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-500">{row.updatedAtText}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${row.generatedAtText ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                          {row.generatedAtText ? "已生成" : "未生成"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-slate-900" title="查看账单" onClick={() => setDetailOrderNo(row.orderNo)}><EyeIcon /></button>
                          <button type="button" disabled={Boolean(row.generatedAtText)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300" title={row.generatedAtText ? "账单已生成，需先撤销生成" : "编辑客户信息"} onClick={() => setEditState({
                            id: row.id,
                            orderNo: row.orderNo,
                            companyName: row.companyName === "-" ? "" : row.companyName,
                            contactPhone: row.contactPhone === "-" ? "" : row.contactPhone,
                            addressText: row.addressText,
                            remarkText: row.remarkText,
                            storeLabelText: row.storeLabelText,
                            issueDateText: row.issueDateText,
                            boxCountText: row.boxCountText,
                            shipDateText: row.shipDateText,
                            warehouseText: row.warehouseText,
                            shippingMethodText: row.shippingMethodText,
                            recipientNameText: row.recipientNameText,
                            recipientPhoneText: row.recipientPhoneText,
                            carrierCompanyText: row.carrierCompanyText,
                            paymentTermText: row.paymentTermText,
                          })}><PencilIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalCount > 0 ? (
              <div className="border-t border-stone-200 px-5 py-4">
                <div className="flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setPage(1)} disabled={currentPage === 1} className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-full border border-stone-200 px-3 text-sm text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300">首页</button>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-full border border-stone-200 px-3 text-sm text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300">上一页</button>
                  <span className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-slate-700">{currentPage} / {totalPages}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-full border border-stone-200 px-3 text-sm text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300">下一页</button>
                  <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-full border border-stone-200 px-3 text-sm text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300">末页</button>
                </div>
              </div>
            ) : null}
          </TableCard>
        </div>
      </div>
      </div>

      {detailOrderNo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onClick={() => setDetailOrderNo(null)}>
          <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-[28px] border border-slate-200 bg-[#f7f6f3] shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">账单预览 / VISTA</div>
                <div className="mt-1 text-sm text-slate-600">账单号 / No. Ped. <span className="font-semibold text-slate-900">{detailOrderNo}</span></div>
                {statusActionError ? <div className="mt-2 text-sm text-red-600">{statusActionError}</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {exportLinks ? (
                  <>
                    <button
                      type="button"
                      disabled={!detailGenerated}
                      onClick={() => handleExport("xlsx")}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-slate-100"
                    >
                      导出 XLSX
                    </button>
                    <button
                      type="button"
                      disabled={!detailGenerated}
                      onClick={() => handleExport("pdf")}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-slate-100"
                    >
                      导出 PDF
                    </button>
                  </>
                ) : null}
                {detailRow ? (
                  detailGenerated ? (
                    <button type="button" disabled={statusActionLoading === "revoke"} className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setRevokeState({ confirmOrderNo: "", reason: "", error: "" })}>撤销生成</button>
                  ) : (
                    <button type="button" disabled={statusActionLoading === "generate"} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => updateGeneratedState("generate")}>生成账单</button>
                  )
                ) : null}
                {detailRow ? (
                  <button type="button" disabled={detailGenerated} className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent" onClick={() => setEditState({
                    id: detailRow.id,
                    orderNo: detailRow.orderNo,
                    companyName: detailRow.companyName === "-" ? "" : detailRow.companyName,
                    contactPhone: detailRow.contactPhone === "-" ? "" : detailRow.contactPhone,
                    addressText: detailRow.addressText,
                    remarkText: detailRow.remarkText,
                    storeLabelText: detailRow.storeLabelText,
                    issueDateText: detailRow.issueDateText,
                    boxCountText: detailRow.boxCountText,
                    shipDateText: detailRow.shipDateText,
                    warehouseText: detailRow.warehouseText,
                    shippingMethodText: detailRow.shippingMethodText,
                    recipientNameText: detailRow.recipientNameText,
                    recipientPhoneText: detailRow.recipientPhoneText,
                    carrierCompanyText: detailRow.carrierCompanyText,
                    paymentTermText: detailRow.paymentTermText,
                  })}>编辑表头</button>
                ) : null}
                <label className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${detailGenerated ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-600"}`}>
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={vipDiscountEnabled} disabled={detailGenerated} onChange={(e) => setVipDiscountEnabled(e.target.checked)} />
                  启用 VIP 折扣
                </label>
                <button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50" onClick={() => setDetailOrderNo(null)}>关闭</button>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-auto px-6 py-8">
              <div className="relative mx-auto w-full max-w-[980px] rounded-[32px] bg-white px-8 py-9 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                {detailGenerated ? (
                  <div className="pointer-events-none absolute right-[292px] top-[78px] z-10 rotate-[-11deg] opacity-[0.78]">
                    <div className="relative inline-block min-w-[336px] border-[5px] border-[#b03127]/90 bg-[#fff8f5]/20 px-5 py-3 text-[#b03127] shadow-[0_10px_24px_rgba(176,49,39,0.08)]">
                      <div className="pointer-events-none absolute inset-[6px] border border-[#b03127]/35" />
                      <div className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(176,49,39,0.35) 0 2px, transparent 2px 14px)" }} />
                      <div className="relative flex min-h-[92px] flex-col justify-between py-1">
                        <div className="flex items-center justify-between text-[22px] font-black leading-none tracking-[0.04em]">
                          <span>账单生成</span>
                          <span>并锁定</span>
                        </div>
                        <div className="border-t border-[#b03127]/35 pt-3">
                          <div className="flex items-center justify-between text-[22px] font-black uppercase leading-none tracking-[0.02em]">
                            <span>FACT. GEN.</span>
                            <span>Y BLOQ.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-start justify-between gap-10 border-b border-slate-200/80 pb-10">
                  <div className="max-w-[430px] pt-1">
                    <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-slate-400">PARKSONMX</div>
                    <h2 className="mt-6 text-[54px] font-semibold leading-none tracking-[-0.045em] text-slate-950">INVOICE</h2>
                    <p className="mt-5 max-w-md text-sm leading-7 text-slate-500">MÁS QUE PRODUCTOS, ENTREGAMOS SOLUCIONES</p>
                  </div>
                  <div className="grid min-w-[280px] gap-3 rounded-[22px] border border-slate-200/60 bg-slate-50/35 px-5 py-4">
                    <InvoiceHighlightField label="订单号 / No. Ped." value={detailRow?.orderNo || "-"} />
                    <InvoiceHighlightField label="出账日期 / F. Fact." value={detailRow?.issueDateText || "-"} />
                    <InvoiceHighlightField label="合计金额 / Mto. Total" value={`$${toMoney(detailTotal)}`} emphasize />
                  </div>
                </div>

                <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-3">
                  <InvoiceSection title="客户信息 / CLIENTE">
                    <InvoiceField label="客户名称 / Nom. Clte." value={detailRow?.companyName || "-"} />
                    <InvoiceField label="收货人 / Dest." value={detailRow?.recipientNameText || detailRow?.contactName || "-"} />
                    <InvoiceField label="电话 / Tel. Dest." value={detailRow?.recipientPhoneText || detailRow?.contactPhone || "-"} />
                    <InvoiceField label="送货地址 / Dir. Ent." value={detailRow?.addressText || "-"} valueClassName="leading-7" />
                  </InvoiceSection>
                  <InvoiceSection title="账单信息 / FACT.">
                    <InvoiceField label="发货日期 / F. Env." value={detailRow?.shipDateText || "-"} />
                    <InvoiceField label="门店标记 / Etiq. Tda." value={formatStoreLabelDisplay(detailRow?.storeLabelText || "") || "-"} />
                    {getPaymentTermDisplayLines(detailRow?.paymentTermText || "").length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">账期</div>
                        <div className="text-sm leading-6 text-slate-700">
                          {getPaymentTermDisplayLines(detailRow?.paymentTermText || "").map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {vipDiscountEnabled ? (
                      <div className="flex flex-col items-start gap-1.5 text-sm font-semibold leading-6 text-slate-950">
                        <VipBadgeIcon />
                        <span>VIP客户</span>
                      </div>
                    ) : null}
                  </InvoiceSection>
                  <InvoiceSection title="物流信息 / ENVÍO">
                    <InvoiceField label="发货仓 / Dep. Env." value={detailRow?.warehouseText || "-"} />
                    <InvoiceField label="发货方式 / Met. Env." value={detailRow?.shippingMethodText || "-"} />
                    <InvoiceField label="托运公司 / Emp. Transp." value={detailRow?.carrierCompanyText || "-"} />
                    <InvoiceField label="装箱件数 / Cant. Cajas" value={detailRow?.boxCountText || "-"} />
                    <InvoiceField label="商品总数量 / Tot. Prod." value={String(detailQtyTotal || 0)} />
                  </InvoiceSection>
                </div>

                <div className="mt-11">
                  <div className="flex items-end justify-between gap-4 border-b border-slate-200/70 pb-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">商品明细 / DETALLE</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[minmax(320px,1.8fr)_72px_92px_82px_110px] gap-4 border-b border-slate-200 px-2 pb-3 text-[11px] text-slate-400">
                    <div className="leading-[1.15]">
                      <div className="uppercase tracking-[0.22em]">产品</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em]">Prod.</div>
                    </div>
                    <div className="text-right leading-[1.15]">
                      <div className="uppercase tracking-[0.22em]">数量</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em]">Cant.</div>
                    </div>
                    <div className="text-right leading-[1.15]">
                      <div className="uppercase tracking-[0.22em]">单价</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em]">P. Unit.</div>
                    </div>
                    <div className="text-right leading-[1.15]">
                      <div className="uppercase tracking-[0.22em]">折扣</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em]">Desc.</div>
                    </div>
                    <div className="text-right leading-[1.15]">
                      <div className="uppercase tracking-[0.22em]">金额</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em]">Importe</div>
                    </div>
                  </div>

                  {detailItems.length === 0 ? (
                    <div className="py-14 text-center text-sm text-slate-500">当前账单没有可显示的商品明细</div>
                  ) : (
                    <div className="divide-y divide-slate-200/80">
                      {detailItems.map((item, idx) => (
                        <div key={`${item.sku}-${item.barcode}-${idx}`} className="grid grid-cols-[minmax(320px,1.8fr)_72px_92px_82px_110px] gap-4 px-2 py-5">
                          <div className="flex min-w-0 gap-4">
                            <div className="flex w-[56px] shrink-0 items-start justify-center pt-1">
                              <ProductImage
                                sku={item.sku}
                                alt={item.nameZh || item.nameEs || item.sku || item.barcode || "商品图片"}
                                size={44}
                                roundedClassName="rounded-xl"
                                onClick={() => {
                                  const src = buildProductImageUrl(item.sku, "jpg");
                                  if (!src) return;
                                  const title = item.nameZh || item.nameEs || item.sku || item.barcode || "商品图片";
                                  setPreviewImage({ src, alt: title, title });
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[15px] font-medium leading-6 text-slate-900">{item.nameEs || item.nameZh || "-"}</div>
                              {item.nameZh && item.nameEs ? (
                                <div className="mt-1 text-sm leading-6 text-slate-500">{item.nameZh}</div>
                              ) : null}
                              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">SKU {item.sku || "-"} / Barcode {item.barcode || "-"}</div>
                            </div>
                          </div>
                          <div className="text-right text-sm font-medium text-slate-700">{item.qty}</div>
                          <div className="text-right text-sm font-medium text-slate-700">${toMoney(item.unitPrice)}</div>
                          <div className="text-right text-sm text-slate-500">
                            <div>{toPercentText(item.normalDiscount)}</div>
                            {vipDiscountEnabled ? <div className="mt-1 text-xs text-slate-400">VIP {toPercentText(item.vipDiscount)}</div> : null}
                          </div>
                          <div className="text-right text-sm font-semibold text-slate-900">${toMoney(calcLineTotal(item, vipDiscountEnabled))}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-12 flex justify-end border-t border-slate-200/80 pt-8">
                  <div className="w-full max-w-[340px] space-y-4">
                    <InvoiceSummaryRow label="小计 / Subtot." value={`$${toMoney(detailSubtotal)}`} />
                    <InvoiceSummaryRow label="折扣后 / Desc." value={`$${toMoney(detailDiscountAmount)}`} />
                    <InvoiceSummaryRow label="应付总额 / Mto. Total" value={`$${toMoney(detailTotal)}`} strong />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {revokeState && detailRow ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setRevokeState(null)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">撤销生成</h3>
              <p className="mt-1 text-sm text-slate-500">请输入完整订单号并填写撤销原因后继续。</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="text-sm text-slate-600">完整账单号</label>
                  <span className="text-xs text-slate-400">此账单号：{detailRow.orderNo}</span>
                </div>
                <input value={revokeState.confirmOrderNo} onChange={(e) => setRevokeState((prev) => prev ? { ...prev, confirmOrderNo: e.target.value, error: "" } : prev)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">撤销原因</label>
                <textarea value={revokeState.reason} onChange={(e) => setRevokeState((prev) => prev ? { ...prev, reason: e.target.value, error: "" } : prev)} className="min-h-[110px] w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-primary/40" />
              </div>
              {revokeState.error ? <div className="text-sm text-red-600">{revokeState.error}</div> : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setRevokeState(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button type="button" disabled={statusActionLoading === "revoke"} onClick={() => updateGeneratedState("revoke", { confirmOrderNo: revokeState.confirmOrderNo, revokeReason: revokeState.reason })} className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">确认撤销</button>
            </div>
          </div>
        </div>
      ) : null}

      {editState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setEditState(null)}>
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-slate-900">编辑客户信息</h3>
              <p className="mt-1 text-sm text-slate-500">账单：{editState.orderNo}</p>
            </div>
            <div className="space-y-8 p-6">
              <section className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">基础信息区</div>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 md:flex-nowrap">
                    <div className="w-full md:w-[190px] md:shrink-0"><label className="mb-1 block text-sm text-slate-600">订单号</label><input value={editState.orderNo} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none" /></div>
                    <div className="w-full md:w-[140px] md:shrink-0"><label className="mb-1 block text-sm text-slate-600">出账日期</label><input value={editState.issueDateText} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none" /></div>
                    <div className="w-full md:w-[150px] md:shrink-0"><label className="mb-1 block text-sm text-slate-600">发货日期</label><input type="date" value={editState.shipDateText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, shipDateText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                    <div className="w-full md:w-[88px] md:shrink-0"><label className="mb-1 block text-sm text-slate-600">账期</label><input inputMode="numeric" value={editState.paymentTermText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, paymentTermText: e.target.value.replace(/[^\d]/g, "") } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="min-w-0 flex-1"><label className="mb-1 block text-sm text-slate-600">公司名称</label><input value={editState.companyName} onChange={(e) => setEditState((prev) => (prev ? { ...prev, companyName: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                    <div className="w-full md:w-[150px]"><label className="mb-1 block text-sm text-slate-600">第几门店</label><input value={editState.storeLabelText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, storeLabelText: normalizeStoreLabelInput(e.target.value) } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t border-slate-100 pt-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">业务填写区</div>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 md:flex-nowrap">
                    <div className="w-full md:w-[160px] md:shrink-0"><label className="mb-1 block text-sm text-slate-600">发货仓</label><input value={editState.warehouseText} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none" /></div>
                    <div className="w-full md:w-[92px] md:shrink-0"><label className="mb-1 block text-sm text-slate-600">装箱件数</label><input value={editState.boxCountText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, boxCountText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                    <div className="w-full md:w-[130px] md:shrink-0"><label className="mb-1 block text-sm text-slate-600">发货方式</label><select value={editState.shippingMethodText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, shippingMethodText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary/40"><option value="">请选择</option><option value="送托运">送托运</option><option value="自提">自提</option></select></div>
                    <div className="min-w-0 flex-1 md:min-w-[150px]"><label className="mb-1 block text-sm text-slate-600">托运公司</label><input value={editState.carrierCompanyText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, carrierCompanyText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><label className="mb-1 block text-sm text-slate-600">收货人</label><input value={editState.recipientNameText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, recipientNameText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                    <div><label className="mb-1 block text-sm text-slate-600">收货电话</label><input value={editState.recipientPhoneText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, recipientPhoneText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-slate-600">收货地址</label>
                    <div className="flex items-center gap-2">
                      <input value={editState.addressText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, addressText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editState.addressText || "")}`} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" title="Google Maps"><MapPinIcon /></a>
                    </div>
                  </div>
                </div>
              </section>

              {saveError ? <div className="text-sm text-red-600">{saveError}</div> : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setEditState(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button type="button" onClick={saveEdit} disabled={saving} className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox open={Boolean(previewImage)} src={previewImage?.src || ""} alt={previewImage?.alt} title={previewImage?.title} onClose={() => setPreviewImage(null)} />
    </section>
  );
}
