import { useState } from "react";
import { computeDailyMetrics, parseCsv } from "../services/metrics";
import type { DailyMetrics, CallRecord } from "../types";
import { saveDailyMetrics } from "../services/storage";
import {
  FIRESTORE_ENABLE_URL,
  FIREBASE_CONFIG_OK,
  MISSING_ENV_KEYS,
} from "../firebase";

export function FileUploader({
  onUploaded,
  onSaved,
}: {
  onUploaded: (metrics: DailyMetrics) => void;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState<string | null>(null);
  const [preview, setPreview] = useState<DailyMetrics | null>(null);
  const [rawRows, setRawRows] = useState<CallRecord[] | null>(null);
  const [includeRecords, setIncludeRecords] = useState(false);
  const [permError, setPermError] = useState<{
    code?: string;
    message?: string;
    url: string;
  } | null>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setSavedOk(null);
    setPermError(null);
    try {
      console.log("[Uploader] Parsing CSV", {
        name: file.name,
        size: file.size,
      });
      const rows = await parseCsv(file);
      console.log("[Uploader] Parsed rows", rows.length);
      setRawRows(rows);
      const metrics = computeDailyMetrics(rows);
      console.log("[Uploader] Computed metrics", metrics);
      setPreview(metrics);
      // Immediately drive KPIs and charts from preview
      onUploaded(metrics);
    } catch (e: any) {
      console.error("[Uploader] Parse/compute error", e);
      setError(e.message || "Failed to parse CSV");
    }
  };

  const onSave = async () => {
    if (!preview) return;
    setBusy(true);
    setSavedOk(null);
    setPermError(null);
    try {
      const rowsToSave = includeRecords ? rawRows || [] : [];
      console.log("[Uploader] onSave start", {
        date: preview.date,
        includeRecords,
        rows: rowsToSave.length,
      });
      await saveDailyMetrics(preview, rowsToSave);
      // Keep top KPIs already in sync from onFile; no-op update but harmless
      onUploaded(preview);
      setSavedOk("Saved to Firestore.");
      onSaved && onSaved();
      setPreview(null);
    } catch (e: any) {
      console.error("[Uploader] onSave error", e);
      const msg = e?.message || "An error occurred while saving the metrics.";
      const code =
        e?.code ||
        (e?.status === "PERMISSION_DENIED" ? "permission-denied" : undefined);
      // Detect permission/API disabled cases and show actionable banner
      const looksLikePermDenied =
        code === "permission-denied" ||
        /permission\s*denied/i.test(msg) ||
        /Cloud Firestore API has not been used|SERVICE_DISABLED|CONSUMER_SUSPENDED/i.test(
          msg
        ) ||
        /projects\/undefined/i.test(msg);
      if (looksLikePermDenied) {
        setPermError({ code, message: msg, url: FIRESTORE_ENABLE_URL });
      }
      setError(msg);
    } finally {
      setBusy(false);
      console.log("[Uploader] onSave end");
    }
  };

  return (
    <div className="panel" style={{ padding: 12, marginBottom: 16 }}>
      {!FIREBASE_CONFIG_OK && (
        <div
          className="panel"
          style={{
            borderColor: "#b91c1c",
            background: "#1f2937",
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>Firebase config missing</strong>
            <div style={{ opacity: 0.85, marginTop: 4 }}>
              Set these env vars in <code>.env.local</code> and restart dev
              server:
              <div style={{ marginTop: 6 }}>{MISSING_ENV_KEYS.join(", ")}</div>
            </div>
          </div>
        </div>
      )}
      {permError && (
        <div
          className="panel"
          style={{
            borderColor: "#b45309",
            background: "#1f2937",
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>Firestore permission issue</strong>
            <div style={{ opacity: 0.85, marginTop: 4 }}>
              {permError.message ||
                "Permission denied while saving. The Firestore API may be disabled or access is blocked."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn"
              type="button"
              onClick={() => window.open(permError.url, "_blank", "noopener")}
            >
              Enable Firestore API
            </button>
            <button
              className="btn"
              type="button"
              onClick={onSave}
              disabled={busy || !preview}
            >
              Retry Save
            </button>
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong>Upload daily CSV</strong>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={includeRecords}
            onChange={(e) => setIncludeRecords(e.target.checked)}
            disabled={busy}
          />
          Save raw records (slower)
        </label>
        <button
          className="btn"
          onClick={onSave}
          disabled={busy || !preview || !FIREBASE_CONFIG_OK}
        >
          Save to Database
        </button>
        {preview && (
          <span style={{ opacity: 0.8 }}>Parsed date: {preview.date}</span>
        )}
      </div>
      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}
      {savedOk && (
        <div style={{ color: "#22c55e", marginTop: 8 }}>{savedOk}</div>
      )}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <strong>Copy/Paste EOD Block</strong>
          <textarea
            style={{ width: "100%", minHeight: 140, marginTop: 6 }}
            readOnly
            value={buildEodBlock(preview)}
          />
        </div>
      )}
    </div>
  );
}

function buildEodBlock(d: DailyMetrics) {
  const missedPct = d.inboundEffective
    ? ((d.missed / d.inboundEffective) * 100).toFixed(1)
    : "0.0";
  const catLines = d.categoryCounts
    .map((c: { name: string; count: number }) => `${c.name},${c.count}`)
    .join("\n");
  return `Calls
Inbound (Effective): ${d.inboundEffective}
Outbound: ${d.outbound}
Missed: ${d.missed} (${missedPct}% Missed)
Answered: ${d.answered}
Avg Wait Time: ${d.avgWaitSeconds.toFixed(1)}s

Top Inbound Agent: ${d.topInboundPerformer?.user || "N/A"} (${
    d.topInboundPerformer?.count || 0
  })

Categories (Top):
${catLines}`;
}
