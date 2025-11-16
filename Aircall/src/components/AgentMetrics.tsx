import type { DailyMetrics } from "../types";

export function AgentMetrics({
  data,
  onlyAgents,
}: {
  data: DailyMetrics;
  onlyAgents?: string[];
}) {
  const rows =
    onlyAgents && onlyAgents.length
      ? data.agentStats.filter((a) => onlyAgents.includes(a.user))
      : data.agentStats;
  return (
    <div style={{ marginTop: 16 }}>
      <h3>Agent Inbound Performance</h3>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <Th>Agent</Th>
            <Th>Inbound Answered</Th>
            <Th>Inbound Missed</Th>
            <Th>Outbound Answered</Th>
            <Th>Total Handled</Th>
            <Th>Avg Wait (s)</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.user}>
              <Td>{a.user}</Td>
              <Td>{a.inboundAnswered}</Td>
              <Td>{a.inboundMissed}</Td>
              <Td>{a.outbound}</Td>
              <Td>{a.totalHandled}</Td>
              <Td>{(a.avgWaitSeconds || 0).toFixed(1)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: any }) {
  return (
    <th
      style={{
        borderBottom: "1px solid #ccc",
        textAlign: "left",
        padding: 6,
        fontSize: 12,
      }}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: any }) {
  return (
    <td style={{ borderBottom: "1px solid #eee", padding: 6, fontSize: 12 }}>
      {children}
    </td>
  );
}
