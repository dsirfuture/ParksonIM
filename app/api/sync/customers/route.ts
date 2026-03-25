import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SYNC_CUSTOMERS_LOCK_CLASS = 24032026;
const SYNC_CUSTOMERS_LOCK_ID = 1;
const SYNC_CUSTOMERS_COOLDOWN_MS = 15_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RawCustomer = {
  customer_key?: unknown;
  customerKey?: unknown;
  customer_id?: unknown;
  customerId?: unknown;
  customer_no?: unknown;
  customerNo?: unknown;
  registered_phone?: unknown;
  registeredPhone?: unknown;
  phone?: unknown;
  tel?: unknown;
  company_name?: unknown;
  companyName?: unknown;
  name?: unknown;
  note_text?: unknown;
  noteText?: unknown;
  note?: unknown;
  remark?: unknown;
  relation_no?: unknown;
  relationNo?: unknown;
  relation_name?: unknown;
  relationName?: unknown;
  group_name?: unknown;
  groupName?: unknown;
  province_name?: unknown;
  provinceName?: unknown;
  province?: unknown;
  region_name?: unknown;
  regionName?: unknown;
  region?: unknown;
  city?: unknown;
  status_text?: unknown;
  statusText?: unknown;
  status?: unknown;
  sales_rep_name?: unknown;
  salesRepName?: unknown;
  registered_at?: unknown;
  registeredAt?: unknown;
  last_visited_at?: unknown;
  lastVisitedAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  last_order_at?: unknown;
  lastOrderAt?: unknown;
  last_order_no?: unknown;
  lastOrderNo?: unknown;
  synced_at?: unknown;
  syncedAt?: unknown;
};

type CustomerSyncState = {
  lastFinishedAt: number;
};

function getCustomerSyncState() {
  const scope = globalThis as typeof globalThis & {
    __parksonimCustomerSyncState?: CustomerSyncState;
  };
  if (!scope.__parksonimCustomerSyncState) {
    scope.__parksonimCustomerSyncState = { lastFinishedAt: 0 };
  }
  return scope.__parksonimCustomerSyncState;
}

function readApiKey(request: Request) {
  const direct = request.headers.get("x-api-key")?.trim();
  if (direct) return direct;
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function text(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const v = value.trim();
    return v ? v : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function dateOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asCustomerList(body: unknown): RawCustomer[] {
  if (Array.isArray(body)) return body as RawCustomer[];
  if (!body || typeof body !== "object") return [];
  const data = body as Record<string, unknown>;
  if (Array.isArray(data.customers)) return data.customers as RawCustomer[];
  if (Array.isArray(data.items)) return data.items as RawCustomer[];
  if (Array.isArray(data.rows)) return data.rows as RawCustomer[];
  if (Array.isArray(data.data)) return data.data as RawCustomer[];
  if (Array.isArray(data.list)) return data.list as RawCustomer[];
  if ("customer_id" in data || "customer_key" in data || "company_name" in data) return [data as RawCustomer];
  return [];
}

function buildCustomerKey(input: RawCustomer) {
  return (
    text(input.customer_key) ||
    text(input.customerKey) ||
    text(input.customer_id) ||
    text(input.customerId) ||
    text(input.customer_no) ||
    text(input.customerNo) ||
    text(input.registered_phone) ||
    text(input.registeredPhone) ||
    text(input.phone) ||
    text(input.tel) ||
    text(input.company_name) ||
    text(input.companyName) ||
    text(input.name) ||
    ""
  ).trim();
}

function normalizeOrderCandidate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  return raw.replace(/\s+/g, "").trim().toUpperCase();
}

function looksLikePhone(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 && !/[A-Z]/i.test(raw);
}

function looksLikeOrderNo(value: string | null | undefined) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return false;
  if (looksLikePhone(raw)) return false;
  return /[A-Z]/.test(raw) && /\d/.test(raw) && raw.length >= 8;
}

function resolveLastOrderNo(input: RawCustomer) {
  const candidates = [
    input.last_order_no,
    input.lastOrderNo,
    (input as RawCustomer & { order_no?: unknown }).order_no,
    (input as RawCustomer & { orderNo?: unknown }).orderNo,
    (input as RawCustomer & { last_order_id?: unknown }).last_order_id,
    (input as RawCustomer & { lastOrderId?: unknown }).lastOrderId,
    (input as RawCustomer & { order_key?: unknown }).order_key,
    (input as RawCustomer & { orderKey?: unknown }).orderKey,
  ]
    .map(normalizeOrderCandidate)
    .filter(Boolean);

  for (const candidate of candidates) {
    if (looksLikeOrderNo(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const expectedApiKey = process.env.YOGO_SYNC_API_KEY?.trim() || "";
  const tenantId = process.env.YOGO_SYNC_TENANT_ID?.trim() || "";
  const companyId = process.env.YOGO_SYNC_COMPANY_ID?.trim() || "";

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

  const syncState = getCustomerSyncState();
  const now = Date.now();
  if (
    syncState.lastFinishedAt > 0 &&
    now - syncState.lastFinishedAt < SYNC_CUSTOMERS_COOLDOWN_MS
  ) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "customers_sync_cooldown",
      },
      { status: 202 },
    );
  }

  const lockRows = await prisma.$queryRawUnsafe<Array<{ locked: boolean }>>(
    `SELECT pg_try_advisory_lock(${SYNC_CUSTOMERS_LOCK_CLASS}::int, ${SYNC_CUSTOMERS_LOCK_ID}::int) AS locked`,
  );
  const hasLock = lockRows[0]?.locked === true;
  if (!hasLock) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "customers_sync_running",
      },
      { status: 202 },
    );
  }

  try {
    const body = (await request.json()) as unknown;
    const rawCustomers = asCustomerList(body);
    if (rawCustomers.length === 0) {
      throw new Error("Payload must be a customer object or an array of customers");
    }

    let upsertedCount = 0;
    for (const item of rawCustomers) {
      const customerKey = buildCustomerKey(item);
      if (!customerKey) continue;

      await prisma.ygCustomerImport.upsert({
        where: {
          tenant_id_company_id_customer_key: {
            tenant_id: tenantId,
            company_id: companyId,
            customer_key: customerKey,
          },
        },
        create: {
          tenant_id: tenantId,
          company_id: companyId,
          customer_key: customerKey,
          customer_id: text(item.customer_id) || text(item.customerId),
          registered_phone:
            text(item.registered_phone) ||
            text(item.registeredPhone) ||
            text(item.phone) ||
            text(item.tel),
          company_name: text(item.company_name) || text(item.companyName) || text(item.name),
          note_text: text(item.note_text) || text(item.noteText) || text(item.note) || text(item.remark),
          relation_no: text(item.relation_no) || text(item.relationNo) || text(item.customer_no) || text(item.customerNo),
          relation_name: text(item.relation_name) || text(item.relationName) || text(item.name),
          group_name: text(item.group_name) || text(item.groupName),
          province_name: text(item.province_name) || text(item.provinceName) || text(item.province),
          region_name: text(item.region_name) || text(item.regionName) || text(item.region) || text(item.city),
          status_text: text(item.status_text) || text(item.statusText) || text(item.status),
          sales_rep_name: text(item.sales_rep_name) || text(item.salesRepName),
          registered_at: dateOrNull(item.registered_at) || dateOrNull(item.registeredAt),
          last_visited_at:
            dateOrNull(item.last_visited_at) ||
            dateOrNull(item.lastVisitedAt) ||
            dateOrNull(item.updated_at) ||
            dateOrNull(item.updatedAt),
          last_order_at: dateOrNull(item.last_order_at) || dateOrNull(item.lastOrderAt),
          last_order_no: resolveLastOrderNo(item),
          synced_at: dateOrNull(item.synced_at) || dateOrNull(item.syncedAt) || new Date(),
        },
        update: {
          customer_id: text(item.customer_id) || text(item.customerId),
          registered_phone:
            text(item.registered_phone) ||
            text(item.registeredPhone) ||
            text(item.phone) ||
            text(item.tel),
          company_name: text(item.company_name) || text(item.companyName) || text(item.name),
          note_text: text(item.note_text) || text(item.noteText) || text(item.note) || text(item.remark),
          relation_no: text(item.relation_no) || text(item.relationNo) || text(item.customer_no) || text(item.customerNo),
          relation_name: text(item.relation_name) || text(item.relationName) || text(item.name),
          group_name: text(item.group_name) || text(item.groupName),
          province_name: text(item.province_name) || text(item.provinceName) || text(item.province),
          region_name: text(item.region_name) || text(item.regionName) || text(item.region) || text(item.city),
          status_text: text(item.status_text) || text(item.statusText) || text(item.status),
          sales_rep_name: text(item.sales_rep_name) || text(item.salesRepName),
          registered_at: dateOrNull(item.registered_at) || dateOrNull(item.registeredAt),
          last_visited_at:
            dateOrNull(item.last_visited_at) ||
            dateOrNull(item.lastVisitedAt) ||
            dateOrNull(item.updated_at) ||
            dateOrNull(item.updatedAt),
          last_order_at: dateOrNull(item.last_order_at) || dateOrNull(item.lastOrderAt),
          last_order_no: resolveLastOrderNo(item),
          synced_at: dateOrNull(item.synced_at) || dateOrNull(item.syncedAt) || new Date(),
        },
      });
      upsertedCount += 1;
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalCount: rawCustomers.length,
        upsertedCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "同步友购客户失败" },
      { status: 500 },
    );
  } finally {
    syncState.lastFinishedAt = Date.now();
    await prisma.$executeRawUnsafe(
      `SELECT pg_advisory_unlock(${SYNC_CUSTOMERS_LOCK_CLASS}::int, ${SYNC_CUSTOMERS_LOCK_ID}::int)`,
    );
  }
}
