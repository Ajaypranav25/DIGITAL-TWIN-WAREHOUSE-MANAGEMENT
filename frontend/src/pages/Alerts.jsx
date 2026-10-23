import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { usePolling } from '../hooks/usePolling';
import { getAlerts, updateAlert } from '../api/alerts';
import Table from '../components/UI/Table';
import Badge from '../components/UI/Badge';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { safeDistanceToNow } from '../utils/date';
import toast from 'react-hot-toast';

export default function Alerts() {
  const [statusFilter, setStatusFilter] = useState('Open');
  const [severityFilter, setSeverityFilter] = useState('');
  
  const { data: alerts, loading, refetch } = useApi(() => getAlerts(statusFilter === 'All' ? '' : statusFilter, severityFilter));

  // useApi only runs on mount, so reload as soon as a filter changes
  useEffect(() => {
    refetch().catch(() => {});
  }, [statusFilter, severityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  usePolling(refetch, 10000);

  const handleAction = async (id, status) => {
    try {
      await updateAlert(id, { status });
      toast.success(`Alert ${status.toLowerCase()} successfully`);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update alert');
    }
  };

  const getSeverityVariant = (sev) => {
    switch(sev) {
      case 'Critical': return 'danger';
      case 'High': return 'warning';
      case 'Medium': return 'primary';
      case 'Low': return 'info';
      default: return 'default';
    }
  };
  
  const getStatusVariant = (st) => {
    switch(st) {
      case 'Open': return 'danger';
      case 'Acknowledged': return 'warning';
      case 'Resolved': return 'success';
      default: return 'default';
    }
  };

  const columns = [
    { 
      header: 'ID', 
      field: 'alertId',
      altField: 'alert_id',
      render: (val, row) => <span className="font-mono text-xs text-indigo-300">#{val || row.alert_id || row.alertId}</span> 
    },
    { 
      header: 'Zone', 
      field: 'zoneName',
      altField: 'zone_name',
      render: (val, row) => val || row.zone_name || (row.zoneId ? `Zone ${row.zoneId}` : 'Warehouse-wide')
    },
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
      render: (val) => <span className="truncate max-w-[14rem] block" title={val}>{val}</span> 
    },
    { 
      header: 'Raised', 
      field: 'raisedAt',
      altField: 'created_at',
      render: (val, row) => safeDistanceToNow(val || row.raisedAt || row.created_at) 
    },
    { 
      header: 'Status', 
      field: 'status', 
      render: (val) => <Badge variant={getStatusVariant(val)}>{val}</Badge> 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-white">System Alerts</h2>
        <div className="flex gap-4">
          <select 
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select 
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm"
            value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading && !alerts ? <LoadingSpinner /> : (
          <Table 
            columns={columns} 
            data={alerts || []} 
            keyField="alertId"
            renderRowActions={(row) => {
              const aid = row.alertId ?? row.alert_id;
              return (
                <div className="flex justify-end gap-2">
                  {row.status === 'Open' && (
                    <button 
                      onClick={() => handleAction(aid, 'Acknowledged')} 
                      className="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded border border-amber-500/30 transition-colors"
                    >
                      Ack
                    </button>
                  )}
                  {row.status !== 'Resolved' && (
                    <button 
                      onClick={() => handleAction(aid, 'Resolved')} 
                      className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded border border-emerald-500/30 transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}