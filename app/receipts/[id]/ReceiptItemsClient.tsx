"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { ImageLightbox } from "@/components/image-lightbox";
import { buildProductImageUrl } from "@/lib/product-image-url";

type ItemStatus = "pending" | "in_progress" | "completed";

type ItemRow = {
  id: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number | null;
  expectedQty: number | null;
  goodQty: number;
  diffQty: number;
  uncheckedQty: number;
  damagedQty: number;
  excessQty: number;
  status: ItemStatus;
  unexpected?: boolean;
  unitPriceValue: number | null;
  yogoPriceValue: number | null;
  normalDiscountValue: number | null;
  vipDiscountValue: number | null;
  unitPriceText: string;
  yogoPriceText: string;
  priceCompareStatus: "same" | "different" | "unknown";
  priceCompareText: string;
};

type ReceiptItemsClientProps = {
  title: string;
  currencyHint: string;
  rows: ItemRow[];
  text: {
    image: string;
    sku: string;
    barcode: string;
    nameZh: string;
    nameEs: string;
    casePack: string;
    expectedQty: string;
    goodQty: string;
    diffQty: string;
    uncheckedQty: string;
    damagedQty: string;
    excessQty: string;
    status: string;
    pending: string;
    inProgress: string;
    completed: string;
    unitPrice: string;
    yogoPrice: string;
    priceCompare: string;
    same: string;
    different: string;
    normalDiscount: string;
    vipDiscount: string;
    lineTotal: string;
    noValue: string;
    imagePreviewTitle: string;
    searchPlaceholder: string;
    noMatch: string;
    previousPage: string;
    nextPage: string;
    edit: string;
    editTitle: string;
    cancel: string;
    save: string;
    saving: string;
    saveSuccess: string;
    saveFailed: string;
    emptyImage: string;
    newTag: string;
  };
};

type LightboxState = {
  open: boolean;
  src: string;
  alt: string;
  title: string;
};

type EditFormState = {
  sku: string;
  barcode: string;
  casePack: string;
  nameZh: string;
  nameEs: string;
  expectedQty: string;
  normalDiscount: string;
  vipDiscount: string;
  unitPrice: string;
};

const PAGE_SIZE = 8;

function PencilIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function getStatusLabel(
  status: ItemStatus,
  text: ReceiptItemsClientProps["text"],
) {
  if (status === "completed") return text.completed;
  if (status === "in_progress") return text.inProgress;
  return text.pending;
}

function getStatusClassName(status: ItemStatus) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }

  if (status === "in_progress") {
    return "bg-secondary-accent/70 text-secondary-deep ring-1 ring-inset ring-secondary-accent";
  }

  return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";
}

export function ReceiptItemsClient({
  title,
  currencyHint,
  rows,
  text,
}: ReceiptItemsClientProps) {
  const [items, setItems] = useState<ItemRow[]>(rows);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<EditFormState>({
    sku: "",
    barcode: "",
    casePack: "",
    nameZh: "",
    nameEs: "",
    expectedQty: "",
    normalDiscount: "",
    vipDiscount: "",
    unitPrice: "",
  });
  const [lightbox, setLightbox] = useState<LightboxState>({
    open: false,
    src: "",
    alt: "",
    title: "",
  });

  useEffect(() => {
    setItems(rows);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    if (!value) return items;

    return items.filter((row) => {
      const source = [row.sku, row.barcode, row.nameZh, row.nameEs]
        .join(" ")
        .toLowerCase();

      return source.includes(value);
    });
  }, [keyword, items]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  function openImage(sku: string, titleText: string) {
    if (!sku) return;

    setLightbox({
      open: true,
      src: buildProductImageUrl(sku, "jpg"),
      alt: titleText || sku,
      title: `${text.imagePreviewTitle} · ${sku}`,
    });
  }

  function closeImage() {
    setLightbox({
      open: false,
      src: "",
      alt: "",
      title: "",
    });
  }

  function handleKeywordChange(value: string) {
    setKeyword(value);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  }

  function beginEdit(item: ItemRow) {
    setEditingItemId(item.id);
    setForm({
      sku: item.sku ?? "",
      barcode: item.barcode ?? "",
      casePack: item.casePack === null ? "" : String(item.casePack),
      nameZh: item.nameZh ?? "",
      nameEs: item.nameEs ?? "",
      expectedQty: item.expectedQty === null ? "" : String(item.expectedQty),
      normalDiscount:
        item.normalDiscountValue === null
          ? ""
          : String(item.normalDiscountValue),
      vipDiscount:
        item.vipDiscountValue === null ? "" : String(item.vipDiscountValue),
      unitPrice:
        item.unitPriceValue === null ? "" : String(item.unitPriceValue),
    });
  }

  function closeEdit() {
    setEditingItemId(null);
    setForm({
      sku: "",
      barcode: "",
      casePack: "",
      nameZh: "",
      nameEs: "",
      expectedQty: "",
      normalDiscount: "",
      vipDiscount: "",
      unitPrice: "",
    });
  }

  async function saveEdit() {
    if (!editingItemId) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/receipts/items/${editingItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku: form.sku,
          barcode: form.barcode,
          casePack: form.casePack,
          nameZh: form.nameZh,
          nameEs: form.nameEs,
          expectedQty: form.expectedQty,
          normalDiscount: form.normalDiscount,
          vipDiscount: form.vipDiscount,
          unitPrice: form.unitPrice,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || text.saveFailed);
      }

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== result.item.id) return item;

          const nextSku = result.item?.sku ?? item.sku;
          const skuChanged =
            String(nextSku || "").trim().toUpperCase() !==
            String(item.sku || "").trim().toUpperCase();

          // Keep existing YOGO price for same SKU so editing import price won't wipe it.
          const nextYogoPriceValue = skuChanged ? null : item.yogoPriceValue;
          const nextYogoPriceText = skuChanged
            ? text.noValue
            : item.yogoPriceText || text.noValue;

          const nextUnitPriceValue =
            typeof result.item?.unitPriceValue === "number"
              ? result.item.unitPriceValue
              : item.unitPriceValue;
          const hasComparablePrice =
            nextUnitPriceValue !== null && nextYogoPriceValue !== null;
          const priceCompareStatus: "same" | "different" | "unknown" =
            !hasComparablePrice
              ? "unknown"
              : Math.abs(nextUnitPriceValue - nextYogoPriceValue) < 0.0001
                ? "same"
                : "different";
          const priceCompareText =
            priceCompareStatus === "same"
              ? text.same
              : priceCompareStatus === "different"
                ? text.different
                : text.noValue;

          return {
            ...item,
            sku: result.item?.sku ?? item.sku,
            barcode: result.item?.barcode ?? item.barcode,
            nameZh: result.item?.nameZh ?? item.nameZh,
            nameEs: result.item?.nameEs ?? item.nameEs,
            casePack:
              result.item?.casePack === undefined
                ? item.casePack
                : result.item.casePack,
            expectedQty:
              result.item?.expectedQty === undefined
                ? item.expectedQty
                : result.item.expectedQty,
            unitPriceValue: nextUnitPriceValue,
            unitPriceText: result.item?.unitPriceText ?? item.unitPriceText,
            normalDiscountValue:
              result.item?.normalDiscountValue ?? item.normalDiscountValue,
            vipDiscountValue:
              result.item?.vipDiscountValue ?? item.vipDiscountValue,
            yogoPriceValue: nextYogoPriceValue,
            yogoPriceText: nextYogoPriceText,
            priceCompareStatus,
            priceCompareText,
            // Keep scan-derived fields unchanged after editing product/base fields.
            goodQty: item.goodQty,
            diffQty: item.diffQty,
            uncheckedQty: item.uncheckedQty,
            damagedQty: item.damagedQty,
            excessQty: item.excessQty,
            status: item.status,
            unexpected: item.unexpected,
          };
        }),
      );

      closeEdit();
      window.alert(text.saveSuccess);
    } catch (error) {
      const message = error instanceof Error ? error.message : text.saveFailed;
      window.alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl bg-white shadow-soft">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="whitespace-nowrap text-[18px] font-bold tracking-tight text-slate-900">
                {title}
              </div>
              <div className="mt-1 text-sm text-slate-500">{currencyHint}</div>
            </div>

            <div className="w-full max-w-[420px] xl:w-[420px]">
              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4">
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
                  onChange={(e) => handleKeywordChange(e.target.value)}
                  placeholder={text.searchPlaceholder}
                  className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[64px]" />
              <col className="w-[90px]" />
              <col className="w-[110px]" />
              <col className="w-[200px]" />
              <col className="w-[200px]" />
              <col className="w-[50px]" />
              <col className="w-[50px]" />
              <col className="w-[72px]" />
              <col className="w-[72px]" />
              <col className="w-[72px]" />
              <col className="w-[45px]" />
              <col className="w-[45px]" />
              <col className="w-[45px]" />
              <col className="w-[45px]" />
              <col className="w-[45px]" />
              <col className="w-[84px]" />
              <col className="w-[40px]" />
            </colgroup>

            <thead>
              <tr className="bg-slate-50 text-left text-sm text-slate-500">
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.image}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.sku}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.barcode}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.nameZh}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.nameEs}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.casePack}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.expectedQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.unitPrice}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.yogoPrice}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.priceCompare}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.goodQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.diffQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.uncheckedQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.damagedQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.excessQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.status}
                </th>
                <th className="px-2 py-3 font-semibold" />
              </tr>
            </thead>

            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={17}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    {text.noMatch}
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const imageAlt =
                    row.nameZh || row.nameEs || row.sku || text.noValue;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 transition hover:bg-secondary-accent/30"
                    >
                      <td className="px-2 py-3 align-middle">
                        {row.unexpected ? (
                          <div className="flex h-[44px] w-[44px] items-center justify-center text-xs text-slate-400">
                            {text.emptyImage}
                          </div>
                        ) : (
                          <ProductImage
                            sku={row.sku}
                            alt={imageAlt}
                            size={44}
                            roundedClassName="rounded-lg"
                            onClick={() => openImage(row.sku, imageAlt)}
                          />
                        )}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{row.sku || text.noValue}</span>
                          {row.unexpected ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
                              {text.newTag}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.barcode || text.noValue}
                      </td>

                      <td className="truncate px-2 py-3 text-sm text-slate-700">
                        {row.nameZh || text.noValue}
                      </td>

                      <td className="truncate px-2 py-3 text-sm text-slate-700">
                        {row.nameEs || text.noValue}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.casePack ?? 0}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.expectedQty ?? 0}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.unitPriceText || text.noValue}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.yogoPriceText || text.noValue}
                      </td>

                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          row.priceCompareStatus === "same"
                            ? "text-emerald-600"
                            : row.priceCompareStatus === "different"
                              ? "text-rose-600"
                              : "text-slate-700"
                        }`}
                      >
                        {row.priceCompareText || text.noValue}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.goodQty}
                      </td>

                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          row.diffQty > 0 ? "text-rose-600" : "text-slate-700"
                        }`}
                      >
                        {row.diffQty}
                      </td>

                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          row.uncheckedQty > 0
                            ? "text-rose-600"
                            : "text-slate-700"
                        }`}
                      >
                        {row.uncheckedQty}
                      </td>

                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          row.damagedQty > 0
                            ? "text-rose-600"
                            : "text-slate-700"
                        }`}
                      >
                        {row.damagedQty}
                      </td>

                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          row.excessQty > 0 ? "text-rose-600" : "text-slate-700"
                        }`}
                      >
                        {row.excessQty}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                            row.status,
                          )}`}
                        >
                          {getStatusLabel(row.status, text)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap py-3 pl-1 pr-0 text-left text-sm">
                        <button
                          type="button"
                          onClick={() => beginEdit(row)}
                          title={text.edit}
                          aria-label={text.edit}
                          className="inline-flex -translate-x-1 items-center justify-center text-slate-500 transition hover:text-slate-900"
                        >
                          <PencilIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {text.previousPage}
          </button>

          <div className="inline-flex h-9 min-w-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            {currentPage}
          </div>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {text.nextPage}
          </button>
        </div>
      </section>

      {editingItemId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[720px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {text.editTitle}
              </h3>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.sku}
                </div>
                <input
                  value={form.sku}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sku: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.barcode}
                </div>
                <input
                  value={form.barcode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      barcode: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.casePack}
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.casePack}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      casePack: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.expectedQty}
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.expectedQty}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      expectedQty: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.nameZh}
                </div>
                <input
                  value={form.nameZh}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      nameZh: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.nameEs}
                </div>
                <input
                  value={form.nameEs}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      nameEs: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.normalDiscount}
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={form.normalDiscount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      normalDiscount: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.vipDiscount}
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={form.vipDiscount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      vipDiscount: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block md:col-span-2">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.unitPrice}
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      unitPrice: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>

              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        title={lightbox.title}
        onClose={closeImage}
      />
    </>
  );
}
