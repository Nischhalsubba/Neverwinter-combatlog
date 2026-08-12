import type { ReactNode } from "react";
import Chip from "@mui/material/Chip";

type StatusBadgeProps = {
  tone?: "neutral" | "good" | "warning" | "danger";
  children: ReactNode;
};

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  const color = tone === "good" ? "success" : tone === "warning" ? "warning" : tone === "danger" ? "error" : "default";

  return <Chip className={`status-badge status-badge-${tone}`} color={color} label={children} size="small" variant="outlined" />;
}
