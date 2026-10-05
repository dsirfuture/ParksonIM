import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { createCatalogShareCode } from "@/lib/catalog-share";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    const canManage = await hasPermission(session, "manageProducts");
    const canExport = await hasPermission(session, "exportProductCatalog");
    if (!canManage && !canExport) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const code = await createCatalogShareCode({
      tenantId: session.tenantId,
      companyId: session.companyId,
      format: body?.format === "pdf" ? "pdf" : "xlsx",
      lang: body?.lang === "es" ? "es" : "zh",
      category: String(body?.category || "all").trim() || "all",
      keyword: String(body?.keyword || "").trim(),
      categoryZh: String(body?.categoryZh || "").trim(),
      categoryEs: String(body?.categoryEs || "").trim(),
    });

    const publicPath = `/public/catalog/${code}`;
    return NextResponse.json({ ok: true, code, publicPath });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "生成分享链接失败" }, { status: 500 });
  }
}
