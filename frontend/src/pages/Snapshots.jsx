import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { getWarehouses } from '../api/warehouses';
import { getSnapshots, takeSnapshot } from '../api/snapshots';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Table from '../components/UI/Table';
import { Camera } from 'lucide-react';
import { safeFormat } from '../utils/date';
import toast from 'react-hot-toast';

export default function Snapshots() {
  const { data: warehouses } = useApi(getWarehouses);
  const [selectedWh, setSelectedWh] = useState('');
  
  useEffect(() => {
    if (warehouses?.length && !selectedWh) {
      const wid = warehouses[0].warehouseId || warehouses[0].warehouse_id;
      setSelectedWh(String(wid));
    }
  }, [warehouses, selectedWh]);

  const { data: snapshots, loading, refetch } = useApi(() => getSnapshots(selectedWh), false);

  useEffect(() => {
    if (selectedWh) refetch();
  }, [selectedWh]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isTaking, setIsTaking] = useState(false);

  const handleTakeSnapshot = async () => {
    if (!selectedWh) return;
    setIsTaking(true);
    try {
      await takeSnapshot(selectedWh);
      toast.success('Digital Twin Snapshot captured successfully');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to capture snapshot');
    } finally {
      setIsTaking(false);
    }
  };

  const columns = [
    { 
      header: 'Snapshot Time', 
      field: 'snapshotTime', 
      altField: 'snapshot_time',
      render: (val, row) => safeFormat(val || row.snapshot_time || row.snapshotTime, 'MMM d, yyyy HH:mm:ss')
    },
    { 
      header: 'Total Stock Units', 
      field: 'totalStockUnits', 
      altField: 'total_stock',
      render: (val, row) => <span className="font-semibold text-white">{val ?? row.total_stock ?? 0}</span>
    },
    { 
      header: 'Occupied Bins', 
      field: 'occupiedBins', 
      altField: 'occupied_bins',
      render: (val, row) => {
        const occ = val ?? row.occupied_bins ?? 0;
        const tot = row.totalBins ?? row.total_bins ?? 0;
        return `${occ} / ${tot}`;
      }
    },
    { 
      header: 'Occupancy %', 
      field: 'occupancy_percent', 
      render: (val, row) => {
        const occ = row.occupiedBins ?? row.occupied_bins ?? 0;
        const tot = row.totalBins ?? row.total_bins ?? 1;
        const pct = tot > 0 ? (occ / tot) * 100 : 0;
        return (
          <div className="flex items-center gap-2">
            <span>{pct.toFixed(1)}%</span>
            <div className="w-16 bg-slate-700 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
            </div>
          </div>
        );
      }
    },
    { 
      header: 'Active Alerts', 
      field: 'activeAlerts', 
      altField: 'active_alerts_count',
      render: (val, row) => {
        const count = val ?? row.active_alerts_count ?? 0;
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${count > 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
            {count}
          </span>
        );
      }
    },
    {
      header: 'Triggered By',
      field: 'createdBy',
      altField: 'created_by',
      render: (val, row) => <span className="text-xs text-slate-400 font-mono">{val || row.created_by || 'System'}</span>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-white">System Digital Twin Snapshots</h2>
        <div className="flex gap-4 items-center">
          <select 
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            value={selectedWh} onChange={(e) => setSelectedWh(e.target.value)}
          >
            {warehouses?.map(wh => {
              const wid = wh.warehouseId || wh.warehouse_id;
              return (
                <option key={wid} value={wid}>{wh.name}</option>
              );
            })}
          </select>
          <button 
            onClick={handleTakeSnapshot} 
            disabled={isTaking || !selectedWh}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm"
          >
            <Camera size={16} /> {isTaking ? 'Capturing...' : 'Take Snapshot Now'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading && !snapshots ? <LoadingSpinner /> : (
          <Table columns={columns} data={snapshots || []} keyField="snapshotId" />
        )}
      </div>
    </div>
  );
}