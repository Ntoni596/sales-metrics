import { useEffect, useMemo, useState } from "react";
import { getLatestDaily } from "../services/storage";
import type { DailyMetrics } from "../types";
import { AgentFilter, DEFAULT_AGENTS } from "./AgentFilter";
import { AgentMetrics } from "./AgentMetrics";

export function AgentsPage() {
  const [latest, setLatest] = useState<DailyMetrics | null>(null);
  const [selectedAgents, setSelectedAgents] =
    useState<string[]>(DEFAULT_AGENTS);

  useEffect(() => {
    (async () => {
      try {
        const d = await getLatestDaily();
        if (d) setLatest(d);
      } catch {
        // ignore
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!latest) return null;
    if (!selectedAgents.length)
      return {
        ...latest,
        agentStats: [],
        answered: 0,
        missed: 0,
        outbound: 0,
        inboundEffective: 0,
      } as DailyMetrics;
    const subset = latest.agentStats.filter((a) =>
      selectedAgents.includes(a.user)
    );
    const inboundAnswered = subset.reduce((s, a) => s + a.inboundAnswered, 0);
    const inboundMissed = subset.reduce((s, a) => s + a.inboundMissed, 0);
    const outbound = subset.reduce((s, a) => s + a.outbound, 0);
    const inboundEffective = inboundAnswered + inboundMissed;
    return {
      ...latest,
      agentStats: subset,
      answered: inboundAnswered,
      missed: inboundMissed,
      outbound,
      inboundEffective,
    } as DailyMetrics;
  }, [latest, selectedAgents]);

  return (
    <div>
      <h2>Agents</h2>
      <AgentFilter
        selected={selectedAgents}
        onChange={setSelectedAgents}
        availableAgents={latest?.agentStats.map((a) => a.user)}
      />
      <div className="panel" style={{ marginTop: 16 }}>
        {filtered ? (
          <AgentMetrics data={filtered} onlyAgents={selectedAgents} />
        ) : (
          <div>Load a CSV on Today page to see agent stats.</div>
        )}
      </div>
    </div>
  );
}
