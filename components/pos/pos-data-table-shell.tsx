type PosDataTableShellProps = {
  title: string;
  columns: string[];
  rows?: number;
};

export function PosDataTableShell({
  title,
  columns,
  rows = 5,
}: PosDataTableShellProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="text-[12px] font-semibold text-slate-900">{title}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-100">
                {columns.map((column, cellIndex) => (
                  <td key={`${column}-${cellIndex}`} className="px-2.5 py-2">
                    <div className={`h-3.5 rounded bg-slate-100 ${cellIndex === 0 ? "w-24" : cellIndex % 2 === 0 ? "w-20" : "w-16"}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
