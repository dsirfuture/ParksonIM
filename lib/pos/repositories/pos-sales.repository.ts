import { PrismaClient, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { type PosCheckoutInput, type PosSaleQuery } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = PrismaClient | Prisma.TransactionClient;

function runPosSaleQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

export async function createPosSaleRecord(
  params: TenantScope & {
    input: PosCheckoutInput & { folio: string };
  },
  db: PosDbClient = prisma,
) {
  const { input } = params;
  return runPosSaleQuery(db, (client) =>
    client.posSaleRecord.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        folio: input.folio,
        store_id: input.store.storeId,
        cashier_id: input.cashier.cashierId,
        cashier_name: input.cashier.cashierName,
        source_type: input.sourceType,
        source_id: input.sourceId,
        customer_name: input.customer.name || null,
        customer_phone: input.customer.phone || null,
        customer_rfc: input.customer.rfc || null,
        note: input.note || null,
        subtotal: input.subtotal,
        discount_total: input.discountTotal,
        total: input.total,
        payment_method: input.payment.method,
        received_amount: input.payment.received,
        change_amount: input.payment.change,
        status: "completed",
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

export async function getNextPosSaleFolio(
  params: TenantScope,
  db: PosDbClient = prisma,
) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    const folio = `POS-${date}-${random}`;
    const exists = await runPosSaleQuery(db, (client) =>
      client.posSaleRecord.findFirst({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          folio,
        },
        select: { id: true },
      }),
    );
    if (!exists) {
      return folio;
    }
  }

  return `POS-${date}-${String(Date.now()).slice(-5)}`;
}

export async function getPosSaleRecordById(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runPosSaleQuery(db, (client) =>
    client.posSaleRecord.findFirst({
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

export async function listPosSaleRecords(
  params: TenantScope & {
    storeId?: string;
    take?: number;
    query?: PosSaleQuery;
  },
  db: PosDbClient = prisma,
) {
  const dateFrom = params.query?.dateFrom ? new Date(params.query.dateFrom) : null;
  const dateTo = params.query?.dateTo ? new Date(params.query.dateTo) : null;
  const paymentMethod = params.query?.paymentMethod?.trim();
  const status = params.query?.status?.trim();
  const folio = params.query?.folio?.trim();
  const customer = params.query?.customer?.trim();
  return runPosSaleQuery(db, (client) =>
    client.posSaleRecord.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.storeId ? { store_id: params.storeId } : {}),
        ...(folio ? { folio: { contains: folio, mode: "insensitive" } } : {}),
        ...(customer ? { customer_name: { contains: customer, mode: "insensitive" } } : {}),
        ...(paymentMethod ? { payment_method: paymentMethod } : {}),
        ...(status ? { status } : {}),
        ...(dateFrom || dateTo
          ? {
              created_at: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
      ...(typeof params.take === "number" ? { take: params.take } : {}),
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
    }),
  );
}

export async function getPosSaleSourceFolioMap(
  params: TenantScope & {
    suspendedIds?: string[];
    quoteIds?: string[];
  },
  db: PosDbClient = prisma,
) {
  return runPosSaleQuery(db, async (client) => {
    const suspendedIds = Array.from(new Set((params.suspendedIds || []).filter(Boolean)));
    const quoteIds = Array.from(new Set((params.quoteIds || []).filter(Boolean)));

    const [suspendedRows, quoteRows]: [
      Array<{ id: string; folio: string }>,
      Array<{ id: string; folio: string }>
    ] = await Promise.all([
      suspendedIds.length
        ? client.posSuspendedOrderRecord.findMany({
            where: {
              tenant_id: params.tenantId,
              company_id: params.companyId,
              id: { in: suspendedIds },
            },
            select: {
              id: true,
              folio: true,
            },
          })
        : Promise.resolve([]),
      quoteIds.length
        ? client.posQuoteRecord.findMany({
            where: {
              tenant_id: params.tenantId,
              company_id: params.companyId,
              id: { in: quoteIds },
            },
            select: {
              id: true,
              folio: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      suspended: new Map<string, string>(suspendedRows.map((item: { id: string; folio: string }) => [item.id, item.folio])),
      quote: new Map<string, string>(quoteRows.map((item: { id: string; folio: string }) => [item.id, item.folio])),
    };
  });
}

export async function updatePosSaleRecordStatus(
  params: TenantScope & {
    id: string;
    fromStatuses?: string[];
    status: string;
  },
  db: PosDbClient = prisma,
) {
  return runPosSaleQuery(db, (client) =>
    client.posSaleRecord.updateMany({
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
