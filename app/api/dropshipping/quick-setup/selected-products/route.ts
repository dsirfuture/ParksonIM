// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { hasAppPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function getQuickSetupSession(permissionKey: string) {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ ok: false, error: "未登录" }, { status: 401 }) };
  }
  if (!(await hasAppPermission(session, permissionKey as any))) {
    return { session, error: NextResponse.json({ ok: false, error: "您暂无执行此操作的权限" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function GET() {
  const { session, error } = await getQuickSetupSession("dropshipping.quick_setup.product_selection.view");
  if (error) return error;

  const rows = await prisma.dsQuickSelectedProduct.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
    },
    orderBy: [{ updated_at: "desc" }, { sku: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    items: rows.map((row) => ({
      id: row.id,
      platform: row.platform || "",
      sku: row.sku,
      barcode: row.barcode || "",
      nameZh: row.name_zh || "",
      nameEs: row.name_es || "",
      snapshot: row.product_snapshot_json || null,
      createdAt: row.created_at.toISOString(),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const { session, error } = await getQuickSetupSession("dropshipping.quick_setup.edit");
  if (error) return error;

  const body = await req.json();
  const items = Array.isArray(body?.items) ? body.items : [];

  await prisma.$transaction(async (tx) => {
    await tx.dsQuickSelectedProduct.deleteMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
      },
    });

    if (items.length > 0) {
      await tx.dsQuickSelectedProduct.createMany({
        data: items.map((item) => ({
          tenant_id: session.tenantId,
          company_id: session.companyId,
          user_id: session.userId,
          platform: String(item?.platform || "").trim() || null,
          product_catalog_id: String(item?.id || "").trim() || null,
          sku: String(item?.sku || "").trim(),
          barcode: String(item?.barcode || "").trim() || null,
          name_zh: String(item?.nameZh || "").trim() || null,
          name_es: String(item?.nameEs || "").trim() || null,
          product_snapshot_json: {
            sku: String(item?.sku || "").trim(),
            barcode: String(item?.barcode || "").trim(),
            nameZh: String(item?.nameZh || "").trim(),
            nameEs: String(item?.nameEs || "").trim(),
            casePack: item?.casePack ?? null,
            cartonPack: item?.cartonPack ?? null,
            price: item?.price ?? null,
            category: String(item?.category || "").trim(),
            supplier: String(item?.supplier || "").trim(),
          },
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
