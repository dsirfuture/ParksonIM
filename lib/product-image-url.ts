const PRODUCT_IMAGE_BASE_URL = (process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const HAS_REMOTE_PRODUCT_IMAGE_BASE = Boolean(PRODUCT_IMAGE_BASE_URL);

function normalizeImageKey(value: string) {
  return String(value || "").trim();
}

function buildImageKeyCandidates(raw: string) {
  const candidates = new Set<string>();
  if (!raw) return [];

  candidates.add(raw);
  candidates.add(raw.toUpperCase());
  candidates.add(raw.toLowerCase());

  const hyphenIndex = raw.indexOf("-");
  if (hyphenIndex > 0) {
    const prefix = raw.slice(0, hyphenIndex);
    const suffix = raw.slice(hyphenIndex);
    const titlePrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
    candidates.add(`${titlePrefix}${suffix}`);
  }

  return Array.from(candidates).filter(Boolean);
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
  const candidates = buildImageKeyCandidates(raw);
  return candidates.flatMap((candidate) => exts.map((ext) => buildProductImageUrl(candidate, ext)));
}
