import { MetricCard } from "../../components/MetricCard";
import { InfoGrid } from "../../components/InfoGrid";

const presets = ["Minimal", "Personal", "Party", "Raid Lead", "Support"];

export function WidgetBuilderScreen() {
  return (
    <section className="screen-grid">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Live Widget</p>
          <h1>Widget Builder</h1>
          <p>Customize content, layout, appearance, behavior, and presets for active gameplay.</p>
        </div>
      </div>
      <div className="content-grid">
        <article className="panel">
          <h2>Presets</h2>
          <div className="chip-row">
            {presets.map((preset) => (
              <button key={preset} className="assist-chip" type="button">{preset}</button>
            ))}
          </div>
          <h3>Content</h3>
          <p>Encounter name, timer, ENC DPS, total damage, boss damage, active DPS, crit %, pet damage, healing, deaths, damage taken, top power, and player name.</p>
        </article>
        <article className="panel panel-large">
          <h2>Preview</h2>
          <div className="widget-preview">
            <MetricCard label="Encounter" value="Waiting" />
            <MetricCard label="ENC DPS" value="0" />
            <MetricCard label="Top Power" value="-" />
          </div>
        </article>
      </div>
      <InfoGrid
        items={[
          {
            title: "Behavior",
            body: "Always on top, lock position, click-through, auto-hide, show only during combat, hotkey toggle, and self pin are planned as persistent controls.",
          },
          {
            title: "Appearance",
            body: "Opacity, dark/light mode, accent color, row height, font scale, corners, and border settings will save into presets.",
          },
          {
            title: "Modes",
            body: "Minimal, Personal, Party, Raid Lead, and Support presets keep the widget understandable during active gameplay.",
          },
        ]}
      />
    </section>
  );
}
