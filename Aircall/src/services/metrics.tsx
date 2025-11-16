import Papa from "papaparse";
import type { CallRecord, DailyMetrics, AgentStats } from "../types";

interface RawRow {
  [key: string]: string | undefined;
}

// Parse CSV with flexible header support
export async function parseCsv(file: File): Promise<CallRecord[]> {
  const text = await file.text();
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error("CSV parse error: " + parsed.errors[0].message);
  }
  const rows: CallRecord[] = [];
  const parseDurationToSeconds = (v?: string): number | undefined => {
    if (!v) return undefined;
    const s = v.toString().trim();
    if (!s) return undefined;
    // Accept numeric seconds possibly with commas
    const num = s.replace(/,/g, "");
    if (/^\d+(?:\.\d+)?$/.test(num)) return Number(num);
    // Accept HH:MM:SS or MM:SS
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const parts = s.split(":").map((p) => Number(p));
      if (parts.length === 2) {
        const [mm, ss] = parts;
        return mm * 60 + ss;
      }
      const [hh, mm, ss] = parts as [number, number, number];
      return hh * 3600 + mm * 60 + ss;
    }
    return undefined;
  };
  for (const r of parsed.data) {
    if (!r) continue;
    // Direction
    const directionSource =
      (r["Direction"] as string) ||
      (r["direction"] as string) ||
      (r["Call direction - type"] as string) ||
      "";
    const directionLower = directionSource.toLowerCase();
    let direction: "inbound" | "outbound" = directionLower.includes("out")
      ? "outbound"
      : "inbound";
    if (!directionSource) {
      // Fallback: parse from "Inbound - Answered" style
      const type = (r["Call direction - type"] || "").toString().toLowerCase();
      if (type.startsWith("out")) direction = "outbound";
      else if (type.startsWith("in")) direction = "inbound";
    }

    // Answered
    const answeredRaw = (
      (r["answered"] as string) ||
      (r["Answered"] as string) ||
      (r["Call Type"] as string) ||
      (r["Call Status"] as string) ||
      (r["Status"] as string) ||
      ""
    ).toString();
    const answered = /^(yes|true|answered|completed)$/i.test(answeredRaw);
    let missedReason: CallRecord["missedReason"] | undefined;
    // Missed reason mapping from Aircall canonical values with fallbacks
    if (!answered) {
      const missedReasonRaw = (
        (r["missed_call_reason"] as string) ||
        (r["Missed cause"] as string) ||
        ""
      )
        .toString()
        .trim()
        .toLowerCase();

      switch (missedReasonRaw) {
        case "outside_business_hours":
        case "outside business hours":
        case "out_of_opening_hours":
          missedReason = "outside_hours";
          break;
        case "short_abandon":
        case "abandoned":
        case "abandon":
        case "abandoned_in_ivr":
          missedReason = "abandoned"; // treat short abandon as abandoned
          break;
        case "no_active_agent":
        case "no agent available":
        case "no_available_agent":
        case "busy":
          missedReason = "agent_unavailable";
          break;
        case "no_answer":
        case "did not answer":
        case "agent did not answer":
          missedReason = "agent_no_answer";
          break;
        default: {
          const mLower = missedReasonRaw;
          if (/(outside|business\s*hours)/.test(mLower))
            missedReason = "outside_hours";
          else if (/(short_)?abandon|ivr/.test(mLower))
            missedReason = "abandoned";
          else if (/no\s*agent|no_active_agent|busy/.test(mLower))
            missedReason = "agent_unavailable";
          else if (/(did not answer|no\s*answer)/.test(mLower))
            missedReason = "agent_no_answer";
        }
      }

      // Secondary inference: if no explicit reason, try Disconnected By
      if (!missedReason) {
        const disc = (r["Disconnected By"] as string)?.toString().toLowerCase();
        if (disc === "external") missedReason = "abandoned";
      }
    }
    const user = (
      (r["Agent"] as string) ||
      (r["User"] as string) ||
      (r["user"] as string) ||
      (r["Owner"] as string) ||
      (r["Answered By"] as string) ||
      "[No associated user]"
    )
      .toString()
      .trim();

    // Wait time parsing (prefer specific queue-related columns)
    const waitStr =
      (r["Wait Time (s)"] as string) ||
      (r["Waiting time (s)"] as string) ||
      (r["Waiting time"] as string) ||
      (r["Waiting Time"] as string) ||
      (r["Time to answer"] as string) ||
      (r["wait"] as string) ||
      (r["queue_time"] as string) ||
      "";
    const waitSeconds = parseDurationToSeconds(waitStr);

    const tagsRaw = (
      (r["Tags"] as string) ||
      (r["tags"] as string) ||
      (r["Tag"] as string) ||
      (r["Labels"] as string) ||
      ""
    ).toString();
    const tags = tagsRaw
      ? tagsRaw
          .split(/[,;|/]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

    // Timestamp detection
    let timestamp = (
      r["Time"] ||
      r["Timestamp"] ||
      r["Date"] ||
      r["datetime (UTC)"] ||
      r["Call start time"] ||
      r["Started At"] ||
      r["Started at"] ||
      r["Start Time"] ||
      r["Call Started At"] ||
      r["Created At"] ||
      r["Date/Time"] ||
      r["Call Date"] ||
      ""
    )
      ?.toString()
      .trim();
    if (!timestamp) {
      for (const v of Object.values(r)) {
        if (!v) continue;
        const val = v.toString().trim();
        if (/\d{4}-\d{2}-\d{2}/.test(val) || /\d{2}\/\d{2}\/\d{4}/.test(val)) {
          timestamp = val;
          break;
        }
      }
    }
    if (!timestamp) continue; // skip rows without any time reference
    rows.push({
      timestamp,
      direction,
      answered,
      missedReason,
      user,
      waitSeconds,
      tags,
    });
  }
  if (!rows.length) {
    throw new Error(
      "No records found. Ensure your CSV includes a timestamp column (Time, Timestamp, Date, Started At)."
    );
  }
  return rows;
}

function dateFromTimestamp(ts: string): string {
  // Normalize various date formats to YYYY-MM-DD
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // Match DD/MM/YYYY
  const m1 = ts.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // Match MM/DD/YYYY
  const m2 = ts.match(/^(\d{2})\-(\d{2})\-(\d{4})/);
  if (m2) return `${m2[3]}-${m2[1]}-${m2[2]}`;
  return ts.slice(0, 10);
}

export function computeDailyMetrics(records: CallRecord[]): DailyMetrics {
  if (!records.length) {
    throw new Error("No records found in CSV.");
  }
  const date = dateFromTimestamp(records[0].timestamp);
  let inboundRaw = 0;
  let outbound = 0;
  // We treat "answered" as INBOUND answered only for summary consistency
  let inboundAnswered = 0;
  // Agent-responsibility missed inbound (excludes outside hours and caller-abandoned)
  let inboundMissedAgent = 0;
  // Additional inbound categories used to compute effective inbound
  let inboundOutside = 0;
  let inboundAbandoned = 0;
  const missedBreakdown: Record<string, number> = {};
  let waitTotal = 0;
  let waitCount = 0;
  const agentMap: Record<string, AgentStats> = {};
  const categoryCounts: Record<string, number> = {};

  for (const r of records) {
    if (dateFromTimestamp(r.timestamp) !== date) continue; // ignore other days if file spans multiple
    if (r.direction === "inbound") {
      inboundRaw++;
      if (r.answered) {
        inboundAnswered++;
        if (r.waitSeconds != null) {
          waitTotal += r.waitSeconds;
          waitCount++;
        }
      } else {
        // classify missed inbound reasons
        if (r.missedReason) {
          missedBreakdown[r.missedReason] =
            (missedBreakdown[r.missedReason] || 0) + 1;
        }
        if (r.missedReason === "outside_hours") {
          inboundOutside++;
        } else if (r.missedReason === "abandoned") {
          // Includes IVR/early-abandon; we don't count these as agent-missed
          inboundAbandoned++;
        } else if (
          r.missedReason === "agent_unavailable" ||
          r.missedReason === "agent_no_answer"
        ) {
          inboundMissedAgent++;
        } else {
          // Unknown reason but still inbound not answered — treat as agent-missed fallback
          inboundMissedAgent++;
        }
      }
    } else {
      // outbound
      outbound++;
      // We do not include outbound in answered/missed KPIs
    }
    if (!agentMap[r.user]) {
      agentMap[r.user] = {
        user: r.user,
        inboundAnswered: 0,
        inboundMissed: 0,
        outbound: 0,
        totalHandled: 0,
        avgWaitSeconds: 0,
        inboundAnsweredWaitTotal: 0,
        inboundAnsweredWaitCount: 0,
      };
    }
    const a = agentMap[r.user];
    if (r.direction === "inbound") {
      if (r.answered) a.inboundAnswered++;
      else {
        // Count only agent-responsibility missed for per-agent stat
        if (
          r.missedReason === "agent_unavailable" ||
          r.missedReason === "agent_no_answer" ||
          !r.missedReason // unknown reason → treat as agent-responsibility
        ) {
          a.inboundMissed++;
        }
        // outside_hours and abandoned are excluded from agent missed
      }
    } else if (r.direction === "outbound") {
      if (r.answered) a.outbound++; // count only successful outbound answered
    }
    if (r.answered) {
      a.totalHandled++;
      if (r.waitSeconds != null) {
        a.avgWaitSeconds =
          ((a.avgWaitSeconds || 0) * (a.totalHandled - 1) + r.waitSeconds) /
          a.totalHandled;
      }
    }
    // Track inbound answered wait specifically for accurate averages
    if (r.direction === "inbound" && r.answered && r.waitSeconds != null) {
      a.inboundAnsweredWaitTotal =
        (a.inboundAnsweredWaitTotal || 0) + r.waitSeconds;
      a.inboundAnsweredWaitCount = (a.inboundAnsweredWaitCount || 0) + 1;
    }
    for (const tag of r.tags) {
      categoryCounts[tag] = (categoryCounts[tag] || 0) + 1;
    }
  }

  // Effective inbound are those that reached agents: answered + agent-missed
  const inboundEffective = inboundAnswered + inboundMissedAgent;
  const avgWaitSeconds = waitCount ? waitTotal / waitCount : 0;
  const agentStats = Object.values(agentMap).sort(
    (a, b) => b.inboundAnswered - a.inboundAnswered
  );
  const topInboundPerformer = agentStats.length
    ? { user: agentStats[0].user, count: agentStats[0].inboundAnswered }
    : undefined;
  const categoryCountsArr = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    date,
    inboundRaw,
    inboundEffective,
    outbound,
    answered: inboundAnswered,
    missed: inboundMissedAgent,
    missedBreakdown,
    answerable: inboundEffective,
    avgWaitSeconds,
    topInboundPerformer,
    agentStats,
    categoryCounts: categoryCountsArr,
    recordsStored: records.length,
  };
}
