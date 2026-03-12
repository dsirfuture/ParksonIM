"use client";

import { useMemo, useState } from "react";
import { buildProductImageUrl } from "@/lib/product-image-url";

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
  const [failed, setFailed] = useState(false);

  const normalizedSku = useMemo(() => normalizeSku(sku), [sku]);
  const src = normalizedSku ? buildProductImageUrl(normalizedSku, "jpg") : "";

  const placeholder = (
    <div
      className={`flex items-center justify-center border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400 ${roundedClassName} ${className}`}
      style={{ width: size, height: size }}
    >
      N/A
    </div>
  );

  if (!normalizedSku || failed || !hasImage) {
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
        src={src}
        alt={alt || normalizedSku}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </button>
  );
}
