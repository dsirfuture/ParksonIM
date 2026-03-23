export type DsStockPriorityAmountInput = {
  skuKey: string;
  quantity: number;
  unitPrice: number;
  normalDiscount: number;
  vipDiscount: number;
  initialCoveredQty?: number | null;
  stockBatchKey?: string | null;
  stockBatchQty?: number | null;
  stockBatchShouldBill?: boolean | null;
};

export type DsStockPriorityAmountOutput<T extends DsStockPriorityAmountInput> = T & {
  displayProductAmount: number;
  displayChargedQty: number;
  displayBilledStockQty: number;
  displayBilledShipmentQty: number;
  displayConsumedStockQty: number;
  displayRemainingStockQtyAfter: number;
};

function normalizeDiscount(value: number) {
  return Math.min(
    Math.max(Math.abs(value) <= 1 ? value : value / 100, 0),
    1,
  );
}

function computeAmountWithQty(
  item: DsStockPriorityAmountInput,
  effectiveQty: number,
  vipEnabled: boolean,
) {
  const normalizedNormalDiscount = normalizeDiscount(item.normalDiscount);
  const normalizedVipDiscount = vipEnabled
    ? normalizeDiscount(item.vipDiscount)
    : 0;

  return item.unitPrice > 0 && effectiveQty > 0
    ? item.unitPrice * effectiveQty * (1 - normalizedNormalDiscount) * (1 - normalizedVipDiscount)
    : 0;
}

export function applyStockPriorityProductAmounts<T extends DsStockPriorityAmountInput>(
  items: T[],
  options?: { vipEnabled?: boolean },
): Array<DsStockPriorityAmountOutput<T>> {
  const vipEnabled = options?.vipEnabled ?? true;
  const consumedBatchKeys = new Set<string>();
  const remainingCoverageBySku = new Map<string, number>();
  const totalCoverageBySku = new Map<string, number>();

  for (const item of items) {
    const skuKey = String(item.skuKey || "").trim();
    if (!skuKey || totalCoverageBySku.has(skuKey)) continue;

    const sameSkuItems = items.filter((entry) => String(entry.skuKey || "").trim() === skuKey);
    const initialCoveredQty = Math.max(
      ...sameSkuItems.map((entry) => Math.max(Number(entry.initialCoveredQty) || 0, 0)),
      0,
    );
    const batchKeys = new Set<string>();
    let billableBatchQty = 0;
    for (const entry of sameSkuItems) {
      const stockBatchKey = String(entry.stockBatchKey || "").trim();
      const stockBatchQty = Math.max(Number(entry.stockBatchQty) || 0, 0);
      const stockBatchShouldBill = Boolean(entry.stockBatchShouldBill);
      if (!stockBatchShouldBill || !stockBatchKey || stockBatchQty <= 0 || batchKeys.has(stockBatchKey)) continue;
      batchKeys.add(stockBatchKey);
      billableBatchQty += stockBatchQty;
    }
    totalCoverageBySku.set(skuKey, initialCoveredQty + billableBatchQty);
    remainingCoverageBySku.set(skuKey, initialCoveredQty + billableBatchQty);
  }

  return items.map((item) => {
    const skuKey = String(item.skuKey || "").trim();
    const quantity = Math.max(Number(item.quantity) || 0, 0);
    const stockBatchKey = String(item.stockBatchKey || "").trim();
    const stockBatchQty = Math.max(Number(item.stockBatchQty) || 0, 0);
    const stockBatchShouldBill = Boolean(item.stockBatchShouldBill);
    let availableCoverageQty = remainingCoverageBySku.get(skuKey) ?? 0;
    let billedStockQty = 0;

    if (skuKey && stockBatchKey && stockBatchQty > 0 && !consumedBatchKeys.has(stockBatchKey)) {
      billedStockQty = stockBatchShouldBill ? stockBatchQty : 0;
      consumedBatchKeys.add(stockBatchKey);
    }

    const consumedStockQty = Math.min(availableCoverageQty, quantity);
    availableCoverageQty = Math.max(availableCoverageQty - quantity, 0);
    remainingCoverageBySku.set(skuKey, availableCoverageQty);

    const billedShipmentQty = Math.max(quantity - consumedStockQty, 0);
    const chargedQty = billedStockQty + billedShipmentQty;

    return {
      ...item,
      displayProductAmount: computeAmountWithQty(item, chargedQty, vipEnabled),
      displayChargedQty: chargedQty,
      displayBilledStockQty: billedStockQty,
      displayBilledShipmentQty: billedShipmentQty,
      displayConsumedStockQty: consumedStockQty,
      displayRemainingStockQtyAfter: availableCoverageQty,
    };
  });
}
