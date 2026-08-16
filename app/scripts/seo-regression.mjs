import { readFile } from 'node:fs/promises';

const failures = [];
const origin = 'https://neverwinter-combatlog.hinischalsubba.workers.dev';

async function read(path) {
  try { return await readFile(path, 'utf8'); }
  catch { failures.push(`Missing ${path}`); return ''; }
}

function requireText(source, marker, label) {
  if (!source.includes(marker)) failures.push(`${label} missing ${marker}`);
}

const index = await read('index.html');
for (const marker of [
  '<title>Strikeglass | Neverwinter Combat Log Analyzer</title>',
  `rel="canonical" href="${origin}/"`,
  'name="robots" content="index,follow,max-image-preview:large"',
  'property="og:site_name" content="Strikeglass"',
  'property="og:url"',
  'name="twitter:card"',
  'type="application/ld+json"',
  '"@type": "WebSite"',
  '"@type": "SoftwareApplication"',
  'Neverwinter combat log analyzer',
  '/how-to-use/',
  '/dps-explained/',
  '/privacy/',
  '/about/'
]) requireText(index, marker, 'homepage');

const manifest = await read('src/seo/site.webmanifest');
requireText(manifest, '"name": "Strikeglass"', 'manifest');
requireText(manifest, 'strikeglass-mark.svg', 'manifest');

const robots = await read('src/seo/robots.txt');
requireText(robots, 'User-agent: *', 'robots');
requireText(robots, `${origin}/sitemap.txt`, 'robots');

const sitemap = await read('src/seo/sitemap.txt');
for (const path of ['/', '/how-to-use/', '/dps-explained/', '/privacy/', '/about/']) {
  requireText(sitemap, `${origin}${path}`, 'sitemap');
}

for (const [path, titleMarker] of [
  ['src/seo/how-to-use/index.html', 'How to Use Strikeglass'],
  ['src/seo/dps-explained/index.html', 'DPS and Active DPS Explained'],
  ['src/seo/privacy/index.html', 'Strikeglass Privacy'],
  ['src/seo/about.html', 'About Strikeglass']
]) {
  const page = await read(path);
  requireText(page, titleMarker, path);
  requireText(page, 'rel="canonical"', path);
}

const buildScript = await read('build-static.mjs');
for (const [source, target] of [
  ['src/seo/robots.txt', 'robots.txt'],
  ['src/seo/sitemap.txt', 'sitemap.txt'],
  ['src/seo/site.webmanifest', 'site.webmanifest'],
  ['src/seo/how-to-use/index.html', 'how-to-use/index.html'],
  ['src/seo/dps-explained/index.html', 'dps-explained/index.html'],
  ['src/seo/privacy/index.html', 'privacy/index.html'],
  ['src/seo/about.html', 'about/index.html']
]) {
  requireText(buildScript, `['${source}', '${target}']`, 'production build');
}

const brand = await read('../BRAND.md');
requireText(brand, 'Double checked. Kept local.', 'brand guide');
requireText(brand, 'Strikeglass | Neverwinter Combat Log Analyzer', 'brand guide');

if (failures.length) {
  console.error('SEO regression failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('SEO regression passed. Strikeglass public metadata, discovery files, help pages, and production build publishing contract are present.');
