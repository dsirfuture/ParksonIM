// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { Session } from "@/lib/tenant";
import { withPrismaRetry } from "@/lib/prisma-retry";

export type PermissionKey =
  | "manageSuppliers"
  | "manageProducts"
  | "manageCustomers"
  | "exportProductCatalog"
  | "viewReports"
  | "inspectGoods"
  | "importReceipts"
  | "exportAllData"
  | "viewAllData";

export type PermissionState = Record<PermissionKey, boolean>;

export const WORKER_DEFAULT_PERMISSIONS: PermissionState = {
  manageSuppliers: true,
  manageProducts: true,
  manageCustomers: true,
  exportProductCatalog: true,
  viewReports: true,
  inspectGoods: true,
  importReceipts: true,
  exportAllData: false,
  viewAllData: false,
};

export const ADMIN_PERMISSIONS: PermissionState = {
  manageSuppliers: true,
  manageProducts: true,
  manageCustomers: true,
  exportProductCatalog: true,
  viewReports: true,
  inspectGoods: true,
  importReceipts: true,
  exportAllData: true,
  viewAllData: true,
};

export async function getPermissionState(session: Session): Promise<PermissionState> {
  if (session.role === "admin") return ADMIN_PERMISSIONS;
  const row = await withPrismaRetry(() =>
    prisma.userPermission.findFirst({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
      },
      select: {
        manage_suppliers: true,
        manage_products: true,
        manage_customers: true,
        export_product_catalog: true,
        view_reports: true,
        inspect_goods: true,
        import_receipts: true,
        export_all_data: true,
        view_all_data: true,
      },
    }),
  );
  if (!row) return WORKER_DEFAULT_PERMISSIONS;
  return {
    manageSuppliers: row.manage_suppliers,
    manageProducts: row.manage_products,
    manageCustomers: row.manage_customers,
    exportProductCatalog: row.export_product_catalog,
    viewReports: row.view_reports,
    inspectGoods: row.inspect_goods,
    importReceipts: row.import_receipts,
    exportAllData: row.export_all_data,
    viewAllData: row.view_all_data,
  };
}

export async function hasPermission(session: Session, permission: PermissionKey) {
  const state = await getPermissionState(session);
  return Boolean(state[permission]);
}
