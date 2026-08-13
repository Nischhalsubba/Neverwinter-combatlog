# Strikeglass Interface System

## Direction

Strikeglass is a dense desktop-first combat telemetry tool. Its composition follows the tactical analytics reference supplied for the redesign: persistent navigation, compact operational chrome, bordered data panels, small controls, high information density, and analysis visible immediately after parsing. The visual identity remains Strikeglass rather than inheriting the reference palette or typeface.

## Color tokens

- Background: `#071018`
- Panel: `#0c1721`
- Secondary panel: `#0f1d28`
- Elevated panel: `#12232f`
- Border: `#203544`
- Primary text: `#eef7fb`
- Muted text: `#91a7b7`
- Secondary muted text: `#6f8796`
- Data signal: `#65e4ff`
- Secondary data: `#4fa3ff`
- Success: `#63f5b0`
- Boss / warning: `#ffbf69`
- Error: `#ff6f78`

Color is never the only carrier of chart or status meaning.

## Typography

- UI: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Telemetry labels and compact machine data: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
- Body: 11–13px in dense analytical surfaces
- Section title: 20–34px depending on context
- Numeric values: tabular figures

## Spacing and density

- Base unit: 4px
- Common gaps: 4, 8, 10, 12, 16px
- Desktop content padding: 16–18px
- Table row target: approximately 38px visual height
- Interactive controls remain at least 44px high
- Avoid large hero regions after a log is loaded

## Shape and elevation

- Small controls: 4px radius
- Panels: 7px radius
- Large transient surfaces: 10px radius
- Use 1px borders and surface contrast for depth
- No decorative card shadows
- No glass-heavy treatment in analytical views

## Layout

- Desktop: persistent 232px navigation sidebar and 52px top utility bar
- At narrower desktop widths the sidebar collapses to an icon rail
- Mobile: navigation becomes a bottom rail
- Analysis uses fluid grids rather than fixed-width canvases
- Charts resize to their panel and tables overflow only when necessary for legibility

## Motion

- Personality: precise, restrained, technical
- Micro: 120ms
- Standard: 220–280ms
- Easing: `cubic-bezier(.2,0,0,1)` / GSAP `power2.out`
- Entrances: 6–12px translation plus opacity
- No bounce, elastic easing, long scroll choreography, or animation that delays data access
- Reduced motion removes nonessential movement

## Data visualization

- uPlot Canvas charts are the primary time-series renderer
- Chart values are derived from worker report buckets only for visualization
- Exact totals always come from parser aggregates
- Multi-player series use labels and distinct dash patterns in addition to color
- Large timelines are bucketed for rendering without mutating exact totals

## Effects

- Three.js is allowed only on the idle/open-log state
- It stops and disposes when parsing or analysis begins
- It is disabled for reduced motion, save-data, and low-resource devices
- Active analytics views do not run decorative WebGL

## Core components

- Persistent sidebar navigation with an active vertical signal
- Compact top utility bar
- Global scope toolbar for session / encounter / boss filtering
- Dense metric tiles
- Bordered data panels
- Sort/read-oriented tables
- Player contribution bars
- Canvas time-series charts
- Parser diagnostics with explicit rejection evidence
