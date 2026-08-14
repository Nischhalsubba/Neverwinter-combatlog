import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const ROOT = 'https://nw-hub.com';
const CLASSES = ['barbarian','bard','cleric','fighter','paladin','ranger','rogue','warlock','wizard'];
const OUTPUT = process.env.OUTPUT_DIR || path.resolve('nw-hub-power-icons-fixed');
const RELATED_FALLBACKS = Object.freeze({
  'Bard|Con Fuoco': { url: `${ROOT}/assets/powers/con-elemento.webp`, note: 'Con Fuoco is the Blaze Flamenco form of Con Elemento; NW Hub\'s dedicated PNG is missing.' },
  'Bard|Con Moto': { url: `${ROOT}/assets/powers/con-elemento.webp`, note: 'Con Moto is the Tailwind Mambo form of Con Elemento; NW Hub\'s dedicated PNG is missing.' },
  'Bard|Con Brio': { url: `${ROOT}/assets/powers/con-elemento.webp`, note: 'Con Brio is the Steel March form of Con Elemento; NW Hub\'s dedicated PNG is missing.' },
  "Bard|Hero's Finale": { url: `${ROOT}/assets/powers/ballad-of-the-hero.webp`, note: 'Hero\'s Finale is the finale state of Ballad of the Hero; NW Hub\'s dedicated PNG is missing.' }
});
const SCREENSHOT_FALLBACKS = Object.freeze({
  'Bard|Mystify': {
    url: 'https://www.mmorpgtips.com/wp-content/uploads/2021/08/Single-Target-Songblade.jpg',
    referer: 'https://www.mmorpgtips.com/neverwinter-bard-songblade-build/',
    expectedWidth: 1021,
    expectedHeight: 841,
    crop: { left: 341, top: 542, width: 45, height: 45 },
    note: 'NW Hub does not serve bard_mystify.png or mystifying-strikes.webp. This is the Mystifying Strikes icon cropped from a published in-game Songblade power panel; Mystifying Strikes is the class feature that produces Mystify.'
  },
  'Bard|Curtain Call': {
    url: 'https://static.wixstatic.com/media/0e5a9c_80b972ecea1f4153ab810e288400be86~mv2.png/v1/fill/w_980%2Ch_673%2Cal_c%2Cq_90%2Cusm_0.66_1.00_0.01%2Cenc_auto/0e5a9c_80b972ecea1f4153ab810e288400be86~mv2.png',
    referer: 'https://www.neverwinterturk.com/',
    expectedWidth: 980,
    expectedHeight: 673,
    crop: { left: 220, top: 203, width: 32, height: 32 },
    note: 'NW Hub does not serve bard_curtaincall.png. This is the Curtain Call daily icon cropped from a published in-game Minstrel power panel.'
  }
});
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

async function fetchBytes(url, referer = `${ROOT}/classes`) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145 Safari/537.36 StrikeglassResearch/1.1',
      'referer': referer,
      'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { buffer, reportedContentType: response.headers.get('content-type') || '' };
}

function assetFromBuffer(buffer, reportedContentType = '') {
  const detected = detectImage(buffer);
  if (!detected) {
    const preview = buffer.subarray(0, 80).toString('utf8').replace(/\s+/g, ' ').trim();
    throw new Error(`Not an image (${reportedContentType || 'unknown'}; ${preview.slice(0, 60)})`);
  }
  return {
    buffer,
    ext: detected.ext,
    contentType: detected.type,
    reportedContentType,
    sha256: createHash('sha256').update(buffer).digest('hex')
  };
}

async function fetchImage(url) {
  const response = await fetchBytes(url);
  return assetFromBuffer(response.buffer, response.reportedContentType);
}

const assetCache = new Map();
async function cachedImage(url) {
  if (!assetCache.has(url)) assetCache.set(url, fetchImage(url));
  return assetCache.get(url);
}

const screenshotCache = new Map();
async function screenshotAsset(spec) {
  let sourcePromise = screenshotCache.get(spec.url);
  if (!sourcePromise) {
    sourcePromise = fetchBytes(spec.url, spec.referer);
    screenshotCache.set(spec.url, sourcePromise);
  }
  const source = await sourcePromise;
  const metadata = await sharp(source.buffer).metadata();
  if (metadata.width !== spec.expectedWidth || metadata.height !== spec.expectedHeight) {
    throw new Error(`Reference screenshot changed size: ${metadata.width}x${metadata.height}; expected ${spec.expectedWidth}x${spec.expectedHeight}.`);
  }
  const buffer = await sharp(source.buffer)
    .extract(spec.crop)
    .resize(64, 64, { fit: 'fill', kernel: sharp.kernel.nearest })
    .webp({ lossless: true })
    .toBuffer();
  return assetFromBuffer(buffer, 'image/webp');
}

async function resolveAsset(record) {
  try {
    const asset = await cachedImage(record.iconUrl);
    return { asset, resolvedUrl: record.iconUrl, fallback: null };
  } catch (primaryError) {
    const key = `${record.className}|${record.name}`;
    const related = RELATED_FALLBACKS[key];
    if (related) {
      const asset = await cachedImage(related.url);
      return { asset, resolvedUrl: related.url, fallback: { type: 'related-nw-hub-power', note: related.note, primaryError: primaryError.message || String(primaryError) } };
    }
    const screenshot = SCREENSHOT_FALLBACKS[key];
    if (screenshot) {
      const asset = await screenshotAsset(screenshot);
      return {
        asset,
        resolvedUrl: screenshot.url,
        fallback: {
          type: 'published-game-ui-crop',
          note: screenshot.note,
          sourceUrl: screenshot.url,
          sourceReferer: screenshot.referer,
          crop: screenshot.crop,
          primaryError: primaryError.message || String(primaryError)
        }
      };
    }
    throw primaryError;
  }
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
        const typeSection = card.closest('.gi-power-type-section');
        const paragonSection = card.closest('.gi-power-section');
        const img = card.querySelector('img.pw-icon');
        return {
          category: clean(typeSection?.querySelector(':scope > h3')?.textContent),
          paragon: clean(paragonSection?.querySelector(':scope > h4')?.textContent) || 'Shared',
          name: clean(card.querySelector('.gi-power-name')?.textContent),
          iconUrl: img?.currentSrc || img?.src || '',
          iconAttribute: img?.getAttribute('src') || '',
          naturalWidth: img?.naturalWidth || 0,
          naturalHeight: img?.naturalHeight || 0
        };
      }).filter(item => ['At-Wills','Encounters','Dailies'].includes(item.category) && item.name && item.iconUrl);
    });

    if (powers.length < 20) throw new Error(`${classSlug} returned only ${powers.length} class powers; expected at least 20.`);

    for (const power of powers) {
      const record = { className: classSlug[0].toUpperCase() + classSlug.slice(1), sourcePage: pageUrl, ...power };
      try {
        if (power.iconUrl.includes('/classes/assets/')) throw new Error(`Browser returned an invalid class-relative icon URL: ${power.iconUrl}`);
        const resolved = await resolveAsset(record);
        const asset = resolved.asset;
        const categoryDir = power.category === 'At-Wills' ? 'at-wills' : power.category.toLowerCase();
        const dir = path.join(OUTPUT, 'icons', classSlug, categoryDir);
        await mkdir(dir, { recursive: true });
        const filename = `${slug(power.name)}${asset.ext}`;
        const localPath = path.join(dir, filename);
        await writeFile(localPath, asset.buffer);
        Object.assign(record, {
          resolvedIconUrl: resolved.resolvedUrl,
          fallback: resolved.fallback,
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
  map[item.name].push({ className: item.className, category: item.category, paragon: item.paragon, icon: item.localFile, sha256: item.sha256, fallback: item.fallback || null });
}

const summary = {
  source: `${ROOT}/classes`,
  generatedAt: new Date().toISOString(),
  entries: entries.length,
  downloaded: entries.filter(item => item.downloaded).length,
  failed: failures.length,
  fallbackCount: entries.filter(item => item.fallback).length,
  uniqueSourceUrls: new Set(entries.map(item => item.iconUrl)).size,
  uniqueImageHashes: new Set(entries.filter(item => item.sha256).map(item => item.sha256)).size,
  counts
};

const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [
  ['Class','Category','Paragon','Power','NW Hub icon URL','Resolved icon URL','Fallback','Local file','Bytes','SHA-256'].map(csvCell).join(','),
  ...entries.map(item => [item.className,item.category,item.paragon,item.name,item.iconUrl,item.resolvedIconUrl || '',item.fallback?.type || '',item.localFile || '',item.bytes || '',item.sha256 || ''].map(csvCell).join(','))
].join('\n');

await writeFile(path.join(OUTPUT, 'powers.json'), JSON.stringify({ summary, powers: entries, failures }, null, 2), 'utf8');
await writeFile(path.join(OUTPUT, 'strikeglass-power-map.json'), JSON.stringify(map, null, 2), 'utf8');
await writeFile(path.join(OUTPUT, 'powers.csv'), csv, 'utf8');
await writeFile(path.join(OUTPUT, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
await writeFile(path.join(OUTPUT, 'README.md'), `# NW Hub class power icons\n\nSource: ${ROOT}/classes\n\nThis export contains the rendered At-Will, Encounter, and Daily power icons for the nine Neverwinter classes. Icon URLs are taken from the browser-resolved \`currentSrc\`, which respects NW Hub's \`<base href="/">\`. Every saved asset is validated by file signature before it is accepted.\n\nNW Hub currently references six missing Bard image files. Con Fuoco, Con Moto, Con Brio, and Hero's Finale reuse the verified parent-power artwork documented by the source page. Mystify/Mystifying Strikes and Curtain Call are recovered from published in-game Bard power-panel screenshots because NW Hub does not serve the referenced standalone files. Every fallback records its provenance in \`powers.json\`, \`powers.csv\`, and \`strikeglass-power-map.json\`.\n\nEntries: ${summary.entries}\nDownloaded: ${summary.downloaded}\nFailed: ${summary.failed}\nFallbacks: ${summary.fallbackCount}\nUnique image hashes: ${summary.uniqueImageHashes}\n`, 'utf8');

const structuralFailures = [];
if (entries.length < 250) structuralFailures.push(`Only ${entries.length} class power entries were found; expected at least 250.`);
if (summary.downloaded !== entries.length) structuralFailures.push(`${summary.downloaded}/${entries.length} icons downloaded successfully.`);
if (summary.uniqueImageHashes < 200) structuralFailures.push(`Only ${summary.uniqueImageHashes} unique image hashes were found; the export may contain placeholders.`);
if (summary.fallbackCount !== 6) structuralFailures.push(`Expected 6 documented Bard fallbacks; found ${summary.fallbackCount}.`);
for (const [className, count] of Object.entries(counts)) {
  if (count.total < 20 || count.downloaded !== count.total) structuralFailures.push(`${className} coverage is incomplete (${count.downloaded}/${count.total}).`);
}

console.log(JSON.stringify(summary, null, 2));
if (failures.length || structuralFailures.length) {
  if (failures.length) console.error(JSON.stringify(failures, null, 2));
  for (const failure of structuralFailures) console.error(failure);
  process.exit(1);
}
