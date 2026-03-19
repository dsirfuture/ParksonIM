// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { getSession } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageCustomers");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const rows = await withPrismaRetry(() => prisma.customerProfile.findMany({
      where: { tenant_id: session.tenantId, company_id: session.companyId },
      orderBy: [{ updated_at: "desc" }],
    }));
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        contact: r.contact_name || "",
        phone: r.mobile || "",
        whatsapp: r.whatsapp || "",
        email: r.email || "",
        stores: r.store_addresses || "",
        cityCountry: r.city_country || "",
        customerType: r.customer_type || "",
        vipLevel: r.vip_level || "",
        creditLevel: r.credit_level || "",
        tags: r.tag_text || "",
        orderStats: r.order_stat_text || "",
      })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "读取客户失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageCustomers");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "客户名称必填" }, { status: 400 });

    const data = {
      name,
      contact_name: String(body.contact || "").trim() || null,
      mobile: String(body.phone || "").trim() || null,
      whatsapp: String(body.whatsapp || "").trim() || null,
      email: String(body.email || "").trim() || null,
      store_addresses: String(body.stores || "").trim() || null,
      city_country: String(body.cityCountry || "").trim() || null,
      customer_type: String(body.customerType || "").trim() || null,
      vip_level: String(body.vipLevel || "").trim() || null,
      credit_level: String(body.creditLevel || "").trim() || null,
      tag_text: String(body.tags || "").trim() || null,
      order_stat_text: String(body.orderStats || "").trim() || null,
    };

    if (id) {
      const target = await withPrismaRetry(() => prisma.customerProfile.findFirst({
        where: { id, tenant_id: session.tenantId, company_id: session.companyId },
        select: { id: true },
      }));
      if (!target) return NextResponse.json({ ok: false, error: "客户不存在" }, { status: 404 });
      await withPrismaRetry(() =>
        prisma.customerProfile.update({ where: { id }, data }),
      );
      return NextResponse.json({ ok: true, id });
    }

    const created = await withPrismaRetry(() => prisma.customerProfile.create({
      data: { tenant_id: session.tenantId, company_id: session.companyId, ...data },
      select: { id: true },
    }));
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "保存客户失败" }, { status: 500 });
  }
}

