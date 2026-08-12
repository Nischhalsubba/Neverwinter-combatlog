import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

type InfoGridItem = {
  title: string;
  body: string;
};

type InfoGridProps = {
  items: InfoGridItem[];
};

export function InfoGrid({ items }: InfoGridProps) {
  return (
    <div className="info-grid">
      {items.map((item) => (
        <Card className="panel info-card" component="article" key={item.title}>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            <Typography component="h2" variant="h6">
              {item.title}
            </Typography>
            <Typography color="text.secondary">{item.body}</Typography>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
