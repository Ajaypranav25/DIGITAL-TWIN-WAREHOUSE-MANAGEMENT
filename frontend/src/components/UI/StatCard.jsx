export default function StatCard({ title, value, icon: Icon, trend, colorClass = 'text-indigo-400', children }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg bg-slate-900/50 ${colorClass}`}>
            <Icon size={24} />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-auto">
          <span className={`text-sm ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-sm text-slate-500 ml-2">{trend.label}</span>
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}