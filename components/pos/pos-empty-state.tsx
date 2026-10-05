type PosEmptyStateProps = {
  title: string;
  description: string;
  stage?: string;
  future?: string;
};

export function PosEmptyState({
  title,
  description,
  stage,
  future,
}: PosEmptyStateProps) {
  const hasExtra = Boolean((stage || "").trim() || (future || "").trim());
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-7">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary-accent text-primary">
          <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
            <path d="M8 10h8M8 14h5" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
        {hasExtra ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-500">
            {(stage || "").trim() ? <div>{stage}</div> : null}
            {(future || "").trim() ? <div className={stage ? "mt-2 text-slate-400" : "text-slate-400"}>{future}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
