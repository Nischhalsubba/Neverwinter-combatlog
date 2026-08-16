import assert from 'node:assert/strict';
import { SUPPORT_EFFECT_CATALOG } from '../src/data/support-effect-catalog.js';
import { catalogFreshness } from '../src/v29/analysis-model.js';

const freshness = catalogFreshness(SUPPORT_EFFECT_CATALOG);
assert.ok(SUPPORT_EFFECT_CATALOG.length >= 20, 'support catalog should contain substantive mechanic coverage');
assert.ok(freshness.sourceCount >= 4, 'support catalog should retain multiple independent source records');
assert.ok(freshness.newest?.updated, 'at least one source must expose a freshness date');
assert.ok(!freshness.staleSources.some(source => source.ageDays > 550), `source data older than 550 days requires explicit review: ${freshness.staleSources.map(source => `${source.label}/${source.section || ''}`).join(', ')}`);
console.log(`Catalog freshness passed: ${freshness.sourceCount} source records, newest ${freshness.newest.updated}, ${freshness.undatedSources} undated, ${freshness.unsourcedEffects} unsourced effects.`);
