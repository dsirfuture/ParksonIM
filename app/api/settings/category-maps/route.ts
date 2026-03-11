import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function isInvalidCategory(value: string) {
  const v = normalizeText(value).toLowerCase();
  return !v || v === "0" || v === "-" || v === "--" || v === "n/a" || v === "na";
}

async function syncCategories(tenantId: string, companyId: string) {
  const rows = await withPrismaRetry(() =>
    prisma.productCatalog.findMany({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        category: { not: null },
      },
      select: { category: true },
      distinct: ["category"],
    }),
  );

  const categories = Array.from(
    new Set(
      rows
        .map((row) => normalizeText(row.category))
        .filter((v) => !isInvalidCategory(v)),
    ),
  );

  if (!categories.length) return;

  await withPrismaRetry(() =>
    prisma.$transaction(
      categories.map((categoryZh) =>
        prisma.productCategoryMap.upsert({
          where: {
            tenant_id_company_id_category_zh: {
              tenant_id: tenantId,
              company_id: companyId,
              category_zh: categoryZh,
            },
          },
          create: {
            tenant_id: tenantId,
            company_id: companyId,
            category_zh: categoryZh,
            category_es: null,
            active: true,
          },
          update: {},
        }),
      ),
    ),
  );
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageProducts");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    await syncCategories(session.tenantId, session.companyId);

    const rows = await withPrismaRetry(() =>
      prisma.productCategoryMap.findMany({
        where: { tenant_id: session.tenantId, company_id: session.companyId },
        orderBy: [{ category_zh: "asc" }],
      }),
    );

    return NextResponse.json({
      ok: true,
      items: rows
        .filter((row) => !isInvalidCategory(row.category_zh))
        .map((row) => ({
          id: row.id,
          categoryZh: row.category_zh,
          categoryEs: row.category_es || "",
          active: row.active,
          updatedAt: row.updated_at.toISOString(),
        })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取分类失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageProducts");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const id = normalizeText(body.id);
    const categoryZh = normalizeText(body.categoryZh);
    const categoryEs = normalizeText(body.categoryEs);
    const active = Boolean(body.active ?? true);

    if (!categoryZh || isInvalidCategory(categoryZh)) {
      return NextResponse.json({ ok: false, error: "中文分类不能为空" }, { status: 400 });
    }

    if (id) {
      const target = await withPrismaRetry(() =>
        prisma.productCategoryMap.findFirst({
          where: { id, tenant_id: session.tenantId, company_id: session.companyId },
          select: { id: true },
        }),
      );
      if (!target) return NextResponse.json({ ok: false, error: "分类不存在" }, { status: 404 });

      await withPrismaRetry(() =>
        prisma.productCategoryMap.update({
          where: { id },
          data: {
            category_zh: categoryZh,
            category_es: categoryEs || null,
            active,
          },
        }),
      );
      return NextResponse.json({ ok: true, id });
    }

    const created = await withPrismaRetry(() =>
      prisma.productCategoryMap.create({
        data: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          category_zh: categoryZh,
          category_es: categoryEs || null,
          active,
        },
        select: { id: true },
      }),
    );
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存分类失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageProducts");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const body = (await request.json()) as { id?: unknown };
    const id = normalizeText(body?.id);
    if (!id) return NextResponse.json({ ok: false, error: "缺少分类ID" }, { status: 400 });

    const target = await withPrismaRetry(() =>
      prisma.productCategoryMap.findFirst({
        where: { id, tenant_id: session.tenantId, company_id: session.companyId },
        select: { id: true },
      }),
    );
    if (!target) return NextResponse.json({ ok: false, error: "分类不存在" }, { status: 404 });

    await withPrismaRetry(() => prisma.productCategoryMap.delete({ where: { id: target.id } }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "删除分类失败" },
      { status: 500 },
    );
  }
}
