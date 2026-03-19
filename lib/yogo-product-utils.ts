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

function parsePercentNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseYogoDiscountNumbers(categoryName: string | null, sourceDiscount: unknown) {
  const text = String(categoryName || "");
  const pair = text.match(/(\d+(?:\.\d+)?)%\s*\+\s*VIP\s*(\d+(?:\.\d+)?)%/i);
  if (pair) {
    return {
      normal: parsePercentNumber(pair[1]),
      vip: parsePercentNumber(pair[2]),
    };
  }

  const vipOnly = text.match(/VIP\s*(\d+(?:\.\d+)?)%/i);
  if (vipOnly) {
    const normalOnly = text.match(/(\d+(?:\.\d+)?)%/);
    return {
      normal: parsePercentNumber(normalOnly?.[1]),
      vip: parsePercentNumber(vipOnly[1]),
    };
  }

  return {
    normal: toNumber(sourceDiscount),
    vip: null,
  };
}

export function parseYogoDiscountParts(categoryName: string | null, sourceDiscount: unknown) {
  const { normal, vip } = parseYogoDiscountNumbers(categoryName, sourceDiscount);
  return {
    normal: normal === null ? "-" : formatPercent(normal),
    vip: vip === null ? "-" : formatPercent(vip),
  };
}

export function stripLeadingCategoryCode(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  // Only strip a leading numeric code when it is followed by whitespace.
  // Example: "07 力控玩具" -> "力控玩具", but "1比1款香水" should stay unchanged.
  return text.replace(/^\d+[ \t\u3000]+/u, "").trim();
}

// Reserved for next step: extract numeric category code for mapping settings.
export function extractCategoryCode(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d+)/u);
  return match ? match[1] : "";
}
