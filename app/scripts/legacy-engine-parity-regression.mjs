import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [browser, desktop, rust, windows, docs, desktopReadme, windowsReadme] = await Promise.all([
  read('src/engine/fast-parser-core.js'),
  read('apps/desktop/src/ipc/localEngine.ts'),
  read('apps/desktop/src-tauri/src/engine/mod.rs'),
  read('apps/windows/NexusCombatAnalyzer.Engine/Summaries/CombatLogSummarizer.cs'),
  read('docs/ENGINE_PARITY.md'),
  read('apps/desktop/README.md'),
  read('apps/windows/README.md')
]);

assert.match(browser, /CANONICAL_DAMAGE_TYPES = new Set\(\['physical'\]\)/, 'browser canonical damage must remain Physical-only');
assert.match(browser, /FLAG\.SHOW_POWER_DISPLAY_NAME/, 'browser canonical guard must exclude display-marker rows');

assert.match(desktop, /function isCanonicalPublishedDamage/);
assert.match(desktop, /eventType\.trim\(\)\.toLowerCase\(\) !== "physical"/i);
assert.match(desktop, /isPlayerRef\(parsed\.ownerRef\)/);
assert.match(desktop, /showpowerdisplayname/);
assert.match(desktop, /isCompanionRef/);
assert.doesNotMatch(desktop, /parsed\.sourceRef\.startsWith\("C\["\)/, 'desktop fallback must not classify every creature source as a companion');

assert.match(rust, /fn is_canonical_published_damage/);
assert.match(rust, /eq_ignore_ascii_case\("physical"\)/);
assert.match(rust, /is_player_ref\(event\.owner_ref\.as_deref\(\)\)/);
assert.match(rust, /showpowerdisplayname/);
assert.doesNotMatch(rust, /contains\("artifact"\)/, 'Rust companion attribution must not promote arbitrary artifact-like creature sources');

assert.match(windows, /IsCanonicalPublishedDamage/);
assert.match(windows, /parsedEvent\.EventType, "Physical"/);
assert.match(windows, /parsedEvent\.OwnerRef\.StartsWith\("P\["/);
assert.match(windows, /ShowPowerDisplayName/);
assert.match(windows, /sourceRef\.Contains\("pet_"/);
assert.doesNotMatch(windows, /parsedEvent\.SourceRef\.StartsWith\("C\["/, 'Windows companion attribution must not promote every creature source');

for (const text of [docs, desktopReadme, windowsReadme]) {
  assert.match(text, /experimental/i);
  assert.match(text, /browser engine/i);
  assert.match(text, /production parity|production-parity/i);
}
assert.match(docs, /positive magnitude/i);
assert.match(docs, /event type `Physical`/i);
assert.match(docs, /golden fixture/i);
assert.match(docs, /must not use.*Verified/is);

console.log('Experimental engine canonical-damage parity regression passed.');
