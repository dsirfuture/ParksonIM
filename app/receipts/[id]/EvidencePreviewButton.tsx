"use client";

import { useEffect, useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";

type EvidenceItem = {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  dataUrl: string;
  createdAt: string;
};

type EvidencePreviewButtonProps = {
  receiptId: string;
  buttonText: string;
  titleText: string;
  emptyText: string;
  closeText: string;
};

export function EvidencePreviewButton({
  receiptId,
  buttonText,
  titleText,
  emptyText,
  closeText,
}: EvidencePreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<{
    open: boolean;
    src: string;
    title: string;
  }>({
    open: false,
    src: "",
    title: "",
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadEvidence() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/receipts/${receiptId}/evidence`, {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || "暂时无法读取证据图片");
        }

        if (!cancelled) {
          setItems(Array.isArray(result.items) ? result.items : []);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error ? error.message : "暂时无法读取证据图片",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvidence();

    return () => {
      cancelled = true;
    };
  }, [open, receiptId]);

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
          <div className="w-full max-w-[960px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {titleText}
              </h3>
            </div>

            <div className="space-y-5 px-5 py-5">
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  Loading...
                </div>
              ) : null}

              {!loading && !error && items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  {emptyText}
                </div>
              ) : null}

              {!loading && items.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((image) => (
                    <div key={image.id} className="overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            open: true,
                            src: image.dataUrl,
                            title: image.fileName,
                          })
                        }
                        className="block w-full text-left"
                      >
                        <img
                          src={image.dataUrl}
                          alt={image.fileName}
                          className="h-44 w-full object-cover"
                        />
                      </button>
                      <div className="px-0 py-2 text-sm text-slate-600">
                        <div className="truncate">{image.fileName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {closeText}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        title={lightbox.title}
        onClose={() =>
          setLightbox({
            open: false,
            src: "",
            title: "",
          })
        }
      />
    </>
  );
}
