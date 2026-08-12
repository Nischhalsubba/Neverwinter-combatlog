# ACT / Neverwinter Plugin Parity Map

Source references:
- `C:\Users\acer\Downloads\Neverwinter_6-11-2020.cs`
- `C:\Users\acer\Downloads\Compressed\ACTv3.zip`

## Implemented

- Neverwinter 12-field combat payload mapping:
  owner name/ref, source name/ref, target name/ref, power name/ref, event type, flags, magnitude, base magnitude.
- Quote-aware tokenization and recovery for simple legacy unquoted commas in names.
- Damage classification for Neverwinter damage types such as `Physical`.
- Player damage aggregation by owner fields.
- Companion/entity damage split with owner attribution.
- Companion merge toggle in the UI.
- Per-combatant power breakdown, hit count, crit count/rate, and compressed trend.
- Encounter duration from first to last damaging event.
- ACT-style `EncDPS`: total damage divided by encounter duration, exposed on summary and combatant rows.

## Next Engine Parity Work

- Encounter lifecycle:
  start only on meaningful damage, ignore fall damage, traps, Wheel of Elements: Earth, injuries, and non-damaging proc noise.
- ACT encounter columns:
  title, start/end time, duration, damage, EncDPS, zone, kills, deaths.
- ACT combatant columns:
  ally flag, start/end, duration, damage, damage percent, EncDPS, CharDPS, DPS, average/median/min/max hit, hits, crit hits, misses, avoids, swings, to-hit, average delay, crit percent.
- Damage type and attack type drilldowns:
  EncDPS, CharDPS, DPS, average, median, min/max hit, resist, crit, flank, deflect, effectiveness.
- Healing:
  healed, EncHPS, crit heals, heal percent, max heal, heals taken.
- Damage taken:
  incoming damage, shields/wards, damage-to-shield, shield percent, blocked/absorbed, deaths.
- Utility/resource:
  cures/cleanse, power heal, power drain if supported by log rows.
- Entity cleanup:
  merge NPC unique IDs, pet hash tables, player detection list, clean encounter/unit names.
- Export variables:
  ACT-style text export tokens for damage, DPS/EncDPS, hits, crits, heals, damage taken, kills, deaths, and name shortening.
- Debug parity:
  raw log color coding, unknown row inspection, parser confidence and reason codes.

## Current Limitation

Windows Application Control blocks generated desktop/test assemblies on the target machine. Browser-safe mode can validate parser and UI behavior with selected/imported log files, but true live tailing and native filesystem watching require an approved desktop host.
