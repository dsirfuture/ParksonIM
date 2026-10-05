import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { generatePosFolio } from "@/lib/pos/services/pos-folio.service";
import { createPosInventoryMovements, upsertAndIncrementPosStoreInventory } from "@/lib/pos/repositories/pos-inventory.repository";
import { createPosRefundRecord, getPosRefundRecordBySaleId } from "@/lib/pos/repositories/pos-refunds.repository";
import { getPosSaleRecordById, updatePosSaleRecordStatus } from "@/lib/pos/repositories/pos-sales.repository";
import { type PosRefundRecord } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

function toNumber(value: unknown) {
  if (typeof value === "number") return Number(value.toFixed(2));
  if (typeof value === "string") return Number(Number(value).toFixed(2));
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return Number((value as { toNumber: () => number }).toNumber().toFixed(2));
  }
  return 0;
}

function mapRefundRecord(record: {
  id: string;
  sale_record_id: string;
  folio: string;
  reason: string | null;
  subtotal: unknown;
  discount_total: unknown;
  total: unknown;
  created_at: Date;
}): PosRefundRecord {
  return {
    id: record.id,
    saleRecordId: record.sale_record_id,
    folio: record.folio,
    reason: record.reason || "",
    subtotal: toNumber(record.subtotal),
    discountTotal: toNumber(record.discount_total),
    total: toNumber(record.total),
    createdAt: record.created_at.toISOString(),
  };
}

type RefundRecordRow = {
  id: string;
  sale_record_id: string;
  folio: string;
  reason: string | null;
  subtotal: unknown;
  discount_total: unknown;
  total: unknown;
  created_at: Date;
};

export async function refundPosSale(params: TenantScope & {
  saleId: string;
  cashierId?: string | null;
  cashierName: string;
  reason?: string | null;
}) {
  try {
    const result = await withPrismaRetry(async () =>
      prisma.$transaction(async (tx) => {
        const sale = await getPosSaleRecordById(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: params.saleId,
          },
          tx,
        );
        if (!sale) throw new Error("POS_SALE_NOT_FOUND");
        if (sale.status === "refunded") throw new Error("POS_SALE_ALREADY_REFUNDED");
        if (sale.status !== "completed") throw new Error("POS_SALE_REFUND_INVALID");

        const existingRefund = await getPosRefundRecordBySaleId(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            saleRecordId: sale.id,
          },
          tx,
        );
        if (existingRefund) throw new Error("POS_SALE_ALREADY_REFUNDED");

        const refund = await createPosRefundRecord(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            input: {
              saleRecordId: sale.id,
              folio: generatePosFolio("refund"),
              storeId: sale.store_id,
              cashierId: params.cashierId,
              cashierName: params.cashierName,
              reason: params.reason || null,
              subtotal: toNumber(sale.subtotal),
              discountTotal: toNumber(sale.discount_total),
              total: toNumber(sale.total),
              lines: sale.lines.map((line) => ({
                saleLineId: line.id,
                productId: line.product_id,
                qty: line.qty,
                unitPrice: toNumber(line.unit_price),
                subtotal: toNumber(line.subtotal),
              })),
            },
          },
          tx,
        ) as RefundRecordRow;

        const movementItems = [];
        for (const line of sale.lines) {
          const updatedInventory = await upsertAndIncrementPosStoreInventory(
            {
              tenantId: params.tenantId,
              companyId: params.companyId,
              storeId: sale.store_id,
              productId: line.product_id,
              qtyChange: line.qty,
            },
            tx,
          );
          movementItems.push({
            storeId: sale.store_id,
            productId: line.product_id,
            moveType: "return",
            qtyChange: line.qty,
            qtyBefore: updatedInventory.on_hand_qty - line.qty,
            qtyAfter: updatedInventory.on_hand_qty,
            sourceType: "refund",
            sourceId: refund.id,
            sourceFolio: refund.folio,
            note: params.reason || sale.note || null,
            createdBy: params.cashierId || params.cashierName || null,
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

        const updatedSale = await updatePosSaleRecordStatus(
          {
            tenantId: params.tenantId,
            companyId: params.companyId,
            id: sale.id,
            fromStatuses: ["completed"],
            status: "refunded",
          },
          tx,
        );
        if (updatedSale.count === 0) {
          throw new Error("POS_SALE_ALREADY_REFUNDED");
        }

        return refund;
      }),
    ) as RefundRecordRow;

    return mapRefundRecord(result);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "POS_REFUND_FAILED");
  }
}
