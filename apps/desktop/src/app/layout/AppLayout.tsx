import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getLiveSourcePreview, getSourceStatus } from "../../ipc/api";

const navItems = [
  { to: "/live", label: "Live Combat" },
  { to: "/replay", label: "Replay Logs" },
  { to: "/encounters", label: "Analysis" },
  { to: "/widget", label: "Widget" },
  { to: "/settings", label: "Settings" },
];

export function AppLayout() {
  const source = useQuery({ queryKey: ["source-status"], queryFn: getSourceStatus });
  const preview = useQuery({ queryKey: ["live-source-preview"], queryFn: getLiveSourcePreview });

  return (
    <div className="app-shell">
      <aside className="nav-rail" aria-label="Primary navigation">
        <div className="brand-mark">NCA</div>
        <p className="nav-caption">Visual combat review</p>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <header className="top-app-bar">
          <div>
            <p className="label">Source</p>
            <strong>{source.data?.message ?? "No source selected"}</strong>
          </div>
          <div>
            <p className="label">Live Lines</p>
            <strong>{(preview.data?.lineCount ?? 0).toLocaleString()}</strong>
          </div>
        </header>
        <main className="screen-frame">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
