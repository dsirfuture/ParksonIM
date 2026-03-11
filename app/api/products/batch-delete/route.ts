import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "未选择可删除商品" }, { status: 400 });
    }

    const result = await prisma.productCatalog.deleteMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        id: { in: ids },
      },
    });
    return NextResponse.json({ ok: true, deletedCount: result.count });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "批量删除失败" },
      { status: 500 },
    );
  }
}
