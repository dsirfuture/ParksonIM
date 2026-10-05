type PosActionBarProps = {
  items: string[];
};

export function PosActionBar({ items }: PosActionBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          disabled
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
