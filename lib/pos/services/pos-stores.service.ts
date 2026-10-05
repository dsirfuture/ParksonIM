import { type PosStoreSetting, type PosStoreSettingInput } from "@/lib/pos/types";

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

export async function listPosStoresService(): Promise<PosStoreSetting[]> {
  const payload = await fetchJson<{ ok: true; items: PosStoreSetting[] }>("/api/pos/stores");
  return payload.items || [];
}

export async function getPosStoreService(storeId: string): Promise<PosStoreSetting> {
  const payload = await fetchJson<{ ok: true; item: PosStoreSetting }>(`/api/pos/stores/${encodeURIComponent(storeId)}`);
  return payload.item;
}

export async function savePosStoreService(storeId: string, input: PosStoreSettingInput): Promise<PosStoreSetting> {
  const payload = await fetchJson<{ ok: true; item: PosStoreSetting }>(`/api/pos/stores/${encodeURIComponent(storeId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.item;
}
