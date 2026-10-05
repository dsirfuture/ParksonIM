"use client";

import { useEffect, useMemo, useState } from "react";
import { buildProductImageUrls, HAS_REMOTE_PRODUCT_IMAGE_BASE } from "@/lib/product-image-url";

type ProductImageProps = {
  sku?: string | null;
  src?: string | null;
  hasImage?: boolean;
  alt?: string;
  size?: number;
  className?: string;
  imageClassName?: string;
  roundedClassName?: string;
  frameClassName?: string;
  placeholderClassName?: string;
  fill?: boolean;
  onClick?: () => void;
};

function normalizeSku(sku?: string | null) {
  return String(sku || "").trim();
}

export function ProductImage({
  sku,
  src,
  hasImage = true,
  alt,
  size = 52,
  className = "",
  imageClassName = "h-full w-full object-cover",
  roundedClassName = "rounded-lg",
  frameClassName = "bg-white border border-slate-200",
  placeholderClassName = "bg-slate-50 border border-slate-200",
  fill = false,
  onClick,
}: ProductImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null | undefined>(undefined);

  const normalizedSku = useMemo(() => normalizeSku(sku), [sku]);
  const normalizedSrc = useMemo(() => normalizeSku(src), [src]);
  const sources = useMemo(
    () => {
      const generated = normalizedSku ? buildProductImageUrls(normalizedSku, ["jpg", "jpeg", "png", "webp"]) : [];
      return normalizedSrc ? [normalizedSrc, ...generated] : generated;
    },
    [normalizedSku, normalizedSrc],
  );

  const placeholder = (
    <div
      className={`flex items-center justify-center text-[11px] font-medium text-slate-400 ${fill ? "" : placeholderClassName} ${roundedClassName} ${className}`}
      style={fill ? undefined : { width: size, height: size }}
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

  const imageNode = (
    <img
      src={resolvedSrc}
      alt={alt || normalizedSku}
      width={size}
      height={size}
      className={imageClassName}
      onError={() => setResolvedSrc(null)}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`overflow-hidden ${fill ? "" : frameClassName} ${roundedClassName} ${className}`}
        style={fill ? undefined : { width: size, height: size }}
      >
        {imageNode}
      </button>
    );
  }

  return (
    <div
      className={`overflow-hidden ${fill ? "" : frameClassName} ${roundedClassName} ${className}`}
      style={fill ? undefined : { width: size, height: size }}
    >
      {imageNode}
    </div>
  );
}
