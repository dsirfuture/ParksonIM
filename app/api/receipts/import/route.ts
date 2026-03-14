import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { z } from "zod";

const RowSchema = z.object({
  receipt_no: z.string().trim().min(1),
  supplier_name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.string().trim().optional(),
  name_zh: z.string().trim().optional(),
  name_es: z.string().trim().optional(),
  case_pack: z.number().int().nonnegative().optional(),
  expected_qty: z.number().int().positive(),
  sell_price: z.number().nonnegative(),
  discount: z.number().min(0).max(1).optional(),
  normal_discount: z.number().min(0).max(1).optional(),
  vip_discount: z.number().min(0).max(1).optional(),
  line_total: z.number().nonnegative().optional(),
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1),
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calcLineTotal(
  qty?: number,
  price?: number,
  normalDiscount?: number,
  vipDiscount?: number,
  rawLineTotal?: number,
): number | undefined {
  if (rawLineTotal !== undefined && Number.isFinite(rawLineTotal)) {
    return round2(rawLineTotal);
  }

  if (
    qty === undefined ||
    !Number.isFinite(qty) ||
    price === undefined ||
    !Number.isFinite(price)
  ) {
    return undefined;
  }

  let factor = 1;

  if (normalDiscount !== undefined && Number.isFinite(normalDiscount)) {
    factor *= 1 - normalDiscount;
  }

  if (vipDiscount !== undefined && Number.isFinite(vipDiscount)) {
    factor *= 1 - vipDiscount;
  }

  return round2(qty * price * factor);
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json(
        { ok: false, error: "当前开发会话未配置租户和公司" },
        { status: 401 },
      );
    }

    const tenantId = session.tenantId;
    const companyId = session.companyId;

    const [tenantExists, companyExists] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      }),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, tenant_id: true },
      }),
    ]);

    if (
      !tenantExists ||
      !companyExists ||
      companyExists.tenant_id !== tenantId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "当前开发会话对应的租户或公司不存在 请检查登录状态或重新初始化测试数据",
        },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "导入内容格式不正确" },
        { status: 400 },
      );
    }

    const rows = parsed.data.rows;
    const receiptNos = [...new Set(rows.map((row) => row.receipt_no))];

    const existingReceipts = await prisma.receipt.findMany({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        receipt_no: {
          in: receiptNos,
        },
      },
      select: {
        receipt_no: true,
      },
    });

    if (existingReceipts.length > 0) {
      const duplicated = [
        ...new Set(existingReceipts.map((item) => item.receipt_no)),
      ];

      return NextResponse.json(
        {
          ok: false,
          error: duplicated.map((no) => `此验货单已存在：${no}`).join("\n"),
        },
        { status: 400 },
      );
    }

    const grouped = new Map<string, typeof rows>();

    for (const row of rows) {
      const list = grouped.get(row.receipt_no) || [];
      list.push(row);
      grouped.set(row.receipt_no, list);
    }

    const skuSet = new Set(
      rows
        .map((row) => row.sku?.trim())
        .filter((value): value is string => Boolean(value)),
    );

    const supplierSet = new Set(
      rows
        .map((row) => row.supplier_name?.trim())
        .filter((value): value is string => Boolean(value)),
    );

    const totalExpectedQty = rows.reduce(
      (sum, row) => sum + (row.expected_qty || 0),
      0,
    );

    let createdReceiptCount = 0;
    let createdItemCount = 0;
    let createdBatchCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const [receiptNo, receiptRows] of grouped.entries()) {
        const supplierName = receiptRows[0]?.supplier_name || null;

        const receipt = await tx.receipt.create({
          data: {
            tenant_id: tenantId,
            company_id: companyId,
            receipt_no: receiptNo,
            supplier_name: supplierName,
            status: "pending",
            total_items: receiptRows.length,
            completed_items: 0,
            progress_percent: 0,
          },
        });

        createdReceiptCount += 1;

        await tx.receiptItem.createMany({
          data: receiptRows.map((row) => {
            const normalDiscount = row.normal_discount ?? row.discount;
            const vipDiscount = row.vip_discount;
            const lineTotal = calcLineTotal(
              row.expected_qty,
              row.sell_price,
              normalDiscount,
              vipDiscount,
              row.line_total,
            );

            return {
              tenant_id: tenantId,
              company_id: companyId,
              receipt_id: receipt.id,
              sku: row.sku,
              barcode: row.barcode || null,
              name_zh: row.name_zh || null,
              name_es: row.name_es || null,
              case_pack: row.case_pack ?? null,
              expected_qty: row.expected_qty,
              good_qty: 0,
              damaged_qty: 0,
              sell_price:
                row.sell_price !== undefined
                  ? new Prisma.Decimal(row.sell_price)
                  : null,
              discount:
                normalDiscount !== undefined
                  ? new Prisma.Decimal(normalDiscount)
                  : null,
              normal_discount:
                normalDiscount !== undefined
                  ? new Prisma.Decimal(normalDiscount)
                  : null,
              vip_discount:
                vipDiscount !== undefined
                  ? new Prisma.Decimal(vipDiscount)
                  : null,
              line_total:
                lineTotal !== undefined ? new Prisma.Decimal(lineTotal) : null,
              status: "pending",
            };
          }),
        });

        createdItemCount += receiptRows.length;

        await tx.importBatch.create({
          data: {
            tenant_id: tenantId,
            company_id: companyId,
            receipt_id: receipt.id,
            status: "completed",
            result_json: JSON.stringify({
              note: "已成功导入",
              file_name: `${receiptNo}.xlsx`,
              total_rows: receiptRows.length,
              success_rows: receiptRows.length,
              failed_rows: 0,
            }),
          },
        });

        createdBatchCount += 1;
      }
    });

    return NextResponse.json({
      ok: true,
      summary: {
        receiptCount: createdReceiptCount,
        supplierCount: supplierSet.size,
        skuCount: skuSet.size,
        totalExpectedQty,
        itemCount: createdItemCount,
        batchCount: createdBatchCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "当前未能完成导入 请稍后再试",
      },
      { status: 500 },
    );
  }
}
