import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

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
    <Card className="panel visual-panel" component="article">
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <div className="panel-header">
          <div>
            <Typography component="h2" variant="h6">
              {title}
            </Typography>
            <Typography color="text.secondary">{description}</Typography>
          </div>
        </div>
        <Stack className="bar-stack" spacing={1.5}>
          {data.map((item) => {
            const value = Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0);
            return (
              <div className="bar-row" key={item.label}>
                <div className="bar-label">
                  <Typography component="span" variant="body2">
                    {item.label}
                  </Typography>
                  <Typography component="strong" variant="body2">
                    {item.value.toLocaleString()}
                  </Typography>
                </div>
                <LinearProgress
                  className={`bar-progress bar-progress-${item.tone ?? "primary"}`}
                  aria-label={`${item.label}: ${item.value.toLocaleString()}`}
                  value={value}
                  variant="determinate"
                />
              </div>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
