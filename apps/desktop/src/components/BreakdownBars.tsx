export type BreakdownDatum = {
  label: string;
  value: number;
  tone?: "primary" | "secondary" | "tertiary" | "error";
};

type BreakdownBarsProps = {
  title: string;
  description: string;
  data: BreakdownDatum[];
};

export function BreakdownBars({ title, description, data }: BreakdownBarsProps) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <article className="panel visual-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="bar-stack">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <div className="bar-label">
              <span>{item.label}</span>
              <strong>{item.value.toLocaleString()}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill bar-fill-${item.tone ?? "primary"}`}
                style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

