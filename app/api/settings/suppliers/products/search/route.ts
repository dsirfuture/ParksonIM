import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

function compactKeywordText(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const allowed = await hasPermission(session, "viewReports");
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = String(searchParams.get("keyword") || "").trim();
    if (!keyword) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const compactKeyword = compactKeywordText(keyword);
    const rows = await prisma.supplierProductSource.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        OR: [
          { sku: { contains: keyword, mode: "insensitive" } },
          { barcode: { contains: keyword, mode: "insensitive" } },
          { name_zh: { contains: keyword, mode: "insensitive" } },
          { name_es: { contains: keyword, mode: "insensitive" } },
          { supplier_name: { contains: keyword, mode: "insensitive" } },
        ],
      },
      orderBy: [{ updated_at: "desc" }, { sku: "asc" }],
      take: 40,
      select: {
        id: true,
        sku: true,
        barcode: true,
        name_zh: true,
        name_es: true,
        unit_price: true,
        supplier_name: true,
      },
    });

    const items = rows
      .filter((row) => {
        if (!compactKeyword) return true;
        const compactSku = compactKeywordText(row.sku);
        const compactBarcode = compactKeywordText(row.barcode);
        const compactNameZh = compactKeywordText(row.name_zh);
        const compactNameEs = compactKeywordText(row.name_es);
        return (
          compactSku.includes(compactKeyword)
          || compactBarcode.includes(compactKeyword)
          || compactNameZh.includes(compactKeyword)
          || compactNameEs.includes(compactKeyword)
        );
      })
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        sku: row.sku,
        barcode: row.barcode || "",
        nameZh: row.name_zh || "",
        nameEs: row.name_es || "",
        unitPrice: row.unit_price,
        supplierName: row.supplier_name || "",
      }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "加载供应商产品搜索失败" },
      { status: 500 },
    );
  }
}
