# Strikeglass Brand System

## Brand foundation

**Product name:** Strikeglass  
**Category:** Neverwinter combat log analysis  
**Brand line:** **See the fight clearly.**  
**Trust promise:** **Double checked. Kept local.**

Strikeglass turns Neverwinter combat logs into clear answers about damage, powers, players, and fights. Accuracy and speed are product qualities; clarity is the brand.

## Brand idea

The name combines two ideas:

- **Strike** — combat events, impact, action, and measurable results.
- **Glass** — clarity, inspection, transparency, and seeing through noise.

The primary mark is a simple glass pane crossed by one diagonal strike. It is analytical rather than fantasy-themed so it can sit beside dense combat data without competing with it.

## Brand personality

Strikeglass is **clear, exact, fast, calm, and private**.

Strikeglass is not theatrical, cyberpunk, gamer-neon, corporate-slogan heavy, jargon-first, or chatty inside analytical screens.

## Voice

Use short, direct language. Prefer the term a player would use over an internal engineering term.

| Use | Avoid in normal UI |
| --- | --- |
| Summary | Overview workspace |
| Fight | Encounter window |
| Player | Actor / entity |
| Power | Ability telemetry |
| Active DPS | Combat DPS calculation clock |
| Double checked | Dual-engine verification |
| Log Health | Diagnostics |
| Rows we could not read | Rejected parser rows |
| Current fight | Active scope |
| Open log | Ingest telemetry file |

Implementation terms may appear in **Log Health** when they genuinely help diagnose a problem.

### Status language

Use these states consistently:

- **Ready** — nothing is running.
- **Reading log** — file parsing is in progress.
- **Calculating** — the first calculation is running.
- **Checking numbers** — the second calculation is running.
- **Double checked** — both calculations agree.
- **Needs attention** — the app cannot safely publish the result.

`Double checked` describes the mechanism without pretending the source log itself is infallible.

## Logo

The primary symbol is the **Strikeglass mark**: a diamond-shaped pane crossed by one diagonal strike.

- outer diamond: pane / inspection surface
- diagonal cut: impact / damage event
- open center: data passing through the mark rather than being hidden behind ornament

Rules:

- Use the symbol with the Strikeglass wordmark in product headers.
- Use the symbol alone for favicon-sized contexts.
- Keep the mark upright.
- Do not rotate, skew, glow, bevel, or place it inside another badge.
- Do not animate it continuously.
- Minimum UI size: 18px.
- Preferred sidebar size: 26px.

## Color

```css
--sg-brand-blue: #2563eb;
--sg-brand-cyan: #0891b2;
--sg-brand-ink: #0f172a;
--sg-brand-slate: #475569;
--sg-brand-frost: #f6f8fb;
--sg-brand-white: #ffffff;
--sg-brand-verified: #15803d;
--sg-brand-boss: #b45309;
--sg-brand-error: #b91c1c;
```

- Blue is the primary action/navigation color.
- Cyan is the secondary data signal and logo strike.
- Ink and slate carry most text.
- Green is reserved for checked/success states.
- Amber is reserved for boss/warning meaning.
- Red is reserved for errors and blocked results.
- Color is never the sole carrier of meaning.
- Avoid decorative gradients in the application shell.

## Typography

Use the performance-friendly product stack everywhere:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

The wordmark does not introduce a separate font download.

- Wordmark: 15px / 750 / -0.025em
- Brand descriptor: 10px / 650
- Brand line: normal product typography
- Monospace: timestamps, references, checksums, and machine-oriented telemetry only

## Product signature

Use these phrases consistently:

- **See the fight clearly.** — brand line; empty state, documentation, and public release surfaces.
- **Double checked. Kept local.** — compact trust statement when both concepts matter.
- **Double checked** — verified state inside the application.
- **Kept local** or **Stays on this device** — privacy explanation.

Do not repeat the brand line on every analytical screen.

## Public search identity

The public search name is **Strikeglass**.

Until a custom domain is adopted, the canonical production origin is:

```text
https://neverwinter-combatlog.hinischalsubba.workers.dev
```

The origin is tracked in `app/site.config.mjs`. A future custom-domain migration must update all canonical URLs, Open Graph URLs, structured data, sitemap URLs, robots sitemap location, public help pages, repository links, and Search Console property together.

### Canonical homepage copy

**Title:** `Strikeglass | Neverwinter Combat Log Analyzer`

**Description:** `Analyze Neverwinter combat logs locally with double-checked DPS, boss fights, player comparison, power damage, and raw-hit details.`

### Public indexable pages

- `/` — analyzer and product explanation
- `/how-to-use/` — combat-log setup and product workflow
- `/dps-explained/` — DPS, Active DPS, group share, critical rate, and Combat Advantage
- `/privacy/` — local processing and external-library disclosure
- `/about/` — product purpose and verification approach

### Search metadata rules

Every indexable page must have:

- one descriptive `<title>`
- one concise meta description
- one canonical URL
- `index,follow` robots metadata unless there is a deliberate reason not to index it
- Open Graph title, description, URL, and image
- Twitter/X card metadata
- structured data only when it accurately describes visible page content
- internal links to at least one other useful Strikeglass page

The homepage publishes `WebSite` and `SoftwareApplication` structured data. Help pages publish `WebPage` structured data.

### Search discovery files

Production must expose:

- `/robots.txt`
- `/sitemap.txt`
- `/site.webmanifest`

These are copied to the static-asset root by the production build. Do not leave them only under `/src/`.

### Search content rules

Use phrases such as **Neverwinter combat log analyzer**, **Neverwinter DPS**, **boss damage**, **player comparison**, and **power damage** only where the page genuinely answers that intent. Do not stuff repeated keyword variants into analytical UI.

SEO content belongs primarily in the empty/public state and dedicated help pages. Once a log is loaded, combat data remains the focal point.

## Social/share identity

The preferred share treatment uses the Strikeglass mark, the name, **See the fight clearly.**, and the trust promise on the light V6 palette.

- Source artwork: `app/src/v6/brand/strikeglass-social.svg`
- Preferred final share export: 1200×630 PNG when a raster asset can be published reliably
- No combat-log screenshots containing player/account information in default social artwork
- No fake performance claims or unverified numerical examples in share artwork

## UI expression

Branding frames the data rather than competing with it.

- Sidebar carries symbol + wordmark.
- Top bar stays functional and compact.
- Empty state may use the brand line as its main heading.
- Primary buttons use solid brand blue.
- Active navigation uses the pale blue selected surface.
- Tables, charts, and metrics stay primarily neutral.
- Public SEO/product copy is hidden with the empty state once analysis begins.
- No branded texture or persistent WebGL effect behind analytics.

## Motion

Allowed:

- 120–220ms opacity/translate entrance with the surrounding shell
- subtle button press feedback
- short verified-state transition

Forbidden:

- pulsing logo
- perpetual glow
- rotating mark
- animated wordmark
- splash-screen delay added only to show branding

## Privacy language

State only what the application actually does:

- the combat log is parsed in browser workers on the device
- dashboard layout preferences may be stored locally
- optional interface libraries may be fetched from jsDelivr
- the combat-log file is not sent to those libraries by the analysis pipeline

Do not turn `Kept local` into a broader security guarantee.

## Naming rule

The product is always **Strikeglass** as one word with a capital S.

Do not write:

- Strike Glass
- StrikeGlass
- STRIKEGLASS in normal prose
- Strikeglass Analyzer as the primary product name

Descriptors can follow the name when context needs them, for example **Strikeglass — Neverwinter combat analysis**.

## Brand QA checklist

Before shipping a public UI change:

- Is the product name written correctly?
- Does the visible copy use plain combat language?
- Is `Double checked` used instead of verifier jargon outside Log Health?
- Does privacy copy accurately describe local processing without overclaiming?
- Are blue/cyan accents restrained enough that data stays primary?
- Is the mark free of glow, distortion, and continuous animation?
- Do page title, canonical URL, Open Graph URL, structured data URL, and sitemap agree on the same origin?
- Do public help pages explain something useful instead of existing only for keywords?
- Does the page still read clearly when branding decoration is ignored?
