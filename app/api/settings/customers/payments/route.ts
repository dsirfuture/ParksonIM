// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { getSession } from "@/lib/tenant";

function parseOptionalDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const allowed = await hasPermission(session, "manageCustomers");
    if (!allowed) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    const customerName = String(body.customerName || "").trim();
    const orderNo = String(body.orderNo || "").trim();
    const sourceType = String(body.sourceType || "").trim();
    if (!customerName || !orderNo || !sourceType) {
      return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
    }

    const payload = {
      customer_profile_id: String(body.customerProfileId || "").trim() || null,
      manual_order_record_id: String(body.manualOrderRecordId || "").trim() || null,
      source_type: sourceType,
      customer_name: customerName,
      order_no: orderNo,
      payment_amount: String(body.paymentAmount || "").replace(/[^0-9.-]/g, "").trim() || null,
      paid_at: parseOptionalDate(body.paidAt),
      payment_method: String(body.paymentMethod || "").trim() || null,
      payment_target: String(body.paymentTarget || "").trim() || null,
      note: String(body.note || "").trim() || null,
    };

    if (id) {
      const existing = await withPrismaRetry(() =>
        prisma.customerPaymentRecord.findFirst({
          where: {
            id,
            tenant_id: session.tenantId,
            company_id: session.companyId,
          },
          select: { id: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ ok: false, error: "payment_not_found" }, { status: 404 });
      }
      const updated = await withPrismaRetry(() =>
        prisma.customerPaymentRecord.update({
          where: { id },
          data: payload,
          select: { id: true },
        }),
      );
      return NextResponse.json({ ok: true, id: updated.id });
    }

    const created = await withPrismaRetry(() =>
      prisma.customerPaymentRecord.create({
        data: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          ...payload,
        },
        select: { id: true },
      }),
    );

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "save_payment_failed" },
      { status: 500 },
    );
  }
}
