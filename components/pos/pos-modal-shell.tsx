import type { ReactNode } from "react";

type PosModalShellProps = {
  title: string;
  fields?: string[];
  footerActions?: string[];
  children?: ReactNode;
  footer?: ReactNode;
  shellClassName?: string;
  titleBarClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  fieldClassName?: string;
  emptyClassName?: string;
};

export function PosModalShell({
  title,
  fields = [],
  footerActions = [],
  children,
  footer,
  shellClassName = "",
  titleBarClassName = "",
  bodyClassName = "",
  footerClassName = "",
  fieldClassName = "",
  emptyClassName = "",
}: PosModalShellProps) {
  return (
    <div className={`rounded-[20px] border border-slate-200 bg-white shadow-soft ${shellClassName}`.trim()}>
      <div className={`border-b border-slate-200 px-3.5 py-2.5 ${titleBarClassName}`.trim()}>
        <div className="text-[14px] font-semibold text-slate-900">{title}</div>
      </div>
      <div className={`space-y-2.5 px-3.5 py-3 ${bodyClassName}`.trim()}>
        {children ? children : fields.length > 0 ? (
          fields.map((field) => (
            <div key={field} className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 ${fieldClassName}`.trim()}>
              {field}
            </div>
          ))
        ) : (
          <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-400 ${emptyClassName}`.trim()}>
            {title}
          </div>
        )}
      </div>
      {footer ? (
        <div className={`border-t border-slate-200 px-3.5 py-2.5 ${footerClassName}`.trim()}>{footer}</div>
      ) : footerActions.length > 0 ? (
        <div className={`flex flex-wrap justify-end gap-2 border-t border-slate-200 px-3.5 py-2.5 ${footerClassName}`.trim()}>
          {footerActions.map((action) => (
            <button
              key={action}
              type="button"
              disabled
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400"
            >
              {action}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
