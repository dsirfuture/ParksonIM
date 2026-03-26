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
    const recordId = String(body.id || "").trim();
    const customerName = String(body.customerName || "").trim();
    if (!customerName) {
      return NextResponse.json({ ok: false, error: "customer_name_required" }, { status: 400 });
    }

    const profileId = String(body.customerProfileId || "").trim() || null;
    const paymentTermDaysText = String(body.paymentTermDays || "").trim();
    const paymentTermDays = paymentTermDaysText ? Number.parseInt(paymentTermDaysText, 10) : null;
    const packingAmountText = String(body.packingAmount || "").replace(/[^0-9.-]/g, "").trim();

    const payload = {
      customer_profile_id: profileId,
      customer_name: customerName,
      yg_order_no: String(body.ygOrderNo || "").trim() || null,
      external_order_no: String(body.externalOrderNo || "").trim() || null,
      order_channel: String(body.orderChannel || "").trim() || null,
      packing_amount: packingAmountText || null,
      shipped_at: parseOptionalDate(body.shippedAt),
      paid_at: parseOptionalDate(body.paidAt),
      payment_term_days: Number.isFinite(paymentTermDays as number) ? paymentTermDays : null,
    };

    if (recordId) {
      const existing = await withPrismaRetry(() =>
        prisma.customerManualOrderRecord.findFirst({
          where: {
            id: recordId,
            tenant_id: session.tenantId,
            company_id: session.companyId,
          },
          select: { id: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ ok: false, error: "record_not_found" }, { status: 404 });
      }

      const updated = await withPrismaRetry(() =>
        prisma.customerManualOrderRecord.update({
          where: { id: recordId },
          data: payload,
          select: { id: true },
        }),
      );
      return NextResponse.json({ ok: true, id: updated.id });
    }

    const created = await withPrismaRetry(() =>
      prisma.customerManualOrderRecord.create({
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
      { ok: false, error: error instanceof Error ? error.message : "save_manual_order_failed" },
      { status: 500 },
    );
  }
}
