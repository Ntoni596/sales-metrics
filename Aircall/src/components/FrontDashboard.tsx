import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { parseFrontCsv, computeFrontAnalytics } from "../services/front";
import {
  getFrontDailyForMonth,
  getFrontMonthlySummary,
  getLatestFrontDaily,
  getLatestFrontMonthly,
  saveFrontSummaries,
} from "../services/storage";
import type {
  FrontAnalytics,
  FrontInsight,
  FrontDailySummary,
  FrontMonthlySummary,
  FrontChannelStats,
  FrontChannelKey,
} from "../types";
import { FIREBASE_CONFIG_OK } from "../firebase";
import { StatCard } from "./StatCard";

type FrontTabKey = "latest-day" | "current-month";

export function FrontDashboard() {
  const [analytics, setAnalytics] = useState<FrontAnalytics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FrontTabKey>("latest-day");
  const [persistedLoading, setPersistedLoading] = useState(true);
  const [persistedError, setPersistedError] = useState<string | null>(null);
  const [latestDay, setLatestDay] = useState<FrontDailySummary | null>(null);
  const [currentMonthSummary, setCurrentMonthSummary] =
    useState<FrontMonthlySummary | null>(null);
  const [currentMonthDaily, setCurrentMonthDaily] = useState<
    FrontDailySummary[]
  >([]);
  const [currentMonthKey, setCurrentMonthKey] = useState<string | null>(null);

  const refreshPersisted = useCallback(async () => {
    setPersistedLoading(true);
    setPersistedError(null);
    try {
      const [latestDailyDoc, latestMonthlyDoc] = await Promise.all([
        getLatestFrontDaily(),
        getLatestFrontMonthly(),
      ]);

      setLatestDay(latestDailyDoc ?? null);

      const inferredMonthKey =
        latestDailyDoc?.date?.slice(0, 7) ??
        latestMonthlyDoc?.month ??
        getCurrentMonthKey();

      setCurrentMonthKey(inferredMonthKey ?? null);

      if (inferredMonthKey) {
        const [monthSummary, monthDaily] = await Promise.all([
          getFrontMonthlySummary(inferredMonthKey).catch(() => null),
          getFrontDailyForMonth(inferredMonthKey).catch(() => []),
        ]);
        setCurrentMonthSummary(monthSummary);
        setCurrentMonthDaily(monthDaily);

        if (!latestDailyDoc && monthDaily.length) {
          setLatestDay(monthDaily[0]);
        }
      } else {
        setCurrentMonthSummary(null);
        setCurrentMonthDaily([]);
      }
    } catch (err) {
      console.warn("[FrontDashboard] failed to load saved Front data", err);
      setPersistedError(toMessage(err, "Failed to load saved Front data."));
      setLatestDay(null);
      setCurrentMonthSummary(null);
      setCurrentMonthDaily([]);
      setCurrentMonthKey(null);
    } finally {
      setPersistedLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPersisted();
  }, [refreshPersisted]);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const messages = await parseFrontCsv(file);
      const summary = computeFrontAnalytics(messages);
      setAnalytics(summary);
    } catch (err) {
      console.error("[FrontDashboard] parse error", err);
      setAnalytics(null);
      setError(toMessage(err, "Failed to parse Front export CSV."));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!analytics) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await saveFrontSummaries(analytics);
      setStatus("Front insights saved to Firestore.");
      await refreshPersisted();
    } catch (err) {
      console.error("[FrontDashboard] save error", err);
      setError(toMessage(err, "Unable to save Front insights."));
    } finally {
      setBusy(false);
    }
  };

  const hasSavedData =
    !!(latestDay && latestDay.date) ||
    !!(currentMonthSummary && currentMonthSummary.month) ||
    currentMonthDaily.length > 0;

  return (
    <div style={{ marginTop: 16 }}>
      <div className="panel" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Front Live Chat Analytics</h2>
        <p style={{ opacity: 0.8, marginBottom: 12 }}>
          Upload a Front export CSV (Messages) to profile chat volumes, response
          times, and tagging trends. The AI summary highlights patterns and
          opportunities for the sales and support teams.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            className="btn"
            type="button"
            onClick={handleSave}
            disabled={busy || !analytics || !FIREBASE_CONFIG_OK}
          >
            Save Insights to Firestore
          </button>
          {!FIREBASE_CONFIG_OK && (
            <span style={{ color: "#f97316" }}>
              Configure Firebase environment to enable saving.
            </span>
          )}
          {analytics && (
            <span style={{ opacity: 0.75 }}>
              {analytics.dateRange.start} → {analytics.dateRange.end}
            </span>
          )}
        </div>
        {error && (
          <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>
        )}
        {status && (
          <div style={{ color: "#22c55e", marginTop: 12 }}>{status}</div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Saved Front Insights</h3>
        {persistedLoading ? (
          <div>Loading saved Front data...</div>
        ) : persistedError ? (
          <div style={{ color: "crimson" }}>{persistedError}</div>
        ) : hasSavedData ? (
          <SavedFrontInsights
            latestDay={latestDay}
            monthSummary={currentMonthSummary}
            monthDaily={currentMonthDaily}
            monthKey={currentMonthKey || undefined}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        ) : (
          <div style={{ opacity: 0.75 }}>
            No Front data saved yet. Upload a CSV and click save to populate.
          </div>
        )}
      </div>

      {analytics ? (
        <AnalyticsPreview analytics={analytics} />
      ) : (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Upload Front Live Chat Export</h3>
          <div style={{ opacity: 0.75 }}>
            Choose a CSV export from Front (&ldquo;Messages&rdquo; view). Once
            parsed you will see response-time trends, agent performance, tag
            mix, and AI-generated talking points.
          </div>
        </div>
      )}
    </div>
  );
}

function SavedFrontInsights({
  latestDay,
  monthSummary,
  monthDaily,
  monthKey,
  activeTab,
  onTabChange,
}: {
  latestDay: FrontDailySummary | null;
  monthSummary: FrontMonthlySummary | null;
  monthDaily: FrontDailySummary[];
  monthKey?: string;
  activeTab: FrontTabKey;
  onTabChange: (tab: FrontTabKey) => void;
}) {
  const tabs: { key: FrontTabKey; label: string }[] = [
    { key: "latest-day", label: "Latest Day" },
    {
      key: "current-month",
      label: monthKey ? `Current Month (${monthKey})` : "Current Month",
    },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            style={tabButtonStyle(activeTab === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "latest-day" ? (
        <LatestDayView day={latestDay} />
      ) : (
        <CurrentMonthView summary={monthSummary} daily={monthDaily} />
      )}
    </>
  );
}

function LatestDayView({ day }: { day: FrontDailySummary | null }) {
  if (!day) {
    return <div style={{ opacity: 0.75 }}>No daily records saved yet.</div>;
  }

  const slaPct = formatPct(day.metResponseTarget, day.conversations);

  return (
    <>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Showing saved data for {day.date}
      </div>
      <div className="cards-row" style={{ marginTop: 12 }}>
        <StatCard
          title="Conversations"
          value={formatCount(day.conversations)}
        />
        <StatCard
          title="Inbound Messages"
          value={formatCount(day.inboundMessages)}
        />
        <StatCard
          title="Outbound Messages"
          value={formatCount(day.outboundMessages)}
        />
        <StatCard
          title="Met SLA"
          value={formatCount(day.metResponseTarget)}
          footer={slaPct !== "—" ? `${slaPct} within target` : undefined}
        />
        <StatCard
          title="Avg First Response"
          value={formatDuration(day.avgFirstResponseSeconds)}
        />
        <StatCard
          title="After Hours %"
          value={formatPct(day.afterHoursConversations, day.conversations)}
        />
      </div>
      {day.topTags && day.topTags.length ? (
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
            {day.topTags.slice(0, 6).map((tag) => (
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
    </>
  );
}

function CurrentMonthView({
  summary,
  daily,
}: {
  summary: FrontMonthlySummary | null;
  daily: FrontDailySummary[];
}) {
  const chartData = useMemo(() => {
    if (!daily.length) return [];
    return daily
      .slice()
      .reverse()
      .map((day) => ({
        date: day.date,
        chats: day.conversations,
        avgResponse: day.avgFirstResponseSeconds ?? null,
      }));
  }, [daily]);

  if (!summary) {
    return <div style={{ opacity: 0.75 }}>No monthly summary saved yet.</div>;
  }

  const livechat = summary.channels?.livechat;
  const email = summary.channels?.email;

  return (
    <>
      <div style={{ fontSize: 12, opacity: 0.8 }}>Month: {summary.month}</div>
      <div className="cards-row" style={{ marginTop: 12 }}>
        <StatCard
          title="Conversations"
          value={formatCount(summary.conversations)}
        />
        <StatCard
          title="Inbound Messages"
          value={formatCount(summary.inboundMessages)}
        />
        <StatCard
          title="Outbound Messages"
          value={formatCount(summary.outboundMessages)}
        />
        <StatCard
          title="Met SLA"
          value={formatCount(summary.metResponseTarget)}
          footer={formatPct(summary.metResponseTarget, summary.conversations)}
        />
        <StatCard
          title="Avg First Response"
          value={formatDuration(summary.avgFirstResponseSeconds)}
        />
        <StatCard
          title="After Hours %"
          value={formatPct(
            summary.afterHoursConversations,
            summary.conversations
          )}
        />
      </div>
      <div className="cards-row" style={{ marginTop: 12 }}>
        <StatCard
          title="Unique Contacts"
          value={formatCount(summary.uniqueContacts)}
        />
        <StatCard
          title="P90 First Response"
          value={formatDuration(summary.p90FirstResponseSeconds)}
        />
      </div>
      {(livechat || email) && (
        <div style={{ marginTop: 16 }}>
          <strong>Channel Highlights</strong>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              marginTop: 8,
            }}
          >
            {livechat ? (
              <ChannelCard
                title="Live Chat"
                channel="livechat"
                stats={livechat}
              />
            ) : null}
            {email ? (
              <ChannelCard title="Email" channel="email" stats={email} />
            ) : null}
          </div>
        </div>
      )}
      {summary.topTags && summary.topTags.length ? (
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
            {summary.topTags.slice(0, 8).map((tag) => (
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
      {summary.aiInsights && summary.aiInsights.length ? (
        <div style={{ marginTop: 16 }}>
          <strong>AI Insights</strong>
          <AIInsightList insights={summary.aiInsights} />
        </div>
      ) : null}
      {chartData.length ? (
        <div style={{ marginTop: 16 }}>
          <strong>Daily Trend</strong>
          <div style={{ width: "100%", height: 260, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={16} />
                <YAxis
                  yAxisId="left"
                  label={{ value: "Chats", angle: -90, position: "insideLeft" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{
                    value: "Avg Response (s)",
                    angle: 90,
                    position: "insideRight",
                  }}
                />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="chats"
                  stroke="#4b8eda"
                  name="# Chats"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgResponse"
                  stroke="#10b981"
                  name="Avg First Response (s)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
      {daily.length ? (
        <div style={{ marginTop: 16 }}>
          <strong>Daily Breakdown</strong>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 6 }}>Date</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Chats</th>
                  <th style={{ textAlign: "left", padding: 6 }}>
                    After Hours %
                  </th>
                  <th style={{ textAlign: "left", padding: 6 }}>
                    Avg First Response
                  </th>
                  <th style={{ textAlign: "left", padding: 6 }}>Top Tag</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day) => (
                  <tr key={day.date}>
                    <td style={{ padding: 6 }}>{day.date}</td>
                    <td style={{ padding: 6 }}>
                      {formatCount(day.conversations)}
                    </td>
                    <td style={{ padding: 6 }}>
                      {formatPct(
                        day.afterHoursConversations,
                        day.conversations
                      )}
                    </td>
                    <td style={{ padding: 6 }}>
                      {formatDuration(day.avgFirstResponseSeconds)}
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
        </div>
      ) : null}
    </>
  );
}

function ChannelCard({
  title,
  channel,
  stats,
}: {
  title: string;
  channel: FrontChannelKey;
  stats: FrontChannelStats;
}) {
  return (
    <div
      style={{
        background: "#0b0b0b",
        borderRadius: 8,
        border: "1px solid #1f2937",
        padding: 12,
      }}
    >
      <strong>{title}</strong>
      <div style={{ fontSize: 12, marginTop: 8, display: "grid", gap: 4 }}>
        <span>Conversations: {formatCount(stats.conversations)}</span>
        <span>Inbound Messages: {formatCount(stats.inboundMessages)}</span>
        <span>Outbound Messages: {formatCount(stats.outboundMessages)}</span>
        <span>
          Avg First Response: {formatDuration(stats.avgFirstResponseSeconds)}
        </span>
        <span>
          {channelSlaLabel(channel)}:{" "}
          {formatPct(stats.metResponseTarget, stats.conversations)}
        </span>
        <span>
          After Hours %:{" "}
          {formatPct(stats.afterHoursConversations, stats.conversations)}
        </span>
      </div>
    </div>
  );
}

function AnalyticsPreview({ analytics }: { analytics: FrontAnalytics }) {
  const dailyChartData = useMemo(() => {
    return analytics.daily
      .slice()
      .reverse()
      .map((day) => ({
        date: day.date,
        chats: day.conversations,
        avgResponse: day.avgFirstResponseSeconds ?? null,
      }));
  }, [analytics]);

  const topTags = useMemo(() => {
    return analytics.tags.slice(0, 10);
  }, [analytics]);

  const agentRows = useMemo(() => {
    return analytics.agentSummaries.slice(0, 12);
  }, [analytics]);

  const monthlyRows = useMemo(() => {
    return analytics.monthly.slice(0, 6);
  }, [analytics]);

  return (
    <>
      <div className="cards-row" style={{ marginTop: 16 }}>
        <StatCard title="Chats" value={analytics.totals.conversations} />
        <StatCard
          title="Inbound Messages"
          value={analytics.totals.inboundMessages}
        />
        <StatCard
          title="Outbound Messages"
          value={analytics.totals.outboundMessages}
        />
        <StatCard
          title="Avg First Response (s)"
          value={formatSeconds(analytics.totals.avgFirstResponseSeconds)}
        />
        <StatCard
          title="After Hours %"
          value={formatPct(
            analytics.totals.afterHoursConversations,
            analytics.totals.conversations
          )}
        />
        <StatCard
          title="Unique Contacts"
          value={analytics.totals.uniqueContacts}
        />
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>AI Insights</h3>
        <AIInsightList insights={analytics.aiInsights} />
      </div>

      <div className="panel mt24">
        <h3>Daily Trends</h3>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={16} />
              <YAxis
                yAxisId="left"
                label={{ value: "Chats", angle: -90, position: "insideLeft" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{
                  value: "Avg Response (s)",
                  angle: 90,
                  position: "insideRight",
                }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="chats"
                stroke="#4b8eda"
                name="# Chats"
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgResponse"
                stroke="#10b981"
                name="Avg First Response (s)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel mt24">
        <h3>Tag Distribution</h3>
        {topTags.length ? (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTags}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={80}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" name="Conversations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>No tag data detected.</div>
        )}
      </div>

      <div className="panel mt24">
        <h3>Agent Performance</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 6 }}>Agent</th>
                <th style={{ textAlign: "left", padding: 6 }}>Chats</th>
                <th style={{ textAlign: "left", padding: 6 }}>
                  Met Response Target %
                </th>
                <th style={{ textAlign: "left", padding: 6 }}>
                  Avg First Response (s)
                </th>
                <th style={{ textAlign: "left", padding: 6 }}>After Hours %</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.map((agent) => (
                <tr key={agent.agent}>
                  <td style={{ padding: 6 }}>{agent.agent}</td>
                  <td style={{ padding: 6 }}>{agent.conversations}</td>
                  <td style={{ padding: 6 }}>
                    {formatPct(agent.metResponseTarget, agent.conversations)}
                  </td>
                  <td style={{ padding: 6 }}>
                    {formatSeconds(agent.avgFirstResponseSeconds)}
                  </td>
                  <td style={{ padding: 6 }}>
                    {formatPct(
                      agent.afterHoursConversations,
                      agent.conversations
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {monthlyRows.length ? (
        <div className="panel mt24">
          <h3>Monthly Snapshots</h3>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 6 }}>Month</th>
                <th style={{ textAlign: "left", padding: 6 }}>Chats</th>
                <th style={{ textAlign: "left", padding: 6 }}>
                  Avg First Response (s)
                </th>
                <th style={{ textAlign: "left", padding: 6 }}>After Hours %</th>
                <th style={{ textAlign: "left", padding: 6 }}>Top Insight</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((month) => (
                <tr key={month.month}>
                  <td style={{ padding: 6 }}>{month.month}</td>
                  <td style={{ padding: 6 }}>{month.conversations}</td>
                  <td style={{ padding: 6 }}>
                    {formatSeconds(month.avgFirstResponseSeconds)}
                  </td>
                  <td style={{ padding: 6 }}>
                    {formatPct(
                      month.afterHoursConversations,
                      month.conversations
                    )}
                  </td>
                  <td style={{ padding: 6 }}>
                    {month.aiInsights && month.aiInsights.length
                      ? month.aiInsights[0].title
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function tabButtonStyle(active: boolean) {
  return {
    padding: "6px 12px",
    borderRadius: 6,
    border: active ? "1px solid #2563eb" : "1px solid #1f2937",
    background: active ? "#1f2937" : "transparent",
    color: active ? "#60a5fa" : "inherit",
    cursor: "pointer",
    fontSize: 13,
  };
}

function formatSeconds(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return value.toFixed(0);
}

function formatPct(part?: number | null, total?: number | null) {
  if (
    part === undefined ||
    part === null ||
    total === undefined ||
    total === null ||
    total === 0
  ) {
    return "—";
  }
  const pct = (part / total) * 100;
  return `${pct.toFixed(1)}%`;
}

function formatDuration(value?: number | null) {
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
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function channelSlaLabel(channel: FrontChannelKey) {
  return channel === "livechat" ? "Within 1 min" : "Within 24 hrs";
}

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function AIInsightList({ insights }: { insights: FrontInsight[] }) {
  if (!insights || !insights.length) {
    return <div style={{ opacity: 0.7 }}>No insights available yet.</div>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {insights.slice(0, 8).map((insight) => (
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
          <strong>{insight.title}</strong>: {insight.detail}
          {insight.metric ? ` (${insight.metric})` : null}
        </li>
      ))}
    </ul>
  );
}

function toMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
