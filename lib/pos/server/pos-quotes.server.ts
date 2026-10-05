import { mapQuoteRecordToDto } from "@/lib/pos/server/pos-mappers";
import {
  createPosQuoteRecord,
  deletePosQuoteRecord,
  getPosQuoteRecordById,
  listPosQuoteRecords,
} from "@/lib/pos/repositories/pos-quotes.repository";
import { generatePosFolio } from "@/lib/pos/services/pos-folio.service";
import { type PosQuoteDraftInput } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

export async function listPosQuotes(params: TenantScope & { storeId?: string | null }) {
  const rows = await listPosQuoteRecords(params);
  return rows.map(mapQuoteRecordToDto);
}

export async function createPosQuote(params: TenantScope & { input: PosQuoteDraftInput }) {
  const created = await createPosQuoteRecord({
    tenantId: params.tenantId,
    companyId: params.companyId,
    input: {
      ...params.input,
      folio: generatePosFolio("quote"),
    },
  });
  return mapQuoteRecordToDto(created);
}

export async function getPosQuote(params: TenantScope & { id: string }) {
  const row = await getPosQuoteRecordById(params);
  return row ? mapQuoteRecordToDto(row) : null;
}

export async function deletePosQuote(params: TenantScope & { id: string }) {
  const row = await getPosQuoteRecordById(params);
  if (!row) return false;
  await deletePosQuoteRecord(params);
  return true;
}
