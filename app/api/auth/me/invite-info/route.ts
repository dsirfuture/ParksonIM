// @ts-nocheck
import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const usage = await prisma.inviteCodeUsage.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
    },
    orderBy: { used_at: "desc" },
    include: {
      inviteCode: {
        select: {
          code: true,
          remark: true,
          register_user_type: true,
          permission_template_code: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    item: usage
      ? {
          usedAt: usage.used_at.toISOString(),
          registerIp: usage.register_ip || null,
          registerSource: usage.register_source || null,
          inviteCode: usage.inviteCode,
        }
      : null,
  });
}
