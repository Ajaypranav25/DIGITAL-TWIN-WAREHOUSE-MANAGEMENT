import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { usePolling } from '../hooks/usePolling';
import { getWarehouses } from '../api/warehouses';
import { getInventory, getUtilisation } from '../api/inventory';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Badge from '../components/UI/Badge';
import AdjustStockModal from '../components/Inventory/AdjustStockModal';

// vw_live_digital_twin_state returns one row per (bin, product). Fold those rows
// into zones -> bins -> items so a bin holding two products is shown once.
function groupInventory(rows, utilData) {
  const zones = [];
  const zoneMap = {};
  rows.forEach((row) => {
    const zid = row.zoneid;
    if (!zoneMap[zid]) {
      const util = utilData?.find((u) => u.zoneid === zid);
      zoneMap[zid] = {
        zoneId: zid,
        zoneName: row.zonename,
        zoneType: row.zonetype,
        utilization: util ? parseFloat(util.utilisationpct || 0) : 0,
        binMap: {},
        bins: [],
      };
      zones.push(zoneMap[zid]);
    }
    const zone = zoneMap[zid];
    if (!zone.binMap[row.binid]) {
      zone.binMap[row.binid] = {
        binId: row.binid,
        binCode: row.bincode,
        rackCode: row.rackcode,
        stock: row.bincurrentstock,
        capacity: row.binmaxcapacity,
        items: [],
      };
      zone.bins.push(zone.binMap[row.binid]);
    }
    if (row.inventoryitemid) {
      zone.binMap[row.binid].items.push({
        inventoryItemId: row.inventoryitemid,
        productName: row.productname,
        sku: row.sku,
        quantity: row.currentunitsofproduct,
      });
    }
  });
  return zones;
}

function BinTile({ bin, onClick }) {
  const fillPct = bin.capacity > 0 ? (bin.stock / bin.capacity) * 100 : 0;
  const isEmpty = bin.stock === 0;
  const dot = isEmpty ? 'bg-slate-600' : fillPct >= 100 ? 'bg-red-500' : fillPct >= 90 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={bin.items.length === 0}
      className={`p-4 rounded-lg border text-left flex flex-col transition-colors ${isEmpty ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-800 border-slate-600 shadow-sm hover:border-indigo-500'}`}
    >
      <div className="flex justify-between items-start mb-2 w-full">
        <span className="font-mono text-sm text-white">{bin.binCode}</span>
        <span className={`w-2 h-2 rounded-full ${dot}`}></span>
      </div>
      {bin.items.length > 0 ? (
        <>
          {bin.items.map((item) => (
            <div key={item.inventoryItemId} className="flex justify-between gap-2 text-xs" title={item.productName}>
              <span className="text-indigo-300 font-medium truncate">{item.productName}</span>
              <span className="text-slate-400 shrink-0">×{item.quantity}</span>
            </div>
          ))}
          <div className="mt-auto pt-2 text-xs text-slate-400">{bin.stock} / {bin.capacity} units</div>
          <div className="w-full bg-slate-700 rounded-full h-1 mt-1">
            <div className={`h-1 rounded-full ${fillPct >= 100 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, fillPct)}%` }}></div>
          </div>
        </>
      ) : (
        <div className="mt-auto text-xs text-slate-500 text-center italic w-full">Empty · 0 / {bin.capacity}</div>
      )}
    </button>
  );
}

export default function Inventory() {
  const { data: warehouses, loading: whLoading } = useApi(getWarehouses);
  const [selectedWh, setSelectedWh] = useState('');
  const [expandedZone, setExpandedZone] = useState(null);
  const [editingBin, setEditingBin] = useState(null);

  useEffect(() => {
    if (warehouses?.length && !selectedWh) {
      setSelectedWh(String(warehouses[0].warehouseId));
    }
  }, [warehouses, selectedWh]);

  const { data: inventory, loading: invLoading, refetch: refetchInv } = useApi(() => getInventory(selectedWh), false);
  const { data: utilData, refetch: refetchUtil } = useApi(() => getUtilisation(selectedWh), false);

  const refreshAll = () => {
    if (!selectedWh) return;
    refetchInv().catch(() => {});
    refetchUtil().catch(() => {});
  };

  useEffect(refreshAll, [selectedWh]); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(refreshAll, 10000);

  if (whLoading && !warehouses) return <LoadingSpinner />;

  const zones = Array.isArray(inventory) ? groupInventory(inventory, utilData) : [];
  const activeZone = zones.find((z) => z.zoneId === expandedZone);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Digital Twin Inventory View</h2>
        <select
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
          value={selectedWh}
          onChange={(e) => {
            setSelectedWh(e.target.value);
            setExpandedZone(null);
          }}
        >
          {warehouses?.map((wh) => (
            <option key={wh.warehouseId} value={wh.warehouseId}>{wh.name}</option>
          ))}
        </select>
      </div>

      {invLoading && !inventory ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map((zone) => (
            <div
              key={zone.zoneId}
              className={`bg-slate-800 border ${expandedZone === zone.zoneId ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700'} rounded-xl p-5 cursor-pointer transition-all hover:border-slate-500`}
              onClick={() => setExpandedZone(expandedZone === zone.zoneId ? null : zone.zoneId)}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg text-white">{zone.zoneName}</h3>
                <Badge variant="primary">{zone.zoneType}</Badge>
              </div>
              <div className="mb-2 flex justify-between text-sm text-slate-400">
                <span>Utilisation</span>
                <span>{zone.utilization.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4">
                <div
                  className={`h-1.5 rounded-full ${zone.utilization >= 90 ? 'bg-red-500' : zone.utilization >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, zone.utilization)}%` }}
                ></div>
              </div>
              <div className="text-sm text-slate-400 text-right">
                {zone.bins.length} bins · {zone.bins.filter((b) => b.stock > 0).length} occupied
              </div>
            </div>
          ))}
        </div>
      )}

      {activeZone && (
        <div className="mt-8 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <div className="flex justify-between items-baseline mb-6 border-b border-slate-700 pb-2">
            <h3 className="text-lg font-bold text-white">Bin Layout: {activeZone.zoneName}</h3>
            <span className="text-xs text-slate-500">Click a bin to adjust its stock</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {activeZone.bins.map((bin) => (
              <BinTile key={bin.binId} bin={bin} onClick={() => setEditingBin(bin)} />
            ))}
          </div>
        </div>
      )}

      <AdjustStockModal bin={editingBin} onClose={() => setEditingBin(null)} onSaved={refreshAll} />
    </div>
  );
}
