"use client";

import JsBarcode from "jsbarcode";

function checksumForEan12(input: string) {
  const digits = input.split("").map((item) => Number(item));
  const odd = digits.filter((_, index) => index % 2 === 0).reduce((sum, value) => sum + value, 0);
  const even = digits.filter((_, index) => index % 2 === 1).reduce((sum, value) => sum + value, 0);
  const total = odd + even * 3;
  return String((10 - (total % 10)) % 10);
}

export function normalizeEan13Barcode(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 13) return digits;
  if (digits.length === 12) return `${digits}${checksumForEan12(digits)}`;
  return "";
}

export function canRenderEan13Barcode(value: string) {
  return Boolean(normalizeEan13Barcode(value));
}

export function buildBarcodeSvgMarkup(value: string, options?: { width?: number; height?: number; displayValue?: boolean; margin?: number }) {
  const normalized = normalizeEan13Barcode(value);
  if (!normalized || typeof document === "undefined") return "";
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, normalized, {
      format: "EAN13",
      displayValue: options?.displayValue ?? true,
      fontSize: 10,
      height: options?.height ?? 42,
      width: options?.width ?? 1.4,
      margin: options?.margin ?? 0,
      background: "#ffffff",
      lineColor: "#0f172a",
    });
    return svg.outerHTML;
  } catch {
    return "";
  }
}
