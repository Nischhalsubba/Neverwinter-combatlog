import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AiInsightPanel } from "../../components/AiInsightPanel";
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
      <section className="dashboard-page player-detail-page">
        <Card className="panel player-detail-hero" component="article">
          <p className="eyebrow">Combatant Detail</p>
          <h1>{decodedName || "Unknown combatant"}</h1>
          <p>This combatant is not in the current damage set. Return to Live and choose a row from the current board.</p>
          <Button component={Link} to="/live" variant="contained">
            Back to Live
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <section className="dashboard-page player-detail-page">
      <div className="breadcrumb-row">
        <Button component={Link} size="small" to="/live" variant="text">
          Live
        </Button>
        <span>/</span>
        <strong>{member.name}</strong>
      </div>

      <div className="player-detail-hero">
        <div>
          <p className="eyebrow">{member.sourceKind === "companion" ? "Companion Detail" : "Player Detail"}</p>
          <h1>{member.name}</h1>
          <p>Contribution, consistency, burst windows, critical profile, and power efficiency for this combatant.</p>
        </div>
        <div className="player-hero-score">
          <SparkLineChart
            aria-label={`${member.name} damage pulse`}
            color="#0f766e"
            data={trend}
            height={72}
            width={180}
          />
          <Typography component="strong">{Math.round(member.encDps).toLocaleString()}</Typography>
          <Typography color="text.secondary" variant="caption">EncDPS</Typography>
        </div>
        <div className="button-row">
          <Button component={Link} to="/live" variant="outlined">
            Back to Live
          </Button>
          <Chip label={member.sourceKind} variant="outlined" />
        </div>
      </div>

      <div className="player-kpi-strip">
        <MetricCard label="Rank" value={`#${member.rank}`} />
        <MetricCard label="Damage" value={Math.round(member.totalDamage).toLocaleString()} />
        <MetricCard label="EncDPS" value={Math.round(member.encDps).toLocaleString()} />
        <MetricCard label="Party Share" value={`${(share * 100).toFixed(1)}%`} />
        <MetricCard label="Hits" value={member.hitCount.toLocaleString()} />
        <MetricCard label="Crit Rate" value={`${(member.critRate * 100).toFixed(1)}%`} />
        <MetricCard label="Top Power" value={member.topPower ?? "No power"} />
      </div>

      <div className="player-detail-grid">
        <Card className="panel chart-card player-trend-card" component="article">
          <div className="panel-header">
            <div>
              <h2>Damage pacing</h2>
              <p>Compressed sequence of damaging events. Peaks show burst windows.</p>
            </div>
          </div>
          <LineChart
            height={300}
            margin={{ bottom: 36, left: 72, right: 18, top: 18 }}
            series={[{ color: "#0f766e", data: trend, label: "Damage" }]}
            xAxis={[{ data: trend.map((_, index) => index + 1), scaleType: "point" }]}
          />
        </Card>

        <Card className="panel chart-card player-power-card" component="article">
          <div>
            <h2>Power mix</h2>
            <p>How this combatant generated damage.</p>
          </div>
          {topPowers.length ? (
            <div className="power-mix-grid">
              <PieChart
                height={220}
                hideLegend
                series={[{
                  data: topPowers.slice(0, 5).map((power) => ({
                    id: power.powerName,
                    label: power.powerName,
                    value: Math.round(power.totalDamage),
                  })),
                  innerRadius: 48,
                  outerRadius: 88,
                }]}
              />
              <div className="power-mix-list">
                {topPowers.slice(0, 5).map((power, index) => (
                  <div key={power.powerName}>
                    <span>{index + 1}. {power.powerName}</span>
                    <strong>{Math.round(power.totalDamage).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No power breakdown is available for this combatant yet.</p>
          )}
        </Card>
      </div>

      <div className="player-lower-grid">
      <Card className="panel player-bars-card" component="article">
        <div className="panel-header">
          <div>
            <h2>Power leaderboard</h2>
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
      <AiInsightPanel preview={preview.data} selected={member} />
      </div>
    </section>
  );
}
