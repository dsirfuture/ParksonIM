import { NextRequest, NextResponse } from "next/server";
import {
  createSignedRecentSessions,
  createSignedSession,
  mergeRecentSessions,
  readSignedRecentSessions,
  RECENT_SESSIONS_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { getResolvedLandingPath } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const slot = Number(payload?.slot);
  if (!Number.isInteger(slot) || slot < 0) {
    return NextResponse.json({ ok: false, error: "SWITCH_ACCOUNT_INVALID" }, { status: 400 });
  }

  const remembered = readSignedRecentSessions(
    request.cookies.get(RECENT_SESSIONS_COOKIE_NAME)?.value,
  );
  const selected = remembered[slot];
  if (!selected) {
    return NextResponse.json({ ok: false, error: "SWITCH_ACCOUNT_NOT_FOUND" }, { status: 404 });
  }

  const user = await withPrismaRetry(() =>
    prisma.user.findFirst({
      where: {
        id: selected.userId,
        tenant_id: selected.tenantId,
        company_id: selected.companyId,
        active: true,
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
        default_landing_path: true,
      },
    }),
  );

  if (!user) {
    return NextResponse.json({ ok: false, error: "SWITCH_ACCOUNT_NOT_FOUND" }, { status: 404 });
  }

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
    defaultLandingPath:
      user.default_landing_path &&
      user.default_landing_path !== "/login" &&
      user.default_landing_path !== "/register"
        ? user.default_landing_path
        : null,
  });

  const nextSessionPayload = {
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

  const response = NextResponse.json({ ok: true, redirectTo });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSignedSession(nextSessionPayload),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  );
  response.cookies.set(
    RECENT_SESSIONS_COOKIE_NAME,
    createSignedRecentSessions(mergeRecentSessions(remembered, nextSessionPayload)),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    },
  );

  return response;
}
