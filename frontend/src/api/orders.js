import client from './client';

export const getOrders = () => client.get('/orders');
export const getOrder = (id) => client.get(`/orders/${id}`);
export const createOrder = (data) => client.post('/orders', data);
export const fulfillOrder = (id) => client.post(`/orders/${id}/fulfil`);