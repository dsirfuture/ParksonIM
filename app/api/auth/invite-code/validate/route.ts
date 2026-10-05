// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInviteCode } from "@/lib/invite-codes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body?.code || "").trim();

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

    const result = await validateInviteCode({
      tenantId: company.tenant_id,
      companyId: company.id,
      code,
    });

    return NextResponse.json({
      ok: result.ok,
      error: result.ok ? "" : result.message,
      inviteCode: result.ok
        ? {
            code: result.inviteCode.code,
            expiresAt: result.inviteCode.expires_at?.toISOString() || null,
            remainingUses:
              result.inviteCode.max_uses > 0
                ? Math.max(0, result.inviteCode.max_uses - result.inviteCode.used_count)
                : null,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "邀请码校验失败" },
      { status: 500 },
    );
  }
}
