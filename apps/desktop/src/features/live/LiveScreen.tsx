import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import LinearProgress from "@mui/material/LinearProgress";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { PieChart } from "@mui/x-charts/PieChart";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreakdownBars } from "../../components/BreakdownBars";
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
  const companionDamage = (preview.data?.companionDamage ?? []).reduce((sum, row) => sum + row.totalDamage, 0);
  const playerDamage = Math.max(totalVisibleDamage - companionDamage, 0);

  return (
    <section className="dashboard-page">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Primary Workflow</p>
          <h1>Live Combat</h1>
          <p>Pick a combat log, then read the fight from left to right: total damage, member breakdown, companion contribution, and parser health.</p>
        </div>
        <div className="button-row">
          <Button onClick={() => chooseFolder.mutate()} variant="outlined">
            Choose Log Folder
          </Button>
          <Button onClick={() => chooseFile.mutate()} variant="outlined">
            Choose Log File
          </Button>
          <Button onClick={() => openWidget.mutate()} variant="outlined">
            Open Widget
          </Button>
          <Button onClick={() => closeWidget.mutate()} variant="outlined">
            Close Widget
          </Button>
          <Button onClick={() => resetCounter.mutate()} variant="contained">
            Refresh Counter
          </Button>
        </div>
      </div>

      <div className="summary-strip">
        <MetricCard label="Visible Combatants" value={visibleDamageRows.length.toLocaleString()} />
        <MetricCard label="Visible Damage" value={Math.round(totalVisibleDamage).toLocaleString()} />
        <MetricCard label="Lines Read" value={(preview.data?.lineCount ?? 0).toLocaleString()} helper="Live source" />
        <MetricCard label="Parsed Lines" value={(preview.data?.parsedCount ?? 0).toLocaleString()} />
        <MetricCard label="Needs Review" value={(preview.data?.failedCount ?? 0).toLocaleString()} />
      </div>

      <div className="dashboard-main">
        <section className="dashboard-column">
          <Card className="panel control-panel" component="article">
            <div>
              <h2>Damage Dashboard</h2>
              <p>
                {source.data?.state === "watching"
                  ? `Counting from ${preview.data?.path ?? "selected log"}`
                  : "Choose a log to start live counting."}
              </p>
            </div>
            <label className="switch-row">
              <span>Show companions in main damage</span>
              <Switch checked={showCompanions} onChange={(_, checked) => setShowCompanions(checked)} />
            </label>
          </Card>

          <Card className="panel visual-panel" component="article">
            <div className="panel-header">
              <div>
                <h2>Party Damage</h2>
                <p>{damageTab === "current" ? "Current counter since last refresh." : "Past counters saved when Refresh Counter was pressed."}</p>
              </div>
              <div className="tab-row">
                <button className={damageTab === "current" ? "tab tab-active" : "tab"} onClick={() => setDamageTab("current")} type="button">
                  Current
                </button>
                <button className={damageTab === "history" ? "tab tab-active" : "tab"} onClick={() => setDamageTab("history")} type="button">
                  History
                </button>
              </div>
            </div>
            {damageTab === "current" ? (
              <BreakdownBars
                title="Current Damage"
                description="Click a row in the table for detailed power breakdown."
                data={visibleDamageRows.map((row, index) => ({
                  label: `${row.rank}. ${row.name}${row.sourceKind === "companion" ? " (companion)" : ""}`,
                  value: Math.round(row.totalDamage),
                  tone: row.sourceKind === "companion" ? "tertiary" : index % 2 === 0 ? "primary" : "secondary",
                }))}
              />
            ) : (
              <div className="history-list">
                {(preview.data?.history ?? []).map((record) => (
                  <article className="history-item" key={record.id}>
                    <div>
                      <strong>{record.title}</strong>
                      <span>{record.lineCount.toLocaleString()} lines / {record.parsedCount.toLocaleString()} parsed</span>
                    </div>
                    <strong>{Math.round(record.totalDamage).toLocaleString()}</strong>
                  </article>
                ))}
                {!preview.data?.history.length ? <p>No previous counters yet. Press Refresh Counter after damage is shown to save one.</p> : null}
              </div>
            )}
          </Card>

          <BreakdownBars
            title="Companion Damage Leaderboard"
            description="Companion/entity damage is separated so it can be reviewed without hiding player performance."
            data={(preview.data?.companionDamage ?? []).map((row, index) => ({
              label: `${row.rank}. ${row.name}`,
              value: Math.round(row.totalDamage),
              tone: index % 2 === 0 ? "tertiary" : "secondary",
            }))}
          />
        </section>

        <DamageDetailPanel member={selectedMember} totalDamage={totalVisibleDamage} />
      </div>

      <div className="content-grid">
        <Card className="panel panel-large" component="article">
          <div className="panel-header">
            <h2>Party Ranking Details</h2>
            <StatusBadge tone={source.data?.state === "watching" ? "good" : "warning"}>
              {source.data?.message ?? "No source selected"}
            </StatusBadge>
          </div>
          <div className="responsive-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Total Damage</th>
                  <th>Hits</th>
                  <th>Crit %</th>
                  <th>Top Power</th>
                </tr>
              </thead>
              <tbody>
                {visibleDamageRows.map((row) => (
                  <tr
                    key={`${row.sourceKind}-${row.name}`}
                    className={selectedMember?.name === row.name ? "selected-row" : undefined}
                    onClick={() => setSelectedName(row.name)}
                  >
                    <td>{row.rank}</td>
                    <td>{row.name}</td>
                    <td>{Math.round(row.totalDamage).toLocaleString()}</td>
                    <td>{row.hitCount.toLocaleString()}</td>
                    <td>{(row.critRate * 100).toFixed(1)}</td>
                    <td>{row.topPower ?? "-"}</td>
                  </tr>
                ))}
                {!visibleDamageRows.length ? (
                  <tr>
                    <td colSpan={6}>Choose a combat log to show party damage.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <aside className="insight-stack">
          <Card className="panel parser-health-compact" component="article">
            <div>
              <p className="eyebrow">Parser Health</p>
              <h2>{source.data?.state === "watching" ? "Watching" : "Waiting"}</h2>
              <p>{source.data?.message ?? "No source selected"}</p>
            </div>
            <div className="health-meter">
              {preview.data?.lineCount ? Math.round(((preview.data.parsedCount ?? 0) / preview.data.lineCount) * 100) : 0}%
            </div>
          </Card>
          <Card className="panel" component="article">
            <h2>Recent Events</h2>
            {!preview.data?.recentEvents.length ? <p>No events received yet.</p> : null}
            <div className="compact-event-list">
              {(preview.data?.recentEvents ?? []).slice(-5).map((event, index) => (
                <div className="compact-event" key={`${event.timestamp}-${event.classification}-${index}`}>
                  <strong>{event.classification}</strong>
                  <span>{event.summary}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="panel" component="article">
            <h2>Damage Mix</h2>
            <div className="donut-row">
              <PieChart
                height={120}
                hideLegend
                margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
                series={[
                  {
                    data: [
                      { id: "players", label: "Players", value: playerDamage },
                      { id: "companions", label: "Companions", value: companionDamage },
                    ],
                    innerRadius: 34,
                    outerRadius: 55,
                  },
                ]}
                width={120}
              />
              <div>
                <strong>{(companionShare(preview.data?.companionDamage ?? [], totalVisibleDamage) * 100).toFixed(1)}%</strong>
                <p>Companion share while visible.</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <BreakdownBars
        title="Log Classification"
        description="Every line is counted. Unknown or failed rows stay visible for parser debugging."
        data={(preview.data?.classificationCounts ?? []).map((item, index) => ({
          label: item.classification,
          value: item.count,
          tone: index % 3 === 0 ? "primary" : index % 3 === 1 ? "secondary" : "tertiary",
        }))}
      />

      {widget.data?.isOpen ? (
        <FloatingLiveWidget
          failedCount={preview.data?.failedCount ?? 0}
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

function FloatingLiveWidget({
  failedCount,
  leader,
  lineCount,
  onClose,
  totalDamage,
}: {
  failedCount: number;
  leader: ReturnType<typeof buildDamageRows>[number] | null;
  lineCount: number;
  onClose: () => void;
  totalDamage: number;
}) {
  return (
    <Card className="floating-live-widget" elevation={6}>
      <div className="floating-live-widget-header">
        <img alt="Nexus Combat Analyzer" src={logoUrl} />
        <div>
          <Typography component="strong" variant="subtitle2">
            Nexus Widget
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
          Visible damage
        </Typography>
        <Typography variant="h5">{Math.round(totalDamage).toLocaleString()}</Typography>
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
