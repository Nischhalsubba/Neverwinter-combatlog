import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import LinearProgress from "@mui/material/LinearProgress";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AiInsightPanel } from "../../components/AiInsightPanel";
import { DamageDetailPanel } from "../../components/DamageDetailPanel";
import { MetricCard } from "../../components/MetricCard";
import { StatusBadge } from "../../components/StatusBadge";
import logoUrl from "../../assets/nexus-logo.png";
import { buildDamageRows } from "../../lib/damageRows";
import {
  chooseLiveLogFile,
  chooseLiveLogFolder,
  closeWidgetWindow,
  getLiveSourcePreview,
  getSourceStatus,
  getWidgetStatus,
  openWidgetWindow,
  resetLiveCounter,
} from "../../ipc/api";

export function LiveScreen() {
  const queryClient = useQueryClient();
  const [showCompanions, setShowCompanions] = useState(true);
  const [damageTab, setDamageTab] = useState<"current" | "history">("current");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const source = useQuery({ queryKey: ["source-status"], queryFn: getSourceStatus });
  const preview = useQuery({
    queryKey: ["live-source-preview"],
    queryFn: getLiveSourcePreview,
    refetchInterval: source.data?.state === "watching" ? 2500 : false,
  });
  const widget = useQuery({ queryKey: ["widget-status"], queryFn: getWidgetStatus });
  const chooseFolder = useMutation({
    mutationFn: chooseLiveLogFolder,
    onSuccess: (data) => {
      queryClient.setQueryData(["source-status"], data);
      void queryClient.invalidateQueries({ queryKey: ["source-status"] });
      void queryClient.invalidateQueries({ queryKey: ["live-source-preview"] });
    },
  });
  const chooseFile = useMutation({
    mutationFn: chooseLiveLogFile,
    onSuccess: (data) => {
      queryClient.setQueryData(["source-status"], data);
      void queryClient.invalidateQueries({ queryKey: ["source-status"] });
      void queryClient.invalidateQueries({ queryKey: ["live-source-preview"] });
    },
  });
  const openWidget = useMutation({
    mutationFn: openWidgetWindow,
    onSuccess: (data) => queryClient.setQueryData(["widget-status"], data),
  });
  const closeWidget = useMutation({
    mutationFn: closeWidgetWindow,
    onSuccess: (data) => queryClient.setQueryData(["widget-status"], data),
  });
  const resetCounter = useMutation({
    mutationFn: resetLiveCounter,
    onSuccess: (data) => {
      setSelectedName(null);
      setDamageTab("current");
      queryClient.setQueryData(["live-source-preview"], data);
      void queryClient.invalidateQueries({ queryKey: ["live-source-preview"] });
    },
  });
  const visibleDamageRows = useMemo(() => {
    return buildDamageRows(preview.data?.partyDamage ?? [], preview.data?.companionDamage ?? [], showCompanions);
  }, [preview.data?.companionDamage, preview.data?.partyDamage, showCompanions]);
  const selectedMember =
    visibleDamageRows.find((row) => row.name === selectedName) ?? visibleDamageRows[0] ?? null;
  const totalVisibleDamage = visibleDamageRows.reduce((sum, row) => sum + row.totalDamage, 0);
  const visibleEncDps = preview.data?.durationSeconds
    ? totalVisibleDamage / preview.data.durationSeconds
    : totalVisibleDamage;
  const rawPlayerDamage = (preview.data?.partyDamage ?? []).reduce((sum, row) => sum + row.totalDamage, 0);
  const rawCompanionDamage = (preview.data?.companionDamage ?? []).reduce((sum, row) => sum + row.totalDamage, 0);
  const allDamage = rawPlayerDamage + rawCompanionDamage;
  const visibleHits = visibleDamageRows.reduce((sum, row) => sum + row.hitCount, 0);
  const visibleCrits = visibleDamageRows.reduce((sum, row) => sum + row.critCount, 0);
  const visibleCritRate = visibleHits > 0 ? visibleCrits / visibleHits : 0;
  const activePlayers = visibleDamageRows.filter((row) => row.sourceKind !== "companion").length;
  const combatantCount = visibleDamageRows.length;
  const eventCount = preview.data?.parsedCount ?? 0;
  const parseQuality = eventCount + (preview.data?.failedCount ?? 0) > 0
    ? eventCount / (eventCount + (preview.data?.failedCount ?? 0))
    : 0;
  const topDamageRows = visibleDamageRows.slice(0, 8);
  const sourceMixTotal = Math.max(allDamage, 0);

  return (
    <section className="live-command-page">
      <header className="live-command-header">
        <div>
          <p className="eyebrow">Live Analysis</p>
          <h1>Encounter command center</h1>
          <p>{source.data?.message ?? "Choose a log file to analyze party-wide combat performance."}</p>
        </div>
        <div className="button-row">
          <Button onClick={() => chooseFile.mutate()} variant="contained">Log File</Button>
          <Button onClick={() => chooseFolder.mutate()} variant="outlined">Log Folder</Button>
          <Button onClick={() => resetCounter.mutate()} variant="outlined">New Fight</Button>
          <Button onClick={() => (widget.data?.isOpen ? closeWidget.mutate() : openWidget.mutate())} variant="outlined">
            {widget.data?.isOpen ? "Hide Widget" : "Show Widget"}
          </Button>
        </div>
      </header>

      <div className="live-metrics-strip">
        <MetricCard label="Party Damage" value={Math.round(totalVisibleDamage).toLocaleString()} helper={showCompanions ? "Players + companions" : "Players only"} />
        <MetricCard label="Party EncDPS" value={Math.round(visibleEncDps).toLocaleString()} helper="All visible damage per second" />
        <MetricCard label="Fight Time" value={formatDuration(preview.data?.durationSeconds ?? 0)} helper="First hit to last hit" />
        <MetricCard label="Damage Events" value={visibleHits.toLocaleString()} helper={`${eventCount.toLocaleString()} parsed rows`} />
        <MetricCard label="Active Players" value={activePlayers.toLocaleString()} helper={`${combatantCount.toLocaleString()} total combatants`} />
        <MetricCard label="Party Crit Rate" value={`${(visibleCritRate * 100).toFixed(1)}%`} helper={`${visibleCrits.toLocaleString()} crit hits`} />
        <MetricCard label="Parse Quality" value={`${(parseQuality * 100).toFixed(1)}%`} helper={`${(preview.data?.failedCount ?? 0).toLocaleString()} rows need review`} />
        <MetricCard label="Pet Share" value={`${(companionShare(preview.data?.companionDamage ?? [], allDamage) * 100).toFixed(1)}%`} helper={showCompanions ? "Included in party" : "Separated"} />
      </div>

      <main className="live-command-grid">
        <section className="live-primary-stack">
          <Card className="panel live-chart-panel" component="article">
            <div className="panel-header">
              <div>
              <h2>Damage distribution</h2>
              <p>Every combatant with parsed damage, sorted by contribution.</p>
              </div>
              <StatusBadge tone={source.data?.state === "watching" ? "good" : "warning"}>
                {source.data?.state === "watching" ? "Reading" : "No source"}
              </StatusBadge>
            </div>
            {topDamageRows.length ? (
              <BarChart
                borderRadius={6}
                height={250}
                margin={{ bottom: 48, left: 70, right: 18, top: 12 }}
                series={[{ color: "#0f766e", data: topDamageRows.map((row) => Math.round(row.totalDamage)), label: "Damage" }]}
                xAxis={[{ data: topDamageRows.map((row) => shortName(row.name)), scaleType: "band" }]}
              />
            ) : (
              <div className="empty-live-state">
                <strong>No combat loaded</strong>
                <span>Click Log File and choose a Neverwinter combat log.</span>
              </div>
            )}
          </Card>

          <Card className="panel live-table-panel" component="article">
            <div className="panel-header">
              <div>
                <h2>Combatant ledger</h2>
                <p>Click a row for the inspector, or open the full detail page.</p>
              </div>
              <label className="compact-switch-row">
                <span>Merge companions</span>
                <Switch checked={showCompanions} onChange={(_, checked) => setShowCompanions(checked)} />
              </label>
            </div>
            <div className="responsive-table-wrap live-table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Damage</th>
                    <th>EncDPS</th>
                    <th>Crit</th>
                    <th>Trend</th>
                    <th>Power</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDamageRows.map((row) => (
                    <tr key={`${row.sourceKind}-${row.name}`} className={selectedMember?.name === row.name ? "selected-row" : undefined} onClick={() => setSelectedName(row.name)}>
                      <td>{row.rank}</td>
                      <td>
                        <Button component={Link} onClick={(event) => event.stopPropagation()} size="small" to={`/live/players/${encodeURIComponent(row.name)}`} variant="text">
                          {row.name}
                        </Button>
                      </td>
                      <td>{Math.round(row.totalDamage).toLocaleString()}</td>
                      <td>{Math.round(row.encDps).toLocaleString()}</td>
                      <td>{(row.critRate * 100).toFixed(1)}%</td>
                      <td>
                        <SparkLineChart aria-label={`${row.name} damage trend`} color="#0f766e" data={row.damageTrend.length ? row.damageTrend : [0]} height={28} width={92} />
                      </td>
                      <td>{row.topPower ?? "-"}</td>
                    </tr>
                  ))}
                  {!visibleDamageRows.length ? (
                    <tr>
                      <td colSpan={7}>No player damage yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <aside className="live-side-stack">
          <DamageDetailPanel member={selectedMember} totalDamage={totalVisibleDamage} />
          <AiInsightPanel preview={preview.data} selected={selectedMember} />
          <Card className="panel live-mini-panel" component="article">
            <h2>Players vs companions</h2>
            <div className="live-mix-row">
              <PieChart
                height={132}
                hideLegend
                margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
                series={[{ data: [{ id: "players", label: "Players", value: Math.max(rawPlayerDamage, 0) }, { id: "companions", label: "Companions", value: Math.max(rawCompanionDamage, 0) }], innerRadius: 34, outerRadius: 58 }]}
                width={132}
              />
              <div className="source-mix-list">
                <div>
                  <span>Players</span>
                  <strong>{Math.round(rawPlayerDamage).toLocaleString()}</strong>
                  <LinearProgress value={sourceMixTotal ? (rawPlayerDamage / sourceMixTotal) * 100 : 0} variant="determinate" />
                </div>
                <div>
                  <span>Companions</span>
                  <strong>{Math.round(rawCompanionDamage).toLocaleString()}</strong>
                  <LinearProgress value={sourceMixTotal ? (rawCompanionDamage / sourceMixTotal) * 100 : 0} variant="determinate" />
                </div>
              </div>
            </div>
          </Card>
          <Card className="panel live-mini-panel" component="article">
            <div className="panel-header">
              <h2>Saved fights</h2>
              <button className={damageTab === "history" ? "tab tab-active" : "tab"} onClick={() => setDamageTab(damageTab === "history" ? "current" : "history")} type="button">
                {damageTab === "history" ? "Hide" : "Show"}
              </button>
            </div>
            {damageTab === "history" ? (
              <div className="history-list live-history-scroll">
                {(preview.data?.history ?? []).map((record) => (
                  <article className="history-item" key={record.id}>
                    <div>
                      <strong>{record.title}</strong>
                      <span>{record.lineCount.toLocaleString()} lines</span>
                    </div>
                    <strong>{Math.round(record.totalDamage).toLocaleString()}</strong>
                  </article>
                ))}
                {!preview.data?.history.length ? <p>No saved fights yet.</p> : null}
              </div>
            ) : (
              <p>Use New Fight to save the current counter and start fresh.</p>
            )}
          </Card>
        </aside>
      </main>

      {widget.data?.isOpen ? (
        <FloatingLiveWidget
          failedCount={preview.data?.failedCount ?? 0}
          encDps={visibleEncDps}
          leader={visibleDamageRows[0] ?? null}
          lineCount={preview.data?.lineCount ?? 0}
          onClose={() => closeWidget.mutate()}
          totalDamage={totalVisibleDamage}
        />
      ) : null}
    </section>
  );
}

function companionShare(companions: Array<{ totalDamage: number }>, totalDamage: number) {
  if (totalDamage <= 0) {
    return 0;
  }

  return companions.reduce((sum, row) => sum + row.totalDamage, 0) / totalDamage;
}

function shortName(name: string) {
  return name.length > 14 ? `${name.slice(0, 13)}...` : name;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "0s";
  }

  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function FloatingLiveWidget({
  failedCount,
  encDps,
  leader,
  lineCount,
  onClose,
  totalDamage,
}: {
  failedCount: number;
  encDps: number;
  leader: ReturnType<typeof buildDamageRows>[number] | null;
  lineCount: number;
  onClose: () => void;
  totalDamage: number;
}) {
  return (
    <Card className="floating-live-widget" elevation={6}>
      <div className="floating-live-widget-header">
        <img alt="Astral Combat" src={logoUrl} />
        <div>
          <Typography component="strong" variant="subtitle2">
            Astral Widget
          </Typography>
          <Typography color="text.secondary" variant="caption">
            Live combat
          </Typography>
        </div>
        <Button onClick={onClose} size="small" variant="text">
          Close
        </Button>
      </div>
      <div className="floating-live-widget-stat">
        <Typography color="text.secondary" variant="caption">
          EncDPS
        </Typography>
        <Typography variant="h5">{Math.round(encDps).toLocaleString()}</Typography>
        <Typography color="text.secondary" variant="caption">
          {Math.round(totalDamage).toLocaleString()} total damage
        </Typography>
      </div>
      <div className="floating-live-widget-stat">
        <Typography color="text.secondary" variant="caption">
          Leader
        </Typography>
        <Typography>{leader?.name ?? "No combatant"}</Typography>
        <LinearProgress
          aria-label="leader damage"
          value={leader ? 100 : 0}
          variant="determinate"
        />
      </div>
      <div className="floating-live-widget-grid">
        <div>
          <Typography color="text.secondary" variant="caption">
            Lines
          </Typography>
          <Typography>{lineCount.toLocaleString()}</Typography>
        </div>
        <div>
          <Typography color="text.secondary" variant="caption">
            Review
          </Typography>
          <Typography>{failedCount.toLocaleString()}</Typography>
        </div>
      </div>
    </Card>
  );
}

