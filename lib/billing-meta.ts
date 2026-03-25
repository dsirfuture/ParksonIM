export type BillingHeaderMeta = {
  issueDate: string;
  boxCount: string;
  shipDate: string;
  warehouse: string;
  shippingMethod: string;
  recipientName: string;
  recipientPhone: string;
  carrierCompany: string;
  paymentTerm: string;
  generatedAt: string;
  generatedVipEnabled: string;
  revokeReason: string;
  paidAt: string;
  billingSnapshot: string;
};

export type BillingSnapshotItem = {
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  qty: number;
  unitPrice: number;
  normalDiscount: number | null;
  vipDiscount: number | null;
};

export const EMPTY_BILLING_HEADER_META: BillingHeaderMeta = {
  issueDate: "",
  boxCount: "",
  shipDate: "",
  warehouse: "",
  shippingMethod: "",
  recipientName: "",
  recipientPhone: "",
  carrierCompany: "",
  paymentTerm: "",
  generatedAt: "",
  generatedVipEnabled: "",
  revokeReason: "",
  paidAt: "",
  billingSnapshot: "",
};

const BILLING_META_PREFIX = "[[BILLING_META]]";
const STORE_LABEL_SUFFIX_RE = /(门店|店)$/g;
const STORE_LABEL_ALLOWED_RE = /[0-9一二三四五六七八九十百千万零两〇]/g;

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeStoreLabelInput(value: unknown) {
  const text = trimString(value).replace(/\s+/g, "").replace(STORE_LABEL_SUFFIX_RE, "");
  const matched = text.match(STORE_LABEL_ALLOWED_RE);
  return matched ? matched.join("") : "";
}

export function formatStoreLabelDisplay(value: unknown) {
  const normalized = normalizeStoreLabelInput(value);
  return normalized ? `${normalized}门店` : "";
}

export function formatPaymentTermDays(value: unknown) {
  const text = trimString(value).replace(/天$/g, "");
  return text ? `${text}天` : "";
}

export function getPaymentTermDisplayLines(value: unknown) {
  const days = formatPaymentTermDays(value);
  if (!days) return [];
  return [`${days} 发货日算起`];
}

export function parseBillingBooleanFlag(value: unknown) {
  const text = trimString(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

export function normalizeMexicoPhone(value: unknown) {
  const digits = trimString(value).replace(/\D/g, "");
  if (digits.length < 10) return "";
  return `+52${digits.slice(-10)}`;
}

export function extractCustomerContactPhone(contactPhone: unknown, remarkText: unknown) {
  const directPhone = trimString(contactPhone);
  if (directPhone) return directPhone;

  const matched = trimString(remarkText).match(/\+?\d{8,15}/g);
  if (!matched || matched.length === 0) return "";
  return normalizeMexicoPhone(matched[0]);
}

export function toBillingBooleanFlag(value: unknown) {
  return value ? "1" : "";
}

export function normalizeBillingHeaderMeta(
  value: Partial<BillingHeaderMeta> | null | undefined,
): BillingHeaderMeta {
  return {
    issueDate: trimString(value?.issueDate),
    boxCount: trimString(value?.boxCount),
    shipDate: trimString(value?.shipDate),
    warehouse: trimString(value?.warehouse),
    shippingMethod: trimString(value?.shippingMethod),
    recipientName: trimString(value?.recipientName),
    recipientPhone: trimString(value?.recipientPhone),
    carrierCompany: trimString(value?.carrierCompany),
    paymentTerm: trimString(value?.paymentTerm),
    generatedAt: trimString(value?.generatedAt),
    generatedVipEnabled: trimString(value?.generatedVipEnabled),
    revokeReason: trimString(value?.revokeReason),
    paidAt: trimString(value?.paidAt),
    billingSnapshot: trimString(value?.billingSnapshot),
  };
}

export function normalizeBillingSnapshotItems(input: unknown): BillingSnapshotItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const qty = Number(row.qty || 0);
      const unitPrice = Number(row.unitPrice || 0);
      const normalDiscount =
        row.normalDiscount === null || row.normalDiscount === undefined || row.normalDiscount === ""
          ? null
          : Number(row.normalDiscount);
      const vipDiscount =
        row.vipDiscount === null || row.vipDiscount === undefined || row.vipDiscount === ""
          ? null
          : Number(row.vipDiscount);
      return {
        sku: trimString(row.sku),
        barcode: trimString(row.barcode),
        nameZh: trimString(row.nameZh),
        nameEs: trimString(row.nameEs),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        normalDiscount:
          normalDiscount !== null && Number.isFinite(normalDiscount) ? normalDiscount : null,
        vipDiscount:
          vipDiscount !== null && Number.isFinite(vipDiscount) ? vipDiscount : null,
      } satisfies BillingSnapshotItem;
    })
    .filter((item): item is BillingSnapshotItem => Boolean(item && item.qty > 0));
}

export function parseBillingSnapshot(snapshotText: string | null | undefined) {
  const raw = trimString(snapshotText);
  if (!raw) return [];
  try {
    return normalizeBillingSnapshotItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function parseBillingRemark(raw: string | null | undefined) {
  const text = String(raw || "");
  if (!text.startsWith(BILLING_META_PREFIX)) {
    return {
      noteText: text,
      meta: { ...EMPTY_BILLING_HEADER_META },
    };
  }

  const body = text.slice(BILLING_META_PREFIX.length);
  const metaMatch = body.match(/^\s*(\{[\s\S]*?\})/);
  const metaJson = metaMatch?.[1]?.trim() || "";
  const noteText = body
    .slice(metaMatch?.[0]?.length || 0)
    .replace(/^\s*\+\s*/u, "")
    .trim();

  try {
    const parsed = JSON.parse(metaJson) as Partial<BillingHeaderMeta>;
    return {
      noteText,
      meta: normalizeBillingHeaderMeta(parsed),
    };
  } catch {
    return {
      noteText: text,
      meta: { ...EMPTY_BILLING_HEADER_META },
    };
  }
}

export function buildBillingRemark(
  noteText: string | null | undefined,
  metaValue: Partial<BillingHeaderMeta> | null | undefined,
) {
  const meta = normalizeBillingHeaderMeta(metaValue);
  const note = trimString(noteText);
  const hasMeta = Object.values(meta).some(Boolean);

  if (!hasMeta && !note) return null;
  if (!hasMeta) return note || null;

  const payload = `${BILLING_META_PREFIX}${JSON.stringify(meta)}`;
  return note ? `${payload}\n${note}` : payload;
}
