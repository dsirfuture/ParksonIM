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
  order_no?: unknown;
  customer_id?: unknown;
  customer_name?: unknown;
  company_name?: unknown;
  contact_name?: unknown;
  contact_phone?: unknown;
  address_text?: unknown;
  order_remark?: unknown;
  store_label?: unknown;
  header_status_id?: unknown;
  header_status?: unknown;
  latest_status?: unknown;
  header_amount?: unknown;
  order_amount?: unknown;
  items_count?: unknown;
  header_updated_at?: unknown;
  synced_at?: unknown;
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
  const orderNo = text(input.order_no) || text(input.order_key);
  if (!orderNo) {
    throw new Error(`Row ${index + 1}: order_no or order_key is required`);
  }
  const rawItems = asItemList(input.items ?? input.details ?? input.lines);
  const items = rawItems.map(parseOrderItem);
  return {
    orderNo,
    orderAmount: numberOrNull(input.header_amount ?? input.order_amount),
    companyName: text(input.company_name),
    customerName: text(input.customer_name),
    contactName: text(input.contact_name),
    contactPhone: text(input.contact_phone),
    addressText: text(input.address_text),
    remarkText: text(input.order_remark),
    storeLabel: text(input.store_label),
    headerStatusId: text(input.header_status_id),
    headerStatus: text(input.header_status),
    latestStatus: text(input.latest_status),
    headerUpdatedAt: dateOrNull(input.header_updated_at ?? input.synced_at),
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

    const hasHeaderStatus = await columnExists("header_status");
    const hasHeaderStatusId = await columnExists("header_status_id");
    const hasLatestStatus = await columnExists("latest_status");
    const hasHeaderUpdatedAt = await columnExists("header_updated_at");
    const hasOrderKey = await columnExists("order_key");
    const hasCustomerId = await columnExists("customer_id");

    for (const order of orders) {
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
          order_amount: order.orderAmount,
          last_three: tailThree(order.orderNo),
          company_name: order.companyName,
          customer_name: order.customerName,
          contact_name: order.contactName,
          contact_phone: order.contactPhone,
          address_text: order.addressText,
          order_remark: order.remarkText,
          store_label: order.storeLabel,
          supplier_count: order.items.length > 0 ? 1 : 0,
          item_count: order.items.length,
          created_by: "yogo-sync",
        },
        update: {
          order_amount: order.orderAmount,
          company_name: order.companyName,
          customer_name: order.customerName,
          contact_name: order.contactName,
          contact_phone: order.contactPhone,
          address_text: order.addressText,
          order_remark: order.remarkText,
          store_label: order.storeLabel,
          supplier_count: order.items.length > 0 ? 1 : 0,
          item_count: order.items.length,
        },
        select: { id: true },
      });

      if (
        hasHeaderStatus ||
        hasHeaderStatusId ||
        hasLatestStatus ||
        hasHeaderUpdatedAt ||
        hasOrderKey ||
        hasCustomerId
      ) {
        const sets: string[] = [];
        const params: unknown[] = [upserted.id];
        if (hasHeaderStatus) {
          params.push(order.headerStatus);
          sets.push(`header_status = $${params.length}`);
        }
        if (hasHeaderStatusId) {
          params.push(order.headerStatusId);
          sets.push(`header_status_id = $${params.length}`);
        }
        if (hasLatestStatus) {
          params.push(order.latestStatus);
          sets.push(`latest_status = $${params.length}`);
        }
        if (hasHeaderUpdatedAt) {
          params.push(order.headerUpdatedAt);
          sets.push(`header_updated_at = $${params.length}`);
        }
        if (hasOrderKey) {
          params.push(order.orderNo);
          sets.push(`order_key = $${params.length}`);
        }
        if (hasCustomerId) {
          params.push(null);
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
            order_amount: order.orderAmount,
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

