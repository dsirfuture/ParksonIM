import { NextResponse } from "next/server";
import { listOrders, saveOrder } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

const FIXED_WAREHOUSE = "墨西哥-百盛仓";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const data = await listOrders(session);
    return NextResponse.json({ ok: true, items: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "list_orders_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const customerName = String(body.customerName || "").trim();
    const platform = String(body.platform || "未知").trim() || "未知";
    const platformOrderNo = String(body.platformOrderNo || "").trim();
    const trackingNo = String(body.trackingNo || "").trim();
    const sku = String(body.sku || "").trim();
    const productNameZh = String(body.productNameZh || "").trim();
    const quantity = Number(body.quantity || 0);

    if (!customerName || !trackingNo || !sku || !productNameZh || quantity <= 0) {
      return NextResponse.json({ ok: false, error: "missing_tracking_no" }, { status: 400 });
    }

    if (platformOrderNo && platformOrderNo === trackingNo) {
      return NextResponse.json(
        { ok: false, error: "same_order_and_tracking_no" },
        { status: 400 },
      );
    }

    const order = await saveOrder(session, {
      customerName,
      platform,
      platformOrderNo,
      trackingGroupId:
        body.trackingGroupId === undefined
          ? undefined
          : String(body.trackingGroupId || "").trim() || null,
      sku,
      productNameZh,
      productNameEs: String(body.productNameEs || "").trim() || undefined,
      quantity,
      trackingNo: trackingNo || undefined,
      color: String(body.color || "").trim() || undefined,
      warehouse: FIXED_WAREHOUSE,
      shippedAt: body.shippedAt ? String(body.shippedAt) : null,
      shippingFee:
        body.shippingFee === "" || body.shippingFee === null || body.shippingFee === undefined
          ? undefined
          : Number(body.shippingFee),
      settlementStatus: String(body.settlementStatus || "unpaid") as "unpaid" | "paid",
      shippingStatus: String(body.shippingStatus || "pending") as
        | "pending"
        | "shipped"
        | "cancelled",
      notes: String(body.notes || "").trim() || undefined,
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
      { ok: false, error: error instanceof Error ? error.message : "save_order_failed" },
      { status: 500 },
    );
  }
}
