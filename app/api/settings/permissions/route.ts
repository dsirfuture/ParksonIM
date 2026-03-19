// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { ADMIN_PERMISSIONS, WORKER_DEFAULT_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });

    const users = await withPrismaRetry(() =>
      prisma.user.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        active: true,
      },
      orderBy: [{ role: "asc" }, { created_at: "asc" }],
      select: { id: true, name: true, phone: true, role: true },
      }),
    );

    const permissions = await withPrismaRetry(() =>
      prisma.userPermission.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        user_id: true,
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
    const map = new Map(permissions.map((p) => [p.user_id, p]));

    return NextResponse.json({
      ok: true,
      items: users.map((u) => {
        if (u.role === "admin") {
          return { ...u, permissions: ADMIN_PERMISSIONS };
        }
        const p = map.get(u.id);
        const worker = p
          ? {
              manageSuppliers: p.manage_suppliers,
              manageProducts: p.manage_products,
              manageCustomers: p.manage_customers,
              exportProductCatalog: p.export_product_catalog,
              viewReports: p.view_reports,
              inspectGoods: p.inspect_goods,
              importReceipts: p.import_receipts,
              exportAllData: p.export_all_data,
              viewAllData: p.view_all_data,
            }
          : WORKER_DEFAULT_PERMISSIONS;
        return { ...u, permissions: worker };
      }),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "读取权限失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const body = (await request.json()) as {
      userId?: string;
      permissions?: Record<string, boolean>;
    };
    const userId = String(body.userId || "").trim();
    if (!userId) return NextResponse.json({ ok: false, error: "缺少用户" }, { status: 400 });

    const target = await withPrismaRetry(() =>
      prisma.user.findFirst({
      where: { id: userId, tenant_id: session.tenantId, company_id: session.companyId },
      select: { id: true, role: true },
      }),
    );
    if (!target) return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
    if (target.role === "admin") return NextResponse.json({ ok: false, error: "管理员默认全权限，无需修改" }, { status: 400 });

    const p = body.permissions || {};
    await withPrismaRetry(() => prisma.userPermission.upsert({
      where: {
        tenant_id_company_id_user_id: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          user_id: userId,
        },
      },
      create: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: userId,
        manage_suppliers: Boolean(p.manageSuppliers),
        manage_products: Boolean(p.manageProducts),
        manage_customers: Boolean(p.manageCustomers),
        export_product_catalog: Boolean(p.exportProductCatalog),
        view_reports: Boolean(p.viewReports),
        inspect_goods: Boolean(p.inspectGoods),
        import_receipts: Boolean(p.importReceipts),
        export_all_data: Boolean(p.exportAllData),
        view_all_data: Boolean(p.viewAllData),
      },
      update: {
        manage_suppliers: Boolean(p.manageSuppliers),
        manage_products: Boolean(p.manageProducts),
        manage_customers: Boolean(p.manageCustomers),
        export_product_catalog: Boolean(p.exportProductCatalog),
        view_reports: Boolean(p.viewReports),
        inspect_goods: Boolean(p.inspectGoods),
        import_receipts: Boolean(p.importReceipts),
        export_all_data: Boolean(p.exportAllData),
        view_all_data: Boolean(p.viewAllData),
      },
    }));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "保存权限失败" }, { status: 500 });
  }
}

