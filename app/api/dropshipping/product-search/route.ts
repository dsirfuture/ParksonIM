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

    const rows = await prisma.productCatalog.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        ...(keyword
          ? {
              OR: [
                { sku: { contains: keyword, mode: "insensitive" } },
                { barcode: { contains: keyword, mode: "insensitive" } },
                { name_zh: { contains: keyword, mode: "insensitive" } },
                { name_es: { contains: keyword, mode: "insensitive" } },
                { category: { contains: keyword, mode: "insensitive" } },
                { supplier: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sku: true,
        name_zh: true,
        name_es: true,
      },
      orderBy: [{ updated_at: "desc" }, { sku: "asc" }],
      take: keyword ? 24 : 12,
    });

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        sku: row.sku,
        nameZh: row.name_zh || "",
        nameEs: row.name_es || "",
        imageUrl: buildProductImageUrl(row.sku, "jpg"),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "product_search_failed" },
      { status: 500 },
    );
  }
}
