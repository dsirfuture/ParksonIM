import { type PosCashierDetail, type PosCashierItem, type PosCashierQuery, type PosCashierUpsertInput } from "@/lib/pos/types";

async function safeJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
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

export async function listPosCashiersService(query?: PosCashierQuery): Promise<PosCashierItem[]> {
  const payload = await fetchJson<{ ok: true; items: PosCashierItem[] }>(withParams("/api/pos/cashiers", {
    storeId: query?.storeId,
    keyword: query?.keyword,
    role: query?.role,
    status: query?.status,
  }));
  return payload.items || [];
}

export async function getPosCashierService(id: string): Promise<PosCashierDetail> {
  const payload = await fetchJson<{ ok: true; item: PosCashierDetail }>(`/api/pos/cashiers/${encodeURIComponent(id)}`);
  return payload.item;
}

export async function createPosCashierService(input: PosCashierUpsertInput): Promise<PosCashierItem> {
  const payload = await fetchJson<{ ok: true; item: PosCashierItem }>("/api/pos/cashiers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.item;
}

export async function updatePosCashierService(id: string, input: PosCashierUpsertInput): Promise<PosCashierItem> {
  const payload = await fetchJson<{ ok: true; item: PosCashierItem }>(`/api/pos/cashiers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.item;
}

export async function updatePosCashierStatusService(id: string, active: boolean): Promise<PosCashierItem> {
  const payload = await fetchJson<{ ok: true; item: PosCashierItem }>(`/api/pos/cashiers/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
  return payload.item;
}
