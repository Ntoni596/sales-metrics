import Papa from "papaparse";
import type { CallRecord, DailyMetrics, AgentStats } from "../types";
import { loadCsvConfig, findMatchingHeader } from "./csvConfig";

interface RawRow {
  [key: string]: string | undefined;
}

// Parse CSV with configurable header support
export async function parseCsv(file: File): Promise<CallRecord[]> {
  const text = await file.text();
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error("CSV parse error: " + parsed.errors[0].message);
  }

  // Load CSV configuration
  const csvConfig = await loadCsvConfig();
  const availableHeaders = Object.keys(parsed.data[0] || {});

  // Find matching headers using configuration
  const getFieldValue = (fieldMappings: string[]) => {
    const header = findMatchingHeader(availableHeaders, fieldMappings);
    return header;
  };

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

  // Find headers using configuration
  const timestampHeader = getFieldValue(csvConfig.timestamp);
  const directionHeader = getFieldValue(csvConfig.direction);
  const answeredHeader = getFieldValue(csvConfig.answered);
  const missedReasonHeader = getFieldValue(csvConfig.missedReason);
  const userHeader = getFieldValue(csvConfig.user);
  const waitTimeHeader = getFieldValue(csvConfig.waitTime);
  const tagsHeader = getFieldValue(csvConfig.tags);

  for (const r of parsed.data) {
    if (!r) continue;

    // Direction
    const directionSource = directionHeader
      ? (r[directionHeader] as string) || ""
      : "";
    const directionLower = directionSource.toLowerCase();
    let direction: "inbound" | "outbound" = directionLower.includes("out")
      ? "outbound"
      : "inbound";

    if (!directionSource) {
      // Fallback: try to detect from call direction type patterns
      const typeHeader = getFieldValue(["call direction - type", "Call Type"]);
      const type = typeHeader
        ? (r[typeHeader] || "").toString().toLowerCase()
        : "";
      if (type.startsWith("out")) direction = "outbound";
      else if (type.startsWith("in")) direction = "inbound";
    }

    // Answered
    const answeredRaw = answeredHeader
      ? (r[answeredHeader] as string) || ""
      : "";
    const answered = /^(yes|true|answered|completed|1)$/i.test(
      answeredRaw.toString()
    );

    let missedReason: CallRecord["missedReason"] | undefined;
    // Missed reason mapping from Aircall canonical values with fallbacks
    if (!answered) {
      const missedReasonRaw = missedReasonHeader
        ? (r[missedReasonHeader] as string) || ""
        : "";
      const normalizedReason = missedReasonRaw.toString().trim().toLowerCase();

      switch (normalizedReason) {
        case "outside_business_hours":
        case "outside business hours":
        case "out_of_opening_hours":
          missedReason = "outside_hours";
          break;
        case "short_abandon":
        case "abandoned":
        case "abandon":
        case "abandoned_in_ivr":
          missedReason = "abandoned";
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
        case "agents_did_not_answer": // Aircall format
          missedReason = "agent_no_answer";
          break;
        default: {
          if (
            /(outside|business\s*hours|out_of_opening_hours)/.test(
              normalizedReason
            )
          )
            missedReason = "outside_hours";
          else if (
            /(short_)?abandon|ivr|short_abandoned/.test(normalizedReason)
          )
            missedReason = "abandoned";
          else if (
            /no\s*agent|no_active_agent|no_available_agent|busy/.test(
              normalizedReason
            )
          )
            missedReason = "agent_unavailable";
          else if (
            /(did not answer|no\s*answer|agents_did_not_answer)/.test(
              normalizedReason
            )
          )
            missedReason = "agent_no_answer";
        }
      }

      // Secondary inference: try Disconnected By if configured
      if (!missedReason) {
        const disconnectedByHeader = getFieldValue(csvConfig.disconnectedBy);
        const disc = disconnectedByHeader
          ? (r[disconnectedByHeader] as string)?.toString().toLowerCase()
          : "";
        if (disc === "external") missedReason = "abandoned";
      }
    }

    let user = userHeader
      ? (r[userHeader] as string) || "[No associated user]"
      : "[No associated user]";

    // Clean up user field
    user = user.trim();
    if (user === "" || user.toLowerCase() === "n/a" || user === "-") {
      user = "[No associated user]";
    }

    // Wait time parsing
    const waitStr = waitTimeHeader ? (r[waitTimeHeader] as string) || "" : "";
    const waitSeconds = parseDurationToSeconds(waitStr);

    const tagsRaw = tagsHeader ? (r[tagsHeader] as string) || "" : "";
    const tags = tagsRaw
      ? tagsRaw
          .split(/[,;|/]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && t !== "-" && t.toLowerCase() !== "n/a")
      : [];

    // For Aircall exports, the "line" field often contains the call category
    const lineHeader = getFieldValue(["line", "Line"]);
    if (lineHeader && r[lineHeader]) {
      const lineValue = (r[lineHeader] as string).trim();
      if (lineValue && lineValue !== "-" && lineValue.length > 0) {
        // Extract category from line names like "Sales (Purchase Enquiry)"
        const lineMatch = lineValue.match(/\(([^)]+)\)/);
        if (lineMatch) {
          tags.push(lineMatch[1]);
        }
      }
    }

    // Timestamp detection
    let timestamp = timestampHeader ? (r[timestampHeader] as string) || "" : "";
    if (!timestamp) {
      // Fallback: scan all values for date-like patterns
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
    const foundHeaders = availableHeaders.slice(0, 10).join(", ");
    throw new Error(
      `No records found. Available headers: ${foundHeaders}${
        availableHeaders.length > 10 ? "..." : ""
      }. ` +
        `Please configure CSV headers in Settings if your file uses different column names.`
    );
  }
  return rows;
}

function dateFromTimestamp(ts: string): string {
  const trimmed = ts.trim();
  if (!trimmed) return "";

  // ISO timestamps (e.g. 2025-12-04T12:42:37Z) can safely use Date to normalise
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) || /Z$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // Aircall exports often provide "YYYY-MM-DD HH:MM:SS" without timezone.
  // Avoid Date() here to prevent local timezone shifting the calendar day.
  const dashMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dashMatch) {
    return `${dashMatch[1]}-${dashMatch[2]}-${dashMatch[3]}`;
  }

  // Match DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;

  // Match MM-DD-YYYY
  const hyphenAltMatch = trimmed.match(/^(\d{2})\-(\d{2})\-(\d{4})/);
  if (hyphenAltMatch)
    return `${hyphenAltMatch[3]}-${hyphenAltMatch[1]}-${hyphenAltMatch[2]}`;

  // Fallback: try Date(); if still invalid, take the first 10 chars to preserve best effort.
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return trimmed.slice(0, 10);
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
  // Tagging quality (for inbound answered only)
  let inboundUntagged = 0;
  const untaggedByUser: Record<string, number> = {};

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
        // Track untagged inbound answered calls
        if (!r.tags || r.tags.length === 0) {
          inboundUntagged++;
          if (r.user && r.user !== "[No associated user]") {
            untaggedByUser[r.user] = (untaggedByUser[r.user] || 0) + 1;
          }
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
      // Count outbound answered calls separately if needed
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
      // Count all outbound attempts for the agent, but only answered ones in outbound stat
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
  const untaggedInboundByUser = Object.entries(untaggedByUser)
    .map(([user, count]) => ({ user, count }))
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
    inboundUntagged,
    untaggedInboundByUser,
  };
}
