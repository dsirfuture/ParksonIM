import { NextResponse } from "next/server";
import { buildBillingRemark, parseBillingRemark } from "@/lib/billing-meta";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInt(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} 格式不正确`);
  }

  return parsed;
}

function normalizePrice(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("单价格式不正确");
  }

  return parsed.toFixed(2);
}

function normalizeDiscount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("折扣格式不正确");
  }

  const fraction = parsed > 1 ? parsed / 100 : parsed;
  return fraction.toFixed(4);
}

function formatMoney(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "-";
  return `$${num.toFixed(2)}`;
}

function formatDiscountPercent(value: unknown) {
  const num = toNumber(value);
  if (num === null) return null;

  const percent = num <= 1 ? num * 100 : num;
  const rounded = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/\.?0+$/, "");

  return `${rounded}%`;
}

function toEditPercent(value: unknown) {
  const num = toNumber(value);
  if (num === null) return null;
  return num <= 1 ? num * 100 : num;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function baseOrderNo(receiptNo: string | null | undefined) {
  const head = String(receiptNo || "")
    .trim()
    .split("-")[0];
  return head || String(receiptNo || "").trim();
}

function buildSummary(
  items: Array<{
    expected_qty: number;
    good_qty: number;
    damaged_qty: number;
    excess_qty: number;
    unexpected: boolean;
  }>,
) {
  const imported = items.filter((item) => !item.unexpected);

  const totalSku = imported.length;
  const expectedQtyTotal = imported.reduce(
    (sum, item) => sum + item.expected_qty,
    0,
  );
  const goodQtyTotal = imported.reduce((sum, item) => sum + item.good_qty, 0);
  const damagedQtyTotal = imported.reduce(
    (sum, item) => sum + item.damaged_qty,
    0,
  );
  const excessQtyTotal = imported.reduce(
    (sum, item) => sum + item.excess_qty,
    0,
  );
  const checkedQtyTotal = goodQtyTotal + damagedQtyTotal;
  const progress =
    expectedQtyTotal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((checkedQtyTotal / expectedQtyTotal) * 100)),
        )
      : 0;

  const completedItems = imported.filter((item) => {
    const checked = Math.min(
      item.good_qty + item.damaged_qty,
      item.expected_qty,
    );
    return checked >= item.expected_qty && item.expected_qty > 0;
  }).length;

  let receiptStatus: "pending" | "in_progress" | "completed" = "pending";

  if (imported.length > 0 && completedItems === imported.length) {
    receiptStatus = "completed";
  } else if (checkedQtyTotal > 0 || excessQtyTotal > 0) {
    receiptStatus = "in_progress";
  }

  return {
    totalSku,
    completedItems,
    progress,
    receiptStatus,
  };
}

function computeLineTotalByGoodQty(
  goodQty: number,
  unitPrice: number | null,
  normalDiscount: number | null,
  vipDiscount: number | null,
) {
  if (unitPrice === null || !Number.isFinite(unitPrice)) return null;

  let total = goodQty * unitPrice;

  if (normalDiscount !== null) {
    total = total * (1 - normalDiscount);
  }

  if (vipDiscount !== null) {
    total = total * (1 - vipDiscount);
  }

  return round2(total).toFixed(2);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const currentItem = await prisma.receiptItem.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
        expected_qty: true,
        good_qty: true,
        damaged_qty: true,
        excess_qty: true,
        status: true,
        unexpected: true,
        receipt: {
          select: {
            id: true,
            locked: true,
            status: true,
          },
        },
      },
    });

    if (!currentItem) {
      return NextResponse.json({ error: "未找到商品明细" }, { status: 404 });
    }

    if (currentItem.receipt?.locked || currentItem.receipt?.status === "completed") {
      return NextResponse.json({ error: "验货单已完成并锁定，不能再修改" }, { status: 409 });
    }

    const sku = String(body.sku ?? "").trim();
    if (!sku) {
      return NextResponse.json({ error: "SKU 不能为空" }, { status: 400 });
    }

    const barcode =
      body.barcode === null || body.barcode === undefined
        ? null
        : String(body.barcode).trim() || null;

    const nameZh =
      body.nameZh === null || body.nameZh === undefined
        ? null
        : String(body.nameZh).trim() || null;

    const nameEs =
      body.nameEs === null || body.nameEs === undefined
        ? null
        : String(body.nameEs).trim() || null;

    const casePack = normalizeInt(body.casePack, "包装数");
    const expectedQty = normalizeInt(body.expectedQty, "应验数量");
    const unitPrice = normalizePrice(body.unitPrice);
    const normalDiscount = normalizeDiscount(body.normalDiscount);
    const vipDiscount = normalizeDiscount(body.vipDiscount);

    const unitPriceNum = unitPrice === null ? null : Number(unitPrice);
    const normalDiscountNum =
      normalDiscount === null ? null : Number(normalDiscount);
    const vipDiscountNum = vipDiscount === null ? null : Number(vipDiscount);

    let lineTotal: string | null = null;

    if (!currentItem.unexpected) {
      lineTotal = computeLineTotalByGoodQty(
        currentItem.good_qty ?? 0,
        unitPriceNum,
        normalDiscountNum,
        vipDiscountNum,
      );
    }

    const updatedItem = await prisma.receiptItem.update({
      where: {
        id,
      },
      data: {
        sku,
        barcode,
        name_zh: nameZh,
        name_es: nameEs,
        case_pack: casePack,
        expected_qty: expectedQty ?? 0,
        sell_price: unitPrice,
        normal_discount: normalDiscount,
        vip_discount: vipDiscount,
        line_total: lineTotal,
      },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name_zh: true,
        name_es: true,
        case_pack: true,
        expected_qty: true,
        good_qty: true,
        damaged_qty: true,
        excess_qty: true,
        status: true,
        unexpected: true,
        sell_price: true,
        normal_discount: true,
        vip_discount: true,
        line_total: true,
      },
    });

    const expectedQtyValue = toNumber(updatedItem.expected_qty) ?? 0;

    const goodQtyValue = updatedItem.unexpected
      ? 0
      : (updatedItem.good_qty ?? 0);
    const damagedQtyValue = updatedItem.unexpected
      ? 0
      : (updatedItem.damaged_qty ?? 0);
    const excessQtyValue = updatedItem.unexpected
      ? 0
      : (updatedItem.excess_qty ?? 0);

    const checkedQty = goodQtyValue + damagedQtyValue;
    const diffQty = updatedItem.unexpected
      ? 0
      : Math.max(expectedQtyValue - Math.min(checkedQty, expectedQtyValue), 0);
    const uncheckedQty = updatedItem.unexpected ? 0 : diffQty;

    return NextResponse.json({
      item: {
        id: updatedItem.id,
        sku: updatedItem.sku || "",
        barcode: updatedItem.barcode || "",
        nameZh: updatedItem.name_zh || "",
        nameEs: updatedItem.name_es || "",
        casePack: toNumber(updatedItem.case_pack),
        expectedQty: toNumber(updatedItem.expected_qty),
        goodQty: goodQtyValue,
        diffQty,
        uncheckedQty,
        damagedQty: damagedQtyValue,
        excessQty: excessQtyValue,
        status: updatedItem.status,
        unexpected: updatedItem.unexpected,
        unitPriceValue: toEditPercent(updatedItem.sell_price),
        normalDiscountValue: toEditPercent(updatedItem.normal_discount),
        vipDiscountValue: toEditPercent(updatedItem.vip_discount),
        unitPriceText: formatMoney(updatedItem.sell_price),
        normalDiscountText: formatDiscountPercent(updatedItem.normal_discount),
        vipDiscountText: formatDiscountPercent(updatedItem.vip_discount),
        lineTotalText: updatedItem.unexpected
          ? "-"
          : formatMoney(updatedItem.line_total),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;

    const currentItem = await prisma.receiptItem.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
        unexpected: true,
        receipt: {
          select: {
            id: true,
            receipt_no: true,
          },
        },
      },
    });

    if (!currentItem?.receipt) {
      return NextResponse.json({ error: "未找到商品明细" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.receiptItem.delete({
        where: {
          id: currentItem.id,
        },
      });

      const receiptItems = await tx.receiptItem.findMany({
        where: {
          receipt_id: currentItem.receipt.id,
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
        select: {
          expected_qty: true,
          good_qty: true,
          damaged_qty: true,
          excess_qty: true,
          unexpected: true,
        },
      });

      const summary = buildSummary(
        receiptItems.map((row) => ({
          expected_qty: row.expected_qty ?? 0,
          good_qty: row.good_qty ?? 0,
          damaged_qty: row.damaged_qty ?? 0,
          excess_qty: row.excess_qty ?? 0,
          unexpected: row.unexpected,
        })),
      );

      await tx.receipt.update({
        where: { id: currentItem.receipt.id },
        data: {
          total_items: summary.totalSku,
          completed_items: summary.completedItems,
          progress_percent: summary.progress,
          status: summary.receiptStatus,
          locked: summary.receiptStatus === "completed",
          last_activity_at: new Date(),
        },
      });

      const orderNo = baseOrderNo(currentItem.receipt.receipt_no);

      if (orderNo) {
        const matchedOrders = await tx.ygOrderImport.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            OR: [
              { order_no: orderNo },
              { order_no: { startsWith: `${orderNo}-` } },
            ],
          },
          select: {
            id: true,
            order_remark: true,
          },
        });

        for (const order of matchedOrders) {
          const parsedRemark = parseBillingRemark(order.order_remark);
          const nextRemark = buildBillingRemark(parsedRemark.noteText, {
            ...parsedRemark.meta,
            billingSnapshot: "",
          });

          await tx.ygOrderImport.update({
            where: { id: order.id },
            data: {
              order_remark: nextRemark,
            },
          });
        }
      }

      return {
        receiptId: currentItem.receipt.id,
        deletedItemId: currentItem.id,
      };
    });

    return NextResponse.json({
      ok: true,
      receiptId: result.receiptId,
      deletedItemId: result.deletedItemId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
