import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Bell, ShoppingCart, Activity, Camera } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getDashboardSummary } from '../../api/dashboard';
import { usePolling } from '../../hooks/usePolling';

export default function Sidebar() {
  const { data: summary, refetch } = useApi(getDashboardSummary, true);
  usePolling(refetch, 10000);

  const openAlerts = summary?.openAlerts || 0;

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/alerts', icon: Bell, label: 'Alerts', badge: openAlerts > 0 ? openAlerts : null },
    { to: '/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/sensors', icon: Activity, label: 'Sensors' },
    { to: '/snapshots', icon: Camera, label: 'Snapshots' },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-indigo-500 font-bold text-xl">
          <Activity className="h-6 w-6" />
          <span>Twin WMS</span>
        </div>
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 
              `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} />
              {item.label}
            </div>
            {item.badge !== null && item.badge !== undefined && (
              <span className="bg-red-500/20 text-red-400 text-xs py-0.5 px-2 rounded-full font-bold">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}