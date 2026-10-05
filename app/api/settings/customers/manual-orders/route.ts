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

function normalizeOrderChannel(value: unknown, isYgOrder: boolean) {
  if (isYgOrder) return "友购";
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["微信", "wechat"].includes(normalized)) return "微信";
  if (["whatsapp", "what's app"].includes(normalized)) return "WhatsApp";
  return null;
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
    const sourceType = String(body.sourceType || "").trim();
    const ygOrderNo = String(body.ygOrderNo || "").trim();
    const externalOrderNo = String(body.externalOrderNo || "").trim();
    const isYgOrder = Boolean(ygOrderNo);
    const hasExternalOrder = Boolean(externalOrderNo);
    if (isYgOrder && hasExternalOrder) {
      return NextResponse.json({ ok: false, error: "请将友购订单和其他渠道订单分开保存" }, { status: 400 });
    }
    const packingAmountText = String(body.packingAmount || "").replace(/[^0-9.-]/g, "").trim();
    const billingAmountOverrideText = String(body.billingAmountOverride || "").replace(/[^0-9.-]/g, "").trim();
    const isVoided = Boolean(body.isVoided);
    const normalizedBillingAmountOverrideText =
      isVoided ? "0.00" : (billingAmountOverrideText || (isYgOrder || sourceType === "yg" ? packingAmountText : ""));
    const normalizedPackingAmountText = isVoided ? "0.00" : packingAmountText;
    const resolvedOrderChannel = normalizeOrderChannel(body.orderChannel, isYgOrder);
    const resolvedShippedAt = parseOptionalDate(isYgOrder ? body.ygShippedAt ?? body.shippedAt : body.shippedAt);

    const payload = {
      customer_profile_id: profileId,
      customer_name: customerName,
      yg_order_no: ygOrderNo || null,
      external_order_no: isYgOrder ? null : externalOrderNo || null,
      order_channel: resolvedOrderChannel,
      is_voided: isVoided,
      billing_amount_override: normalizedBillingAmountOverrideText || null,
      packing_amount: normalizedPackingAmountText || null,
      shipped_at: resolvedShippedAt,
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
        prisma.$transaction(async (tx) => {
          const nextRecord = await tx.customerManualOrderRecord.update({
            where: { id: recordId },
            data: payload,
            select: { id: true, yg_order_no: true },
          });
          if (isVoided) {
            await tx.customerPaymentRecord.deleteMany({
              where: {
                tenant_id: session.tenantId,
                company_id: session.companyId,
                OR: [
                  { manual_order_record_id: recordId },
                  nextRecord.yg_order_no ? { source_type: "yg", order_no: nextRecord.yg_order_no } : undefined,
                ].filter(Boolean),
              },
            });
          }
          return nextRecord;
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
