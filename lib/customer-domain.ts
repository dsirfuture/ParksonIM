import { prisma } from "@/lib/prisma";
import { pinyin } from "pinyin-pro";

type CustomerDomainRecord = {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  name_zh: string | null;
  name_en: string | null;
  custom_domain: string | null;
  custom_domain_enabled: boolean;
  default_slug: string | null;
  default_access_url: string | null;
  domain_source: string;
  domain_status: string;
};

type CustomerDomainDb = {
  dropshippingCustomer: {
    findUnique: typeof prisma.dropshippingCustomer.findUnique;
    findFirst: typeof prisma.dropshippingCustomer.findFirst;
    update: typeof prisma.dropshippingCustomer.update;
  };
};

const DEFAULT_DOMAIN_HOST = "https://im.parksonmx.top";

function normalizeAsciiSlug(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeChineseSlug(input: string) {
  const source = String(input || "").trim();
  if (!source) return "";
  return normalizeAsciiSlug(
    pinyin(source, {
      toneType: "none",
      type: "array",
      nonZh: "consecutive",
    }).join(" "),
  );
}

function getSlugBase(record: Pick<CustomerDomainRecord, "name" | "name_zh" | "name_en">) {
  const normalizedName = String(record.name || "").trim();
  const primaryNameSlug = /[\u3400-\u9fff]/.test(normalizedName)
    ? normalizeChineseSlug(normalizedName)
    : normalizeAsciiSlug(normalizedName);
  const candidates = [
    primaryNameSlug,
    normalizeChineseSlug(record.name_zh || ""),
    normalizeAsciiSlug(String(record.name_en || "").trim()),
  ];
  for (const slug of candidates) {
    if (slug) return slug;
  }
  return "customer";
}

async function buildUniqueSlug(
  db: CustomerDomainDb,
  record: Pick<CustomerDomainRecord, "id" | "tenant_id" | "company_id" | "name" | "name_zh" | "name_en">,
) {
  const base = getSlugBase(record);
  let nextSlug = base;
  let counter = 2;

  while (true) {
    const duplicated = await db.dropshippingCustomer.findFirst({
      where: {
        id: { not: record.id },
        default_slug: nextSlug,
      },
      select: { id: true },
    });

    if (!duplicated) return nextSlug;
    nextSlug = `${base}-${counter}`;
    counter += 1;
  }
}

export function normalizeCustomDomain(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9.-]/g, "");
}

export function buildDefaultAccessUrl(slug: string) {
  return `${DEFAULT_DOMAIN_HOST}/${slug}`;
}

export async function ensureCustomerDomainConfigById(
  customerId: string,
  db: CustomerDomainDb = prisma,
) {
  const record = await db.dropshippingCustomer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      tenant_id: true,
      company_id: true,
      name: true,
      name_zh: true,
      name_en: true,
      custom_domain: true,
      custom_domain_enabled: true,
      default_slug: true,
      default_access_url: true,
      domain_source: true,
      domain_status: true,
    },
  });

  if (!record) return null;

  if (record.default_slug && record.default_access_url) {
    return record;
  }

  const defaultSlug = await buildUniqueSlug(db, record);
  const defaultAccessUrl = buildDefaultAccessUrl(defaultSlug);

  return await db.dropshippingCustomer.update({
    where: { id: customerId },
    data: {
      default_slug: defaultSlug,
      default_access_url: defaultAccessUrl,
      domain_source: record.custom_domain ? "custom" : "system_default",
      domain_status: record.custom_domain
        ? record.custom_domain_enabled
          ? "pending_verification"
          : "disabled"
        : "not_set",
    },
    select: {
      id: true,
      tenant_id: true,
      company_id: true,
      name: true,
      name_zh: true,
      name_en: true,
      custom_domain: true,
      custom_domain_enabled: true,
      default_slug: true,
      default_access_url: true,
      domain_source: true,
      domain_status: true,
    },
  });
}

export async function rebuildCustomerDefaultSlug(params: {
  customerId: string;
  tenantId: string;
  companyId: string;
  name: string;
  nameZh?: string | null;
  nameEn?: string | null;
  db?: CustomerDomainDb;
}) {
  const db = params.db || prisma;
  const nextSlug = await buildUniqueSlug(db, {
    id: params.customerId,
    tenant_id: params.tenantId,
    company_id: params.companyId,
    name: params.name,
    name_zh: params.nameZh || null,
    name_en: params.nameEn || null,
  });

  return {
    defaultSlug: nextSlug,
    defaultAccessUrl: buildDefaultAccessUrl(nextSlug),
  };
}
