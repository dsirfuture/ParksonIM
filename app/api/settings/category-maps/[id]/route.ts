// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageProducts");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const { id } = await params;
    const target = await withPrismaRetry(() =>
      prisma.productCategoryMap.findFirst({
        where: { id, tenant_id: session.tenantId, company_id: session.companyId },
        select: { id: true },
      }),
    );
    if (!target) return NextResponse.json({ ok: false, error: "分类不存在" }, { status: 404 });

    await withPrismaRetry(() => prisma.productCategoryMap.delete({ where: { id: target.id } }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "删除分类失败" },
      { status: 500 },
    );
  }
}
