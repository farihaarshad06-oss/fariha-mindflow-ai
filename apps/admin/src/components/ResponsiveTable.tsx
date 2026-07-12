import type { ReactNode } from 'react';
import { Card } from '@mindflow/ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export function ResponsiveTable<T extends { id: string }>({
  columns,
  rows,
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No data available.</p>;
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-start text-xs uppercase text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-start font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-slate-700">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id}>
            <div className="flex flex-col gap-1">
              {columns.map((column) => (
                <div key={column.key} className="flex justify-between gap-2 text-sm">
                  <span className="text-slate-400">{column.header}</span>
                  <span className="text-slate-700">{column.render(row)}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
