# Strikeglass Brand System

## Brand foundation

**Product name:** Strikeglass

**Category:** Neverwinter combat analysis

**Brand line:** **See the fight clearly.**

**Trust promise:** **Checked twice. Kept local.**

Strikeglass turns Neverwinter combat logs into clear answers about damage, powers, players, and fights. The product should feel precise and dependable without sounding like a developer console. Accuracy and speed are product qualities; clarity is the brand.

## Brand idea

The name combines two ideas:

- **Strike** — the combat event, impact, action, and measurable result.
- **Glass** — clarity, inspection, transparency, and seeing through noise.

The visual identity uses a simple glass pane cut by a single strike. It should feel analytical rather than fantasy-themed, so the product can sit beside dense combat data without competing with it.

## Brand personality

Strikeglass is:

- **Clear** — explain the result before exposing implementation details.
- **Exact** — numbers are treated as evidence, not decoration.
- **Fast** — the interface responds immediately and heavy work happens in the background.
- **Calm** — no visual noise, fake urgency, or unnecessary motion.
- **Private** — the log stays on the device unless the user explicitly exports something.

Strikeglass is not:

- theatrical
- cyberpunk
- gamer-neon
- corporate-slogan heavy
- jargon-first
- chatty inside analytical screens

## Voice

Use short, direct language. Prefer the term a player would use over an internal engineering term.

### Preferred vocabulary

| Use | Avoid in normal UI |
| --- | --- |
| Summary | Overview workspace |
| Fight | Encounter window |
| Player | Actor / entity |
| Power | Ability telemetry |
| Active DPS | Combat DPS calculation clock |
| Checked twice | Dual-engine verification |
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
- **Checked twice** — both calculations agree.
- **Needs attention** — the app cannot safely publish the result.

Do not use success language that implies certainty beyond the data. `Checked twice` describes the mechanism without pretending the source log itself is infallible.

## Logo

The primary symbol is the **Strikeglass mark**: a diamond-shaped pane crossed by one diagonal strike.

### Meaning

- outer diamond: a pane / inspection surface
- diagonal cut: impact / damage event
- open center: data passing through the mark rather than being hidden behind ornament

### Usage

- Use the symbol with the Strikeglass wordmark in the sidebar and product headers.
- Use the symbol alone for favicon-sized contexts.
- Keep the mark upright. Do not rotate, skew, glow, bevel, or place it inside another badge.
- Do not animate the logo continuously.
- Minimum UI size: 18px.
- Preferred sidebar size: 26px.

## Color

The brand stays inside the approved V6 light design rather than creating a second palette.

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

### Rules

- Brand blue is the primary action and navigation color.
- Brand cyan is the secondary data signal and the strike inside the logo.
- Ink and slate carry most text.
- Green is reserved for checked/success states.
- Amber is reserved for boss/warning meaning.
- Red is reserved for errors and blocked results.
- Never make normal analytical content depend on color alone.
- Avoid decorative gradients in the application shell. Charts may use multiple semantic series colors when required.

## Typography

Use the existing performance-friendly stack everywhere:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

The wordmark is not a separate font asset. It uses the product typeface with tighter tracking and strong weight so branding does not add a network dependency.

- Wordmark: 15px / 750 / -0.025em
- Brand descriptor: 10px / 650 / 0.02em
- Brand line: normal product typography; never script or display lettering
- Monospace remains reserved for machine-oriented values such as timestamps and references

## Product signature

Use these phrases consistently:

- **See the fight clearly.** — brand line; empty state, documentation, release surfaces.
- **Checked twice. Kept local.** — compact trust statement when both concepts are relevant.
- **Checked twice** — verified state inside the application.
- **Kept local** or **Stays on this device** — privacy explanation.

Do not repeat the brand line on every screen. One strong use is branding; six uses are wallpaper.

## UI expression

Branding should frame the data, not compete with it.

- Sidebar carries the full symbol + wordmark.
- Top bar stays functional and compact.
- Empty state may use the brand line as the main heading.
- Primary buttons use solid brand blue.
- Active navigation uses the pale blue selected surface.
- Tables, charts, and metrics remain primarily neutral.
- No branded background texture behind analytics.
- The optional Three.js empty-state particles remain subtle and are not part of the logo.

## Motion

The mark itself stays still during normal use.

Allowed brand motion:

- 120-220ms opacity/translate entrance with the surrounding shell
- subtle button press feedback
- short verified-state transition

Forbidden:

- pulsing logo
- perpetual glow
- rotating mark
- animated wordmark
- splash-screen delay added only to show branding

## Accessibility

- The symbol is decorative when the visible wordmark is present and should use `aria-hidden="true"`.
- Standalone logo links/buttons require an accessible name.
- Brand colors must maintain the V6 contrast rules.
- The wordmark must remain readable at compact sidebar sizes.

## Naming rule

The product is always **Strikeglass** as one word with a capital S.

Do not write:

- Strike Glass
- StrikeGlass
- STRIKEGLASS in normal prose
- Strikeglass Analyzer as the primary product name

Descriptors can follow the name when context needs them, for example **Strikeglass — Neverwinter combat analysis**.

## Canonical browser copy

**Title:** `Strikeglass | Neverwinter Combat Analysis`

**Description:** `Strikeglass turns Neverwinter combat logs into clear, double-checked fight, player, and power analysis. Your log stays on your device.`

## Brand QA checklist

Before shipping a UI change:

- Is the product name written correctly?
- Does player-facing copy use plain combat language?
- Is `Checked twice` used instead of internal verification jargon outside Log Health?
- Does privacy copy say the log stays on the device without making broader security claims?
- Are blue/cyan accents restrained enough that the data remains the focal point?
- Is the logo used without glow, distortion, or continuous animation?
- Does the page still read clearly if all branding decoration is ignored?
