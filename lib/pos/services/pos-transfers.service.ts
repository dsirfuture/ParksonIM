import { type PosTransferCreateInput, type PosTransferDetail, type PosTransferListResult, type PosTransferQuery } from "@/lib/pos/types";

async function safeJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
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

export async function listPosTransfersService(query?: PosTransferQuery): Promise<PosTransferListResult> {
  const payload = await fetchJson<{ ok: true; items: PosTransferDetail[]; total: number; page: number; limit: number; stores: string[] }>(
    withParams("/api/pos/transfers", {
      fromStoreId: query?.fromStoreId,
      toStoreId: query?.toStoreId,
      status: query?.status,
      folio: query?.folio,
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
    stores: payload.stores || [],
  };
}

export async function getPosTransferDetailService(id: string): Promise<PosTransferDetail> {
  const payload = await fetchJson<{ ok: true; item: PosTransferDetail }>(`/api/pos/transfers/${encodeURIComponent(id)}`);
  return payload.item;
}

export async function createPosTransferService(input: PosTransferCreateInput): Promise<PosTransferDetail> {
  const payload = await fetchJson<{ ok: true; item: PosTransferDetail }>("/api/pos/transfers", {
    method: "POST",
    body: JSON.stringify({ input }),
  });
  return payload.item;
}

export async function sendPosTransferService(id: string): Promise<PosTransferDetail> {
  const payload = await fetchJson<{ ok: true; item: PosTransferDetail }>(`/api/pos/transfers/${encodeURIComponent(id)}/send`, {
    method: "POST",
  });
  return payload.item;
}

export async function receivePosTransferService(id: string): Promise<PosTransferDetail> {
  const payload = await fetchJson<{ ok: true; item: PosTransferDetail }>(`/api/pos/transfers/${encodeURIComponent(id)}/receive`, {
    method: "POST",
  });
  return payload.item;
}
