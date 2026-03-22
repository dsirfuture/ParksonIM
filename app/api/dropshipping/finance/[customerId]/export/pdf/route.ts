// @ts-nocheck
import { NextResponse } from "next/server";
import { getExchangeRatePayload, getFinanceRows } from "@/lib/dropshipping";
import {
  buildDropshippingSettlementPdf,
  buildDropshippingSettlementPdfName,
} from "@/lib/dropshipping-settlement-export";
import {
  buildWeeklyUnpaidStatementPdf,
  buildWeeklyUnpaidStatementPdfName,
  type WeeklyStatementPdfPayload,
} from "@/lib/dropshipping-weekly-statement-pdf";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "\u672a\u767b\u5f55" }, { status: 401 });
    }

    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ error: "\u65e0\u6743\u9650" }, { status: 403 });
    }

    const { customerId } = await params;
    const [items, exchangeRate] = await Promise.all([
      getFinanceRows(session),
      getExchangeRatePayload(session),
    ]);
    const financeRow = items.find((item) => item.customerId === customerId);

    if (!financeRow) {
      return NextResponse.json({ error: "\u672a\u627e\u5230\u5ba2\u6237\u7ed3\u7b97\u6570\u636e" }, { status: 404 });
    }

    const bytes = await buildDropshippingSettlementPdf({
      financeRow,
      exchangeRate,
    });
    const fileName = buildDropshippingSettlementPdfName(financeRow.customerName);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "\u5bfc\u51fa PDF \u5931\u8d25" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = (await request.json()) as {
      payload?: WeeklyStatementPdfPayload & { exportDateCode?: string };
    };
    if (!body?.payload) {
      return NextResponse.json({ error: "缺少导出数据" }, { status: 400 });
    }

    const bytes = await buildWeeklyUnpaidStatementPdf(body.payload);
    const fileName = buildWeeklyUnpaidStatementPdfName(
      body.payload.customerName,
      body.payload.exportDateCode || "statement",
    );

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出 PDF 失败" },
      { status: 500 },
    );
  }
}
