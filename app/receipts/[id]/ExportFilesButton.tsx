"use client";

import { useState } from "react";

type ExportFilesButtonProps = {
  receiptId: string;
  buttonText: string;
  exportExcelText: string;
  exportPdfText: string;
  cancelText?: string;
};

function FileBaseIcon({
  label,
  accentClassName,
}: {
  label: string;
  accentClassName: string;
}) {
  return (
    <div className="relative flex h-16 w-14 items-center justify-center">
      <svg
        viewBox="0 0 48 56"
        className="h-16 w-14 text-slate-300"
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

      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${accentClassName}`}
      >
        {label}
      </div>
    </div>
  );
}

function ExcelIcon() {
  return (
    <FileBaseIcon
      label="XLSX"
      accentClassName="bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
    />
  );
}

function PdfIcon() {
  return (
    <FileBaseIcon
      label="PDF"
      accentClassName="bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
    />
  );
}

export function ExportFilesButton({
  receiptId,
  buttonText,
  exportExcelText,
  exportPdfText,
  cancelText = "Cerrar",
}: ExportFilesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {buttonText}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {buttonText}
              </h3>
            </div>

            <div className="px-5 py-6">
              <div className="grid grid-cols-2 gap-5">
                <a
                  href={`/api/receipts/${receiptId}/export/xlsx`}
                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  <ExcelIcon />
                  <div className="mt-3 text-sm font-semibold text-slate-700">
                    {exportExcelText}
                  </div>
                </a>

                <a
                  href={`/api/receipts/${receiptId}/export/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-6 transition hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  <PdfIcon />
                  <div className="mt-3 text-sm font-semibold text-slate-700">
                    {exportPdfText}
                  </div>
                </a>
              </div>
            </div>

            <div className="flex justify-end px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {cancelText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
