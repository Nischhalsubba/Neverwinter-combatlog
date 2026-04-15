import { BreakdownBars } from "../../components/BreakdownBars";
import { InfoGrid } from "../../components/InfoGrid";

const tabs = [
  "Summary",
  "Damage Done",
  "Damage Taken",
  "Healing",
  "Powers",
  "Mechanics",
  "Pets / Entities",
  "Raw Events",
  "Debug",
];

export function EncounterDetailScreen() {
  return (
    <section className="screen-grid">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Encounter Detail</p>
          <h1>Encounter Analysis</h1>
          <p>Deep analysis tabs preserve raw events, parser transparency, and normalized metrics.</p>
        </div>
      </div>
      <div className="tab-row" role="tablist" aria-label="Encounter detail tabs">
        {tabs.map((tab, index) => (
          <button key={tab} className={index === 0 ? "tab tab-active" : "tab"} type="button">
            {tab}
          </button>
        ))}
      </div>
      <article className="panel">
        <h2>Summary</h2>
        <p>Select an encounter to inspect rankings, powers, mechanics, raw rows, and parser debug output.</p>
      </article>
      <div className="content-grid">
        <BreakdownBars
          title="Damage Shape"
          description="Visual fight breakdowns will make boss damage, add damage, pet damage, and shield absorption easier to compare."
          data={[
            { label: "Boss damage", value: 0, tone: "primary" },
            { label: "Add damage", value: 0, tone: "secondary" },
            { label: "Pet damage", value: 0, tone: "tertiary" },
            { label: "Shield absorbed", value: 0, tone: "error" },
          ]}
        />
        <InfoGrid
          items={[
            {
              title: "Raw Events",
              body: "Every log line remains available with parser status, normalized fields, and error details.",
            },
            {
              title: "Mechanics",
              body: "Deaths, avoids, deflects, flanks, cleanses, control results, and support rows are separated from damage totals.",
            },
          ]}
        />
      </div>
    </section>
  );
}
