import client from './client';

export const getSensors = (zoneId) => client.get(`/sensors?zone_id=${zoneId || ''}`);
export const getSensorReadings = (sensorId) => client.get(`/sensors/${sensorId}/readings?limit=50`);
export const addSensorReading = (sensorId, data) => client.post(`/sensors/${sensorId}/readings`, data);
export const updateSensorStatus = (sensorId, status) => client.patch(`/sensors/${sensorId}`, { status });
