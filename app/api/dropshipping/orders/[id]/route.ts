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
    if (!id) {
      return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const existing = await prisma.dropshippingOrder.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      include: {
        customer: {
          select: { name: true },
        },
        product: {
          select: {
            sku: true,
            name_zh: true,
            name_es: true,
            default_warehouse: true,
            default_shipping_fee: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
    }

    const customerName =
      body.customerName === undefined
        ? existing.customer.name
        : String(body.customerName || "").trim();
    const platform =
      body.platform === undefined ? existing.platform : String(body.platform || "无").trim() || "无";
    const platformOrderNo =
      body.platformOrderNo === undefined
        ? existing.platform_order_no
        : String(body.platformOrderNo || "").trim();
    const sku =
      body.sku === undefined ? existing.product.sku : String(body.sku || "").trim();
    const productNameZh =
      body.productNameZh === undefined
        ? existing.product.name_zh
        : String(body.productNameZh || "").trim();
    const quantity =
      body.quantity === undefined || body.quantity === null || body.quantity === ""
        ? existing.quantity
        : Number(body.quantity);

    if (!customerName || !platformOrderNo || !sku || !productNameZh || quantity < 0) {
      return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
    }

    const order = await saveOrder(session, {
      id,
      customerName,
      platform,
      platformOrderNo,
      trackingGroupId:
        body.trackingGroupId === undefined
          ? undefined
          : String(body.trackingGroupId || "").trim() || null,
      sku,
      productNameZh,
      productNameEs:
        body.productNameEs === undefined
          ? existing.product.name_es || undefined
          : String(body.productNameEs || "").trim() || undefined,
      quantity,
      trackingNo:
        body.trackingNo === undefined
          ? existing.tracking_no || undefined
          : String(body.trackingNo || "").trim() || undefined,
      color:
        body.color === undefined
          ? existing.color || undefined
          : String(body.color || "").trim() || undefined,
      warehouse: FIXED_WAREHOUSE,
      shippedAt:
        body.shippedAt === undefined
          ? (existing.shipped_at ? existing.shipped_at.toISOString().slice(0, 10) : null)
          : body.shippedAt
            ? String(body.shippedAt)
            : null,
      shippingFee:
        body.shippingFee === undefined
          ? (existing.shipping_fee ? Number(existing.shipping_fee) : undefined)
          : body.shippingFee === "" || body.shippingFee === null
            ? undefined
            : Number(body.shippingFee),
      settlementStatus:
        body.settlementStatus === undefined
          ? (existing.settled_at ? "paid" : "unpaid")
          : (String(body.settlementStatus || "unpaid") as "unpaid" | "paid"),
      shippingStatus:
        body.shippingStatus === undefined
          ? existing.shipping_status
          : (String(body.shippingStatus || "pending") as "pending" | "shipped" | "cancelled"),
      notes:
        body.notes === undefined
          ? existing.notes || undefined
          : String(body.notes || "").trim() || undefined,
    });

    return NextResponse.json({ ok: true, id: order.id });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "duplicate_platform_order_no" ||
        error.message === "duplicate_tracking_no")
    ) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
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
