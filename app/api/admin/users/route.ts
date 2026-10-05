import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth";
import {
  isValidDisplayName,
  isValidEmail,
  isValidMxPhone,
  normalizePhone,
} from "@/lib/user-account";

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const items = await prisma.user.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
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
      active: true,
      created_at: true,
      updated_at: true,
    },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({
      ...item,
      user_id: item.user_id ?? null,
      email: item.email ?? null,
      avatar_url: item.avatar_url ?? null,
      name_zh: item.name_zh ?? null,
      name_en: item.name_en ?? null,
      remark: item.remark ?? null,
      data_source: item.data_source ?? "platform_created",
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();

  const name = String(body?.name || "").trim();
  const phoneRaw = String(body?.phone || "").trim();
  const email = String(body?.email || "").trim();
  const password = String(body?.password || "").trim();
  const role = body?.role === "admin" ? "admin" : "worker";
  const active = body?.active !== false;

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

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "邮箱格式不正确" },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "登录密码至少需要 6 位" },
      { status: 400 },
    );
  }

  const phone = normalizePhone(phoneRaw);

  const duplicate = await prisma.user.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      OR: [{ name }, { phone }],
    },
    select: { id: true },
  });

  if (duplicate) {
    return NextResponse.json(
      { ok: false, error: "姓名或手机号已存在" },
      { status: 400 },
    );
  }

  const user = await prisma.user.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      name,
      phone,
      user_id: phone,
      email: email || null,
      data_source: "platform_created",
      role,
      active,
      password_hash: hashPassword(password),
    },
    select: {
      id: true,
      user_id: true,
      name: true,
      phone: true,
      email: true,
      avatar_url: true,
      role: true,
      active: true,
      created_at: true,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      user_id: user.user_id ?? null,
      email: user.email ?? null,
      avatar_url: user.avatar_url ?? null,
      created_at: user.created_at.toISOString(),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();

  const id = String(body?.id || "").trim();
  const name = String(body?.name || "").trim();
  const phoneRaw = String(body?.phone || "").trim();
  const email = String(body?.email || "").trim();
  const avatarUrl = String(body?.avatarUrl || "").trim();
  const password = String(body?.password || "").trim();
  const role = body?.role === "admin" ? "admin" : "worker";
  const active = Boolean(body?.active);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "缺少用户标识" },
      { status: 400 },
    );
  }

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

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "邮箱格式不正确" },
      { status: 400 },
    );
  }

  if (password && password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "登录密码至少需要 6 位" },
      { status: 400 },
    );
  }

  const phone = normalizePhone(phoneRaw);

  const duplicate = await prisma.user.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      id: { not: id },
      OR: [{ name }, { phone }],
    },
    select: { id: true },
  });

  if (duplicate) {
    return NextResponse.json(
      { ok: false, error: "姓名或手机号已存在" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name,
      phone,
      user_id: phone,
      email: email || null,
      avatar_url: avatarUrl || null,
      role,
      active,
      ...(password ? { password_hash: hashPassword(password) } : {}),
    },
    select: {
      id: true,
      user_id: true,
      name: true,
      phone: true,
      email: true,
      avatar_url: true,
      role: true,
      active: true,
      created_at: true,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      user_id: user.user_id ?? null,
      email: user.email ?? null,
      avatar_url: user.avatar_url ?? null,
      created_at: user.created_at.toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const id = String(body?.id || "").trim();
  const confirmAccount = String(body?.confirmAccount || "").trim();
  const confirmDelete = String(body?.confirmDelete || "").trim();

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "缺少用户标识" },
      { status: 400 },
    );
  }

  if (id === session.userId) {
    return NextResponse.json(
      { ok: false, error: "不能删除当前登录账号" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: { id: true, user_id: true },
  });

  if (!target) {
    return NextResponse.json(
      { ok: false, error: "用户不存在" },
      { status: 404 },
    );
  }

  const protectedTarget = await prisma.user.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      role: true,
      user_type: true,
    },
  });

  if (!protectedTarget) {
    return NextResponse.json(
      { ok: false, error: "用户不存在" },
      { status: 404 },
    );
  }

  if (protectedTarget.role === "admin" && protectedTarget.user_type !== "dropshipping_customer") {
    return NextResponse.json(
      { ok: false, error: "严禁删除内部用户的管理员角色" },
      { status: 400 },
    );
  }

  if (!confirmAccount || !confirmDelete) {
    return NextResponse.json(
      { ok: false, error: "请完整输入账号和删除文案" },
      { status: 400 },
    );
  }

  const targetAccount = String(target.user_id || "").trim();
  if (confirmAccount !== targetAccount || confirmDelete !== "删除") {
    return NextResponse.json(
      { ok: false, error: "删除校验未通过" },
      { status: 400 },
    );
  }

  await prisma.user.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true, id });
}
