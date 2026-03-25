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
    const rows = await prisma.yogoProductSource.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        OR: [
          { product_code: { contains: keyword, mode: "insensitive" } },
          { product_no: { contains: keyword, mode: "insensitive" } },
          { name_cn: { contains: keyword, mode: "insensitive" } },
          { name_es: { contains: keyword, mode: "insensitive" } },
          { supplier: { contains: keyword, mode: "insensitive" } },
        ],
      },
      orderBy: [{ updated_at: "desc" }, { product_code: "asc" }],
      take: 40,
      select: {
        id: true,
        product_code: true,
        product_no: true,
        name_cn: true,
        name_es: true,
        source_price: true,
        supplier: true,
      },
    });

    const items = rows
      .filter((row) => {
        if (!compactKeyword) return true;
        const compactSku = compactKeywordText(row.product_code);
        const compactBarcode = compactKeywordText(row.product_no);
        const compactNameZh = compactKeywordText(row.name_cn);
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
        sku: row.product_code,
        barcode: row.product_no || "",
        nameZh: row.name_cn || "",
        nameEs: row.name_es || "",
        unitPrice: row.source_price,
        supplierName: row.supplier || "",
      }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "加载供应商产品搜索失败" },
      { status: 500 },
    );
  }
}
