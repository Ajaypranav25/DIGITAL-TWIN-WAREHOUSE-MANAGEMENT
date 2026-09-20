import client from './client';

export const getAlerts = (status = 'Open', severity = '') => client.get(`/alerts?status=${status}&severity=${severity}`);
export const getAlertsReport = () => client.get('/alerts/report');
export const updateAlert = (id, data) => client.patch(`/alerts/${id}`, data);