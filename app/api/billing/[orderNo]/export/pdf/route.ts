import { NextResponse } from "next/server";
import {
  buildBillingPdfFileName,
  buildBillingPdf,
  getBillingExportData,
} from "@/lib/billing-export";
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
    const data = await getBillingExportData({
      orderNo,
      tenantId: session.tenantId,
      companyId: session.companyId,
    });

    if (!data) {
      return NextResponse.json({ error: "未找到账单明细" }, { status: 404 });
    }

    const buffer = await buildBillingPdf(data);
    const fileName = `${buildBillingPdfFileName(data)}.pdf`;

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "请先生成账单后再导出") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出 PDF 失败" },
      { status: 500 },
    );
  }
}
