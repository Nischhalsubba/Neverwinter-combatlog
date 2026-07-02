import { mkdir, copyFile } from 'node:fs/promises';

const files = [
  'index.html',
  'styles.css',
  'parser.js',
  'app.js',
  'assets.js',
  'class-power-map.js',
  'recovery.js',
  'power-icon-fix.js',
];

await mkdir('public', { recursive: true });

for (const file of files) {
  await copyFile(file, `public/${file}`);
}

console.log(`Built Strikeglass static app with ${files.length} files.`);
