import { InfoGrid } from "../../components/InfoGrid";

export function EncountersScreen() {
  return (
    <section className="screen-grid">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">History</p>
          <h1>Encounters</h1>
          <p>Review fight history, filter by boss or player, and export summaries.</p>
        </div>
      </div>
      <article className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Boss</th>
              <th>Duration</th>
              <th>Total Damage</th>
              <th>Top DPS</th>
              <th>Deaths</th>
              <th>Source File</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7}>No encounters recorded yet.</td>
            </tr>
          </tbody>
        </table>
      </article>
      <InfoGrid
        items={[
          {
            title: "Fight History",
            body: "Browse live and imported encounters together, with source file, duration, top player, deaths, and parser health.",
          },
          {
            title: "Review Workflow",
            body: "Rename, tag, archive, export, and later compare fights without losing raw event traceability.",
          },
          {
            title: "Filters",
            body: "Boss, date, player, duration, outcome, and log source filters keep large log libraries understandable.",
          },
        ]}
      />
    </section>
  );
}
