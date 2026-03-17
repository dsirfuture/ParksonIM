import fs from "node:fs";
import path from "node:path";
import { normalizeProductCode } from "@/lib/product-code";

const PRODUCTS_DIR = path.join(process.cwd(), "public", "products");

export function findLocalProductImageFileName(sku: unknown, ext = "jpg") {
  const normalizedSku = normalizeProductCode(sku);
  if (!normalizedSku) return "";
  const normalizedExt = `.${String(ext || "jpg").trim().replace(/^\.+/, "").toLowerCase()}`;

  try {
    const fileNames = fs.readdirSync(PRODUCTS_DIR);
    const matched = fileNames.find((fileName) => {
      const parsed = path.parse(fileName);
      return normalizeProductCode(parsed.name) === normalizedSku && parsed.ext.toLowerCase() === normalizedExt;
    });
    return matched || "";
  } catch {
    return "";
  }
}

export function hasLocalProductImage(sku: unknown, ext = "jpg") {
  return Boolean(findLocalProductImageFileName(sku, ext));
}
