import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import {
  buildSupplierOrderPdf,
  getSupplierOrderForExport,
} from "@/lib/yg-order-export";

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
    const order = await getSupplierOrderForExport(
      id,
      session.tenantId,
      session.companyId,
    );

    if (!order) {
      return NextResponse.json({ error: "未找到拆分订单" }, { status: 404 });
    }

    const bytes = await buildSupplierOrderPdf(order);
    const fileName = `${order.derived_order_no}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 },
    );
  }
}
