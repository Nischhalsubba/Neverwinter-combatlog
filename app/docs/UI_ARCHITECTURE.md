# Strikeglass UI Composition Contract

Strikeglass now has a stable composition layer for analysis context and investigation surfaces.

## Stable regions

The workspace owns these regions in order:

1. analysis toolbar
2. composition context slot
3. core route root
4. investigation root
5. composition supporting slot

Feature modules must register content with the composition shell or render into a dedicated investigation root. New essential UI must not discover arbitrary siblings in the core route and insert panels before or after them.

## CSS ownership

New UI uses this cascade layer order:

```css
@layer sg.tokens, sg.layout, sg.components, sg.features, sg.utilities;
```

Layout rules decide where a component lives. Feature rules decide what that component looks like. A feature stylesheet must not redefine the parent route grid merely because the feature happens to render inside that route.

Legacy unlayered styles remain supported while older views migrate. New v29 selectors are namespaced to avoid relying on higher-specificity overrides.

## Trust language

Use `Exact`, `Derived`, `Inferred`, `Partial`, and `Unknown` according to `docs/ACCURACY_CONTRACT.md`. `Verified` describes a check that actually ran; it does not automatically promote inferred game concepts to exact facts.

Observed behavior must stay observational. For example, Attempt Lab may report an unusually long observed power interval. It must not call that interval a missed cast because the log cannot prove cooldown state, encounter mechanics, movement constraints, or player intent.

## Investigation surfaces

Evidence Map, Attempt Lab, Fight Fingerprints, Moment Inspector, Compare 2.0, and Longitudinal Trends are dedicated investigation surfaces. They share current fight/player selectors, keep core navigation reachable, restore the previous core route when dismissed, and refresh when the selected scope or player changes.
