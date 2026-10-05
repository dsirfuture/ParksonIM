export type PosDataMode = "real" | "mock";

export function getPosDataMode(): PosDataMode {
  const value = process.env.NEXT_PUBLIC_POS_DATA_MODE?.trim().toLowerCase();
  if (value === "mock") return "mock";
  return "real";
}

export function isPosMockMode() {
  return getPosDataMode() === "mock";
}
