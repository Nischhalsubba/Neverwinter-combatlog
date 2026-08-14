import json
import math
import os
from pathlib import Path
from PIL import Image

source = Path(os.environ.get('ICON_PACK_DIR', '')).resolve()
if not source or not (source / 'powers.json').is_file():
    raise SystemExit('ICON_PACK_DIR must contain powers.json and the icons directory.')

repo_root = Path(__file__).resolve().parents[2]
data_dir = repo_root / 'app' / 'src' / 'data'
asset_dir = data_dir / 'power-icons'
data_dir.mkdir(parents=True, exist_ok=True)
asset_dir.mkdir(parents=True, exist_ok=True)

payload = json.loads((source / 'powers.json').read_text(encoding='utf-8'))
entries = [item for item in payload.get('powers', []) if item.get('category') == 'Encounters' and item.get('downloaded')]
if len(entries) != 141:
    raise SystemExit(f'Expected 141 Encounter mappings, found {len(entries)}.')

unique_files = []
seen = set()
for item in entries:
    local_file = item.get('localFile', '')
    path = source / local_file
    if not path.is_file():
        raise SystemExit(f'Missing Encounter icon: {local_file}')
    if local_file not in seen:
        seen.add(local_file)
        unique_files.append(local_file)

cell = 64
columns = 16
rows = math.ceil(len(unique_files) / columns)
sprite = Image.new('RGBA', (columns * cell, rows * cell), (0, 0, 0, 0))
coordinates = {}

for index, local_file in enumerate(unique_files):
    image = Image.open(source / local_file).convert('RGBA')
    if image.size != (cell, cell):
        image.thumbnail((cell, cell), Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
        tile.alpha_composite(image, ((cell - image.width) // 2, (cell - image.height) // 2))
        image = tile
    x = (index % columns) * cell
    y = (index // columns) * cell
    sprite.alpha_composite(image, (x, y))
    coordinates[local_file] = (x, y)

sprite_path = asset_dir / 'encounter-power-icons.webp'
sprite.save(sprite_path, 'WEBP', lossless=True, method=6)
with sprite_path.open('rb') as handle:
    header = handle.read(12)
if not (header[:4] == b'RIFF' and header[8:12] == b'WEBP'):
    raise SystemExit('Generated Encounter sprite is not a valid WebP image.')


def js_string(value):
    return json.dumps(value, ensure_ascii=False)

lines = [
    'const CELL = 64;',
    f'const SPRITE_WIDTH = {sprite.width};',
    f'const SPRITE_HEIGHT = {sprite.height};',
    'const ENTRIES = Object.freeze(['
]
for item in entries:
    x, y = coordinates[item['localFile']]
    lines.append(f"  [{js_string(item['className'])}, {js_string(item['name'])}, {x}, {y}],")
lines.extend([
    ']);',
    '',
    'export function normalizePowerName(value) {',
    "  return String(value ?? '')",
    "    .normalize('NFKD')",
    "    .replace(/[\\u0300-\\u036f]/g, '')",
    "    .replace(/[’‘'`]/g, '')",
    '    .toLowerCase()',
    "    .replace(/[^a-z0-9]+/g, ' ')",
    '    .trim()',
    "    .replace(/\\s+/g, ' ');",
    '}',
    '',
    'function normalizeClassName(value) {',
    "  return String(value ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');",
    '}',
    '',
    'const byClassAndName = new Map();',
    'const byName = new Map();',
    'for (const [className, name, x, y] of ENTRIES) {',
    '  const item = Object.freeze({ className, name, x, y, width: CELL, height: CELL });',
    '  const nameKey = normalizePowerName(name);',
    '  byClassAndName.set(`${normalizeClassName(className)}|${nameKey}`, item);',
    '  const matches = byName.get(nameKey) || [];',
    '  matches.push(item);',
    '  byName.set(nameKey, matches);',
    '}',
    '',
    'function sameCell(items) {',
    '  if (!items.length) return false;',
    '  return items.every(item => item.x === items[0].x && item.y === items[0].y);',
    '}',
    '',
    'export function isKnownEncounterPowerName(powerName) {',
    '  return byName.has(normalizePowerName(powerName));',
    '}',
    '',
    'export function encounterPowerClasses(powerName) {',
    '  const matches = byName.get(normalizePowerName(powerName)) || [];',
    '  return Array.from(new Set(matches.map(item => item.className)));',
    '}',
    '',
    "export function findEncounterPowerIcon(powerName, className = '') {",
    '  const nameKey = normalizePowerName(powerName);',
    '  if (!nameKey) return null;',
    '  const classKey = normalizeClassName(className);',
    '  if (classKey) {',
    '    const exact = byClassAndName.get(`${classKey}|${nameKey}`);',
    '    if (exact) return exact;',
    '  }',
    '  const matches = byName.get(nameKey) || [];',
    '  if (matches.length === 1 || sameCell(matches)) return matches[0] || null;',
    '  return null;',
    '}',
    '',
    'export const ENCOUNTER_POWER_ICON_COUNT = ENTRIES.length;',
    'export const ENCOUNTER_POWER_ICON_SPRITE = Object.freeze({',
    "  url: new URL('./power-icons/encounter-power-icons.webp', import.meta.url).href,",
    '  width: SPRITE_WIDTH,',
    '  height: SPRITE_HEIGHT,',
    '  cell: CELL',
    '});',
    '',
    'let spritePromise = null;',
    'export function loadEncounterPowerIconSprite() {',
    '  if (spritePromise) return spritePromise;',
    "  if (typeof Image === 'undefined') return Promise.reject(new Error('Power icon sprite can only be loaded in a browser.'));",
    '  spritePromise = new Promise((resolve, reject) => {',
    '    const image = new Image();',
    "    image.decoding = 'async';",
    '    image.onload = () => resolve(image);',
    "    image.onerror = () => reject(new Error('Encounter power icons could not be loaded.'));",
    '    image.src = ENCOUNTER_POWER_ICON_SPRITE.url;',
    '  }).catch(error => { spritePromise = null; throw error; });',
    '  return spritePromise;',
    '}',
])
(data_dir / 'encounter-power-icons.js').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'Generated {len(entries)} Encounter mappings across {len(unique_files)} icon files.')
