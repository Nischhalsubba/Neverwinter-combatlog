import { clearVisualCaches, ensureStyle } from './shared.js';
import { scanGraphs, scheduleGraphScan } from './graph-tools.js';
import { clearDebuffTimeline, scheduleDebuffTimeline } from './debuff-timeline.js';
import { bindTimelineSync } from './timeline-sync.js';
import { clearAttemptVisuals, scheduleAttemptVisuals } from './attempt-visuals.js';
import { resetScenes, scanScenes } from './scene-visuals.js';
import { registerRouteEnhancer } from '../v28/route-lifecycle.js';

let scheduled = 0;
function scan() {
  ensureStyle();
  scheduleGraphScan();
  scheduleDebuffTimeline();
  scheduleAttemptVisuals();
  bindTimelineSync().catch(() => {});
  scanScenes();
}
function schedule() {
  if (scheduled) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    scan();
  });
}

registerRouteEnhancer('visual-analysis-workspace', ({ reasons }) => {
  if (reasons.includes('scope-change')) {
    clearDebuffTimeline();
    clearAttemptVisuals();
    resetScenes();
  }
  if (reasons.includes('worker-ready') || reasons.includes('analysis-ready')) {
    clearVisualCaches();
    clearDebuffTimeline();
    clearAttemptVisuals();
    resetScenes();
  }
  schedule();
});

ensureStyle();
scan();
