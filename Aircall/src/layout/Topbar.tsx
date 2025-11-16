import type { DailyMetrics } from "../types";

export function Topbar({ latest }: { latest: DailyMetrics | null }) {
  return (
    <div className="topbar">
      <h2>Performance Dashboard</h2>
      {latest && (
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <div className="badge accent">{latest.date}</div>
          <div className="badge">Inbound {latest.inboundEffective}</div>
          <div className="badge">Missed {latest.missed}</div>
          <div className="badge">Answered {latest.answered}</div>
        </div>
      )}
    </div>
  );
}
