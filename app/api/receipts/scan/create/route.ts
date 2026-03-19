// @ts-nocheck
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

const BodySchema = z.object({
  receiptId: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.string().trim().optional().or(z.literal("")),
  casePack: z.union([z.string(), z.number()]),
  expectedQty: z.union([z.string(), z.number()]),
});

function toNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return 0;

  const num = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(num)) return null;
  if (!Number.isInteger(num)) return null;
  if (num < 0) return null;

  return num;
}

function computeItemNumbers(
  expectedQty: number,
  goodQty: number,
  damagedQty: number,
) {
  const checkedQty = Math.min(goodQty + damagedQty, expectedQty);
  const diffQty = Math.max(expectedQty - checkedQty, 0);
  const uncheckedQty = diffQty;

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
    excessQty: 0,
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
  const addedCount = items.filter((item) => item.unexpected).length;

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
  const uncheckedQtyTotal = Math.max(expectedQtyTotal - checkedQtyTotal, 0);
  const diffQtyTotal = uncheckedQtyTotal;
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
  } else if (checkedQtyTotal > 0) {
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

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId || !session.userId) {
      return NextResponse.json(
        { ok: false, error: "当前开发会话未配置租户和公司" },
        { status: 401 },
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

    const receipt = await prisma.receipt.findFirst({
      where: {
        id: parsed.data.receiptId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { ok: false, error: "未找到对应验货单" },
        { status: 404 },
      );
    }

    const casePack = toNonNegativeInt(parsed.data.casePack);
    const expectedQty = toNonNegativeInt(parsed.data.expectedQty);

    if (casePack === null || expectedQty === null) {
      return NextResponse.json(
        { ok: false, error: "包装数和应验数量必须是大于等于 0 的整数" },
        { status: 400 },
      );
    }

    const sku = parsed.data.sku.trim();
    const barcode = parsed.data.barcode?.trim() || null;

    const duplicate = await prisma.receiptItem.findFirst({
      where: {
        receipt_id: receipt.id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
        OR: [{ sku }, ...(barcode ? [{ barcode }] : [])],
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

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.receiptItem.create({
        data: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          receipt_id: receipt.id,
          sku,
          barcode,
          case_pack: casePack,
          expected_qty: expectedQty,
          good_qty: 0,
          damaged_qty: 0,
          excess_qty: 0,
          status: "pending",
          unexpected: true,
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
          receipt_id: receipt.id,
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
        where: {
          id: receipt.id,
        },
        data: {
          total_items: summary.totalSku,
          completed_items: summary.completedItems,
          progress_percent: summary.progress,
          status: summary.receiptStatus,
          last_activity_at: new Date(),
        },
      });

      const computed = computeItemNumbers(created.expected_qty ?? 0, 0, 0);

      return {
        item: {
          id: created.id,
          sku: created.sku || "",
          barcode: created.barcode || "",
          nameZh: created.name_zh || "",
          nameEs: created.name_es || "",
          casePack: created.case_pack ?? null,
          expectedQty: created.expected_qty ?? 0,
          goodQty: 0,
          damagedQty: 0,
          excessQty: 0,
          diffQty: computed.diffQty,
          uncheckedQty: computed.uncheckedQty,
          status: created.status,
          updatedAtText: new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(created.updated_at),
          createdAt: created.created_at.toISOString(),
          unexpected: created.unexpected,
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
            : "当前未能完成新增 请稍后再试",
      },
      { status: 500 },
    );
  }
}
