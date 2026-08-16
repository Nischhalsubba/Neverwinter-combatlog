# External parser parity

Strikeglass can compare a verified scope with a captured result from NW-Hub, ACT, or another trusted combat-log parser.

The purpose of parity testing is to find semantic differences, not to force unrelated metric definitions to produce the same number.

## Capture workflow

1. Load the same combat log into Strikeglass and the reference parser.
2. Select the same fight or full-session scope.
3. Record the reference parser's metric definitions, especially its DPS clock and whether companion damage is folded into player totals.
4. Save the reference values in the JSON format below.
5. Import the JSON from **Analysis Checks → External parity**, or run `node scripts/reference-parity.mjs <log> <reference.json>` locally.
6. Investigate every mismatch before changing either implementation.

## Reference JSON

```json
{
  "source": "NW-Hub",
  "capturedAt": "2026-08-16T00:00:00Z",
  "metricDefinitions": {
    "damage": "Reference parser definition",
    "dps": "Reference parser clock definition"
  },
  "scope": { "type": "session" },
  "group": {
    "damage": 0,
    "dps": 0,
    "activeDps": null,
    "duration": 0,
    "hits": 0
  },
  "players": [
    {
      "name": "Player name",
      "damage": 0,
      "dps": 0,
      "activeDps": null,
      "hits": 0,
      "critRate": null,
      "caRate": null
    }
  ]
}
```

Fields may be omitted when the reference parser does not expose them. `null` is treated as not supplied.

## Comparison rules

- Integer counts should match exactly when definitions match.
- Damage numerators should match before rounded `K/M/B` display strings are compared.
- Floating-point comparisons use a tiny numerical tolerance only for representation noise.
- DPS mismatches are not actionable until both parsers' clocks are confirmed to mean the same thing.
- Companion and category differences are treated as classification discrepancies, not arithmetic failures.

## User-supplied 2026-08-14 fixture

The repository contains a small anonymized real-shape excerpt derived from the supplied 2026-08-14 log. Personal names and account handles were replaced while preserving Neverwinter row structure, power names, entity templates, flags, and numerical values. Its expected manifest was calculated independently from the Strikeglass engine and is a mandatory regression fixture.

The complete user log is intentionally not committed.
