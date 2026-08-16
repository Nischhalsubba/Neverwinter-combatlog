# Engine parity contract

The browser engine under `src/engine/` is the canonical production Strikeglass engine. The TypeScript browser-safe desktop fallback, the legacy Tauri/Rust runtime, and the Windows/C# engine are experimental compatibility implementations until they pass the complete browser golden-fixture contract for both numerators and metric semantics.

## Canonical published damage numerator

Every bundled implementation that publishes a damage total must now gate that total on the same minimum evidence contract:

1. positive magnitude;
2. event type `Physical`;
3. player owner reference (`P[`);
4. not `Immune`;
5. not `ShowPowerDisplayName`.

This prevents an experimental desktop runtime from silently counting Poison, Fire, Shield, display-marker, or enemy-owned rows as player damage while the production browser engine correctly excludes them.

Companion-like sources may be separated for presentation by the experimental clients, but their published damage rows must still originate from a player owner and use companion/pet/appointment/summon evidence rather than treating every creature source as a companion.

## What is not yet production parity

Aligning the damage numerator does **not** make the old desktop engines production-equivalent. Their historical data models still differ in areas such as:

- player-vs-companion presentation and ownership folding;
- personal DPS versus encounter-wide EncDPS clocks;
- active-combat reconstruction;
- boss encounter segmentation and phase merging;
- taxonomy, rotation, Effect Intelligence, and independent verification.

Those clients must therefore describe themselves as experimental/legacy. They must not use the browser application's `Verified`, `Exact`, or production-parity language for a metric until the same anonymized golden fixtures and definition-aware parity checks pass for that metric.

## Release gates

Changes under the experimental desktop/Windows engines are checked by:

- TypeScript compilation for the browser-safe desktop client;
- Windows engine executable tests on .NET 8;
- source-contract regression for the TypeScript, Rust, and C# canonical damage guards;
- the canonical browser real-log corpus, which remains the authoritative production gate.

The Rust engine contains native unit coverage for the canonical damage guard. A future promotion of the Rust desktop runtime to production parity must add a dedicated Rust CI environment and run the full golden corpus rather than relying on source inspection alone.

## Promotion rule

A non-browser engine can be marked production-parity only after it consumes the same anonymized real-log corpus and matches every metric whose definition is declared equivalent. A mismatching metric must remain explicitly unsupported, experimental, or differently named. Tolerances must not be widened merely to obtain a parity badge.
