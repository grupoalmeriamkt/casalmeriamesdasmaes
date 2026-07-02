import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  hideOnMobile?: boolean;
  cell: (row: T) => React.ReactNode;
  mobileLabel?: string;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
};

export function AdminResponsiveTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  emptyMessage = "Nenhum item encontrado.",
  loading = false,
}: Props<T>) {
  if (loading) {
    return <div className="admin-empty-state">Carregando…</div>;
  }

  if (rows.length === 0) {
    return <div className="admin-empty-state">{emptyMessage}</div>;
  }

  return (
    <>
      <div className="admin-table-desktop hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/6 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {columns.map((col) => (
                <th key={col.key} className={cn("px-4 py-3", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-black/4 transition-colors last:border-0",
                  onRowClick && "cursor-pointer hover:bg-black/[0.02]",
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-table-mobile space-y-3 md:hidden">
        {rows.map((row) => (
          <button
            key={rowKey(row)}
            type="button"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "admin-card w-full p-4 text-left transition-transform active:scale-[0.99]",
              !onRowClick && "cursor-default",
            )}
          >
            <div className="space-y-2.5">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {col.mobileLabel ?? col.header}
                    </span>
                    <span className={cn("min-w-0 text-right text-sm text-charcoal", col.className)}>
                      {col.cell(row)}
                    </span>
                  </div>
                ))}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
