import fs from 'node:fs';

const jsPath = 'app/src/v7/boss-effects.js';
let js = fs.readFileSync(jsPath, 'utf8');
const importAnchor = "import { isBossRef } from '../engine/fast-parser-core.js';";
if (!js.includes(importAnchor)) throw new Error('Missing debuff import anchor');
js = js.replace(importAnchor, `${importAnchor}\nimport { ENCOUNTER_POWER_ICON_SPRITE, findEncounterPowerIcon } from '../data/encounter-power-icons.js';`);

const helperAnchor = 'function classificationLabel(effect) {';
if (!js.includes(helperAnchor)) throw new Error('Missing classification helper anchor');
js = js.replace(helperAnchor, `function effectIcon(effect) {
  if (!effect || !['class-power', 'class-feat'].includes(effect.family)) return '';
  const icon = findEncounterPowerIcon(effect.name);
  if (!icon) return '';
  const scale = 0.5;
  const style = [
    \`background-image:url('\\${ENCOUNTER_POWER_ICON_SPRITE.url}')\`,
    \`background-size:\\${ENCOUNTER_POWER_ICON_SPRITE.width * scale}px \\${ENCOUNTER_POWER_ICON_SPRITE.height * scale}px\`,
    \`background-position:-\\${icon.x * scale}px -\\${icon.y * scale}px\`
  ].join(';');
  return \`<span class="debuff-power-icon" style="\\${esc(style)}" aria-hidden="true"></span>\`;
}

${helperAnchor}`);

const invBefore = '<div class="debuff-item-name"><span>${esc(classificationLabel(effect))}</span><strong>${esc(effect.name)}</strong><small>${esc(description)}</small></div>';
const invAfter = '<div class="debuff-item-identity">${effectIcon(effect)}<div class="debuff-item-name"><span>${esc(classificationLabel(effect))}</span><strong>${esc(effect.name)}</strong><small>${esc(description)}</small></div></div>';
if (!js.includes(invBefore)) throw new Error('Missing inventory icon anchor');
js = js.replace(invBefore, invAfter);

const timedBefore = '<div class="debuff-item-name"><span>Verified debuff</span><strong>${esc(effect.name)}</strong><small>${esc(effect.description)}</small></div>';
const timedAfter = '<div class="debuff-item-identity">${effectIcon(effect)}<div class="debuff-item-name"><span>Verified debuff</span><strong>${esc(effect.name)}</strong><small>${esc(effect.description)}</small></div></div>';
if (!js.includes(timedBefore)) throw new Error('Missing timed icon anchor');
js = js.replace(timedBefore, timedAfter);
fs.writeFileSync(jsPath, js);

const cssPath = 'app/src/v7/boss-effects.css';
let css = fs.readFileSync(cssPath, 'utf8');
const cssAnchor = '.debuff-item-name{display:grid;gap:2px;min-width:0}';
if (!css.includes(cssAnchor)) throw new Error('Missing debuff CSS anchor');
css = css.replace(cssAnchor, `.debuff-item-identity{display:flex;align-items:center;gap:9px;min-width:0}\n.debuff-power-icon{flex:0 0 32px;width:32px;height:32px;border:1px solid var(--line);border-radius:6px;background-repeat:no-repeat;background-color:var(--surface-muted,#f8fafc);box-shadow:0 1px 2px rgba(15,23,42,.14)}\n${cssAnchor}`);
fs.writeFileSync(cssPath, css);
console.log('Debuff class-power icons patched.');
