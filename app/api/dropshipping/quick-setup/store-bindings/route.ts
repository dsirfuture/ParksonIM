// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { hasAppPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const PLATFORM_OPTIONS = [
  "TikTok Shop",
  "Temu",
  "Mercado Libre",
  "SHEIN",
  "Amazon",
];

const STORE_TYPE_OPTIONS = ["cross_border", "local"];

function readBindingMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { source: "quick_setup", storeType: "", site: "" };
  }
  const metadata = value as Record<string, unknown>;
  return {
    source: String(metadata.source || "quick_setup"),
    storeType: String(metadata.storeType || ""),
    site: String(metadata.site || ""),
  };
}

async function requireQuickSetupPermission(permissionKey: string) {
  const session = await getSession();
  if (!session) return { session: null, error: NextResponse.json({ ok: false, error: "未登录" }, { status: 401 }) };
  if (!(await hasAppPermission(session, permissionKey as any))) {
    return { session, error: NextResponse.json({ ok: false, error: "您暂无执行此操作的权限" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function GET() {
  const { session, error } = await requireQuickSetupPermission("dropshipping.quick_setup.store_binding.view");
  if (error) return error;

  const rows = await prisma.dsQuickStoreBinding.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
    },
    orderBy: { created_at: "asc" },
  });

  const map = new Map(rows.map((row) => [row.platform, row]));
  return NextResponse.json({
    ok: true,
    items: PLATFORM_OPTIONS.map((platform) => {
      const row = map.get(platform);
      return {
        platform,
        shopName: row?.shop_name || "",
        bindStatus: row?.bind_status || "unbound",
        authorizedAt: row?.authorized_at?.toISOString() || null,
        expiredAt: row?.expired_at?.toISOString() || null,
        accountId: row?.account_id || "",
        externalShopId: row?.external_shop_id || "",
        storeType: readBindingMetadata(row?.metadata_json).storeType,
        site: readBindingMetadata(row?.metadata_json).site,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireQuickSetupPermission("dropshipping.quick_setup.store_binding.edit");
  if (error) return error;

  const body = await req.json();
  const platform = String(body?.platform || "").trim();
  if (!PLATFORM_OPTIONS.includes(platform)) {
    return NextResponse.json({ ok: false, error: "平台无效" }, { status: 400 });
  }

  const bindStatus = ["bound", "expired", "unbound"].includes(String(body?.bindStatus || ""))
    ? String(body.bindStatus)
    : "bound";
  const shopName = String(body?.shopName || "").trim();
  const storeType = String(body?.storeType || "").trim();
  const site = String(body?.site || "").trim();
  const accountId = String(body?.accountId || "").trim();
  const externalShopId = String(body?.externalShopId || "").trim();

  if (storeType && !STORE_TYPE_OPTIONS.includes(storeType)) {
    return NextResponse.json({ ok: false, error: "店铺类型无效" }, { status: 400 });
  }

  const row = await prisma.dsQuickStoreBinding.upsert({
    where: {
      tenant_id_company_id_user_id_platform: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        user_id: session.userId,
        platform,
      },
    },
    create: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      user_id: session.userId,
      platform,
      shop_name: shopName || `${platform} 店铺`,
      bind_status: bindStatus,
      authorized_at: bindStatus === "bound" ? new Date() : null,
      expired_at: bindStatus === "expired" ? new Date() : null,
      account_id: accountId || null,
      external_shop_id: externalShopId || null,
      metadata_json: {
        source: "quick_setup",
        storeType: storeType || "",
        site: site || "",
      },
    },
    update: {
      shop_name: shopName || `${platform} 店铺`,
      bind_status: bindStatus,
      authorized_at: bindStatus === "bound" ? new Date() : null,
      expired_at: bindStatus === "expired" ? new Date() : null,
      account_id: accountId || null,
      external_shop_id: externalShopId || null,
      metadata_json: {
        source: "quick_setup",
        storeType: storeType || "",
        site: site || "",
      },
    },
  });

  const metadata = readBindingMetadata(row.metadata_json);

  return NextResponse.json({
    ok: true,
    item: {
      platform: row.platform,
      shopName: row.shop_name || "",
      bindStatus: row.bind_status,
      authorizedAt: row.authorized_at?.toISOString() || null,
      expiredAt: row.expired_at?.toISOString() || null,
      accountId: row.account_id || "",
      externalShopId: row.external_shop_id || "",
      storeType: metadata.storeType,
      site: metadata.site,
    },
  });
}
