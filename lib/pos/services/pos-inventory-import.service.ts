import * as XLSX from "xlsx";
import {
  type PosInventoryImportCommitResult,
  type PosInventoryImportPreviewResult,
  type PosInventoryImportRowInput,
} from "@/lib/pos/types";

type WorksheetRow = Record<string, unknown>;

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
    const error = new Error(payload?.error || `HTTP_${response.status}`);
    (error as Error & { payload?: unknown }).payload = payload;
    throw error;
  }
  return payload as T;
}

function cleanText(value: unknown) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeQty(value: unknown) {
  const text = cleanText(value);
  if (!text) return 0;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

export async function downloadPosInventoryImportTemplate(storeId?: string) {
  const url = new URL("/api/pos/inventory-import/template", window.location.origin);
  if (storeId?.trim()) url.searchParams.set("storeId", storeId.trim());
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload?.error || `HTTP_${response.status}`);
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "pos-inventory-import-template.xlsx";
  anchor.click();
  URL.revokeObjectURL(href);
}

export async function parsePosInventoryImportFile(file: File): Promise<PosInventoryImportRowInput[]> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] || ""];
  if (!firstSheet) {
    throw new Error("POS_IMPORT_EMPTY_FILE");
  }

  const rows = XLSX.utils.sheet_to_json<WorksheetRow>(firstSheet, { defval: "" });
  if (!rows.length) {
    throw new Error("POS_IMPORT_EMPTY_FILE");
  }

  const sample = rows[0] || {};
  const hasRequiredHeader = ["TIENDA", "CANT."].every((key) => Object.prototype.hasOwnProperty.call(sample, key))
    && (Object.prototype.hasOwnProperty.call(sample, "CLAVE") || Object.prototype.hasOwnProperty.call(sample, "COD. BARRAS"));
  if (!hasRequiredHeader) {
    throw new Error("POS_IMPORT_TEMPLATE_INVALID");
  }

  return rows.map((row) => ({
    storeId: cleanText(row["TIENDA"]),
    clave: cleanText(row["CLAVE"]),
    barcode: cleanText(row["COD. BARRAS"]),
    qty: normalizeQty(row["CANT."]),
    note: cleanText(row["OBS."]),
  }));
}

export async function previewPosInventoryImportService(rows: PosInventoryImportRowInput[]): Promise<PosInventoryImportPreviewResult> {
  const payload = await fetchJson<{ ok: true } & PosInventoryImportPreviewResult>("/api/pos/inventory-import/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rows }),
  });
  return {
    items: payload.items || [],
    total: payload.total || 0,
    importableCount: payload.importableCount || 0,
    invalidCount: payload.invalidCount || 0,
  };
}

export async function commitPosInventoryImportService(rows: PosInventoryImportRowInput[], operator?: string): Promise<PosInventoryImportCommitResult> {
  const payload = await fetchJson<{ ok: true } & PosInventoryImportCommitResult>("/api/pos/inventory-import/commit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rows, operator }),
  });
  return {
    totalRows: payload.totalRows || 0,
    importedCount: payload.importedCount || 0,
    items: payload.items || [],
  };
}
