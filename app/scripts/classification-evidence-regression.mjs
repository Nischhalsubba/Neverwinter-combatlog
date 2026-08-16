import assert from 'node:assert/strict';
import { CLASSIFICATION_EVIDENCE_VERSION, independentCategoryEvidence, verifyPowerCategories } from '../src/engine/classification-evidence.js';

assert.equal(CLASSIFICATION_EVIDENCE_VERSION, 1);
const companion = independentCategoryEvidence({ power: 'Tempest Slash', damage: 100, companionDamage: 100, category: 'Pet / Companion' });
assert.equal(companion.expected, 'Pet / Companion');

const partial = verifyPowerCategories([
  { power: 'Unknown Proc', damage: 50, companionDamage: 0, category: 'Other / Unknown' },
  { power: 'Companion Claw', damage: 100, companionDamage: 100, category: 'Pet / Companion' }
]);
assert.equal(partial.status, 'partial');
assert.equal(partial.checked, 1);
assert.equal(partial.unresolved, 1);
assert.equal(partial.mismatches.length, 0);

const mismatch = verifyPowerCategories([{ power: 'Companion Claw', damage: 100, companionDamage: 100, category: 'Encounter' }]);
assert.equal(mismatch.status, 'mismatch');
assert.equal(mismatch.mismatches.length, 1);

console.log('Independent classification evidence regression passed.');
