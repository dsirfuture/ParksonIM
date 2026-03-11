import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSignedSession,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";
import { normalizePhone } from "@/lib/user-account";

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

    const user = await prisma.user.findFirst({
      where: {
        active: true,
        OR: [
          { user_id: account },
          { name: account },
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
    });

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
  } catch {
    return NextResponse.json(
      { success: false, error: "当前未能完成登录 请稍后再试" },
      { status: 500 },
    );
  }
}
