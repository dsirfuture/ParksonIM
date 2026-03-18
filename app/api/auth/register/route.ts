import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  isValidDisplayName,
  isValidEmail,
  isValidMxPhone,
  normalizePhone,
} from "@/lib/user-account";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const phoneRaw = String(body?.phone || "").trim();
    const password = String(body?.password || "").trim();
    const email = String(body?.email || "").trim();

    if (!isValidDisplayName(name)) {
      return NextResponse.json(
        { ok: false, error: "姓名格式不正确" },
        { status: 400 },
      );
    }

    if (!isValidMxPhone(phoneRaw)) {
      return NextResponse.json(
        { ok: false, error: "请输入有效的墨西哥手机号" },
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

    const phone = normalizePhone(phoneRaw);

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

    const user = await prisma.user.create({
      data: {
        tenant_id: company.tenant_id,
        company_id: company.id,
        user_id: phone,
        name,
        phone,
        email: email || null,
        avatar_url: null,
        password_hash: hashPassword(password),
        role: "worker",
        active: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    return NextResponse.json({
      ok: true,
      user,
    });
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
