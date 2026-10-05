"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SummaryFilterKey = "all" | "diffQty" | "uncheckedQty";

type SummaryCardItem = {
  key: SummaryFilterKey;
  label: string;
  value: number;
  valueClassName: string;
  clickable: boolean;
};

export function ReceiptSummaryCardsClient({
  activeFilter,
  items,
}: {
  activeFilter: SummaryFilterKey;
  items: SummaryCardItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(nextFilter: SummaryFilterKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", nextFilter);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="mt-5 grid gap-3 xl:grid-cols-8">
      {items.map((item) => {
        const selected = activeFilter === item.key && item.key !== "all";
        return (
          <button
            key={`${item.key}-${item.label}`}
            type="button"
            onClick={() =>
              item.clickable
                ? updateFilter(activeFilter === item.key ? "all" : item.key)
                : updateFilter("all")
            }
            className={`w-full rounded-2xl border px-5 py-4 text-left ${
              selected
                ? "border-primary bg-primary/5"
                : "border-slate-200 bg-slate-50"
            } ${
              item.clickable
                ? "cursor-pointer transition hover:border-primary/40 hover:bg-primary/5"
                : "cursor-default"
            }`}
          >
            <div className="text-sm text-slate-500">{item.label}</div>
            <div
              className={`mt-2 text-[18px] font-bold leading-none ${item.valueClassName}`}
            >
              {item.value}
            </div>
          </button>
        );
      })}
    </div>
  );
}
