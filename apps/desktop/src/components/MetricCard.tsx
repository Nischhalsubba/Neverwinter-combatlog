import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Card className="metric-card">
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Typography className="label" component="p" variant="caption">
          {label}
        </Typography>
        <Typography component="strong" variant="h5">
          {value}
        </Typography>
        {helper ? (
          <Typography component="span" variant="caption">
            {helper}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
