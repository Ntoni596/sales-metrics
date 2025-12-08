import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMonthlySummaries,
  getDailyForMonth,
  getFrontMonthlySummaries,
} from "../services/storage";
import type {
  MonthlyMetrics,
  DailyMetrics,
  FrontChannelKey,
  FrontMonthlySummary,
} from "../types";

export function History() {
  const [months, setMonths] = useState<MonthlyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [daysByMonth, setDaysByMonth] = useState<
    Record<string, DailyMetrics[]>
  >({});
  const [frontByMonth, setFrontByMonth] = useState<
    Record<string, FrontMonthlySummary>
  >({});
  const [frontSummariesList, setFrontSummariesList] = useState<
    FrontMonthlySummary[]
  >([]);
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [monthly, frontMonthly] = await Promise.all([
          getMonthlySummaries(),
          getFrontMonthlySummaries().catch((err: unknown) => {
            console.warn("[History] failed to load Front monthly", err);
            return [] as FrontMonthlySummary[];
          }),
        ]);
        setMonths(monthly);
        const filteredFront = frontMonthly.filter(
          (fm): fm is FrontMonthlySummary => !!fm?.month
        );
        const map: Record<string, FrontMonthlySummary> = {};
        for (const fm of filteredFront) {
          if (!fm || !fm.month) continue;
          map[fm.month] = fm;
        }
        setFrontByMonth(map);
        setFrontSummariesList(filteredFront);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading) return <div>Loading history...</div>;
  if (error) return <div style={{ color: "crimson" }}>{error}</div>;
  if (!months.length) return <div>No monthly data yet.</div>;
  return (
    <div style={{ marginTop: 16 }}>
      <h2>Historical Monthly Performance</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <Th> </Th>
            <Th>Month</Th>
            <Th>Days</Th>
            <Th>Front Chats</Th>
            <Th>Inbound (Eff)</Th>
            <Th>Outbound</Th>
            <Th>Answered</Th>
            <Th>Missed</Th>
            <Th>Avg Wait (s)</Th>
            <Th>Inbound MoM %</Th>
            <Th>Answered MoM %</Th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, idx) => {
            const prev = months[idx + 1]; // list is desc sorted
            const inboundMOM = prev
              ? pctChange(prev.inboundEffective, m.inboundEffective)
              : null;
            const answeredMOM = prev
              ? pctChange(prev.answered, m.answered)
              : null;
            return (
              <>
                <tr key={m.month}>
                  <Td>
                    <button
                      className="btn"
                      onClick={async () => {
                        const isOpen = !!expanded[m.month];
                        const next = { ...expanded, [m.month]: !isOpen };
                        setExpanded(next);
                        if (!isOpen && !daysByMonth[m.month]) {
                          const days = await getDailyForMonth(m.month);
                          setDaysByMonth({ ...daysByMonth, [m.month]: days });
                        }
                      }}
                    >
                      {expanded[m.month] ? "−" : "+"}
                    </button>
                  </Td>
                  <Td>
                    <span
                      style={{ textDecoration: "underline", cursor: "pointer" }}
                      onClick={() => navigate(`/history/month/${m.month}`)}
                      title="View month details"
                    >
                      {m.month}
                    </span>
                  </Td>
                  <Td>{m.days}</Td>
                  <Td>{frontByMonth[m.month]?.conversations ?? "—"}</Td>
                  <Td>{m.inboundEffective}</Td>
                  <Td>{m.outbound}</Td>
                  <Td>{m.answered}</Td>
                  <Td>{m.missed}</Td>
                  <Td>{m.avgWaitSeconds.toFixed(1)}</Td>
                  <Td>{inboundMOM !== null ? formatPct(inboundMOM) : "—"}</Td>
                  <Td>{answeredMOM !== null ? formatPct(answeredMOM) : "—"}</Td>
                </tr>
                {expanded[m.month] && daysByMonth[m.month] && (
                  <tr>
                    <td colSpan={11} style={{ padding: 0 }}>
                      <div style={{ padding: 8, background: "#0b0b0b" }}>
                        <table style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              <Th>Date</Th>
                              <Th>Inbound (Eff)</Th>
                              <Th>Answered</Th>
                              <Th>Missed</Th>
                              <Th>Avg Wait (s)</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {daysByMonth[m.month].map((d) => (
                              <tr
                                key={d.date}
                                style={{ cursor: "pointer" }}
                                onClick={() => navigate(`/history/${d.date}`)}
                              >
                                <Td>{d.date}</Td>
                                <Td>{d.inboundEffective}</Td>
                                <Td>{d.answered}</Td>
                                <Td>{d.missed}</Td>
                                <Td>{d.avgWaitSeconds.toFixed(1)}</Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      <div className="panel" style={{ marginTop: 24 }}>
        <h3>Front Communications</h3>
        {frontSummariesList.length ? (
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              marginTop: 12,
            }}
          >
            <FrontChannelTable
              title="Live Chat"
              channel="livechat"
              summaries={frontSummariesList}
              lookup={frontByMonth}
            />
            <FrontChannelTable
              title="Email"
              channel="email"
              summaries={frontSummariesList}
              lookup={frontByMonth}
            />
          </div>
        ) : (
          <div style={{ opacity: 0.75, marginTop: 8 }}>
            No Front communication data saved yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: any }) {
  return (
    <th
      style={{
        borderBottom: "1px solid #ccc",
        textAlign: "left",
        padding: 6,
        fontSize: 12,
      }}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: any }) {
  return (
    <td style={{ borderBottom: "1px solid #eee", padding: 6, fontSize: 12 }}>
      {children}
    </td>
  );
}

function pctChange(oldV: number, newV: number) {
  if (oldV === 0) return newV === 0 ? 0 : 100; // treat jump from 0 as 100%
  return ((newV - oldV) / oldV) * 100;
}
function formatPct(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

function formatSecondsValue(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  const totalSeconds = Math.round(value);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function prevMonthKey(month: string) {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const date = new Date(Date.UTC(y, m - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  const nextY = date.getUTCFullYear();
  const nextM = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextY}-${nextM}`;
}

function prevYearSameMonthKey(month: string) {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  return `${y - 1}-${String(m).padStart(2, "0")}`;
}

function channelSlaLabel(channel: FrontChannelKey) {
  return channel === "livechat" ? "Within 1 min %" : "Within 24 hrs %";
}

function FrontChannelTable({
  title,
  channel,
  summaries,
  lookup,
}: {
  title: string;
  channel: FrontChannelKey;
  summaries: FrontMonthlySummary[];
  lookup: Record<string, FrontMonthlySummary>;
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
      <h4 style={{ marginTop: 0 }}>{title}</h4>
      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 6 }}>Month</th>
            <th style={{ textAlign: "left", padding: 6 }}>Conversations</th>
            <th style={{ textAlign: "left", padding: 6 }}>MoM %</th>
            <th style={{ textAlign: "left", padding: 6 }}>YoY %</th>
            <th style={{ textAlign: "left", padding: 6 }}>
              Avg First Response (s)
            </th>
            <th style={{ textAlign: "left", padding: 6 }}>
              {channelSlaLabel(channel)}
            </th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => {
            const stats = summary.channels?.[channel];
            const conversations = stats?.conversations ?? null;
            const prev = lookup[prevMonthKey(summary.month)];
            const prevStats = prev?.channels?.[channel];
            const mom =
              conversations !== null && prevStats?.conversations !== undefined
                ? pctChange(prevStats.conversations, conversations)
                : null;
            const prevYear = lookup[prevYearSameMonthKey(summary.month)];
            const prevYearStats = prevYear?.channels?.[channel];
            const yoy =
              conversations !== null &&
              prevYearStats?.conversations !== undefined
                ? pctChange(prevYearStats.conversations, conversations)
                : null;
            const avgFirstResponse = stats?.avgFirstResponseSeconds ?? null;
            const withinTargetPct =
              stats && stats.conversations
                ? (stats.metResponseTarget / stats.conversations) * 100
                : null;
            return (
              <tr key={`${channel}-${summary.month}`}>
                <td style={{ padding: 6 }}>{summary.month}</td>
                <td style={{ padding: 6 }}>{conversations ?? "—"}</td>
                <td style={{ padding: 6 }}>
                  {mom !== null ? formatPct(mom) : "—"}
                </td>
                <td style={{ padding: 6 }}>
                  {yoy !== null ? formatPct(yoy) : "—"}
                </td>
                <td style={{ padding: 6 }}>
                  {formatSecondsValue(avgFirstResponse)}
                </td>
                <td style={{ padding: 6 }}>{formatPercent(withinTargetPct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
