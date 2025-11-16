import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMonthlySummaries, getDailyForMonth } from "../services/storage";
import type { MonthlyMetrics, DailyMetrics } from "../types";

export function History() {
  const [months, setMonths] = useState<MonthlyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [daysByMonth, setDaysByMonth] = useState<
    Record<string, DailyMetrics[]>
  >({});
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMonths(await getMonthlySummaries());
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
                    <td colSpan={10} style={{ padding: 0 }}>
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
