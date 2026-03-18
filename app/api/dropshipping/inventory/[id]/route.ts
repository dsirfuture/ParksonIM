import { NextResponse } from "next/server";
import { deleteInventory, updateInventory } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

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
    const isStocked = Boolean(body.isStocked);
    const stockedQty = Number(body.stockedQty ?? 0);
    const unitPriceRaw = body.unitPrice;
    const discountRateRaw = body.discountRate;
    const warehouse = String(body.warehouse || "").trim();

    if (!id || !Number.isFinite(stockedQty) || stockedQty < 0) {
      return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
    }

    await updateInventory(session, {
      id,
      isStocked,
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
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "更新备货失败" },
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
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
    }

    await deleteInventory(session, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "删除备货失败" },
      { status: 500 },
    );
  }
}
