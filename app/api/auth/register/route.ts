// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createSignedSession,
  createSignedRecentSessions,
  hashPassword,
  mergeRecentSessions,
  readSignedRecentSessions,
  RECENT_SESSIONS_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import {
  getRegisterIp,
  validateInviteCode,
} from "@/lib/invite-codes";
import {
  applyPermissionTemplateToUser,
  getDefaultPermissionTemplateCode,
} from "@/lib/permissions";
import { rebuildCustomerDefaultSlug } from "@/lib/customer-domain";
import {
  isValidDisplayName,
  isValidCompanyName,
  isValidEmail,
  isValidPhone,
  normalizePhoneCountry,
  normalizePhone,
} from "@/lib/user-account";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const companyName = String(body?.companyName || "").trim();
    const phoneCountry = normalizePhoneCountry(String(body?.phoneCountry || "").trim());
    const phoneRaw = String(body?.phone || "").trim();
    const password = String(body?.password || "").trim();
    const email = String(body?.email || "").trim();
    const inviteCodeRaw = String(body?.inviteCode || "").trim();

    if (!isValidDisplayName(name)) {
      return NextResponse.json(
        { ok: false, error: "姓名格式不正确" },
        { status: 400 },
      );
    }

    if (!isValidCompanyName(companyName)) {
      return NextResponse.json(
        { ok: false, error: "公司名格式不正确" },
        { status: 400 },
      );
    }

    if (!isValidPhone(phoneRaw, phoneCountry)) {
      return NextResponse.json(
        { ok: false, error: "请输入有效的手机号" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "登录密码至少需要 6 位" },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "邮箱格式不正确" },
        { status: 400 },
      );
    }

    const company = await prisma.company.findFirst({
      orderBy: { created_at: "asc" },
      select: { id: true, tenant_id: true },
    });

    if (!company) {
      return NextResponse.json(
        { ok: false, error: "当前系统尚未初始化公司数据" },
        { status: 400 },
      );
    }

    const phone = normalizePhone(phoneRaw, phoneCountry);
    const inviteCodeText = inviteCodeRaw.trim();
    const customerDisplayName = companyName || name;

    const inviteValidation = await validateInviteCode({
      tenantId: company.tenant_id,
      companyId: company.id,
      code: inviteCodeText,
    });

    if (!inviteValidation.ok || !inviteValidation.inviteCode) {
      return NextResponse.json(
        { ok: false, error: inviteValidation.message || "邀请码无效" },
        { status: 400 },
      );
    }

    const exists = await prisma.user.findFirst({
      where: {
        tenant_id: company.tenant_id,
        company_id: company.id,
        OR: [{ phone }, ...(email ? [{ email }] : [])],
      },
      select: { id: true, phone: true, email: true },
    });

    if (exists) {
      const duplicatePhone = exists.phone === phone;
      const duplicateEmail = Boolean(email) && exists.email === email;
      const duplicateFields = [
        duplicatePhone ? "手机号" : null,
        duplicateEmail ? "邮箱" : null,
      ].filter(Boolean);
      return NextResponse.json(
        { ok: false, error: `${duplicateFields.join("、") || "账号信息"}已存在` },
        { status: 400 },
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      const freshInviteCode = await tx.inviteCode.findFirst({
        where: {
          id: inviteValidation.inviteCode.id,
          tenant_id: company.tenant_id,
          company_id: company.id,
        },
      });

      if (!freshInviteCode) {
        throw new Error("邀请码无效");
      }
      if (freshInviteCode.status === "disabled") {
        throw new Error("邀请码已失效");
      }
      if (
        freshInviteCode.status === "expired"
        || (freshInviteCode.expires_at && freshInviteCode.expires_at.getTime() <= Date.now())
      ) {
        throw new Error("邀请码已失效");
      }
      if (freshInviteCode.max_uses > 0 && freshInviteCode.used_count >= freshInviteCode.max_uses) {
        throw new Error("邀请码不可用");
      }

      const dropshippingCustomer = await tx.dropshippingCustomer.upsert({
        where: {
          tenant_id_company_id_name: {
            tenant_id: company.tenant_id,
            company_id: company.id,
            name: customerDisplayName,
          },
        },
        update: {
          name: customerDisplayName,
          name_zh: companyName || null,
          contact_name: name,
          phone,
        },
        create: {
          tenant_id: company.tenant_id,
          company_id: company.id,
          name: customerDisplayName,
          name_zh: companyName || null,
          contact_name: name,
          phone,
        },
        select: {
          id: true,
          tenant_id: true,
          company_id: true,
          name: true,
        },
      });

      const defaultAccess = await rebuildCustomerDefaultSlug({
        customerId: dropshippingCustomer.id,
        tenantId: dropshippingCustomer.tenant_id,
        companyId: dropshippingCustomer.company_id,
        name: dropshippingCustomer.name,
        nameZh: companyName || null,
        db: tx,
      });

      await tx.dropshippingCustomer.update({
        where: { id: dropshippingCustomer.id },
        data: {
          default_slug: defaultAccess.defaultSlug,
          default_access_url: defaultAccess.defaultAccessUrl,
          domain_source: "system_default",
          domain_status: "not_set",
        },
      });

      const createdUser = await tx.user.create({
        data: {
          tenant_id: company.tenant_id,
          company_id: company.id,
          dropshipping_customer_id: dropshippingCustomer.id,
          user_id: phone,
          name,
          name_zh: name,
          phone,
          phone_country: phoneCountry,
          company_name: companyName || null,
          email: email || null,
          avatar_url: null,
          data_source: "invite_registered",
          password_hash: hashPassword(password),
          role: "worker",
          user_type: freshInviteCode.register_user_type || "dropshipping_customer",
          customer_org_role: "owner",
          active: true,
          default_landing_path: "/dropshipping?tab=quick_setup",
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          user_type: true,
          tenant_id: true,
          company_id: true,
          dropshipping_customer_id: true,
          default_landing_path: true,
        },
      });

      const nextUsedCount = freshInviteCode.used_count + 1;
      await tx.inviteCodeUsage.create({
        data: {
          tenant_id: company.tenant_id,
          company_id: company.id,
          invite_code_id: freshInviteCode.id,
          user_id: createdUser.id,
          register_ip: getRegisterIp(req),
          register_source: "register_page",
        },
      });
      await tx.inviteCode.update({
        where: { id: freshInviteCode.id },
        data: {
          used_count: nextUsedCount,
          status:
            freshInviteCode.max_uses > 0 && nextUsedCount >= freshInviteCode.max_uses
              ? "disabled"
              : freshInviteCode.status,
        },
      });

      return {
        ...createdUser,
        permissionTemplateCode:
          freshInviteCode.permission_template_code
          || getDefaultPermissionTemplateCode({
            role: createdUser.role,
            userType: createdUser.user_type,
          }),
      };
    });

    await applyPermissionTemplateToUser({
      tenantId: company.tenant_id,
      companyId: company.id,
      userId: user.id,
      templateCode: user.permissionTemplateCode,
    });

    const redirectTo = user.default_landing_path || "/dropshipping?tab=quick_setup";
    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
      redirectTo,
    });

    const currentSessionPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      companyId: user.company_id,
      role: user.role,
      userType: user.user_type,
      defaultPath: redirectTo,
    } as const;

    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSignedSession(currentSessionPayload),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    );

    const remembered = readSignedRecentSessions(
      req.cookies.get(RECENT_SESSIONS_COOKIE_NAME)?.value,
    );
    response.cookies.set(
      RECENT_SESSIONS_COOKIE_NAME,
      createSignedRecentSessions(
        mergeRecentSessions(remembered, currentSessionPayload),
      ),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 180,
      },
    );

    return response;
  } catch (error) {
    console.error("register failed", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "手机号或邮箱已存在" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "当前未能完成注册 请稍后再试" },
      { status: 500 },
    );
  }
}
