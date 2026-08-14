import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = 'https://nw-hub.com';
const CLASSES = ['barbarian','bard','cleric','fighter','paladin','ranger','rogue','warlock','wizard'];
const OUTPUT = process.env.OUTPUT_DIR || path.resolve('nw-hub-power-icons-fixed');
const executableCandidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);
const executablePath = executableCandidates.find(existsSync);
if (!executablePath) throw new Error('Chrome/Chromium was not found on the runner.');

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'power';
}

function detectImage(buffer) {
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: '.webp', type: 'image/webp' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { ext: '.png', type: 'image/png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: '.jpg', type: 'image/jpeg' };
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'))) return { ext: '.gif', type: 'image/gif' };
  const prefix = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trimStart();
  if (prefix.startsWith('<svg') || (prefix.startsWith('<?xml') && prefix.includes('<svg'))) return { ext: '.svg', type: 'image/svg+xml' };
  if (buffer.length >= 16 && buffer.subarray(4, 8).toString('ascii') === 'ftyp' && /avif|avis/.test(buffer.subarray(8, 16).toString('ascii'))) return { ext: '.avif', type: 'image/avif' };
  return null;
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145 Safari/537.36 StrikeglassResearch/1.1',
      'referer': `${ROOT}/classes`
    },
    redirect: 'follow'
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const detected = detectImage(buffer);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!detected) {
    const preview = buffer.subarray(0, 80).toString('utf8').replace(/\s+/g, ' ').trim();
    throw new Error(`Not an image (${response.headers.get('content-type') || 'unknown'}; ${preview.slice(0, 60)})`);
  }
  return {
    buffer,
    ext: detected.ext,
    contentType: detected.type,
    reportedContentType: response.headers.get('content-type') || '',
    sha256: createHash('sha256').update(buffer).digest('hex')
  };
}

await mkdir(OUTPUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145 Safari/537.36 StrikeglassResearch/1.1');
page.setDefaultNavigationTimeout(45000);
page.setDefaultTimeout(20000);

const entries = [];
const failures = [];
const downloadedByUrl = new Map();

try {
  for (const classSlug of CLASSES) {
    const pageUrl = `${ROOT}/classes/${classSlug}`;
    console.log(`Reading ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.gi-power-card');
    await new Promise(resolve => setTimeout(resolve, 1200));

    const powers = await page.evaluate(() => {
      const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
      return Array.from(document.querySelectorAll('.gi-power-card')).map(card => {
        const content = card.closest('.content');
        const section = card.closest('.gi-power-section');
        const img = card.querySelector('img.pw-icon');
        return {
          category: clean(content?.querySelector(':scope > h2')?.textContent),
          paragon: clean(section?.querySelector(':scope > h4')?.textContent) || 'Shared',
          name: clean(card.querySelector('.gi-power-name')?.textContent),
          iconUrl: img?.currentSrc || img?.src || '',
          iconAttribute: img?.getAttribute('src') || '',
          naturalWidth: img?.naturalWidth || 0,
          naturalHeight: img?.naturalHeight || 0
        };
      }).filter(item => ['At-Wills','Encounters','Dailies'].includes(item.category) && item.name && item.iconUrl);
    });

    for (const power of powers) {
      const record = { className: classSlug[0].toUpperCase() + classSlug.slice(1), sourcePage: pageUrl, ...power };
      try {
        let asset = downloadedByUrl.get(power.iconUrl);
        if (!asset) {
          asset = await fetchImage(power.iconUrl);
          downloadedByUrl.set(power.iconUrl, asset);
        }
        const categoryDir = power.category === 'At-Wills' ? 'at-wills' : power.category.toLowerCase();
        const dir = path.join(OUTPUT, 'icons', classSlug, categoryDir);
        await mkdir(dir, { recursive: true });
        const filename = `${slug(power.name)}${asset.ext}`;
        const localPath = path.join(dir, filename);
        await writeFile(localPath, asset.buffer);
        Object.assign(record, {
          localFile: path.relative(OUTPUT, localPath).replaceAll(path.sep, '/'),
          bytes: asset.buffer.length,
          sha256: asset.sha256,
          contentType: asset.contentType,
          downloaded: true
        });
      } catch (error) {
        record.downloaded = false;
        record.error = error.message || String(error);
        failures.push({ className: record.className, category: power.category, name: power.name, iconUrl: power.iconUrl, error: record.error });
      }
      entries.push(record);
    }
  }
} finally {
  await browser.close();
}

const counts = {};
for (const classSlug of CLASSES) {
  const className = classSlug[0].toUpperCase() + classSlug.slice(1);
  const rows = entries.filter(item => item.className === className);
  counts[className] = {
    atWills: rows.filter(item => item.category === 'At-Wills').length,
    encounters: rows.filter(item => item.category === 'Encounters').length,
    dailies: rows.filter(item => item.category === 'Dailies').length,
    total: rows.length,
    downloaded: rows.filter(item => item.downloaded).length
  };
}

const map = {};
for (const item of entries.filter(item => item.downloaded)) {
  map[item.name] ||= [];
  map[item.name].push({ className: item.className, category: item.category, paragon: item.paragon, icon: item.localFile, sha256: item.sha256 });
}

const summary = {
  source: `${ROOT}/classes`,
  generatedAt: new Date().toISOString(),
  entries: entries.length,
  downloaded: entries.filter(item => item.downloaded).length,
  failed: failures.length,
  uniqueSourceUrls: new Set(entries.map(item => item.iconUrl)).size,
  uniqueImageHashes: new Set(entries.filter(item => item.sha256).map(item => item.sha256)).size,
  counts
};

const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [
  ['Class','Category','Paragon','Power','Icon URL','Local file','Bytes','SHA-256'].map(csvCell).join(','),
  ...entries.map(item => [item.className,item.category,item.paragon,item.name,item.iconUrl,item.localFile || '',item.bytes || '',item.sha256 || ''].map(csvCell).join(','))
].join('\n');

await writeFile(path.join(OUTPUT, 'powers.json'), JSON.stringify({ summary, powers: entries, failures }, null, 2), 'utf8');
await writeFile(path.join(OUTPUT, 'strikeglass-power-map.json'), JSON.stringify(map, null, 2), 'utf8');
await writeFile(path.join(OUTPUT, 'powers.csv'), csv, 'utf8');
await writeFile(path.join(OUTPUT, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
await writeFile(path.join(OUTPUT, 'README.md'), `# NW Hub class power icons\n\nSource: ${ROOT}/classes\n\nThis export contains the rendered At-Will, Encounter, and Daily power icons for the nine Neverwinter classes. Icon URLs are taken from the browser-resolved \`currentSrc\`, which respects NW Hub's \`<base href="/">\`. Every saved asset is validated by file signature before it is accepted.\n\nEntries: ${summary.entries}\nDownloaded: ${summary.downloaded}\nFailed: ${summary.failed}\nUnique image hashes: ${summary.uniqueImageHashes}\n`, 'utf8');

console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
