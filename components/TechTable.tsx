import { ReactNode } from "react";

interface Column {
  header: string;
  accessor: string;
  width?: string;
}

interface TechTableProps {
  columns: Column[];
  data: any[];
  renderCell?: (item: any, column: Column) => ReactNode; // Custom renderer
}

export default function TechTable({ columns, data, renderCell }: TechTableProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
      <table className="w-full text-left text-sm">
        
        {/* Table Header: Navy Background for Contrast */}
        <thead className="bg-brand-navy text-slate-200 uppercase tracking-wider text-[10px] font-bold">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={`px-4 py-3 ${col.width || 'w-auto'}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 italic">
                No records found.
              </td>
            </tr>
          ) : (
            data.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-brand-silver/50 transition-colors group">
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className="px-4 py-3 text-slate-700">
                    {/* If a custom renderer is provided, use it; otherwise just show the text */}
                    {renderCell ? renderCell(row, col) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}