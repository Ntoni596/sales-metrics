import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDailyForMonth,
  getMonthlyByMonth,
  getMonthlySummaries,
  getFrontMonthlySummary,
  getFrontDailyForMonth,
} from "../services/storage";
import type {
  DailyMetrics,
  AgentStats,
  CategoryCount,
  FrontMonthlySummary,
  FrontDailySummary,
  FrontChannelStats,
  FrontChannelKey,
} from "../types";
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
  const [frontMonthly, setFrontMonthly] = useState<FrontMonthlySummary | null>(
    null
  );
  const [frontDaily, setFrontDaily] = useState<FrontDailySummary[]>([]);

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
      try {
        const [frontMonth, frontDays] = await Promise.all([
          getFrontMonthlySummary(month),
          getFrontDailyForMonth(month),
        ]);
        setFrontMonthly(frontMonth);
        setFrontDaily(frontDays);
      } catch (err: unknown) {
        console.warn("[HistoryMonth] failed to load Front data", err);
        setFrontMonthly(null);
        setFrontDaily([]);
      }
      setLoading(false);
    })();
  }, [month]);

  const livechatStats = frontMonthly?.channels?.livechat;
  const emailStats = frontMonthly?.channels?.email;

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
    let inboundUntagged = 0;
    const untaggedByUserAgg: Record<string, number> = {};

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
      // Tagging aggregation
      inboundUntagged += d.inboundUntagged || 0;
      for (const entry of d.untaggedInboundByUser || []) {
        if (!entry || !entry.user) continue;
        untaggedByUserAgg[entry.user] =
          (untaggedByUserAgg[entry.user] || 0) + (entry.count || 0);
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
      inboundUntagged,
      untaggedInboundByUser: Object.entries(untaggedByUserAgg)
        .map(([user, count]) => ({ user, count }))
        .sort((a, b) => b.count - a.count),
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
          {frontMonthly ? (
            <div className="panel mt24">
              <h3>Front Communications Overview</h3>
              <div className="cards-row" style={{ marginTop: 12 }}>
                <StatCard
                  title="Total Conversations"
                  value={formatCount(frontMonthly.conversations)}
                />
                <StatCard
                  title="Live Chat Conversations"
                  value={formatCount(livechatStats?.conversations)}
                />
                <StatCard
                  title="Email Conversations"
                  value={formatCount(emailStats?.conversations)}
                />
              </div>
              <div className="cards-row" style={{ marginTop: 12 }}>
                <StatCard
                  title="Live Chat Avg First Response (s)"
                  value={formatSeconds(livechatStats?.avgFirstResponseSeconds)}
                />
                <StatCard
                  title="Email Avg First Response (s)"
                  value={formatSeconds(emailStats?.avgFirstResponseSeconds)}
                />
                <StatCard
                  title="Live Chat Within 1 min"
                  value={formatRatio(
                    livechatStats?.metResponseTarget,
                    livechatStats?.conversations
                  )}
                  footer={formatPctValue(
                    livechatStats?.metResponseTarget,
                    livechatStats?.conversations
                  )}
                />
              </div>
              <div className="cards-row" style={{ marginTop: 12 }}>
                <StatCard
                  title="Email Within 24 hrs"
                  value={formatRatio(
                    emailStats?.metResponseTarget,
                    emailStats?.conversations
                  )}
                  footer={formatPctValue(
                    emailStats?.metResponseTarget,
                    emailStats?.conversations
                  )}
                />
                <StatCard
                  title="Live Chat After Hours"
                  value={formatRatio(
                    livechatStats?.afterHoursConversations,
                    livechatStats?.conversations
                  )}
                  footer={formatPctValue(
                    livechatStats?.afterHoursConversations,
                    livechatStats?.conversations
                  )}
                />
                <StatCard
                  title="Unique Contacts"
                  value={formatCount(frontMonthly.uniqueContacts)}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  marginTop: 16,
                }}
              >
                <ChannelBreakdown
                  title="Live Chat"
                  stats={livechatStats}
                  channel="livechat"
                />
                <ChannelBreakdown
                  title="Email"
                  stats={emailStats}
                  channel="email"
                />
              </div>
              {frontMonthly.topTags?.length ? (
                <div style={{ marginTop: 16 }}>
                  <strong>Top Tags</strong>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 6,
                    }}
                  >
                    {frontMonthly.topTags.slice(0, 6).map((tag) => (
                      <span
                        key={tag.name}
                        style={{
                          background: "#111827",
                          borderRadius: 4,
                          padding: "4px 8px",
                          fontSize: 12,
                          border: "1px solid #1f2937",
                        }}
                      >
                        {tag.name}: {tag.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {frontMonthly.aiInsights?.length ? (
                <div style={{ marginTop: 16 }}>
                  <strong>AI Insights</strong>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {frontMonthly.aiInsights.slice(0, 5).map((insight) => (
                      <li
                        key={insight.id}
                        style={{
                          marginBottom: 8,
                          color:
                            insight.impact === "warning"
                              ? "#f97316"
                              : insight.impact === "positive"
                              ? "#10b981"
                              : "inherit",
                        }}
                      >
                        <strong>{insight.title}:</strong> {insight.detail}
                        {insight.metric ? ` (${insight.metric})` : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="panel mt24">
              <h3>Front Communications Overview</h3>
              <div style={{ opacity: 0.7 }}>
                No Front communication data has been saved for this month yet.
              </div>
            </div>
          )}
          {frontDaily.length ? (
            <div className="panel mt24">
              <h3>Front Daily Breakdown</h3>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 6 }}>Date</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Chats</th>
                    <th style={{ textAlign: "left", padding: 6 }}>
                      After Hours %
                    </th>
                    <th style={{ textAlign: "left", padding: 6 }}>
                      Avg First Response (s)
                    </th>
                    <th style={{ textAlign: "left", padding: 6 }}>Top Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {frontDaily.map((day) => (
                    <tr key={day.date}>
                      <td style={{ padding: 6 }}>{day.date}</td>
                      <td style={{ padding: 6 }}>{day.conversations}</td>
                      <td style={{ padding: 6 }}>
                        {formatPct(
                          day.afterHoursConversations,
                          day.conversations
                        )}
                      </td>
                      <td style={{ padding: 6 }}>
                        {formatSeconds(day.avgFirstResponseSeconds)}
                      </td>
                      <td style={{ padding: 6 }}>
                        {day.topTags && day.topTags.length
                          ? `${day.topTags[0].name} (${day.topTags[0].count})`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="panel mt24">
            <h3>Untagged Inbound (Answered)</h3>
            <div className="cards-row" style={{ marginTop: 8 }}>
              <StatCard
                title="Untagged Inbound"
                value={rollup.inboundUntagged || 0}
              />
            </div>
            {rollup.untaggedInboundByUser &&
              rollup.untaggedInboundByUser.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <table style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 6 }}>Agent</th>
                        <th style={{ textAlign: "left", padding: 6 }}>
                          Untagged Inbound
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollup.untaggedInboundByUser.slice(0, 15).map((row) => (
                        <tr key={row.user}>
                          <td style={{ padding: 6 }}>{row.user}</td>
                          <td style={{ padding: 6 }}>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

function formatPct(part: number, total: number) {
  if (!total) return "—";
  const pct = (part / total) * 100;
  return `${pct.toFixed(1)}%`;
}

function formatSeconds(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  const totalSeconds = Math.round(value);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function formatCount(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString();
}

function formatRatio(part?: number | null, total?: number | null) {
  if (part === undefined || part === null) return "—";
  if (total === undefined || total === null || total === 0) return "—";
  return `${part.toLocaleString()} / ${total.toLocaleString()}`;
}

function formatPctValue(part?: number | null, total?: number | null) {
  if (part === undefined || part === null) return undefined;
  if (total === undefined || total === null || total === 0) return undefined;
  const pct = (part / total) * 100;
  return `${pct.toFixed(1)}%`;
}

function formatRatioWithPct(part?: number | null, total?: number | null) {
  const ratio = formatRatio(part, total);
  const pct = formatPctValue(part, total);
  if (ratio === "—") return "—";
  return pct ? `${ratio} (${pct})` : ratio;
}

function ChannelBreakdown({
  title,
  stats,
  channel,
}: {
  title: string;
  stats?: FrontChannelStats | null;
  channel?: FrontChannelKey;
}) {
  if (!stats) {
    return (
      <div
        style={{
          background: "#0b0b0b",
          border: "1px solid #1f2937",
          borderRadius: 8,
          padding: 12,
        }}
      >
        <strong>{title}</strong>
        <div style={{ marginTop: 8, color: "var(--text-dim)" }}>
          No data saved for this channel yet.
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "#0b0b0b",
        border: "1px solid #1f2937",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <strong>{title}</strong>
      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        <ChannelMetric
          label="Conversations"
          value={formatCount(stats.conversations)}
        />
        <ChannelMetric
          label="Inbound Messages"
          value={formatCount(stats.inboundMessages)}
        />
        <ChannelMetric
          label="Outbound Messages"
          value={formatCount(stats.outboundMessages)}
        />
        <ChannelMetric
          label="Avg First Response (s)"
          value={formatSeconds(stats.avgFirstResponseSeconds)}
        />
        <ChannelMetric
          label="Avg Handle (s)"
          value={formatSeconds(stats.avgHandleSeconds)}
        />
        <ChannelMetric
          label={
            channel === "livechat"
              ? "Responded Within 1 min"
              : channel === "email"
              ? "Responded Within 24 hrs"
              : "Responded Within Target"
          }
          value={formatRatioWithPct(
            stats.metResponseTarget,
            stats.conversations
          )}
        />
        <ChannelMetric
          label="After Hours"
          value={formatRatioWithPct(
            stats.afterHoursConversations,
            stats.conversations
          )}
        />
      </div>
    </div>
  );
}

function ChannelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
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
