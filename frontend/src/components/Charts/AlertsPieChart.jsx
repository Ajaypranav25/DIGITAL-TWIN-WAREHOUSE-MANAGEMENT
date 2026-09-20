import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function AlertsPieChart({ data = [] }) {
  const severities = [
    { name: 'Critical', color: '#ef4444' }, // red-500
    { name: 'High', color: '#f97316' },     // orange-500
    { name: 'Medium', color: '#eab308' },   // yellow-500
    { name: 'Low', color: '#3b82f6' },      // blue-500
  ];

  // Aggregating data by severity
  const aggregated = data.reduce((acc, alert) => {
    const sev = alert.severity;
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {});

  const chartData = severities.map(s => ({
    name: s.name,
    value: aggregated[s.name] || 0,
    color: s.color
  })).filter(d => d.value > 0);

  if (!chartData.length) return <div className="text-sm text-slate-500 py-10 text-center">No active alerts</div>;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '0.5rem' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}