import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const customerId = String(id || "").trim();
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const settlementMode = String(body.settlementMode || "").trim().toUpperCase();
    if (settlementMode !== "RMB" && settlementMode !== "MXN") {
      return NextResponse.json({ ok: false, error: "invalid_settlement_mode" }, { status: 400 });
    }

    const customer = await prisma.dropshippingCustomer.findFirst({
      where: {
        id: customerId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json({ ok: false, error: "customer_not_found" }, { status: 404 });
    }

    await prisma.dropshippingCustomer.update({
      where: { id: customer.id },
      data: {
        default_settle_rule: settlementMode,
      },
    });

    return NextResponse.json({ ok: true, settlementMode });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "update_customer_failed" },
      { status: 500 },
    );
  }
}
