$ErrorActionPreference = "Stop"

function Require-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [string] $InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "Missing required command: $Name" -ForegroundColor Red
        Write-Host $InstallHint
        exit 1
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Require-Command "node" "Install Node.js LTS, then reopen PowerShell."
Require-Command "corepack" "Install a current Node.js release that includes Corepack."
Require-Command "cargo" "Install Rust from https://rustup.rs, then reopen PowerShell."

Write-Host "Checking pnpm through Corepack..." -ForegroundColor Cyan
corepack pnpm --version

Write-Host "Installing workspace dependencies..." -ForegroundColor Cyan
corepack pnpm install

$oldTarget = Join-Path $repoRoot "apps\desktop\src-tauri\target"
if (Test-Path $oldTarget) {
    Write-Host "Removing old Tauri target directory from OneDrive path..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force $oldTarget -ErrorAction SilentlyContinue
}

Write-Host "Checking TypeScript..." -ForegroundColor Cyan
corepack pnpm --filter @nevercombat/desktop test

Push-Location "apps\desktop\src-tauri"

Write-Host "Running Rust tests..." -ForegroundColor Cyan
cargo test --lib --bins
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Rust tests failed. If the output includes os error 4551, Windows Application Control is blocking generated Rust build executables." -ForegroundColor Yellow
    Write-Host "Move the repository to a developer folder allowed by policy, or allow Rust build outputs in Windows Application Control."
    exit $LASTEXITCODE
}
Pop-Location

Write-Host "Building web assets..." -ForegroundColor Cyan
corepack pnpm --filter @nevercombat/desktop web:build
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Building desktop app..." -ForegroundColor Cyan
corepack pnpm --filter @nevercombat/desktop build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Desktop build failed. If the output includes os error 4551, Windows Application Control is blocking generated Rust build executables." -ForegroundColor Yellow
    exit $LASTEXITCODE
}
