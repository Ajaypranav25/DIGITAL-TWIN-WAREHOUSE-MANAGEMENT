import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1000);
    return () => clearTimeout(t);
  }, [location.pathname]); // simplistic way, ideally listen to an event bus or polling tick

  const pageNames = {
    '/dashboard': 'Dashboard',
    '/inventory': 'Inventory',
    '/alerts': 'Alerts',
    '/orders': 'Orders',
    '/sensors': 'Sensors',
    '/snapshots': 'Snapshots'
  };

  const title = pageNames[location.pathname] || 'Twin WMS';

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 sticky top-0 z-30">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          Live Data
        </div>
      </div>
    </header>
  );
}