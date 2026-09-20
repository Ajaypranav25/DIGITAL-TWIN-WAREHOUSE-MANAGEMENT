import client from './client';

export const getWarehouses = () => client.get('/warehouses');
export const getZones = (warehouseId) => client.get(`/zones${warehouseId ? `?warehouse_id=${warehouseId}` : ''}`);