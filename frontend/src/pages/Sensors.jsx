import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { usePolling } from '../hooks/usePolling';
import { getSensors, getSensorReadings, addSensorReading } from '../api/sensors';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Badge from '../components/UI/Badge';
import SensorLineChart from '../components/Charts/SensorLineChart';
import { Activity, Thermometer, Weight, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Sensors() {
  const { data: sensors, loading, refetch } = useApi(() => getSensors());
  const [selectedSensor, setSelectedSensor] = useState(null);
  
  const sid = selectedSensor ? (selectedSensor.sensorId || selectedSensor.sensor_id) : null;
  const { data: readings, refetch: refetchReadings } = useApi(
    () => (sid ? getSensorReadings(sid) : Promise.resolve({ data: [] })), 
    false
  );

  usePolling(() => {
    refetch();
    if (sid) refetchReadings();
  }, 10000);

  useEffect(() => {
    if (sid) {
      refetchReadings();
    }
  }, [sid]);

  const [readingForm, setReadingForm] = useState({ value: '', unit: '' });

  const submitReading = async (e, sensorId) => {
    e.preventDefault();
    try {
      await addSensorReading(sensorId, { 
        readingValue: parseFloat(readingForm.value), 
        unit: readingForm.unit || 'unit'
      });
      toast.success('Reading injected into digital twin');
      setReadingForm({ value: '', unit: '' });
      refetch();
      if (sid === sensorId) refetchReadings();
    } catch(err) {
      toast.error(err.message || 'Failed to inject reading');
    }
  };

  const getIcon = (type) => {
    switch((type || '').toLowerCase()) {
      case 'temperature': return Thermometer;
      case 'weight': return Weight;
      case 'rfid': return Wifi;
      default: return Activity;
    }
  };

  if (loading && !sensors) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Sensor Network & Telemetry</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sensors?.map(sensor => {
          const sensorId = sensor.sensorId || sensor.sensor_id;
          const sensorType = sensor.sensorType || sensor.sensor_type || 'Sensor';
          const Icon = getIcon(sensorType);
          const isSelected = sid === sensorId;
          const thMin = sensor.thresholdMin ?? sensor.threshold_min;
          const thMax = sensor.thresholdMax ?? sensor.threshold_max;
          const latestVal = sensor.latestReading ?? sensor.latest_reading;
          const unit = sensor.unit || (sensorType === 'Temperature' ? 'degC' : sensorType === 'Weight' ? 'kg' : '');
          
          return (
            <div key={sensorId} className={`bg-slate-800 rounded-xl p-5 border ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700'} shadow-sm flex flex-col`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 items-center">
                  <div className="p-2 bg-slate-900 rounded-lg text-indigo-400"><Icon size={20} /></div>
                  <div>
                    <h3 className="font-semibold text-white">{sensorType}</h3>
                    <p className="text-xs text-slate-400">{sensor.model || `ID: ${sensorId}`}</p>
                  </div>
                </div>
                <Badge variant={sensor.status === 'Active' ? 'success' : 'danger'}>{sensor.status}</Badge>
              </div>
              
              <div className="my-4">
                <p className="text-sm text-slate-400 mb-1">Latest Reading</p>
                <div className="text-2xl font-bold text-white">
                  {latestVal !== null && latestVal !== undefined ? `${Number(latestVal).toFixed(1)} ${unit}` : '--'}
                </div>
                {(thMin !== null && thMin !== undefined || thMax !== null && thMax !== undefined) && (
                  <p className="text-xs text-slate-500 mt-1">
                    Safe Range: {thMin ?? '-∞'} to {thMax ?? '∞'} {unit}
                  </p>
                )}
              </div>

              <div className="mt-auto space-y-3">
                <button 
                  onClick={() => {
                    setSelectedSensor(isSelected ? null : sensor);
                    if (!isSelected) {
                      setReadingForm({ value: '', unit: unit });
                    }
                  }}
                  className="w-full py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                >
                  {isSelected ? 'Hide History' : 'View History & Inject'}
                </button>
                
                {isSelected && (
                  <form onSubmit={(e) => submitReading(e, sensorId)} className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                    <input required type="number" step="0.1" placeholder="Val" value={readingForm.value} onChange={e => setReadingForm({...readingForm, value: e.target.value})} className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500" />
                    <input required type="text" placeholder="Unit" value={readingForm.unit} onChange={e => setReadingForm({...readingForm, unit: e.target.value})} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500" />
                    <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded py-1 transition-colors font-medium">Inject</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedSensor && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm mt-6">
          <h3 className="text-lg font-medium text-white mb-4">
            Reading Telemetry: {selectedSensor.sensorType || selectedSensor.sensor_type} ({selectedSensor.model || `ID ${sid}`})
          </h3>
          <SensorLineChart 
            data={readings || []} 
            thresholdMin={selectedSensor.thresholdMin ?? selectedSensor.threshold_min} 
            thresholdMax={selectedSensor.thresholdMax ?? selectedSensor.threshold_max} 
          />
        </div>
      )}
    </div>
  );
}