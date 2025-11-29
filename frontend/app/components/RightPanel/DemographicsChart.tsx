import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';

interface DemographicsChartProps {
  title: string;
  data: { [key: string]: number };
  loading: boolean;
}

// New color palette for charts - using our brand colors
const COLORS = [
  '#8E42EE', // purple
  '#3C5DE2', // blue
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#F78E12', // orange
  '#24CF35', // green
  '#F7E217', // yellow
  '#FF004D', // red
];

export default function DemographicsChart({ title, data, loading }: DemographicsChartProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
  }));

  if (loading) {
    return (
      <div className="bg-[#F5F0FB] border border-[#E8DDFF] rounded-2xl p-4">
        <h3 className="text-sm font-semibold mb-3 text-purple-700">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-[#F5F0FB] border border-[#E8DDFF] rounded-2xl p-4">
        <h3 className="text-sm font-semibold mb-3 text-purple-700">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48 text-sm text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F0FB] border border-[#E8DDFF] rounded-2xl p-4">
      <h3 className="text-sm font-semibold mb-3 text-purple-700">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: any) =>
              `${entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`
            }
            outerRadius={60}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>

      {/* Data Table */}
      <div className="mt-4 space-y-2">
        {chartData.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-gray-800">{item.name}</span>
            </div>
            <span className="font-semibold text-gray-800">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
