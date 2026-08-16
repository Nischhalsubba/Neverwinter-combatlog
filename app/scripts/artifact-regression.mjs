import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [index, buildManifestText, assetManifestText, robots, sitemap, webmanifest, howTo, dpsExplained, privacy, about] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/build-manifest.json', 'utf8'),
  readFile('public/asset-manifest.json', 'utf8'),
  readFile('public/robots.txt', 'utf8'),
  readFile('public/sitemap.txt', 'utf8'),
  readFile('public/site.webmanifest', 'utf8'),
  readFile('public/how-to-use/index.html', 'utf8'),
  readFile('public/dps-explained/index.html', 'utf8'),
  readFile('public/privacy/index.html', 'utf8'),
  readFile('public/about/index.html', 'utf8')
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

assert.match(robots, /User-agent: \*/);
assert.match(robots, /sitemap\.txt/);
assert.match(sitemap, /\/how-to-use\//);
assert.match(sitemap, /\/dps-explained\//);
assert.equal(JSON.parse(webmanifest).name, 'Strikeglass');
assert.match(howTo, /How to Use Strikeglass/);
assert.match(dpsExplained, /DPS and Active DPS Explained/);
assert.match(privacy, /Strikeglass Privacy/);
assert.match(about, /About Strikeglass/);

for (const path of ['robots.txt','sitemap.txt','site.webmanifest','how-to-use/index.html','dps-explained/index.html','privacy/index.html','about/index.html']) {
  assert.ok(assets.assets[path], `${path} must be included in the fingerprinted production artifact`);
}

console.log(`Production artifact regression passed (${build.version}, ${build.artifactIdentity.slice(0, 12)}). SEO/discovery pages, local-first exclusions, analysis contracts, and hashed entrypoints are fingerprinted in the exact artifact.`);
