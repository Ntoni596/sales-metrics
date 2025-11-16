import type { CategoryCount } from "../types";

export function CategoryBar({ categories }: { categories: CategoryCount[] }) {
  if (!categories.length) return <div>No categories.</div>;
  const max = Math.max(...categories.map((c) => c.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {categories.map((c) => (
        <div
          key={c.name}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <div style={{ width: 180, fontSize: 12 }}>{c.name}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                background: "#4b8eda",
                height: 14,
                borderRadius: 4,
                width: `${(c.count / max) * 100}%`,
                transition: "width .3s",
              }}
            />
          </div>
          <div style={{ fontSize: 12 }}>{c.count}</div>
        </div>
      ))}
    </div>
  );
}
