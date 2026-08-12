import { MetricCard } from "../../components/MetricCard";
import { InfoGrid } from "../../components/InfoGrid";
import Chip from "@mui/material/Chip";
import { useQuery } from "@tanstack/react-query";
import { getLiveSourcePreview, getWidgetStatus } from "../../ipc/api";

const presets = ["Minimal", "Personal", "Party", "Raid Lead", "Support"];

export function WidgetBuilderScreen() {
  const preview = useQuery({ queryKey: ["live-source-preview"], queryFn: getLiveSourcePreview, refetchInterval: 2500 });
  const widget = useQuery({ queryKey: ["widget-status"], queryFn: getWidgetStatus });
  const topDamage = preview.data?.partyDamage[0];

  return (
    <section className="screen-grid">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Widget</p>
          <h1>Small fight view</h1>
          <p>{widget.data?.isOpen ? "The widget is visible." : "Open the widget from Live to keep core numbers nearby."}</p>
        </div>
      </div>
      <div className="content-grid">
        <article className="panel">
          <h2>Modes</h2>
          <div className="chip-row">
            {presets.map((preset) => (
              <Chip key={preset} label={preset} variant="outlined" />
            ))}
          </div>
          <h3>Content</h3>
          <p>
            Current live source has {(preview.data?.lineCount ?? 0).toLocaleString()} counted lines,
            {(preview.data?.parsedCount ?? 0).toLocaleString()} parsed events, and
            {(preview.data?.failedCount ?? 0).toLocaleString()} rows needing review.
          </p>
        </article>
        <article className="panel panel-large">
          <h2>Live Preview</h2>
          <div className="widget-preview">
            <MetricCard label="Visible Damage" value={Math.round((preview.data?.partyDamage ?? []).reduce((sum, row) => sum + row.totalDamage, 0)).toLocaleString()} />
            <MetricCard label="Leader" value={topDamage?.name ?? "No combatant"} />
            <MetricCard label="Top Power" value={topDamage?.topPower ?? "No power yet"} />
          </div>
        </article>
      </div>
      <InfoGrid
        items={[
          {
            title: "Behavior",
            body: widget.data?.isOpen ? "Always-on-top widget window is currently active." : "Widget window is currently closed.",
          },
          {
            title: "Appearance",
            body: "Compact Astral Combat styling keeps the numbers readable.",
          },
          {
            title: "Modes",
            body: `${presets.length} presets are available for live combat review.`,
          },
        ]}
      />
    </section>
  );
}
