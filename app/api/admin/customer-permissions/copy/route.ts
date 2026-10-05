// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { getUserPermissionPageData, hasAppPermission, replaceUserPermissionGrants, syncPermissionCatalog } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && !(await hasAppPermission(session, "admin.customer_permissions.manage")))) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const sourceUserId = String(body?.sourceUserId || "").trim();
  const targetUserId = String(body?.targetUserId || "").trim();

  if (!sourceUserId || !targetUserId) {
    return NextResponse.json({ ok: false, error: "缺少用户" }, { status: 400 });
  }

  const [sourceUser, targetUser, sourceGrants] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: sourceUserId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true, user_type: true, dropshipping_customer_id: true },
    }),
    prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true, role: true, user_type: true, dropshipping_customer_id: true },
    }),
    prisma.userPermissionGrant.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: sourceUserId,
      },
      select: {
        permission_key: true,
        allowed: true,
      },
    }),
  ]);

  if (!sourceUser || !targetUser) {
    return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
  }
  if (
    session.role !== "admin"
    && (
      !(sourceUser.user_type === "dropshipping_customer" || sourceUser.dropshipping_customer_id)
      || !(targetUser.user_type === "dropshipping_customer" || targetUser.dropshipping_customer_id)
    )
  ) {
    return NextResponse.json({ ok: false, error: "仅可复制客户范围权限" }, { status: 403 });
  }

  await syncPermissionCatalog();

  await replaceUserPermissionGrants({
    tenantId: session.tenantId,
    companyId: session.companyId,
    userId: targetUserId,
    grants: Object.fromEntries(sourceGrants.map((item) => [item.permission_key, item.allowed])),
  });

  const permissions = await getUserPermissionPageData({
    tenantId: session.tenantId,
    companyId: session.companyId,
    userId: targetUserId,
    role: targetUser.role,
    userType: targetUser.user_type,
    dropshippingCustomerId: targetUser.dropshipping_customer_id,
  });

  return NextResponse.json({ ok: true, permissions });
}
