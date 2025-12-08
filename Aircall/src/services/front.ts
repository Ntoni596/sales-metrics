import Papa from "papaparse";
import type {
  FrontAgentSummary,
  FrontAnalytics,
  FrontChannelKey,
  FrontChannelStats,
  FrontDailySummary,
  FrontInsight,
  FrontMessage,
  FrontMonthlySummary,
  FrontSegmentSummary,
} from "../types";

interface FrontRawRow {
  [key: string]: string | undefined;
}

interface SegmentAccumulator {
  id: string;
  conversationId: string;
  startTimestamp?: string;
  endTimestamp?: string;
  lastActivity?: string;
  agents: Set<string>;
  contacts: Set<string>;
  contactDisplay?: string;
  inboundMessages: number;
  outboundMessages: number;
  autoreplies: number;
  afterHours: boolean;
  firstResponseSeconds?: number | null;
  firstResponseSeen: boolean;
  metResponseTarget: boolean;
  handleSamples: number[];
  tags: Set<string>;
  channel: FrontChannelKey;
  date?: string;
}

interface DailyAccumulator {
  date: string;
  conversations: number;
  inboundMessages: number;
  outboundMessages: number;
  afterHoursConversations: number;
  metResponseTarget: number;
  firstResponseSamples: number[];
  handleSamples: number[];
  tagCounts: Map<string, number>;
}

interface AgentAccumulator {
  agent: string;
  conversations: number;
  metResponseTarget: number;
  afterHoursConversations: number;
  firstResponseSamples: number[];
  handleSamples: number[];
}

interface ChannelAccumulator {
  conversations: number;
  inboundMessages: number;
  outboundMessages: number;
  afterHoursConversations: number;
  metResponseTarget: number;
  firstResponseSamples: number[];
  handleSamples: number[];
}

interface MonthAccumulator {
  month: string;
  conversations: number;
  inboundMessages: number;
  outboundMessages: number;
  afterHoursConversations: number;
  metResponseTarget: number;
  firstResponseSamples: number[];
  handleSamples: number[];
  tagCounts: Map<string, number>;
  uniqueContacts: Set<string>;
  agentMap: Map<string, AgentAccumulator>;
  channels: Record<FrontChannelKey, ChannelAccumulator>;
}

interface InsightContext {
  totals: {
    conversations: number;
    inboundMessages: number;
    outboundMessages: number;
    afterHoursConversations: number;
    metResponseTarget: number;
    uniqueContacts: number;
    avgFirstResponseSeconds?: number | null;
    p90FirstResponseSeconds?: number | null;
    avgHandleSeconds?: number | null;
  };
  daily: FrontDailySummary[];
  agentSummaries: FrontAgentSummary[];
  tags: { name: string; count: number }[];
  dateRange: { start: string; end: string };
  idPrefix: string;
  channels?: Partial<Record<FrontChannelKey, FrontChannelStats>>;
}

const DEFAULT_AGENT = "[Unassigned]";
const IGNORED_TAGS = new Set([
  "",
  "-",
  "Chats",
  "Chat",
  "tags",
  "SLA Applies: 699",
  "SLA Breach: 96",
  "AI Sentiment: 90",
]);

const SPLIT_REGEX = /[,;|]/;

const CHANNEL_KEYS: FrontChannelKey[] = ["livechat", "email"];

const CHANNEL_RESPONSE_TARGET_SECONDS: Record<FrontChannelKey, number> = {
  livechat: 60, // 1 minute
  email: 24 * 60 * 60, // 24 hours
};

const CHANNEL_LABELS: Record<FrontChannelKey, string> = {
  livechat: "Live Chat",
  email: "Email",
};

const CHANNEL_TARGET_DESCRIPTIONS: Record<FrontChannelKey, string> = {
  livechat: "1 min",
  email: "24 hrs",
};

const CHANNEL_SLA_SUCCESS_THRESHOLD: Record<FrontChannelKey, number> = {
  livechat: 0.75,
  email: 0.9,
};

function isSundayDateKey(key?: string): boolean {
  if (!key) return false;
  const parts = key.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3) return false;
  const [year, month, day] = parts;
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return false;
  }
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCDay() === 0; // Sunday
}

function determineChannel(
  inbox?: string,
  tags?: Iterable<string>
): FrontChannelKey {
  const normalizedInbox = (inbox || "").toLowerCase();
  if (normalizedInbox.includes("chat")) return "livechat";
  if (tags) {
    for (const tag of tags) {
      if (tag && tag.toLowerCase().includes("chat")) {
        return "livechat";
      }
    }
  }
  return "email";
}

function createChannelAccumulator(): ChannelAccumulator {
  return {
    conversations: 0,
    inboundMessages: 0,
    outboundMessages: 0,
    afterHoursConversations: 0,
    metResponseTarget: 0,
    firstResponseSamples: [],
    handleSamples: [],
  };
}

function createChannelTotals(): Record<FrontChannelKey, ChannelAccumulator> {
  return {
    livechat: createChannelAccumulator(),
    email: createChannelAccumulator(),
  };
}

function updateChannelAccumulator(
  acc: ChannelAccumulator,
  summary: FrontSegmentSummary
) {
  acc.conversations++;
  acc.inboundMessages += summary.inboundMessages;
  acc.outboundMessages += summary.outboundMessages;
  if (summary.afterHours) acc.afterHoursConversations++;
  if (summary.metResponseTarget) acc.metResponseTarget++;
  if (summary.firstResponseSeconds != null) {
    acc.firstResponseSamples.push(summary.firstResponseSeconds);
  }
  if (summary.avgHandleSeconds != null) {
    acc.handleSamples.push(summary.avgHandleSeconds);
  }
}

function toChannelStats(acc: ChannelAccumulator): FrontChannelStats {
  return {
    conversations: acc.conversations,
    inboundMessages: acc.inboundMessages,
    outboundMessages: acc.outboundMessages,
    afterHoursConversations: acc.afterHoursConversations,
    metResponseTarget: acc.metResponseTarget,
    avgFirstResponseSeconds: average(acc.firstResponseSamples),
    avgHandleSeconds: average(acc.handleSamples),
  };
}

function parseBoolean(value?: string): boolean {
  if (!value) return false;
  const v = value.toString().trim().toLowerCase();
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

function parseDirection(value?: string): "inbound" | "outbound" | "internal" {
  const v = (value || "").toString().trim().toLowerCase();
  if (v.startsWith("out")) return "outbound";
  if (v.startsWith("in")) return "inbound";
  if (v.includes("internal")) return "internal";
  return "inbound";
}

function parseNumber(value?: string): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.toString().trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toDateKey(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const isoLike = trimmed.replace(" ", "T");
  const match = isoLike.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const slash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  return trimmed.slice(0, 10);
}

function splitTags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(SPLIT_REGEX)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .filter((tag) => !IGNORED_TAGS.has(tag));
}

function normalizeTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function parseFrontCsv(
  source: File | string
): Promise<FrontMessage[]> {
  const text = typeof source === "string" ? source : await source.text();
  const parsed = Papa.parse<FrontRawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error("Front CSV parse error: " + parsed.errors[0].message);
  }
  const messages: FrontMessage[] = [];
  for (const row of parsed.data) {
    if (!row) continue;
    const messageId = (row["Message ID"] || "").trim();
    const segmentId = (row["Segment ID"] || "").trim();
    const conversationId = (row["Conversation ID"] || "").trim();
    if (!messageId) continue;
    const direction = parseDirection(row["Direction"]);
    const tags = new Set<string>();
    splitTags(row["Tags"]).forEach((t) => tags.add(t));
    const message: FrontMessage = {
      messageId,
      segmentId: segmentId || conversationId || messageId,
      conversationId: conversationId || segmentId || messageId,
      direction,
      status: row["Status"]?.trim(),
      inbox: row["Inbox"]?.trim(),
      messageDate: row["Message date"]?.trim(),
      segmentStart: row["Segment start"]?.trim() || row["Message date"]?.trim(),
      segmentEnd: row["Segment end"]?.trim(),
      lastActivity: row["Last segment activity"]?.trim(),
      autoreply: parseBoolean(row["Autoreply"]),
      newConversation: parseBoolean(row["New Conversation"]),
      firstResponse: parseBoolean(row["First response"]),
      businessHours: parseBoolean(row["Business hours"]),
      reactionTimeSeconds: parseNumber(row["Reaction time"]),
      totalReplyTimeSeconds: parseNumber(row["Total reply time"]),
      handleTimeSeconds: parseNumber(row["Handle time"]),
      responseTimeSeconds: parseNumber(row["Response time"]),
      attributedTo: row["Attributed to"]?.trim() || undefined,
      assignee: row["Assignee"]?.trim() || undefined,
      author: row["Author"]?.trim() || undefined,
      contactName: row["Contact name"]?.trim() || undefined,
      contactHandle: row["Contact handle"]?.trim() || undefined,
      extract: row["Extract"]?.trim() || undefined,
      tags: Array.from(tags),
    };
    messages.push(message);
  }
  if (!messages.length) {
    throw new Error(
      "No messages found in Front export. Check the file format."
    );
  }
  return messages;
}

export function computeFrontAnalytics(
  messages: FrontMessage[]
): FrontAnalytics {
  if (!messages.length) {
    throw new Error("No messages provided for analysis.");
  }
  const segments = new Map<string, SegmentAccumulator>();
  const globalContacts = new Set<string>();

  for (const msg of messages) {
    const id = msg.segmentId || msg.conversationId || msg.messageId;
    if (!id) continue;
    let bucket = segments.get(id);
    const msgChannel = determineChannel(msg.inbox, msg.tags);
    const messageTimestamp = normalizeTimestamp(msg.messageDate);
    const segmentTimestamp = normalizeTimestamp(msg.segmentStart);
    const fallbackTimestamp =
      messageTimestamp ||
      segmentTimestamp ||
      normalizeTimestamp(msg.lastActivity);
    const fallbackDateKey = toDateKey(fallbackTimestamp);
    if (!bucket) {
      bucket = {
        id,
        conversationId: msg.conversationId || id,
        startTimestamp: fallbackTimestamp,
        endTimestamp: msg.segmentEnd,
        lastActivity: msg.lastActivity,
        agents: new Set<string>(),
        contacts: new Set<string>(),
        inboundMessages: 0,
        outboundMessages: 0,
        autoreplies: 0,
        afterHours: false,
        firstResponseSeconds: undefined,
        firstResponseSeen: false,
        metResponseTarget: false,
        handleSamples: [],
        tags: new Set<string>(),
        channel: msgChannel,
        date: fallbackDateKey,
      } satisfies SegmentAccumulator;
      segments.set(id, bucket);
    } else if (bucket.channel === "email" && msgChannel === "livechat") {
      bucket.channel = msgChannel;
    }
    if (!bucket) continue;
    if (messageTimestamp) {
      if (!bucket.startTimestamp || messageTimestamp < bucket.startTimestamp) {
        bucket.startTimestamp = messageTimestamp;
      }
      const messageDateKey = toDateKey(messageTimestamp);
      if (messageDateKey) {
        if (!bucket.date || messageDateKey < bucket.date) {
          bucket.date = messageDateKey;
        }
      }
      if (!bucket.endTimestamp || messageTimestamp > bucket.endTimestamp) {
        bucket.endTimestamp = messageTimestamp;
      }
      if (!bucket.lastActivity || messageTimestamp > bucket.lastActivity) {
        bucket.lastActivity = messageTimestamp;
      }
    } else if (segmentTimestamp) {
      if (!bucket.startTimestamp || segmentTimestamp < bucket.startTimestamp) {
        bucket.startTimestamp = segmentTimestamp;
      }
      const segmentDateKey = toDateKey(segmentTimestamp);
      if (!bucket.date && segmentDateKey) {
        bucket.date = segmentDateKey;
      }
      if (!bucket.endTimestamp || segmentTimestamp > bucket.endTimestamp) {
        bucket.endTimestamp = segmentTimestamp;
      }
      if (!bucket.lastActivity || segmentTimestamp > bucket.lastActivity) {
        bucket.lastActivity = segmentTimestamp;
      }
    }
    if (msg.segmentEnd) {
      const segEndTs = normalizeTimestamp(msg.segmentEnd);
      if (segEndTs) {
        if (!bucket.endTimestamp || segEndTs > bucket.endTimestamp) {
          bucket.endTimestamp = segEndTs;
        }
        if (!bucket.lastActivity || segEndTs > bucket.lastActivity) {
          bucket.lastActivity = segEndTs;
        }
      }
    }
    if (msg.lastActivity) {
      const lastAct = normalizeTimestamp(msg.lastActivity);
      if (lastAct) {
        if (!bucket.lastActivity || lastAct > bucket.lastActivity) {
          bucket.lastActivity = lastAct;
        }
      }
    }

    const agentCandidates = [msg.attributedTo, msg.assignee, msg.author]
      .map((a) => (a ? a.trim() : ""))
      .filter((a) => a && a.toLowerCase() !== "system");
    if (!agentCandidates.length && msg.direction === "outbound") {
      agentCandidates.push("Outbound Message");
    }
    for (const agent of agentCandidates) {
      if (!agent) continue;
      bucket.agents.add(agent);
    }
    const contactKey =
      msg.contactHandle || msg.contactName || msg.extract || undefined;
    if (contactKey) {
      bucket.contacts.add(contactKey);
      if (!bucket.contactDisplay) {
        bucket.contactDisplay =
          msg.contactName || msg.contactHandle || contactKey;
      }
    }

    if (msg.direction === "inbound") bucket.inboundMessages++;
    if (msg.direction === "outbound") bucket.outboundMessages++;
    if (msg.autoreply) bucket.autoreplies++;
    if (msg.direction === "inbound" && !msg.businessHours) {
      bucket.afterHours = true;
    }
    if (msg.direction === "inbound" && msg.autoreply) {
      bucket.afterHours = true;
    }

    if (msg.firstResponse && !bucket.firstResponseSeen) {
      const firstResponse =
        msg.responseTimeSeconds ?? msg.reactionTimeSeconds ?? null;
      bucket.firstResponseSeconds = firstResponse;
      bucket.firstResponseSeen = true;
      if (firstResponse != null) {
        const targetSeconds = CHANNEL_RESPONSE_TARGET_SECONDS[bucket.channel];
        if (
          typeof targetSeconds === "number" &&
          firstResponse <= targetSeconds
        ) {
          bucket.metResponseTarget = true;
        }
      }
    }
    if (msg.handleTimeSeconds != null) {
      bucket.handleSamples.push(msg.handleTimeSeconds);
    }
    for (const tag of msg.tags) {
      if (tag && !IGNORED_TAGS.has(tag)) bucket.tags.add(tag);
    }
  }

  const segmentSummaries: FrontSegmentSummary[] = [];
  const dailyMap = new Map<string, DailyAccumulator>();
  const monthMap = new Map<string, MonthAccumulator>();
  const agentMap = new Map<string, AgentAccumulator>();
  const allFirstResponses: number[] = [];
  const allHandleSamples: number[] = [];
  const tagAggregate = new Map<string, number>();
  const channelTotals = createChannelTotals();

  for (const bucket of segments.values()) {
    const agents = Array.from(bucket.agents);
    const primaryAgent = agents[0] || DEFAULT_AGENT;
    const tags = Array.from(bucket.tags);
    const avgHandleSeconds = bucket.handleSamples.length
      ? average(bucket.handleSamples)
      : null;
    const summary: FrontSegmentSummary = {
      segmentId: bucket.id,
      conversationId: bucket.conversationId,
      date: bucket.date || toDateKey(bucket.startTimestamp),
      startTimestamp: bucket.startTimestamp,
      endTimestamp: bucket.endTimestamp,
      primaryAgent,
      agents: agents.length ? agents : [DEFAULT_AGENT],
      contact: bucket.contactDisplay,
      inboundMessages: bucket.inboundMessages,
      outboundMessages: bucket.outboundMessages,
      afterHours: bucket.afterHours,
      autoreplies: bucket.autoreplies,
      firstResponseSeconds: bucket.firstResponseSeconds ?? null,
      avgHandleSeconds,
      metResponseTarget: bucket.metResponseTarget,
      channel: bucket.channel,
      tags,
    };
    if (isSundayDateKey(summary.date)) {
      continue;
    }
    for (const contactId of bucket.contacts) {
      globalContacts.add(contactId);
    }
    segmentSummaries.push(summary);

    updateChannelAccumulator(channelTotals[summary.channel], summary);

    if (summary.firstResponseSeconds != null) {
      allFirstResponses.push(summary.firstResponseSeconds);
    }
    if (summary.avgHandleSeconds != null) {
      allHandleSamples.push(summary.avgHandleSeconds);
    }
    const dateKey = summary.date;
    if (dateKey) {
      const daily = getOrCreateDaily(dailyMap, dateKey);
      daily.conversations++;
      daily.inboundMessages += summary.inboundMessages;
      daily.outboundMessages += summary.outboundMessages;
      if (summary.afterHours) daily.afterHoursConversations++;
      if (summary.metResponseTarget) daily.metResponseTarget++;
      if (summary.firstResponseSeconds != null) {
        daily.firstResponseSamples.push(summary.firstResponseSeconds);
      }
      if (summary.avgHandleSeconds != null) {
        daily.handleSamples.push(summary.avgHandleSeconds);
      }
      for (const tag of summary.tags) {
        incrementCount(daily.tagCounts, tag, 1);
      }

      const monthKey = dateKey.slice(0, 7);
      const monthAcc = getOrCreateMonth(monthMap, monthKey);
      monthAcc.conversations++;
      monthAcc.inboundMessages += summary.inboundMessages;
      monthAcc.outboundMessages += summary.outboundMessages;
      if (summary.afterHours) monthAcc.afterHoursConversations++;
      if (summary.metResponseTarget) monthAcc.metResponseTarget++;
      if (summary.firstResponseSeconds != null) {
        monthAcc.firstResponseSamples.push(summary.firstResponseSeconds);
      }
      if (summary.avgHandleSeconds != null) {
        monthAcc.handleSamples.push(summary.avgHandleSeconds);
      }
      for (const tag of summary.tags) {
        incrementCount(monthAcc.tagCounts, tag, 1);
      }
      for (const contact of bucket.contacts) {
        monthAcc.uniqueContacts.add(contact);
      }
      const monthAgent = getOrCreateAgent(
        monthAcc.agentMap,
        summary.primaryAgent
      );
      updateAgent(monthAgent, summary);
      updateChannelAccumulator(monthAcc.channels[summary.channel], summary);
    }
    const agentBucket = getOrCreateAgent(agentMap, summary.primaryAgent);
    updateAgent(agentBucket, summary);
    const uniqueTags = new Set(summary.tags);
    for (const tag of uniqueTags) {
      incrementCount(tagAggregate, tag, 1);
    }
  }

  const dailySummaries = Array.from(dailyMap.values())
    .map((d) => toFrontDailySummary(d))
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthlySummaries = Array.from(monthMap.values())
    .map((m) => toFrontMonthlySummary(m))
    .sort((a, b) => b.month.localeCompare(a.month));

  const agentSummaries = Array.from(agentMap.values())
    .map((a) => toFrontAgentSummary(a))
    .sort((a, b) => b.conversations - a.conversations);

  const tagList = Array.from(tagAggregate.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const dates = segmentSummaries
    .map((s) => s.startTimestamp || s.date)
    .filter((d): d is string => !!d)
    .sort();
  const dateRange = {
    start: dates[0] ? toDateKey(dates[0]) : "",
    end: dates.length ? toDateKey(dates[dates.length - 1]) : "",
  };

  const totals = {
    conversations: segmentSummaries.length,
    inboundMessages: segmentSummaries.reduce(
      (sum, s) => sum + s.inboundMessages,
      0
    ),
    outboundMessages: segmentSummaries.reduce(
      (sum, s) => sum + s.outboundMessages,
      0
    ),
    afterHoursConversations: segmentSummaries.filter((s) => s.afterHours)
      .length,
    metResponseTarget: segmentSummaries.filter((s) => s.metResponseTarget)
      .length,
    uniqueContacts: globalContacts.size,
    avgFirstResponseSeconds: average(allFirstResponses),
    p90FirstResponseSeconds: percentile(allFirstResponses, 90),
    avgHandleSeconds: average(allHandleSamples),
  };

  const channels: Record<FrontChannelKey, FrontChannelStats> = {
    livechat: toChannelStats(channelTotals.livechat),
    email: toChannelStats(channelTotals.email),
  };

  const aiInsights = buildInsights({
    totals,
    daily: dailySummaries,
    agentSummaries,
    tags: tagList,
    dateRange,
    idPrefix: "global",
    channels,
  });

  // Attach insights to monthly summaries using their own context.
  for (const month of monthlySummaries) {
    const monthDaily = dailySummaries.filter((d) =>
      d.date.startsWith(month.month)
    );
    const monthAgents = buildMonthlyAgentSummaries(monthMap.get(month.month));
    const monthTotals = {
      conversations: month.conversations,
      inboundMessages: month.inboundMessages,
      outboundMessages: month.outboundMessages,
      afterHoursConversations: month.afterHoursConversations,
      metResponseTarget: month.metResponseTarget,
      uniqueContacts: month.uniqueContacts,
      avgFirstResponseSeconds: month.avgFirstResponseSeconds,
      p90FirstResponseSeconds: month.p90FirstResponseSeconds,
      avgHandleSeconds: month.avgHandleSeconds,
    };
    month.aiInsights = buildInsights({
      totals: monthTotals,
      daily: monthDaily,
      agentSummaries: monthAgents,
      tags: month.topTags,
      dateRange: {
        start: monthDaily.length
          ? monthDaily[monthDaily.length - 1].date
          : `${month.month}-01`,
        end: monthDaily.length ? monthDaily[0].date : `${month.month}-28`,
      },
      idPrefix: `month-${month.month}`,
      channels: month.channels,
    });
    month.agentLeaders = monthAgents.slice(0, 3).map((agent) => ({
      agent: agent.agent,
      conversations: agent.conversations,
      avgFirstResponseSeconds: agent.avgFirstResponseSeconds,
    }));
  }

  return {
    dateRange,
    totals,
    tags: tagList,
    segmentsByTag: tagList.map((t) => ({
      name: t.name,
      conversations: t.count,
    })),
    agentSummaries,
    daily: dailySummaries,
    monthly: monthlySummaries,
    aiInsights,
    channels,
  };
}

function getOrCreateDaily(
  map: Map<string, DailyAccumulator>,
  date: string
): DailyAccumulator {
  let bucket = map.get(date);
  if (!bucket) {
    bucket = {
      date,
      conversations: 0,
      inboundMessages: 0,
      outboundMessages: 0,
      afterHoursConversations: 0,
      metResponseTarget: 0,
      firstResponseSamples: [],
      handleSamples: [],
      tagCounts: new Map<string, number>(),
    } satisfies DailyAccumulator;
    map.set(date, bucket);
  }
  return bucket;
}

function getOrCreateMonth(
  map: Map<string, MonthAccumulator>,
  month: string
): MonthAccumulator {
  const existing = map.get(month);
  if (existing) return existing;
  const bucket: MonthAccumulator = {
    month,
    conversations: 0,
    inboundMessages: 0,
    outboundMessages: 0,
    afterHoursConversations: 0,
    metResponseTarget: 0,
    firstResponseSamples: [],
    handleSamples: [],
    tagCounts: new Map<string, number>(),
    uniqueContacts: new Set<string>(),
    agentMap: new Map<string, AgentAccumulator>(),
    channels: createChannelTotals(),
  };
  map.set(month, bucket);
  return bucket;
}

function getOrCreateAgent(
  map: Map<string, AgentAccumulator>,
  agentName?: string
): AgentAccumulator {
  const key = agentName && agentName.trim() ? agentName.trim() : DEFAULT_AGENT;
  let bucket = map.get(key);
  if (!bucket) {
    bucket = {
      agent: key,
      conversations: 0,
      metResponseTarget: 0,
      afterHoursConversations: 0,
      firstResponseSamples: [],
      handleSamples: [],
    } satisfies AgentAccumulator;
    map.set(key, bucket);
  }
  return bucket;
}

function updateAgent(target: AgentAccumulator, segment: FrontSegmentSummary) {
  target.conversations++;
  if (segment.metResponseTarget) target.metResponseTarget++;
  if (segment.afterHours) target.afterHoursConversations++;
  if (segment.firstResponseSeconds != null) {
    target.firstResponseSamples.push(segment.firstResponseSeconds);
  }
  if (segment.avgHandleSeconds != null) {
    target.handleSamples.push(segment.avgHandleSeconds);
  }
}

function toFrontDailySummary(acc: DailyAccumulator): FrontDailySummary {
  return {
    date: acc.date,
    conversations: acc.conversations,
    inboundMessages: acc.inboundMessages,
    outboundMessages: acc.outboundMessages,
    afterHoursConversations: acc.afterHoursConversations,
    metResponseTarget: acc.metResponseTarget,
    avgFirstResponseSeconds: average(acc.firstResponseSamples),
    p90FirstResponseSeconds: percentile(acc.firstResponseSamples, 90),
    avgHandleSeconds: average(acc.handleSamples),
    topTags: topEntries(acc.tagCounts, 5),
  };
}

function toFrontMonthlySummary(acc: MonthAccumulator): FrontMonthlySummary {
  const topTags = topEntries(acc.tagCounts, 10);
  const channelStats: Partial<Record<FrontChannelKey, FrontChannelStats>> = {};
  for (const key of CHANNEL_KEYS) {
    channelStats[key] = toChannelStats(acc.channels[key]);
  }
  return {
    month: acc.month,
    conversations: acc.conversations,
    inboundMessages: acc.inboundMessages,
    outboundMessages: acc.outboundMessages,
    afterHoursConversations: acc.afterHoursConversations,
    metResponseTarget: acc.metResponseTarget,
    avgFirstResponseSeconds: average(acc.firstResponseSamples),
    p90FirstResponseSeconds: percentile(acc.firstResponseSamples, 90),
    avgHandleSeconds: average(acc.handleSamples),
    uniqueContacts: acc.uniqueContacts.size,
    topTags,
    agentLeaders: [],
    aiInsights: [],
    channels: channelStats,
    updatedAt: undefined,
  };
}

function toFrontAgentSummary(acc: AgentAccumulator): FrontAgentSummary {
  return {
    agent: acc.agent,
    conversations: acc.conversations,
    metResponseTarget: acc.metResponseTarget,
    avgFirstResponseSeconds: average(acc.firstResponseSamples),
    p90FirstResponseSeconds: percentile(acc.firstResponseSamples, 90),
    avgHandleSeconds: average(acc.handleSamples),
    afterHoursConversations: acc.afterHoursConversations,
  };
}

function buildMonthlyAgentSummaries(
  monthAcc?: MonthAccumulator
): FrontAgentSummary[] {
  if (!monthAcc) return [];
  return Array.from(monthAcc.agentMap.values())
    .map((agent) => toFrontAgentSummary(agent))
    .sort((a, b) => b.conversations - a.conversations);
}

function incrementCount(map: Map<string, number>, key: string, value: number) {
  if (!key || IGNORED_TAGS.has(key)) return;
  map.set(key, (map.get(key) || 0) + value);
}

function topEntries(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

function percentile(values: number[], pct: number): number | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) {
    return "—";
  }
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) return secs ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24)
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatPercentValue(part: number, total: number): string {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function ratio(part: number, total: number): number {
  if (!total) return 0;
  return part / total;
}

function buildInsights(context: InsightContext): FrontInsight[] {
  const { totals, daily, agentSummaries, tags, dateRange, idPrefix, channels } =
    context;
  const insights: FrontInsight[] = [];
  let counter = 0;
  const makeId = () => `${idPrefix}-${counter++}`;

  const totalConversations = totals.conversations || 0;
  const inbound = totals.inboundMessages || 0;
  const outbound = totals.outboundMessages || 0;
  const uniqueContacts = totals.uniqueContacts || 0;
  const coverageCount = totals.metResponseTarget || 0;
  const afterHoursCount = totals.afterHoursConversations || 0;
  const rangeText =
    dateRange.start && dateRange.end
      ? `${dateRange.start} → ${dateRange.end}`
      : dateRange.start || dateRange.end || "this period";

  if (totalConversations) {
    insights.push({
      id: makeId(),
      title: "Conversation volume snapshot",
      detail: `Handled ${totalConversations.toLocaleString()} conversations (${inbound.toLocaleString()} inbound / ${outbound.toLocaleString()} outbound) during ${rangeText}.`,
      impact: "neutral",
      metric: `${totalConversations.toLocaleString()} convos`,
    });
  }

  if (uniqueContacts) {
    const denominator = totalConversations || uniqueContacts;
    const repeatRate = totalConversations
      ? Math.max(0, 1 - uniqueContacts / totalConversations)
      : 0;
    insights.push({
      id: makeId(),
      title: "Contact reach",
      detail: `Engaged ${uniqueContacts.toLocaleString()} unique contacts (${formatPercentValue(
        uniqueContacts,
        denominator
      )} of all conversations).`,
      impact:
        repeatRate > 0.4
          ? "warning"
          : repeatRate > 0.2
          ? "neutral"
          : "positive",
      metric: `${uniqueContacts.toLocaleString()} unique`,
    });
  }

  if (totalConversations) {
    const coverageRatio = ratio(coverageCount, totalConversations);
    const coveragePct = formatPercentValue(coverageCount, totalConversations);
    insights.push({
      id: makeId(),
      title:
        coverageRatio >= 0.75
          ? "Response targets on track"
          : coverageRatio > 0
          ? "Response targets slipping"
          : "No conversations met SLA",
      detail:
        coverageRatio > 0
          ? `${coveragePct} of conversations (${coverageCount.toLocaleString()} of ${totalConversations.toLocaleString()}) met SLA across all channels.`
          : "None of the conversations met the configured response targets. Review CSV fields or staffing coverage.",
      impact:
        coverageRatio >= 0.75
          ? "positive"
          : coverageRatio >= 0.6
          ? "neutral"
          : "warning",
      metric: coveragePct,
    });
  }

  if (totals.avgFirstResponseSeconds != null) {
    const avg = totals.avgFirstResponseSeconds || 0;
    const impact = avg <= 90 ? "positive" : avg <= 180 ? "neutral" : "warning";
    insights.push({
      id: makeId(),
      title: "Overall first response",
      detail: `Average first response time is ${formatDuration(
        avg
      )} across all channels.`,
      impact,
      metric: formatDuration(avg),
    });
  }

  if (totals.p90FirstResponseSeconds != null) {
    const p90 = totals.p90FirstResponseSeconds || 0;
    const impact = p90 <= 180 ? "positive" : p90 <= 600 ? "neutral" : "warning";
    insights.push({
      id: makeId(),
      title: "90th percentile response",
      detail: `90% of conversations receive a first reply within ${formatDuration(
        p90
      )}.`,
      impact,
      metric: formatDuration(p90),
    });
  }

  if (totals.avgHandleSeconds != null) {
    const handle = totals.avgHandleSeconds || 0;
    const impact =
      handle <= 300 ? "positive" : handle <= 600 ? "neutral" : "warning";
    insights.push({
      id: makeId(),
      title: "Average handle time",
      detail: `Agents spend ${formatDuration(
        handle
      )} on average per conversation.`,
      impact,
      metric: formatDuration(handle),
    });
  }

  if (afterHoursCount && totalConversations) {
    const afterHoursRatio = ratio(afterHoursCount, totalConversations);
    const impact =
      afterHoursRatio >= 0.35
        ? "warning"
        : afterHoursRatio >= 0.15
        ? "neutral"
        : "positive";
    insights.push({
      id: makeId(),
      title:
        afterHoursRatio >= 0.35
          ? "High after-hours load"
          : "After-hours demand",
      detail: `${formatPercentValue(
        afterHoursCount,
        totalConversations
      )} of conversations (${afterHoursCount.toLocaleString()}) arrive outside business hours.`,
      impact,
      metric: formatPercentValue(afterHoursCount, totalConversations),
    });
  }

  if (channels) {
    for (const key of CHANNEL_KEYS) {
      const stats = channels[key];
      if (!stats) continue;
      const conversations = stats.conversations || 0;
      if (!conversations) continue;
      const met = stats.metResponseTarget ?? 0;
      const label = CHANNEL_LABELS[key];
      const targetLabel = CHANNEL_TARGET_DESCRIPTIONS[key];
      const threshold = CHANNEL_SLA_SUCCESS_THRESHOLD[key];
      const channelCoverage = ratio(met, conversations);
      const coveragePct = formatPercentValue(met, conversations);
      const coverageImpact =
        channelCoverage >= threshold
          ? "positive"
          : channelCoverage >= threshold - 0.15
          ? "neutral"
          : "warning";
      insights.push({
        id: makeId(),
        title:
          channelCoverage >= threshold
            ? `${label} SLA on track`
            : `${label} SLA attention needed`,
        detail: `${coveragePct} of ${label.toLowerCase()} conversations (${met.toLocaleString()} of ${conversations.toLocaleString()}) met the ${targetLabel} target.`,
        impact: coverageImpact,
        metric: coveragePct,
      });

      if (stats.avgFirstResponseSeconds != null) {
        const avg = stats.avgFirstResponseSeconds || 0;
        const fastThreshold = key === "livechat" ? 90 : 4 * 3600;
        const okayThreshold = key === "livechat" ? 180 : 12 * 3600;
        const impact =
          avg <= fastThreshold
            ? "positive"
            : avg <= okayThreshold
            ? "neutral"
            : "warning";
        insights.push({
          id: makeId(),
          title: `${label} first response`,
          detail: `${label} replies average ${formatDuration(avg)}.`,
          impact,
          metric: formatDuration(avg),
        });
      }

      const afterHours = stats.afterHoursConversations ?? 0;
      if (afterHours) {
        const afterRatio = ratio(afterHours, conversations);
        const impact =
          afterRatio >= 0.4
            ? "warning"
            : afterRatio >= 0.15
            ? "neutral"
            : "positive";
        insights.push({
          id: makeId(),
          title: `${label} after-hours load`,
          detail: `${formatPercentValue(
            afterHours,
            conversations
          )} of ${label.toLowerCase()} conversations (${afterHours.toLocaleString()}) arrive after hours.`,
          impact,
          metric: formatPercentValue(afterHours, conversations),
        });
      }
    }
  }

  if (tags.length && totalConversations) {
    const topTag = tags[0];
    if (topTag) {
      const share = ratio(topTag.count, totalConversations);
      insights.push({
        id: makeId(),
        title: `Top intent: ${topTag.name}`,
        detail: `${topTag.name} accounted for ${formatPercentValue(
          topTag.count,
          totalConversations
        )} of conversations (${topTag.count.toLocaleString()} chats).`,
        impact: share >= 0.4 ? "warning" : "neutral",
        metric: formatPercentValue(topTag.count, totalConversations),
      });
    }
    const topThree = tags.slice(0, 3);
    if (topThree.length > 1) {
      const description = topThree
        .map(
          (tag) =>
            `${tag.name} (${formatPercentValue(tag.count, totalConversations)})`
        )
        .join(", ");
      insights.push({
        id: makeId(),
        title: "Leading topics",
        detail: `Top conversation intents: ${description}.`,
        impact: "neutral",
      });
    }
    const newSale = tags.find((t) => /new sale/i.test(t.name));
    const existing = tags.find((t) => /existing order/i.test(t.name));
    if (newSale && existing) {
      insights.push({
        id: makeId(),
        title: "Sales vs support mix",
        detail: `New sale chats (${newSale.count.toLocaleString()}) vs existing order follow-ups (${existing.count.toLocaleString()}). Tailor scripts for both intents.`,
        impact: "neutral",
        metric: `${newSale.count.toLocaleString()} / ${existing.count.toLocaleString()}`,
      });
    }
  }

  if (agentSummaries.length) {
    const topAgent = agentSummaries[0];
    if (topAgent) {
      const slaShare = formatPercentValue(
        topAgent.metResponseTarget,
        topAgent.conversations || 1
      );
      insights.push({
        id: makeId(),
        title: `Agent leader: ${topAgent.agent}`,
        detail: `${
          topAgent.agent
        } handled ${topAgent.conversations.toLocaleString()} chats with ${slaShare} meeting SLA and ${formatDuration(
          topAgent.avgFirstResponseSeconds
        )} average first response.`,
        impact: "positive",
        metric: `${topAgent.conversations.toLocaleString()} chats`,
      });
    }
    const slowerAgent = agentSummaries
      .filter(
        (a) => a.conversations >= 5 && (a.avgFirstResponseSeconds ?? 0) > 200
      )
      .sort(
        (a, b) =>
          (b.avgFirstResponseSeconds || 0) - (a.avgFirstResponseSeconds || 0)
      )[0];
    if (slowerAgent) {
      insights.push({
        id: makeId(),
        title: `Coaching opportunity: ${slowerAgent.agent}`,
        detail: `${slowerAgent.agent} averages ${formatDuration(
          slowerAgent.avgFirstResponseSeconds
        )} to first response across ${slowerAgent.conversations.toLocaleString()} chats.`,
        impact: "warning",
        metric: formatDuration(slowerAgent.avgFirstResponseSeconds),
      });
    }
  }

  if (daily.length >= 3) {
    const sortedDaily = daily
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(sortedDaily.length / 2);
    const firstHalfAvg = average(
      sortedDaily.slice(0, mid).map((d) => d.conversations)
    );
    const secondHalfAvg = average(
      sortedDaily.slice(mid).map((d) => d.conversations)
    );
    if (firstHalfAvg != null && secondHalfAvg != null && firstHalfAvg !== 0) {
      const growth = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      insights.push({
        id: makeId(),
        title: growth >= 0 ? "Volume trend" : "Volume easing",
        detail: `Average daily chats ${
          growth >= 0 ? "rose" : "fell"
        } ${growth.toFixed(
          1
        )}% between the first and second half of the period.`,
        impact:
          growth >= 15 ? "warning" : growth <= -15 ? "positive" : "neutral",
        metric: `${growth.toFixed(1)}% change`,
      });
    }
    const busiestDay = daily
      .slice()
      .sort((a, b) => b.conversations - a.conversations)[0];
    if (busiestDay) {
      insights.push({
        id: makeId(),
        title: "Peak day focus",
        detail: `${
          busiestDay.date
        } saw ${busiestDay.conversations.toLocaleString()} chats. Ensure readiness for similar spikes.`,
        impact: "neutral",
        metric: `${busiestDay.conversations.toLocaleString()} chats`,
      });
    }
  }

  if (!insights.length) {
    insights.push({
      id: makeId(),
      title: "No notable insight",
      detail: "Not enough data yet to surface meaningful trends.",
      impact: "neutral",
    });
  }

  return insights;
}
