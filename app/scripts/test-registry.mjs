import { spawnSync } from 'node:child_process';

const groups = Object.freeze({
  engine: [
    'smoke-test.mjs','parser-regression.mjs','entity-ref-regression.mjs','verification-regression.mjs','scope-regression.mjs',
    'real-log-fixture-regression.mjs','real-log-corpus-regression.mjs','boss-effects-regression.mjs','combat-effects-regression.mjs',
    'support-effect-catalog-regression.mjs','effect-intelligence-regression.mjs','catalog-freshness-regression.mjs'
  ],
  evidence: [
    'classification-evidence-regression.mjs','entity-evidence-regression.mjs','reference-parity-regression.mjs',
    'nwhub-captured-parity-regression.mjs','legacy-engine-parity-regression.mjs','accuracy-hardening-regression.mjs',
    'semantic-guidance-regression.mjs','evidence-coverage-regression.mjs','next-level-regression.mjs'
  ],
  ui: [
    'v6-regression.mjs','copy-regression.mjs','performance-regression.mjs','debuff-icon-regression.mjs','qol-regression.mjs',
    'encounter-icon-regression.mjs','power-timing-interaction-regression.mjs','settings-regression.mjs','ux-polish-regression.mjs',
    'wide-layout-regression.mjs','visualization-regression.mjs','visual-analysis-regression.mjs','layout-rhythm-regression.mjs',
    'ui-coherence-regression.mjs','lifecycle-regression.mjs'
  ]
});

const requested = process.argv.slice(2);
const selected = requested.length ? requested : Object.keys(groups);
for (const group of selected) {
  if (!groups[group]) {
    console.error(`Unknown test group: ${group}. Available: ${Object.keys(groups).join(', ')}`);
    process.exit(2);
  }
  console.log(`\n[test-registry] ${group}`);
  for (const script of groups[group]) {
    const result = spawnSync(process.execPath, [`scripts/${script}`], { stdio: 'inherit', env: process.env });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
console.log('\nTest registry passed.');
