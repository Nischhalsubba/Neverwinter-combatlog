import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MetricCard } from "../../components/MetricCard";
import { getLiveSourcePreview } from "../../ipc/api";
import { buildDamageRows } from "../../lib/damageRows";

export function PlayerDetailScreen() {
  const { playerName = "" } = useParams();
  const decodedName = decodeURIComponent(playerName);
  const preview = useQuery({
    queryKey: ["live-source-preview"],
    queryFn: getLiveSourcePreview,
    refetchInterval: 2500,
  });
  const rows = buildDamageRows(preview.data?.partyDamage ?? [], preview.data?.companionDamage ?? [], true);
  const member = rows.find((row) => row.name === decodedName) ?? null;
  const totalDamage = rows.reduce((sum, row) => sum + row.totalDamage, 0);
  const share = member && totalDamage > 0 ? member.totalDamage / totalDamage : 0;
  const topPowers = member?.powerBreakdown.slice(0, 10) ?? [];
  const trend = member?.damageTrend.length ? member.damageTrend : [0];
  const maxPowerDamage = Math.max(...topPowers.map((power) => power.totalDamage), 1);

  if (!member) {
    return (
      <section className="dashboard-page">
        <Card className="panel player-detail-hero" component="article">
          <p className="eyebrow">Combatant Detail</p>
          <h1>{decodedName || "Unknown combatant"}</h1>
          <p>This combatant is not in the current live damage set. Return to Live Combat and choose a row from the current leaderboard.</p>
          <Button component={Link} to="/live" variant="contained">
            Back to Live Combat
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <section className="dashboard-page">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">{member.sourceKind === "companion" ? "Companion Detail" : "Player Detail"}</p>
          <h1>{member.name}</h1>
          <p>Review contribution, burst pattern, critical rate, and power-by-power damage for this combatant.</p>
        </div>
        <div className="button-row">
          <Button component={Link} to="/live" variant="outlined">
            Back to Live Combat
          </Button>
          <Chip label={member.sourceKind} variant="outlined" />
        </div>
      </div>

      <div className="summary-strip">
        <MetricCard label="Rank" value={`#${member.rank}`} />
        <MetricCard label="Damage" value={Math.round(member.totalDamage).toLocaleString()} />
        <MetricCard label="Party Share" value={`${(share * 100).toFixed(1)}%`} />
        <MetricCard label="Hits" value={member.hitCount.toLocaleString()} />
        <MetricCard label="Crit Rate" value={`${(member.critRate * 100).toFixed(1)}%`} />
        <MetricCard label="Top Power" value={member.topPower ?? "No power"} />
      </div>

      <div className="player-detail-grid">
        <Card className="panel chart-card" component="article">
          <div className="panel-header">
            <div>
              <h2>Damage Spikes</h2>
              <p>Compressed damage trend from this combatant's parsed damaging events.</p>
            </div>
            <SparkLineChart
              aria-label={`${member.name} mini damage trend`}
              color="#0071e3"
              data={trend}
              height={44}
              width={130}
            />
          </div>
          <LineChart
            height={280}
            margin={{ bottom: 36, left: 72, right: 18, top: 18 }}
            series={[{ color: "#0071e3", data: trend, label: "Damage" }]}
            xAxis={[{ data: trend.map((_, index) => index + 1), scaleType: "point" }]}
          />
        </Card>

        <Card className="panel chart-card" component="article">
          <h2>Top Powers</h2>
          {topPowers.length ? (
            <BarChart
              borderRadius={6}
              height={280}
              layout="horizontal"
              margin={{ bottom: 36, left: 160, right: 24, top: 18 }}
              series={[
                {
                  color: "#5856d6",
                  data: topPowers.map((power) => Math.round(power.totalDamage)),
                  label: "Damage",
                },
              ]}
              yAxis={[{ data: topPowers.map((power) => truncateLabel(power.powerName, 22)), scaleType: "band" }]}
            />
          ) : (
            <p>No power breakdown is available for this combatant yet.</p>
          )}
        </Card>
      </div>

      <Card className="panel" component="article">
        <div className="panel-header">
          <div>
            <h2>Power Details</h2>
            <p>Damage, hit count, and relative contribution for each parsed power.</p>
          </div>
        </div>
        <Stack spacing={1.5}>
          {topPowers.map((power) => {
            const percent = maxPowerDamage ? (power.totalDamage / maxPowerDamage) * 100 : 0;
            return (
              <div className="power-detail-row" key={power.powerName}>
                <div>
                  <Typography component="strong">{power.powerName}</Typography>
                  <Typography color="text.secondary" variant="caption">
                    {power.hitCount.toLocaleString()} hits
                  </Typography>
                </div>
                <div>
                  <Typography component="strong">{Math.round(power.totalDamage).toLocaleString()}</Typography>
                  <LinearProgress aria-label={`${power.powerName} damage share`} value={percent} variant="determinate" />
                </div>
              </div>
            );
          })}
        </Stack>
      </Card>
    </section>
  );
}

function truncateLabel(label: string, maxLength: number) {
  return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label;
}
