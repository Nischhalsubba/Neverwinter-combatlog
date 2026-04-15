import { BreakdownBars } from "./BreakdownBars";
import { MetricCard } from "./MetricCard";
import type { PartyDamageDto } from "../ipc/api";

type DamageDetailPanelProps = {
  member: PartyDamageDto | null;
  totalDamage: number;
};

export function DamageDetailPanel({ member, totalDamage }: DamageDetailPanelProps) {
  if (!member) {
    return (
      <article className="panel member-detail-panel">
        <p className="eyebrow">Damage Detail</p>
        <h2>No combatant selected</h2>
        <p>Choose a combat log, then click a player or companion to review their damage profile.</p>
      </article>
    );
  }

  const share = totalDamage > 0 ? member.totalDamage / totalDamage : 0;

  return (
    <article className="panel member-detail-panel">
      <p className="eyebrow">{member.sourceKind === "companion" ? "Companion Detail" : "Member Detail"}</p>
      <h2>{member.name}</h2>
      <div className="detail-stat-grid">
        <MetricCard label="Damage" value={Math.round(member.totalDamage).toLocaleString()} />
        <MetricCard label="Share" value={`${(share * 100).toFixed(1)}%`} />
        <MetricCard label="Hits" value={member.hitCount.toLocaleString()} />
        <MetricCard label="Crit Rate" value={`${(member.critRate * 100).toFixed(1)}%`} />
      </div>
      <BreakdownBars
        title="Power Breakdown"
        description="Comprehensive damage breakdown by power for the selected combatant."
        data={member.powerBreakdown.slice(0, 12).map((power, index) => ({
          label: `${power.powerName} (${power.hitCount} hits)`,
          value: Math.round(power.totalDamage),
          tone: index % 3 === 0 ? "primary" : index % 3 === 1 ? "secondary" : "tertiary",
        }))}
      />
      <p className="detail-note">Top power: {member.topPower ?? "Not available from parsed rows yet"}</p>
    </article>
  );
}

