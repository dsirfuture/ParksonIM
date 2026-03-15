import { NextResponse } from "next/server";
import { buildBillingXlsx, getBillingExportData } from "@/lib/billing-export";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { orderNo } = await params;
    const { searchParams } = new URL(request.url);
    const vipDiscountEnabled = searchParams.get("vip") === "1";

    const data = await getBillingExportData({
      orderNo,
      tenantId: session.tenantId,
      companyId: session.companyId,
      vipDiscountEnabled,
    });

    if (!data) {
      return NextResponse.json({ error: "未找到账单明细" }, { status: 404 });
    }

    const buffer = await buildBillingXlsx(data);
    const fileName = `${data.orderNo}${vipDiscountEnabled ? "-vip" : ""}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出 XLSX 失败" },
      { status: 500 },
    );
  }
}
