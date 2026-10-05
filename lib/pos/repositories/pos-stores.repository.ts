import { PrismaClient, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { listKnownPosStoreIds } from "@/lib/pos/repositories/pos-inventory.repository";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = PrismaClient | Prisma.TransactionClient;

function runStoreQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

export async function listPosStoreSettings(
  params: TenantScope,
  db: PosDbClient = prisma,
) {
  return runStoreQuery(db, async (client) => {
    const [rows, knownStoreIds] = await Promise.all([
      client.posStoreSetting.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
        },
        orderBy: [{ active: "desc" }, { store_name: "asc" }],
      }),
      listKnownPosStoreIds(params, client),
    ]);

    const rowMap = new Map(rows.map((item) => [item.store_id, item]));
    return Array.from(new Set([...knownStoreIds, ...rows.map((item) => item.store_id)])).map((storeId) => ({
      storeId,
      row: rowMap.get(storeId) || null,
    }));
  });
}

export async function getPosStoreSettingByStoreId(
  params: TenantScope & { storeId: string },
  db: PosDbClient = prisma,
) {
  return runStoreQuery(db, async (client) =>
    client.posStoreSetting.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: params.storeId,
      },
    }),
  );
}

export async function upsertPosStoreSetting(
  params: TenantScope & {
    storeId: string;
    input: {
      storeName: string;
      companyFullName?: string;
      storeCode?: string;
      address?: string;
      phone?: string;
      rfc?: string;
      active: boolean;
      defaultTicketHeader?: string;
      ticketSubtitle?: string;
      cashierAutoCloseEnabled?: boolean;
      cashierAutoCloseMinutes?: number;
    };
  },
  db: PosDbClient = prisma,
) {
  return runStoreQuery(db, (client) =>
    client.posStoreSetting.upsert({
      where: {
        tenant_id_company_id_store_id: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          store_id: params.storeId,
        },
      },
      update: {
        store_name: params.input.storeName,
        company_full_name: params.input.companyFullName === undefined ? undefined : params.input.companyFullName || null,
        store_code: params.input.storeCode || null,
        address: params.input.address || null,
        phone: params.input.phone || null,
        rfc: params.input.rfc || null,
        active: params.input.active,
        default_ticket_header: params.input.defaultTicketHeader || null,
        ticket_subtitle: params.input.ticketSubtitle || null,
        cashier_auto_close_enabled: params.input.cashierAutoCloseEnabled ?? false,
        cashier_auto_close_minutes: Math.max(1, Math.trunc(params.input.cashierAutoCloseMinutes ?? 10)),
      },
      create: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: params.storeId,
        store_name: params.input.storeName,
        company_full_name: params.input.companyFullName || null,
        store_code: params.input.storeCode || null,
        address: params.input.address || null,
        phone: params.input.phone || null,
        rfc: params.input.rfc || null,
        active: params.input.active,
        default_ticket_header: params.input.defaultTicketHeader || null,
        ticket_subtitle: params.input.ticketSubtitle || null,
        cashier_auto_close_enabled: params.input.cashierAutoCloseEnabled ?? false,
        cashier_auto_close_minutes: Math.max(1, Math.trunc(params.input.cashierAutoCloseMinutes ?? 10)),
      },
    }),
  );
}
