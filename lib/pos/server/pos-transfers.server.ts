import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { generatePosFolio } from "@/lib/pos/services/pos-folio.service";
import { listKnownPosStoreIds, createPosInventoryMovements, decrementPosStoreInventory, getPosStoreInventoryRows, upsertAndIncrementPosStoreInventory } from "@/lib/pos/repositories/pos-inventory.repository";
import { getPosProductRowsByIds } from "@/lib/pos/repositories/pos-products.repository";
import { createPosTransferRecord, getPosTransferRecordById, listPosTransferRecords, updatePosTransferStatus } from "@/lib/pos/repositories/pos-transfers.repository";
import { mapTransferRecordToDetail, mapTransferRecordToListItem } from "@/lib/pos/server/pos-mappers";
import { type PosTransferCreateInput, type PosTransferQuery } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

function withDetail(code: string, detail?: string) {
  return detail ? `${code}::${detail}` : code;
}

function toErrorCode(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "POS_TRANSFER_FAILED";
}

function buildProductLabel(input: {
  clave?: string | null;
  nameCn?: string | null;
  nameEs?: string | null;
  productId: string;
}) {
  return input.clave || input.nameCn || input.nameEs || input.productId;
}

function assertTransferCreateInput(input: PosTransferCreateInput) {
  if (!input.fromStoreId?.trim() || !input.toStoreId?.trim()) {
    throw new Error("POS_TRANSFER_SAME_STORE_NOT_ALLOWED");
  }
  if (input.fromStoreId.trim() === input.toStoreId.trim()) {
    throw new Error("POS_TRANSFER_SAME_STORE_NOT_ALLOWED");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("POS_TRANSFER_EMPTY_LINES");
  }
  for (const line of input.lines) {
    if (!line.productId?.trim() || !Number.isFinite(line.qty) || line.qty <= 0) {
      throw new Error("POS_TRANSFER_EMPTY_LINES");
    }
  }
}

export async function listPosTransfers(params: TenantScope & { query?: PosTransferQuery }) {
  const result = await listPosTransferRecords({
    tenantId: params.tenantId,
    companyId: params.companyId,
    query: params.query,
  });
  const stores = await listKnownPosStoreIds({
    tenantId: params.tenantId,
    companyId: params.companyId,
  });
  return {
    items: result.items.map(mapTransferRecordToListItem),
    total: result.total,
    page: result.page,
    limit: result.limit,
    stores,
  };
}

export async function getPosTransferDetail(params: TenantScope & { id: string }) {
  const row = await getPosTransferRecordById(params);
  if (!row) throw new Error("POS_TRANSFER_NOT_FOUND");
  return mapTransferRecordToDetail(row);
}

export async function createTransfer(params: TenantScope & { input: PosTransferCreateInput }) {
  assertTransferCreateInput(params.input);

  try {
    const created = await withPrismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const products = await getPosProductRowsByIds(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            storeId: params.input.fromStoreId,
            ids: params.input.lines.map((line) => line.productId),
          },
          tx,
        );
        const productMap = new Map(products.map((item) => [item.id, item]));

        for (const line of params.input.lines) {
          const product = productMap.get(line.productId);
          const label = buildProductLabel({
            clave: line.clave,
            nameCn: line.nameCn,
            nameEs: line.nameEs,
            productId: line.productId,
          });
          if (!product) throw new Error(withDetail("POS_PRODUCT_NOT_FOUND", label));
          if (!product.active) throw new Error(withDetail("POS_PRODUCT_INACTIVE", label));
        }

        return createPosTransferRecord(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            input: {
              ...params.input,
              fromStoreId: params.input.fromStoreId.trim(),
              toStoreId: params.input.toStoreId.trim(),
              folio: generatePosFolio("transfer"),
            },
          },
          tx,
        );
      }),
    );

    return mapTransferRecordToDetail(created);
  } catch (error) {
    throw new Error(toErrorCode(error));
  }
}

export async function sendTransfer(params: TenantScope & {
  id: string;
  operator?: string | null;
}) {
  try {
    const result = await withPrismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const record = await getPosTransferRecordById(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: params.id,
          },
          tx,
        );
        if (!record) throw new Error("POS_TRANSFER_NOT_FOUND");
        if (record.status === "received") throw new Error("POS_TRANSFER_ALREADY_RECEIVED");
        if (record.status !== "draft") throw new Error("POS_TRANSFER_INVALID_STATUS");
        if (record.from_store_id === record.to_store_id) throw new Error("POS_TRANSFER_SAME_STORE_NOT_ALLOWED");
        if (!record.lines.length) throw new Error("POS_TRANSFER_EMPTY_LINES");

        const inventories = await getPosStoreInventoryRows(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            storeId: record.from_store_id,
            productIds: record.lines.map((line: any) => line.product_id),
          },
          tx,
        ) as Array<{
          id: string;
          product_id: string;
          on_hand_qty: number;
          reserved_qty: number;
          active: boolean;
        }>;
        const inventoryMap = new Map(inventories.map((item) => [item.product_id, item]));
        const movementItems = [];

        for (const line of record.lines) {
          const inventory = inventoryMap.get(line.product_id);
          const label = buildProductLabel({
            clave: line.clave_snapshot,
            nameCn: line.name_cn_snapshot,
            nameEs: line.name_es_snapshot,
            productId: line.product_id,
          });
          if (!inventory || !inventory.active) {
            throw new Error(withDetail("POS_TRANSFER_STOCK_NOT_FOUND", label));
          }
          const qtyBefore = inventory.on_hand_qty;
          const qtyAfter = qtyBefore - line.qty;
          if (qtyBefore < line.qty) {
            throw new Error(withDetail("POS_TRANSFER_STOCK_INSUFFICIENT", `${label} (${qtyBefore})`));
          }
          const nextAvailableQty = Math.max(0, qtyAfter - inventory.reserved_qty);
          const updated = await decrementPosStoreInventory(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              storeId: record.from_store_id,
              adjustment: {
                inventoryId: inventory.id,
                qty: line.qty,
                nextOnHandQty: qtyAfter,
                nextAvailableQty,
              },
            },
            tx,
          ) as { count: number };
          if (updated.count === 0) {
            throw new Error(withDetail("POS_TRANSFER_STOCK_INSUFFICIENT", `${label} (${qtyBefore})`));
          }
          movementItems.push({
            storeId: record.from_store_id,
            productId: line.product_id,
            moveType: "transfer_out",
            qtyChange: -line.qty,
            qtyBefore,
            qtyAfter,
            sourceType: "transfer",
            sourceId: record.id,
            sourceFolio: record.folio,
            note: record.note || null,
            createdBy: params.operator || record.created_by || record.created_by_name || null,
          });
        }

        await createPosInventoryMovements(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            items: movementItems,
          },
          tx,
        );

        const sentAt = new Date();
        const updatedStatus = await updatePosTransferStatus(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: record.id,
            fromStatuses: ["draft"],
            status: "sent",
            sentAt,
          },
          tx,
        );
        if (updatedStatus.count === 0) throw new Error("POS_TRANSFER_INVALID_STATUS");

        const next = await getPosTransferRecordById(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: record.id,
          },
          tx,
        );
        if (!next) throw new Error("POS_TRANSFER_NOT_FOUND");
        return next;
      }),
    );

    return mapTransferRecordToDetail(result);
  } catch (error) {
    throw new Error(toErrorCode(error));
  }
}

export async function receiveTransfer(params: TenantScope & {
  id: string;
  operator?: string | null;
}) {
  try {
    const result = await withPrismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const record = await getPosTransferRecordById(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: params.id,
          },
          tx,
        );
        if (!record) throw new Error("POS_TRANSFER_NOT_FOUND");
        if (record.status === "received") throw new Error("POS_TRANSFER_ALREADY_RECEIVED");
        if (record.status !== "sent") throw new Error("POS_TRANSFER_INVALID_STATUS");

        const beforeRows = await getPosStoreInventoryRows(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            storeId: record.to_store_id,
            productIds: record.lines.map((line: any) => line.product_id),
          },
          tx,
        ) as Array<{
          id: string;
          product_id: string;
          on_hand_qty: number;
          reserved_qty: number;
          available_qty: number;
          active: boolean;
        }>;
        const beforeMap = new Map(beforeRows.map((item) => [item.product_id, item]));
        const movementItems = [];

        for (const line of record.lines) {
          const current = beforeMap.get(line.product_id);
          const qtyBefore = current?.on_hand_qty || 0;
          const updated = await upsertAndIncrementPosStoreInventory(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              storeId: record.to_store_id,
              productId: line.product_id,
              qtyChange: line.qty,
            },
            tx,
          ) as {
            on_hand_qty: number;
          };

          movementItems.push({
            storeId: record.to_store_id,
            productId: line.product_id,
            moveType: "transfer_in",
            qtyChange: line.qty,
            qtyBefore,
            qtyAfter: updated.on_hand_qty,
            sourceType: "transfer",
            sourceId: record.id,
            sourceFolio: record.folio,
            note: record.note || null,
            createdBy: params.operator || record.created_by || record.created_by_name || null,
          });
        }

        await createPosInventoryMovements(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            items: movementItems,
          },
          tx,
        );

        const receivedAt = new Date();
        const updatedStatus = await updatePosTransferStatus(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: record.id,
            fromStatuses: ["sent"],
            status: "received",
            receivedAt,
          },
          tx,
        );
        if (updatedStatus.count === 0) throw new Error("POS_TRANSFER_INVALID_STATUS");

        const next = await getPosTransferRecordById(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: record.id,
          },
          tx,
        );
        if (!next) throw new Error("POS_TRANSFER_NOT_FOUND");
        return next;
      }),
    );

    return mapTransferRecordToDetail(result);
  } catch (error) {
    throw new Error(toErrorCode(error));
  }
}
