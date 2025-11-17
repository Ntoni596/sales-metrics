import { useEffect, useMemo, useState } from "react";
import {
  parseShowroomCsv,
  computeShowroomMonthly,
  type ShowroomMonthlyStats,
  saveShowroomDaily,
  fetchShowroomMonthlyFromFirestore,
} from "../services/showroom";
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

export function ShowroomDashboard() {
  const [monthly, setMonthly] = useState<ShowroomMonthlyStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const [pendingRows, setPendingRows] = useState<number>(0);
  const [uploaded, setUploaded] = useState<any[] | null>(null);

  useEffect(() => {
    // Load any saved showroom data on page open
    (async () => {
      try {
        setBusy(true);
        const m = await fetchShowroomMonthlyFromFirestore();
        if (m && m.length) setMonthly(m);
      } catch (e: any) {
        console.warn("[Showroom] load firestore failed", e?.message || e);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const rows = await parseShowroomCsv(file);
      const m = computeShowroomMonthly(rows);
      setMonthly(m);
      setUploaded(rows);
      // Unique days count (for Save preview)
      setPendingRows(new Set(rows.map((r) => r.dueDate)).size);
    } catch (e: any) {
      setError(e?.message || "Failed to parse CSV");
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!uploaded || !uploaded.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await saveShowroomDaily(uploaded as any);
      // Refresh from Firestore so the view reflects persisted data
      const m = await fetchShowroomMonthlyFromFirestore();
      setMonthly(m);
      setPendingRows(0);
      setUploaded(null);
      console.log("[Showroom] saved days:", res.daysUpserted);
    } catch (e: any) {
      setError(e?.message || "Failed to save showroom data");
    } finally {
      setBusy(false);
    }
  }

  const convSeries = useMemo(() => {
    return (
      monthly?.map((m) => ({
        month: m.month,
        Aftershock: Number(m.aftershockConversionRate.toFixed(1)),
        Omnidesk: Number(m.omnideskConversionRate.toFixed(1)),
      })) || []
    );
  }, [monthly]);

  const asCounts = useMemo(
    () =>
      monthly?.map((m) => ({
        month: m.month,
        Conversations: m.aftershockConversations,
        Sales: m.aftershockSales,
      })) || [],
    [monthly]
  );

  const odCounts = useMemo(
    () =>
      monthly?.map((m) => ({
        month: m.month,
        Visitors: m.omnideskVisitors,
        Sales: m.omnideskSales,
      })) || [],
    [monthly]
  );

  const displayMonthly = useMemo(() => {
    if (!monthly) return [] as ShowroomMonthlyStats[];
    const copy = [...monthly];
    copy.sort((a, b) =>
      newestFirst
        ? b.month.localeCompare(a.month)
        : a.month.localeCompare(b.month)
    );
    return copy;
  }, [monthly, newestFirst]);

  const nf = useMemo(() => new Intl.NumberFormat(undefined), []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Showroom Monthly Dashboard</h2>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <strong>Upload Showroom CSV</strong>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {busy && <span>Processing…</span>}
        {error && <span style={{ color: "crimson" }}>{error}</span>}
        {monthly && (
          <label style={{ marginLeft: 8, display: "inline-flex", gap: 6 }}>
            <input
              type="checkbox"
              checked={newestFirst}
              onChange={(e) => setNewestFirst(e.target.checked)}
            />
            Newest first
          </label>
        )}
        {uploaded && (
          <button onClick={onSave} disabled={busy}>
            Save {pendingRows} day{pendingRows === 1 ? "" : "s"} to Firestore
          </button>
        )}
        <button
          disabled={busy}
          onClick={async () => {
            try {
              setBusy(true);
              const m = await fetchShowroomMonthlyFromFirestore();
              setMonthly(m);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load saved
        </button>
      </div>

      {monthly && monthly.length > 0 && (
        <>
          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Conversion Rate (%)</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart
                  data={convSeries}
                  margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Aftershock"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Omnidesk"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-row mt24">
            <div className="panel">
              <h3>Aftershock: Conversations vs Sales</h3>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={asCounts}
                    margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Conversations" fill="#a78bfa" />
                    <Bar dataKey="Sales" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <h3>Omnidesk: Visitors vs Sales</h3>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={odCounts}
                    margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Visitors" fill="#f59e0b" />
                    <Bar dataKey="Sales" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="panel mt24">
            <h3>Monthly Summary</h3>
            <div className="scroll-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">AS Conversations</th>
                    <th className="num">AS Sales</th>
                    <th className="num">AS Conv %</th>
                    <th className="num">OD Visitors</th>
                    <th className="num">OD Sales</th>
                    <th className="num">OD Conv %</th>
                  </tr>
                </thead>
                <tbody>
                  {displayMonthly.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td className="num">
                        {nf.format(m.aftershockConversations)}
                      </td>
                      <td className="num">{nf.format(m.aftershockSales)}</td>
                      <td className="num">
                        {m.aftershockConversionRate.toFixed(1)}%
                      </td>
                      <td className="num">{nf.format(m.omnideskVisitors)}</td>
                      <td className="num">{nf.format(m.omnideskSales)}</td>
                      <td className="num">
                        {m.omnideskConversionRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
