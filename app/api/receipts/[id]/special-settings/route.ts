import { NextResponse } from "next/server";
import { buildBillingRemark, parseBillingRemark } from "@/lib/billing-meta";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

function normalizeInt(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} 必须是大于等于 0 的整数`);
  }
  return parsed;
}

function normalizeSignedInt(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${field} 必须是整数`);
  }
  return parsed;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toDiscountFactor(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value > 1 ? value / 100 : value;
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

function baseOrderNo(receiptNo: string | null | undefined) {
  const head = String(receiptNo || "")
    .trim()
    .split("-")[0];
  return head || String(receiptNo || "").trim();
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
    const updatesRaw = Array.isArray(body?.updates) ? body.updates : [];
    const loginName = String(body?.loginName || "").trim();
    const receiptNo = String(body?.receiptNo || "").trim();
    const remark = String(body?.remark || "").trim();

    const receipt = await prisma.receipt.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
        receipt_no: true,
        status: true,
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "未找到对应验货单" }, { status: 404 });
    }

    if (receipt.status !== "completed") {
      return NextResponse.json(
        { error: "仅允许对已完成验货单使用特殊设置" },
        { status: 409 },
      );
    }
    if (!loginName || !receiptNo || !remark) {
      return NextResponse.json(
        { error: "请完整填写：登录名、完整验货单号、备注" },
        { status: 400 },
      );
    }
    if (loginName !== String(session.name || "").trim()) {
      return NextResponse.json({ error: "登录名不匹配" }, { status: 400 });
    }
    if (receiptNo !== String(receipt.receipt_no || "").trim()) {
      return NextResponse.json({ error: "完整验货单号不匹配" }, { status: 400 });
    }

    const updates: Array<{
      itemId: string;
      expectedQty: number | null;
      addGoodQty: number;
    }> = [];
    for (const row of updatesRaw as unknown[]) {
      const payload =
        row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const nextRow = {
        itemId: String(payload.itemId || "").trim(),
        expectedQty: normalizeInt(payload.expectedQty, "应验数量"),
        addGoodQty: normalizeSignedInt(payload.addGoodQty, "良品新调整") ?? 0,
      };
      if (nextRow.itemId.length > 0) {
        updates.push(nextRow);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ ok: true, updatedCount: 0 });
    }

    const updatedCount = await prisma.$transaction(async (tx) => {
      const itemMap = new Map(
        (
          await tx.receiptItem.findMany({
            where: {
              id: { in: updates.map((row) => row.itemId) },
              receipt_id: receipt.id,
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
              sell_price: true,
              normal_discount: true,
              vip_discount: true,
            },
          })
        ).map((row) => [row.id, row]),
      );

      let touched = 0;

      for (const row of updates) {
        const currentItem = itemMap.get(row.itemId);
        if (!currentItem || currentItem.unexpected) continue;

        const nextExpectedQty = row.expectedQty ?? (currentItem.expected_qty ?? 0);
        const nextGoodQty = Math.max((currentItem.good_qty ?? 0) + row.addGoodQty, 0);
        const checkedQty = nextGoodQty + (currentItem.damaged_qty ?? 0);
        const nextStatus =
          nextExpectedQty > 0 && checkedQty >= nextExpectedQty
            ? "completed"
            : checkedQty > 0 || (currentItem.excess_qty ?? 0) > 0
              ? "in_progress"
              : "pending";

        const lineTotal = computeLineTotalByGoodQty(
          nextGoodQty,
          toNumber(currentItem.sell_price),
          toDiscountFactor(toNumber(currentItem.normal_discount)),
          toDiscountFactor(toNumber(currentItem.vip_discount)),
        );

        await tx.receiptItem.update({
          where: { id: currentItem.id },
          data: {
            expected_qty: nextExpectedQty,
            good_qty: nextGoodQty,
            status: nextStatus,
            line_total: lineTotal,
          },
        });
        touched += 1;
      }

      if (touched > 0) {
        const receiptItems = await tx.receiptItem.findMany({
          where: {
            receipt_id: receipt.id,
            tenant_id: session.tenantId,
            company_id: session.companyId,
          },
          select: {
            expected_qty: true,
            good_qty: true,
            damaged_qty: true,
            unexpected: true,
          },
        });
        const imported = receiptItems.filter((item) => !item.unexpected);
        const completedItems = imported.filter((item) => {
          const expectedQty = item.expected_qty ?? 0;
          const checkedQty = (item.good_qty ?? 0) + (item.damaged_qty ?? 0);
          return expectedQty > 0 && checkedQty >= expectedQty;
        }).length;
        const expectedQtyTotal = imported.reduce(
          (sum, item) => sum + (item.expected_qty ?? 0),
          0,
        );
        const checkedQtyTotal = imported.reduce(
          (sum, item) => sum + (item.good_qty ?? 0) + (item.damaged_qty ?? 0),
          0,
        );
        const progress =
          expectedQtyTotal > 0
            ? Math.max(
                0,
                Math.min(100, Math.round((checkedQtyTotal / expectedQtyTotal) * 100)),
              )
            : 0;

        await tx.receipt.update({
          where: { id: receipt.id },
          data: {
            completed_items: completedItems,
            progress_percent: progress,
            status: "completed",
            locked: true,
            last_activity_at: new Date(),
          },
        });

        const orderNo = baseOrderNo(receipt.receipt_no);
        if (orderNo) {
          const matchedOrders = await tx.ygOrderImport.findMany({
            where: {
              tenant_id: session.tenantId,
              company_id: session.companyId,
              OR: [{ order_no: orderNo }, { order_no: { startsWith: `${orderNo}-` } }],
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
              data: { order_remark: nextRemark },
            });
          }
        }
      }

      return touched;
    });

    return NextResponse.json({ ok: true, updatedCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "特殊设置保存失败" },
      { status: 400 },
    );
  }
}
