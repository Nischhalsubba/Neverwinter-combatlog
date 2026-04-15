# Nexus Combat Analyzer

Windows-first desktop combat log analyzer for Neverwinter, with ACT-style parser parity, live tracking, replay review, companion attribution, and a lightweight widget.

The finalized PRD, UI/UX specification, technical specification, and delivery backlog are the source of truth for this repository.

## Stack

- Desktop shell: Tauri 2
- Runtime/parser: Rust
- UI: React + TypeScript + Vite
- Storage: SQLite
- Client state: Zustand + TanStack Query

## Development

One command to install dependencies and start the desktop app:

```powershell
.\start-dev.cmd
```

One command to install dependencies, run checks, and build the desktop app:

```powershell
.\build-all.cmd
```

Equivalent package scripts:

```powershell
corepack pnpm start
corepack pnpm build:all
```

Manual development commands:

```powershell
corepack pnpm install
corepack pnpm --filter @nevercombat/desktop dev
```

Rust tests:

```powershell
cd apps/desktop/src-tauri
cargo test
```

## Windows Application Control

If `tauri dev` fails with an error like:

```text
An Application Control policy has blocked this file. (os error 4551)
```

the machine is blocking Rust build-script executables generated under the build output directory. This repository configures Cargo to place build output in `C:\Users\acer\AppData\Local\NeverwinterCombatAnalyzer\cargo-target` instead of inside the OneDrive-synced project folder.

Retry from the repo root:

```powershell
Remove-Item -Recurse -Force "apps\desktop\src-tauri\target" -ErrorAction SilentlyContinue
corepack pnpm --filter @nevercombat/desktop dev
```

If Windows still blocks generated build scripts, move the whole repository to a non-OneDrive developer folder such as `C:\dev\Neverwinter-combatlog`, or disable/adjust the local Application Control policy for Rust development.

## Product Principles

- Parse every combat log line.
- Store raw and normalized data.
- Never drop malformed lines silently.
- Preserve ACT parity before improving on top.
- Keep live mode fast, replay mode detailed, and debug mode transparent.
