const PRODUCT_IMAGE_BASE_URL = (process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const HAS_REMOTE_PRODUCT_IMAGE_BASE = Boolean(PRODUCT_IMAGE_BASE_URL);

function normalizeKey(value: string) {
  return String(value || "").trim();
}

export function buildProductImageUrl(key: string, ext = "jpg") {
  const normalized = normalizeKey(key);
  if (!normalized) return "";
  const encoded = encodeURIComponent(normalized);
  const file = `${encoded}.${ext}`;
  return PRODUCT_IMAGE_BASE_URL ? `${PRODUCT_IMAGE_BASE_URL}/${file}` : `/products/${file}`;
}

export function buildProductImageUrls(key: string, exts: string[]) {
  const normalized = normalizeKey(key);
  if (!normalized) return [];
  return exts.map((ext) => buildProductImageUrl(normalized, ext));
}
