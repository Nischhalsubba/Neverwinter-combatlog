# Source of truth

The repository itself is the canonical source for Strikeglass combat behavior and release requirements. Local filesystem paths, archived planning documents, screenshots, external parsers, and historical product documents are supporting evidence only unless their rule has been incorporated into the repository contracts below.

## Canonical contracts

- [`../ACCURACY_CONTRACT.md`](../ACCURACY_CONTRACT.md) — publication states, canonical Physical damage, combat clocks, encounter/companion/taxonomy/effect/completeness rules, external-reference handling, and release gates.
- [`../REFERENCE_PARITY.md`](../REFERENCE_PARITY.md) — NW-Hub/ACT comparison schema, metric-definition rules, parity workflow, and the current 2026-08-14 reference status.
- [`../ENGINE_PARITY.md`](../ENGINE_PARITY.md) — canonical browser-engine ownership and the promotion/fencing rules for TypeScript, Rust, and C# compatibility runtimes.
- [`../../README.md`](../../README.md) and version-controlled application configuration — supported runtime/build behavior.
- The anonymized golden fixtures under `tests/fixtures/` and their regression scripts — executable examples of the canonical contracts.

If prose and executable golden fixtures disagree, the discrepancy must be investigated. Do not silently rewrite either side until the intended contract is established and reviewed.

## Historical product documents

Earlier finalized PRD, technical-specification, and backlog documents may still be useful for product history and unfinished feature context. A previous workspace referenced them through a machine-local Windows path. That path is not portable and is **not** a release-time source of truth.

Any historical requirement that still governs current behavior must be represented by a version-controlled repository contract, test, issue, or implementation. This prevents an inaccessible local document from silently outranking the code and release gates everyone can actually inspect.

## External references

NW-Hub, ACT, game documentation, community spreadsheets, screenshots, and captured logs are evidence sources. They can reveal a bug or missing mechanic, but they do not automatically override the canonical contract. Differences must be traced to exact rows, ownership, scope, encounter boundaries, classification, or metric definitions first.
