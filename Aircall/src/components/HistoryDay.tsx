import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDailyByDate } from "../services/storage";
import type { DailyMetrics } from "../types";
import { StatCard } from "./StatCard";
import { CategoryBar } from "./TagSummary";
import { Charts } from "./Charts";
import { AgentMetrics } from "./AgentMetrics";

export function HistoryDay() {
  const { date } = useParams();
  const [data, setData] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    (async () => {
      setLoading(true);
      const d = await getDailyByDate(date);
      setData(d);
      setLoading(false);
    })();
  }, [date]);

  if (loading) return <div>Loading day...</div>;
  if (!data) return <div>No data for {date}</div>;

  return (
    <div style={{ marginTop: 16 }}>
      <h2>Day Detail: {data.date}</h2>
      <div className="cards-row">
        <StatCard title="Inbound (Effective)" value={data.inboundEffective} />
        <StatCard title="Outbound" value={data.outbound} />
        <StatCard title="Answered" value={data.answered} />
        <StatCard title="Missed" value={data.missed} />
        <StatCard title="Avg Wait (s)" value={data.avgWaitSeconds.toFixed(1)} />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Top Categories</h3>
        <CategoryBar categories={data.categoryCounts.slice(0, 10)} />
      </div>
      <div className="chart-row mt24">
        <div className="panel">
          <Charts data={data} />
        </div>
        <div className="panel">
          <AgentMetrics data={data} />
        </div>
      </div>
    </div>
  );
}
