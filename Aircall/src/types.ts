export interface CallRecord {
  timestamp: string; // ISO timestamp from CSV
  direction: "inbound" | "outbound";
  answered: boolean;
  missedReason?:
    | "outside_hours"
    | "abandoned"
    | "agent_unavailable"
    | "agent_no_answer";
  user: string; // agent / owner of call
  waitSeconds?: number;
  tags: string[]; // call tags/categories
}

export interface AgentStats {
  user: string;
  inboundAnswered: number;
  inboundMissed: number;
  outbound: number;
  totalHandled: number; // answered inbound + outbound
  avgWaitSeconds?: number;
  // For precise filtering of average wait on inbound answered
  inboundAnsweredWaitTotal?: number;
  inboundAnsweredWaitCount?: number;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  inboundRaw: number; // all inbound including outside hours, abandoned
  inboundEffective: number; // inboundRaw - (outside_hours + abandoned)
  outbound: number;
  answered: number; // total answered (inbound + outbound answered)
  missed: number; // total missed (excluding outside hours?) we keep full missed except outside_hours & abandoned removed from effective inbound
  missedBreakdown: Record<string, number>; // keys of missedReason
  answerable: number; // synonym of inboundEffective for UI
  avgWaitSeconds: number;
  topInboundPerformer?: { user: string; count: number };
  agentStats: AgentStats[];
  categoryCounts: CategoryCount[];
  recordsStored: number;
  // New: tagging quality metrics (inbound answered only)
  inboundUntagged?: number; // count of inbound answered with no tags
  untaggedInboundByUser?: { user: string; count: number }[];
}

export interface MonthlyMetrics {
  month: string; // YYYY-MM
  days: number;
  inboundEffective: number;
  outbound: number;
  missed: number;
  answered: number;
  avgWaitSeconds: number; // weighted by answered calls with wait time
}

export interface FrontMessage {
  messageId: string;
  segmentId: string;
  conversationId: string;
  direction: "inbound" | "outbound" | "internal";
  status?: string;
  inbox?: string;
  messageDate?: string;
  segmentStart?: string;
  segmentEnd?: string;
  lastActivity?: string;
  autoreply: boolean;
  newConversation: boolean;
  firstResponse: boolean;
  businessHours: boolean;
  reactionTimeSeconds?: number | null;
  totalReplyTimeSeconds?: number | null;
  handleTimeSeconds?: number | null;
  responseTimeSeconds?: number | null;
  attributedTo?: string;
  assignee?: string;
  author?: string;
  contactName?: string;
  contactHandle?: string;
  extract?: string;
  tags: string[];
}

export type FrontChannelKey = "livechat" | "email";

export interface FrontChannelStats {
  conversations: number;
  inboundMessages: number;
  outboundMessages: number;
  afterHoursConversations: number;
  metResponseTarget: number;
  avgFirstResponseSeconds?: number | null;
  avgHandleSeconds?: number | null;
}

export interface FrontSegmentSummary {
  segmentId: string;
  conversationId: string;
  date: string;
  startTimestamp?: string;
  endTimestamp?: string;
  primaryAgent: string;
  agents: string[];
  contact?: string;
  inboundMessages: number;
  outboundMessages: number;
  afterHours: boolean;
  autoreplies: number;
  firstResponseSeconds?: number | null;
  avgHandleSeconds?: number | null;
  metResponseTarget: boolean;
  channel: FrontChannelKey;
  tags: string[];
}

export interface FrontDailySummary {
  date: string;
  conversations: number;
  inboundMessages: number;
  outboundMessages: number;
  afterHoursConversations: number;
  metResponseTarget: number;
  avgFirstResponseSeconds?: number | null;
  p90FirstResponseSeconds?: number | null;
  avgHandleSeconds?: number | null;
  topTags: { name: string; count: number }[];
}

export interface FrontAgentSummary {
  agent: string;
  conversations: number;
  metResponseTarget: number;
  avgFirstResponseSeconds?: number | null;
  p90FirstResponseSeconds?: number | null;
  avgHandleSeconds?: number | null;
  afterHoursConversations: number;
}

export type FrontInsightImpact = "positive" | "warning" | "neutral";

export interface FrontInsight {
  id: string;
  title: string;
  detail: string;
  impact: FrontInsightImpact;
  metric?: string;
}

export interface FrontMonthlySummary {
  month: string;
  conversations: number;
  inboundMessages: number;
  outboundMessages: number;
  afterHoursConversations: number;
  metResponseTarget: number;
  avgFirstResponseSeconds?: number | null;
  p90FirstResponseSeconds?: number | null;
  avgHandleSeconds?: number | null;
  uniqueContacts: number;
  topTags: { name: string; count: number }[];
  agentLeaders: {
    agent: string;
    conversations: number;
    avgFirstResponseSeconds?: number | null;
  }[];
  aiInsights: FrontInsight[];
  channels?: Partial<Record<FrontChannelKey, FrontChannelStats>>;
  updatedAt?: unknown;
}

export interface FrontAnalytics {
  dateRange: { start: string; end: string };
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
  tags: { name: string; count: number }[];
  segmentsByTag: { name: string; conversations: number }[];
  agentSummaries: FrontAgentSummary[];
  daily: FrontDailySummary[];
  monthly: FrontMonthlySummary[];
  aiInsights: FrontInsight[];
  channels: Record<FrontChannelKey, FrontChannelStats>;
}
