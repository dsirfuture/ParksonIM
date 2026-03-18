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
import {
  deleteStoredAvatar,
  isInlineAvatarUrl,
  sanitizeAvatarUrl,
  storeAvatarDataUrl,
} from "@/lib/avatar-storage";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      avatar_url: true,
      role: true,
      active: true,
    },
  });

  return NextResponse.json({
    ok: true,
    user: user
      ? {
          ...user,
          avatar_url: sanitizeAvatarUrl(user.avatar_url),
        }
      : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const body = await req.json();

  const name = String(body?.name || "").trim();
  const phoneRaw = String(body?.phone || "").trim();
  const email = String(body?.email || "").trim();
  const avatarUrl = String(body?.avatarUrl || "").trim();
  const password = String(body?.password || "").trim();

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
      id: { not: session.userId },
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

  const existingUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatar_url: true },
  });

  let normalizedAvatarUrl = sanitizeAvatarUrl(existingUser?.avatar_url);

  if (!avatarUrl) {
    await deleteStoredAvatar(existingUser?.avatar_url);
    normalizedAvatarUrl = null;
  } else if (isInlineAvatarUrl(avatarUrl)) {
    try {
      normalizedAvatarUrl = await storeAvatarDataUrl(
        avatarUrl,
        session.userId,
        existingUser?.avatar_url,
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      if (code === "AVATAR_TOO_LARGE") {
        return NextResponse.json(
          { ok: false, error: "头像图片不能超过 2MB" },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { ok: false, error: "头像格式不正确" },
        { status: 400 },
      );
    }
  } else {
    normalizedAvatarUrl = sanitizeAvatarUrl(avatarUrl);
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: {
      name,
      phone,
      user_id: phone,
      email: email || null,
      avatar_url: normalizedAvatarUrl,
      ...(password ? { password_hash: hashPassword(password) } : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      avatar_url: true,
      role: true,
      active: true,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      avatar_url: sanitizeAvatarUrl(user.avatar_url),
    },
  });
}
