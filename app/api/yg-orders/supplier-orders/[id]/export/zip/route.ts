import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { buildImportZipFile, getImportForZip } from "@/lib/yg-order-export";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const importRow = await getImportForZip(
      id,
      session.tenantId,
      session.companyId,
    );

    if (!importRow) {
      return NextResponse.json({ error: "未找到友购订单" }, { status: 404 });
    }

    const zipBuffer = await buildImportZipFile(importRow);
    const fileName = `${importRow.order_no}-ALL.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 },
    );
  }
}
