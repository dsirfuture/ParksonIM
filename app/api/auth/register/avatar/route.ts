import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body?.userId || "").trim();
    const avatarDataUrl = String(body?.avatarDataUrl || "").trim();

    if (!userId || !avatarDataUrl) {
      return NextResponse.json(
        { ok: false, error: "缺少头像信息" },
        { status: 400 },
      );
    }

    if (!avatarDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { ok: false, error: "头像格式不正确" },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar_url: avatarDataUrl,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch {
    return NextResponse.json(
      { ok: false, error: "当前未能保存头像 请稍后再试" },
      { status: 500 },
    );
  }
}
