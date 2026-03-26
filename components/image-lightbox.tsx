"use client";

import { useEffect, useMemo, useState } from "react";

type ImageLightboxProps = {
  open: boolean;
  src: string;
  fallbackSources?: string[];
  alt?: string;
  title?: string;
  overlayClassName?: string;
  onClose: () => void;
};

export function ImageLightbox({
  open,
  src,
  fallbackSources = [],
  alt,
  title,
  overlayClassName,
  onClose,
}: ImageLightboxProps) {
  const [rotation, setRotation] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const sources = useMemo(() => {
    const seen = new Set<string>();
    return [src, ...fallbackSources]
      .map((item) => String(item || "").trim())
      .filter((item) => {
        if (!item || seen.has(item)) return false;
        seen.add(item);
        return true;
      });
  }, [src, fallbackSources]);

  const activeSrc = sources[activeIndex] || "";

  useEffect(() => {
    setActiveIndex(0);
  }, [src, fallbackSources]);

  useEffect(() => {
    if (!open) return;
    setRotation(0);
  }, [open, src]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-slate-950/70 px-4 ${overlayClassName || "z-[60]"}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[920px] overflow-hidden bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {title || alt || "图片预览"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRotation((prev) => prev - 90)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              向左旋转
            </button>
            <button
              type="button"
              onClick={() => setRotation((prev) => prev + 90)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              向右旋转
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              关闭
            </button>
          </div>
        </div>

        <div
          className="flex max-h-[78vh] cursor-zoom-out items-center justify-center bg-slate-100 p-4"
          onClick={onClose}
        >
          {activeSrc ? (
            <img
              src={activeSrc}
              alt={alt || title || "preview"}
              className="max-h-[72vh] w-auto max-w-full cursor-zoom-out object-contain transition-transform duration-150"
              style={{ transform: `rotate(${rotation}deg)` }}
              onError={() => {
                if (activeIndex < sources.length - 1) {
                  setActiveIndex((prev) => prev + 1);
                }
              }}
            />
          ) : (
            <div className="flex h-[320px] w-full items-center justify-center text-sm text-slate-400">
              图片打不开
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
