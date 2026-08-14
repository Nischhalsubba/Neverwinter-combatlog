const compactFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export function compact(value) {
  const n = Number(value) || 0;
  const a = Math.abs(n);
  if (a >= 1e9) return `${compactFormatter.format(n / 1e9)}B`;
  if (a >= 1e6) return `${compactFormatter.format(n / 1e6)}M`;
  if (a >= 1e3) return `${compactFormatter.format(n / 1e3)}K`;
  return integerFormatter.format(n);
}

export const pct = value => `${compactFormatter.format(Number(value) || 0)}%`;
export const integer = value => integerFormatter.format(Number(value) || 0);

export function summaryFromReport(report, playerRef, power) {
  const player = report?.players?.find(item => item.ref === playerRef) || null;
  const entry = player?.powers?.find(item => item.power === power) || null;
  if (!entry) return null;
  return { damage: entry.damage, hits: entry.hits, average: entry.avg, max: entry.max, crit: entry.crit, flank: entry.flank, share: entry.share };
}

export function summaryMarkup(summary) {
  if (!summary) return '';
  const entries = [
    ['Total damage', compact(summary.damage)], ['Hits', compact(summary.hits)], ['Average hit', compact(summary.average)],
    ['Biggest hit', compact(summary.max)], ['Critical hit rate', pct(summary.crit)], ['Flank / CA', pct(summary.flank)]
  ];
  return entries.map(([label, value]) => `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join('');
}
