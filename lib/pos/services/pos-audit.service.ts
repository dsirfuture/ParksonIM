import { type PosAuditLogDetail, type PosAuditLogListResult, type PosAuditLogQuery } from "@/lib/pos/types";
import { type Lang } from "@/lib/i18n";

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

function withParams(path: string, query?: PosAuditLogQuery | Record<string, string | number | undefined>) {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

export async function listPosAuditLogsService(query?: PosAuditLogQuery): Promise<PosAuditLogListResult> {
  const payload = await fetchJson<{ ok: true; items: PosAuditLogListResult["items"]; total: number; page: number; limit: number }>(
    withParams("/api/pos/audit-logs", query),
  );
  return {
    items: payload.items || [],
    total: payload.total || 0,
    page: payload.page || 1,
    limit: payload.limit || 20,
  };
}

export async function getPosAuditLogDetailService(id: string): Promise<PosAuditLogDetail> {
  const payload = await fetchJson<{ ok: true; item: PosAuditLogDetail }>(`/api/pos/audit-logs/${encodeURIComponent(id)}`);
  return payload.item;
}

export async function exportPosAuditLogsService(query: PosAuditLogQuery, lang: Lang) {
  const response = await fetch(withParams("/api/pos/audit-logs/export", {
    lang,
    storeId: query.storeId,
    actorUserId: query.actorUserId,
    actorRole: query.actorRole,
    module: query.module,
    actionType: query.actionType,
    resultStatus: query.resultStatus,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    page: query.page ? String(query.page) : undefined,
    limit: query.limit ? String(query.limit) : undefined,
  }), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload?.error || `HTTP_${response.status}`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.*?)"?$/i);
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : "pos-audit-logs.xlsx";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
