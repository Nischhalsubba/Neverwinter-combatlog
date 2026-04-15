import type { PartyDamageDto } from "../ipc/api";

export function buildDamageRows(
  players: PartyDamageDto[],
  companions: PartyDamageDto[],
  includeCompanions: boolean,
) {
  const merged = players.map(cloneDamageRow);

  if (includeCompanions) {
    for (const companion of companions) {
      const ownerIndex = findOwnerIndex(merged, companion.ownerName);

      if (ownerIndex >= 0) {
        mergeCompanionIntoOwner(merged[ownerIndex], companion);
      } else {
        merged.push(cloneDamageRow(companion));
      }
    }
  }

  return merged
    .sort((left, right) => right.totalDamage - left.totalDamage)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function findOwnerIndex(rows: PartyDamageDto[], ownerName: string | null) {
  if (!ownerName) {
    return -1;
  }

  const normalizedOwner = normalizeName(ownerName);
  return rows.findIndex((row) => normalizeName(row.name) === normalizedOwner);
}

function mergeCompanionIntoOwner(owner: PartyDamageDto, companion: PartyDamageDto) {
  owner.totalDamage += companion.totalDamage;
  owner.hitCount += companion.hitCount;
  owner.critCount += companion.critCount;
  owner.critRate = owner.hitCount > 0 ? owner.critCount / owner.hitCount : 0;
  owner.powerBreakdown = mergePowerBreakdowns(owner.powerBreakdown, companion.powerBreakdown);
  owner.topPower = owner.powerBreakdown[0]?.powerName ?? owner.topPower;
}

function mergePowerBreakdowns(
  left: PartyDamageDto["powerBreakdown"],
  right: PartyDamageDto["powerBreakdown"],
) {
  const byPower = new Map<string, { powerName: string; totalDamage: number; hitCount: number }>();

  for (const power of [...left, ...right]) {
    const existing = byPower.get(power.powerName) ?? {
      powerName: power.powerName,
      totalDamage: 0,
      hitCount: 0,
    };
    existing.totalDamage += power.totalDamage;
    existing.hitCount += power.hitCount;
    byPower.set(power.powerName, existing);
  }

  return Array.from(byPower.values()).sort((a, b) => b.totalDamage - a.totalDamage);
}

function cloneDamageRow(row: PartyDamageDto): PartyDamageDto {
  return {
    ...row,
    powerBreakdown: row.powerBreakdown.map((power) => ({ ...power })),
  };
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

