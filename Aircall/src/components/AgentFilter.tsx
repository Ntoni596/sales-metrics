import { useMemo } from "react";

export const NO_ASSOC_LABEL = "[No associated user]";

export const DEFAULT_AGENTS = [
  NO_ASSOC_LABEL,
  "Deepak Joshi",
  "Harry Jeong",
  "Harley Lau",
  "Elias Eshete",
  "Matt James",
  "Matt Fraser",
  "Jack Pereira",
  "Tarish Kadam",
  "Wayne Flavell",
];

export function AgentFilter({
  selected,
  onChange,
  availableAgents,
}: {
  selected: string[];
  onChange: (agents: string[]) => void;
  availableAgents?: string[]; // optional override from data
}) {
  const options = useMemo(() => {
    const base =
      availableAgents && availableAgents.length > 0
        ? availableAgents
        : DEFAULT_AGENTS;
    // stable unique list, ensure NO_ASSOC_LABEL is present and first
    const set = new Set(base);
    set.add(NO_ASSOC_LABEL);
    const arr = Array.from(set);
    // Put NO_ASSOC_LABEL first
    const without = arr.filter((n) => n !== NO_ASSOC_LABEL);
    return [NO_ASSOC_LABEL, ...without];
  }, [availableAgents]);

  const toggle = (name: string) => {
    if (name === NO_ASSOC_LABEL) return; // always included and not toggleable
    const set = new Set(selected);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    onChange(Array.from(set));
  };

  const all = () => onChange(options.slice());
  const none = () => onChange([NO_ASSOC_LABEL]);

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <strong>Agents:</strong>
        <button className="btn" onClick={all} type="button">
          Select All
        </button>
        <button className="btn" onClick={none} type="button">
          Clear
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {options.map((name) => (
          <label
            key={name}
            style={{
              display: "inline-flex",
              gap: 6,
              alignItems: "center",
              padding: "4px 8px",
              border: "1px solid #2d3748",
              borderRadius: 6,
            }}
          >
            <input
              type="checkbox"
              checked={name === NO_ASSOC_LABEL ? true : selected.includes(name)}
              onChange={() => toggle(name)}
              disabled={name === NO_ASSOC_LABEL}
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
