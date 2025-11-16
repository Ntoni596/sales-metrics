import type { ReactNode } from "react";

export function StatCard({
  title,
  value,
  delta,
  deltaType,
  footer,
}: {
  title: string;
  value: ReactNode;
  delta?: string;
  deltaType?: "up" | "down" | "neutral";
  footer?: ReactNode;
}) {
  return (
    <div className="stat-card">
      <small>{title}</small>
      <div className="stat-main">{value}</div>
      {delta && (
        <div className={"stat-delta " + (deltaType || "neutral")}>{delta}</div>
      )}
      {footer && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}
