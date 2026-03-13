import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";

function parseDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSupplier(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function syncSuppliersFromYogo(tenantId: string, companyId: string) {
  const [existingProfiles, yogoSuppliers] = await Promise.all([
    withPrismaRetry(() =>
      prisma.supplierProfile.findMany({
        where: { tenant_id: tenantId, company_id: companyId },
        select: { short_name: true },
      }),
    ),
    withPrismaRetry(() =>
      prisma.yogoProductSource.findMany({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          supplier: { not: null },
        },
        select: { supplier: true },
        distinct: ["supplier"],
      }),
    ),
  ]);

  const existingSet = new Set(
    existingProfiles
      .map((row) => normalizeSupplier(row.short_name).toUpperCase())
      .filter(Boolean),
  );
  const stagedSet = new Set<string>();
  const toCreate: Array<{
    tenant_id: string;
    company_id: string;
    short_name: string;
    full_name: string;
    enabled: boolean;
  }> = [];

  for (const row of yogoSuppliers) {
    const normalized = normalizeSupplier(row.supplier);
    if (!normalized) continue;
    const key = normalized.toUpperCase();
    if (existingSet.has(key) || stagedSet.has(key)) continue;
    stagedSet.add(key);
    toCreate.push({
      tenant_id: tenantId,
      company_id: companyId,
      short_name: normalized,
      full_name: normalized,
      enabled: true,
    });
  }

  if (!toCreate.length) return;
  await withPrismaRetry(() =>
    prisma.supplierProfile.createMany({
      data: toCreate,
    }),
  );
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageSuppliers");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    await syncSuppliersFromYogo(session.tenantId, session.companyId);

    const rows = await withPrismaRetry(() =>
      prisma.supplierProfile.findMany({
        where: { tenant_id: session.tenantId, company_id: session.companyId },
        orderBy: [{ updated_at: "desc" }],
      }),
    );
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        shortName: r.short_name,
        fullName: r.full_name,
        logoUrl: r.logo_url || "",
        contact: r.contact_name || "",
        phone: r.phone || "",
        address: r.address || "",
        discountRule: r.category_discounts || "",
        startDate: r.cooperate_start_at ? r.cooperate_start_at.toISOString().slice(0, 10) : "",
        accountPeriodDays: r.account_period_days === null ? "" : String(r.account_period_days),
        enabled: r.enabled,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取供应商失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageSuppliers");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    const shortName = String(body.shortName || "").trim();
    const fullName = String(body.fullName || "").trim();
    if (!shortName || !fullName) {
      return NextResponse.json({ ok: false, error: "简称和全称必填" }, { status: 400 });
    }

    const data = {
      short_name: shortName,
      full_name: fullName,
      logo_url: String(body.logoUrl || "").trim() || null,
      contact_name: String(body.contact || "").trim() || null,
      phone: String(body.phone || "").trim() || null,
      address: String(body.address || "").trim() || null,
      category_discounts: String(body.discountRule || "").trim() || null,
      cooperate_start_at: parseDate(body.startDate),
      account_period_days: String(body.accountPeriodDays || "").trim()
        ? Number(body.accountPeriodDays)
        : null,
      enabled: Boolean(body.enabled ?? true),
    };

    if (id) {
      const target = await withPrismaRetry(() =>
        prisma.supplierProfile.findFirst({
          where: { id, tenant_id: session.tenantId, company_id: session.companyId },
          select: { id: true },
        }),
      );
      if (!target) return NextResponse.json({ ok: false, error: "供应商不存在" }, { status: 404 });
      await withPrismaRetry(() => prisma.supplierProfile.update({ where: { id }, data }));
      return NextResponse.json({ ok: true, id });
    }

    const created = await withPrismaRetry(() =>
      prisma.supplierProfile.create({
        data: { tenant_id: session.tenantId, company_id: session.companyId, ...data },
        select: { id: true },
      }),
    );
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存供应商失败" },
      { status: 500 },
    );
  }
}
