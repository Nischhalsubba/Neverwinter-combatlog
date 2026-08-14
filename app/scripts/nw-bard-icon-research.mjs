import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT = process.env.OUTPUT_DIR || path.resolve('nw-hub-power-icons-fixed');
const research = path.join(OUTPUT, 'research');
await mkdir(research, { recursive: true });

const sources = [
  {
    name: 'songblade-build.jpg',
    url: 'https://www.mmorpgtips.com/wp-content/uploads/2021/08/Single-Target-Songblade.jpg',
    referer: 'https://www.mmorpgtips.com/neverwinter-bard-songblade-build/'
  },
  {
    name: 'minstrel-build.png',
    url: 'https://static.wixstatic.com/media/0e5a9c_80b972ecea1f4153ab810e288400be86~mv2.png/v1/fill/w_980%2Ch_673%2Cal_c%2Cq_90%2Cusm_0.66_1.00_0.01%2Cenc_auto/0e5a9c_80b972ecea1f4153ab810e288400be86~mv2.png',
    referer: 'https://www.neverwinterturk.com/'
  },
  { name: 'inspiration.webp', url: 'https://nw-hub.com/assets/powers/inspiration.webp', referer: 'https://nw-hub.com/classes/bard' },
  { name: 'masterful-performance.webp', url: 'https://nw-hub.com/assets/powers/masterful-performance.webp', referer: 'https://nw-hub.com/classes/bard' },
  { name: 'encore.webp', url: 'https://nw-hub.com/assets/powers/encore.webp', referer: 'https://nw-hub.com/classes/bard' },
  { name: 'dancing-lights.webp', url: 'https://nw-hub.com/assets/powers/dancing-lights.webp', referer: 'https://nw-hub.com/classes/bard' }
];

for (const source of sources) {
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145 Safari/537.36',
        'referer': source.referer,
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(path.join(research, source.name), bytes);
    console.log(`${source.name}: ${bytes.length} bytes (${response.headers.get('content-type') || 'unknown'})`);
  } catch (error) {
    console.error(`${source.name}: ${error.message || String(error)}`);
  }
}
