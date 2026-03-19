// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSignedSession,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { normalizePhone } from "@/lib/user-account";

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

    const phone = normalizePhone(account);

    const user = await withPrismaRetry(() =>
      prisma.user.findFirst({
        where: {
          active: true,
          OR: [
            { user_id: account },
            { name: { equals: account, mode: "insensitive" } },
            { email: { equals: account, mode: "insensitive" } },
            { phone: phone || "__invalid__" },
          ],
        },
        select: {
          id: true,
          role: true,
          tenant_id: true,
          company_id: true,
          password_hash: true,
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

    const response = NextResponse.json({ success: true });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSignedSession({
        userId: user.id,
        tenantId: user.tenant_id,
        companyId: user.company_id,
        role: user.role,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
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
