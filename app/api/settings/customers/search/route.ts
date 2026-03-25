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

    const allowed = await hasPermission(session, "manageCustomers");
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = String(searchParams.get("keyword") || "").trim();
    if (!keyword) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const compactKeyword = compactKeywordText(keyword);
    const rows = await prisma.ygCustomerImport.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        OR: [
          { company_name: { contains: keyword, mode: "insensitive" } },
          { relation_name: { contains: keyword, mode: "insensitive" } },
          { registered_phone: { contains: keyword, mode: "insensitive" } },
          { customer_id: { contains: keyword, mode: "insensitive" } },
          { relation_no: { contains: keyword, mode: "insensitive" } },
        ],
      },
      orderBy: [{ last_order_at: "desc" }, { updated_at: "desc" }],
      take: 40,
      select: {
        id: true,
        company_name: true,
        relation_name: true,
        registered_phone: true,
        province_name: true,
        region_name: true,
      },
    });

    const items = rows
      .filter((row) => {
        if (!compactKeyword) return true;
        return [
          compactKeywordText(row.company_name),
          compactKeywordText(row.relation_name),
          compactKeywordText(row.registered_phone),
        ].some((value) => value.includes(compactKeyword));
      })
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        companyName: row.company_name || "",
        relationName: row.relation_name || "",
        registeredPhone: row.registered_phone || "",
        cityCountry: [row.province_name, row.region_name].filter(Boolean).join(" / "),
      }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "加载友购客户搜索失败" },
      { status: 500 },
    );
  }
}
