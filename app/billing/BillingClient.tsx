"use client";

import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { ProductImage } from "@/components/product-image";
import { ImageLightbox } from "@/components/image-lightbox";
import { buildProductImageUrl } from "@/lib/product-image-url";

type TabKey = "customer" | "supplier";

type BillingRow = {
  id: string;
  orderNo: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  amountText: string;
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
  contactName: string;
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

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  const theme = currentTab === "supplier"
    ? { panel: "border-stone-200 bg-white", tabActive: "border-amber-300 bg-amber-50 text-amber-900", tabInactive: "border-transparent bg-stone-100 text-stone-500", accentValue: "text-amber-700", contentBg: "bg-stone-50" }
    : { panel: "border-stone-200 bg-white", tabActive: "border-slate-300 bg-slate-100 text-slate-900", tabInactive: "border-transparent bg-stone-100 text-stone-500", accentValue: "text-slate-800", contentBg: "bg-stone-50" };

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
    const vipQuery = vipDiscountEnabled ? "vip=1" : "vip=0";
    return { xlsx: `/api/billing/${encodedOrderNo}/export/xlsx?${vipQuery}`, pdf: `/api/billing/${encodedOrderNo}/export/pdf?${vipQuery}` };
  }, [detailOrderNo, vipDiscountEnabled]);
  const detailRow = useMemo(() => (detailOrderNo ? rows.find((row) => row.orderNo === detailOrderNo) || null : null), [detailOrderNo, rows]);

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
          contactName: editState.contactName.trim(),
          contactPhone: editState.contactPhone.trim(),
          addressText: editState.addressText.trim(),
          remarkText: editState.remarkText.trim(),
          storeLabel: editState.storeLabelText.trim(),
          headerMeta: {
            boxCount: editState.boxCountText.trim(),
            shipDate: editState.shipDateText.trim(),
            shippingMethod: editState.shippingMethodText.trim(),
            recipientName: editState.recipientNameText.trim(),
            recipientPhone: editState.recipientPhoneText.trim(),
            carrierCompany: editState.carrierCompanyText.trim(),
          },
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.ok) throw new Error(result?.error || "保存失败");

      setRows((prev) => prev.map((row) => row.id !== editState.id ? row : {
        ...row,
        companyName: result.data.customerName || row.companyName,
        customerName: result.data.customerName || row.customerName,
        contactName: result.data.contactName || row.contactName,
        contactPhone: result.data.contactText || row.contactPhone,
        addressText: result.data.addressText || row.addressText,
        remarkText: result.data.remarkText || row.remarkText,
        storeLabelText: result.data.storeLabelText || row.storeLabelText,
        issueDateText: result.data.issueDateText || row.issueDateText,
        boxCountText: result.data.boxCountText || row.boxCountText,
        shipDateText: result.data.shipDateText || row.shipDateText,
        warehouseText: result.data.warehouseText || row.warehouseText,
        shippingMethodText: result.data.shippingMethodText || row.shippingMethodText,
        recipientNameText: result.data.recipientNameText || row.recipientNameText,
        recipientPhoneText: result.data.recipientPhoneText || row.recipientPhoneText,
        carrierCompanyText: result.data.carrierCompanyText || row.carrierCompanyText,
      }));
      setEditState(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`mt-0 overflow-hidden rounded-[30px] border ${theme.panel}`}>
      <div className="border-b border-stone-200 bg-white px-5 pt-4">
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" onClick={() => setCurrentTab("customer")} className={`inline-flex min-w-[148px] items-center justify-center rounded-t-2xl border px-4 py-2 text-sm font-semibold ${currentTab === "customer" ? theme.tabActive : theme.tabInactive}`}>客户出账单</button>
          <button type="button" onClick={() => setCurrentTab("supplier")} className={`inline-flex min-w-[148px] items-center justify-center rounded-t-2xl border px-4 py-2 text-sm font-semibold ${currentTab === "supplier" ? theme.tabActive : theme.tabInactive}`}>供应商账单</button>
        </div>
      </div>

      <div className={`m-3 rounded-[24px] p-5 ${theme.contentBg}`}>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="待出账单" value={totalCount} hint="验货完成后等待汇总出账" valueClassName={theme.accentValue} />
          <StatCard label="待生成" value="0" hint="当前没有待生成的账单" valueClassName="text-stone-700" />
          <StatCard label="待复核" value="0" hint="导出前需要人工复核" valueClassName="text-stone-700" />
          <StatCard label="可导出" value={totalCount} hint="可直接下载 XLSX 与 PDF" valueClassName="text-stone-900" />
        </section>

        <div className="mt-5">
          <TableCard title="待出账单列表" description={`共 ${totalCount} 条待导出账单`}>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-sm text-stone-500">
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">账单名称</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">公司名称</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">联系人</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">联系电话</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">合计金额</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">更新时间</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-stone-500">当前没有待出账单记录</td></tr>
                  ) : pageRows.map((row) => (
                    <tr key={row.orderNo} className="border-t border-stone-200/70 bg-white/80">
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-900">{row.orderNo}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-700">{row.companyName || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-700">{row.contactName || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-700">{row.contactPhone || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-slate-900">{row.amountText}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-stone-500">{row.updatedAtText}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-slate-900" title="查看账单" onClick={() => setDetailOrderNo(row.orderNo)}><EyeIcon /></button>
                          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-slate-900" title="编辑客户信息" onClick={() => setEditState({
                            id: row.id,
                            orderNo: row.orderNo,
                            companyName: row.companyName === "-" ? "" : row.companyName,
                            contactName: row.contactName === "-" ? "" : row.contactName,
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

      {detailOrderNo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onClick={() => setDetailOrderNo(null)}>
          <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-[28px] border border-slate-200 bg-[#f7f6f3] shadow-[0_30px_80px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Billing Preview</div>
                <div className="mt-1 text-sm text-slate-600">账单号 <span className="font-semibold text-slate-900">{detailOrderNo}</span></div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {exportLinks ? (
                  <>
                    <a href={exportLinks.xlsx} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">导出 XLSX</a>
                    <a href={exportLinks.pdf} className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">导出 PDF</a>
                  </>
                ) : null}
                {detailRow ? (
                  <button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50" onClick={() => setEditState({
                    id: detailRow.id,
                    orderNo: detailRow.orderNo,
                    companyName: detailRow.companyName === "-" ? "" : detailRow.companyName,
                    contactName: detailRow.contactName === "-" ? "" : detailRow.contactName,
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
                  })}>编辑表头</button>
                ) : null}
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={vipDiscountEnabled} onChange={(e) => setVipDiscountEnabled(e.target.checked)} />
                  启用 VIP 折扣
                </label>
                <button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50" onClick={() => setDetailOrderNo(null)}>关闭</button>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-auto px-6 py-8">
              <div className="mx-auto w-full max-w-[980px] rounded-[32px] bg-white px-8 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-10 border-b border-slate-200 pb-9">
                  <div className="max-w-[430px] pt-1">
                    <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-slate-400">PARKSONMX</div>
                    <h2 className="mt-6 text-[52px] font-semibold leading-none tracking-[-0.04em] text-slate-950">INVOICE</h2>
                    <p className="mt-5 max-w-md text-sm leading-7 text-slate-500">MÁS QUE PRODUCTOS, ENTREGAMOS SOLUCIONES</p>
                  </div>
                  <div className="grid min-w-[280px] gap-3 rounded-[24px] border border-slate-200/70 bg-slate-50/55 px-5 py-4">
                    <InvoiceHighlightField label="Order No." value={detailRow?.orderNo || "-"} />
                    <InvoiceHighlightField label="Issue Date" value={detailRow?.issueDateText || "-"} />
                    <InvoiceHighlightField label="Total Amount" value={`$${toMoney(detailTotal)}`} emphasize />
                  </div>
                </div>

                <div className="mt-8 grid gap-5 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200/70 p-6">
                    <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">账单对象 / Client</div>
                    <div className="space-y-5">
                      <InvoiceField label="客户名称 / Nom. Cte." value={detailRow?.companyName || "-"} emphasize />
                      <InvoiceField label="收货人 / Dest." value={detailRow?.recipientNameText || detailRow?.contactName || "-"} />
                      <InvoiceField label="电话 / Tel. Dest." value={detailRow?.recipientPhoneText || detailRow?.contactPhone || "-"} />
                      <InvoiceField label="送货地址 / Dir. Ent." value={detailRow?.addressText || "-"} />
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/70 p-6">
                    <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">账单信息 / Billing</div>
                    <div className="space-y-5">
                      <InvoiceField label="发货日期 / F. Env." value={detailRow?.shipDateText || "-"} />
                      <InvoiceField label="门店标记 / Store Label" value={detailRow?.storeLabelText || "-"} />
                      <InvoiceField label="VIP 折扣 / VIP Discount" value={vipDiscountEnabled ? "已启用 / Enabled" : "未启用 / Disabled"} />
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/70 p-6">
                    <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">物流信息 / Shipping</div>
                    <div className="space-y-5">
                      <InvoiceField label="发货仓 / Dep. Envío" value={detailRow?.warehouseText || "-"} />
                      <InvoiceField label="发货方式 / Met. Env." value={detailRow?.shippingMethodText || "-"} />
                      <InvoiceField label="托运公司 / Emp. Transp." value={detailRow?.carrierCompanyText || "-"} />
                      <InvoiceField label="装箱件数 / Cant. Cajas" value={detailRow?.boxCountText || "-"} />
                      <InvoiceField label="商品总数量 / Total Prod." value={String(detailQtyTotal || 0)} />
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  <div className="flex items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Line Items</div>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">商品明细</h3>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[64px_minmax(280px,1.8fr)_70px_92px_92px_110px] gap-4 border-b border-slate-200 px-2 pb-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <div>图片</div>
                    <div>商品 / Producto</div>
                    <div className="text-right">数量</div>
                    <div className="text-right">单价</div>
                    <div className="text-right">折扣</div>
                    <div className="text-right">金额</div>
                  </div>

                  {detailItems.length === 0 ? (
                    <div className="py-14 text-center text-sm text-slate-500">当前账单没有可显示的商品明细</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {detailItems.map((item, idx) => (
                        <div key={`${item.sku}-${item.barcode}-${idx}`} className="grid grid-cols-[64px_minmax(280px,1.8fr)_70px_92px_92px_110px] gap-4 px-2 py-5">
                          <div className="flex items-start justify-center pt-1">
                            <ProductImage sku={item.sku} alt={item.nameZh || item.nameEs || item.sku || item.barcode || "商品图片"} size={48} roundedClassName="rounded-xl" onClick={() => {
                              const src = buildProductImageUrl(item.sku, "jpg");
                              if (!src) return;
                              const title = item.nameZh || item.nameEs || item.sku || item.barcode || "商品图片";
                              setPreviewImage({ src, alt: title, title });
                            }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[15px] font-semibold leading-6 text-slate-900">{item.nameZh || "-"}</div>
                            <div className="mt-1 text-sm leading-6 text-slate-500">{item.nameEs || "-"}</div>
                            <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">SKU {item.sku || "-"} / Barcode {item.barcode || "-"}</div>
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

                <div className="mt-10 flex justify-end border-t border-slate-200 pt-8">
                  <div className="w-full max-w-[340px] space-y-4">
                    <InvoiceSummaryRow label="Subtotal" value={`$${toMoney(detailSubtotal)}`} />
                    <InvoiceSummaryRow label="Discounts" value={`$${toMoney(detailDiscountAmount)}`} />
                    <InvoiceSummaryRow label="Total a pagar" value={`$${toMoney(detailTotal)}`} strong />
                  </div>
                </div>
              </div>
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
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div><label className="mb-1 block text-sm text-slate-600">公司名称</label><input value={editState.companyName} onChange={(e) => setEditState((prev) => (prev ? { ...prev, companyName: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">联系人</label><input value={editState.contactName} onChange={(e) => setEditState((prev) => (prev ? { ...prev, contactName: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">联系电话</label><input value={editState.contactPhone} onChange={(e) => setEditState((prev) => (prev ? { ...prev, contactPhone: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">第几门店</label><input value={editState.storeLabelText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, storeLabelText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">订单号</label><input value={editState.orderNo} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">出账日期</label><input value={editState.issueDateText} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">发货日期</label><input type="date" value={editState.shipDateText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, shipDateText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">装箱件数</label><input value={editState.boxCountText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, boxCountText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">发货仓</label><input value={editState.warehouseText} readOnly className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">发货方式</label><select value={editState.shippingMethodText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, shippingMethodText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary/40"><option value="">请选择</option><option value="送托运">送托运</option><option value="自提">自提</option></select></div>
              <div><label className="mb-1 block text-sm text-slate-600">收货人</label><input value={editState.recipientNameText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, recipientNameText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">收货电话</label><input value={editState.recipientPhoneText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, recipientPhoneText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div><label className="mb-1 block text-sm text-slate-600">托运公司</label><input value={editState.carrierCompanyText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, carrierCompanyText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" /></div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">地址</label>
                <div className="flex items-center gap-2">
                  <input value={editState.addressText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, addressText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editState.addressText || "")}`} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" title="Google Maps"><MapPinIcon /></a>
                </div>
              </div>
              {saveError ? <div className="md:col-span-2 text-sm text-red-600">{saveError}</div> : null}
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
