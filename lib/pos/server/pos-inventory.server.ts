import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import {
  adjustPosStoreInventory,
  countPosStoreInventory,
  damagePosStoreInventory,
  getPosStoreInventoryDetail,
  listAllPosInventoryMovements,
  listAllPosStoreInventories,
  listPosInventoryMovements,
  listPosStoreInventories,
} from "@/lib/pos/repositories/pos-inventory.repository";
import { type PosInventoryAdjustInput, type PosInventoryCountInput, type PosInventoryDamageInput, type PosInventoryMovementQuery, type PosInventoryQuery } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

export async function listPosInventory(params: TenantScope & { query?: PosInventoryQuery }) {
  return listPosStoreInventories({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.query?.storeId,
    keyword: params.query?.keyword,
    clave: params.query?.clave,
    barcode: params.query?.barcode,
    status: params.query?.status,
    lowStockOnly: params.query?.lowStockOnly,
    page: params.query?.page,
    limit: params.query?.limit,
  });
}

export async function listPosInventoryForExport(params: TenantScope & { query?: PosInventoryQuery }) {
  return listAllPosStoreInventories({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.query?.storeId,
    keyword: params.query?.keyword,
    clave: params.query?.clave,
    barcode: params.query?.barcode,
    status: params.query?.status,
    lowStockOnly: params.query?.lowStockOnly,
  });
}

export async function getPosInventoryDetail(params: TenantScope & { id: string }) {
  const item = await getPosStoreInventoryDetail(params);
  if (!item) throw new Error("POS_INVENTORY_NOT_FOUND");
  return item;
}

export async function listPosInventoryMovementRows(params: TenantScope & { query?: PosInventoryMovementQuery }) {
  return listPosInventoryMovements({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.query?.storeId,
    productId: params.query?.productId,
    keyword: params.query?.keyword,
    moveType: params.query?.moveType,
    dateFrom: params.query?.dateFrom,
    dateTo: params.query?.dateTo,
    page: params.query?.page,
    limit: params.query?.limit,
  });
}

export async function listPosInventoryMovementRowsForExport(params: TenantScope & { query?: PosInventoryMovementQuery }) {
  return listAllPosInventoryMovements({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.query?.storeId,
    productId: params.query?.productId,
    keyword: params.query?.keyword,
    moveType: params.query?.moveType,
    dateFrom: params.query?.dateFrom,
    dateTo: params.query?.dateTo,
  });
}

export async function adjustInventory(params: TenantScope & {
  id: string;
  input: PosInventoryAdjustInput;
  operator?: string | null;
}) {
  await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await adjustPosStoreInventory({
        tenantId: params.tenantId,
        companyId: params.companyId,
        id: params.id,
        adjustType: params.input.adjustType,
        qty: params.input.qty,
        reason: params.input.reason,
        note: params.input.note,
        operator: params.operator || params.input.operator || null,
      }, tx);
    }),
  );
  return getPosInventoryDetail({
    tenantId: params.tenantId,
    companyId: params.companyId,
    id: params.id,
  });
}

export async function countInventory(params: TenantScope & {
  id: string;
  input: PosInventoryCountInput;
  operator?: string | null;
}) {
  await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await countPosStoreInventory({
        tenantId: params.tenantId,
        companyId: params.companyId,
        id: params.id,
        finalQty: params.input.finalQty,
        reason: params.input.reason,
        note: params.input.note,
        operator: params.operator || params.input.operator || null,
      }, tx);
    }),
  );
  return getPosInventoryDetail({
    tenantId: params.tenantId,
    companyId: params.companyId,
    id: params.id,
  });
}

export async function damageInventory(params: TenantScope & {
  id: string;
  input: PosInventoryDamageInput;
  operator?: string | null;
}) {
  await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await damagePosStoreInventory({
        tenantId: params.tenantId,
        companyId: params.companyId,
        id: params.id,
        qty: params.input.qty,
        reason: params.input.reason,
        note: params.input.note,
        operator: params.operator || params.input.operator || null,
      }, tx);
    }),
  );
  return getPosInventoryDetail({
    tenantId: params.tenantId,
    companyId: params.companyId,
    id: params.id,
  });
}
