type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  valueClassName?: string;
};

export function StatCard({
  label,
  value,
  hint,
  valueClassName,
}: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft sm:p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={`mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl ${valueClassName || ""}`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs leading-5 text-slate-400">{hint}</div>
      ) : null}
    </div>
  );
}
