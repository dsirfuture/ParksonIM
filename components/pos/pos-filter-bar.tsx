type PosFilterBarProps = {
  items: string[];
};

export function PosFilterBar({ items }: PosFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          key={item}
          className="inline-flex h-10 min-w-[120px] items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-400"
        >
          {item}
        </div>
      ))}
    </div>
  );
}
