import { formatPosStoreName } from "@/lib/pos/access";
import { getPosStoreSettingByStoreId, listPosStoreSettings, upsertPosStoreSetting } from "@/lib/pos/repositories/pos-stores.repository";
import { type PosStoreSetting, type PosStoreSettingInput } from "@/lib/pos/types";

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function mapStoreSettingRow(row: {
  id: string;
  store_id: string;
  store_name: string;
  company_full_name: string | null;
  store_code: string | null;
  address: string | null;
  phone: string | null;
  rfc: string | null;
  active: boolean;
  default_ticket_header: string | null;
  ticket_subtitle: string | null;
  cashier_auto_close_enabled: boolean;
  cashier_auto_close_minutes: number;
  updated_at: Date;
} | null, storeId: string): PosStoreSetting {
  const normalizedStoreId = cleanText(storeId) || "default";
  const fallbackName = formatPosStoreName(normalizedStoreId);
  return {
    id: row?.id || `virtual:${normalizedStoreId}`,
    storeId: normalizedStoreId,
    storeName: cleanText(row?.store_name) || fallbackName,
    companyFullName: cleanText(row?.company_full_name),
    storeCode: cleanText(row?.store_code),
    address: cleanText(row?.address),
    phone: cleanText(row?.phone),
    rfc: cleanText(row?.rfc),
    active: row?.active ?? true,
    defaultTicketHeader: cleanText(row?.default_ticket_header) || cleanText(row?.store_name) || fallbackName,
    ticketSubtitle: cleanText(row?.ticket_subtitle),
    cashierAutoCloseEnabled: row?.cashier_auto_close_enabled ?? false,
    cashierAutoCloseMinutes: Math.max(1, row?.cashier_auto_close_minutes ?? 10),
    updatedAt: (row?.updated_at || new Date(0)).toISOString(),
  };
}

function validateStoreInput(input: PosStoreSettingInput) {
  const storeName = cleanText(input.storeName);
  if (storeName.length < 2) throw new Error("POS_STORE_NAME_REQUIRED");
  return {
    storeName,
    companyFullName: cleanText(input.companyFullName),
    storeCode: cleanText(input.storeCode),
    address: cleanText(input.address),
    phone: cleanText(input.phone),
    rfc: cleanText(input.rfc),
    active: input.active !== false,
    defaultTicketHeader: cleanText(input.defaultTicketHeader) || storeName,
    ticketSubtitle: cleanText(input.ticketSubtitle),
    cashierAutoCloseEnabled: input.cashierAutoCloseEnabled === true,
    cashierAutoCloseMinutes: Math.max(1, Math.trunc(input.cashierAutoCloseMinutes ?? 10)),
  };
}

export async function listPosStores(params: { tenantId: string; companyId: string; scopeStoreId?: string }) {
  const rows = await listPosStoreSettings(params);
  const mapped = rows.map(({ storeId, row }) => {
    const normalizedStoreId = cleanText(storeId) || "default";
    return mapStoreSettingRow(row as any, normalizedStoreId);
  });
  if (params.scopeStoreId) {
    return mapped.filter((item) => item.storeId === params.scopeStoreId);
  }
  return mapped;
}

export async function getPosStore(params: { tenantId: string; companyId: string; storeId: string }) {
  const row = await getPosStoreSettingByStoreId(params);
  return mapStoreSettingRow(row as any, params.storeId);
}

export async function savePosStore(params: {
  tenantId: string;
  companyId: string;
  storeId: string;
  input: PosStoreSettingInput;
}) {
  const normalized = validateStoreInput(params.input);
  const row = await upsertPosStoreSetting({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    input: normalized,
  });
  return mapStoreSettingRow(row as any, params.storeId);
}
