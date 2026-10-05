import path from "node:path";
import { findLocalProductImageFileName } from "@/lib/local-product-image";
import { normalizeProductCode } from "@/lib/product-code";
import { listR2ObjectKeys } from "@/lib/r2-upload";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const CACHE_TTL_MS = 10 * 60 * 1000;

type ImageKeyCache = {
  expiresAt: number;
  keys: Set<string>;
};

let imageKeyCache: ImageKeyCache | null = null;
let imageKeyCachePromise: Promise<Set<string>> | null = null;

function normalizeImageKey(value: string) {
  return String(value || "").trim();
}

function buildImageKeyCandidates(raw: string) {
  const normalized = normalizeImageKey(raw);
  const candidates = new Set<string>();
  if (!normalized) return [];

  candidates.add(normalized);
  candidates.add(normalized.toUpperCase());
  candidates.add(normalized.toLowerCase());

  const hyphenIndex = normalized.indexOf("-");
  if (hyphenIndex > 0) {
    const prefix = normalized.slice(0, hyphenIndex);
    const suffix = normalized.slice(hyphenIndex);
    const titlePrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
    candidates.add(`${titlePrefix}${suffix}`);
  }

  return Array.from(candidates);
}

function hasLocalImageForKey(raw: string) {
  const normalized = normalizeImageKey(raw);
  if (!normalized) return false;
  for (const ext of IMAGE_EXTS) {
    if (findLocalProductImageFileName(normalized, ext)) return true;
  }
  return false;
}

async function loadRemoteImageKeySet() {
  const now = Date.now();
  if (imageKeyCache && imageKeyCache.expiresAt > now) {
    return imageKeyCache.keys;
  }

  if (!imageKeyCachePromise) {
    imageKeyCachePromise = (async () => {
      const objectKeys = await listR2ObjectKeys();
      const normalizedKeys = new Set<string>();

      for (const objectKey of objectKeys) {
        const parsed = path.parse(String(objectKey || "").trim());
        const ext = parsed.ext.replace(/^\./, "").toLowerCase();
        if (!parsed.name || !IMAGE_EXTS.has(ext)) continue;
        normalizedKeys.add(normalizeProductCode(parsed.name));
      }

      imageKeyCache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        keys: normalizedKeys,
      };
      imageKeyCachePromise = null;
      return normalizedKeys;
    })().catch((error) => {
      imageKeyCachePromise = null;
      throw error;
    });
  }

  return imageKeyCachePromise;
}

export async function hasProductImageByKeys(keys: Array<string | null | undefined>) {
  const candidates = keys
    .flatMap((value) => buildImageKeyCandidates(String(value || "")))
    .map((value) => normalizeProductCode(value))
    .filter(Boolean);

  if (candidates.length === 0) return false;

  for (const candidate of candidates) {
    if (hasLocalImageForKey(candidate)) return true;
  }

  try {
    const remoteKeys = await loadRemoteImageKeySet();
    for (const candidate of candidates) {
      if (remoteKeys.has(candidate)) return true;
    }
  } catch {
    return false;
  }

  return false;
}
