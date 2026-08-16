# Windows engine status

The Windows/C# engine is an experimental compatibility implementation. The canonical production combat engine is the browser engine under `app/src/engine/`.

Windows damage summaries now use the same minimum canonical published-damage gate: positive Physical damage, player owner, not Immune, and not ShowPowerDisplayName. Companion separation also requires player ownership plus companion-like source evidence.

The Windows engine does not yet claim production parity for personal/active DPS clocks, encounter reconstruction, ownership folding, taxonomy, effects, or independent verification. Those metrics must not be presented as `Verified`, `Exact`, or production-parity until they pass the shared anonymized golden fixtures and the definition-aware parity contract.

See `app/docs/ENGINE_PARITY.md`.
