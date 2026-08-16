export const FINGERPRINT_FEATURES = Object.freeze([
  'duration',
  'damageShare',
  'activeRatio',
  'critRate',
  'flankRate',
  'companionShare',
  'powerConcentration',
  'combatEfficiency'
]);

export function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, finite(value)));
}

export function percentile(values = [], p = 0.5) {
  const sorted = values.map(value => finite(value, Number.NaN)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = clamp(p, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function intervalSummary(values = []) {
  const clean = values.map(value => finite(value, Number.NaN)).filter(value => Number.isFinite(value) && value >= 0);
  if (!clean.length) return { count: 0, min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0, upperFence: 0 };
  const q1 = percentile(clean, 0.25);
  const median = percentile(clean, 0.5);
  const q3 = percentile(clean, 0.75);
  const iqr = Math.max(0, q3 - q1);
  return {
    count: clean.length,
    min: Math.min(...clean),
    q1,
    median,
    q3,
    max: Math.max(...clean),
    iqr,
    upperFence: Math.max(q3 + iqr * 1.5, median * 1.35)
  };
}

export function intervalsByPower(activations = []) {
  const byPower = new Map();
  for (const activation of activations || []) {
    const power = String(activation?.power || '').trim();
    const time = finite(activation?.time, Number.NaN);
    if (!power || !Number.isFinite(time)) continue;
    if (!byPower.has(power)) byPower.set(power, []);
    byPower.get(power).push(time);
  }
  const result = new Map();
  for (const [power, times] of byPower) {
    times.sort((a, b) => a - b);
    const gaps = [];
    for (let index = 1; index < times.length; index += 1) gaps.push(times[index] - times[index - 1]);
    result.set(power, { times, gaps });
  }
  return result;
}

export function fingerprintVector(player = {}, report = {}) {
  const damage = Math.max(0, finite(player.damage));
  const powers = (player.powers || []).map(power => Math.max(0, finite(power.damage))).sort((a, b) => b - a);
  const topThree = powers.slice(0, 3).reduce((sum, value) => sum + value, 0);
  const duration = Math.max(0, finite(player.duration || report.duration));
  const combatTime = Math.max(0, finite(player.combatTime));
  const dps = Math.max(0, finite(player.dps));
  const combatDps = Math.max(0, finite(player.combatDps));
  return {
    duration,
    damageShare: clamp(finite(player.damageShare) / 100),
    activeRatio: duration ? clamp(combatTime / duration) : 0,
    critRate: clamp(finite(player.crit) / 100),
    flankRate: clamp(finite(player.flank) / 100),
    companionShare: damage ? clamp(finite(player.companionDamage) / damage) : 0,
    powerConcentration: damage ? clamp(topThree / damage) : 0,
    combatEfficiency: dps ? clamp(combatDps / dps, 0, 4) : 0
  };
}

export function normalizeFingerprints(items = []) {
  const stats = {};
  for (const key of FINGERPRINT_FEATURES) {
    const values = items.map(item => finite(item.vector?.[key]));
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const variance = values.length ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length : 0;
    stats[key] = { mean, sd: Math.sqrt(variance) || 1 };
  }
  return {
    stats,
    items: items.map(item => ({
      ...item,
      normalized: Object.fromEntries(FINGERPRINT_FEATURES.map(key => [key, (finite(item.vector?.[key]) - stats[key].mean) / stats[key].sd]))
    }))
  };
}

export function fingerprintDistance(left = {}, right = {}) {
  const sum = FINGERPRINT_FEATURES.reduce((total, key) => total + ((finite(left[key]) - finite(right[key])) ** 2), 0);
  return Math.sqrt(sum / Math.max(1, FINGERPRINT_FEATURES.length));
}

export function similarityFromDistance(distance) {
  return 1 / (1 + Math.max(0, finite(distance)));
}

export function fingerprintSignature(vector = {}) {
  const text = FINGERPRINT_FEATURES.map(key => `${key}:${finite(vector[key]).toFixed(4)}`).join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function deviationReasons(item, stats, limit = 3) {
  const labels = {
    duration: 'fight duration',
    damageShare: 'party damage share',
    activeRatio: 'active-time ratio',
    critRate: 'critical-hit rate',
    flankRate: 'Combat Advantage rate',
    companionShare: 'companion damage share',
    powerConcentration: 'top-power concentration',
    combatEfficiency: 'Combat DPS / DPS ratio'
  };
  return FINGERPRINT_FEATURES.map(key => {
    const z = (finite(item.vector?.[key]) - finite(stats?.[key]?.mean)) / (finite(stats?.[key]?.sd) || 1);
    return { key, label: labels[key] || key, z, magnitude: Math.abs(z) };
  }).sort((a, b) => b.magnitude - a.magnitude).slice(0, Math.max(1, limit));
}

export function catalogFreshness(catalog = [], now = Date.now()) {
  const sources = new Map();
  let unsourced = 0;
  for (const effect of catalog || []) {
    const source = effect?.source;
    if (!source?.label) {
      unsourced += 1;
      continue;
    }
    const key = `${source.label}|${source.section || ''}|${source.updated || ''}`;
    if (!sources.has(key)) sources.set(key, { ...source, effects: 0 });
    sources.get(key).effects += 1;
  }
  const rows = [...sources.values()].map(source => {
    const timestamp = source.updated ? Date.parse(`${source.updated}T00:00:00Z`) : Number.NaN;
    const ageDays = Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 86400000)) : null;
    return { ...source, ageDays };
  }).sort((a, b) => (a.ageDays ?? Number.POSITIVE_INFINITY) - (b.ageDays ?? Number.POSITIVE_INFINITY));
  const dated = rows.filter(row => row.ageDays != null);
  return {
    sourceCount: rows.length,
    unsourcedEffects: unsourced,
    undatedSources: rows.filter(row => row.ageDays == null).length,
    newest: dated[0] || null,
    oldest: dated.at(-1) || null,
    staleSources: rows.filter(row => row.ageDays != null && row.ageDays > 365),
    sources: rows
  };
}
