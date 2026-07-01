# Combat Formula Notes

## Parser formulas

Valid damage row:

```text
owner is selected player
AND damage type is Physical
AND amount is greater than 0
AND flags does not contain ShowPowerDisplayName
AND target is resolved or source is a creature entity
```

Total Damage = sum of final logged damage amounts.

DPS = Total Damage / first-to-last valid damage duration.

Combat DPS = Total Damage / active encounter time.

Crit Rate = critical hit count / total hit count.

Flank Rate = flank hit count / total hit count.

Boss encounter = target entity template contains `_Boss`.

Mob encounter = target entity template contains `_Solo`, `_Elite`, `_Standard`, or `_Minion`.

## Neverwinter mechanics reference

Rating contribution = `50 + (Rating - Total Item Level) / 1000`.

Base Damage = `(Total Item Level / 10) x role multiplier`.

Base HP = `(Total Item Level x 10) x role multiplier`.

Theoretical damage = `(Magnitude / 100) x Base Damage x Multipliers`.
