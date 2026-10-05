import { PrismaClient, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { type PosTransferCreateInput, type PosTransferQuery } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = PrismaClient | Prisma.TransactionClient;

function runPosTransferQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

function normalizePage(input?: number) {
  return Math.max(1, Number(input || 1));
}

function normalizeLimit(input?: number) {
  return Math.min(100, Math.max(1, Number(input || 20)));
}

function startOfDay(input: Date) {
  const value = new Date(input);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(input: Date) {
  const value = new Date(input);
  value.setHours(23, 59, 59, 999);
  return value;
}

function parseDateFrom(input?: string) {
  if (!input?.trim()) return null;
  return startOfDay(new Date(`${input}T00:00:00`));
}

function parseDateTo(input?: string) {
  if (!input?.trim()) return null;
  return endOfDay(new Date(`${input}T00:00:00`));
}

function buildCreatedAtRange(params: { dateFrom?: string; dateTo?: string }) {
  const from = parseDateFrom(params.dateFrom);
  const to = parseDateTo(params.dateTo);
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

export async function createPosTransferRecord(
  params: TenantScope & {
    input: PosTransferCreateInput & { folio: string };
  },
  db: PosDbClient = prisma,
) {
  const { input } = params;
  return runPosTransferQuery(db, (client) =>
    client.posTransferRecord.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        folio: input.folio,
        from_store_id: input.fromStoreId,
        to_store_id: input.toStoreId,
        created_by: input.createdBy || null,
        created_by_name: input.createdByName || input.createdBy || "SYSTEM",
        note: input.note || null,
        status: "draft",
        lines: {
          create: input.lines.map((line) => ({
            product_id: line.productId,
            barcode_snapshot: line.barcode || null,
            clave_snapshot: line.clave || null,
            name_cn_snapshot: line.nameCn || null,
            name_es_snapshot: line.nameEs || null,
            spec_snapshot: line.spec || null,
            qty: line.qty,
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

export async function getPosTransferRecordById(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runPosTransferQuery(db, (client) =>
    client.posTransferRecord.findFirst({
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

export async function listPosTransferRecords(
  params: TenantScope & { query?: PosTransferQuery },
  db: PosDbClient = prisma,
) {
  const page = normalizePage(params.query?.page);
  const limit = normalizeLimit(params.query?.limit);
  const folio = params.query?.folio?.trim();
  const fromStoreId = params.query?.fromStoreId?.trim();
  const toStoreId = params.query?.toStoreId?.trim();
  const relatedStoreId = params.query?.relatedStoreId?.trim();
  const status = params.query?.status?.trim();
  const createdAt = buildCreatedAtRange({
    dateFrom: params.query?.dateFrom,
    dateTo: params.query?.dateTo,
  });

  return runPosTransferQuery(db, async (client) => {
    const where = {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      ...(folio ? { folio: { contains: folio, mode: "insensitive" as const } } : {}),
      ...(fromStoreId ? { from_store_id: fromStoreId } : {}),
      ...(toStoreId ? { to_store_id: toStoreId } : {}),
      ...(relatedStoreId
        ? {
            OR: [
              { from_store_id: relatedStoreId },
              { to_store_id: relatedStoreId },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(createdAt ? { created_at: createdAt } : {}),
    };

    const [total, items] = await Promise.all([
      client.posTransferRecord.count({ where }),
      client.posTransferRecord.findMany({
        where,
        include: {
          lines: {
            orderBy: { id: "asc" },
          },
        },
        orderBy: [{ created_at: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  });
}

export async function updatePosTransferStatus(
  params: TenantScope & {
    id: string;
    fromStatuses?: string[];
    status: string;
    sentAt?: Date | null;
    receivedAt?: Date | null;
  },
  db: PosDbClient = prisma,
) {
  return runPosTransferQuery(db, (client) =>
    client.posTransferRecord.updateMany({
      where: {
        id: params.id,
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.fromStatuses?.length ? { status: { in: params.fromStatuses } } : {}),
      },
      data: {
        status: params.status,
        ...(params.sentAt !== undefined ? { sent_at: params.sentAt } : {}),
        ...(params.receivedAt !== undefined ? { received_at: params.receivedAt } : {}),
      },
    }),
  );
}
