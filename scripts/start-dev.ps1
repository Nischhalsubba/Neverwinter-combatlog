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

Write-Host "Starting Nexus Combat Analyzer..." -ForegroundColor Cyan
corepack pnpm --filter @nevercombat/desktop dev
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Nexus Combat Analyzer did not start." -ForegroundColor Yellow
    Write-Host "If the output includes os error 4551, Windows Application Control is blocking generated Rust build executables."
    Write-Host "Follow the Windows Application Control section in README.md."
    exit $LASTEXITCODE
}
