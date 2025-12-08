import type { DailyMetrics } from "../types";
import { useAuth } from "../auth";
import { Link } from "react-router-dom";

export function Topbar({ latest }: { latest: DailyMetrics | null }) {
  const { user, isAdmin, signOut } = useAuth();
  return (
    <div className="topbar">
      <h2>Performance Dashboard</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {latest && (
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <div className="badge accent">{latest.date}</div>
            <div className="badge">Inbound {latest.inboundEffective}</div>
            <div className="badge">Missed {latest.missed}</div>
            <div className="badge">Answered {latest.answered}</div>
          </div>
        )}
        {user && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {user.email}
            </span>
            {isAdmin && (
              <Link
                to="/admin/users"
                className="badge"
                style={{ marginRight: 8 }}
              >
                Admin
              </Link>
            )}
            <button onClick={() => signOut()}>Sign out</button>
          </div>
        )}
      </div>
    </div>
  );
}
