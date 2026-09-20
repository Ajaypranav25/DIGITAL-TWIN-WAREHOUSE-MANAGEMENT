import client from './client';

export const getProducts = () => client.get('/products');
export const getLowStockProducts = () => client.get('/products/low-stock');