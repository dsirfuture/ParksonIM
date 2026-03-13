import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RawOrderItem = {
  line_no?: unknown;
  location?: unknown;
  supplier?: unknown;
  item_no?: unknown;
  sku?: unknown;
  product_code?: unknown;
  barcode?: unknown;
  product_no?: unknown;
  product_name?: unknown;
  name?: unknown;
  qty?: unknown;
  quantity?: unknown;
  total_qty?: unknown;
  unit_price?: unknown;
  price?: unknown;
  line_total?: unknown;
  subtotal?: unknown;
  line_amount?: unknown;
};

type RawOrder = {
  order_key?: unknown;
  orderKey?: unknown;
  order_no?: unknown;
  orderNo?: unknown;
  order_created_at?: unknown;
  orderCreatedAt?: unknown;
  customer_id?: unknown;
  customerId?: unknown;
  customer_name?: unknown;
  customer?: unknown;
  customerName?: unknown;
  company_name?: unknown;
  company?: unknown;
  companyName?: unknown;
  contact_name?: unknown;
  contact?: unknown;
  contactName?: unknown;
  contact_phone?: unknown;
  contactPhone?: unknown;
  address_text?: unknown;
  addressText?: unknown;
  order_remark?: unknown;
  note?: unknown;
  remark?: unknown;
  orderRemark?: unknown;
  store_label?: unknown;
  storeLabel?: unknown;
  header_status_id?: unknown;
  headerStatusId?: unknown;
  header_status?: unknown;
  headerStatus?: unknown;
  latest_status?: unknown;
  latestStatus?: unknown;
  header_amount?: unknown;
  headerAmount?: unknown;
  amount?: unknown;
  order_amount?: unknown;
  orderAmount?: unknown;
  items_count?: unknown;
  itemsCount?: unknown;
  header_updated_at?: unknown;
  headerUpdatedAt?: unknown;
  synced_at?: unknown;
  header?: unknown;
  items?: unknown;
  details?: unknown;
  lines?: unknown;
};

type ParsedOrderItem = {
  lineNo: number;
  location: string;
  itemNo: string | null;
  barcode: string | null;
  productName: string | null;
  qty: number;
  unitPrice: number | null;
  lineTotal: number | null;
};

type ParsedOrder = {
  orderNo: string;
  orderCreatedAt: Date | null;
  customerId: string | null;
  orderAmount: number | null;
  companyName: string | null;
  customerName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  addressText: string | null;
  remarkText: string | null;
  storeLabel: string | null;
  headerStatusId: string | null;
  headerStatus: string | null;
  latestStatus: string | null;
  headerUpdatedAt: Date | null;
  items: ParsedOrderItem[];
};

function text(value: unknown) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrZero(value: unknown) {
  const parsed = numberOrNull(value);
  if (parsed === null) return 0;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
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

function asOrderList(body: unknown): RawOrder[] {
  if (Array.isArray(body)) return body as RawOrder[];
  if (!body || typeof body !== "object") return [];
  const data = body as Record<string, unknown>;
  if (Array.isArray(data.orders)) return data.orders as RawOrder[];
  if (Array.isArray(data.items)) return data.items as RawOrder[];
  if ("order_no" in data || "order_key" in data) return [body as RawOrder];
  return [];
}

function asItemList(input: unknown): RawOrderItem[] {
  if (Array.isArray(input)) return input as RawOrderItem[];
  if (!input || typeof input !== "object") return [];
  const data = input as Record<string, unknown>;
  if (Array.isArray(data.items)) return data.items as RawOrderItem[];
  if (Array.isArray(data.lines)) return data.lines as RawOrderItem[];
  return [];
}

function tailThree(orderNo: string) {
  const digits = orderNo.replace(/\D/g, "");
  return (digits.slice(-3) || "000").padStart(3, "0");
}

function parseOrderItem(input: RawOrderItem, index: number): ParsedOrderItem {
  const lineNo = intOrZero(input.line_no) || index + 1;
  const location = text(input.location) || text(input.supplier) || "-";
  const itemNo =
    text(input.item_no) || text(input.sku) || text(input.product_code) || null;
  const barcode = text(input.barcode) || text(input.product_no) || null;
  const productName = text(input.product_name) || text(input.name) || null;
  const qty = intOrZero(input.total_qty ?? input.qty ?? input.quantity);
  const unitPrice = numberOrNull(input.unit_price ?? input.price);
  const lineTotal = numberOrNull(
    input.line_total ?? input.subtotal ?? input.line_amount,
  );
  return { lineNo, location, itemNo, barcode, productName, qty, unitPrice, lineTotal };
}

function parseOrder(input: RawOrder, index: number): ParsedOrder {
  const header =
    input.header && typeof input.header === "object"
      ? (input.header as Record<string, unknown>)
      : null;
  const orderNo =
    text(input.order_no) ||
    text(input.orderNo) ||
    text(input.order_key) ||
    text(input.orderKey);
  if (!orderNo) {
    throw new Error(`Row ${index + 1}: order_no or order_key is required`);
  }
  const rawItems = asItemList(input.items ?? input.details ?? input.lines);
  const items = rawItems.map(parseOrderItem);
  return {
    orderNo,
    orderCreatedAt: dateOrNull(
      input.order_created_at ??
        input.orderCreatedAt ??
        header?.order_created_at ??
        header?.orderCreatedAt,
    ),
    customerId: text(input.customer_id) || text(input.customerId),
    orderAmount: numberOrNull(
      input.header_amount ??
        input.headerAmount ??
        input.order_amount ??
        input.orderAmount ??
        input.amount ??
        header?.header_amount ??
        header?.headerAmount,
    ),
    companyName:
      text(input.company_name) ||
      text(input.companyName) ||
      text(input.company),
    customerName:
      text(input.customer_name) ||
      text(input.customerName) ||
      text(input.customer),
    contactName:
      text(input.contact_name) ||
      text(input.contactName) ||
      text(input.contact),
    contactPhone: text(input.contact_phone) || text(input.contactPhone),
    addressText: text(input.address_text) || text(input.addressText),
    remarkText:
      text(input.order_remark) ||
      text(input.orderRemark) ||
      text(input.note) ||
      text(input.remark),
    storeLabel: text(input.store_label) || text(input.storeLabel),
    headerStatusId:
      text(input.header_status_id) ||
      text(input.headerStatusId) ||
      text(header?.header_status_id) ||
      text(header?.headerStatusId),
    headerStatus:
      text(input.header_status) ||
      text(input.headerStatus) ||
      text(header?.header_status) ||
      text(header?.headerStatus),
    latestStatus:
      text(input.latest_status) ||
      text(input.latestStatus) ||
      text(header?.latest_status) ||
      text(header?.latestStatus),
    headerUpdatedAt: dateOrNull(
      input.header_updated_at ??
        input.headerUpdatedAt ??
        input.synced_at ??
        header?.header_updated_at ??
        header?.headerUpdatedAt,
    ),
    items,
  };
}

async function columnExists(name: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'yg_order_imports' AND column_name = $1
    `,
    name,
  );
  return rows.length > 0;
}

async function ensurePreviewStatusColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE yg_order_imports
    ADD COLUMN IF NOT EXISTS header_status_id text,
    ADD COLUMN IF NOT EXISTS header_status text,
    ADD COLUMN IF NOT EXISTS latest_status text,
    ADD COLUMN IF NOT EXISTS header_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS order_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS order_key text,
    ADD COLUMN IF NOT EXISTS customer_id text
  `);
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

  try {
    const body = (await request.json()) as unknown;
    const rawOrders = asOrderList(body);
    if (rawOrders.length === 0) {
      throw new Error("Payload must be an order object or an array of orders");
    }

    const parsedOrders = rawOrders.map(parseOrder);
    const deduped = new Map<string, ParsedOrder>();
    for (const order of parsedOrders) deduped.set(order.orderNo, order);
    const orders = Array.from(deduped.values());

    await ensurePreviewStatusColumns();

    const hasHeaderStatus = await columnExists("header_status");
    const hasHeaderStatusId = await columnExists("header_status_id");
    const hasLatestStatus = await columnExists("latest_status");
    const hasHeaderUpdatedAt = await columnExists("header_updated_at");
    const hasOrderCreatedAt = await columnExists("order_created_at");
    const hasOrderKey = await columnExists("order_key");
    const hasCustomerId = await columnExists("customer_id");

    for (const order of orders) {
      const createCompanyName = order.companyName || order.customerName;
      const createCustomerName = order.customerName || order.companyName;
      const createContactName = order.contactName || order.customerName || order.companyName;
      const summedLineTotal = order.items.reduce((sum, item) => {
        const line = item.lineTotal ?? 0;
        return sum + line;
      }, 0);
      const resolvedAmount =
        order.orderAmount !== null
          ? order.orderAmount
          : summedLineTotal > 0
            ? summedLineTotal
            : null;
      const upserted = await prisma.ygOrderImport.upsert({
        where: {
          tenant_id_company_id_order_no: {
            tenant_id: tenantId,
            company_id: companyId,
            order_no: order.orderNo,
          },
        },
        create: {
          tenant_id: tenantId,
          company_id: companyId,
          order_no: order.orderNo,
          source_file_name: "yogo-sync-orders",
          sheet_name: "sync",
          order_amount: resolvedAmount,
          last_three: tailThree(order.orderNo),
          company_name: createCompanyName,
          customer_name: createCustomerName,
          contact_name: createContactName,
          contact_phone: order.contactPhone,
          address_text: order.addressText,
          order_remark: order.remarkText,
          store_label: order.storeLabel,
          supplier_count: order.items.length > 0 ? 1 : 0,
          item_count: order.items.length,
          created_by: "yogo-sync",
        },
        update: {
          ...(resolvedAmount !== null ? { order_amount: resolvedAmount } : {}),
          ...(order.companyName ? { company_name: order.companyName } : {}),
          ...(order.customerName ? { customer_name: order.customerName } : {}),
          ...(order.contactName ? { contact_name: order.contactName } : {}),
          ...(order.contactPhone ? { contact_phone: order.contactPhone } : {}),
          ...(order.addressText ? { address_text: order.addressText } : {}),
          ...(order.remarkText ? { order_remark: order.remarkText } : {}),
          ...(order.storeLabel ? { store_label: order.storeLabel } : {}),
          ...(order.items.length > 0
            ? { supplier_count: 1, item_count: order.items.length }
            : {}),
        },
        select: { id: true },
      });

      if (
        hasHeaderStatus ||
        hasHeaderStatusId ||
        hasLatestStatus ||
        hasHeaderUpdatedAt ||
        hasOrderCreatedAt ||
        hasOrderKey ||
        hasCustomerId
      ) {
        const sets: string[] = [];
        const params: unknown[] = [upserted.id];
        if (hasHeaderStatus && order.headerStatus) {
          params.push(order.headerStatus);
          sets.push(`header_status = $${params.length}`);
        }
        if (hasHeaderStatusId && order.headerStatusId) {
          params.push(order.headerStatusId);
          sets.push(`header_status_id = $${params.length}`);
        }
        if (hasLatestStatus && order.latestStatus) {
          params.push(order.latestStatus);
          sets.push(`latest_status = $${params.length}`);
        }
        if (hasHeaderUpdatedAt && order.headerUpdatedAt) {
          params.push(order.headerUpdatedAt);
          sets.push(`header_updated_at = $${params.length}`);
        }
        if (hasOrderCreatedAt && order.orderCreatedAt) {
          params.push(order.orderCreatedAt);
          sets.push(`order_created_at = $${params.length}`);
        }
        if (hasOrderKey) {
          params.push(order.orderNo);
          sets.push(`order_key = $${params.length}`);
        }
        if (hasCustomerId && order.customerId) {
          params.push(order.customerId);
          sets.push(`customer_id = $${params.length}`);
        }
        if (sets.length > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE yg_order_imports SET ${sets.join(", ")} WHERE id = $1::uuid`,
            ...params,
          );
        }
      }

      await prisma.ygSupplierOrder.deleteMany({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          import_id: upserted.id,
        },
      });

      if (order.items.length > 0) {
        await prisma.ygSupplierOrder.create({
          data: {
            tenant_id: tenantId,
            company_id: companyId,
            import_id: upserted.id,
            order_no: order.orderNo,
            supplier_code: "YOGO",
            derived_order_no: `${order.orderNo}-YOGO-000`,
            order_amount: resolvedAmount,
            note_text: order.remarkText,
            item_count: order.items.length,
            items: {
              create: order.items.map((item) => ({
                tenant_id: tenantId,
                company_id: companyId,
                line_no: item.lineNo,
                location: item.location,
                item_no: item.itemNo,
                barcode: item.barcode,
                product_name: item.productName,
                total_qty: item.qty,
                unit_price: item.unitPrice,
                line_total: item.lineTotal,
              })),
            },
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      requestId: randomUUID(),
      summary: { totalCount: orders.length },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sync failed" },
      { status: 400 },
    );
  }
}
