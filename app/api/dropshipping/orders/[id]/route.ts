import { NextResponse } from "next/server";
import { saveOrder } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

const FIXED_WAREHOUSE = "墨西哥-百盛仓";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const customerName = String(body.customerName || "").trim();
    const platform = String(body.platform || "").trim();
    const platformOrderNo = String(body.platformOrderNo || "").trim();
    const sku = String(body.sku || "").trim();
    const productNameZh = String(body.productNameZh || "").trim();
    const quantity = Number(body.quantity || 0);

    if (!id || !customerName || !platform || !platformOrderNo || !sku || !productNameZh || quantity <= 0) {
      return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
    }

    const order = await saveOrder(session, {
      id,
      customerName,
      platform,
      platformOrderNo,
      sku,
      productNameZh,
      productNameEs: String(body.productNameEs || "").trim() || undefined,
      quantity,
      trackingNo: String(body.trackingNo || "").trim() || undefined,
      color: String(body.color || "").trim() || undefined,
      warehouse: FIXED_WAREHOUSE,
      shippedAt: body.shippedAt ? String(body.shippedAt) : null,
      shippingFee: body.shippingFee === "" || body.shippingFee === null || body.shippingFee === undefined ? undefined : Number(body.shippingFee),
      shippingStatus: String(body.shippingStatus || "pending") as "pending" | "shipped" | "cancelled",
      notes: String(body.notes || "").trim() || undefined,
    });

    return NextResponse.json({ ok: true, id: order.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "更新订单失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
    }

    const order = await prisma.dropshippingOrder.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
    }

    await prisma.dropshippingOrder.delete({
      where: { id: order.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "delete_failed" },
      { status: 500 },
    );
  }
}
