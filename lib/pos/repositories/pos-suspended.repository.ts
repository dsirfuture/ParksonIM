import { PrismaClient, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { type PosSuspendedOrderInput } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = PrismaClient | Prisma.TransactionClient;

function runPosSuspendedQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

export async function listPosSuspendedOrderRecords(
  params: TenantScope & { storeId?: string | null },
  db: PosDbClient = prisma,
) {
  return runPosSuspendedQuery(db, (client) =>
    client.posSuspendedOrderRecord.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.storeId ? { store_id: params.storeId } : {}),
        status: "suspended",
      },
      orderBy: [{ created_at: "desc" }, { folio: "desc" }],
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
    }),
  );
}

export async function createPosSuspendedOrderRecord(params: TenantScope & {
  input: PosSuspendedOrderInput & { folio: string };
}, db: PosDbClient = prisma) {
  const { input } = params;
  return runPosSuspendedQuery(db, (client) =>
    client.posSuspendedOrderRecord.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        folio: input.folio,
        store_id: input.store.storeId,
        cashier_id: input.cashier.cashierId,
        cashier_name: input.cashier.cashierName,
        customer_name: input.customer.name || null,
        customer_phone: input.customer.phone || null,
        customer_rfc: input.customer.rfc || null,
        note: input.note || null,
        subtotal: input.subtotal,
        discount_total: input.discountTotal,
        total: input.total,
        payment_method: input.paymentMethod,
        status: "suspended",
        lines: {
          create: input.lines.map((line) => ({
            product_id: line.productId,
            barcode_snapshot: line.barcode || null,
            clave_snapshot: line.clave || null,
            name_cn_snapshot: line.nameCn || null,
            name_es_snapshot: line.nameEs || null,
            spec_snapshot: line.spec || null,
            qty: line.qty,
            unit_price: line.unitPrice,
            discount_type: line.lineDiscount?.type || null,
            discount_value: line.lineDiscount?.value ?? null,
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

export async function getPosSuspendedOrderRecordById(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runPosSuspendedQuery(db, (client) =>
    client.posSuspendedOrderRecord.findFirst({
      where: {
        id: params.id,
        tenant_id: params.tenantId,
        company_id: params.companyId,
      },
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
    }),
  );
}

export async function markPosSuspendedOrderResumed(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runPosSuspendedQuery(db, (client) =>
    client.posSuspendedOrderRecord.updateMany({
      where: {
        id: params.id,
        tenant_id: params.tenantId,
        company_id: params.companyId,
        status: "suspended",
      },
      data: {
        status: "resumed",
      },
    }),
  );
}

export async function updatePosSuspendedOrderStatus(
  params: TenantScope & { id: string; fromStatuses?: string[]; status: string },
  db: PosDbClient = prisma,
) {
  return runPosSuspendedQuery(db, (client) =>
    client.posSuspendedOrderRecord.updateMany({
      where: {
        id: params.id,
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.fromStatuses?.length ? { status: { in: params.fromStatuses } } : {}),
      },
      data: {
        status: params.status,
      },
    }),
  );
}

export async function deletePosSuspendedOrderRecord(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runPosSuspendedQuery(db, (client) =>
    client.posSuspendedOrderRecord.deleteMany({
      where: {
        id: params.id,
        tenant_id: params.tenantId,
        company_id: params.companyId,
      },
    }),
  );
}
