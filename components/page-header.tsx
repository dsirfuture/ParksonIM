import type { ReactNode } from "react";

type PageHeaderProps = {
  badge?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  badge,
  title,
  description,
  meta,
  actions,
}: PageHeaderProps) {
  return (
    <section className="rounded-xl bg-white px-6 py-5 shadow-soft">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          {badge ? (
            <div className="inline-flex items-center rounded-full bg-secondary-accent px-3 py-1 text-[11px] font-medium text-primary">
              {badge}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-4">
            <h1 className="shrink-0 text-[28px] font-bold tracking-tight text-slate-900">
              {title}
            </h1>

            {description ? (
              <p className="min-w-0 text-sm leading-6 text-slate-500 lg:pb-1">
                {description}
              </p>
            ) : null}
          </div>

          {meta ? (
            <div className="mt-4 text-sm leading-6 text-slate-400">{meta}</div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
