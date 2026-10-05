import type { ReactNode } from "react";

type PosSectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PosSectionCard({
  title,
  description,
  actions,
  children,
  className = "",
}: PosSectionCardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-2.5 shadow-soft ${className}`.trim()}>
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {title ? <h3 className="text-[12px] font-semibold text-slate-900">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className={hasHeader ? "mt-2" : "flex min-h-0 flex-1 flex-col"}>{children}</div> : null}
    </section>
  );
}
