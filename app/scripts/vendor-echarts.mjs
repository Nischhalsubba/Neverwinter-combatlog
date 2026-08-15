import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const VERSION = '6.1.0';
const SOURCE = `https://raw.githubusercontent.com/apache/echarts/${VERSION}/dist/echarts.min.js`;
const EXPECTED_GIT_BLOB_SHA1 = '3b8ed4bcd17f7c838d86d4920af588f1a0aeb389';
const TARGET = new URL('../vendor/echarts.min.js', import.meta.url);

function gitBlobSha(bytes) {
  const prefix = Buffer.from(`blob ${bytes.length}\0`);
  return createHash('sha1').update(prefix).update(bytes).digest('hex');
}

async function existingIsValid() {
  try {
    const bytes = await readFile(TARGET);
    return gitBlobSha(bytes) === EXPECTED_GIT_BLOB_SHA1;
  } catch {
    return false;
  }
}

if (await existingIsValid()) {
  console.log(`Apache ECharts ${VERSION} vendor asset already verified.`);
  process.exit(0);
}

const response = await fetch(SOURCE, { redirect:'follow' });
if (!response.ok) throw new Error(`Could not download Apache ECharts ${VERSION}: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const actual = gitBlobSha(bytes);
if (actual !== EXPECTED_GIT_BLOB_SHA1) {
  throw new Error(`Apache ECharts ${VERSION} integrity mismatch: expected ${EXPECTED_GIT_BLOB_SHA1}, got ${actual}`);
}
await mkdir(new URL('../vendor/', import.meta.url), { recursive:true });
await writeFile(TARGET, bytes);
console.log(`Vendored Apache ECharts ${VERSION} (${bytes.length.toLocaleString()} bytes), Git blob ${actual}.`);
