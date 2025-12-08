import { useState, useMemo, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import { Sidebar } from "./layout/Sidebar";
import { Topbar } from "./layout/Topbar";
import { FileUploader } from "./components/FileUploader";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdmin } from "./components/RequireAdmin";
import { AdminUsers } from "./components/AdminUsers";
import { Login } from "./components/Login";
import { History } from "./components/History";
import { HistoryDay } from "./components/HistoryDay";
import { AgentsPage } from "./components/AgentsPage";
import { HistoryMonth } from "./components/HistoryMonth";
import { AgentMetrics } from "./components/AgentMetrics";
import { BootstrapAdmin } from "./components/BootstrapAdmin";
import { ShowroomDashboard } from "./components/ShowroomDashboard";
import { BulkImport } from "./components/BulkImport";
import { CsvHeaderSettings } from "./components/CsvHeaderSettings";
import { CsvFormatGuide } from "./components/CsvFormatGuide";
import { CsvTester } from "./components/CsvTester";
import CsvParsingTest from "./components/CsvParsingTest";
import {
  MissedBreakdownChart,
  CallPerformanceChart,
} from "./components/Charts";
import { StatCard } from "./components/StatCard";
import { KpiBars } from "./components/KpiBars";
import type { DailyMetrics } from "./types";
import { getLatestDaily } from "./services/storage";
import { AgentFilter, DEFAULT_AGENTS } from "./components/AgentFilter";
import { CategoryBar } from "./components/TagSummary";

function App() {
  const [latest, setLatest] = useState<DailyMetrics | null>(null);
  const [selectedAgents, setSelectedAgents] =
    useState<string[]>(DEFAULT_AGENTS);

  // On first load, hydrate KPIs from the latest saved daily summary
  useEffect(() => {
    (async () => {
      try {
        const d = await getLatestDaily();
        if (d) setLatest(d);
      } catch {
        // ignore — user can upload a CSV to populate
      }
    })();
  }, []);

  const display = useMemo(() => {
    if (!latest) return null;
    if (!selectedAgents.length)
      return {
        ...latest,
        inboundEffective: 0,
        outbound: 0,
        answered: 0,
        missed: 0,
        avgWaitSeconds: 0,
        topInboundPerformer: undefined,
      } as DailyMetrics;
    const subset = latest.agentStats.filter((a) =>
      selectedAgents.includes(a.user)
    );
    const inboundAnswered = subset.reduce((s, a) => s + a.inboundAnswered, 0);
    const inboundMissed = subset.reduce((s, a) => s + a.inboundMissed, 0);
    const outbound = subset.reduce((s, a) => s + a.outbound, 0);
    const inboundEffective = inboundAnswered + inboundMissed;
    const waitTotal = subset.reduce(
      (s, a) => s + (a.inboundAnsweredWaitTotal || 0),
      0
    );
    const waitCount = subset.reduce(
      (s, a) => s + (a.inboundAnsweredWaitCount || 0),
      0
    );
    const avgWaitSeconds = waitCount ? waitTotal / waitCount : 0;
    const top = subset.length
      ? subset.slice().sort((a, b) => b.inboundAnswered - a.inboundAnswered)[0]
      : undefined;
    return {
      ...latest,
      inboundEffective,
      outbound,
      answered: inboundAnswered,
      missed: inboundMissed,
      avgWaitSeconds,
      topInboundPerformer: top
        ? { user: top.user, count: top.inboundAnswered }
        : undefined,
      agentStats: subset,
    } as DailyMetrics;
  }, [latest, selectedAgents]);

  const kpis = useMemo(() => {
    const lm = display;
    if (!lm) return [];
    const answeredPct = lm.inboundEffective
      ? (lm.answered / lm.inboundEffective) * 100
      : 0;
    const missedPct = lm.inboundEffective
      ? (lm.missed / lm.inboundEffective) * 100
      : 0;
    const answeredTone: "normal" | "warn" | "danger" =
      answeredPct >= 85 ? "normal" : answeredPct >= 70 ? "warn" : "danger";
    const missedTone: "normal" | "warn" | "danger" =
      missedPct <= 10 ? "normal" : missedPct <= 20 ? "warn" : "danger";
    const waitPct = Math.min(100, (lm.avgWaitSeconds / 120) * 100);
    const waitTone: "normal" | "warn" | "danger" =
      lm.avgWaitSeconds <= 60
        ? "normal"
        : lm.avgWaitSeconds <= 90
        ? "warn"
        : "danger";
    return [
      {
        label: "Answered %",
        value: answeredPct,
        target: "90%",
        tone: answeredTone,
      },
      {
        label: "Missed %",
        value: missedPct,
        target: "<=10%",
        tone: missedTone,
      },
      { label: "Avg Wait (s)", value: waitPct, target: "<60s", tone: waitTone },
    ];
  }, [display]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className='layout'>
        <Sidebar />
        <div className='content'>
          <Topbar latest={display} />
          <div style={{ padding: "24px" }}>
            <Routes>
              <Route path='/login' element={<Login />} />
              <Route
                path='/'
                element={
                  <RequireAuth>
                    <div>
                      <div style={{ marginTop: 0 }}>
                        <CsvFormatGuide />
                        <FileUploader onUploaded={(m) => setLatest(m)} />
                        {/* <div className="panel" style={{ marginTop: 24 }}>
                        <DailySummary
                          data={display}
                          title="Today Summary (Filtered)"
                        />
                      </div> */}
                      </div>
                      <AgentFilter
                        selected={selectedAgents}
                        onChange={setSelectedAgents}
                        availableAgents={latest?.agentStats.map((a) => a.user)}
                      />
                      <div className='cards-row'>
                        <StatCard
                          title='Inbound'
                          value={display?.inboundEffective ?? "—"}
                        />
                        <StatCard
                          title='Outbound'
                          value={display?.outbound ?? "—"}
                        />
                        <StatCard
                          title='Answered'
                          value={display?.answered ?? "—"}
                        />
                        <StatCard
                          title='Missed'
                          value={display?.missed ?? "—"}
                          delta={
                            display
                              ? (
                                  (display.missed /
                                    (display.inboundEffective || 1)) *
                                  100
                                ).toFixed(1) + "%"
                              : ""
                          }
                        />
                        <StatCard
                          title='Avg Wait (s)'
                          value={
                            display ? display.avgWaitSeconds.toFixed(1) : "—"
                          }
                        />
                        <StatCard
                          title='Top Inbound'
                          value={
                            display
                              ? display.topInboundPerformer?.user || "—"
                              : "—"
                          }
                          footer={
                            display?.topInboundPerformer
                              ? display.topInboundPerformer.count + " answered"
                              : null
                          }
                        />
                      </div>
                      {display && (
                        <div className='panel' style={{ marginTop: 16 }}>
                          <h3>Top Categories</h3>
                          <CategoryBar
                            categories={display.categoryCounts.slice(0, 10)}
                          />
                        </div>
                      )}
                      {display && (
                        <>
                          <div className='chart-row mt24'>
                            <div className='panel'>
                              <h3>Missed Breakdown</h3>
                              <MissedBreakdownChart data={display} />
                            </div>
                            <div className='panel'>
                              <h3>Call Performance</h3>
                              <CallPerformanceChart data={display} />
                            </div>
                            <div className='panel'>
                              <AgentMetrics
                                data={display}
                                onlyAgents={selectedAgents}
                              />
                            </div>
                          </div>
                          <div className='panel mt24'>
                            <h3>KPIs</h3>
                            <KpiBars items={kpis} />
                          </div>
                        </>
                      )}
                    </div>
                  </RequireAuth>
                }
              />
              <Route
                path='/history'
                element={
                  <RequireAuth>
                    <History />
                  </RequireAuth>
                }
              />
              <Route
                path='/history/month/:month'
                element={
                  <RequireAuth>
                    <HistoryMonth />
                  </RequireAuth>
                }
              />
              <Route
                path='/history/:date'
                element={
                  <RequireAuth>
                    <HistoryDay />
                  </RequireAuth>
                }
              />
              <Route
                path='/agents'
                element={
                  <RequireAuth>
                    <AgentsPage />
                  </RequireAuth>
                }
              />
              <Route
                path='/import/bulk'
                element={
                  <RequireAuth>
                    <BulkImport />
                  </RequireAuth>
                }
              />
              <Route
                path='/showroom'
                element={
                  <RequireAuth>
                    <ShowroomDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path='/admin/users'
                element={
                  <RequireAdmin>
                    <AdminUsers />
                  </RequireAdmin>
                }
              />
              <Route
                path='/bootstrap'
                element={
                  <RequireAuth>
                    <BootstrapAdmin />
                  </RequireAuth>
                }
              />
              <Route
                path='/settings/csv-headers'
                element={
                  <RequireAuth>
                    <CsvHeaderSettings />
                  </RequireAuth>
                }
              />
              <Route
                path='/settings/csv-tester'
                element={
                  <RequireAuth>
                    <CsvTester />
                  </RequireAuth>
                }
              />
              <Route
                path='/debug/parsing-test'
                element={
                  <RequireAuth>
                    <CsvParsingTest />
                  </RequireAuth>
                }
              />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
