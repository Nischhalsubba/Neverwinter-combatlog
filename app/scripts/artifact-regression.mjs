import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [index, buildManifestText, assetManifestText] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/build-manifest.json', 'utf8'),
  readFile('public/asset-manifest.json', 'utf8')
]);
const build = JSON.parse(buildManifestText);
const assets = JSON.parse(assetManifestText);

assert.equal(build.name, 'Strikeglass');
assert.match(build.version, /^\d+\.\d+\.\d+$/);
assert.match(build.artifactIdentity, /^[a-f0-9]{64}$/);
assert.equal(build.artifactIdentity, assets.artifactIdentity);
assert.match(build.entrypoints.js, /^\/assets\/strikeglass-shell\.[a-f0-9]{12}\.js$/);
assert.match(build.entrypoints.css, /^\/assets\/strikeglass\.[a-f0-9]{12}\.css$/);
assert.ok(build.assetCount > 20, 'production package should contain substantive assets');
assert.ok(build.contracts?.parser && build.contracts?.verifier && build.contracts?.supportCatalog, 'build identity must fingerprint analysis contracts');
assert.ok(index.includes(build.entrypoints.js), 'production index must use the hashed JavaScript entrypoint');
assert.ok(index.includes(build.entrypoints.css), 'production index must use the hashed CSS entrypoint');
assert.ok(!index.includes('src/v3/app.js"></script>'), 'production index must not eagerly load the source app entry');
assert.ok(!index.includes('src/v13/settings.js"></script>'), 'production index must not eagerly load source settings');
await assert.rejects(access('public/src/integrations/supabase/browser-client.js'), 'unused Supabase client must not ship in the local-only production package');

console.log(`Production artifact regression passed (${build.version}, ${build.artifactIdentity.slice(0, 12)}).`);
