import { NextResponse } from "next/server";
import {
  buildBillingRemark,
  normalizeBillingSnapshotItems,
  normalizeStoreLabelInput,
  parseBillingSnapshot,
  parseBillingRemark,
  parseBillingBooleanFlag,
  toBillingBooleanFlag,
  type BillingHeaderMeta,
} from "@/lib/billing-meta";
import { verifyPassword } from "@/lib/auth";
import { writeBillingActionLog } from "@/lib/billing-action-log";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { normalizePhone } from "@/lib/user-account";

const FIXED_WAREHOUSE = "PARKSONMX仓";

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
      action?: unknown;
      customerName?: unknown;
      addressText?: unknown;
      contactPhone?: unknown;
      remarkText?: unknown;
      storeLabel?: unknown;
      confirmOrderNo?: unknown;
      revokeReason?: unknown;
      generatedVipEnabled?: unknown;
      snapshotItems?: unknown;
      adminAccount?: unknown;
      adminPassword?: unknown;
      headerMeta?: Partial<Record<keyof BillingHeaderMeta, unknown>>;
    };

    const target = await prisma.ygOrderImport.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true, order_no: true, contact_name: true, order_remark: true },
    });

    if (!target) {
      return NextResponse.json({ ok: false, error: "记录不存在" }, { status: 404 });
    }

    const action = normalizeString(body.action);
    const currentRemark = parseBillingRemark(target.order_remark);
    let overrideOperator: { id: string; name: string } | null = null;

    const updateData: {
      company_name?: string | null;
      customer_name?: string | null;
      address_text?: string | null;
      contact_phone?: string | null;
      order_remark?: string | null;
      store_label?: string | null;
    } = {};

    if (currentRemark.meta.paidAt && action !== "revoke_paid") {
      return NextResponse.json({ ok: false, error: "账单已付款，已永久锁定，只允许导出" }, { status: 409 });
    }

    if (action === "generate") {
      const snapshotItems = normalizeBillingSnapshotItems(body.snapshotItems);
      if (snapshotItems.length === 0) {
        return NextResponse.json({ ok: false, error: "缺少账单快照，无法生成并锁定" }, { status: 400 });
      }
      const nextMeta: BillingHeaderMeta = {
        ...currentRemark.meta,
        generatedAt: new Date().toISOString(),
        generatedVipEnabled: toBillingBooleanFlag(Boolean(body.generatedVipEnabled)),
        revokeReason: "",
        paidAt: "",
        billingSnapshot: JSON.stringify(snapshotItems),
      };
      updateData.order_remark = buildBillingRemark(currentRemark.noteText, nextMeta);
    } else if (action === "mark_paid") {
      if (!currentRemark.meta.generatedAt) {
        return NextResponse.json({ ok: false, error: "请先生成账单后再标记已付款" }, { status: 409 });
      }
      const nextMeta: BillingHeaderMeta = {
        ...currentRemark.meta,
        paidAt: new Date().toISOString(),
      };
      updateData.order_remark = buildBillingRemark(currentRemark.noteText, nextMeta);
    } else if (action === "revoke_paid") {
      if (!currentRemark.meta.paidAt) {
        return NextResponse.json({ ok: false, error: "当前账单未标记已付款" }, { status: 409 });
      }

      const adminAccount = normalizeString(body.adminAccount);
      const adminPassword = typeof body.adminPassword === "string" ? body.adminPassword.trim() : "";
      if (!adminAccount || !adminPassword) {
        return NextResponse.json({ ok: false, error: "请输入管理员账号和密码" }, { status: 400 });
      }

      const normalizedPhone = normalizePhone(adminAccount);
      const adminUser = await prisma.user.findFirst({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          active: true,
          role: "admin",
          OR: [
            { user_id: adminAccount },
            { name: { equals: adminAccount, mode: "insensitive" } },
            { email: { equals: adminAccount, mode: "insensitive" } },
            { phone: normalizedPhone || "__invalid__" },
          ],
        },
        select: {
          id: true,
          name: true,
          password_hash: true,
        },
        orderBy: {
          created_at: "asc",
        },
      });

      if (!adminUser || !verifyPassword(adminPassword, adminUser.password_hash)) {
        return NextResponse.json({ ok: false, error: "管理员账号或密码不正确" }, { status: 401 });
      }

      const nextMeta: BillingHeaderMeta = {
        ...currentRemark.meta,
        paidAt: "",
      };
      updateData.order_remark = buildBillingRemark(currentRemark.noteText, nextMeta);
      overrideOperator = {
        id: adminUser.id,
        name: adminUser.name,
      };
    } else if (action === "revoke") {
      const confirmOrderNo = normalizeString(body.confirmOrderNo);
      const revokeReason = normalizeString(body.revokeReason);
      if (confirmOrderNo !== target.order_no) {
        return NextResponse.json({ ok: false, error: "请输入完整且正确的订单号" }, { status: 400 });
      }
      if (!revokeReason) {
        return NextResponse.json({ ok: false, error: "请填写撤销原因" }, { status: 400 });
      }
      const nextMeta: BillingHeaderMeta = {
        ...currentRemark.meta,
        generatedAt: "",
        generatedVipEnabled: "",
        revokeReason,
        billingSnapshot: "",
      };
      updateData.order_remark = buildBillingRemark(currentRemark.noteText, nextMeta);
    } else if (currentRemark.meta.generatedAt) {
      return NextResponse.json({ ok: false, error: "账单已生成，请先撤销生成后再编辑" }, { status: 409 });
    }

    if (!action && "customerName" in body) {
      const normalizedCustomerName = normalizeString(body.customerName);
      updateData.customer_name = normalizedCustomerName;
      updateData.company_name = normalizedCustomerName;
    }
    if (!action && "addressText" in body) {
      updateData.address_text = normalizeString(body.addressText);
    }
    if (!action && "contactPhone" in body) {
      updateData.contact_phone = normalizeMexicoPhone(body.contactPhone);
    }
    if (!action && "remarkText" in body) {
      const headerMetaInput = Object.fromEntries(
        Object.entries(body.headerMeta || {}).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
      ) as Partial<BillingHeaderMeta>;
      updateData.order_remark = buildBillingRemark(normalizeString(body.remarkText), headerMetaInput);
    }
    if (!action && "storeLabel" in body) {
      updateData.store_label = normalizeStoreLabelInput(body.storeLabel) || null;
    }

    const updated = await prisma.ygOrderImport.update({
      where: { id: target.id },
      data: updateData,
      select: {
        id: true,
        company_name: true,
        customer_name: true,
        contact_name: true,
        address_text: true,
        contact_phone: true,
        order_remark: true,
        store_label: true,
      },
    });
    const parsedRemark = parseBillingRemark(updated.order_remark);
    const snapshotItems = parseBillingSnapshot(parsedRemark.meta.billingSnapshot);

    if (action === "generate") {
      await writeBillingActionLog({
        tenantId: session.tenantId,
        companyId: session.companyId,
        orderNo: target.order_no,
        actionType: "generate",
        detailText: Boolean(body.generatedVipEnabled) ? "生成账单（启用VIP折扣）" : "生成账单",
        operatorId: session.userId,
        operatorName: session.name,
      });
    } else if (action === "mark_paid") {
      await writeBillingActionLog({
        tenantId: session.tenantId,
        companyId: session.companyId,
        orderNo: target.order_no,
        actionType: "mark_paid",
        detailText: "账单已付款并永久锁定",
        operatorId: session.userId,
        operatorName: session.name,
      });
    } else if (action === "revoke_paid") {
      await writeBillingActionLog({
        tenantId: session.tenantId,
        companyId: session.companyId,
        orderNo: target.order_no,
        actionType: "revoke_paid",
        detailText: "撤销已付款，恢复为已生成账单",
        operatorId: overrideOperator?.id || session.userId,
        operatorName: overrideOperator?.name || session.name,
      });
    } else if (action === "revoke") {
      await writeBillingActionLog({
        tenantId: session.tenantId,
        companyId: session.companyId,
        orderNo: target.order_no,
        actionType: "revoke",
        reasonText: normalizeString(body.revokeReason),
        detailText: "撤销生成",
        operatorId: session.userId,
        operatorName: session.name,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        customerName: updated.customer_name || updated.company_name || "",
        contactName: updated.contact_name || "",
        addressText: updated.address_text || "",
        contactText: updated.contact_phone || "",
        remarkText: parsedRemark.noteText,
        storeLabelText: normalizeStoreLabelInput(updated.store_label),
        issueDateText: parsedRemark.meta.issueDate,
        boxCountText: parsedRemark.meta.boxCount,
        shipDateText: parsedRemark.meta.shipDate,
        warehouseText: FIXED_WAREHOUSE,
        shippingMethodText: parsedRemark.meta.shippingMethod,
        recipientNameText: parsedRemark.meta.recipientName || updated.contact_name || "",
        recipientPhoneText: parsedRemark.meta.recipientPhone || updated.contact_phone || "",
        carrierCompanyText: parsedRemark.meta.carrierCompany,
        paymentTermText: parsedRemark.meta.paymentTerm,
        generatedAtText: parsedRemark.meta.generatedAt,
        generatedVipEnabled: parseBillingBooleanFlag(parsedRemark.meta.generatedVipEnabled),
        paidAtText: parsedRemark.meta.paidAt,
        snapshotItems,
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
