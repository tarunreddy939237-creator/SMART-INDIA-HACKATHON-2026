import React from 'react';

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--ev-border)] bg-white shadow-[var(--ev-shadow-xs)]">
      <table className="w-full text-left text-[13px] text-[var(--ev-text-secondary)]">
        <thead className="bg-[var(--ev-surface-subtle)] text-[11px] font-semibold uppercase tracking-wider text-[var(--ev-text-tertiary)] border-b border-[var(--ev-border-subtle)]">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} scope="col" className={`px-4 py-3 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ev-border-subtle)]">
          {data.length > 0 ? (
            data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-[var(--ev-surface-hover)] transition-colors duration-100">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`px-4 py-3 text-[var(--ev-text-secondary)] ${col.className || ''}`}>
                    {col.cell ? col.cell(row) : col.accessorKey ? String(row[col.accessorKey] ?? '') : null}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--ev-text-muted)] text-[12px]">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
