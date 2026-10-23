import { useApi } from '../hooks/useApi';
import { usePolling } from '../hooks/usePolling';
import { getDashboardSummary } from '../api/dashboard';
import { getUtilisation } from '../api/inventory';
import { getAlerts } from '../api/alerts';
import StatCard from '../components/UI/StatCard';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import ErrorState from '../components/UI/EmptyState';
import UtilisationBar from '../components/Charts/UtilisationBar';
import AlertsPieChart from '../components/Charts/AlertsPieChart';
import Table from '../components/UI/Table';
import Badge from '../components/UI/Badge';
import { Package, Bell, Activity, ShoppingCart, Percent, CheckCircle2 } from 'lucide-react';
import { safeDistanceToNow } from '../utils/date';

export default function Dashboard() {
  const { data: summary, loading: sumLoading, error: sumError, refetch: refetchSum } = useApi(getDashboardSummary);
  const { data: utilisation, loading: utilLoading, refetch: refetchUtil } = useApi(() => getUtilisation());
  const { data: alerts, loading: alertsLoading, refetch: refetchAlerts } = useApi(() => getAlerts('Open'));

  usePolling(() => {
    refetchSum();
    refetchUtil();
    refetchAlerts();
  }, 10000);

  if (sumLoading && !summary) return <LoadingSpinner />;
  if (sumError) return <ErrorState title="Connection Error" message={sumError} />;

  const getSeverityVariant = (sev) => {
    switch(sev) {
      case 'Critical': return 'danger';
      case 'High': return 'warning';
      case 'Medium': return 'primary';
      case 'Low': return 'info';
      default: return 'default';
    }
  };

  const alertCols = [
    { 
      header: 'Type', 
      field: 'alertType',
      altField: 'alert_type',
      render: (val, row) => val || row.alert_type || row.alertType || 'Alert'
    },
    { 
      header: 'Severity', 
      field: 'severity', 
      render: (val) => <Badge variant={getSeverityVariant(val)}>{val || 'Normal'}</Badge> 
    },
    { 
      header: 'Message', 
      field: 'message', 
      render: (val) => <span className="truncate max-w-xs block" title={val}>{val}</span> 
    },
    { 
      header: 'Raised', 
      field: 'raisedAt',
      altField: 'created_at',
      render: (val, row) => safeDistanceToNow(val || row.raisedAt || row.created_at) 
    }
  ];

  const chartUtilData = Array.isArray(utilisation) ? utilisation.map(u => ({
    name: u.zonename || u.zone_name || `Zone ${u.zoneid || u.zone_id || ''}`,
    utilisationPercent: parseFloat(u.utilisationpct || u.utilisation_percent || 0)
  })) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Stock Units" value={summary?.totalStock ?? 0} icon={Package} colorClass="text-indigo-400" />
        <StatCard title="Open Alerts" value={summary?.openAlerts ?? 0} icon={Bell} colorClass="text-red-400" />
        <StatCard title="Active Sensors" value={summary?.activeSensors ?? 0} icon={Activity} colorClass="text-emerald-400" />
        <StatCard title="Pending Orders" value={summary?.pendingOrders ?? 0} icon={ShoppingCart} colorClass="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatCard title="Global Bin Utilisation" value={`${(summary?.utilizationPct || 0).toFixed(1)}%`} icon={Percent} colorClass="text-blue-400">
          <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, summary?.utilizationPct || 0)}%` }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {summary?.totalStock ?? 0} of {summary?.totalCapacity ?? 0} units stored · {summary?.occupiedBins ?? 0} of {summary?.bins ?? 0} bins occupied
          </p>
        </StatCard>
        <StatCard title="Orders Dispatched Today" value={summary?.todayFulfilled ?? 0} icon={CheckCircle2} colorClass="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm">
          <h3 className="text-lg font-medium text-white mb-4">Zone Utilisation</h3>
          {utilLoading && !utilisation ? (
            <LoadingSpinner />
          ) : (
            <UtilisationBar data={chartUtilData} />
          )}
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm">
          <h3 className="text-lg font-medium text-white mb-4">Alerts by Severity</h3>
          {alertsLoading && !alerts ? (
            <LoadingSpinner />
          ) : (
            <AlertsPieChart data={alerts || []} />
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm">
        <h3 className="text-lg font-medium text-white mb-4">Recent Unresolved Alerts</h3>
        <Table columns={alertCols} data={(alerts || []).slice(0, 5)} keyField="alertId" />
      </div>
    </div>
  );
}