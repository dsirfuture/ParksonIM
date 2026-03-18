const PRODUCT_IMAGE_BASE_URL = (process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const HAS_REMOTE_PRODUCT_IMAGE_BASE = Boolean(PRODUCT_IMAGE_BASE_URL);

function normalizeImageKey(value: string) {
  return String(value || "").trim();
}

export function buildProductImageUrl(key: string, ext = "jpg") {
  const raw = normalizeImageKey(key);
  if (!raw) return "";
  if (PRODUCT_IMAGE_BASE_URL) {
    const encoded = encodeURIComponent(raw);
    const file = `${encoded}.${ext}`;
    return `${PRODUCT_IMAGE_BASE_URL}/${file}`;
  }
  return `/api/product-image/${encodeURIComponent(raw)}?ext=${encodeURIComponent(ext)}`;
}

export function buildProductImageUrls(key: string, exts: string[]) {
  const raw = normalizeImageKey(key);
  if (!raw) return [];
  const candidates = Array.from(
    new Set([raw, raw.toUpperCase(), raw.toLowerCase()].filter(Boolean)),
  );
  return candidates.flatMap((candidate) => exts.map((ext) => buildProductImageUrl(candidate, ext)));
}
