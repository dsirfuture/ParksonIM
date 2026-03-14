"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ReceiptRow = {
  id: string;
  receiptNo: string;
  supplierName: string | null;
  totalItems: number;
  expectedQty: number;
  completedItems: number;
  progressPercent: number;
  status: string;
  statusLabel: string;
  statusClassName: string;
  uploadedAtText: string;
};

type ReceiptsTableClientProps = {
  text: {
    listTitle: string;
    listDesc: string;
    rows: string;
    searchPlaceholder: string;
    receiptNo: string;
    supplier: string;
    skuCount: string;
    expectedQty: string;
    progressCol: string;
    status: string;
    uploadedAt: string;
    noSupplier: string;
    view: string;
    scan: string;
    emptySearch: string;
    previousPage: string;
    nextPage: string;
    delete?: string;
    deleteConfirm?: string;
    deleteFailed?: string;
  };
  rows: ReceiptRow[];
};

const PAGE_SIZE = 8;

function EyeIcon() {
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
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ScanIcon() {
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
      <path d="M4 7V5a1 1 0 0 1 1-1h2" />
      <path d="M17 4h2a1 1 0 0 1 1 1v2" />
      <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M7 8h10" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function ReceiptsTableClient({ text, rows }: ReceiptsTableClientProps) {
  const deleteText = text.delete || "删除";
  const deleteConfirmText = text.deleteConfirm || "确认删除这条验货单？";
  const deleteFailedText = text.deleteFailed || "删除失败，请重试";
  const [localRows, setLocalRows] = useState(rows);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    if (!value) return localRows;

    return localRows.filter((row) => {
      const source = [
        row.receiptNo,
        row.supplierName || "",
        row.uploadedAtText,
        row.statusLabel,
      ]
        .join(" ")
        .toLowerCase();

      return source.includes(value);
    });
  }, [keyword, localRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  function handleKeywordChange(value: string) {
    setKeyword(value);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  }

  async function handleDelete(id: string) {
    if (!confirm(deleteConfirmText)) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      setLocalRows((prev) => prev.filter((row) => row.id !== id));
    } catch {
      alert(deleteFailedText);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-xl bg-white shadow-soft">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 shrink-0">
            <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4">
              <h2 className="shrink-0 whitespace-nowrap text-[18px] font-bold tracking-tight text-slate-900">
                {text.listTitle}
              </h2>
              <p className="min-w-0 whitespace-nowrap text-sm leading-6 text-slate-500">
                {text.listDesc}
              </p>
            </div>
          </div>

          <div className="w-full max-w-[420px] xl:flex-1 xl:px-4">
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

          <div className="shrink-0 whitespace-nowrap text-sm text-slate-400">
            {filteredRows.length} {text.rows}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50 text-left text-sm text-slate-500">
              <th className="whitespace-nowrap px-4 py-3 font-semibold">
                {text.receiptNo}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">
                {text.supplier}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">
                {text.skuCount}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">
                {text.expectedQty}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">
                {text.progressCol}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">
                {text.status}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">
                {text.uploadedAt}
              </th>
              <th className="px-4 py-3 text-right font-semibold"></th>
            </tr>
          </thead>

          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  {text.emptySearch}
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => {
                const progress = Math.max(
                  0,
                  Math.min(100, Math.round(row.progressPercent || 0)),
                );

                return (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 transition hover:bg-secondary-accent/30"
                  >
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-slate-700">
                      {row.receiptNo}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-slate-700">
                      {row.supplierName || text.noSupplier}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-slate-700">
                      {row.totalItems}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-slate-700">
                      {row.expectedQty}
                    </td>

                    <td className="px-4 py-3 align-middle">
                      <div className="flex min-w-[140px] items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="w-10 whitespace-nowrap text-sm font-semibold text-slate-700">
                          {progress}%
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${row.statusClassName}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-slate-700">
                      {row.uploadedAtText}
                    </td>

                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/receipts/${row.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-800"
                          title={text.view}
                          aria-label={text.view}
                        >
                          <EyeIcon />
                        </Link>

                        <Link
                          href={`/receipts/${row.id}/scan`}
                          className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-800"
                          title={text.scan}
                          aria-label={text.scan}
                        >
                          <ScanIcon />
                        </Link>

                        <button
                          type="button"
                          onClick={() => void handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="inline-flex h-8 w-8 items-center justify-center text-rose-500 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title={deleteText}
                          aria-label={deleteText}
                        >
                          <TrashIcon />
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

      {filteredRows.length > 0 ? (
        <div className="border-t border-slate-200 px-5 py-4">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text.previousPage}
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
              {text.nextPage}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
