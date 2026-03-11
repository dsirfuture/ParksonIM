import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

const BodySchema = z.object({
  receiptId: z.string().trim().min(1),
  mode: z.enum(["scan", "edit_qty"]).optional(),
  damagedQty: z.union([z.string(), z.number()]).optional(),
  excessQty: z.union([z.string(), z.number()]).optional(),
});

function toNullableInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;

  const num = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    return null;
  }

  return num;
}

function computeItemNumbers(
  expectedQty: number,
  goodQty: number,
  damagedQty: number,
) {
  const checkedQty = goodQty + damagedQty;
  const hasRealInspection = checkedQty > 0;
  const diffQty = hasRealInspection ? Math.abs(expectedQty - checkedQty) : 0;
  const uncheckedQty = Math.max(expectedQty - checkedQty, 0);
  const excessQty = Math.max(checkedQty - expectedQty, 0);

  let status: "pending" | "in_progress" | "completed" = "pending";

  if (checkedQty <= 0) {
    status = "pending";
  } else if (checkedQty >= expectedQty) {
    status = "completed";
  } else {
    status = "in_progress";
  }

  return {
    diffQty,
    uncheckedQty,
    excessQty,
    status,
  };
}

function buildSummary(
  items: Array<{
    expected_qty: number;
    good_qty: number;
    damaged_qty: number;
  }>,
) {
  const totalSku = items.length;
  const expectedQtyTotal = items.reduce(
    (sum, item) => sum + item.expected_qty,
    0,
  );
  const goodQtyTotal = items.reduce((sum, item) => sum + item.good_qty, 0);
  const damagedQtyTotal = items.reduce(
    (sum, item) => sum + item.damaged_qty,
    0,
  );
  const checkedQtyTotal = goodQtyTotal + damagedQtyTotal;
  const uncheckedQtyTotal = Math.max(expectedQtyTotal - checkedQtyTotal, 0);
  const excessQtyTotal = Math.max(checkedQtyTotal - expectedQtyTotal, 0);
  const diffQtyTotal =
    checkedQtyTotal > 0 ? Math.abs(expectedQtyTotal - checkedQtyTotal) : 0;
  const progress =
    expectedQtyTotal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((checkedQtyTotal / expectedQtyTotal) * 100)),
        )
      : 0;

  const completedItems = items.filter((item) => {
    const checked = item.good_qty + item.damaged_qty;
    return checked >= item.expected_qty && checked > 0;
  }).length;

  let receiptStatus: "pending" | "in_progress" | "completed" = "pending";

  if (items.length > 0 && completedItems === items.length) {
    receiptStatus = "completed";
  } else if (checkedQtyTotal > 0) {
    receiptStatus = "in_progress";
  }

  return {
    totalSku,
    expectedQtyTotal,
    goodQtyTotal,
    diffQtyTotal,
    uncheckedQtyTotal,
    damagedQtyTotal,
    excessQtyTotal,
    progress,
    completedItems,
    receiptStatus,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId || !session.userId) {
      return NextResponse.json(
        { ok: false, error: "当前开发会话未配置租户和公司" },
        { status: 401 },
      );
    }

    const { itemId } = await params;

    if (!itemId) {
      return NextResponse.json(
        { ok: false, error: "缺少商品 ID" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "提交内容格式不正确" },
        { status: 400 },
      );
    }

    const { receiptId, mode, damagedQty, excessQty } = parsed.data;

    const item = await prisma.receiptItem.findFirst({
      where: {
        id: itemId,
        receipt_id: receiptId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
        receipt_id: true,
        sku: true,
        barcode: true,
        name_zh: true,
        name_es: true,
        case_pack: true,
        expected_qty: true,
        good_qty: true,
        damaged_qty: true,
        status: true,
        updated_at: true,
        unexpected: true,
        created_at: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { ok: false, error: "未找到对应商品明细" },
        { status: 404 },
      );
    }

    const currentGoodQty = item.good_qty ?? 0;
    const currentDamagedQty = item.damaged_qty ?? 0;
    const expectedQty = item.expected_qty ?? 0;

    let nextGoodQty = currentGoodQty;
    let nextDamagedQty = currentDamagedQty;

    if (mode === "scan") {
      const increment =
        item.case_pack && item.case_pack > 0 ? item.case_pack : 1;
      nextGoodQty = currentGoodQty + increment;
    } else {
      const nextDamaged = toNullableInt(damagedQty);
      const nextExcess = toNullableInt(excessQty);

      if (nextDamaged === null || nextExcess === null) {
        return NextResponse.json(
          { ok: false, error: "破损和超收必须是大于等于 0 的整数" },
          { status: 400 },
        );
      }

      nextDamagedQty = nextDamaged;
      nextGoodQty = Math.max(expectedQty + nextExcess - nextDamaged, 0);
    }

    const computed = computeItemNumbers(
      expectedQty,
      nextGoodQty,
      nextDamagedQty,
    );

    const result = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.receiptItem.update({
        where: { id: item.id },
        data: {
          good_qty: nextGoodQty,
          damaged_qty: nextDamagedQty,
          status: computed.status,
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
          status: true,
          updated_at: true,
          created_at: true,
          unexpected: true,
        },
      });

      const receiptItems = await tx.receiptItem.findMany({
        where: {
          receipt_id: receiptId,
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
        select: {
          expected_qty: true,
          good_qty: true,
          damaged_qty: true,
        },
      });

      const summary = buildSummary(
        receiptItems.map((row) => ({
          expected_qty: row.expected_qty ?? 0,
          good_qty: row.good_qty ?? 0,
          damaged_qty: row.damaged_qty ?? 0,
        })),
      );

      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          total_items: summary.totalSku,
          completed_items: summary.completedItems,
          progress_percent: summary.progress,
          status: summary.receiptStatus,
          last_activity_at: new Date(),
        },
      });

      const computedItem = computeItemNumbers(
        updatedItem.expected_qty ?? 0,
        updatedItem.good_qty ?? 0,
        updatedItem.damaged_qty ?? 0,
      );

      return {
        item: {
          id: updatedItem.id,
          sku: updatedItem.sku || "",
          barcode: updatedItem.barcode || "",
          nameZh: updatedItem.name_zh || "",
          nameEs: updatedItem.name_es || "",
          casePack: updatedItem.case_pack ?? null,
          expectedQty: updatedItem.expected_qty ?? 0,
          goodQty: updatedItem.good_qty ?? 0,
          damagedQty: updatedItem.damaged_qty ?? 0,
          diffQty: computedItem.diffQty,
          uncheckedQty: computedItem.uncheckedQty,
          excessQty: computedItem.excessQty,
          status: updatedItem.status,
          updatedAtText: new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(updatedItem.updated_at),
          createdAt: updatedItem.created_at.toISOString(),
          unexpected: updatedItem.unexpected,
        },
        summary: {
          totalSku: summary.totalSku,
          expectedQtyTotal: summary.expectedQtyTotal,
          goodQtyTotal: summary.goodQtyTotal,
          diffQtyTotal: summary.diffQtyTotal,
          uncheckedQtyTotal: summary.uncheckedQtyTotal,
          damagedQtyTotal: summary.damagedQtyTotal,
          excessQtyTotal: summary.excessQtyTotal,
          progress: summary.progress,
        },
      };
    });

    return NextResponse.json({
      ok: true,
      item: result.item,
      summary: result.summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "当前未能完成保存 请稍后再试",
      },
      { status: 500 },
    );
  }
}
