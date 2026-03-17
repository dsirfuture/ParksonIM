export function normalizeProductCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function hasSameProductCode(a: unknown, b: unknown) {
  const normalizedA = normalizeProductCode(a);
  const normalizedB = normalizeProductCode(b);
  return Boolean(normalizedA) && normalizedA === normalizedB;
}
