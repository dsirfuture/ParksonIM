import { NextResponse } from "next/server";
import { buildBillingRemark, parseBillingRemark, type BillingHeaderMeta } from "@/lib/billing-meta";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function normalizeMexicoPhone(value: unknown) {
  if (typeof value !== "string") return null;

  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;

  const local10 = digits.slice(-10);
  return `+52${local10}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "缺少订单ID" }, { status: 400 });
    }

    const body = (await request.json()) as {
      customerName?: unknown;
      addressText?: unknown;
      contactPhone?: unknown;
      remarkText?: unknown;
      storeLabel?: unknown;
      headerMeta?: Partial<Record<keyof BillingHeaderMeta, unknown>>;
    };

    const target = await prisma.ygOrderImport.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ ok: false, error: "记录不存在" }, { status: 404 });
    }

    const updateData: {
      customer_name?: string | null;
      address_text?: string | null;
      contact_phone?: string | null;
      order_remark?: string | null;
      store_label?: string | null;
    } = {};

    if ("customerName" in body) {
      updateData.customer_name = normalizeString(body.customerName);
    }
    if ("addressText" in body) {
      updateData.address_text = normalizeString(body.addressText);
    }
    if ("contactPhone" in body) {
      updateData.contact_phone = normalizeMexicoPhone(body.contactPhone);
    }
    if ("remarkText" in body) {
      const headerMetaInput = Object.fromEntries(
        Object.entries(body.headerMeta || {}).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
      ) as Partial<BillingHeaderMeta>;
      updateData.order_remark = buildBillingRemark(normalizeString(body.remarkText), headerMetaInput);
    }
    if ("storeLabel" in body) {
      updateData.store_label = normalizeString(body.storeLabel);
    }

    const updated = await prisma.ygOrderImport.update({
      where: { id: target.id },
      data: updateData,
      select: {
        id: true,
        customer_name: true,
        contact_name: true,
        address_text: true,
        contact_phone: true,
        order_remark: true,
        store_label: true,
      },
    });
    const parsedRemark = parseBillingRemark(updated.order_remark);

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        customerName: updated.customer_name || "",
        contactName: updated.contact_name || "",
        addressText: updated.address_text || "",
        contactText: updated.contact_phone || "",
        remarkText: parsedRemark.noteText,
        storeLabelText: updated.store_label || "",
        issueDateText: parsedRemark.meta.issueDate,
        boxCountText: parsedRemark.meta.boxCount,
        shipDateText: parsedRemark.meta.shipDate,
        warehouseText: parsedRemark.meta.warehouse || updated.store_label || "",
        shippingMethodText: parsedRemark.meta.shippingMethod,
        recipientNameText: parsedRemark.meta.recipientName || updated.contact_name || "",
        recipientPhoneText: parsedRemark.meta.recipientPhone || updated.contact_phone || "",
        carrierCompanyText: parsedRemark.meta.carrierCompany,
        paymentTermText: parsedRemark.meta.paymentTerm,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "保存失败",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "缺少订单ID" }, { status: 400 });
    }

    const body = (await request.json()) as {
      confirmOrderNo?: unknown;
    };

    const confirmOrderNo = normalizeString(body.confirmOrderNo);
    if (!confirmOrderNo) {
      return NextResponse.json({ ok: false, error: "请先输入完整订单号" }, { status: 400 });
    }

    const target = await prisma.ygOrderImport.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
        order_no: true,
      },
    });

    if (!target) {
      return NextResponse.json({ ok: false, error: "记录不存在" }, { status: 404 });
    }

    if (target.order_no !== confirmOrderNo) {
      return NextResponse.json({ ok: false, error: "订单号不匹配" }, { status: 400 });
    }

    await prisma.ygOrderImport.delete({
      where: { id: target.id },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: target.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "删除失败",
      },
      { status: 500 },
    );
  }
}
