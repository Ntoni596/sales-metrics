import { NavLink } from "react-router-dom";

const sections = [
  {
    title: "Dashboards",
    items: [
      { to: "/", label: "Today" },
      { to: "/history", label: "History" },
      { to: "/showroom", label: "Showroom" },
      { to: "/front", label: "Front" },
    ],
  },
  { title: "Data", items: [{ to: "/agents", label: "Agents" }] },
  {
    title: "Import",
    items: [{ to: "/import/bulk", label: "Bulk (1-year CSV)" }],
  },
  {
    title: "Settings",
    items: [
      { to: "/settings/csv-headers", label: "CSV Headers" },
      { to: "/settings/csv-tester", label: "CSV Tester" },
    ],
  },
  {
    title: "Debug",
    items: [{ to: "/debug/parsing-test", label: "Parsing Test" }],
  },
];

export function Sidebar() {
  return (
    <aside className='sidebar'>
      <h1>Aftershock PC | Sales</h1>
      {sections.map((s) => (
        <div key={s.title} className='nav-group'>
          <div className='nav-group-title'>{s.title}</div>
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
