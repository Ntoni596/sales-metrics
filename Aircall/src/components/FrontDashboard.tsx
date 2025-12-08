import { useMemo, useState } from "react";
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
import { saveFrontSummaries } from "../services/storage";
import type { FrontAnalytics, FrontInsight } from "../types";
import { FIREBASE_CONFIG_OK } from "../firebase";
import { StatCard } from "./StatCard";

export function FrontDashboard() {
  const [analytics, setAnalytics] = useState<FrontAnalytics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
    } catch (err) {
      console.error("[FrontDashboard] save error", err);
      setError(toMessage(err, "Unable to save Front insights."));
    } finally {
      setBusy(false);
    }
  };

  const dailyChartData = useMemo(() => {
    if (!analytics) return [];
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
    if (!analytics) return [];
    return analytics.tags.slice(0, 10);
  }, [analytics]);

  const agentRows = useMemo(() => {
    if (!analytics) return [];
    return analytics.agentSummaries.slice(0, 12);
  }, [analytics]);

  const monthlyRows = useMemo(() => {
    if (!analytics) return [];
    return analytics.monthly.slice(0, 6);
  }, [analytics]);

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

      {analytics ? (
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
                    label={{
                      value: "Chats",
                      angle: -90,
                      position: "insideLeft",
                    }}
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
                    <th style={{ textAlign: "left", padding: 6 }}>
                      After Hours %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.map((agent) => (
                    <tr key={agent.agent}>
                      <td style={{ padding: 6 }}>{agent.agent}</td>
                      <td style={{ padding: 6 }}>{agent.conversations}</td>
                      <td style={{ padding: 6 }}>
                        {formatPct(
                          agent.metResponseTarget,
                          agent.conversations
                        )}
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
                    <th style={{ textAlign: "left", padding: 6 }}>
                      After Hours %
                    </th>
                    <th style={{ textAlign: "left", padding: 6 }}>
                      Top Insight
                    </th>
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

function formatSeconds(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return value.toFixed(0);
}

function formatPct(part: number, total: number) {
  if (!total) return "—";
  const pct = (part / total) * 100;
  return `${pct.toFixed(1)}%`;
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
