
"use client";

import { useEffect, useMemo, useState } from "react";
import { TableCard } from "@/components/table-card";
import { getClientLang } from "@/lib/lang-client";
import { buildProductImageUrls } from "@/lib/product-image-url";

type SupplierOrderItem = { id: string; location: string; itemNo: string; barcode: string; productName: string; nameCn: string; nameEs: string; normalDiscount: string; vipDiscount: string; totalQty: number; unitPriceText: string; lineTotalText: string; };
type SupplierOrderRow = { id: string; supplierCode: string; derivedOrderNo: string; orderAmountText: string; itemCount: number; noteText: string; items: SupplierOrderItem[]; };
type ImportRow = { id: string; orderNo: string; orderStatus: string; orderDateText: string; orderAmountText: string; companyName: string; customerName: string; contactName: string; contactPhone: string; addressText: string; remarkText: string; storeLabelText: string; createdAtText: string; supplierCount: number; itemCount: number; supplierOrders: SupplierOrderRow[]; };
type EditState = { id: string; customerName: string; addressText: string; contactText: string; remarkText: string; storeLabelText: string; };
type DetailState = { orderNo: string; orderAmountText: string; items: SupplierOrderItem[]; };
type YgOrdersSummary = { totalOrders: number; totalAmountText: string; yearAmountText: string; yearOrders: number; customerCount: number; latestUpdatedAtText: string; };
type YgOrdersClientProps = { initialRows: ImportRow[]; summary: YgOrdersSummary; };

const PREVIEW_PAGE_SIZE = 10;

function normalizeMexicoPhone(value: string) { const d = (value || "").replace(/\D/g, ""); if (d.length < 10) return ""; return `+52${d.slice(-10)}`; }
function extractPhone(contactPhone: string, remarkText: string) { if (contactPhone) return contactPhone; const m = (remarkText || "").match(/\+?\d{8,15}/g); if (!m || m.length === 0) return "-"; return normalizeMexicoPhone(m[0]) || "-"; }

function PreviewProductImage({ itemNo, barcode }: { itemNo: string; barcode: string }) {
  const cacheRef = globalThis as unknown as { __ygImgCache?: Map<string, string | null> };
  if (!cacheRef.__ygImgCache) cacheRef.__ygImgCache = new Map();
  const cache = cacheRef.__ygImgCache;
  const sources = useMemo(() => { const keys = [itemNo, barcode].map((x) => x.trim()).filter(Boolean); const exts = ["jpg", "jpeg", "png", "webp"]; return keys.flatMap((key) => buildProductImageUrls(key, exts)); }, [itemNo, barcode]);
  const cacheKey = useMemo(() => sources.join("|"), [sources]);
  const [src, setSrc] = useState<string | null | undefined>(sources.length === 0 ? null : undefined);
  useEffect(() => {
    if (sources.length === 0) { setSrc(null); return; }
    const cached = cache.get(cacheKey); if (cached !== undefined) { setSrc(cached); return; }
    let cancel = false;
    (async () => {
      for (const u of sources) {
        const ok = await new Promise<boolean>((r) => { const img = new Image(); img.onload = () => r(true); img.onerror = () => r(false); img.src = u; });
        if (ok) { if (!cancel) { cache.set(cacheKey, u); setSrc(u); } return; }
      }
      if (!cancel) { cache.set(cacheKey, null); setSrc(null); }
    })();
    return () => { cancel = true; };
  }, [cache, cacheKey, sources]);
  if (!src) return <span className="text-slate-400">-</span>;
  return <img src={src} alt={itemNo || barcode || "product"} className="h-10 w-10 rounded border border-slate-200 object-contain" onError={() => { cache.set(cacheKey, null); setSrc(null); }} />;
}

function EyeIcon() { return <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8"><path d="M1.75 10s2.75-4.75 8.25-4.75S18.25 10 18.25 10 15.5 14.75 10 14.75 1.75 10 1.75 10Z" /><circle cx="10" cy="10" r="2.25" /></svg>; }
function ChevronIcon({ open }: { open: boolean }) { return <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`} stroke="currentColor" strokeWidth="1.8"><path d="M7 4.75 12.25 10 7 15.25" /></svg>; }
function PencilIcon() { return <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8"><path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" /><path d="M10.75 6.5 13.5 9.25" /><path d="M11.5 3.75 16.25 8.5" /></svg>; }
function FileIcon({ label }: { label: string }) { return <div className="relative flex h-14 w-12 items-center justify-center"><svg viewBox="0 0 48 56" className="h-14 w-12 text-slate-300" fill="none"><path d="M12 4h16l12 12v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2" /><path d="M28 4v10a2 2 0 0 0 2 2h10" stroke="currentColor" strokeWidth="2" /></svg><div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{label}</div></div>; }

export function YgOrdersClient({ initialRows, summary }: YgOrdersClientProps) {
  const [lang, setLang] = useState<"zh" | "es">("zh");
  const tx = (zh: string, es: string) => (lang === "zh" ? zh : es);
  const [rows, setRows] = useState<ImportRow[]>(initialRows);
  const [keyword, setKeyword] = useState("");
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);
  const [detailState, setDetailState] = useState<DetailState | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [exportState, setExportState] = useState<{ importId: string; supplierOrderId: string } | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => { setLang(getClientLang()); }, []);

  function openEdit(row: ImportRow) {
    setEditState({ id: row.id, customerName: row.customerName || "", addressText: row.addressText || "", contactText: row.contactPhone || "", remarkText: row.remarkText || "", storeLabelText: row.storeLabelText || "" });
    setEditError("");
  }
  function updateEditField(field: keyof EditState, value: string) { setEditState((prev) => (prev ? { ...prev, [field]: value } : prev)); }

  async function saveEdit() {
    if (!editState) return;
    try {
      setEditSaving(true); setEditError("");
      const response = await fetch(`/api/yg-orders/${editState.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: editState.customerName.trim(), addressText: editState.addressText.trim(), contactPhone: editState.contactText.trim(), remarkText: editState.remarkText.trim(), storeLabel: editState.storeLabelText.trim() }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || tx("淇濆瓨澶辫触", "Save fail"));
      setRows((prev) => prev.map((row) => row.id === editState.id ? { ...row, customerName: result.data.customerName ?? row.customerName, companyName: result.data.customerName ?? row.companyName, contactName: result.data.customerName ?? row.contactName, contactPhone: result.data.contactText ?? row.contactPhone, addressText: result.data.addressText ?? row.addressText, remarkText: result.data.remarkText ?? row.remarkText, storeLabelText: result.data.storeLabelText ?? row.storeLabelText } : row));
      setEditState(null);
    } catch (e) { setEditError(e instanceof Error ? e.message : tx("淇濆瓨澶辫触", "Save fail")); }
    finally { setEditSaving(false); }
  }

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.orderNo, row.orderStatus, row.orderDateText, row.companyName, row.customerName, row.contactName, row.contactPhone, row.orderAmountText, row.remarkText, row.storeLabelText].join(" ").toLowerCase().includes(q));
  }, [rows, keyword]);

  const previewItems = detailState?.items || [];
  const previewTotalPages = Math.max(1, Math.ceil(previewItems.length / PREVIEW_PAGE_SIZE));
  const pagedPreviewItems = useMemo(() => previewItems.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE), [previewItems, previewPage]);

  return (
    <>
      <div className="grid gap-5">
        <TableCard title="" description="" className="!mt-0">
          <div className="px-5 py-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">总订单数</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.totalOrders.toLocaleString("zh-CN")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">总订单金额</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.totalAmountText}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">年订单额</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.yearAmountText}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">年订单数</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.yearOrders.toLocaleString("zh-CN")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">客户数量</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.customerCount.toLocaleString("zh-CN")}</div>
              </div>
            </div>
          </div>
        </TableCard>

        <TableCard
          title={tx("鍙嬭喘璁㈠崟鍒楄〃", "Pedidos YG")}
          titleRight={
            <span className="text-sm text-slate-500">
              最近一次友购订单更新时间是：{summary.latestUpdatedAtText || "-"}
            </span>
          }
          description=""
          className="!mt-0"
        >
          <div className="space-y-4 px-5 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-slate-500">{tx("Ver resultado", "Ver resultado")}</div>
              <div className="w-full lg:w-[420px]"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={tx("Buscar", "Buscar")} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary/40" /></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1650px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2.5 font-semibold text-slate-700">{tx("璁㈠崟缂栧彿", "No")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("Estado", "Estado")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("璁㈠崟鏃ユ湡", "Fecha")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("鍏徃鍚嶇О", "Empresa")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("Contacto", "Contacto")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("鑱旂郴鐢佃瘽", "Tel")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("璁㈠崟閲戦", "Monto")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("澶囨敞", "Nota")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("鍟嗗搧鏁伴噺", "Items")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("Prov", "Prov")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("绗嚑闂ㄥ簵", "Tienda")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("鎿嶄綔", "Acciones")}</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {filteredRows.length === 0 ? <tr><td colSpan={12} className="px-3 py-10 text-center text-slate-500">{tx("鏆傛棤璁㈠崟鏁版嵁", "Sin datos")}</td></tr> : filteredRows.map((row) => {
                    const expanded = expandedOrderIds.includes(row.id);
                    const allItems = row.supplierOrders.flatMap((s) => s.items);
                    return (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">{row.orderNo}</td><td className="px-3 py-2 text-slate-700">{row.orderStatus || "-"}</td><td className="px-3 py-2 text-slate-700">{row.orderDateText || row.createdAtText}</td><td className="px-3 py-2 text-slate-700">{row.companyName || "-"}</td><td className="px-3 py-2 text-slate-700">{row.contactName || row.customerName || "-"}</td><td className="px-3 py-2 text-slate-700">{extractPhone(row.contactPhone, row.remarkText)}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.orderAmountText}</td><td className="max-w-[220px] truncate px-3 py-2 text-slate-700">{row.remarkText || "-"}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.itemCount}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.supplierCount}</td><td className="px-3 py-2 text-slate-700">{row.storeLabelText || "-"}</td>
                        <td className="px-3 py-2"><div className="flex items-center gap-2"><button type="button" onClick={() => { setDetailState({ orderNo: row.orderNo, orderAmountText: row.orderAmountText, items: allItems }); setPreviewPage(1); }} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"><EyeIcon /></button><button type="button" onClick={() => openEdit(row)} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"><PencilIcon /></button><button type="button" onClick={() => setExpandedOrderIds((prev) => prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id])} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"><ChevronIcon open={expanded} /></button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredRows.map((row) => {
              const expanded = expandedOrderIds.includes(row.id);
              if (!expanded) return null;
              return (
                <section key={`${row.id}-split`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-separate border-spacing-0">
                      <thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("Split", "Split")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("Prov", "Prov")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("璁㈠崟閲戦", "Monto")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("鍟嗗搧鏁伴噺", "Items")}</th><th className="px-3 py-2.5 text-center font-semibold text-slate-700">{tx("棰勮", "Ver")}</th><th className="px-3 py-2.5 text-center font-semibold text-slate-700">{tx("瀵煎嚭鏂囦欢", "Export")}</th></tr></thead>
                      <tbody className="text-[13px]">
                        {row.supplierOrders.map((so) => (
                          <tr key={so.id} className="border-t border-slate-100 bg-white">
                            <td className="px-3 py-2 text-slate-700">{so.derivedOrderNo}</td><td className="px-3 py-2 text-slate-700">{so.supplierCode}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{so.orderAmountText}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{so.itemCount}</td>
                            <td className="px-3 py-2 text-center"><button type="button" onClick={() => { setDetailState({ orderNo: so.derivedOrderNo, orderAmountText: so.orderAmountText, items: so.items }); setPreviewPage(1); }} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"><EyeIcon /></button></td>
                            <td className="px-3 py-2 text-center"><button type="button" onClick={() => setExportState({ importId: row.id, supplierOrderId: so.id })} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">{tx("瀵煎嚭鏂囦欢", "Export")}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        </TableCard>
      </div>

      {detailState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[1240px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-base font-semibold text-slate-900">{tx("璁㈠崟璇︽儏棰勮", "Detalle")}</h3><p className="mt-1 text-sm text-slate-500">{detailState.orderNo}</p></div>
            <div className="space-y-4 px-5 py-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-separate border-spacing-0">
                  <thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("浜у搧鍥剧墖", "Img")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("鍟嗗搧", "Producto")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("Cod", "Cod")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("Ubic", "Ubic")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("CN", "CN")}</th><th className="px-3 py-2.5 font-semibold text-slate-700">{tx("ES", "ES")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("鏁伴噺", "Cant")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("鍗曚环", "Precio")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("Desc", "Desc")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("VIP鎶樻墸", "VIP")}</th><th className="px-3 py-2.5 text-right font-semibold text-slate-700">{tx("琛岄噾棰?/ 灏忚", "Subtotal")}</th></tr></thead>
                  <tbody className="text-[13px]">
                    {pagedPreviewItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2"><PreviewProductImage itemNo={item.itemNo} barcode={item.barcode} /></td><td className="px-3 py-2 text-slate-700">{item.productName || item.itemNo || item.barcode || "-"}</td><td className="px-3 py-2 text-slate-700">{item.barcode || "-"}</td><td className="px-3 py-2 text-slate-700">{item.location || "-"}</td><td className="px-3 py-2 text-slate-700">{item.nameCn || "-"}</td><td className="px-3 py-2 text-slate-700">{item.nameEs || "-"}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.totalQty}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.unitPriceText}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.normalDiscount || "-"}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.vipDiscount || "-"}</td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{item.lineTotalText}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-center gap-2"><button type="button" onClick={() => setPreviewPage((p) => Math.max(1, p - 1))} disabled={previewPage <= 1} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">{tx("Ant", "Ant")}</button><div className="inline-flex h-9 min-w-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">{previewPage} / {previewTotalPages}</div><button type="button" onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))} disabled={previewPage >= previewTotalPages} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">{tx("Sig", "Sig")}</button></div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4"><button type="button" onClick={() => setDetailState(null)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{tx("鍏抽棴", "Cerrar")}</button></div>
          </div>
        </div>
      ) : null}
      {editState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[560px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-base font-semibold text-slate-900">{tx("缂栬緫瀹㈡埛淇℃伅", "Editar cliente")}</h3></div>
            <div className="space-y-4 px-5 py-5">
              <div><label className="text-xs text-slate-500">{tx("瀹㈡埛鍚嶇О", "Cliente")}</label><input value={editState.customerName} onChange={(e) => updateEditField("customerName", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40" /></div>
              <div><label className="text-xs text-slate-500">{tx("鍦板潃", "Direcci贸n")}</label><input value={editState.addressText} onChange={(e) => updateEditField("addressText", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40" /></div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div><label className="text-xs text-slate-500">{tx("鑱旂郴鐢佃瘽", "Tel")}</label><input value={editState.contactText} onChange={(e) => updateEditField("contactText", e.target.value)} placeholder="+52XXXXXXXXXX" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40" /></div>
                <div><label className="text-xs text-slate-500">{tx("澶囨敞", "Nota")}</label><input value={editState.remarkText} onChange={(e) => updateEditField("remarkText", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40" /></div>
                <div><label className="text-xs text-slate-500">{tx("绗嚑闂ㄥ簵", "Tienda")}</label><input value={editState.storeLabelText} onChange={(e) => updateEditField("storeLabelText", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40" /></div>
              </div>
              {editError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{editError}</div> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={() => setEditState(null)} disabled={editSaving} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">{tx("鍙栨秷", "Canc")}</button><button type="button" onClick={() => void saveEdit()} disabled={editSaving} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{editSaving ? tx("淇濆瓨涓?..", "Guard...") : tx("淇濆瓨", "Guardar")}</button></div>
          </div>
        </div>
      ) : null}

      {exportState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[460px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-base font-semibold text-slate-900">{tx("瀵煎嚭鏂囦欢", "Export")}</h3></div>
            <div className="px-5 py-6"><div className="grid grid-cols-3 gap-4">
              <a href={`/api/yg-orders/supplier-orders/${exportState.supplierOrderId}/export/xlsx`} className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50" onClick={() => setExportState(null)}><FileIcon label="XLSX" /><div className="mt-3 text-sm font-semibold text-slate-700">XLSX</div></a>
              <a href={`/api/yg-orders/supplier-orders/${exportState.supplierOrderId}/export/pdf`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50" onClick={() => setExportState(null)}><FileIcon label="PDF" /><div className="mt-3 text-sm font-semibold text-slate-700">PDF</div></a>
              <a href={`/api/yg-orders/${exportState.importId}/export/zip`} className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50" onClick={() => setExportState(null)}><FileIcon label="ZIP" /><div className="mt-3 text-sm font-semibold text-slate-700">{tx("ZIP total", "ZIP total")}</div></a>
            </div></div>
            <div className="flex justify-end px-5 py-4"><button type="button" onClick={() => setExportState(null)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{tx("鍏抽棴", "Cerrar")}</button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}


