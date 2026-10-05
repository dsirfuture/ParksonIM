export type PosFolioKind = "sale" | "suspended" | "quote" | "refund" | "transfer";

function buildRandomFiveDigitNumber() {
  return String(Math.floor(Math.random() * 100000)).padStart(5, "0");
}

export function generatePosFolio(_kind: PosFolioKind) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `POS-${date}-${buildRandomFiveDigitNumber()}`;
}
