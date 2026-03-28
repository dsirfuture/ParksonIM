import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import {
  buildCustomerFinanceDetailPdf,
  buildCustomerFinancePdfFileName,
  type CustomerFinanceDetailExportPayload,
} from "@/lib/customer-finance-export";

export const runtime = "nodejs";

function normalizeValue(value: unknown) {
  return String(value || "").trim() || "-";
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<CustomerFinanceDetailExportPayload>;
    const payload: CustomerFinanceDetailExportPayload = {
      customerName: normalizeValue(body.customerName),
      linkedYgName: normalizeValue(body.linkedYgName),
      realName: normalizeValue(body.realName),
      contact: normalizeValue(body.contact),
      phone: normalizeValue(body.phone),
      stores: normalizeValue(body.stores),
      address: normalizeValue(body.address),
      vipLevel: normalizeValue(body.vipLevel),
      creditLevel: normalizeValue(body.creditLevel),
      totalOrderCount: normalizeValue(body.totalOrderCount),
      totalOrderAmountText: normalizeValue(body.totalOrderAmountText),
      totalPackingAmountText: normalizeValue(body.totalPackingAmountText),
      orderRows: Array.isArray(body.orderRows)
        ? body.orderRows.map((item) => ({
            orderNo: normalizeValue(item?.orderNo),
            channelText: normalizeValue(item?.channelText),
            orderDateText: normalizeValue(item?.orderDateText),
            orderAmountText: normalizeValue(item?.orderAmountText),
            packingAmountText: normalizeValue(item?.packingAmountText),
            shippedAtText: normalizeValue(item?.shippedAtText),
          }))
        : [],
      paymentRows: Array.isArray(body.paymentRows)
        ? body.paymentRows.map((item) => ({
            orderNo: normalizeValue(item?.orderNo),
            payableAmountText: normalizeValue(item?.payableAmountText),
            paidAmountText: normalizeValue(item?.paidAmountText),
            paymentTimeText: normalizeValue(item?.paymentTimeText),
            paymentMethodText: normalizeValue(item?.paymentMethodText),
            paymentTargetText: normalizeValue(item?.paymentTargetText),
            unpaidAmountText: normalizeValue(item?.unpaidAmountText),
          }))
        : [],
    };

    const pdfBytes = await buildCustomerFinanceDetailPdf(payload);
    const fileName = encodeURIComponent(buildCustomerFinancePdfFileName(payload.customerName));

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导出 PDF 失败" },
      { status: 500 },
    );
  }
}
