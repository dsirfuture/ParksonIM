import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const rows = await withPrismaRetry(() =>
      prisma.productImportBatch.findMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
        orderBy: [{ created_at: "desc" }],
        take: 200,
      }),
    );

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        fileName: row.source_file_name,
        totalRows: row.total_rows,
        createdCount: row.created_count,
        changedCount: row.changed_count,
        unchangedCount: row.unchanged_count,
        onShelfCount: row.on_shelf_count,
        offShelfCount: row.off_shelf_count,
        hasFile: Boolean(row.stored_file_path),
        comparedFields: "卖价、包装数、装箱数、条形码、上架状态",
        createdAt: row.created_at.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取失败" },
      { status: 500 },
    );
  }
}
