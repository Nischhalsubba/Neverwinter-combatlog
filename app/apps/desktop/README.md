# Desktop runtime status

This desktop application is an experimental compatibility client. The production source of truth for combat calculations is the browser engine under `app/src/engine/`.

The desktop TypeScript fallback and legacy Tauri/Rust runtime use the canonical positive Physical player-owned damage gate, but they do not yet claim full production parity for player clocks, active combat, encounter reconstruction, ownership presentation, taxonomy, effects, or verification.

Do not label desktop metrics `Verified`, `Exact`, or production-parity unless the corresponding metric passes the same anonymized golden fixtures and definition-aware parity contract as the browser engine. See `app/docs/ENGINE_PARITY.md`.
