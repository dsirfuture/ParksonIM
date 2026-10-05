import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { type PosAuditLogQuery } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = any;

type PosAuditLogCreateInput = {
  actionType: string;
  module: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  storeId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetFolio?: string | null;
  summary: string;
  detailsJson?: Record<string, unknown> | null;
  resultStatus: string;
};

function runAuditQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
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

function buildCreatedAtRange(query?: { dateFrom?: string; dateTo?: string }) {
  const from = query?.dateFrom?.trim() ? startOfDay(new Date(`${query.dateFrom}T00:00:00`)) : null;
  const to = query?.dateTo?.trim() ? endOfDay(new Date(`${query.dateTo}T00:00:00`)) : null;
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

function normalizePage(input?: number) {
  return Math.max(1, Number(input || 1));
}

function normalizeLimit(input?: number) {
  return Math.min(100, Math.max(1, Number(input || 20)));
}

export async function createPosAuditLog(
  params: TenantScope & { input: PosAuditLogCreateInput },
  db: PosDbClient = prisma,
) {
  return runAuditQuery(db, (client) =>
    client.posAuditLog.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        action_type: params.input.actionType,
        module: params.input.module,
        actor_user_id: params.input.actorUserId || null,
        actor_name: params.input.actorName,
        actor_role: params.input.actorRole,
        store_id: params.input.storeId || null,
        target_type: params.input.targetType || null,
        target_id: params.input.targetId || null,
        target_folio: params.input.targetFolio || null,
        summary: params.input.summary,
        details_json: params.input.detailsJson || undefined,
        result_status: params.input.resultStatus,
      },
    }),
  );
}

export async function listPosAuditLogs(
  params: TenantScope & { query?: PosAuditLogQuery },
  db: PosDbClient = prisma,
) {
  const page = normalizePage(params.query?.page);
  const limit = normalizeLimit(params.query?.limit);
  const where = {
    tenant_id: params.tenantId,
    company_id: params.companyId,
    ...(params.query?.storeId?.trim() ? { store_id: params.query.storeId.trim() } : {}),
    ...(params.query?.actorRole?.trim() ? { actor_role: params.query.actorRole.trim() } : {}),
    ...(params.query?.module?.trim() ? { module: params.query.module.trim() } : {}),
    ...(params.query?.actionType?.trim() ? { action_type: params.query.actionType.trim() } : {}),
    ...(params.query?.resultStatus?.trim() ? { result_status: params.query.resultStatus.trim() } : {}),
    ...(buildCreatedAtRange(params.query) ? { created_at: buildCreatedAtRange(params.query) } : {}),
    ...(params.query?.actorUserId?.trim()
      ? {
          OR: [
            { actor_user_id: { contains: params.query.actorUserId.trim(), mode: "insensitive" as const } },
            { actor_name: { contains: params.query.actorUserId.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  return runAuditQuery(db, async (client) => {
    const [items, total] = await Promise.all([
      client.posAuditLog.findMany({
        where,
        orderBy: [{ created_at: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      client.posAuditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  });
}

export async function listPosAuditLogsForExport(
  params: TenantScope & { query?: PosAuditLogQuery },
  db: PosDbClient = prisma,
) {
  const limit = normalizeLimit(params.query?.limit || 100);
  const page = normalizePage(params.query?.page || 1);
  const where = {
    tenant_id: params.tenantId,
    company_id: params.companyId,
    ...(params.query?.storeId?.trim() ? { store_id: params.query.storeId.trim() } : {}),
    ...(params.query?.actorRole?.trim() ? { actor_role: params.query.actorRole.trim() } : {}),
    ...(params.query?.module?.trim() ? { module: params.query.module.trim() } : {}),
    ...(params.query?.actionType?.trim() ? { action_type: params.query.actionType.trim() } : {}),
    ...(params.query?.resultStatus?.trim() ? { result_status: params.query.resultStatus.trim() } : {}),
    ...(buildCreatedAtRange(params.query) ? { created_at: buildCreatedAtRange(params.query) } : {}),
    ...(params.query?.actorUserId?.trim()
      ? {
          OR: [
            { actor_user_id: { contains: params.query.actorUserId.trim(), mode: "insensitive" as const } },
            { actor_name: { contains: params.query.actorUserId.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  return runAuditQuery(db, (client) =>
    client.posAuditLog.findMany({
      where,
      orderBy: [{ created_at: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  );
}

export async function getPosAuditLogById(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runAuditQuery(db, (client) =>
    client.posAuditLog.findFirst({
      where: {
        id: params.id,
        tenant_id: params.tenantId,
        company_id: params.companyId,
      },
    }),
  );
}
