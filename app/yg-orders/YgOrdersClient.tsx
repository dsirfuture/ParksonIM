"use client";



import { useEffect, useMemo, useRef, useState } from "react";

import { TableCard } from "@/components/table-card";
import { getClientLang } from "@/lib/lang-client";
import { buildProductImageUrls } from "@/lib/product-image-url";



type SupplierOrderItem = {

  id: string;

  location: string;

  itemNo: string;

  barcode: string;

  productName: string;

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

  orderAmountText: string;

  customerName: string;

  contactText: string;

  addressText: string;

  remarkText: string;

  storeLabelText: string;

  createdAtText: string;

  supplierCount: number;

  itemCount: number;

  supplierOrders: SupplierOrderRow[];

};



type YgOrdersClientProps = {

  initialRows: ImportRow[];

};

type EditState = {

  id: string;

  customerName: string;

  addressText: string;

  contactText: string;

  remarkText: string;

  storeLabelText: string;

};

type DeleteState = {
  id: string;
  orderNo: string;
  confirmOrderNo: string;
};

const PREVIEW_PAGE_SIZE = 8;
const ROWS_PAGE_SIZE = 10;



function EyeIcon() {

  return (

    <svg

      viewBox="0 0 20 20"

      fill="none"

      className="h-4 w-4"

      stroke="currentColor"

      strokeWidth="1.8"

    >

      <path d="M1.75 10s2.75-4.75 8.25-4.75S18.25 10 18.25 10 15.5 14.75 10 14.75 1.75 10 1.75 10Z" />

      <circle cx="10" cy="10" r="2.25" />

    </svg>

  );

}



function ChevronIcon({ open }: { open: boolean }) {

  return (

    <svg

      viewBox="0 0 20 20"

      fill="none"

      className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`}

      stroke="currentColor"

      strokeWidth="1.8"

    >

      <path d="M7 4.75 12.25 10 7 15.25" />

    </svg>

  );

}

function PencilIcon() {

  return (

    <svg

      viewBox="0 0 20 20"

      fill="none"

      className="h-4 w-4"

      stroke="currentColor"

      strokeWidth="1.8"

      aria-hidden="true"

    >

      <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" />

      <path d="M10.75 6.5 13.5 9.25" />

      <path d="M11.5 3.75 16.25 8.5" />

    </svg>

  );

}

function TrashIcon() {

  return (

    <svg

      viewBox="0 0 20 20"

      fill="none"

      className="h-4 w-4"

      stroke="currentColor"

      strokeWidth="1.8"

      aria-hidden="true"

    >

      <path d="M4.5 6.25h11" />

      <path d="M7.25 6.25V4.75h5.5v1.5" />

      <path d="M6.5 6.25l.45 8.1a1 1 0 0 0 1 .9h4.1a1 1 0 0 0 1-.9l.45-8.1" />

      <path d="M8.25 9v3.5" />

      <path d="M11.75 9v3.5" />

    </svg>

  );

}



function FileIcon({ label }: { label: string }) {

  return (

    <div className="relative flex h-14 w-12 items-center justify-center">

      <svg

        viewBox="0 0 48 56"

        className="h-14 w-12 text-slate-300"

        fill="none"

        aria-hidden="true"

      >

        <path

          d="M12 4h16l12 12v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"

          stroke="currentColor"

          strokeWidth="2"

        />

        <path

          d="M28 4v10a2 2 0 0 0 2 2h10"

          stroke="currentColor"

          strokeWidth="2"

        />

      </svg>



      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">

        {label}

      </div>

    </div>

  );

}



function formatOrderDateFromOrderNo(orderNo: string) {

  const match = orderNo.match(/^YGO(\d{2})(\d{2})(\d{2})/i);

  if (!match) return "-";



  const [, yy, mm, dd] = match;

  return `20${yy}/${mm}/${dd}`;

}



function buildGoogleMapsUrl(address: string) {

  const query = encodeURIComponent(address);

  return `https://www.google.com/maps/search/?api=1&query=${query}`;

}



function formatMexicoPhone(text: string) {
  if (!text) return "-";

  const digits = text.replace(/\D/g, "");
  if (digits.length < 10) return "-";

  const local10 = digits.slice(-10);
  return `+52${local10}`;
}

function PreviewProductImage({
  itemNo,
  barcode,
}: {
  itemNo: string;
  barcode: string;
}) {
  const cacheRef = (globalThis as unknown as { __ygPreviewImageCache?: Map<string, string | null> });
  if (!cacheRef.__ygPreviewImageCache) {
    cacheRef.__ygPreviewImageCache = new Map<string, string | null>();
  }
  const imageCache = cacheRef.__ygPreviewImageCache;

  const sources = useMemo(() => {
    const keys = [itemNo, barcode].map((item) => item.trim()).filter(Boolean);
    const exts = ["jpg", "jpeg", "png", "webp"];
    return keys.flatMap((key) =>
      buildProductImageUrls(key, exts),
    );
  }, [itemNo, barcode]);

  const cacheKey = useMemo(() => sources.join("|"), [sources]);
  const [resolvedSrc, setResolvedSrc] = useState<string | null | undefined>(
    sources.length === 0 ? null : undefined,
  );

  useEffect(() => {
    if (sources.length === 0) {
      setResolvedSrc(null);
      return;
    }

    const cached = imageCache.get(cacheKey);
    if (cached !== undefined) {
      setResolvedSrc(cached);
      return;
    }

    let cancelled = false;

    async function resolveSource() {
      for (const src of sources) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = src;
        });

        if (ok) {
          if (!cancelled) {
            imageCache.set(cacheKey, src);
            setResolvedSrc(src);
          }
          return;
        }
      }

      if (!cancelled) {
        imageCache.set(cacheKey, null);
        setResolvedSrc(null);
      }
    }

    setResolvedSrc(undefined);
    void resolveSource();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, imageCache, sources]);

  if (!resolvedSrc) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <img
      src={resolvedSrc}
      alt={itemNo || barcode || "product"}
      className="h-10 w-10 rounded border border-slate-200 object-contain"
      onError={() => {
        imageCache.set(cacheKey, null);
        setResolvedSrc(null);
      }}
    />
  );
}

function formatRemarkText(text: string) {
  const raw = (text || "").replace(/[\[\]]/g, "").trim();
  if (!raw) return "-";

  const hasLetters = /[A-Za-z\u00C0-\u024F\u4E00-\u9FFF]/.test(raw);
  if (hasLetters) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) {
    const local10 = digits.slice(-10);
    return `+52${local10}`;
  }

  return raw;
}

function normalizeMexicoPhone(text: string) {
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10) return "";

  const local10 = digits.slice(-10);
  return `+52${local10}`;
}
export function YgOrdersClient({ initialRows }: YgOrdersClientProps) {
  const [lang, setLang] = useState<"zh" | "es">("zh");
  const tx = (zh: string, es: string) => (lang === "zh" ? zh : es);

  const [rows, setRows] = useState<ImportRow[]>(initialRows);

  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");

  const [keyword, setKeyword] = useState("");
  const [visibleRowCount, setVisibleRowCount] = useState(ROWS_PAGE_SIZE);

  const [previewOrder, setPreviewOrder] = useState<SupplierOrderRow | null>(

    null,

  );

  const [previewPage, setPreviewPage] = useState(1);

  const [exportState, setExportState] = useState<{

    importId: string;

    supplierOrderId: string;

  } | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);



  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLang(getClientLang());
  }, []);



  async function handleChooseFile(file: File) {

    try {

      setUploading(true);

      setError("");



      const formData = new FormData();

      formData.append("file", file);



      const response = await fetch("/api/yg-orders/import", {

        method: "POST",

        body: formData,

      });



      const result = await response.json();



      if (!response.ok || !result?.ok) {

        throw new Error(result?.error || tx("导入失败", "Import fail"));

      }



      const newRow = {
        ...(result.data as ImportRow),
        storeLabelText: (result.data?.storeLabelText as string) || "",
      } as ImportRow;



      setRows((prev) => {

        const filtered = prev.filter((item) => item.orderNo !== newRow.orderNo);

        return [newRow, ...filtered];

      });



      setExpandedOrderIds((prev) =>

        prev.includes(newRow.id) ? prev : [newRow.id, ...prev],

      );

    } catch (error) {

      setError(error instanceof Error ? error.message : tx("导入失败", "Import fail"));

    } finally {

      setUploading(false);

      if (fileInputRef.current) {

        fileInputRef.current.value = "";

      }

    }

  }



  function toggleExpanded(id: string) {

    setExpandedOrderIds((prev) =>

      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],

    );

  }

  function openEdit(row: ImportRow) {
    const contactText = formatMexicoPhone(row.contactText);

    setEditState({
      id: row.id,
      customerName: row.customerName || "",
      addressText: row.addressText || "",
      contactText: contactText === "-" ? "" : contactText,
      remarkText: row.remarkText || "",
      storeLabelText: row.storeLabelText || "",
    });
    setEditError("");
  }

  function openDelete(row: ImportRow) {
    setDeleteState({
      id: row.id,
      orderNo: row.orderNo,
      confirmOrderNo: "",
    });
    setDeleteError("");
  }

  function updateDeleteConfirmOrderNo(value: string) {
    setDeleteState((prev) => {
      if (!prev) return prev;
      return { ...prev, confirmOrderNo: value };
    });
  }

  function updateEditField(
    field:
      | "customerName"
      | "addressText"
      | "contactText"
      | "remarkText"
      | "storeLabelText",
    value: string,
  ) {
    setEditState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }

  async function saveEdit() {
    if (!editState) return;

    const nextContactText = normalizeMexicoPhone(editState.contactText);
    const nextRemarkText = editState.remarkText.replace(/[\[\]]/g, "").trim();
    const nextStoreLabelText = editState.storeLabelText.trim();

    try {
      setEditSaving(true);
      setEditError("");

      const response = await fetch(`/api/yg-orders/${editState.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: editState.customerName.trim(),
          addressText: editState.addressText.trim(),
          contactPhone: nextContactText,
          remarkText: nextRemarkText,
          storeLabel: nextStoreLabelText,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || tx("保存失败", "Save fail"));
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === editState.id
            ? {
                ...row,
                customerName: result.data.customerName ?? row.customerName,
                addressText: result.data.addressText ?? row.addressText,
                contactText: result.data.contactText ?? row.contactText,
                remarkText: result.data.remarkText ?? row.remarkText,
                storeLabelText: result.data.storeLabelText ?? row.storeLabelText,
              }
            : row,
        ),
      );

      setEditState(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : tx("保存失败", "Save fail"));
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteOrder() {
    if (!deleteState) return;

    const confirmOrderNo = deleteState.confirmOrderNo.trim();
    if (confirmOrderNo !== deleteState.orderNo) {
      setDeleteError(tx("请输入完整且正确的订单号", "Input full correct order no"));
      return;
    }

    try {
      setDeleteSaving(true);
      setDeleteError("");

      const response = await fetch(`/api/yg-orders/${deleteState.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmOrderNo,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || tx("删除失败", "Delete fail"));
      }

      setRows((prev) => prev.filter((row) => row.id !== deleteState.id));
      setExpandedOrderIds((prev) => prev.filter((id) => id !== deleteState.id));
      setDeleteState(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : tx("删除失败", "Delete fail"));
    } finally {
      setDeleteSaving(false);
    }
  }



  const filteredRows = useMemo(() => {

    const q = keyword.trim().toLowerCase();

    if (!q) return rows;



    return rows.filter((row) => {

      const orderDate = formatOrderDateFromOrderNo(row.orderNo);

      const supplierText = row.supplierOrders

        .map((item) => item.supplierCode)

        .join(" ");

      const searchText = [

        row.orderNo,

        row.customerName,

        supplierText,

        orderDate,

      ]

        .join(" ")

        .toLowerCase();



      return searchText.includes(q);

    });

  }, [rows, keyword]);

  useEffect(() => {
    setVisibleRowCount(ROWS_PAGE_SIZE);
  }, [keyword, rows.length]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleRowCount),
    [filteredRows, visibleRowCount],
  );

  const hasMoreRows = visibleRowCount < filteredRows.length;



  const previewItems = previewOrder?.items ?? [];

  const previewTotalPages = Math.max(

    1,

    Math.ceil(previewItems.length / PREVIEW_PAGE_SIZE),

  );



  const pagedPreviewItems = useMemo(() => {

    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;

    return previewItems.slice(start, start + PREVIEW_PAGE_SIZE);

  }, [previewItems, previewPage]);



  function openPreview(order: SupplierOrderRow) {

    setPreviewOrder(order);

    setPreviewPage(1);

  }



  return (

    <>

      <div className="grid gap-5">

        <TableCard title="" description="" className="!mt-0">

          <div className="space-y-4 px-5 py-5">

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6">

              <div className="flex flex-col items-center justify-center gap-4 text-center lg:flex-row lg:justify-center lg:gap-8">

                <div className="flex min-h-10 items-center justify-center">
                  <div className="text-xs text-slate-500">
                    {tx("接受导入格式 XLS 和 XLSX。", "Acepta XLS/XLSX")}
                  </div>
                </div>



                <div className="shrink-0">

                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-soft transition hover:opacity-95">

                    {uploading ? tx("导入中...", "Import...") : tx("导入友购订单", "Import YG")}

                    <input

                      ref={fileInputRef}

                      type="file"

                      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

                      className="hidden"

                      onChange={(event) => {

                        const file = event.target.files?.[0];

                        if (file) {

                          void handleChooseFile(file);

                        }

                      }}

                    />

                  </label>

                </div>

              </div>

            </div>



            {error ? (

              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">

                {error}

              </div>

            ) : null}

          </div>

        </TableCard>



        <TableCard title={tx("订单导入列表", "Lista imp")} description="" className="!mt-0">

          <div className="space-y-4 px-5 py-5">

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              <div className="text-sm text-slate-500">

                {tx("按导入记录查看拆分结果", "Ver por registro de import")}

              </div>



              <div className="w-full lg:w-[360px]">

                <input

                  value={keyword}

                  onChange={(event) => setKeyword(event.target.value)}

                  placeholder={tx("搜索订单号、供应商、客户名称、订单时间", "Buscar no/prov/cli/fecha")}

                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary/40"

                />

              </div>

            </div>



            {filteredRows.length === 0 ? (

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">

                {tx("当前暂无友购订单导入记录", "Sin importaciones YG")}

              </div>

            ) : (
              <>

              {visibleRows.map((row) => {

                const expanded = expandedOrderIds.includes(row.id);

                const orderDate = formatOrderDateFromOrderNo(row.orderNo);
                const contactPhone = formatMexicoPhone(row.contactText);
                const remarkText = formatRemarkText(row.remarkText);



                return (

                  <section

                    key={row.id}

                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"

                  >

                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-5">

                      <div className="grid gap-x-4 gap-y-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_176px] lg:items-center">

                          <div className="text-sm text-slate-700 whitespace-nowrap">

                            <span className="mr-2 text-xs text-slate-500">{tx("订单号:", "No:")}</span>

                            <span className="text-sm font-semibold text-slate-900">{row.orderNo}</span>

                          </div>



                          <div className="text-sm text-slate-700 whitespace-nowrap">

                            <span className="mr-2 text-xs text-slate-500">{tx("订单金额:", "Monto:")}</span>

                            <span className="text-sm font-semibold text-slate-900">{row.orderAmountText}</span>

                          </div>



                          <div className="text-sm text-slate-700 whitespace-nowrap">

                            <span className="mr-2 text-xs text-slate-500">{tx("供应商数量:", "Prov:")}</span>

                            <span className="text-sm font-semibold text-slate-900">{row.supplierCount}</span>

                          </div>



                          <div className="text-sm text-slate-700 whitespace-nowrap">

                            <span className="mr-2 text-xs text-slate-500">{tx("商品数量:", "Items:")}</span>

                            <span className="text-sm font-semibold text-slate-900">{row.itemCount}</span>

                          </div>



                          <div className="text-sm text-slate-700 whitespace-nowrap">

                            <span className="mr-2 text-xs text-slate-500">{tx("下单时间:", "Fecha:")}</span>

                            <span className="text-sm font-semibold text-slate-900">{orderDate}</span>

                          </div>

                        <div className="flex items-center gap-2 lg:col-start-6 lg:justify-self-end">

                          <button

                            type="button"

                            onClick={() => openDelete(row)}

                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"

                            title={tx("删除", "Del")}

                            aria-label={tx("删除", "Del")}

                          >

                            <TrashIcon />

                          </button>

                          <button

                            type="button"

                            onClick={() => openEdit(row)}

                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"

                            title={tx("编辑", "Edit")}

                            aria-label={tx("编辑", "Edit")}

                          >

                            <PencilIcon />

                          </button>

                          <button

                            type="button"

                            onClick={() => toggleExpanded(row.id)}

                            className="inline-flex h-10 w-24 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

                          >

                            <ChevronIcon open={expanded} />

                            {expanded ? tx("收起", "Ocultar") : tx("展开", "Expandir")}

                          </button>

                      </div>



                      </div>

                      <div className="mt-3 space-y-3">
                        <div className="grid gap-x-4 gap-y-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_176px]">
                          <div className="text-left text-sm text-slate-700 whitespace-nowrap lg:col-start-1">
                            <span className="mr-2 text-xs text-slate-500">{tx("客户名称:", "Cliente:")}</span>
                            <span className="font-medium">
                              {row.customerName || "-"}
                            </span>
                          </div>

                          <div className="text-left text-sm text-slate-700 whitespace-nowrap lg:col-start-2">
                            <span className="mr-2 text-xs text-slate-500">{tx("联系电话:", "Tel:")}</span>
                            <span className="font-medium">
                              {contactPhone}
                            </span>
                          </div>

                          <div className="text-left text-sm text-slate-700 whitespace-nowrap lg:col-start-3">
                            <span className="mr-2 text-xs text-slate-500">{tx("备注:", "Nota:")}</span>
                            <span className="font-medium">
                              {remarkText}
                            </span>
                          </div>

                          <div className="text-left text-sm text-slate-700 whitespace-nowrap lg:col-start-4">
                            <span className="mr-2 text-xs text-slate-500">{tx("第几门店:", "Tda no:")}</span>
                            <span className="font-medium">{row.storeLabelText || "-"}</span>
                          </div>
                        </div>

                        <div className="grid items-center gap-2 overflow-hidden pt-0.5 lg:grid-cols-[repeat(5,minmax(0,1fr))_176px]">
                          <div className="flex min-w-0 items-center gap-2 lg:col-span-5">
                            <span className="text-xs text-slate-500 whitespace-nowrap">{tx("地址:", "Dir:")}</span>
                            {row.addressText ? (
                              <a
                                href={buildGoogleMapsUrl(row.addressText)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
                                title={row.addressText}
                              >
                                <span className="truncate text-slate-700">
                                  {row.addressText}
                                </span>
                                <svg
                                  viewBox="0 0 20 20"
                                  className="h-4 w-4 shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  aria-hidden="true"
                                >
                                  <path d="M10 18s5-4.9 5-9a5 5 0 1 0-10 0c0 4.1 5 9 5 9Z" />
                                  <circle cx="10" cy="9" r="1.8" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-sm text-slate-700">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {expanded ? (

                      <div className="px-5 py-4">



                        <div className="overflow-x-auto">

                          <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-0">

                            <colgroup>

                              <col className="w-[300px]" />

                              <col className="w-[180px]" />

                              <col className="w-[140px]" />

                              <col className="w-[120px]" />

                              <col className="w-[90px]" />

                              <col className="w-[110px]" />

                            </colgroup>



                            <thead>

                              <tr className="bg-slate-50 text-left text-sm text-slate-500">

                                <th className="px-3 py-3 font-semibold">

                                  {tx("拆分订单号", "Sub no")}

                                </th>

                                <th className="px-3 py-3 font-semibold">

                                  {tx("供应商", "Prov")}

                                </th>

                                <th className="px-3 py-3 font-semibold">

                                  {tx("订单金额", "Monto")}

                                </th>

                                <th className="px-3 py-3 font-semibold">

                                  {tx("商品数量", "Items")}

                                </th>

                                <th className="px-3 py-3 font-semibold text-center">

                                  {tx("预览", "Prev")}

                                </th>

                                <th className="px-3 py-3 font-semibold text-center">

                                  {tx("导出文件", "Export")}

                                </th>

                              </tr>

                            </thead>



                            <tbody>

                              {row.supplierOrders.map((item) => (

                                <tr

                                  key={item.id}

                                  className="border-t border-slate-100 transition hover:bg-secondary-accent/30"

                                >

                                  <td className="px-3 py-3 text-sm font-medium text-slate-900">

                                    {item.derivedOrderNo}

                                  </td>

                                  <td className="px-3 py-3 text-sm text-slate-700">

                                    {item.supplierCode}

                                  </td>

                                  <td className="px-3 py-3 text-sm text-slate-700">

                                    {item.orderAmountText}

                                  </td>

                                  <td className="px-3 py-3 text-sm text-slate-700">

                                    {item.itemCount}

                                  </td>

                                  <td className="px-3 py-3 text-center">

                                    <button

                                      type="button"

                                      onClick={() => openPreview(item)}

                                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"

                                      title={tx("预览", "Prev")}

                                      aria-label={tx("预览", "Prev")}

                                    >

                                      <EyeIcon />

                                    </button>

                                  </td>

                                  <td className="px-3 py-3 text-center">

                                    <button

                                      type="button"

                                      onClick={() =>

                                        setExportState({

                                          importId: row.id,

                                          supplierOrderId: item.id,

                                        })

                                      }

                                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

                                    >

                                      {tx("导出文件", "Export")}

                                    </button>

                                  </td>

                                </tr>

                              ))}

                            </tbody>

                          </table>

                        </div>

                      </div>

                    ) : null}

                  </section>

                );

              })}

              {filteredRows.length > ROWS_PAGE_SIZE ? (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleRowCount((prev) =>
                        Math.min(prev + ROWS_PAGE_SIZE, filteredRows.length),
                      )
                    }
                    disabled={!hasMoreRows}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {hasMoreRows ? tx("加载更多", "Mas") : tx("已显示全部", "Todo")}
                  </button>

                  {visibleRowCount > ROWS_PAGE_SIZE ? (
                    <button
                      type="button"
                      onClick={() => setVisibleRowCount(ROWS_PAGE_SIZE)}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {tx("收起", "Ocultar")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              </>
            )}

          </div>

        </TableCard>

      </div>



      {previewOrder ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <div className="w-full max-w-[1120px] rounded-xl bg-white shadow-2xl">

            <div className="border-b border-slate-200 px-5 py-4">

              <h3 className="text-base font-semibold text-slate-900">

                {previewOrder.derivedOrderNo}

              </h3>

            </div>



            <div className="space-y-4 px-5 py-5">

              <div className="grid gap-3 lg:grid-cols-3">

                <div className="text-sm text-slate-700 whitespace-nowrap">
                  <span className="text-xs text-slate-500">{tx("供应商：", "Prov:")}</span>
                  <span className="font-semibold text-slate-900">
                    {previewOrder.supplierCode}
                  </span>
                </div>

                <div className="text-sm text-slate-700 whitespace-nowrap">
                  <span className="text-xs text-slate-500">{tx("订单金额：", "Monto:")}</span>
                  <span className="font-semibold text-slate-900">
                    {previewOrder.orderAmountText}
                  </span>
                </div>

                <div className="text-sm text-slate-700 whitespace-nowrap">
                  <span className="text-xs text-slate-500">{tx("商品数量：", "Items:")}</span>
                  <span className="font-semibold text-slate-900">
                    {previewOrder.itemCount}
                  </span>
                </div>

              </div>



              <div className="overflow-x-hidden">

                <table className="w-full table-fixed border-separate border-spacing-0">

                  <colgroup>

                    <col className="w-[72px]" />

                    <col className="w-[88px]" />

                    <col className="w-[104px]" />

                    <col className="w-[156px]" />

                    <col className="w-[260px]" />

                    <col className="w-[76px]" />

                    <col className="w-[76px]" />

                    <col className="w-[92px]" />

                  </colgroup>



                  <thead>

                    <tr className="bg-slate-50 text-left text-sm text-slate-500">

                      <th className="px-3 py-3 font-semibold">{tx("图片", "Img")}</th>

                      <th className="px-3 py-3 font-semibold">{tx("位置", "Ubic")}</th>

                      <th className="px-3 py-3 font-semibold">{tx("编号", "SKU")}</th>

                      <th className="px-3 py-3 font-semibold">{tx("条形码", "Cod")}</th>

                      <th className="px-3 py-3 font-semibold">{tx("产品名称", "Producto")}</th>

                      <th className="px-3 py-3 font-semibold">{tx("总数量", "Cant")}</th>

                      <th className="px-3 py-3 font-semibold">{tx("价格", "Precio")}</th>

                      <th className="px-3 py-3 font-semibold">{tx("合计", "Total")}</th>

                    </tr>

                  </thead>



                  <tbody>

                    {pagedPreviewItems.map((item) => (

                      <tr key={item.id} className="border-t border-slate-100">

                        <td className="px-3 py-3 text-sm text-slate-700">
                          <PreviewProductImage
                            itemNo={item.itemNo || ""}
                            barcode={item.barcode || ""}
                          />
                        </td>

                        <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {item.location}
                        </td>

                        <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {item.itemNo || "-"}
                        </td>

                        <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {item.barcode || "-"}
                        </td>

                        <td className="px-3 py-3 text-sm text-slate-700">

                          <div className="truncate whitespace-nowrap" title={item.productName || "-"}>
                            {item.productName || "-"}
                          </div>

                        </td>

                        <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {item.totalQty}
                        </td>

                        <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {item.unitPriceText}
                        </td>

                        <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {item.lineTotalText}
                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>



              <div className="flex items-center justify-center gap-2">

                <button

                  type="button"

                  onClick={() =>

                    setPreviewPage((prev) => Math.max(prev - 1, 1))

                  }

                  disabled={previewPage <= 1}

                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"

                >

                  {tx("上一页", "Ant")}

                </button>



                <div className="inline-flex h-9 min-w-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">

                  {previewPage} / {previewTotalPages}

                </div>



                <button

                  type="button"

                  onClick={() =>

                    setPreviewPage((prev) =>

                      Math.min(prev + 1, previewTotalPages),

                    )

                  }

                  disabled={previewPage >= previewTotalPages}

                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"

                >

                  {tx("下一页", "Sig")}

                </button>

              </div>

            </div>



            <div className="flex justify-end border-t border-slate-200 px-5 py-4">

              <button

                type="button"

                onClick={() => setPreviewOrder(null)}

                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"

              >

                {tx("关闭", "Cerrar")}

              </button>

            </div>

          </div>

        </div>

      ) : null}



      {editState ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <div className="w-full max-w-[560px] rounded-xl bg-white shadow-2xl">

            <div className="border-b border-slate-200 px-5 py-4">

              <h3 className="text-base font-semibold text-slate-900">{tx("编辑客户信息", "Editar cliente")}</h3>

            </div>

            <div className="space-y-4 px-5 py-5">

              <div>

                <label className="text-xs text-slate-500">{tx("客户名称", "Cliente")}</label>

                <input

                  value={editState.customerName}

                  onChange={(event) =>

                    updateEditField("customerName", event.target.value)

                  }

                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"

                />

              </div>

              <div>

                <label className="text-xs text-slate-500">{tx("地址", "Dirección")}</label>

                <input

                  value={editState.addressText}

                  onChange={(event) =>

                    updateEditField("addressText", event.target.value)

                  }

                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"

                />

              </div>

              <div className="grid gap-3 lg:grid-cols-3">

                <div>

                  <label className="text-xs text-slate-500">{tx("联系电话", "Tel")}</label>

                  <input

                    value={editState.contactText}

                    onChange={(event) =>

                      updateEditField("contactText", event.target.value)

                    }

                    placeholder="+52XXXXXXXXXX"

                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"

                  />

                </div>

                <div>

                  <label className="text-xs text-slate-500">{tx("备注", "Nota")}</label>

                  <input

                    value={editState.remarkText}

                    onChange={(event) => updateEditField("remarkText", event.target.value)}

                    placeholder={tx("请输入备注", "Ingrese nota")}

                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"

                  />

                </div>

                <div>

                  <label className="text-xs text-slate-500">{tx("第几门店（文字+数字）", "Tda no (texto+num)")}</label>

                  <input

                    value={editState.storeLabelText}

                    onChange={(event) =>

                      updateEditField("storeLabelText", event.target.value)

                    }

                    placeholder={tx("例如：A1门店", "Ej: Tienda A1")}

                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-primary/40"

                  />

                </div>

              </div>

              {editError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {editError}
                </div>
              ) : null}

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">

              <button

                type="button"

                onClick={() => setEditState(null)}
                disabled={editSaving}

                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"

              >

                {tx("取消", "Canc")}

              </button>

              <button

                type="button"

                onClick={() => void saveEdit()}
                disabled={editSaving}

                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"

              >

                {editSaving ? tx("保存中...", "Guard...") : tx("保存", "Guardar")}

              </button>

            </div>

          </div>

        </div>

      ) : null}


      {deleteState ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <div className="w-full max-w-[480px] rounded-xl bg-white shadow-2xl">

            <div className="border-b border-slate-200 px-5 py-4">

              <h3 className="text-base font-semibold text-slate-900">{tx("删除导入订单", "Eliminar import")}</h3>

            </div>

            <div className="space-y-3 px-5 py-5">

              <p className="text-sm text-slate-600">
                {tx("请输入完整订单号以确认删除：", "Ingrese no completo para eliminar:")}
                <span className="ml-1 font-semibold text-slate-900">
                  {deleteState.orderNo}
                </span>
              </p>

              <input
                value={deleteState.confirmOrderNo}
                onChange={(event) =>
                  updateDeleteConfirmOrderNo(event.target.value)
                }
                placeholder={tx("请输入完整订单号", "No completo")}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-rose-300"
              />

              {deleteError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {deleteError}
                </div>
              ) : null}

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">

              <button
                type="button"
                onClick={() => setDeleteState(null)}
                disabled={deleteSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx("取消", "Canc")}
              </button>

              <button
                type="button"
                onClick={() => void deleteOrder()}
                disabled={deleteSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteSaving ? tx("删除中...", "Del...") : tx("确认删除", "Confirmar")}
              </button>

            </div>

          </div>

        </div>

      ) : null}

      {exportState ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <div className="w-full max-w-[460px] rounded-xl bg-white shadow-2xl">

            <div className="border-b border-slate-200 px-5 py-4">

              <h3 className="text-base font-semibold text-slate-900">

                {tx("导出文件", "Export")}

              </h3>

            </div>



            <div className="px-5 py-6">

              <div className="grid grid-cols-3 gap-4">

                <a

                  href={`/api/yg-orders/supplier-orders/${exportState.supplierOrderId}/export/xlsx`}

                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"

                  onClick={() => setExportState(null)}

                >

                  <FileIcon label="XLSX" />

                  <div className="mt-3 text-sm font-semibold text-slate-700">

                    XLSX

                  </div>

                </a>



                <a

                  href={`/api/yg-orders/supplier-orders/${exportState.supplierOrderId}/export/pdf`}

                  target="_blank"

                  rel="noreferrer"

                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"

                  onClick={() => setExportState(null)}

                >

                  <FileIcon label="PDF" />

                  <div className="mt-3 text-sm font-semibold text-slate-700">

                    PDF

                  </div>

                </a>



                <a

                  href={`/api/yg-orders/${exportState.importId}/export/zip`}

                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"

                  onClick={() => setExportState(null)}

                >

                  <FileIcon label="ZIP" />

                  <div className="mt-3 text-sm font-semibold text-slate-700">

                    {tx("全部压缩包", "ZIP total")}

                  </div>

                </a>

              </div>

            </div>



            <div className="flex justify-end px-5 py-4">

              <button

                type="button"

                onClick={() => setExportState(null)}

                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"

              >

                {tx("关闭", "Cerrar")}

              </button>

            </div>

          </div>

        </div>

      ) : null}

    </>

  );

}





