"use client";

import { useMemo, useState } from "react";
import { buildProductImageUrl } from "@/lib/product-image-url";

type ProductThumbProps = {
  sku?: string | null;
  size?: number;
};

function normalizeSku(sku?: string | null) {
  return String(sku || "").trim();
}

export function ProductThumb({ sku, size = 56 }: ProductThumbProps) {
  const [failed, setFailed] = useState(false);
  const normalizedSku = useMemo(() => normalizeSku(sku), [sku]);
  const src = normalizedSku ? buildProductImageUrl(normalizedSku, "jpg") : "";

  if (!normalizedSku || failed) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-400"
        style={{ width: size, height: size }}
      >
        {"\u65e0\u56fe"}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-md border border-slate-200 bg-slate-50"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={normalizedSku}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
