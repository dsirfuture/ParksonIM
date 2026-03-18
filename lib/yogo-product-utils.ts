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

const LEGACY_YOGO_CATEGORY_NAME_MAP: Record<string, string> = {
  "000": "下单加微",
  "001": "随时更新",
  "01": "玩具",
  "02": "袜子",
  "03": "生日气球",
  "04": "数字气球",
  "05": "铝膜气球",
  "06": "派对套装",
  "07": "节庆装饰",
  "08": "蜡烛",
  "09": "浪漫礼品",
  "10": "派对服饰",
  "11": "宠物口部用品",
  "12": "宠物穿戴",
  "13": "宠物清洁护理",
  "14": "宠物玩具",
  "15": "宠物项圈",
  "16": "宠物牵引绳",
  "17": "宠物外出用品",
  "18": "宠物喂食用品",
  "19": "猫用品",
  "20": "装饰画",
  "21": "家居装饰",
  "22": "相框",
  "23": "餐盒",
  "24": "电池",
  "25": "香水",
  "26": "杯具",
  "27": "IP周边",
  "28": "香薰",
  "30": "帽子",
  "31": "厨房用品",
  "32": "毛绒玩具",
};

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

export function getLegacyYogoCategoryName(value: string | null | undefined) {
  const code = extractCategoryCode(value);
  if (!code) return "";
  return LEGACY_YOGO_CATEGORY_NAME_MAP[code.slice(0, 3).padStart(code.length >= 3 ? 3 : 2, "0")] || "";
}
