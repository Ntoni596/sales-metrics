import { useEffect, useState } from "react";
import { getLatestDaily } from "../services/storage";
import type { DailyMetrics } from "../types";
// Trimmed: Only keep EOD copy block in this component

export function DailySummary({
  refreshToken,
  data: override,
  title,
}: {
  refreshToken?: number;
  data?: DailyMetrics | null;
  title?: string;
}) {
  const [data, setData] = useState<DailyMetrics | null>(override ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (override !== undefined) {
      // If parent is controlling data, just use it and stop loading
      setData(override ?? null);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setData(await getLatestDaily());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, override]);
  if (loading) return <div>Loading daily summary...</div>;
  if (error) return <div style={{ color: "crimson" }}>{error}</div>;
  if (!data) return <div>No daily data yet. Upload a CSV.</div>;
  const missedPct = data.inboundEffective
    ? ((data.missed / data.inboundEffective) * 100).toFixed(1)
    : "0";
  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 16,
        borderRadius: 8,
        marginTop: 16,
      }}
    >
      <h2>
        {title || "Copy/Paste EOD Block"} ({data.date})
      </h2>
      <textarea
        style={{ width: "100%", minHeight: 140 }}
        readOnly
        value={buildEodBlock(data, missedPct)}
      />
    </div>
  );
}

function buildEodBlock(d: DailyMetrics, missedPct: string) {
  const catLines = d.categoryCounts
    .map((c) => `${c.name},${c.count}`)
    .join("\n");
  return `${d.answered}/${d.inboundEffective}  ${d.missed} (${missedPct}% Missed)\nOutbound ${d.outbound}\n${catLines}`;
}
