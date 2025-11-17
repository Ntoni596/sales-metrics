import { NavLink } from "react-router-dom";

const sections = [
  {
    title: "Dashboards",
    items: [
      { to: "/", label: "Today" },
      { to: "/history", label: "History" },
      { to: "/showroom", label: "Showroom" },
    ],
  },
  { title: "Data", items: [{ to: "/agents", label: "Agents" }] },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <h1>Aftershock PC | Sales</h1>
      {sections.map((s) => (
        <div key={s.title} className="nav-group">
          <div className="nav-group-title">{s.title}</div>
          {s.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={({ isActive }) =>
                "nav-item" + (isActive ? " active" : "")
              }
            >
              {i.label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
}
