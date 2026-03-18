import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import { buildProductImageUrl } from "@/lib/product-image-url";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword")?.trim() || "";

    const rows = await prisma.yogoProductSource.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        ...(keyword
          ? {
              OR: [
                { product_code: { contains: keyword, mode: "insensitive" } },
                { product_no: { contains: keyword, mode: "insensitive" } },
                { name_cn: { contains: keyword, mode: "insensitive" } },
                { name_es: { contains: keyword, mode: "insensitive" } },
                { category_name: { contains: keyword, mode: "insensitive" } },
                { subcategory_name: { contains: keyword, mode: "insensitive" } },
                { supplier: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        product_code: true,
        product_no: true,
        name_cn: true,
        name_es: true,
        source_price: true,
        source_discount: true,
      },
      orderBy: [{ source_updated_at: "desc" }, { updated_at: "desc" }, { product_code: "asc" }],
      take: keyword ? 24 : 12,
    });

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        sku: row.product_code,
        productNo: row.product_no || "",
        nameZh: row.name_cn || "",
        nameEs: row.name_es || "",
        imageUrl: buildProductImageUrl(row.product_code, "jpg"),
        unitPrice: row.source_price?.toString?.() || "",
        discountRate: row.source_discount?.toString?.() || "",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "product_search_failed" },
      { status: 500 },
    );
  }
}
