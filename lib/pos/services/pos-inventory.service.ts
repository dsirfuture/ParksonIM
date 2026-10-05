import {
  type PosInventoryAdjustInput,
  type PosInventoryDamageInput,
  type PosInventoryCountInput,
  type PosInventoryDetail,
  type PosInventoryItem,
  type PosInventoryListResult,
  type PosInventoryMovementItem,
  type PosInventoryMovementListResult,
  type PosInventoryMovementQuery,
  type PosInventoryQuery,
} from "@/lib/pos/types";

async function safeJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });
  const payload = await safeJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP_${response.status}`);
  }
  return payload as T;
}

function withParams(path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

export async function listPosInventoryService(query?: PosInventoryQuery): Promise<PosInventoryListResult> {
  const payload = await fetchJson<{ ok: true; items: PosInventoryItem[]; total: number; page: number; limit: number }>(
    withParams("/api/pos/inventory", {
      storeId: query?.storeId,
      keyword: query?.keyword,
      clave: query?.clave,
      barcode: query?.barcode,
      status: query?.status,
      lowStockOnly: query?.lowStockOnly ? "1" : undefined,
      page: query?.page ? String(query.page) : undefined,
      limit: query?.limit ? String(query.limit) : undefined,
    }),
  );
  return {
    items: payload.items || [],
    total: payload.total || 0,
    page: payload.page || 1,
    limit: payload.limit || 20,
  };
}

export async function getPosInventoryDetailService(id: string): Promise<PosInventoryDetail> {
  const payload = await fetchJson<{ ok: true; item: PosInventoryDetail }>(`/api/pos/inventory/${encodeURIComponent(id)}`);
  return payload.item;
}

export async function adjustPosInventoryService(id: string, input: PosInventoryAdjustInput): Promise<PosInventoryDetail> {
  const payload = await fetchJson<{ ok: true; item: PosInventoryDetail }>(`/api/pos/inventory/${encodeURIComponent(id)}/adjust`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload.item;
}

export async function countPosInventoryService(id: string, input: PosInventoryCountInput): Promise<PosInventoryDetail> {
  const payload = await fetchJson<{ ok: true; item: PosInventoryDetail }>(`/api/pos/inventory/${encodeURIComponent(id)}/count`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload.item;
}

export async function damagePosInventoryService(id: string, input: PosInventoryDamageInput): Promise<PosInventoryDetail> {
  const payload = await fetchJson<{ ok: true; item: PosInventoryDetail }>(`/api/pos/inventory/${encodeURIComponent(id)}/damage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload.item;
}

export async function listPosInventoryMovementsService(query?: PosInventoryMovementQuery): Promise<PosInventoryMovementListResult> {
  const payload = await fetchJson<{ ok: true; items: PosInventoryMovementItem[]; total: number; page: number; limit: number }>(
    withParams("/api/pos/inventory-movements", {
      storeId: query?.storeId,
      productId: query?.productId,
      keyword: query?.keyword,
      moveType: query?.moveType,
      dateFrom: query?.dateFrom,
      dateTo: query?.dateTo,
      page: query?.page ? String(query.page) : undefined,
      limit: query?.limit ? String(query.limit) : undefined,
    }),
  );
  return {
    items: payload.items || [],
    total: payload.total || 0,
    page: payload.page || 1,
    limit: payload.limit || 20,
  };
}
