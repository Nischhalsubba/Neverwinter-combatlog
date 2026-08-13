import { readFile } from 'node:fs/promises';

const [index, copy] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/v6/copy.js', 'utf8')
]);

const requiredShellCopy = [
  'Summary',
  'Power Timing',
  'Compare Players',
  'Boss Fights',
  'Log Health',
  'How this works',
  'Rows read',
  'Rows skipped',
  'Fight',
  'Showing'
];

const requiredMetricCopy = [
  'Group damage',
  'Group Active DPS',
  'Active DPS',
  'Critical hit rate',
  'Biggest hit',
  'What do these numbers mean?'
];

const missing = [
  ...requiredShellCopy.filter(value => !index.includes(value)).map(value => `shell: ${value}`),
  ...requiredMetricCopy.filter(value => !copy.includes(value)).map(value => `metrics: ${value}`)
];

if (missing.length) {
  console.error('UI copy smoke failed:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log('UI copy smoke passed. Core navigation and combat metrics use the plain-language vocabulary.');
