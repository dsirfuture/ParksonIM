function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return null;
    }
  }
  return null;
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

export function parseYogoDiscountParts(categoryName: string | null, sourceDiscount: unknown) {
  const text = String(categoryName || "");
  const pair = text.match(/(\d+(?:\.\d+)?)%\s*\+\s*VIP\s*(\d+(?:\.\d+)?)%/i);
  if (pair) {
    return {
      normal: formatPercent(Number(pair[1])),
      vip: formatPercent(Number(pair[2])),
    };
  }

  const vipOnly = text.match(/VIP\s*(\d+(?:\.\d+)?)%/i);
  if (vipOnly) {
    const normalOnly = text.match(/(\d+(?:\.\d+)?)%/);
    return {
      normal: normalOnly ? formatPercent(Number(normalOnly[1])) : "-",
      vip: formatPercent(Number(vipOnly[1])),
    };
  }

  const num = toNumber(sourceDiscount);
  return {
    normal: num === null ? "-" : formatPercent(num),
    vip: "-",
  };
}

export function stripLeadingCategoryCode(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.replace(/^\d+\s*/u, "").trim();
}

// Reserved for next step: extract numeric category code for mapping settings.
export function extractCategoryCode(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d+)/u);
  return match ? match[1] : "";
}
