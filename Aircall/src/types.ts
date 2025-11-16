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
