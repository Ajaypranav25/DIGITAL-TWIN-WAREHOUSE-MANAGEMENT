import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { safeFormat } from '../../utils/date';

export default function SensorLineChart({ data = [], thresholdMin, thresholdMax }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-slate-500 py-10 text-center">No reading history available</div>;
  }

  const formattedData = data.map(d => {
    const rawTime = d.recordedAt || d.recorded_at || d.reading_time || d.time;
    const rawVal = d.readingValue ?? d.reading_value ?? d.value;
    return {
      ...d,
      value: parseFloat(rawVal || 0),
      timeLabel: safeFormat(rawTime, 'HH:mm:ss', '--:--:--')
    };
  }).reverse(); // oldest first

  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '0.5rem' }}
            labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
          />
          {thresholdMax !== undefined && thresholdMax !== null && (
            <ReferenceLine y={Number(thresholdMax)} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Max', fill: '#ef4444', fontSize: 10 }} />
          )}
          {thresholdMin !== undefined && thresholdMin !== null && (
            <ReferenceLine y={Number(thresholdMin)} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Min', fill: '#3b82f6', fontSize: 10 }} />
          )}
          <Line type="monotone" dataKey="value" name="Reading" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}