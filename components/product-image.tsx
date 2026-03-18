"use client";

import { useEffect, useMemo, useState } from "react";
import { buildProductImageUrls, HAS_REMOTE_PRODUCT_IMAGE_BASE } from "@/lib/product-image-url";

type ProductImageProps = {
  sku?: string | null;
  hasImage?: boolean;
  alt?: string;
  size?: number;
  className?: string;
  roundedClassName?: string;
  onClick?: () => void;
};

function normalizeSku(sku?: string | null) {
  return String(sku || "").trim();
}

export function ProductImage({
  sku,
  hasImage = true,
  alt,
  size = 52,
  className = "",
  roundedClassName = "rounded-lg",
  onClick,
}: ProductImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null | undefined>(undefined);

  const normalizedSku = useMemo(() => normalizeSku(sku), [sku]);
  const sources = useMemo(
    () => (normalizedSku ? buildProductImageUrls(normalizedSku, ["jpg", "jpeg", "png", "webp"]) : []),
    [normalizedSku],
  );

  const placeholder = (
    <div
      className={`flex items-center justify-center border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400 ${roundedClassName} ${className}`}
      style={{ width: size, height: size }}
    >
      空
    </div>
  );

  const shouldTryLoad = hasImage || HAS_REMOTE_PRODUCT_IMAGE_BASE;

  useEffect(() => {
    if (!normalizedSku || !shouldTryLoad || sources.length === 0) {
      setResolvedSrc(null);
      return;
    }

    let canceled = false;
    setResolvedSrc(undefined);

    (async () => {
      for (const url of sources) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });

        if (ok) {
          if (!canceled) setResolvedSrc(url);
          return;
        }
      }

      if (!canceled) setResolvedSrc(null);
    })();

    return () => {
      canceled = true;
    };
  }, [normalizedSku, shouldTryLoad, sources]);

  if (!normalizedSku || resolvedSrc === null || !shouldTryLoad) {
    return placeholder;
  }

  if (!resolvedSrc) {
    return placeholder;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`overflow-hidden border border-slate-200 bg-white ${roundedClassName} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={resolvedSrc}
        alt={alt || normalizedSku}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={() => setResolvedSrc(null)}
      />
    </button>
  );
}
