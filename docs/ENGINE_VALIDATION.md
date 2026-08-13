# Engine validation with real logs

Strikeglass uses synthetic regressions for known parser edge cases and should also maintain a small set of anonymized real-log fixtures for numerical parity.

## Target cases

1. Short single-boss fight.
2. Boss fight with adds or multiple phases.
3. Long dungeon or roughly one-hour session.
4. Pet or companion-heavy player.
5. Messy log containing out-of-order timestamps, opaque entity IDs, malformed rows, or combat-gap edge cases.

## Values to capture

For each relevant player and fight, record exact values where possible:

- damage
- DPS
- Active DPS
- elapsed duration
- active-combat duration
- hits
- critical rate
- Combat Advantage rate
- biggest hit and power
- top power damage and hits
- damage taken
- healing
- shielding
- boss-only damage
- full-fight damage

For group scope, record group damage, group DPS, group Active DPS, fight duration, boss name, and encounter count.

## Acceptance rule

A fixture passes only when:

1. Engine 1 produces the expected source metrics.
2. Engine 2 independently agrees with Engine 1 on the publication contract.
3. The verified result matches the trusted fixture values under the documented Strikeglass metric definition.
4. The frontend formats the verified value without recalculating it.

Use exact equality for integer totals and counts whenever practical. For derived floating-point metrics, compare the underlying damage numerator and duration before treating display rounding as an engine error.

Do not widen verifier tolerance merely to make a fixture pass. Trace disagreements to row inclusion, time windows, ownership, encounter detection, or scope definitions.

## Fixture format

Each safe fixture should include the reduced/anonymized log plus a small JSON manifest, for example:

```json
{
  "fixture": "single-boss-example",
  "scope": { "type": "boss", "label": "Boss name" },
  "players": {
    "PlayerA": {
      "damage": 5600000000,
      "dps": 1555987,
      "combatDps": 2200000,
      "hits": 12345
    }
  }
}
```

Store exact numerical values in fixtures. K, M, and B abbreviations belong only in presentation tests.

## Release gate

Once real fixtures exist, changes to parsing, damage inclusion, combat clocks, boss detection, player or companion ownership, power classification, and verification logic should run the real-log fixture suite before production release.
