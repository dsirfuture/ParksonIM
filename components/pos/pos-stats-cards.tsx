type PosStatCard = {
  label: string;
  hint?: string;
};

type PosStatsCardsProps = {
  items: PosStatCard[];
};

export function PosStatsCards({ items }: PosStatsCardsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex min-h-[74px] flex-col justify-between rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-soft">
          <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
          {item.hint ? <div className="mt-1 text-[17px] font-semibold leading-5 text-slate-800">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
