import { PrismaClient, type Prisma, type PosUserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = PrismaClient | Prisma.TransactionClient;
type PosPermissionOverrideEffect = "grant" | "deny";

function runCashierQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

export async function listPosCashierUsers(
  params: TenantScope & {
    storeId?: string;
    keyword?: string;
    role?: string;
    status?: string;
  },
  db: PosDbClient = prisma,
) {
  const keyword = params.keyword?.trim();
  const role = params.role?.trim();
  const status = params.status?.trim();
  return runCashierQuery(db, (client) =>
    client.user.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.storeId ? { pos_store_id: params.storeId } : {}),
        ...(role ? { pos_role: role as PosUserRole } : {}),
        ...(status ? { active: status === "active" } : {}),
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: "insensitive" } },
                { user_id: { contains: keyword, mode: "insensitive" } },
                { phone: { contains: keyword, mode: "insensitive" } },
                { email: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ active: "desc" }, { updated_at: "desc" }],
      select: {
        id: true,
        user_id: true,
        name: true,
        phone: true,
        phone_country: true,
        email: true,
        avatar_url: true,
        pos_store_id: true,
        pos_role: true,
        active: true,
        updated_at: true,
      },
    }),
  );
}

export async function getPosCashierUserById(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runCashierQuery(db, (client) =>
    client.user.findFirst({
      where: {
        id: params.id,
        tenant_id: params.tenantId,
        company_id: params.companyId,
      },
      select: {
        id: true,
        user_id: true,
        name: true,
        phone: true,
        phone_country: true,
        email: true,
        avatar_url: true,
        pos_store_id: true,
        pos_role: true,
        active: true,
        updated_at: true,
      },
    }),
  );
}

export async function createPosCashierUser(
  params: TenantScope & {
    input: {
      account: string;
      name: string;
      phone: string;
      phoneCountry: string;
      email?: string;
      passwordHash: string;
      storeId: string;
      role: PosUserRole;
      active: boolean;
    };
  },
  db: PosDbClient = prisma,
) {
  return runCashierQuery(db, (client) =>
    client.user.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        user_id: params.input.account,
        name: params.input.name,
        phone: params.input.phone,
        phone_country: params.input.phoneCountry,
        email: params.input.email || null,
        password_hash: params.input.passwordHash,
        role: params.input.role === "admin_general" ? "admin" : "worker",
        pos_role: params.input.role,
        pos_store_id: params.input.storeId,
        active: params.input.active,
      },
      select: {
        id: true,
        user_id: true,
        name: true,
        phone: true,
        phone_country: true,
        email: true,
        avatar_url: true,
        pos_store_id: true,
        pos_role: true,
        active: true,
        updated_at: true,
      },
    }),
  );
}

export async function updatePosCashierUser(
  params: TenantScope & {
    id: string;
    input: {
      account: string;
      name: string;
      phone: string;
      phoneCountry: string;
      email?: string;
      passwordHash?: string;
      storeId: string;
      role: PosUserRole;
      active: boolean;
    };
  },
  db: PosDbClient = prisma,
) {
  return runCashierQuery(db, (client) =>
    client.user.update({
      where: { id: params.id },
      data: {
        user_id: params.input.account,
        name: params.input.name,
        phone: params.input.phone,
        phone_country: params.input.phoneCountry,
        email: params.input.email || null,
        role: params.input.role === "admin_general" ? "admin" : "worker",
        pos_role: params.input.role,
        pos_store_id: params.input.storeId,
        active: params.input.active,
        ...(params.input.passwordHash ? { password_hash: params.input.passwordHash } : {}),
      },
      select: {
        id: true,
        user_id: true,
        name: true,
        phone: true,
        phone_country: true,
        email: true,
        avatar_url: true,
        pos_store_id: true,
        pos_role: true,
        active: true,
        updated_at: true,
      },
    }),
  );
}

export async function updatePosCashierUserStatus(
  params: TenantScope & { id: string; active: boolean },
  db: PosDbClient = prisma,
) {
  return runCashierQuery(db, (client) =>
    client.user.update({
      where: { id: params.id },
      data: { active: params.active },
      select: {
        id: true,
        user_id: true,
        name: true,
        phone: true,
        phone_country: true,
        email: true,
        avatar_url: true,
        pos_store_id: true,
        pos_role: true,
        active: true,
        updated_at: true,
      },
    }),
  );
}

export async function findPosCashierDuplicate(
  params: TenantScope & {
    account: string;
    phone: string;
    excludeId?: string;
  },
  db: PosDbClient = prisma,
) {
  return runCashierQuery(db, (client) =>
    client.user.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        OR: [
          { user_id: params.account },
          { phone: params.phone },
        ],
      },
      select: { id: true },
    }),
  );
}

export async function listPosCashierPermissionOverrides(
  params: TenantScope & { userId: string },
  db: PosDbClient = prisma,
) {
  return runCashierQuery(db, (client) =>
    (client as any).posUserPermissionOverride.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        user_id: params.userId,
      },
      orderBy: [{ permission_key: "asc" }],
      select: {
        permission_key: true,
        effect: true,
      },
    }),
  );
}

export async function replacePosCashierPermissionOverrides(
  params: TenantScope & {
    userId: string;
    createdBy?: string;
    overrides: Array<{ permissionKey: string; effect: PosPermissionOverrideEffect }>;
  },
  db: PosDbClient = prisma,
) {
  return runCashierQuery(db, async (client) => {
    await (client as any).posUserPermissionOverride.deleteMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        user_id: params.userId,
      },
    });

    if (!params.overrides.length) return;

    await (client as any).posUserPermissionOverride.createMany({
      data: params.overrides.map((item) => ({
        tenant_id: params.tenantId,
        company_id: params.companyId,
        user_id: params.userId,
        permission_key: item.permissionKey,
        effect: item.effect,
        created_by: params.createdBy || null,
      })),
    });
  });
}
