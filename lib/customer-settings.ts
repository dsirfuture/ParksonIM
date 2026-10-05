import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import type { Session } from "@/lib/tenant";

export const CUSTOMER_SETTINGS_PERMISSION_KEYS = {
  view: "customer.settings.view",
  manage: "customer.settings.manage",
} as const;

export type CustomerSettingsAccess = {
  canView: boolean;
  canManage: boolean;
};

export async function getCustomerSettingsAccess(
  session: Session | null | undefined,
): Promise<CustomerSettingsAccess> {
  if (!session?.dropshippingCustomerId) {
    return { canView: false, canManage: false };
  }

  if (
    session.userType === "dropshipping_customer" ||
    session.customerOrgRole === "owner"
  ) {
    return { canView: true, canManage: true };
  }

  if (session.customerOrgRole !== "manager") {
    return { canView: false, canManage: false };
  }

  const rows = await withPrismaRetry(() =>
    prisma.userPermissionGrant.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
        permission_key: {
          in: [
            CUSTOMER_SETTINGS_PERMISSION_KEYS.view,
            CUSTOMER_SETTINGS_PERMISSION_KEYS.manage,
          ],
        },
      },
      select: {
        permission_key: true,
        allowed: true,
      },
    }),
  );

  const canManage = rows.some(
    (item) =>
      item.permission_key === CUSTOMER_SETTINGS_PERMISSION_KEYS.manage &&
      item.allowed,
  );
  const canView =
    canManage ||
    rows.some(
      (item) =>
        item.permission_key === CUSTOMER_SETTINGS_PERMISSION_KEYS.view &&
        item.allowed,
    );

  return { canView, canManage };
}

export async function replaceCustomerSettingsAccess(params: {
  tenantId: string;
  companyId: string;
  userId: string;
  allowView: boolean;
  allowManage: boolean;
}) {
  const { tenantId, companyId, userId, allowView, allowManage } = params;
  const data: Array<{
    tenant_id: string;
    company_id: string;
    user_id: string;
    permission_key: string;
    allowed: boolean;
  }> = [];

  if (allowView || allowManage) {
    data.push({
      tenant_id: tenantId,
      company_id: companyId,
      user_id: userId,
      permission_key: CUSTOMER_SETTINGS_PERMISSION_KEYS.view,
      allowed: true,
    });
  }

  if (allowManage) {
    data.push({
      tenant_id: tenantId,
      company_id: companyId,
      user_id: userId,
      permission_key: CUSTOMER_SETTINGS_PERMISSION_KEYS.manage,
      allowed: true,
    });
  }

  await withPrismaRetry(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.userPermissionGrant.deleteMany({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          user_id: userId,
          permission_key: {
            in: [
              CUSTOMER_SETTINGS_PERMISSION_KEYS.view,
              CUSTOMER_SETTINGS_PERMISSION_KEYS.manage,
            ],
          },
        },
      });

      if (data.length > 0) {
        await tx.userPermissionGrant.createMany({ data });
      }
    });
  });
}
