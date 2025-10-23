import type { ReactNode } from "react";

type AdminDataTableColumn<T> = {
  key: string;
  header: ReactNode;
  className?: string;
  cell: (row: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  columns: AdminDataTableColumn<T>[];
  rows: T[];
  emptyState: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  getRowKey?: (row: T, index: number) => string;
};

export function AdminDataTable<T>({
  columns,
  rows,
  emptyState,
  className,
  headerClassName = "text-xs uppercase tracking-wide text-slate-300/80",
  bodyClassName = "divide-y divide-white/10",
  getRowKey,
}: AdminDataTableProps<T>) {
  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <table className={`w-full min-w-[640px] border-collapse text-left text-sm ${className ?? ""}`}>
      <thead>
        <tr className={headerClassName}>
          {columns.map((column) => (
            <th key={column.key} className={column.className ?? "pb-3"}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className={bodyClassName}>
        {rows.map((row, index) => {
          const key = getRowKey ? getRowKey(row, index) : `${columns[0]?.key ?? "row"}-${index}`;
          return (
            <tr key={key}>
              {columns.map((column) => (
                <td key={column.key} className={column.className ?? "py-3"}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export type { AdminDataTableColumn, AdminDataTableProps };
