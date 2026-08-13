import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SITE, absoluteUrl } from '../site.config.mjs';

export const socialImageUrl = absoluteUrl(SITE.socialImagePath);

export function renderTokens(source, page) {
  return source
    .replaceAll('{{SITE_ORIGIN}}', SITE.origin)
    .replaceAll('{{CANONICAL_URL}}', absoluteUrl(page.path))
    .replaceAll('{{PAGE_TITLE}}', page.title)
    .replaceAll('{{PAGE_DESCRIPTION}}', page.description)
    .replaceAll('{{SOCIAL_IMAGE_URL}}', socialImageUrl);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function jsonLd(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function renderStaticPage(page) {
  const canonical = absoluteUrl(page.path);
  const sections = page.sections.map(section => `
        <section class="content-section">
          <h2>${escapeHtml(section.heading)}</h2>
          ${section.paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('\n          ')}
          ${section.code ? `<div class="code-line">${escapeHtml(section.code)}</div>` : ''}
          ${section.formula ? `<div class="formula">${escapeHtml(section.formula)}</div>` : ''}
        </section>`).join('');
  const related = page.related?.length ? `
      <nav class="related" aria-label="Related Strikeglass guides">
        ${page.related.map(item => `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join('\n        ')}
      </nav>` : '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.heading,
    url: canonical,
    description: page.description,
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: absoluteUrl('/') }
  };

  return `<!doctype html>
<html lang="${SITE.language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="${SITE.themeColor}">
  <meta name="color-scheme" content="light">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="description" content="${escapeHtml(page.description)}">
  <title>${escapeHtml(page.title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/svg+xml" href="/src/v6/brand/strikeglass-mark.svg">
  <link rel="icon" type="image/png" sizes="48x48" href="/assets/icon-48.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Strikeglass">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${socialImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Strikeglass — See the fight clearly.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${socialImageUrl}">
  <meta name="twitter:image:alt" content="Strikeglass — See the fight clearly.">
  <link rel="stylesheet" href="/site.css">
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head>
<body>
  <header class="site-header"><div class="site-header-inner">
    <a class="site-brand" href="/" aria-label="Strikeglass home"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="sg-pane" d="M12 2.75 21.25 12 12 21.25 2.75 12 12 2.75Z"/><path class="sg-strike" d="M5.6 15.45 18.4 8.55"/></svg><span>Strikeglass</span></a>
    <nav class="site-nav" aria-label="Strikeglass guides"><a href="/how-to-use/">How to use</a><a href="/dps-explained/">DPS explained</a><a href="/privacy/">Privacy</a><a href="/about/">About</a></nav>
  </div></header>
  <main class="page-shell">
    <p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.heading)}</h1><p class="lede">${escapeHtml(page.intro)}</p>
    <div class="trust"><i></i><span>Double checked. Kept local.</span></div>
    <article class="content-card">${sections}</article>${related}
  </main>
  <footer class="site-footer"><div class="site-footer-inner">
    <nav class="site-footer-links" aria-label="Footer"><a href="/">Open Strikeglass</a><a href="/how-to-use/">How to use</a><a href="/dps-explained/">DPS explained</a><a href="/privacy/">Privacy</a><a href="/about/">About</a></nav>
    <div>Strikeglass is an independent community tool and is not affiliated with or endorsed by Arc Games or Cryptic Studios.</div>
  </div></footer>
</body>
</html>`;
}

export async function writeStaticPage(publicDir, page, html) {
  const destination = join(publicDir, page.path.replace(/^\//, ''), 'index.html');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html, 'utf8');
}

export async function writeDiscoveryFiles(publicDir) {
  await writeFile(join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`, 'utf8');
  const entries = SITE.pages.map(page => `  <url>\n    <loc>${absoluteUrl(page.path)}</loc>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`).join('\n');
  await writeFile(join(publicDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`, 'utf8');
  const manifest = {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: SITE.themeColor,
    theme_color: SITE.themeColor,
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/src/v6/brand/strikeglass-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
    ]
  };
  await writeFile(join(publicDir, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
