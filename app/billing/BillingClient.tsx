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
};

const PAGE_SIZE = 8;

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

function toMoney(value: number) {
  return value.toFixed(2);
}

function toPercentText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const percent = value <= 1 ? value * 100 : value;
  const rounded = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/\.?0+$/, "");
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

  const theme =
    currentTab === "supplier"
      ? {
          panel: "border-slate-200 bg-white",
          tabActive: "border-amber-300 bg-amber-100 text-amber-900",
          tabInactive: "border-transparent bg-slate-200 text-slate-600",
          accentValue: "text-amber-700",
          contentBg: "bg-amber-50/35",
        }
      : {
          panel: "border-slate-200 bg-white",
          tabActive: "border-sky-300 bg-sky-100 text-sky-900",
          tabInactive: "border-transparent bg-slate-200 text-slate-600",
          accentValue: "text-sky-700",
          contentBg: "bg-sky-50/35",
        };

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  );

  const detailItems = useMemo(
    () => (detailOrderNo ? detailsByOrderNo[detailOrderNo] || [] : []),
    [detailOrderNo, detailsByOrderNo],
  );
  const detailTotal = useMemo(
    () => detailItems.reduce((sum, item) => sum + calcLineTotal(item, vipDiscountEnabled), 0),
    [detailItems, vipDiscountEnabled],
  );
  const exportLinks = useMemo(() => {
    if (!detailOrderNo) return null;
    const encodedOrderNo = encodeURIComponent(detailOrderNo);
    const vipQuery = vipDiscountEnabled ? "vip=1" : "vip=0";
    return {
      xlsx: `/api/billing/${encodedOrderNo}/export/xlsx?${vipQuery}`,
      pdf: `/api/billing/${encodedOrderNo}/export/pdf?${vipQuery}`,
    };
  }, [detailOrderNo, vipDiscountEnabled]);

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
        }),
      });
      const result = await res.json();
      if (!res.ok || !result?.ok) {
        throw new Error(result?.error || "保存失败");
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === editState.id
            ? {
                ...row,
                companyName: result.data.customerName || row.companyName,
                customerName: result.data.customerName || row.customerName,
                contactName: result.data.contactName || row.contactName,
                contactPhone: result.data.contactText || row.contactPhone,
                addressText: result.data.addressText || row.addressText,
                remarkText: result.data.remarkText || row.remarkText,
                storeLabelText: result.data.storeLabelText || row.storeLabelText,
              }
            : row,
        ),
      );
      setEditState(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`mt-0 overflow-hidden rounded-[30px] border-2 ${theme.panel}`}>
      <div className="px-4 pt-2">
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" onClick={() => setCurrentTab("customer")} className={`inline-flex min-w-[148px] items-center justify-center rounded-t-2xl border px-4 py-2 text-sm font-semibold ${currentTab === "customer" ? theme.tabActive : theme.tabInactive}`}>
            客户出账单
          </button>
          <button type="button" onClick={() => setCurrentTab("supplier")} className={`inline-flex min-w-[148px] items-center justify-center rounded-t-2xl border px-4 py-2 text-sm font-semibold ${currentTab === "supplier" ? theme.tabActive : theme.tabInactive}`}>
            供应商账单
          </button>
        </div>
      </div>

      <div className={`m-2 rounded-2xl p-4 ${theme.contentBg}`}>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="待出账单" value={totalCount} hint="验货完毕待汇总" valueClassName={theme.accentValue} />
          <StatCard label="待生成" value="0" hint="等待生成汇总结果" valueClassName="text-amber-600" />
          <StatCard label="待复核" value="0" hint="等待人工确认或复核" valueClassName="text-blue-600" />
          <StatCard label="可输出" value="0" hint="可下载或分享的账单" valueClassName="text-emerald-600" />
        </section>

        <div className="mt-4">
          <TableCard title="待出账单列表" description={`共 ${totalCount} 条`}>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">账单名称</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">公司名称</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">联系人</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">联系电话</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">配货金额</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">汇总时间</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                        当前没有待出账单记录
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.orderNo} className="border-t border-slate-100 hover:bg-secondary-accent/20">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">{row.orderNo}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.companyName || "-"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.contactName || "-"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.contactPhone || "-"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-800">{row.amountText}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.updatedAtText}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-800"
                              title="查看详情"
                              onClick={() => setDetailOrderNo(row.orderNo)}
                            >
                              <EyeIcon />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-800"
                              title="编辑客户信息"
                              onClick={() =>
                                setEditState({
                                  id: row.id,
                                  orderNo: row.orderNo,
                                  companyName: row.companyName === "-" ? "" : row.companyName,
                                  contactName: row.contactName === "-" ? "" : row.contactName,
                                  contactPhone: row.contactPhone === "-" ? "" : row.contactPhone,
                                  addressText: row.addressText,
                                  remarkText: row.remarkText,
                                  storeLabelText: row.storeLabelText,
                                })
                              }
                            >
                              <PencilIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalCount > 0 ? (
              <div className="border-t border-slate-200 px-5 py-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    首页
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    上一页
                  </button>
                  <span className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    下一页
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    末页
                  </button>
                </div>
              </div>
            ) : null}
          </TableCard>
        </div>
      </div>

      {detailOrderNo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setDetailOrderNo(null)}>
          <div className="max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-sm text-slate-700">
                账单明细：<span className="font-semibold text-slate-900">{detailOrderNo}</span>
                <span className="ml-3 text-slate-500">商品数 {detailItems.length}</span>
                <span className="ml-3 text-slate-500">合计 {toMoney(detailTotal)}</span>
              </div>
              <div className="flex items-center gap-3">
                {exportLinks ? (
                  <>
                    <a
                      href={exportLinks.xlsx}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      导出 XLSX
                    </a>
                    <a
                      href={exportLinks.pdf}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
                    >
                      导出 PDF
                    </a>
                  </>
                ) : null}
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={vipDiscountEnabled}
                    onChange={(e) => setVipDiscountEnabled(e.target.checked)}
                  />
                  启用VIP折扣
                </label>
                <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setDetailOrderNo(null)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">图片</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">编码</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">条形码</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">中文名</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">西文名</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">数量</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">单价</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">普通折扣</th>
                    {vipDiscountEnabled ? <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">VIP折扣</th> : null}
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItems.length === 0 ? (
                    <tr>
                      <td colSpan={vipDiscountEnabled ? 10 : 9} className="px-4 py-8 text-center text-sm text-slate-500">
                        当前账单没有可显示的商品明细
                      </td>
                    </tr>
                  ) : (
                    detailItems.map((item, idx) => (
                      <tr key={`${item.sku}-${item.barcode}-${idx}`} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <ProductImage
                            sku={item.sku}
                            alt={item.nameZh || item.nameEs || item.sku || item.barcode || "商品图片"}
                            size={40}
                            roundedClassName="rounded-md"
                            onClick={() => {
                              const src = buildProductImageUrl(item.sku, "jpg");
                              if (!src) return;
                              const title = item.nameZh || item.nameEs || item.sku || item.barcode || "商品图片";
                              setPreviewImage({ src, alt: title, title });
                            }}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.sku || "-"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{item.barcode || "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.nameZh || "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.nameEs || "-"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">{item.qty}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">{toMoney(item.unitPrice)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">{toPercentText(item.normalDiscount)}</td>
                        {vipDiscountEnabled ? <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">{toPercentText(item.vipDiscount)}</td> : null}
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-800">{toMoney(calcLineTotal(item, vipDiscountEnabled))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        open={Boolean(previewImage)}
        src={previewImage?.src || ""}
        alt={previewImage?.alt}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />

      {editState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setEditState(null)}>
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-slate-900">编辑客户信息</h3>
              <p className="mt-1 text-sm text-slate-500">账单：{editState.orderNo}</p>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">公司名称</label>
                <input value={editState.companyName} onChange={(e) => setEditState((prev) => (prev ? { ...prev, companyName: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">联系人</label>
                <input value={editState.contactName} onChange={(e) => setEditState((prev) => (prev ? { ...prev, contactName: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">联系电话</label>
                <input value={editState.contactPhone} onChange={(e) => setEditState((prev) => (prev ? { ...prev, contactPhone: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">第几门店</label>
                <input value={editState.storeLabelText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, storeLabelText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">地址</label>
                <input value={editState.addressText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, addressText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">备注</label>
                <input value={editState.remarkText} onChange={(e) => setEditState((prev) => (prev ? { ...prev, remarkText: e.target.value } : prev))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary/40" />
              </div>
              {saveError ? <div className="md:col-span-2 text-sm text-red-600">{saveError}</div> : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setEditState(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button type="button" onClick={saveEdit} disabled={saving} className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
