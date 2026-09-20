export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-slate-700 text-slate-300',
    primary: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}