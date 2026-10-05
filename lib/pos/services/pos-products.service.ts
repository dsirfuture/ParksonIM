import { getProductByBarcode as getMockProductByBarcode, getProductByClave as getMockProductByClave, listProducts as listMockProducts, searchProducts as searchMockProducts } from "@/lib/pos/mock/pos-products.mock";
import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { type PosProduct, type PosProductSearchInput } from "@/lib/pos/types";

type PosProductServiceOptions = {
  includeYogo?: boolean;
  take?: number;
  category?: string;
};

export type PosPrimaryCategory = {
  categoryZh: string;
  categoryEs: string;
};

async function safeJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function fetchJson<T>(input: RequestInfo | URL): Promise<T> {
  const response = await fetch(input, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await safeJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP_${response.status}`);
  }
  return payload as T;
}

function withStoreId(path: string, storeId?: string, options?: PosProductServiceOptions) {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (storeId) {
    url.searchParams.set("storeId", storeId);
  }
  if (options?.take) {
    url.searchParams.set("take", String(options.take));
  }
  if (options?.category?.trim()) {
    url.searchParams.set("category", options.category.trim());
  }
  if (options?.includeYogo) {
    url.searchParams.set("includeYogo", "1");
  }
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

export async function listPosProductsService(storeId?: string, options?: PosProductServiceOptions): Promise<PosProduct[]> {
  if (getPosDataMode() === "mock") {
    return listMockProducts();
  }
  try {
    const payload = await fetchJson<{ ok: true; items: PosProduct[] }>(withStoreId("/api/pos/products", storeId, options));
    return payload.items || [];
  } catch {
    return listMockProducts();
  }
}

export async function listPosPrimaryCategoriesService(storeId?: string, options?: PosProductServiceOptions): Promise<PosPrimaryCategory[]> {
  if (getPosDataMode() === "mock") {
    return [];
  }
  try {
    const payload = await fetchJson<{ ok: true; items: PosPrimaryCategory[] }>(
      withStoreId("/api/pos/products/categories", storeId, options),
    );
    return payload.items || [];
  } catch {
    return [];
  }
}

export async function searchPosProductsService(input: PosProductSearchInput, storeId?: string, options?: PosProductServiceOptions): Promise<PosProduct[]> {
  if (getPosDataMode() === "mock") {
    return searchMockProducts(input);
  }
  try {
    const barcode = input.barcode?.trim();
    const clave = input.clave?.trim();
    const q = input.name?.trim() || input.q?.trim() || "";

    if (barcode) {
      try {
        const payload = await fetchJson<{ ok: true; item: PosProduct }>(withStoreId(`/api/pos/products/barcode/${encodeURIComponent(barcode)}`, storeId, options));
        return payload.item ? [payload.item] : [];
      } catch {
        const fallback = await fetchJson<{ ok: true; items: PosProduct[] }>(withStoreId(`/api/pos/products/search?q=${encodeURIComponent(barcode)}`, storeId, options));
        return fallback.items || [];
      }
    }

    if (clave) {
      try {
        const payload = await fetchJson<{ ok: true; item: PosProduct }>(withStoreId(`/api/pos/products/clave/${encodeURIComponent(clave)}`, storeId, options));
        return payload.item ? [payload.item] : [];
      } catch {
        const fallback = await fetchJson<{ ok: true; items: PosProduct[] }>(withStoreId(`/api/pos/products/search?q=${encodeURIComponent(clave)}`, storeId, options));
        return fallback.items || [];
      }
    }

    if (!q) return [];
    const payload = await fetchJson<{ ok: true; items: PosProduct[] }>(withStoreId(`/api/pos/products/search?q=${encodeURIComponent(q)}`, storeId, options));
    return payload.items || [];
  } catch {
    return searchMockProducts(input);
  }
}

export async function getPosProductByBarcodeService(barcode: string, storeId?: string, options?: PosProductServiceOptions): Promise<PosProduct | null> {
  if (getPosDataMode() === "mock") {
    return getMockProductByBarcode(barcode);
  }
  try {
    const payload = await fetchJson<{ ok: true; item: PosProduct }>(withStoreId(`/api/pos/products/barcode/${encodeURIComponent(barcode)}`, storeId, options));
    return payload.item || null;
  } catch {
    return getMockProductByBarcode(barcode);
  }
}

export async function getPosProductByClaveService(clave: string, storeId?: string, options?: PosProductServiceOptions): Promise<PosProduct | null> {
  if (getPosDataMode() === "mock") {
    return getMockProductByClave(clave);
  }
  try {
    const payload = await fetchJson<{ ok: true; item: PosProduct }>(withStoreId(`/api/pos/products/clave/${encodeURIComponent(clave)}`, storeId, options));
    return payload.item || null;
  } catch {
    return getMockProductByClave(clave);
  }
}
