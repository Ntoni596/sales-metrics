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

export function MissedBreakdownChart({ data }: { data: DailyMetrics }) {
  const missedData = Object.entries(data.missedBreakdown).map(([k, v]) => ({
    name: k,
    value: v,
  }));
  return (
    <div style={{ width: "100%", height: 260 }}>
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
  );
}

export function CallPerformanceChart({ data }: { data: DailyMetrics }) {
  const perfData = [
    { name: "Inbound", value: data.inboundEffective },
    { name: "Outbound", value: data.outbound },
    { name: "Answered", value: data.answered },
    { name: "Missed", value: data.missed },
  ];
  return (
    <div style={{ width: "100%", height: 260 }}>
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
  );
}

// Deprecated combined component (kept temporarily if any stale imports remain)
export function Charts({ data }: { data: DailyMetrics }) {
  return (
    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 320 }}>
        <MissedBreakdownChart data={data} />
      </div>
      <div style={{ flex: 1, minWidth: 320 }}>
        <CallPerformanceChart data={data} />
      </div>
    </div>
  );
}
