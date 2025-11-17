import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDailyForMonth,
  getMonthlyByMonth,
  getMonthlySummaries,
} from "../services/storage";
import type { DailyMetrics, AgentStats, CategoryCount } from "../types";
import { StatCard } from "./StatCard";
import { CategoryBar } from "./TagSummary";
import { MissedBreakdownChart, CallPerformanceChart } from "./Charts";
import { AgentMetrics } from "./AgentMetrics";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";

export function HistoryMonth() {
  const { month } = useParams(); // YYYY-MM
  const navigate = useNavigate();
  const [days, setDays] = useState<DailyMetrics[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mom, setMoM] = useState<{
    inbound?: number;
    answered?: number;
  } | null>(null);
  const [yoy, setYoY] = useState<{
    inbound?: number;
    answered?: number;
  } | null>(null);
  const [series, setSeries] = useState<
    { month: string; inbound: number; answered: number }[]
  >([]);

  useEffect(() => {
    if (!month) return;
    (async () => {
      setLoading(true);
      const list = await getDailyForMonth(month);
      setDays(list);
      // Compute MoM/YoY from monthly summaries
      const prevMonth = prevMonthKey(month);
      const prevYear = prevYearSameMonthKey(month);
      const [curr, prev, prevYr] = await Promise.all([
        getMonthlyByMonth(month),
        getMonthlyByMonth(prevMonth),
        getMonthlyByMonth(prevYear),
      ]);
      if (curr) {
        setMoM({
          inbound: prev
            ? pctChange(prev.inboundEffective, curr.inboundEffective)
            : undefined,
          answered: prev ? pctChange(prev.answered, curr.answered) : undefined,
        });
        setYoY({
          inbound: prevYr
            ? pctChange(prevYr.inboundEffective, curr.inboundEffective)
            : undefined,
          answered: prevYr
            ? pctChange(prevYr.answered, curr.answered)
            : undefined,
        });
      } else {
        setMoM(null);
        setYoY(null);
      }
      // Build month-to-month series (last 12 months)
      const all = await getMonthlySummaries();
      const last12 = all.slice().reverse().slice(-12); // chronological order last 12
      setSeries(
        last12.map((m) => ({
          month: m.month,
          inbound: m.inboundEffective,
          answered: m.answered,
        }))
      );
      setLoading(false);
    })();
  }, [month]);

  const rollup = useMemo(() => {
    if (!days || !days.length) return null;
    // Sum totals and aggregate fields across all days in the month
    let inboundEffective = 0,
      outbound = 0,
      answered = 0,
      missed = 0,
      answeredWaitTotal = 0,
      answeredWaitCount = 0;
    const missedBreakdown: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const agentMap = new Map<string, AgentStats>();

    for (const d of days) {
      inboundEffective += d.inboundEffective;
      outbound += d.outbound;
      answered += d.answered;
      missed += d.missed;
      // avgWaitSeconds is weighted by answered counts; reconstruct totals
      answeredWaitTotal += (d.avgWaitSeconds || 0) * (d.answered || 0);
      answeredWaitCount += d.answered || 0;
      for (const [k, v] of Object.entries(d.missedBreakdown || {})) {
        missedBreakdown[k] = (missedBreakdown[k] || 0) + v;
      }
      for (const c of d.categoryCounts || []) {
        categoryMap[c.name] = (categoryMap[c.name] || 0) + c.count;
      }
      for (const a of d.agentStats || []) {
        const ex = agentMap.get(a.user) || {
          user: a.user,
          inboundAnswered: 0,
          inboundMissed: 0,
          outbound: 0,
          totalHandled: 0,
          inboundAnsweredWaitTotal: 0,
          inboundAnsweredWaitCount: 0,
        };
        ex.inboundAnswered += a.inboundAnswered;
        ex.inboundMissed += a.inboundMissed;
        ex.outbound += a.outbound;
        ex.totalHandled += a.totalHandled;
        ex.inboundAnsweredWaitTotal =
          (ex.inboundAnsweredWaitTotal || 0) +
          (a.inboundAnsweredWaitTotal || 0);
        ex.inboundAnsweredWaitCount =
          (ex.inboundAnsweredWaitCount || 0) +
          (a.inboundAnsweredWaitCount || 0);
        agentMap.set(a.user, ex);
      }
    }
    const avgWaitSeconds = answeredWaitCount
      ? answeredWaitTotal / answeredWaitCount
      : 0;
    const categoryCounts: CategoryCount[] = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const agentStats: AgentStats[] = Array.from(agentMap.values()).map((a) => ({
      ...a,
      avgWaitSeconds:
        a.inboundAnsweredWaitCount || 0
          ? (a.inboundAnsweredWaitTotal || 0) /
            (a.inboundAnsweredWaitCount || 1)
          : undefined,
    }));

    const topInbound = agentStats.length
      ? agentStats
          .slice()
          .sort((x, y) => y.inboundAnswered - x.inboundAnswered)[0]
      : undefined;

    const monthData: DailyMetrics = {
      date: `${month}-01`,
      inboundRaw: inboundEffective, // not tracked at month; use effective as raw placeholder
      inboundEffective,
      outbound,
      answered,
      missed,
      missedBreakdown,
      answerable: inboundEffective,
      avgWaitSeconds,
      topInboundPerformer: topInbound
        ? { user: topInbound.user, count: topInbound.inboundAnswered }
        : undefined,
      agentStats,
      categoryCounts,
      recordsStored: 0,
    };
    return monthData;
  }, [days, month]);

  if (loading) return <div>Loading month...</div>;
  if (!days || !days.length) return <div>No data for {month}</div>;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" onClick={() => navigate(-1)}>
          {"← Back"}
        </button>
        <h2 style={{ margin: 0 }}>Month Detail: {month}</h2>
      </div>
      {rollup && (
        <>
          <div className="cards-row" style={{ marginTop: 12 }}>
            <StatCard title="Inbound" value={rollup.inboundEffective} />
            <StatCard title="Outbound" value={rollup.outbound} />
            <StatCard title="Answered" value={rollup.answered} />
            <StatCard title="Missed" value={rollup.missed} />
            <StatCard
              title="Avg Wait (s)"
              value={rollup.avgWaitSeconds.toFixed(1)}
            />
            <StatCard
              title="Top Inbound"
              value={rollup.topInboundPerformer?.user || "—"}
              footer={
                rollup.topInboundPerformer
                  ? `${rollup.topInboundPerformer.count} answered`
                  : undefined
              }
            />
          </div>
          <div className="cards-row" style={{ marginTop: 12 }}>
            <StatCard
              title="Inbound MoM"
              value={formatPctOrDash(mom?.inbound)}
            />
            <StatCard
              title="Answered MoM"
              value={formatPctOrDash(mom?.answered)}
            />
            <StatCard
              title="Inbound YoY"
              value={formatPctOrDash(yoy?.inbound)}
            />
            <StatCard
              title="Answered YoY"
              value={formatPctOrDash(yoy?.answered)}
            />
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Top Categories</h3>
            <CategoryBar categories={rollup.categoryCounts.slice(0, 10)} />
          </div>
          <div className="panel mt24">
            <h3>Month-to-Month Comparison</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inbound" name="Inbound (Eff)" fill="#4b8eda" />
                  <Bar dataKey="answered" name="Answered" fill="#2ecc71" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="chart-row mt24">
            <div className="panel">
              <h3>Missed Breakdown</h3>
              <MissedBreakdownChart data={rollup} />
            </div>
            <div className="panel">
              <h3>Call Performance</h3>
              <CallPerformanceChart data={rollup} />
            </div>
            <div className="panel">
              <AgentMetrics data={rollup} />
            </div>
          </div>
        </>
      )}
      <div className="panel mt24">
        <h3>Days in {month}</h3>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6 }}>Date</th>
              <th style={{ textAlign: "left", padding: 6 }}>Inbound (Eff)</th>
              <th style={{ textAlign: "left", padding: 6 }}>Answered</th>
              <th style={{ textAlign: "left", padding: 6 }}>Missed</th>
              <th style={{ textAlign: "left", padding: 6 }}>Avg Wait (s)</th>
            </tr>
          </thead>
          <tbody>
            {days?.map((d) => (
              <tr
                key={d.date}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/history/${d.date}`)}
              >
                <td style={{ padding: 6 }}>{d.date}</td>
                <td style={{ padding: 6 }}>{d.inboundEffective}</td>
                <td style={{ padding: 6 }}>{d.answered}</td>
                <td style={{ padding: 6 }}>{d.missed}</td>
                <td style={{ padding: 6 }}>{d.avgWaitSeconds.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pctChange(oldV: number, newV: number) {
  if (oldV === 0) return newV === 0 ? 0 : 100;
  return ((newV - oldV) / oldV) * 100;
}

function formatPctOrDash(v?: number) {
  if (v === undefined || v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function prevMonthKey(month: string) {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function prevYearSameMonthKey(month: string) {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  return `${y - 1}-${String(m).padStart(2, "0")}`;
}
