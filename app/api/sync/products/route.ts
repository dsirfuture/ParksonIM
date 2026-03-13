import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type YogoPayload = {
  source?: unknown;
  product_code?: unknown;
  product_no?: unknown;
  name_cn?: unknown;
  name_es?: unknown;
  category_id?: unknown;
  category_name?: unknown;
  subcategory_id?: unknown;
  subcategory_name?: unknown;
  supplier?: unknown;
  baozhuangshu?: unknown;
  zhuangxiangshu?: unknown;
  pack_size?: unknown;
  carton_size?: unknown;
  case_pack?: unknown;
  carton_pack?: unknown;
  casePack?: unknown;
  cartonPack?: unknown;
  source_price?: unknown;
  source_discount?: unknown;
  source_disabled?: unknown;
  source_updated_at?: unknown;
  synced_at?: unknown;
};

type NormalizedProduct = {
  source: string;
  product_code: string;
  product_no: string | null;
  name_cn: string | null;
  name_es: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  subcategory_name: string | null;
  supplier: string | null;
  case_pack: number | null;
  carton_pack: number | null;
  source_price: number | null;
  source_discount: number | null;
  source_disabled: boolean;
  source_updated_at: Date | null;
  synced_at: Date | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: unknown) {
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function booleanOrDefault(value: unknown, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  }
  return defaultValue;
}

function dateOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readApiKey(request: Request) {
  const direct = request.headers.get("x-api-key")?.trim();
  if (direct) return direct;
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function asItemList(body: unknown): YogoPayload[] {
  if (Array.isArray(body)) return body as YogoPayload[];
  if (body && typeof body === "object") {
    const maybeItems = (body as { items?: unknown }).items;
    if (Array.isArray(maybeItems)) return maybeItems as YogoPayload[];
    const maybeProducts = (body as { products?: unknown }).products;
    if (Array.isArray(maybeProducts)) return maybeProducts as YogoPayload[];
    if ("product_code" in (body as Record<string, unknown>)) {
      return [body as YogoPayload];
    }
  }
  return [];
}

function normalizeProduct(input: YogoPayload, index: number): NormalizedProduct {
  const source = text(input.source);
  const productCode = text(input.product_code);
  if (!source) {
    throw new Error(`Row ${index + 1}: source is required`);
  }
  if (!productCode) {
    throw new Error(`Row ${index + 1}: product_code is required`);
  }

  return {
    source,
    product_code: productCode,
    product_no: text(input.product_no),
    name_cn: text(input.name_cn),
    name_es: text(input.name_es),
    category_id: text(input.category_id),
    category_name: text(input.category_name),
    subcategory_id: text(input.subcategory_id),
    subcategory_name: text(input.subcategory_name),
    supplier: text(input.supplier),
    case_pack: intOrNull(
      input.baozhuangshu ?? input.pack_size ?? input.case_pack ?? input.casePack,
    ),
    carton_pack: intOrNull(
      input.zhuangxiangshu ??
        input.carton_size ??
        input.carton_pack ??
        input.cartonPack,
    ),
    source_price: numberOrNull(input.source_price),
    source_discount: numberOrNull(input.source_discount),
    source_disabled: booleanOrDefault(input.source_disabled, false),
    source_updated_at: dateOrNull(input.source_updated_at),
    synced_at: dateOrNull(input.synced_at),
  };
}

export async function POST(request: Request) {
  const expectedApiKey = process.env.YOGO_SYNC_API_KEY?.trim() || "";
  const tenantId = process.env.YOGO_SYNC_TENANT_ID?.trim() || "";
  const companyId = process.env.YOGO_SYNC_COMPANY_ID?.trim() || "";
  const requestId = randomUUID();

  if (!expectedApiKey) {
    return NextResponse.json(
      { ok: false, error: "YOGO_SYNC_API_KEY is not configured" },
      { status: 500 },
    );
  }
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(companyId)) {
    return NextResponse.json(
      { ok: false, error: "YOGO_SYNC_TENANT_ID / YOGO_SYNC_COMPANY_ID is invalid" },
      { status: 500 },
    );
  }

  const apiKey = readApiKey(request);
  if (!apiKey || apiKey !== expectedApiKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let totalCount = 0;
  let firstSource: string | null = null;
  try {
    const body = (await request.json()) as unknown;
    const rawItems = asItemList(body);
    if (rawItems.length === 0) {
      throw new Error("Payload must be a product object or an array of products");
    }

    const dedupedByCode = new Map<string, NormalizedProduct>();
    for (let i = 0; i < rawItems.length; i += 1) {
      const normalized = normalizeProduct(rawItems[i], i);
      dedupedByCode.set(normalized.product_code, normalized);
      if (!firstSource) firstSource = normalized.source;
    }
    const items = Array.from(dedupedByCode.values());
    totalCount = items.length;
    const currentCodes = items.map((item) => item.product_code);

    const existing = await prisma.yogoProductSource.findMany({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        product_code: { in: items.map((item) => item.product_code) },
      },
      select: { product_code: true },
    });
    const existingSet = new Set(existing.map((item) => item.product_code));
    const createdCount = items.filter((item) => !existingSet.has(item.product_code)).length;
    const updatedCount = items.length - createdCount;

    await prisma.$transaction([
      ...items.map((item) =>
        prisma.yogoProductSource.upsert({
          where: {
            tenant_id_company_id_product_code: {
              tenant_id: tenantId,
              company_id: companyId,
              product_code: item.product_code,
            },
          },
          create: {
            tenant_id: tenantId,
            company_id: companyId,
            source: item.source,
            product_code: item.product_code,
            product_no: item.product_no,
            name_cn: item.name_cn,
            name_es: item.name_es,
            category_id: item.category_id,
            category_name: item.category_name,
            subcategory_id: item.subcategory_id,
            subcategory_name: item.subcategory_name,
            supplier: item.supplier,
            case_pack: item.case_pack,
            carton_pack: item.carton_pack,
            source_price: item.source_price,
            source_discount: item.source_discount,
            source_disabled: item.source_disabled,
            source_updated_at: item.source_updated_at,
            synced_at: item.synced_at,
            last_received_at: new Date(),
          },
          update: {
            source: item.source,
            product_no: item.product_no,
            name_cn: item.name_cn,
            name_es: item.name_es,
            category_id: item.category_id,
            category_name: item.category_name,
            subcategory_id: item.subcategory_id,
            subcategory_name: item.subcategory_name,
            supplier: item.supplier,
            case_pack: item.case_pack,
            carton_pack: item.carton_pack,
            source_price: item.source_price,
            source_discount: item.source_discount,
            source_disabled: item.source_disabled,
            source_updated_at: item.source_updated_at,
            synced_at: item.synced_at,
            last_received_at: new Date(),
          },
        }),
      ),
      prisma.yogoProductSource.updateMany({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          source: "yogo",
          product_code: { notIn: currentCodes },
          source_disabled: false,
        },
        data: {
          source_disabled: true,
        },
      }),
      prisma.yogoProductSyncLog.create({
        data: {
          tenant_id: tenantId,
          company_id: companyId,
          source: firstSource,
          request_id: requestId,
          total_count: items.length,
          created_count: createdCount,
          updated_count: updatedCount,
          failed_count: 0,
          status: "success",
          error_message: null,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      requestId,
      summary: {
        totalCount: items.length,
        createdCount,
        updatedCount,
      },
    });
  } catch (error) {
    await prisma.yogoProductSyncLog
      .create({
        data: {
          tenant_id: tenantId,
          company_id: companyId,
          source: firstSource,
          request_id: requestId,
          total_count: totalCount,
          created_count: 0,
          updated_count: 0,
          failed_count: totalCount || 1,
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .catch(() => null);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sync failed", requestId },
      { status: 400 },
    );
  }
}
