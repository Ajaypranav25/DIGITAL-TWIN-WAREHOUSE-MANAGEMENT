import client from './client';

export const getSnapshots = (warehouseId) => client.get(`/snapshots?warehouse_id=${warehouseId || ''}`);
export const takeSnapshot = (warehouseId) => client.post(`/snapshots/${warehouseId}`);