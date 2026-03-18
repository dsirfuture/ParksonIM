import { NextResponse } from "next/server";
import { createInventory, getDropshippingCustomerOptions, getInventoryRows } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const [items, customers] = await Promise.all([
      getInventoryRows(session),
      getDropshippingCustomerOptions(session),
    ]);
    return NextResponse.json({ ok: true, items, customers });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取库存失败" },
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
    const customerId = String(body.customerId || "").trim();
    const productCatalogId = String(body.productCatalogId || "").trim() || null;
    const sku = String(body.sku || "").trim();
    const productNameZh = String(body.productNameZh || "").trim() || null;
    const productNameEs = String(body.productNameEs || "").trim() || null;
    const stockedQty = Number(body.stockedQty ?? 0);
    const unitPriceRaw = body.unitPrice;
    const discountRateRaw = body.discountRate;
    const warehouse = String(body.warehouse || "").trim();

    if (!customerId || !sku || !Number.isFinite(stockedQty) || stockedQty < 0) {
      return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
    }

    await createInventory(session, {
      customerId,
      productCatalogId,
      sku,
      productNameZh,
      productNameEs,
      stockedQty,
      unitPrice:
        unitPriceRaw === "" || unitPriceRaw === null || unitPriceRaw === undefined
          ? null
          : Number(unitPriceRaw),
      discountRate:
        discountRateRaw === "" || discountRateRaw === null || discountRateRaw === undefined
          ? null
          : Number(discountRateRaw),
      warehouse: warehouse || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增备货失败";
    const status = message === "inventory_exists" || message === "customer_not_found" || message === "sku_required" ? 400 : 500;
    return NextResponse.json(
      { ok: false, error: message },
      { status },
    );
  }
}
