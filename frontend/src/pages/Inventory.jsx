import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { usePolling } from '../hooks/usePolling';
import { getWarehouses } from '../api/warehouses';
import { getInventory, getUtilisation } from '../api/inventory';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Badge from '../components/UI/Badge';

export default function Inventory() {
  const { data: warehouses, loading: whLoading } = useApi(getWarehouses);
  const [selectedWh, setSelectedWh] = useState('');
  
  useEffect(() => {
    if (warehouses?.length && !selectedWh) {
      const firstWhId = warehouses[0].warehouseId || warehouses[0].warehouse_id;
      setSelectedWh(String(firstWhId));
    }
  }, [warehouses, selectedWh]);

  const { data: inventory, loading: invLoading, refetch: refetchInv } = useApi(() => getInventory(selectedWh), false);
  const { data: utilData, refetch: refetchUtil } = useApi(() => getUtilisation(selectedWh), false);

  useEffect(() => {
    if (selectedWh) {
      refetchInv();
      refetchUtil();
    }
  }, [selectedWh]); // eslint-disable-line react-hooks/exhaustive-deps

  usePolling(() => {
    if (selectedWh) {
      refetchInv();
      refetchUtil();
    }
  }, 10000);

  const [expandedZone, setExpandedZone] = useState(null);

  if (whLoading && !warehouses) return <LoadingSpinner />;

  // Group inventory by zones
  const zones = [];
  if (inventory && Array.isArray(inventory)) {
    const zoneMap = {};
    inventory.forEach(item => {
      const zid = item.zoneid || item.zone_id;
      const zname = item.zonename || item.zone_name || `Zone ${zid}`;
      const ztype = item.zonetype || item.zone_type || 'General';

      if (!zoneMap[zid]) {
        const util = utilData?.find(u => (u.zoneid || u.zone_id) === zid);
        const utilPct = util ? parseFloat(util.utilisationpct || util.utilisation_percent || 0) : 0;

        zoneMap[zid] = {
          zone_id: zid,
          zone_name: zname,
          zone_type: ztype,
          utilization: utilPct,
          bins: []
        };
        zones.push(zoneMap[zid]);
      }
      zoneMap[zid].bins.push(item);
    });
  }

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
          {warehouses?.map(wh => {
            const wid = wh.warehouseId || wh.warehouse_id;
            return (
              <option key={wid} value={wid}>{wh.name}</option>
            );
          })}
        </select>
      </div>

      {invLoading && !inventory ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map(zone => (
            <div 
              key={zone.zone_id} 
              className={`bg-slate-800 border ${expandedZone === zone.zone_id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700'} rounded-xl p-5 cursor-pointer transition-all hover:border-slate-500`}
              onClick={() => setExpandedZone(expandedZone === zone.zone_id ? null : zone.zone_id)}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg text-white">{zone.zone_name}</h3>
                <Badge variant="primary">{zone.zone_type}</Badge>
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
                {zone.bins.length} Unique Placements
              </div>
            </div>
          ))}
        </div>
      )}

      {expandedZone && (
        <div className="mt-8 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2">
            Bin Layout: {zones.find(z => z.zone_id === expandedZone)?.zone_name}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {zones.find(z => z.zone_id === expandedZone)?.bins.map((bin, bIdx) => {
              const bcode = bin.bincode || bin.bin_code || `BIN-${bIdx + 1}`;
              const stock = bin.currentunitsofproduct ?? bin.bincurrentstock ?? bin.current_stock ?? 0;
              const cap = bin.binmaxcapacity ?? bin.capacity ?? 100;
              const pname = bin.productname || bin.product_name;
              const isEmpty = !pname || stock === 0;
              const fillPct = cap > 0 ? (stock / cap) * 100 : 0;
              const bid = bin.binid || bin.bin_id || bIdx;

              return (
                <div key={`${bid}-${bIdx}`} className={`p-4 rounded-lg border ${isEmpty ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-800 border-slate-600 shadow-sm'} flex flex-col`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm text-white">{bcode}</span>
                    <span className={`w-2 h-2 rounded-full ${isEmpty ? 'bg-slate-600' : fillPct >= 90 ? 'bg-red-500' : fillPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  </div>
                  {!isEmpty ? (
                    <>
                      <div className="text-xs text-indigo-300 font-medium truncate mb-2" title={pname}>{pname}</div>
                      <div className="mt-auto text-xs text-slate-400">
                        {stock} / {cap} units
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1 mt-1">
                        <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${Math.min(100, fillPct)}%` }}></div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-auto text-xs text-slate-500 text-center italic">Empty</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}