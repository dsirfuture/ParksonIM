import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

const BodySchema = z.object({
  receiptId: z.string().trim().min(1),
  mode: z.enum(["scan", "edit_item", "edit_qty"]).optional(),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  casePack: z.union([z.string(), z.number()]).optional(),
  expectedQty: z.union([z.string(), z.number()]).optional(),
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
  excessQty: number,
  unexpected: boolean,
) {
  if (unexpected) {
    return {
      diffQty: 0,
      uncheckedQty: 0,
      excessQty: 0,
      status: "pending" as const,
    };
  }

  const checkedQty = Math.min(goodQty + damagedQty, expectedQty);
  const diffQtyRaw = Math.max(expectedQty - checkedQty, 0);
  const uncheckedQtyRaw = diffQtyRaw;

  let status: "pending" | "in_progress" | "completed" = "pending";

  if (checkedQty <= 0 && excessQty <= 0) {
    status = "pending";
  } else if (checkedQty >= expectedQty) {
    status = "completed";
  } else {
    status = "in_progress";
  }

  return {
    diffQty: status === "pending" ? 0 : diffQtyRaw,
    uncheckedQty: status === "pending" ? 0 : uncheckedQtyRaw,
    excessQty,
    status,
  };
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
  const addedCount = items.filter((item) => item.unexpected).length;
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
  const perItemComputed = imported.map((item) =>
    computeItemNumbers(
      item.expected_qty,
      item.good_qty,
      item.damaged_qty,
      item.excess_qty,
      item.unexpected,
    ),
  );
  const uncheckedQtyTotal = perItemComputed.reduce((sum, item) => sum + item.uncheckedQty, 0);
  const diffQtyTotal = perItemComputed.reduce((sum, item) => sum + item.diffQty, 0);
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
    addedCount,
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
  context: { params: Promise<{ itemId: string }> },
) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId || !session.userId) {
      return NextResponse.json(
        { ok: false, error: "当前开发会话未配置租户和公司" },
        { status: 401 },
      );
    }

    const { itemId } = await context.params;

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

    const {
      receiptId,
      mode,
      sku,
      barcode,
      casePack,
      expectedQty,
      damagedQty,
      excessQty,
    } = parsed.data;

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
        excess_qty: true,
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

    let nextSku = item.sku || "";
    let nextBarcode = item.barcode || "";
    let nextCasePack = item.case_pack ?? 0;
    let nextExpectedQty = item.expected_qty ?? 0;
    let nextGoodQty = item.unexpected ? 0 : (item.good_qty ?? 0);
    let nextDamagedQty = item.unexpected ? 0 : (item.damaged_qty ?? 0);
    let nextExcessQty = item.unexpected ? 0 : (item.excess_qty ?? 0);

    if (mode === "scan") {
      if (!item.unexpected) {
        const increment = nextCasePack > 0 ? nextCasePack : 1;
        const maxGoodAllowed = Math.max(nextExpectedQty - nextDamagedQty, 0);
        nextGoodQty = Math.min(nextGoodQty + increment, maxGoodAllowed);
      }
    } else if (mode === "edit_item") {
      if (!sku || !sku.trim()) {
        return NextResponse.json(
          { ok: false, error: "SKU 不能为空" },
          { status: 400 },
        );
      }

      const parsedCasePack = toNullableInt(casePack);
      const parsedExpectedQty = toNullableInt(expectedQty);

      if (parsedCasePack === null || parsedExpectedQty === null) {
        return NextResponse.json(
          { ok: false, error: "包装数和应验数必须是大于等于 0 的整数" },
          { status: 400 },
        );
      }

      const duplicate = await prisma.receiptItem.findFirst({
        where: {
          receipt_id: receiptId,
          tenant_id: session.tenantId,
          company_id: session.companyId,
          id: {
            not: item.id,
          },
          OR: [
            { sku: sku.trim() },
            ...(barcode?.trim() ? [{ barcode: barcode.trim() }] : []),
          ],
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { ok: false, error: "当前验货单中已存在相同 SKU 或条码" },
          { status: 400 },
        );
      }

      nextSku = sku.trim();
      nextBarcode = barcode?.trim() || "";
      nextCasePack = parsedCasePack;
      nextExpectedQty = parsedExpectedQty;

      if (item.unexpected) {
        nextGoodQty = 0;
        nextDamagedQty = 0;
        nextExcessQty = 0;
      } else {
        const maxGoodAllowed = Math.max(nextExpectedQty - nextDamagedQty, 0);
        nextGoodQty = Math.min(nextGoodQty, maxGoodAllowed);
      }
    } else if (mode === "edit_qty") {
      if (item.unexpected) {
        return NextResponse.json(
          { ok: false, error: "新增商品不支持编辑破损和超收" },
          { status: 400 },
        );
      }

      const parsedDamagedQty = toNullableInt(damagedQty);
      const parsedExcessQty = toNullableInt(excessQty);

      if (parsedDamagedQty === null || parsedExcessQty === null) {
        return NextResponse.json(
          { ok: false, error: "破损和超收必须是大于等于 0 的整数" },
          { status: 400 },
        );
      }

      nextDamagedQty = Math.min(parsedDamagedQty, nextExpectedQty);
      nextExcessQty = parsedExcessQty;

      const maxGoodAllowed = Math.max(nextExpectedQty - nextDamagedQty, 0);
      nextGoodQty = Math.min(nextGoodQty, maxGoodAllowed);
    }

    const computed = computeItemNumbers(
      nextExpectedQty,
      nextGoodQty,
      nextDamagedQty,
      nextExcessQty,
      item.unexpected,
    );

    const result = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.receiptItem.update({
        where: { id: item.id },
        data: {
          sku: nextSku,
          barcode: nextBarcode || null,
          case_pack: nextCasePack,
          expected_qty: nextExpectedQty,
          good_qty: nextGoodQty,
          damaged_qty: nextDamagedQty,
          excess_qty: nextExcessQty,
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
          excess_qty: true,
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
        updatedItem.excess_qty ?? 0,
        updatedItem.unexpected,
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
          goodQty: updatedItem.unexpected ? 0 : (updatedItem.good_qty ?? 0),
          damagedQty: updatedItem.unexpected
            ? 0
            : (updatedItem.damaged_qty ?? 0),
          excessQty: updatedItem.unexpected ? 0 : (updatedItem.excess_qty ?? 0),
          diffQty: computedItem.diffQty,
          uncheckedQty: computedItem.uncheckedQty,
          status: updatedItem.status,
          updatedAtText: new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "America/Mexico_City",
          }).format(updatedItem.updated_at),
          createdAt: updatedItem.created_at.toISOString(),
          unexpected: updatedItem.unexpected,
        },
        summary: {
          totalSku: summary.totalSku,
          addedCount: summary.addedCount,
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
