import { mapSuspendedRecordToDto, toCartFromSuspended } from "@/lib/pos/server/pos-mappers";
import {
  createPosSuspendedOrderRecord,
  deletePosSuspendedOrderRecord,
  getPosSuspendedOrderRecordById,
  listPosSuspendedOrderRecords,
  markPosSuspendedOrderResumed,
} from "@/lib/pos/repositories/pos-suspended.repository";
import { generatePosFolio } from "@/lib/pos/services/pos-folio.service";
import { type PosSuspendedOrderInput } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

export async function listPosSuspendedOrders(params: TenantScope & { storeId?: string | null }) {
  const rows = await listPosSuspendedOrderRecords(params);
  return rows.map(mapSuspendedRecordToDto);
}

export async function createPosSuspendedOrder(params: TenantScope & { input: PosSuspendedOrderInput }) {
  const created = await createPosSuspendedOrderRecord({
    tenantId: params.tenantId,
    companyId: params.companyId,
    input: {
      ...params.input,
      folio: generatePosFolio("suspended"),
    },
  });
  return mapSuspendedRecordToDto(created);
}

export async function getPosSuspendedOrder(params: TenantScope & { id: string }) {
  const row = await getPosSuspendedOrderRecordById(params);
  return row ? mapSuspendedRecordToDto(row) : null;
}

export async function resumePosSuspendedOrder(params: TenantScope & { id: string }) {
  const row = await getPosSuspendedOrderRecordById(params);
  if (!row || row.status !== "suspended") return null;
  await markPosSuspendedOrderResumed(params);
  const dto = mapSuspendedRecordToDto(row);
  return {
    order: dto,
    cart: toCartFromSuspended(dto),
  };
}

export async function deletePosSuspendedOrder(params: TenantScope & { id: string }) {
  const row = await getPosSuspendedOrderRecordById(params);
  if (!row) return false;
  await deletePosSuspendedOrderRecord(params);
  return true;
}
