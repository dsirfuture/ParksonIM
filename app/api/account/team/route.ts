import { NextRequest, NextResponse } from "next/server";
import { sanitizeAvatarUrl } from "@/lib/avatar-storage";
import { rebuildCustomerDefaultSlug } from "@/lib/customer-domain";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth";
import {
  CUSTOMER_SETTINGS_PERMISSION_KEYS,
  getCustomerSettingsAccess,
  replaceCustomerSettingsAccess,
} from "@/lib/customer-settings";
import {
  buildCustomerPermissionGrantMap,
  deriveCustomerPermissionGroupKeys,
  getAvailableCustomerPermissionGroups,
  getCustomerPermissionDefaultPath,
} from "@/lib/customer-settings-config";
import {
  getAppPermissionMap,
  replaceUserPermissionGrants,
} from "@/lib/permissions";
import {
  isValidDisplayName,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  normalizePhoneCountry,
} from "@/lib/user-account";

async function requireCustomerSettingsSession() {
  const session = await getSession();
  if (!session?.dropshippingCustomerId) return null;
  const settingsAccess = await getCustomerSettingsAccess(session);
  if (!settingsAccess.canView) return null;
  return { session, settingsAccess };
}

async function getCustomerOwnerPermissionMap(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
) {
  if (session.userType === "dropshipping_customer" || session.customerOrgRole === "owner") {
    return await getAppPermissionMap(session);
  }

  const owner = await prisma.user.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      dropshipping_customer_id: session.dropshippingCustomerId,
      active: true,
      OR: [{ user_type: "dropshipping_customer" }, { customer_org_role: "owner" }],
    },
    orderBy: [{ user_type: "desc" }, { created_at: "asc" }],
    select: {
      id: true,
      role: true,
      pos_role: true,
      pos_store_id: true,
      user_type: true,
      customer_org_role: true,
      tenant_id: true,
      company_id: true,
      dropshipping_customer_id: true,
      name: true,
      phone: true,
      avatar_url: true,
      default_landing_path: true,
    },
  });

  if (!owner) {
    return await getAppPermissionMap(session);
  }

  return await getAppPermissionMap({
    userId: owner.id,
    role: owner.role === "worker" ? "worker" : "admin",
    customerOrgRole:
      owner.customer_org_role === "owner" ||
      owner.customer_org_role === "manager" ||
      owner.customer_org_role === "staff"
        ? owner.customer_org_role
        : null,
    posRole: owner.role === "admin" ? "admin_general" : owner.pos_role === "cashier" ? "cashier" : "store_admin",
    posStoreId: owner.pos_store_id || null,
    tenantId: owner.tenant_id,
    companyId: owner.company_id,
    dropshippingCustomerId: owner.dropshipping_customer_id || null,
    name: owner.name,
    phone: owner.phone,
    avatarUrl: owner.avatar_url || null,
    userType: owner.user_type === "dropshipping_customer" ? "dropshipping_customer" : "staff",
    defaultLandingPath: owner.default_landing_path || null,
  });
}

export async function GET() {
  const auth = await requireCustomerSettingsSession();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const { session, settingsAccess } = auth;

  const [ownerPermissionMap, users] = await Promise.all([
    getCustomerOwnerPermissionMap(session),
    prisma.user.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        dropshipping_customer_id: session.dropshippingCustomerId,
      },
      orderBy: [{ created_at: "asc" }],
      select: {
        id: true,
        name: true,
        name_zh: true,
        name_en: true,
        user_id: true,
        phone: true,
        phone_country: true,
        email: true,
        avatar_url: true,
        remark: true,
        data_source: true,
        active: true,
        user_type: true,
        customer_org_role: true,
        created_at: true,
        updated_at: true,
      },
    }),
  ]);

  const grants = await prisma.userPermissionGrant.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: {
        in: users.map((item) => item.id),
      },
    },
    select: {
      user_id: true,
      permission_key: true,
      allowed: true,
    },
  });

  const grantMapByUserId = new Map<string, Record<string, boolean>>();
  for (const item of grants) {
    const current = grantMapByUserId.get(item.user_id) || {};
    current[item.permission_key] = item.allowed;
    grantMapByUserId.set(item.user_id, current);
  }

  const availableGroups = getAvailableCustomerPermissionGroups(ownerPermissionMap);

  return NextResponse.json({
    ok: true,
    canManageSettings: settingsAccess.canManage,
    availableGroups,
    members: users.map((user) => ({
      id: user.id,
      name: user.name,
      nameZh: user.name_zh || "",
      nameEn: user.name_en || "",
      userId: user.user_id,
      phone: user.phone,
      phoneCountry: user.phone_country || "MX",
      email: user.email || "",
      avatarUrl: sanitizeAvatarUrl(user.avatar_url),
      remark: user.remark || "",
      dataSource: user.data_source || "platform_created",
      active: user.active,
      userType: user.user_type,
      customerOrgRole: user.customer_org_role || (user.user_type === "dropshipping_customer" ? "owner" : "staff"),
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
      permissionGroupKeys: deriveCustomerPermissionGroupKeys(grantMapByUserId.get(user.id) || {}),
      canManageSettings:
        user.user_type === "dropshipping_customer" ||
        user.customer_org_role === "owner" ||
        Boolean(grantMapByUserId.get(user.id)?.[CUSTOMER_SETTINGS_PERMISSION_KEYS.manage]) ||
        Boolean(grantMapByUserId.get(user.id)?.[CUSTOMER_SETTINGS_PERMISSION_KEYS.view]),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireCustomerSettingsSession();
  if (!auth?.settingsAccess.canManage) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const { session } = auth;

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const nameZh = String(body?.nameZh || "").trim();
  const nameEn = String(body?.nameEn || "").trim();
  const userId = String(body?.userId || "").trim();
  const phoneCountry = normalizePhoneCountry(String(body?.phoneCountry || "").trim());
  const phoneRaw = String(body?.phone || "").trim();
  const email = String(body?.email || "").trim();
  const remark = String(body?.remark || "").trim();
  const password = String(body?.password || "").trim();
  const customerOrgRole = body?.customerOrgRole === "manager" ? "manager" : "staff";
  const canManageSettings = customerOrgRole === "manager" && body?.canManageSettings === true;
  const active = body?.active !== false;
  const permissionGroupKeys = Array.isArray(body?.permissionGroupKeys)
    ? body.permissionGroupKeys.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!isValidDisplayName(name)) {
    return NextResponse.json({ ok: false, error: "姓名格式不正确" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ ok: false, error: "请输入登录账号" }, { status: 400 });
  }
  if (!isValidPhone(phoneRaw, phoneCountry)) {
    return NextResponse.json({ ok: false, error: "请输入有效的手机号" }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "邮箱格式不正确" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "登录密码至少需要 6 位" }, { status: 400 });
  }

  const ownerPermissionMap = await getCustomerOwnerPermissionMap(session);
  const availableGroups = getAvailableCustomerPermissionGroups(ownerPermissionMap);
  const availableGroupKeys = new Set(availableGroups.map((group) => group.key));
  if (permissionGroupKeys.some((item: string) => !availableGroupKeys.has(item))) {
    return NextResponse.json({ ok: false, error: "存在超出客户当前权限范围的板块" }, { status: 403 });
  }

  const phone = normalizePhone(phoneRaw, phoneCountry);
  const duplicate = await prisma.user.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      OR: [{ phone }, { user_id: userId }, ...(email ? [{ email }] : [])],
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ ok: false, error: "登录账号、手机号或邮箱已存在" }, { status: 400 });
  }

  const defaultLandingPath = getCustomerPermissionDefaultPath(
    permissionGroupKeys,
    availableGroups,
  );

  const user = await prisma.user.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      dropshipping_customer_id: session.dropshippingCustomerId,
      user_id: userId,
      name,
      name_zh: nameZh || null,
      name_en: nameEn || null,
      phone,
      phone_country: phoneCountry,
      email: email || null,
      remark: remark || null,
      password_hash: hashPassword(password),
      role: "worker",
      user_type: "staff",
      customer_org_role: customerOrgRole,
      active,
      data_source: "customer_created",
      updated_by_user_id: session.userId,
      default_landing_path: defaultLandingPath,
    },
    select: {
      id: true,
      user_id: true,
      name: true,
      name_zh: true,
      name_en: true,
      phone: true,
      phone_country: true,
      email: true,
      active: true,
      remark: true,
      data_source: true,
      customer_org_role: true,
      user_type: true,
      created_at: true,
    },
  });

  await replaceUserPermissionGrants({
    tenantId: session.tenantId,
    companyId: session.companyId,
    userId: user.id,
    grants: buildCustomerPermissionGrantMap(permissionGroupKeys, availableGroups),
  });
  await replaceCustomerSettingsAccess({
    tenantId: session.tenantId,
    companyId: session.companyId,
    userId: user.id,
    allowView: canManageSettings,
    allowManage: canManageSettings,
  });

  return NextResponse.json({
    ok: true,
    member: {
      id: user.id,
      userId: user.user_id,
      name: user.name,
      nameZh: user.name_zh || "",
      nameEn: user.name_en || "",
      phone: user.phone,
      phoneCountry: user.phone_country || "MX",
      email: user.email || "",
      remark: user.remark || "",
      dataSource: user.data_source || "customer_created",
      active: user.active,
      userType: user.user_type,
      customerOrgRole: user.customer_org_role || "staff",
      createdAt: user.created_at.toISOString(),
      permissionGroupKeys,
      canManageSettings,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireCustomerSettingsSession();
  if (!auth?.settingsAccess.canManage) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const { session } = auth;

  const body = await req.json();
  const id = String(body?.id || "").trim();
  const name = String(body?.name || "").trim();
  const nameZh = String(body?.nameZh || "").trim();
  const nameEn = String(body?.nameEn || "").trim();
  const userId = String(body?.userId || "").trim();
  const phoneCountry = normalizePhoneCountry(String(body?.phoneCountry || "").trim());
  const phoneRaw = String(body?.phone || "").trim();
  const email = String(body?.email || "").trim();
  const remark = String(body?.remark || "").trim();
  const active = body?.active !== false;
  const password = String(body?.password || "").trim();
  const customerOrgRole = body?.customerOrgRole === "manager" ? "manager" : "staff";
  const canManageSettings = customerOrgRole === "manager" && body?.canManageSettings === true;
  const permissionGroupKeys = Array.isArray(body?.permissionGroupKeys)
    ? body.permissionGroupKeys.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!id) {
    return NextResponse.json({ ok: false, error: "缺少成员" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ ok: false, error: "请输入登录账号" }, { status: 400 });
  }
  const target = await prisma.user.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
      dropshipping_customer_id: session.dropshippingCustomerId,
    },
    select: {
      id: true,
      user_type: true,
      customer_org_role: true,
      dropshipping_customer_id: true,
    },
  });
  if (!target) {
    return NextResponse.json({ ok: false, error: "成员不存在" }, { status: 404 });
  }
  const targetIsOwner =
    target.user_type === "dropshipping_customer" || target.customer_org_role === "owner";
  if (targetIsOwner && !(session.userType === "dropshipping_customer" || session.customerOrgRole === "owner")) {
    return NextResponse.json({ ok: false, error: "无权限编辑主账号" }, { status: 403 });
  }
  if (!isValidDisplayName(name)) {
    return NextResponse.json({ ok: false, error: "姓名格式不正确" }, { status: 400 });
  }
  if (!isValidPhone(phoneRaw, phoneCountry)) {
    return NextResponse.json({ ok: false, error: "请输入有效的手机号" }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "邮箱格式不正确" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ ok: false, error: "登录密码至少需要 6 位" }, { status: 400 });
  }

  const ownerPermissionMap = await getCustomerOwnerPermissionMap(session);
  const availableGroups = getAvailableCustomerPermissionGroups(ownerPermissionMap);
  const availableGroupKeys = new Set(availableGroups.map((group) => group.key));
  if (permissionGroupKeys.some((item: string) => !availableGroupKeys.has(item))) {
    return NextResponse.json({ ok: false, error: "存在超出客户当前权限范围的板块" }, { status: 403 });
  }

  const defaultLandingPath = getCustomerPermissionDefaultPath(
    permissionGroupKeys,
    availableGroups,
  );
  const phone = normalizePhone(phoneRaw, phoneCountry);

  const duplicate = await prisma.user.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      id: { not: id },
      OR: [{ phone }, { user_id: userId }, ...(email ? [{ email }] : [])],
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ ok: false, error: "登录账号、手机号或邮箱已存在" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        user_id: userId,
        name,
        name_zh: nameZh || null,
        name_en: nameEn || null,
        phone,
        phone_country: phoneCountry,
        company_name: targetIsOwner ? (String(body?.companyDisplayName || "").trim() || null) : undefined,
        email: email || null,
        remark: remark || null,
        active: targetIsOwner ? true : active,
        customer_org_role: targetIsOwner ? "owner" : customerOrgRole,
        updated_by_user_id: session.userId,
        default_landing_path: defaultLandingPath,
        ...(password ? { password_hash: hashPassword(password) } : {}),
      },
    });

    if (target.dropshipping_customer_id && targetIsOwner) {
      const customer = await tx.dropshippingCustomer.findUnique({
        where: { id: target.dropshipping_customer_id },
        select: {
          id: true,
          tenant_id: true,
          company_id: true,
          name: true,
        },
      });
      if (customer) {
        const companyDisplayName = String(body?.companyDisplayName || "").trim() || customer.name || name;
        const companyNameZh = String(body?.companyNameZh || "").trim() || nameZh;
        const companyNameEn = String(body?.companyNameEn || "").trim() || nameEn;
        const nextAccess = await rebuildCustomerDefaultSlug({
          customerId: customer.id,
          tenantId: customer.tenant_id,
          companyId: customer.company_id,
          name: companyDisplayName,
          nameZh: companyNameZh || null,
          nameEn: companyNameEn || null,
          db: tx,
        });

        await tx.dropshippingCustomer.update({
          where: { id: customer.id },
          data: {
            name: companyDisplayName,
            name_zh: companyNameZh || null,
            name_en: companyNameEn || null,
            contact_name: name,
            phone,
            default_slug: nextAccess.defaultSlug,
            default_access_url: nextAccess.defaultAccessUrl,
          },
        });
      }
    }
  });

  await replaceUserPermissionGrants({
    tenantId: session.tenantId,
    companyId: session.companyId,
    userId: id,
    grants: buildCustomerPermissionGrantMap(permissionGroupKeys, availableGroups),
  });
  await replaceCustomerSettingsAccess({
    tenantId: session.tenantId,
    companyId: session.companyId,
    userId: id,
    allowView: targetIsOwner ? true : canManageSettings,
    allowManage: targetIsOwner ? true : canManageSettings,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireCustomerSettingsSession();
  if (!auth?.settingsAccess.canManage) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const { session } = auth;

  const body = await req.json();
  const id = String(body?.id || "").trim();
  const confirmAccount = String(body?.confirmAccount || "").trim();
  const confirmDelete = String(body?.confirmDelete || "").trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: "缺少用户标识" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
      dropshipping_customer_id: session.dropshippingCustomerId,
    },
    select: {
      id: true,
      user_id: true,
      user_type: true,
      customer_org_role: true,
    },
  });

  if (!target) {
    return NextResponse.json({ ok: false, error: "成员不存在" }, { status: 404 });
  }

  if (target.user_type === "dropshipping_customer" || target.customer_org_role === "owner") {
    return NextResponse.json({ ok: false, error: "主账号不允许删除" }, { status: 400 });
  }

  if (id === session.userId) {
    return NextResponse.json({ ok: false, error: "不能删除当前登录账号" }, { status: 400 });
  }

  if (!confirmAccount || !confirmDelete) {
    return NextResponse.json(
      { ok: false, error: "请完整输入账号和删除文案" },
      { status: 400 },
    );
  }

  const targetAccount = String(target.user_id || "").trim();
  if (confirmAccount !== targetAccount || confirmDelete !== "删除") {
    return NextResponse.json({ ok: false, error: "删除校验未通过" }, { status: 400 });
  }

  await prisma.userPermissionGrant.deleteMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: id,
    },
  });

  await prisma.user.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true, id });
}
