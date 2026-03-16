export type BillingHeaderMeta = {
  issueDate: string;
  boxCount: string;
  shipDate: string;
  warehouse: string;
  shippingMethod: string;
  recipientName: string;
  recipientPhone: string;
  carrierCompany: string;
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
};

const BILLING_META_PREFIX = "[[BILLING_META]]";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  };
}

export function parseBillingRemark(raw: string | null | undefined) {
  const text = String(raw || "");
  if (!text.startsWith(BILLING_META_PREFIX)) {
    return {
      noteText: text,
      meta: { ...EMPTY_BILLING_HEADER_META },
    };
  }

  const newlineIndex = text.indexOf("\n");
  const metaJson = text.slice(BILLING_META_PREFIX.length, newlineIndex === -1 ? undefined : newlineIndex).trim();
  const noteText = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1).trim();

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
