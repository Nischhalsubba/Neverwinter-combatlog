# Strikeglass SEO Foundation

## Current canonical origin

```text
https://neverwinter-combatlog.hinischalsubba.workers.dev
```

`app/site.config.mjs` records the current production origin. Do not replace it with a future custom domain until that domain is live and ready to become canonical.

## Public pages

- `/` — analyzer and product overview
- `/how-to-use/` — Neverwinter combat logging and Strikeglass workflow
- `/dps-explained/` — damage, DPS, Active DPS, group share, critical rate, and Combat Advantage
- `/privacy/` — local processing and external-library disclosure
- `/about/` — product purpose and verification approach

## Discovery files

The production build publishes these at the asset root:

- `/robots.txt`
- `/sitemap.txt`
- `/site.webmanifest`

The sitemap intentionally uses the plain-text sitemap format: one fully-qualified URL per line.

## Homepage metadata

The analyzer homepage contains:

- descriptive title and meta description
- canonical URL
- index/follow robots metadata
- Open Graph metadata
- Twitter/X card metadata
- `WebSite` structured data with the preferred site name `Strikeglass`
- `SoftwareApplication` structured data describing the browser app

## Search content policy

Public copy should answer real player questions rather than repeat keyword variants.

Useful search intent includes:

- Neverwinter combat log analyzer
- Neverwinter DPS
- boss damage analysis
- compare player damage
- Neverwinter power damage
- DPS versus Active DPS

Analytical screens remain data-first. Search-oriented explanatory copy belongs in the empty state and the dedicated public pages.

## Custom-domain migration

When a branded domain is available, change the origin as one release and update:

1. homepage canonical URL
2. help-page canonical URLs
3. Open Graph URLs
4. structured-data URLs
5. robots sitemap URL
6. sitemap URLs
7. repository/public links
8. Search Console property and submitted sitemap

Keep redirects from the previous canonical host when the hosting configuration supports them.

## Search Console

Do not commit a made-up verification token. Add the actual Google verification method only after the production domain/property is selected and the real verification value exists.

After verification:

1. submit `/sitemap.txt`
2. inspect the homepage and public help pages
3. request indexing when appropriate
4. monitor indexing, crawl, canonical, and Core Web Vitals reports

## Social sharing

The canonical brand artwork source is `app/src/v6/brand/strikeglass-social.svg`.

The homepage currently has social metadata. A 1200×630 raster export should be used as the final share image when the binary asset is available in the production repository.
