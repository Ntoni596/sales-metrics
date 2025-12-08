import { useMemo, useState } from "react";
import { parseCsv, computeDailyMetrics } from "../services/metrics";
import type { CallRecord, DailyMetrics } from "../types";
import { getDailyByDate, saveDailyMetrics } from "../services/storage";
import { CsvHeaderAnalyzer } from "./CsvHeaderAnalyzer";
import { CsvFormatGuide } from "./CsvFormatGuide";

function normalizeDate(ts: string): string {
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m1 = ts.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = ts.match(/^(\d{2})\-(\d{2})\-(\d{4})/);
  if (m2) return `${m2[3]}-${m2[1]}-${m2[2]}`;
  return ts.slice(0, 10);
}

export function BulkImport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, DailyMetrics> | null>(
    null
  );
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function onFile(file?: File) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const rows = await parseCsv(file);
      // Group records by date
      const byDate = new Map<string, CallRecord[]>();
      for (const r of rows) {
        const date = normalizeDate(r.timestamp);
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(r);
      }
      // Compute daily metrics for each group
      const summary: Record<string, DailyMetrics> = {};
      for (const [date, group] of byDate) {
        const metrics = computeDailyMetrics(group);
        summary[date] = metrics;
      }
      // Probe which days already exist to avoid duplicates
      const existsSet = new Set<string>();
      const dates = Object.keys(summary);
      for (const d of dates) {
        // eslint-disable-next-line no-await-in-loop
        const doc = await getDailyByDate(d);
        if (doc) existsSet.add(d);
      }
      setExisting(existsSet);
      setPreview(summary);
    } catch (e: any) {
      setError(e?.message || "Failed to parse CSV");
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    if (!preview) return null;
    const dates = Object.keys(preview).sort();
    const total = dates.length;
    const already = dates.filter((d) => existing.has(d)).length;
    const toSave = total - already;
    return {
      total,
      already,
      toSave,
      first: dates[0],
      last: dates[dates.length - 1],
    };
  }, [preview, existing]);

  async function onSave() {
    if (!preview || !stats) return;
    setBusy(true);
    setError(null);
    setSavedCount(0);
    try {
      const dates = Object.keys(preview).sort();
      for (const d of dates) {
        if (existing.has(d)) continue; // skip duplicates
        const day = preview[d];
        // eslint-disable-next-line no-await-in-loop
        await saveDailyMetrics(day, []);
        setSavedCount((c) => c + 1);
      }
    } catch (e: any) {
      setError(e?.message || "Failed while saving one of the days");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CsvFormatGuide />
      <div className='panel' style={{ padding: 16 }}>
        <h3>Bulk Import (one-time)</h3>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type='file'
            accept='.csv,text/csv'
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
                onFile(file);
              }
            }}
          />
          {stats && (
            <>
              <span>
                Days detected: <strong>{stats.total}</strong> (existing:{" "}
                {stats.already}, new: {stats.toSave})
              </span>
              <span>
                Range: {stats.first} → {stats.last}
              </span>
              <button onClick={onSave} disabled={busy || stats.toSave === 0}>
                Save {stats.toSave} day{stats.toSave === 1 ? "" : "s"}
              </button>
            </>
          )}
          {busy && <span>Processing…</span>}
        </div>
        {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}
        {savedCount > 0 && (
          <div style={{ color: "#22c55e", marginTop: 8 }}>
            Saved {savedCount} day{savedCount === 1 ? "" : "s"}.
          </div>
        )}

        <CsvHeaderAnalyzer file={selectedFile} />
      </div>
    </>
  );
}
