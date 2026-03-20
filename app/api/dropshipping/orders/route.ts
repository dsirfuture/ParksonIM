import { NextResponse } from "next/server";
import { listOrders, saveOrder } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

const FIXED_WAREHOUSE = "墨西哥-百盛仓";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const data = await listOrders(session);
    return NextResponse.json({ ok: true, items: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取订单失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const customerName = String(body.customerName || "").trim();
    const platform = String(body.platform || "无").trim() || "无";
    const platformOrderNo = String(body.platformOrderNo || "").trim();
    const sku = String(body.sku || "").trim();
    const productNameZh = String(body.productNameZh || "").trim();
    const quantity = Number(body.quantity || 0);

    if (!customerName || !platformOrderNo || !sku || !productNameZh || quantity <= 0) {
      return NextResponse.json({ ok: false, error: "缺少必填字段或数量非法" }, { status: 400 });
    }

    const order = await saveOrder(session, {
      customerName,
      platform,
      platformOrderNo,
      trackingGroupId: body.trackingGroupId === undefined ? undefined : String(body.trackingGroupId || "").trim() || null,
      sku,
      productNameZh,
      productNameEs: String(body.productNameEs || "").trim() || undefined,
      quantity,
      trackingNo: String(body.trackingNo || "").trim() || undefined,
      color: String(body.color || "").trim() || undefined,
      warehouse: FIXED_WAREHOUSE,
      shippedAt: body.shippedAt ? String(body.shippedAt) : null,
      shippingFee: body.shippingFee === "" || body.shippingFee === null || body.shippingFee === undefined ? undefined : Number(body.shippingFee),
      settlementStatus: String(body.settlementStatus || "unpaid") as "unpaid" | "paid",
      shippingStatus: String(body.shippingStatus || "pending") as "pending" | "shipped" | "cancelled",
      notes: String(body.notes || "").trim() || undefined,
    });

    return NextResponse.json({ ok: true, id: order.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存订单失败" },
      { status: 500 },
    );
  }
}
