// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import {
  applyPermissionTemplateToUser,
  getDefaultPermissionTemplateCode,
  hasAppPermission,
  replaceUserModulePermissionGrants,
  getUserPermissionPageData,
  syncPermissionCatalog,
} from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && !(await hasAppPermission(session, "admin.customer_permissions.manage")))) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const userId = String(body?.userId || "").trim();
  const templateCode = String(body?.templateCode || "").trim();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "缺少用户" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: {
      id: userId,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      role: true,
      user_type: true,
      dropshipping_customer_id: true,
    },
  });

  if (!target) {
    return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
  }
  if (session.role !== "admin" && !(target.user_type === "dropshipping_customer" || target.dropshipping_customer_id)) {
    return NextResponse.json({ ok: false, error: "仅可管理客户范围权限" }, { status: 403 });
  }

  await syncPermissionCatalog();

  if (target.dropshipping_customer_id && target.user_type !== "dropshipping_customer") {
    await replaceUserModulePermissionGrants({
      tenantId: session.tenantId,
      companyId: session.companyId,
      userId,
      moduleKeys: [],
    });
  } else {
    await applyPermissionTemplateToUser({
      tenantId: session.tenantId,
      companyId: session.companyId,
      userId,
      templateCode:
        templateCode
        || getDefaultPermissionTemplateCode({
          role: target.role,
          userType: target.user_type,
        }),
    });
  }

  const permissions = await getUserPermissionPageData({
    tenantId: session.tenantId,
    companyId: session.companyId,
    userId,
    role: target.role,
    userType: target.user_type,
    dropshippingCustomerId: target.dropshipping_customer_id,
  });

  return NextResponse.json({ ok: true, permissions });
}
