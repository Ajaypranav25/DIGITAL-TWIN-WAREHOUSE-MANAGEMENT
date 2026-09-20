export default function Table({ columns, data, keyField = 'id', renderRowActions }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        No records available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 font-medium">{col.header}</th>
            ))}
            {renderRowActions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {data.map((row, rowIdx) => {
            const rowKey = row[keyField] ?? row.id ?? rowIdx;
            return (
              <tr key={rowKey} className="hover:bg-slate-800/50 transition-colors">
                {columns.map((col, colIdx) => {
                  const val = row[col.field] ?? (col.altField ? row[col.altField] : undefined);
                  return (
                    <td key={colIdx} className="px-4 py-3 text-slate-300">
                      {col.render ? col.render(val, row) : (val !== null && val !== undefined ? String(val) : '-')}
                    </td>
                  );
                })}
                {renderRowActions && (
                  <td className="px-4 py-3 text-right">
                    {renderRowActions(row)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}