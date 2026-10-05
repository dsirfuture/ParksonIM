import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { mapSaleRecordToDto } from "@/lib/pos/server/pos-mappers";
import { createPosSaleRecord, getNextPosSaleFolio } from "@/lib/pos/repositories/pos-sales.repository";
import { getPosProductRowsByIds } from "@/lib/pos/repositories/pos-products.repository";
import { getPosSuspendedOrderRecordById, updatePosSuspendedOrderStatus } from "@/lib/pos/repositories/pos-suspended.repository";
import { getPosQuoteRecordById, updatePosQuoteStatus } from "@/lib/pos/repositories/pos-quotes.repository";
import { createPosInventoryMovements, decrementPosStoreInventory, getPosStoreInventoryRows } from "@/lib/pos/repositories/pos-inventory.repository";
import { type PosCheckoutInput } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

function toErrorCode(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "CHECKOUT_FAILED";
}

function assertCheckoutInput(input: PosCheckoutInput) {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("CHECKOUT_EMPTY_LINES");
  }
  if (!input.payment.method) {
    throw new Error("CHECKOUT_INVALID_PAYMENT");
  }
  if (input.total <= 0) {
    throw new Error("CHECKOUT_TOTAL_INVALID");
  }
  if (input.payment.method === "cash" && input.payment.received < input.total) {
    throw new Error("CHECKOUT_INVALID_PAYMENT");
  }
}

function buildProductLabel(input: { clave?: string | null; nameCn?: string | null; nameEs?: string | null; productId: string }) {
  return input.clave || input.nameCn || input.nameEs || input.productId;
}

function withDetail(code: string, detail?: string) {
  return detail ? `${code}::${detail}` : code;
}

export async function checkoutPosSale(params: TenantScope & { input: PosCheckoutInput }) {
  assertCheckoutInput(params.input);

  try {
    const created = await withPrismaRetry(() =>
      prisma.$transaction(async (tx) => {
        if (params.input.sourceType === "suspended" && params.input.sourceId) {
          const suspended = await getPosSuspendedOrderRecordById(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              id: params.input.sourceId,
            },
            tx,
          );
          if (!suspended) throw new Error("CHECKOUT_SOURCE_NOT_FOUND");
          if (suspended.status === "completed") throw new Error("CHECKOUT_SOURCE_COMPLETED");
          if (!["suspended", "resumed"].includes(suspended.status)) throw new Error("CHECKOUT_SOURCE_INVALID");
        }

        if (params.input.sourceType === "quote" && params.input.sourceId) {
          const quote = await getPosQuoteRecordById(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              id: params.input.sourceId,
            },
            tx,
          );
          if (!quote) throw new Error("CHECKOUT_SOURCE_NOT_FOUND");
          if (quote.status === "converted") throw new Error("CHECKOUT_SOURCE_COMPLETED");
          if (quote.status !== "draft") throw new Error("CHECKOUT_SOURCE_INVALID");
        }

        const products = await getPosProductRowsByIds(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            storeId: params.input.store.storeId,
            ids: params.input.lines.map((line) => line.productId),
          },
          tx,
        );
        const productMap = new Map(products.map((item) => [item.id, item]));

        for (const line of params.input.lines) {
          const product = productMap.get(line.productId);
          const fallbackLabel = buildProductLabel({
            clave: line.clave,
            nameCn: line.nameCn,
            nameEs: line.nameEs,
            productId: line.productId,
          });
          if (!product) throw new Error(withDetail("POS_PRODUCT_NOT_FOUND", fallbackLabel));
          if (!product.active) throw new Error(withDetail("POS_PRODUCT_INACTIVE", fallbackLabel));
        }

        const inventories = await getPosStoreInventoryRows(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            storeId: params.input.store.storeId,
            productIds: params.input.lines.map((line) => line.productId),
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

        const sale = await createPosSaleRecord(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            input: {
              ...params.input,
              folio: await getNextPosSaleFolio(
                {
                  tenantId: params.tenantId,
                  companyId: params.companyId,
                },
                tx,
              ),
            },
          },
          tx,
        );

        const movementItems = [];
        for (const line of params.input.lines) {
          const product = productMap.get(line.productId);
          const inventory = inventoryMap.get(line.productId);
          const inventoryManaged = line.inventoryManaged ?? product?.inventoryManaged ?? true;
          const sourceKind = line.sourceKind || product?.sourceKind || "inventory";
          const requiresInventory = inventoryManaged && sourceKind === "inventory";
          const label = buildProductLabel({
            clave: product?.clave || line.clave,
            nameCn: product?.nameCn || line.nameCn,
            nameEs: product?.nameEs || line.nameEs,
            productId: line.productId,
          });

          if (!requiresInventory) {
            continue;
          }

          if (!inventory || !inventory.active) {
            throw new Error(withDetail("POS_STOCK_NOT_FOUND", label));
          }

          const qtyBefore = inventory.on_hand_qty;
          const qtyAfter = qtyBefore - line.qty;
          if (qtyBefore < line.qty) {
            throw new Error(withDetail("POS_STOCK_INSUFFICIENT", `${label} (${qtyBefore})`));
          }

          const nextAvailable = Math.max(0, qtyAfter - inventory.reserved_qty);
          const updated = await decrementPosStoreInventory(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              storeId: params.input.store.storeId,
              adjustment: {
                inventoryId: inventory.id,
                qty: line.qty,
                nextOnHandQty: qtyAfter,
                nextAvailableQty: nextAvailable,
              },
            },
            tx,
          ) as { count: number };
          if (updated.count === 0) {
            throw new Error(withDetail("POS_STOCK_INSUFFICIENT", `${label} (${qtyBefore})`));
          }

          movementItems.push({
            storeId: params.input.store.storeId,
            productId: line.productId,
            moveType: "sale",
            qtyChange: -line.qty,
            qtyBefore,
            qtyAfter,
            sourceType: "sale",
            sourceId: sale.id,
            sourceFolio: sale.folio,
            note: params.input.note || null,
            createdBy: params.input.cashier.cashierId || params.input.cashier.cashierName || null,
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

        if (params.input.sourceType === "suspended" && params.input.sourceId) {
          await updatePosSuspendedOrderStatus(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              id: params.input.sourceId,
              fromStatuses: ["suspended", "resumed"],
              status: "completed",
            },
            tx,
          );
        }

        if (params.input.sourceType === "quote" && params.input.sourceId) {
          await updatePosQuoteStatus(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              id: params.input.sourceId,
              fromStatuses: ["draft"],
              status: "converted",
            },
            tx,
          );
        }

        return sale;
      }),
    );

    return mapSaleRecordToDto(created);
  } catch (error) {
    throw new Error(toErrorCode(error));
  }
}
