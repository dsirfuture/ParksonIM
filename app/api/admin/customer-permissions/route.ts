// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import {
  APP_PERMISSION_DEFINITIONS,
  buildGrantMapFromModulePermissionKeys,
  CORE_MODULE_PERMISSION_KEYS,
  getDefaultPermissionTemplateCode,
  getAssignableModulePermissionKeys,
  getModulePermissionKeysByTemplateCode,
  hasAppPermission,
  getUserPermissionPageData,
  PERMISSION_TEMPLATE_CODES,
  replaceUserPermissionGrants,
  syncPermissionCatalog,
  deriveModulePermissionKeysFromPermissionMap,
  normalizeModulePermissionKeys,
} from "@/lib/permissions";

async function requirePermissionsSession(permission: "view" | "manage") {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const permissionKey = permission === "manage"
    ? "admin.customer_permissions.manage"
    : "admin.customer_permissions.view";
  if (session.role !== "admin" && !(await hasAppPermission(session, permissionKey as any))) {
    return null;
  }
  return session;
}

async function loadUsers(session: Awaited<ReturnType<typeof getSession>>) {
  const users = await prisma.user.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      ...(session.role === "admin"
        ? {}
        : {
            OR: [
              { user_type: "dropshipping_customer" },
              { dropshipping_customer_id: { not: null } },
            ],
          }),
    },
    orderBy: [{ role: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      user_id: true,
      name: true,
      name_zh: true,
      name_en: true,
      phone: true,
      email: true,
      avatar_url: true,
      remark: true,
      data_source: true,
      role: true,
      user_type: true,
      active: true,
      default_landing_path: true,
      dropshipping_customer_id: true,
      customer_org_role: true,
      created_at: true,
      updated_at: true,
      dropshippingCustomer: {
        select: {
          name: true,
          custom_domain: true,
          custom_domain_enabled: true,
          default_access_url: true,
          domain_status: true,
        },
      },
      _count: {
        select: {
          inviteCodeUsages: true,
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    userId: user.user_id,
    name: user.name,
    nameZh: user.name_zh || null,
    nameEn: user.name_en || null,
    phone: user.phone,
    email: user.email || null,
    remark: user.remark || null,
    dataSource: user.data_source || "platform_created",
    avatarUrl: user.avatar_url || null,
    role: user.role,
    userType: user.user_type,
    dropshippingCustomerId: user.dropshipping_customer_id || null,
    customerOrgRole: user.customer_org_role || null,
    active: user.active,
    defaultLandingPath: user.default_landing_path || null,
    customerName: user.dropshippingCustomer?.name || null,
    customDomain: user.dropshippingCustomer?.custom_domain || null,
    customDomainEnabled: user.dropshippingCustomer?.custom_domain_enabled || false,
    defaultAccessUrl: user.dropshippingCustomer?.default_access_url || null,
    domainStatus: user.dropshippingCustomer?.domain_status || null,
    inviteRegistered: user._count.inviteCodeUsages > 0,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
  }));
}

export async function GET(req: NextRequest) {
  const session = await requirePermissionsSession("view");
  if (!session) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  await syncPermissionCatalog();
  const users = await loadUsers(session);
  const url = new URL(req.url);
  const requestedUserId = String(url.searchParams.get("userId") || "").trim();
  const preferredUserId = requestedUserId || session.userId;
  const selectedUser =
    users.find((item) => item.id === preferredUserId)
    || users.find((item) => item.role !== "admin")
    || users[0]
    || null;

  const selectedPermissions = selectedUser
    ? await getUserPermissionPageData({
        tenantId: session.tenantId,
        companyId: session.companyId,
        userId: selectedUser.id,
        role: selectedUser.role,
        userType: selectedUser.userType,
        dropshippingCustomerId: selectedUser.dropshippingCustomerId,
      })
    : [];
  const selectedModuleKeys = selectedUser
    ? deriveModulePermissionKeysFromPermissionMap(
        Object.fromEntries(selectedPermissions.map((item) => [item.key, item.allowed])),
      )
    : [];
  const inviteUsage = selectedUser
    ? await prisma.inviteCodeUsage.findFirst({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          user_id: selectedUser.id,
        },
        orderBy: { used_at: "asc" },
        select: {
          inviteCode: {
            select: {
              permission_template_code: true,
            },
          },
        },
      })
    : null;
  const inviteModuleKeys = await getModulePermissionKeysByTemplateCode(inviteUsage?.inviteCode?.permission_template_code || null);
  const explicitModuleKeys = selectedModuleKeys.filter((moduleKey) => !inviteModuleKeys.includes(moduleKey as any));

  return NextResponse.json({
    ok: true,
    users,
    selectedUser,
    permissions: selectedPermissions,
    definitions: APP_PERMISSION_DEFINITIONS,
    moduleDefinitions: CORE_MODULE_PERMISSION_KEYS,
    assignableModules: await getAssignableModulePermissionKeys(session),
    selectedModuleKeys,
    selectedModuleSources: {
      invite: inviteModuleKeys,
      appended: explicitModuleKeys,
    },
    templates: [
      {
        code: PERMISSION_TEMPLATE_CODES.staff,
        name: "后台员工默认权限",
      },
      {
        code: PERMISSION_TEMPLATE_CODES.dropshippingCustomer,
        name: "代发客户默认权限",
      },
      {
        code: PERMISSION_TEMPLATE_CODES.admin,
        name: "管理员默认权限",
      },
    ],
    defaultTemplateCode: selectedUser
      ? getDefaultPermissionTemplateCode({
          role: selectedUser.role,
          userType: selectedUser.userType,
        })
      : PERMISSION_TEMPLATE_CODES.staff,
  });
}

export async function PUT(req: NextRequest) {
  const session = await requirePermissionsSession("manage");
  if (!session) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const userId = String(body?.userId || "").trim();
  const grants = body?.grants && typeof body.grants === "object" ? body.grants : {};
  const moduleKeys = normalizeModulePermissionKeys(body?.moduleKeys);

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

  await syncPermissionCatalog();
  const isCustomerScopedTarget =
    target.user_type === "dropshipping_customer"
    || Boolean(target.dropshipping_customer_id);
  if (session.role !== "admin") {
    if (!isCustomerScopedTarget) {
      return NextResponse.json({ ok: false, error: "仅可管理客户范围权限" }, { status: 403 });
    }
    const assignableModules = new Set(await getAssignableModulePermissionKeys(session));
    if (moduleKeys.some((moduleKey) => !assignableModules.has(moduleKey))) {
      return NextResponse.json({ ok: false, error: "存在超出当前可分配范围的模块" }, { status: 403 });
    }
  }

  if (isCustomerScopedTarget) {
    await replaceUserPermissionGrants({
      tenantId: session.tenantId,
      companyId: session.companyId,
      userId,
      grants: buildGrantMapFromModulePermissionKeys(moduleKeys),
    });
  } else {
    await replaceUserPermissionGrants({
      tenantId: session.tenantId,
      companyId: session.companyId,
      userId,
      grants,
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

  return NextResponse.json({
    ok: true,
    permissions,
    selectedModuleKeys: deriveModulePermissionKeysFromPermissionMap(
      Object.fromEntries(permissions.map((item) => [item.key, item.allowed])),
    ),
  });
}
