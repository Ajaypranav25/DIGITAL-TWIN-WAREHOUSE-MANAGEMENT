import client from './client';

export const getZones = (warehouseId) => client.get(`/zones?warehouse_id=${warehouseId || ''}`);
export const getBins = (zoneId) => client.get(`/bins?zone_id=${zoneId || ''}`);
export const getInventory = (warehouseId, zoneId) => client.get(`/inventory?warehouse_id=${warehouseId || ''}&zone_id=${zoneId || ''}`);
export const getUtilisation = (warehouseId) => client.get(`/inventory/utilisation?warehouse_id=${warehouseId || ''}`);