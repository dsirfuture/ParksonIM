export type DsStockPriorityAmountInput = {
  skuKey: string;
  quantity: number;
  unitPrice: number;
  normalDiscount: number;
  vipDiscount: number;
  stockBatchKey?: string | null;
  stockBatchQty?: number | null;
};

export type DsStockPriorityAmountOutput<T extends DsStockPriorityAmountInput> = T & {
  displayProductAmount: number;
  displayChargedQty: number;
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
  const remainingStockBySku = new Map<string, number>();
  const consumedBatchKeys = new Set<string>();

  return items.map((item) => {
    const skuKey = String(item.skuKey || "").trim();
    const quantity = Math.max(Number(item.quantity) || 0, 0);
    const stockBatchKey = String(item.stockBatchKey || "").trim();
    const stockBatchQty = Math.max(Number(item.stockBatchQty) || 0, 0);

    let availableStockQty = remainingStockBySku.get(skuKey) || 0;
    let chargedQty = 0;

    if (skuKey && stockBatchKey && stockBatchQty > 0 && !consumedBatchKeys.has(stockBatchKey)) {
      availableStockQty += stockBatchQty;
      consumedBatchKeys.add(stockBatchKey);
    }

    const consumedStockQty = Math.min(availableStockQty, quantity);
    availableStockQty = Math.max(availableStockQty - quantity, 0);
    remainingStockBySku.set(skuKey, availableStockQty);

    const nonStockQty = Math.max(quantity - consumedStockQty, 0);
    chargedQty += nonStockQty;

    return {
      ...item,
      displayProductAmount: computeAmountWithQty(item, chargedQty, vipEnabled),
      displayChargedQty: chargedQty,
      displayConsumedStockQty: consumedStockQty,
      displayRemainingStockQtyAfter: availableStockQty,
    };
  });
}
