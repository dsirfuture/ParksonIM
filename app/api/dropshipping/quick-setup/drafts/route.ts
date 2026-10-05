// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { hasAppPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireDraftPermission(permissionKey: string) {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ ok: false, error: "未登录" }, { status: 401 }) };
  }
  if (!(await hasAppPermission(session, permissionKey as any))) {
    return { session, error: NextResponse.json({ ok: false, error: "您暂无执行此操作的权限" }, { status: 403 }) };
  }
  return { session, error: null };
}

async function buildDraftPreviewItems(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, rows: any[]) {
  const dedupedRows = rows.filter((row, index, source) => {
    const key = `${String(row.platform || "").trim()}::${String(row.sku || "").trim()}`;
    return source.findIndex(
      (candidate) =>
        `${String(candidate.platform || "").trim()}::${String(candidate.sku || "").trim()}` === key,
    ) === index;
  });

  const missingBarcodeSkus = Array.from(
    new Set(
      dedupedRows
        .filter((row) => !String((row.payload_json as any)?.barcode || "").trim())
        .map((row) => String(row.sku || "").trim())
        .filter(Boolean),
    ),
  );

  const barcodeBySku = new Map<string, string>();
  if (missingBarcodeSkus.length > 0) {
    const yogoRows = await prisma.yogoProductSource.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        product_code: { in: missingBarcodeSkus },
      },
      select: {
        product_code: true,
        product_no: true,
      },
    });

    for (const row of yogoRows) {
      const sku = String(row.product_code || "").trim();
      if (!sku || barcodeBySku.has(sku)) continue;
      barcodeBySku.set(sku, String(row.product_no || "").trim());
    }
  }

  return dedupedRows.map((row) => ({
    id: row.id,
    platform: row.platform,
    sku: row.sku,
    barcode: String((row.payload_json as any)?.barcode || "").trim() || barcodeBySku.get(String(row.sku || "").trim()) || "",
    nameZh: String((row.payload_json as any)?.nameZh || row.product_name || ""),
    nameEs: String((row.payload_json as any)?.nameEs || ""),
    draftStatus: row.draft_status,
    failureReason: row.failure_reason || "",
    generatedAt: row.created_at.toISOString(),
  }));
}

export async function GET() {
  const { session, error } = await requireDraftPermission("dropshipping.quick_setup.draft_generation.view");
  if (error) return error;

  const rows = await prisma.dsQuickProductDraft.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
    },
    orderBy: [{ created_at: "desc" }, { sku: "asc" }],
    take: 100,
  });

  return NextResponse.json({
    ok: true,
    items: await buildDraftPreviewItems(session, rows),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireDraftPermission("dropshipping.quick_setup.draft_generation.create");
  if (error) return error;

  const body = await req.json();
  const platform = String(body?.platform || "").trim();
  if (!platform) {
    return NextResponse.json({ ok: false, error: "请选择已绑定的平台" }, { status: 400 });
  }

  const binding = await prisma.dsQuickStoreBinding.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
      platform,
      bind_status: "bound",
    },
    select: { id: true },
  });

  if (!binding) {
    return NextResponse.json({ ok: false, error: "当前平台尚未绑定成功" }, { status: 400 });
  }

  const selectedRows = await prisma.dsQuickSelectedProduct.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
    },
    orderBy: { updated_at: "desc" },
  });

  if (selectedRows.length === 0) {
    return NextResponse.json({ ok: false, error: "请先选择商品" }, { status: 400 });
  }

  const existingDrafts = await prisma.dsQuickProductDraft.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
      platform,
      sku: { in: selectedRows.map((row) => row.sku) },
    },
    select: {
      sku: true,
    },
  });

  const existingSkuSet = new Set(existingDrafts.map((row) => String(row.sku || "").trim()).filter(Boolean));
  const rowsToCreate = selectedRows.filter((row) => !existingSkuSet.has(String(row.sku || "").trim()));

  if (rowsToCreate.length > 0) {
    await prisma.dsQuickProductDraft.createMany({
      data: rowsToCreate.map((row) => ({
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
        platform,
        store_binding_id: binding.id,
        product_catalog_id: row.product_catalog_id || null,
        sku: row.sku,
        product_name: row.name_zh || row.name_es || row.sku,
        draft_status: "success",
        failure_reason: null,
        payload_json: {
          source: "quick_setup",
          note: "draft_placeholder_ready",
          platform,
          sku: row.sku,
          barcode: row.barcode || "",
          nameZh: row.name_zh || "",
          nameEs: row.name_es || "",
        },
      })),
    });
  }

  const drafts = await prisma.dsQuickProductDraft.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
      platform,
    },
    orderBy: [{ created_at: "desc" }, { sku: "asc" }],
    take: Math.max(selectedRows.length, 20),
  });

  return NextResponse.json({
    ok: true,
    message: "产品草稿已生成，请前往对应平台继续完善商品标题、描述、价格、规格等信息",
    items: await buildDraftPreviewItems(session, drafts),
  });
}
