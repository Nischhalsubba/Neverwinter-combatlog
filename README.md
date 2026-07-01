# Astral Combat Web Parser

Static browser-based Neverwinter combat log parser.

## What it does

- Upload a Neverwinter combat log in the browser.
- Parse player damage, DPS, combat DPS, hits, crit rate, flank rate, healing, damage taken, and shielding.
- Split encounters into boss and mob/non-boss windows.
- Show hidden/non-boss encounters separately from boss encounters.
- Show damage power breakdown and raw hits.
- Include a Combat Formulas tab with parser formulas and Neverwinter formula references.

## Run locally

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## GitHub Pages

Use GitHub Pages from `main` and `/root`.

## Privacy

The combat log is read by the browser only. There is no backend upload.

## Core parser rules

```text
Valid damage = owner is player + damage type Physical + amount > 0
Boss = entity template contains _Boss
Mob = entity template contains _Solo, _Elite, _Standard, or _Minion
DPS = total damage / first-to-last damage duration
Combat DPS = total damage / active encounter time
Crit Rate = critical hit count / total hit count
Flank Rate = flank hit count / total hit count
```
