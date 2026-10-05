import { NextResponse } from "next/server";
import { buildCatalogExportResponse } from "@/app/api/products/catalog-export/route";
import { readCatalogShareByCode, readCatalogShareToken } from "@/lib/catalog-share";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const payload = token.includes(".")
    ? readCatalogShareToken(token)
    : await readCatalogShareByCode(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "分享链接无效" }, { status: 404 });
  }
  try {
    const response = await buildCatalogExportResponse({
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      format: payload.format,
      lang: payload.lang,
      category: payload.category,
      keyword: payload.keyword,
      onShelfOnly: true,
      categoryZh: payload.categoryZh,
      categoryEs: payload.categoryEs,
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "下载失败" }, { status: 500 });
  }
}
