import type { DailyMetrics } from "../types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";

const COLORS = ["#4b8eda", "#f39c12", "#e74c3c", "#2ecc71", "#9b59b6"];

export function Charts({ data }: { data: DailyMetrics }) {
  const missedData = Object.entries(data.missedBreakdown).map(([k, v]) => ({
    name: k,
    value: v,
  }));
  const perfData = [
    { name: "Inbound Eff", value: data.inboundEffective },
    { name: "Outbound", value: data.outbound },
    { name: "Answered", value: data.answered },
    { name: "Missed", value: data.missed },
  ];
  return (
    <div style={{ display: "flex", gap: 32 }}>
      <div style={{ width: 320, height: 260 }}>
        <h4 style={{ textAlign: "center" }}>Missed Breakdown</h4>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie dataKey="value" data={missedData} outerRadius={80} label>
              {missedData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ width: 480, height: 260 }}>
        <h4 style={{ textAlign: "center" }}>Call Performance</h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={perfData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#4b8eda" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
