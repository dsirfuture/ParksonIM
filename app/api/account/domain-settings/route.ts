import { NextRequest, NextResponse } from "next/server";
import { ensureCustomerDomainConfigById, normalizeCustomDomain, rebuildCustomerDefaultSlug } from "@/lib/customer-domain";
import { disableCustomerManagedDomain, provisionCustomerCustomDomain } from "@/lib/nginx-proxy-manager";
import { prisma } from "@/lib/prisma";
import { getCustomerSettingsAccess } from "@/lib/customer-settings";
import { getSession } from "@/lib/tenant";

async function requireCustomerDomainSession() {
  const session = await getSession();
  if (!session?.dropshippingCustomerId) return null;
  const access = await getCustomerSettingsAccess(session);
  if (!access.canView) return null;
  return {
    session: {
      ...session,
      dropshippingCustomerId: session.dropshippingCustomerId,
    },
    access,
  };
}

const customerDomainSelect = {
  name: true,
  name_zh: true,
  name_en: true,
  custom_domain: true,
  custom_domain_enabled: true,
  default_slug: true,
  default_access_url: true,
  domain_source: true,
  domain_status: true,
} as const;

function buildGuide(domain: string) {
  return {
    recordType: "CNAME",
    host: domain,
    value: "im.parksonmx.top",
  };
}

function serializeDomain(updated: {
  name: string;
  custom_domain: string | null;
  custom_domain_enabled: boolean;
  default_slug: string | null;
  default_access_url: string | null;
  domain_source: string;
  domain_status: string;
}) {
  return {
    customerName: updated.name,
    customDomain: updated.custom_domain || "",
    customDomainEnabled: updated.custom_domain_enabled,
    defaultSlug: updated.default_slug || "",
    defaultAccessUrl: updated.default_access_url || "",
    domainSource: updated.domain_source,
    domainStatus: updated.domain_status,
    guide: updated.custom_domain ? buildGuide(updated.custom_domain) : null,
  };
}

export async function GET() {
  const auth = await requireCustomerDomainSession();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const customer = await ensureCustomerDomainConfigById(auth.session.dropshippingCustomerId);
  if (!customer) {
    return NextResponse.json({ ok: false, error: "客户不存在" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    domain: serializeDomain(customer),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireCustomerDomainSession();
  if (!auth?.access.canManage) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const customerName = String(body?.customerName || "").trim();
  const customDomain = normalizeCustomDomain(String(body?.customDomain || "").trim());
  const customDomainEnabled = body?.customDomainEnabled === true && Boolean(customDomain);

  if (!customerName) {
    return NextResponse.json({ ok: false, error: "请输入客户名称" }, { status: 400 });
  }

  const currentCustomer = await prisma.dropshippingCustomer.findFirst({
    where: {
      id: auth.session.dropshippingCustomerId,
      tenant_id: auth.session.tenantId,
      company_id: auth.session.companyId,
    },
    select: {
      id: true,
      tenant_id: true,
      company_id: true,
      custom_domain: true,
      custom_domain_enabled: true,
    },
  });

  if (!currentCustomer) {
    return NextResponse.json({ ok: false, error: "客户不存在" }, { status: 404 });
  }

  if (customDomain) {
    const duplicatedDomain = await prisma.dropshippingCustomer.findFirst({
      where: {
        id: { not: currentCustomer.id },
        custom_domain: customDomain,
      },
      select: { id: true },
    });
    if (duplicatedDomain) {
      return NextResponse.json({ ok: false, error: "该域名已被其他客户使用" }, { status: 400 });
    }
  }

  const nextAccess = await rebuildCustomerDefaultSlug({
    customerId: currentCustomer.id,
    tenantId: currentCustomer.tenant_id,
    companyId: currentCustomer.company_id,
    name: customerName,
  });

  let updated = await prisma.$transaction(async (tx) => {
    const nextCustomer = await tx.dropshippingCustomer.update({
      where: { id: currentCustomer.id },
      data: {
        name: customerName,
        custom_domain: customDomain || null,
        custom_domain_enabled: customDomainEnabled,
        default_slug: nextAccess.defaultSlug,
        default_access_url: nextAccess.defaultAccessUrl,
        domain_source: customDomain ? "custom" : "system_default",
        domain_status: customDomain
          ? customDomainEnabled
            ? "pending_verification"
            : "disabled"
          : "not_set",
        domain_updated_at: new Date(),
        domain_updated_by: auth.session.userId,
      },
      select: customerDomainSelect,
    });

    await tx.user.updateMany({
      where: {
        tenant_id: auth.session.tenantId,
        company_id: auth.session.companyId,
        dropshipping_customer_id: currentCustomer.id,
        OR: [{ user_type: "dropshipping_customer" }, { customer_org_role: "owner" }],
      },
      data: {
        company_name: customerName,
        updated_by_user_id: auth.session.userId,
      },
    });

    return nextCustomer;
  });

  let responseMessage = "保存成功";

  try {
    if (currentCustomer.custom_domain && currentCustomer.custom_domain !== customDomain) {
      await disableCustomerManagedDomain({
        customerId: currentCustomer.id,
        domain: currentCustomer.custom_domain,
      });
    }

    if (!customDomain) {
      updated = await prisma.dropshippingCustomer.update({
        where: { id: currentCustomer.id },
        data: {
          domain_status: "not_set",
        },
        select: customerDomainSelect,
      });
      responseMessage = "默认访问地址已保留，自有域名已移除";
    } else if (!customDomainEnabled) {
      await disableCustomerManagedDomain({
        customerId: currentCustomer.id,
        domain: customDomain,
      });
      updated = await prisma.dropshippingCustomer.update({
        where: { id: currentCustomer.id },
        data: {
          domain_status: "disabled",
        },
        select: customerDomainSelect,
      });
      responseMessage = "自有域名已保存，当前为停用状态";
    } else {
      const provisioning = await provisionCustomerCustomDomain({
        customerId: currentCustomer.id,
        domain: customDomain,
      });
      updated = await prisma.dropshippingCustomer.update({
        where: { id: currentCustomer.id },
        data: {
          domain_status: provisioning.status,
        },
        select: customerDomainSelect,
      });
      responseMessage = provisioning.message;
    }
  } catch (caughtError) {
    updated = await prisma.dropshippingCustomer.update({
      where: { id: currentCustomer.id },
      data: {
        domain_status: customDomain ? "pending_verification" : "not_set",
      },
      select: customerDomainSelect,
    });
    responseMessage =
      caughtError instanceof Error
        ? `域名已保存，但 HTTPS 尚未启用：${caughtError.message}`
        : "域名已保存，但 HTTPS 尚未启用";
  }

  return NextResponse.json({
    ok: true,
    message: responseMessage,
    domain: serializeDomain(updated),
  });
}

export async function POST() {
  const auth = await requireCustomerDomainSession();
  if (!auth?.access.canManage) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const currentCustomer = await prisma.dropshippingCustomer.findFirst({
    where: {
      id: auth.session.dropshippingCustomerId,
      tenant_id: auth.session.tenantId,
      company_id: auth.session.companyId,
    },
    select: customerDomainSelect,
  });

  if (!currentCustomer) {
    return NextResponse.json({ ok: false, error: "客户不存在" }, { status: 404 });
  }

  if (!currentCustomer.custom_domain || !currentCustomer.custom_domain_enabled) {
    return NextResponse.json({ ok: false, error: "请先填写并启用自有域名" }, { status: 400 });
  }

  try {
    const provisioning = await provisionCustomerCustomDomain({
      customerId: auth.session.dropshippingCustomerId,
      domain: currentCustomer.custom_domain,
    });

    const updated = await prisma.dropshippingCustomer.update({
      where: { id: auth.session.dropshippingCustomerId },
      data: {
        domain_status: provisioning.status,
        domain_updated_at: new Date(),
        domain_updated_by: auth.session.userId,
      },
      select: customerDomainSelect,
    });

    return NextResponse.json({
      ok: true,
      message: provisioning.message,
      domain: serializeDomain(updated),
    });
  } catch (caughtError) {
    const updated = await prisma.dropshippingCustomer.update({
      where: { id: auth.session.dropshippingCustomerId },
      data: {
        domain_status: "pending_verification",
        domain_updated_at: new Date(),
        domain_updated_by: auth.session.userId,
      },
      select: customerDomainSelect,
    });

    return NextResponse.json({
      ok: true,
      message: "域名已保存，HTTPS 尚未启用，请稍后再点“检查解析”",
      domain: serializeDomain(updated),
    });
  }
}
