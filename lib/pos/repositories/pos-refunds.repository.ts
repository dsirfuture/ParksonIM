import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = any;

function runRefundQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

export async function getPosRefundRecordBySaleId(
  params: TenantScope & { saleRecordId: string },
  db: PosDbClient = prisma,
) {
  return runRefundQuery(db, (client) =>
    client.posRefundRecord.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        sale_record_id: params.saleRecordId,
      },
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
    }),
  );
}

export async function createPosRefundRecord(
  params: TenantScope & {
    input: {
      saleRecordId: string;
      folio: string;
      storeId: string;
      cashierId?: string | null;
      cashierName: string;
      reason?: string | null;
      subtotal: number;
      discountTotal: number;
      total: number;
      lines: Array<{
        saleLineId: string;
        productId: string;
        qty: number;
        unitPrice: number;
        subtotal: number;
      }>;
    };
  },
  db: PosDbClient = prisma,
) {
  const { input } = params;
  return runRefundQuery(db, (client) =>
    client.posRefundRecord.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        sale_record_id: input.saleRecordId,
        folio: input.folio,
        store_id: input.storeId,
        cashier_id: input.cashierId || null,
        cashier_name: input.cashierName,
        reason: input.reason || null,
        subtotal: input.subtotal,
        discount_total: input.discountTotal,
        total: input.total,
        lines: {
          create: input.lines.map((line) => ({
            sale_line_id: line.saleLineId,
            product_id: line.productId,
            qty: line.qty,
            unit_price: line.unitPrice,
            subtotal: line.subtotal,
          })),
        },
      },
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
    }),
  );
}
