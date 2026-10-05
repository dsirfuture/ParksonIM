// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSignedSession,
  createSignedRecentSessions,
  mergeRecentSessions,
  readSignedRecentSessions,
  RECENT_SESSIONS_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { normalizeLoginPhone } from "@/lib/user-account";
import { getResolvedLandingPath } from "@/lib/permissions";

function getLoginErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (
    lowered.includes("exceeded the data transfer quota") ||
    lowered.includes("can't reach database server") ||
    lowered.includes("connectorerror") ||
    lowered.includes("database") ||
    lowered.includes("p1001") ||
    lowered.includes("p1017")
  ) {
    return "登录服务暂时不可用，请稍后再试";
  }

  return "当前未能完成登录，请稍后再试";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const account = String(body?.account || "").trim();
    const password = String(body?.password || "").trim();

    if (!account || !password) {
      return NextResponse.json(
        { success: false, error: "请输入账号或手机号和密码" },
        { status: 400 },
      );
    }

    const phone = normalizeLoginPhone(account);

    const user = await withPrismaRetry(() =>
      prisma.user.findFirst({
        where: {
          active: true,
          OR: [
            { user_id: account },
            { name: { equals: account, mode: "insensitive" } },
            { email: { equals: account, mode: "insensitive" } },
            { phone: account },
            { phone: phone || "__invalid__" },
          ],
        },
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
          password_hash: true,
          default_landing_path: true,
        },
        orderBy: {
          created_at: "asc",
        },
      }),
    );

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { success: false, error: "账号或密码不正确" },
        { status: 401 },
      );
    }

    const currentSessionPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      companyId: user.company_id,
      role: user.role,
      userType: user.user_type,
      defaultPath:
        user.default_landing_path &&
        user.default_landing_path !== "/login" &&
        user.default_landing_path !== "/register"
          ? user.default_landing_path
          : null,
    } as const;

    const redirectTo = await getResolvedLandingPath({
      userId: user.id,
      role: user.role,
      customerOrgRole: user.customer_org_role || null,
      posRole: user.role === "admin" ? "admin_general" : user.pos_role === "cashier" ? "cashier" : "store_admin",
      posStoreId: user.pos_store_id || null,
      tenantId: user.tenant_id,
      companyId: user.company_id,
      dropshippingCustomerId: user.dropshipping_customer_id || null,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatar_url || null,
      userType: user.user_type === "dropshipping_customer" ? "dropshipping_customer" : "staff",
      defaultLandingPath: currentSessionPayload.defaultPath || null,
    });

    const response = NextResponse.json({ success: true, redirectTo });

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
    console.error("[auth/login] login failed:", error);

    const payload: { success: false; error: string; details?: string } = {
      success: false,
      error: getLoginErrorMessage(error),
    };

    if (process.env.NODE_ENV !== "production") {
      payload.details = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json(payload, { status: 500 });
  }
}
