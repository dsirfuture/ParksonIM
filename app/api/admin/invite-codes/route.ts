// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import {
  buildInviteTemplateCode,
  CORE_MODULE_PERMISSION_KEYS,
  getAssignableModulePermissionKeys,
  getModulePermissionKeysByTemplateCode,
  hasAppPermission,
  normalizeModulePermissionKeys,
  upsertPermissionTemplateFromModules,
} from "@/lib/permissions";

function randomInviteCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let index = 0; index < 8; index += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BS${suffix}`;
}

async function requireInvitePermission(permission: "view" | "manage") {
  const session = await getSession();
  if (!session) return null;
  const key = permission === "manage" ? "admin.invite_codes.manage" : "admin.invite_codes.view";
  if (!(await hasAppPermission(session, key))) return null;
  return session;
}

export async function GET() {
  const session = await requireInvitePermission("view");
  if (!session) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const items = await prisma.inviteCode.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: [{ created_at: "desc" }],
    take: 100,
    include: {
      usages: {
        orderBy: [{ used_at: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              user_id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    assignableModules: await getAssignableModulePermissionKeys(session),
    moduleDefinitions: CORE_MODULE_PERMISSION_KEYS,
    items: await Promise.all(items.map(async (item) => ({
      id: item.id,
      code: item.code,
      status: item.status,
      maxUses: item.max_uses,
      usedCount: item.used_count,
      expiresAt: item.expires_at?.toISOString() || null,
      remark: item.remark || "",
      registerUserType: item.register_user_type,
      permissionTemplateCode: item.permission_template_code || null,
      moduleKeys: await getModulePermissionKeysByTemplateCode(item.permission_template_code),
      used: item.used_count > 0,
      relatedAccounts: item.usages.map((usage) => ({
        id: usage.user.id,
        account: usage.user.user_id || usage.user.phone || usage.user.email || usage.user.name,
        name: usage.user.name,
        phone: usage.user.phone,
        email: usage.user.email,
        usedAt: usage.used_at.toISOString(),
      })),
      createdAt: item.created_at.toISOString(),
      updatedAt: item.updated_at.toISOString(),
    }))),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireInvitePermission("manage");
  if (!session) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  let code = String(body?.code || "").trim();
  const maxUses = Math.max(1, Number(body?.maxUses || 1));
  const remark = String(body?.remark || "").trim();
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  const moduleKeys = normalizeModulePermissionKeys(body?.moduleKeys);
  const assignableModules = new Set(await getAssignableModulePermissionKeys(session));

  if (!moduleKeys.length) {
    return NextResponse.json({ ok: false, error: "请至少选择一个模块" }, { status: 400 });
  }
  if (moduleKeys.some((moduleKey) => !assignableModules.has(moduleKey))) {
    return NextResponse.json({ ok: false, error: "存在超出当前可分配范围的模块" }, { status: 403 });
  }

  if (!code) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomInviteCode();
      const exists = await prisma.inviteCode.findFirst({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          code: {
            equals: candidate,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });
      if (!exists) {
        code = candidate;
        break;
      }
    }
  }

  if (!code) {
    return NextResponse.json({ ok: false, error: "生成邀请码失败，请重试" }, { status: 500 });
  }

  const item = await prisma.inviteCode.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      code,
      status: "active",
      max_uses: maxUses,
      used_count: 0,
      expires_at: expiresAt,
      remark: remark || null,
      created_by: session.userId,
      register_user_type: "dropshipping_customer",
      permission_template_code: null,
    },
  });

  const templateCode = buildInviteTemplateCode(item.id);
  await upsertPermissionTemplateFromModules({
    templateCode,
    templateName: `邀请码 ${item.code}`,
    description: `邀请码模块授权：${item.code}`,
    moduleKeys,
  });

  await prisma.inviteCode.update({
    where: { id: item.id },
    data: {
      permission_template_code: templateCode,
    },
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: item.id,
      code: item.code,
      status: item.status,
      maxUses: item.max_uses,
      usedCount: item.used_count,
      expiresAt: item.expires_at?.toISOString() || null,
      remark: item.remark || "",
      moduleKeys,
      permissionTemplateCode: templateCode,
      createdAt: item.created_at.toISOString(),
      updatedAt: item.updated_at.toISOString(),
    },
  });
}
