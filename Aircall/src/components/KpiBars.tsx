interface Kpi {
  label: string;
  value: number; // percent 0-100
  target?: string;
  tone?: "normal" | "warn" | "danger";
}

export function KpiBars({ items }: { items: Kpi[] }) {
  return (
    <div className="kpi-bars">
      {items.map((k) => (
        <div key={k.label} className="kpi">
          <div className="kpi-header">
            <span>{k.label}</span>
            <span>{k.value.toFixed(0)}%</span>
          </div>
          <div className="kpi-bar-wrap">
            <div
              className={
                "kpi-bar" + (k.tone && k.tone !== "normal" ? " " + k.tone : "")
              }
              style={{ width: `${Math.min(100, Math.max(0, k.value))}%` }}
            />
          </div>
          {k.target && (
            <div
              style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)" }}
            >
              Target: {k.target}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
