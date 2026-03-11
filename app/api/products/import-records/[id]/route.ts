import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { id } = await params;
    const record = await prisma.productImportBatch.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        source_file_name: true,
        stored_file_path: true,
      },
    });
    if (!record) {
      return NextResponse.json({ ok: false, error: "导入记录不存在" }, { status: 404 });
    }
    if (!record.stored_file_path) {
      return NextResponse.json({ ok: false, error: "该记录没有可导出的原始文件" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(record.stored_file_path);
    const fileName = path.basename(record.source_file_name || "products.xlsx");
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { id } = await params;
    const record = await prisma.productImportBatch.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true, stored_file_path: true },
    });
    if (!record) {
      return NextResponse.json({ ok: false, error: "导入记录不存在" }, { status: 404 });
    }

    if (record.stored_file_path) {
      await fs.unlink(record.stored_file_path).catch(() => undefined);
    }

    await prisma.productImportBatch.delete({ where: { id: record.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 },
    );
  }
}
