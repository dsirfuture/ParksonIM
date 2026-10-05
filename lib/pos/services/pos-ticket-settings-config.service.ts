import { type PosTicketSettingConfig, type PosTicketSettingInput } from "@/lib/pos/types";

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

export async function listPosTicketSettingsService(): Promise<PosTicketSettingConfig[]> {
  const payload = await fetchJson<{ ok: true; items: PosTicketSettingConfig[] }>("/api/pos/ticket-settings");
  return payload.items || [];
}

export async function getPosTicketSettingService(storeId: string): Promise<PosTicketSettingConfig> {
  const payload = await fetchJson<{ ok: true; item: PosTicketSettingConfig }>(`/api/pos/ticket-settings/${encodeURIComponent(storeId)}`);
  return payload.item;
}

export async function savePosTicketSettingService(storeId: string, input: PosTicketSettingInput): Promise<PosTicketSettingConfig> {
  const payload = await fetchJson<{ ok: true; item: PosTicketSettingConfig }>(`/api/pos/ticket-settings/${encodeURIComponent(storeId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.item;
}
