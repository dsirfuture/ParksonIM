import { type PosPayment, type PosPaymentMethod } from "@/lib/pos/types";

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Number(value.toFixed(2)));
}

export function createEmptyPayment(): PosPayment {
  return {
    method: "cash",
    received: 0,
    change: 0,
  };
}

export function setPaymentMethod(total: number, current: PosPayment, method: PosPaymentMethod): PosPayment {
  if (!method) {
    return { ...current, method: null, received: 0, change: 0 };
  }
  if (method === "cash") {
    return {
      ...current,
      method,
      change: normalizeNumber(current.received - total),
    };
  }
  return {
    method,
    received: normalizeNumber(total),
    change: 0,
  };
}

export function setReceivedAmount(total: number, current: PosPayment, received: number): PosPayment {
  return {
    ...current,
    received: normalizeNumber(received),
    change: current.method === "cash" ? normalizeNumber(received - total) : 0,
  };
}
