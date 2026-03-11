import type { ReactNode } from "react";

type TableCardProps = {
  title: string;
  description?: string;
  titleRight?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function TableCard({
  title,
  description,
  titleRight,
  right,
  children,
  className = "",
}: TableCardProps) {
  const hasHeader = Boolean(title || description || right);

  return (
    <section
      className={`mt-5 overflow-hidden rounded-xl bg-white shadow-soft ${className}`.trim()}
    >
      {hasHeader ? (
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:gap-4">
                <h2 className="shrink-0 text-left text-[18px] font-semibold tracking-tight text-slate-900">
                  {title}
                </h2>
                {titleRight ? <div className="shrink-0">{titleRight}</div> : null}
                {description ? (
                  <p className="min-w-0 text-sm leading-6 text-slate-500 lg:pb-[1px]">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>

            {right ? (
              <div className="shrink-0 text-sm text-slate-400">{right}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {children}
    </section>
  );
}
