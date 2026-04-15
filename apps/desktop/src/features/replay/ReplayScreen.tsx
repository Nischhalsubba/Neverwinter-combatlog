import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Switch from "@mui/material/Switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreakdownBars } from "../../components/BreakdownBars";
import { DamageDetailPanel } from "../../components/DamageDetailPanel";
import { getImportedLogs, importLogFiles } from "../../ipc/api";
import { buildDamageRows } from "../../lib/damageRows";

export function ReplayScreen() {
  const queryClient = useQueryClient();
  const [showCompanions, setShowCompanions] = useState(true);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const importedLogs = useQuery({ queryKey: ["imported-logs"], queryFn: getImportedLogs });
  const importLogs = useMutation({
    mutationFn: importLogFiles,
    onSuccess: (data) => {
      queryClient.setQueryData(["imported-logs"], data);
      void queryClient.invalidateQueries({ queryKey: ["imported-logs"] });
    },
  });
  const visibleRows = useMemo(() => {
    return (importedLogs.data ?? [])
      .flatMap((log) =>
        buildDamageRows(log.partyDamage, log.companionDamage, showCompanions).map((row) => ({
          ...row,
          name: `${row.name} (${log.name})`,
        })),
      )
      .sort((left, right) => right.totalDamage - left.totalDamage)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [importedLogs.data, showCompanions]);
  const selectedMember = visibleRows.find((row) => row.name === selectedName) ?? visibleRows[0] ?? null;
  const visibleTotalDamage = visibleRows.reduce((sum, row) => sum + row.totalDamage, 0);

  return (
    <section className="dashboard-page">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Primary Workflow</p>
          <h1>Replay Recorded Logs</h1>
          <p>Import old combat logs and immediately see visual party damage, parser health, and log size before deeper encounter analysis.</p>
        </div>
        <Button onClick={() => importLogs.mutate()} variant="contained">
          Import Logs
        </Button>
      </div>
      <div className="summary-strip">
        <MetricSummary label="Imported Logs" value={(importedLogs.data?.length ?? 0).toLocaleString()} />
        <MetricSummary
          label="Total Lines"
          value={(importedLogs.data ?? []).reduce((sum, log) => sum + log.lineCount, 0).toLocaleString()}
        />
        <MetricSummary
          label="Parsed Lines"
          value={(importedLogs.data ?? []).reduce((sum, log) => sum + log.parsedCount, 0).toLocaleString()}
        />
        <MetricSummary
          label="Needs Review"
          value={(importedLogs.data ?? []).reduce((sum, log) => sum + log.failedCount, 0).toLocaleString()}
        />
        <MetricSummary
          label="Party Rows"
          value={(importedLogs.data ?? [])
            .reduce((sum, log) => sum + log.partyDamage.length + (showCompanions ? log.companionDamage.length : 0), 0)
            .toLocaleString()}
        />
      </div>
      <div className="dashboard-main">
        <section className="dashboard-column">
          <Card className="panel control-panel" component="article">
            <div>
              <h2>Replay Dashboard</h2>
              <p>Review imported logs visually first, then click any combatant for a power-by-power breakdown.</p>
            </div>
            <label className="switch-row">
              <span>Show companions in replay damage</span>
              <Switch checked={showCompanions} onChange={(_, checked) => setShowCompanions(checked)} />
            </label>
          </Card>
          <BreakdownBars
            title="Top Replay Damage"
            description="Total damage across imported logs. Click the detail list below to inspect one combatant."
            data={visibleRows.slice(0, 12).map((row, index) => ({
              label: `${row.rank}. ${row.name}${row.sourceKind === "companion" ? " (companion)" : ""}`,
              value: Math.round(row.totalDamage),
              tone: row.sourceKind === "companion" ? "tertiary" : index % 2 === 0 ? "primary" : "secondary",
            }))}
          />
          <BreakdownBars
            title="Companion Replay Leaderboard"
            description="Companion/entity damage remains visible as its own leaderboard."
            data={(importedLogs.data ?? [])
              .flatMap((log) => log.companionDamage.map((row) => ({ ...row, name: `${row.name} (${log.name})` })))
              .sort((left, right) => right.totalDamage - left.totalDamage)
              .slice(0, 10)
              .map((row, index) => ({
                label: `${index + 1}. ${row.name}`,
                value: Math.round(row.totalDamage),
                tone: index % 2 === 0 ? "tertiary" : "secondary",
              }))}
          />
        </section>
        <DamageDetailPanel member={selectedMember} totalDamage={visibleTotalDamage} />
      </div>
      <div className="content-grid">
        <Card className="panel" component="article">
          <h2>Imported Logs</h2>
          {!importedLogs.data?.length ? <p>No recorded logs imported yet.</p> : null}
          <div className="list-stack">
            {(importedLogs.data ?? []).map((log) => (
              <div className="list-item" key={log.path}>
                <strong>{log.name}</strong>
                <span>{log.lineCount.toLocaleString()} lines</span>
                <span>{log.parsedCount.toLocaleString()} parsed / {log.failedCount.toLocaleString()} review</span>
                <span>{Math.round(log.sizeBytes / 1024).toLocaleString()} KB</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="panel panel-large" component="article">
          <h2>Replay Ranking Details</h2>
          <div className="responsive-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Combatant</th>
                  <th>Type</th>
                  <th>Total Damage</th>
                  <th>Hits</th>
                  <th>Crit %</th>
                  <th>Top Power</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={`${row.sourceKind}-${row.name}`}
                    className={selectedMember?.name === row.name ? "selected-row" : undefined}
                    onClick={() => setSelectedName(row.name)}
                  >
                    <td>{row.rank}</td>
                    <td>{row.name}</td>
                    <td>{row.sourceKind}</td>
                    <td>{Math.round(row.totalDamage).toLocaleString()}</td>
                    <td>{row.hitCount.toLocaleString()}</td>
                    <td>{(row.critRate * 100).toFixed(1)}</td>
                    <td>{row.topPower ?? "-"}</td>
                  </tr>
                ))}
                {!visibleRows.length ? (
                  <tr>
                    <td colSpan={7}>Import a recorded log to show replay damage.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}

function MetricSummary({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <p className="label">{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
