import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function normalizeInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeCategory(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const cleaned = normalized.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const body = (await request.json()) as {
      ids?: unknown;
      supplier?: unknown;
      category?: unknown;
      available?: unknown;
      normalDiscount?: unknown;
      vipDiscount?: unknown;
    };

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "未选择产品" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if ("supplier" in body) data.supplier = normalizeString(body.supplier);
    if ("category" in body) data.category = normalizeCategory(body.category);
    if ("normalDiscount" in body) data.normal_discount = normalizeNumber(body.normalDiscount);
    if ("vipDiscount" in body) data.vip_discount = normalizeNumber(body.vipDiscount);
    if ("available" in body) {
      const available = normalizeInt(body.available);
      if (available !== null) {
        data.available = available;
        data.status_text = available === 1 ? "下架" : "上架";
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "请至少填写一个字段" }, { status: 400 });
    }

    const result = await prisma.productCatalog.updateMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        id: { in: ids },
      },
      data,
    });

    return NextResponse.json({ ok: true, updatedCount: result.count });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "批量保存失败" },
      { status: 500 },
    );
  }
}
