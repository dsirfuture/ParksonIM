import { NextResponse } from "next/server";
import {
  buildBillingPdf,
  buildBillingPdfFileName,
  type BillingExportData,
  type BillingExportItem,
} from "@/lib/billing-export";
import { writeBillingActionLog } from "@/lib/billing-action-log";
import { getSession } from "@/lib/tenant";

function toDiscountFactor(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return value > 1 ? value / 100 : value;
}

function calcLineTotal(item: BillingExportItem, vipDiscountEnabled: boolean) {
  const qty = Number(item.qty || 0);
  const unitPrice = Number(item.unitPrice || 0);
  let factor = 1;
  const normalDiscount = toDiscountFactor(item.normalDiscount);
  const vipDiscount = toDiscountFactor(item.vipDiscount);
  if (normalDiscount !== null) factor *= 1 - normalDiscount;
  if (vipDiscountEnabled && vipDiscount !== null) factor *= 1 - vipDiscount;
  return qty * unitPrice * factor;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = (await request.json()) as {
      orderNo?: string;
      companyName?: string;
      contactPhone?: string;
      addressText?: string;
      remarkText?: string;
      storeLabelText?: string;
      issueDateText?: string;
      boxCountText?: string;
      shipDateText?: string;
      warehouseText?: string;
      shippingMethodText?: string;
      recipientNameText?: string;
      recipientPhoneText?: string;
      carrierCompanyText?: string;
      paymentTermText?: string;
      vipDiscountEnabled?: boolean;
      items?: Array<{
        sku?: string;
        barcode?: string;
        nameZh?: string;
        nameEs?: string;
        qty?: number;
        maxQty?: number;
        unitPrice?: number;
        normalDiscount?: number | null;
        vipDiscount?: number | null;
      }>;
    };

    const items: BillingExportItem[] = Array.isArray(body.items)
      ? body.items.map((item) => ({
          sku: String(item?.sku || "").trim(),
          barcode: String(item?.barcode || "").trim(),
          nameZh: String(item?.nameZh || "").trim(),
          nameEs: String(item?.nameEs || "").trim(),
          qty: Math.min(Number(item?.qty || 0), Number(item?.maxQty || 0)),
          unitPrice: Number(item?.unitPrice || 0),
          normalDiscount:
            item?.normalDiscount === null || item?.normalDiscount === undefined ? null : Number(item.normalDiscount),
          vipDiscount: item?.vipDiscount === null || item?.vipDiscount === undefined ? null : Number(item.vipDiscount),
          lineTotal: 0,
        }))
      : [];

    const vipDiscountEnabled = Boolean(body.vipDiscountEnabled);
    const computedItems = items.map((item) => ({
      ...item,
      lineTotal: calcLineTotal(item, vipDiscountEnabled),
    }));
    const totalQty = computedItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const totalAmount = computedItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);

    const data: BillingExportData = {
      orderNo: String(body.orderNo || "").trim() || "COPY",
      companyName: String(body.companyName || "").trim(),
      contactName: "",
      contactPhone: String(body.contactPhone || "").trim(),
      addressText: String(body.addressText || "").trim(),
      remarkText: String(body.remarkText || "").trim(),
      storeLabelText: String(body.storeLabelText || "").trim(),
      updatedAt: new Date(),
      itemCount: computedItems.length,
      totalQty,
      totalAmount,
      vipDiscountEnabled,
      items: computedItems,
      issueDateText: String(body.issueDateText || "").trim(),
      boxCountText: String(body.boxCountText || "").trim(),
      shipDateText: String(body.shipDateText || "").trim(),
      warehouseText: String(body.warehouseText || "").trim(),
      shippingMethodText: String(body.shippingMethodText || "").trim(),
      recipientNameText: String(body.recipientNameText || "").trim(),
      recipientPhoneText: String(body.recipientPhoneText || "").trim(),
      carrierCompanyText: String(body.carrierCompanyText || "").trim(),
      paymentTermText: String(body.paymentTermText || "").trim(),
      generatedAtText: "",
    };

    const buffer = await buildBillingPdf(data);
    const fileName = `${buildBillingPdfFileName(data)}.pdf`;

    await writeBillingActionLog({
      tenantId: session.tenantId,
      companyId: session.companyId,
      orderNo: data.orderNo,
      actionType: "copy_export",
      formatType: "pdf",
      detailText: "导出复制账单",
      operatorId: session.userId,
      operatorName: session.name,
    });

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${encodeURIComponent(fileName)}\"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出复制账单失败" },
      { status: 500 },
    );
  }
}
