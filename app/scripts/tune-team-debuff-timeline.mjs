import fs from 'node:fs';

const path = 'src/v10/power-timing-interactions.js';
let text = fs.readFileSync(path, 'utf8');
function replace(before, after, label) {
  if (!text.includes(before)) throw new Error(`Missing ${label}`);
  text = text.replace(before, after);
}

replace(
`function setZoom(panel, next, anchor = null) {
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(next) || 1));
  applyDimensions(panel, anchor);
  scheduleRepaint();
}`,
`function maxZoomForReport() {
  const duration = Math.max(1, Number(report?.duration) || 1);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, MAX_TIMELINE_WIDTH / (duration * BASE_PX_PER_SECOND)));
}

function setZoom(panel, next, anchor = null) {
  zoom = Math.max(MIN_ZOOM, Math.min(maxZoomForReport(), Number(next) || 1));
  applyDimensions(panel, anchor);
  scheduleRepaint();
}`,
'zoom clamp'
);

replace(
`    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
    if (rows.length && rows.length % 2500 === 0) await new Promise(resolve => setTimeout(resolve, 0));`,
`    rows.push(...(page.rows || []));
    cursor = page.nextCursor;
    if (rows.length > 60000 && cursor != null) throw new Error('This scope is too large for the optional debuff overlay.');
    if (rows.length && rows.length % 2500 === 0) await new Promise(resolve => setTimeout(resolve, 0));`,
'background overlay safety cap'
);

replace(
`  const dpr = Math.min(1.5, devicePixelRatio || 1);`,
`  const dpr = Math.min(1.5, devicePixelRatio || 1, 32760 / Math.max(1, width));`,
'canvas physical dimension cap'
);

fs.writeFileSync(path, text);

const regressionPath = 'scripts/power-timing-interaction-regression.mjs';
let regression = fs.readFileSync(regressionPath, 'utf8');
const before = `'buildTeamDebuffTiming','raw-page','MAX_ZOOM = 12','MAX_TIMELINE_WIDTH = 30000'`;
const after = `'buildTeamDebuffTiming','raw-page','MAX_ZOOM = 12','MAX_TIMELINE_WIDTH = 30000','maxZoomForReport','32760','60000'`;
if (!regression.includes(before)) throw new Error('Missing timing regression token anchor');
regression = regression.replace(before, after);
fs.writeFileSync(regressionPath, regression);
console.log('Applied safe deep-zoom and large-scope guards.');
