import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'public');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const sourceSha = process.env.STRIKEGLASS_SOURCE_SHA || process.env.GITHUB_SHA || 'local';

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function copy(from, to) {
  const target = join(outDir, to);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, from), target, { recursive: true, force: true });
}

async function fileHash(path) {
  return hash(await readFile(path));
}

async function listFiles(dir, base = dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path, base));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll('\\', '/'));
  }
  return files;
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await copy('index.html', 'index.html');
await copy('src', 'src');
await copy('vendor', 'vendor');

// Cloud functionality is not part of the local-first production runtime.
await rm(join(outDir, 'src', 'integrations', 'supabase'), { recursive: true, force: true });

for (const [from, to] of [
  ['src/seo/robots.txt', 'robots.txt'],
  ['src/seo/sitemap.txt', 'sitemap.txt'],
  ['src/seo/site.webmanifest', 'site.webmanifest'],
  ['src/seo/how-to-use/index.html', 'how-to-use/index.html'],
  ['src/seo/dps-explained/index.html', 'dps-explained/index.html'],
  ['src/seo/privacy/index.html', 'privacy/index.html'],
  ['src/seo/about.html', 'about/index.html']
]) await copy(from, to);

const sourceIndex = await readFile(join(root, 'index.html'), 'utf8');
const stylesheetHrefs = [...sourceIndex.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*>/g)].map(match => match[1]);
const cssEntry = `${stylesheetHrefs.map(href => `@import url("../${href}");`).join('\n')}\n`;
const cssHash = hash(cssEntry).slice(0, 12);
const cssName = `strikeglass.${cssHash}.css`;

const jsEntry = [
  "await import('../src/v13/settings.js');",
  "await import('../src/v7/worker-bridge.js');",
  "await import('../src/v3/app.js');",
  "await import('../src/v3/power-drilldown.js');",
  ''
].join('\n');
const jsHash = hash(jsEntry).slice(0, 12);
const jsName = `strikeglass-shell.${jsHash}.js`;

await mkdir(join(outDir, 'assets'), { recursive: true });
await writeFile(join(outDir, 'assets', cssName), cssEntry, 'utf8');
await writeFile(join(outDir, 'assets', jsName), jsEntry, 'utf8');

let productionIndex = sourceIndex.replace(/\s*<link\s+rel="stylesheet"\s+href="[^"]+"\s*>/g, '');
productionIndex = productionIndex
  .replace(/\s*<script\s+type="module"\s+src="src\/v13\/settings\.js"><\/script>/g, '')
  .replace(/\s*<script\s+src="src\/v7\/worker-bridge\.js"><\/script>/g, '')
  .replace(/\s*<script\s+type="module"\s+src="src\/v3\/app\.js"><\/script>/g, '')
  .replace(/\s*<script\s+type="module"\s+src="src\/v3\/power-drilldown\.js"><\/script>/g, '');
productionIndex = productionIndex.replace('</head>', `  <link rel="stylesheet" href="/assets/${cssName}">\n</head>`);
productionIndex = productionIndex.replace('</body>', `  <script type="module" src="/assets/${jsName}"></script>\n</body>`);
await writeFile(join(outDir, 'index.html'), productionIndex, 'utf8');

const publicFiles = (await listFiles(outDir)).filter(path => !['asset-manifest.json', 'build-manifest.json'].includes(path)).sort();
const assets = {};
for (const path of publicFiles) {
  const full = join(outDir, path);
  const info = await stat(full);
  assets[path] = { sha256: await fileHash(full), bytes: info.size };
}
const artifactIdentity = hash(Object.entries(assets).map(([path, meta]) => `${path}:${meta.sha256}:${meta.bytes}`).join('\n'));
const assetManifest = { schemaVersion: 1, artifactIdentity, assets };
await writeFile(join(outDir, 'asset-manifest.json'), `${JSON.stringify(assetManifest, null, 2)}\n`, 'utf8');

const buildManifest = {
  schemaVersion: 1,
  name: 'Strikeglass',
  version: packageJson.version,
  sourceSha,
  artifactIdentity,
  entrypoints: { css: `/assets/${cssName}`, js: `/assets/${jsName}` },
  contracts: {
    parser: await fileHash(join(root, 'src/engine/fast-parser-core.js')),
    verifier: await fileHash(join(root, 'src/engine/verification-engine.js')),
    supportCatalog: await fileHash(join(root, 'src/data/support-effect-catalog.js'))
  },
  assetCount: Object.keys(assets).length
};
await writeFile(join(outDir, 'build-manifest.json'), `${JSON.stringify(buildManifest, null, 2)}\n`, 'utf8');

console.log(`Built Strikeglass ${packageJson.version} production package (${buildManifest.assetCount} assets, ${artifactIdentity.slice(0, 12)}).`);
