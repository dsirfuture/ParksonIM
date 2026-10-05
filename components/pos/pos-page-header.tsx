import type { ReactNode } from "react";

type PosPageHeaderProps = {
  badge?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PosPageHeader(props: PosPageHeaderProps) {
  const { badge, title, description, actions, meta } = props;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-soft">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          {badge ? (
            <div className="inline-flex items-center rounded-full bg-secondary-accent px-2.5 py-0.5 text-[10px] font-medium text-primary">
              {badge}
            </div>
          ) : null}

          <div className="mt-1.5 flex flex-col gap-1 lg:flex-row lg:items-end lg:gap-2.5">
            <h1 className="shrink-0 text-[18px] font-bold tracking-tight text-slate-900">
              {title}
            </h1>

            {description ? (
              <p className="min-w-0 text-[11px] leading-4 text-slate-500 lg:pb-0.5">
                {description}
              </p>
            ) : null}
          </div>

          {meta ? (
            <div className="mt-1.5 text-[11px] leading-4 text-slate-400">{meta}</div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
