import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import logoUrl from "../../assets/nexus-logo.png";
import { getLiveSourcePreview, getSourceStatus } from "../../ipc/api";

const navItems = [
  { to: "/live", label: "Live" },
  { to: "/replay", label: "Replay" },
  { to: "/encounters", label: "Players" },
  { to: "/widget", label: "Widget" },
  { to: "/settings", label: "Settings" },
];

export function AppLayout() {
  const source = useQuery({ queryKey: ["source-status"], queryFn: getSourceStatus });
  const preview = useQuery({ queryKey: ["live-source-preview"], queryFn: getLiveSourcePreview });

  return (
    <div className="app-shell">
      <aside className="nav-rail" aria-label="Primary navigation">
        <Box className="brand-mark">
          <img alt="Astral Combat" src={logoUrl} />
          <span>Astral Combat</span>
        </Box>
        <Typography className="nav-caption" component="p" variant="caption">
          Combat intelligence workspace.
        </Typography>
        <nav>
          {navItems.map((item) => (
            <Button className="nav-link" component={NavLink} key={item.to} to={item.to}>
              {item.label}
            </Button>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <AppBar className="top-app-bar" color="inherit" component="header" elevation={0} position="sticky">
          <Toolbar disableGutters sx={{ gap: 4, minHeight: "64px", px: 3 }}>
          <div>
            <p className="label">Source</p>
            <strong>{source.data?.message ?? "No source selected"}</strong>
          </div>
          <div>
            <p className="label">Parsed Lines</p>
            <strong>{(preview.data?.lineCount ?? 0).toLocaleString()}</strong>
          </div>
          </Toolbar>
        </AppBar>
        <main className="screen-frame">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
