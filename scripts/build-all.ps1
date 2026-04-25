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
Require-Command "dotnet" "Install the .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0, then reopen PowerShell."

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

Write-Host "Running C# engine tests..." -ForegroundColor Cyan
dotnet run --project "apps\windows\NexusCombatAnalyzer.Tests\NexusCombatAnalyzer.Tests.csproj"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Restoring .NET desktop packages..." -ForegroundColor Cyan
dotnet restore "apps\windows\NexusCombatAnalyzer.Host\NexusCombatAnalyzer.Host.csproj" --configfile "NuGet.Config" -r win-x64
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Could not restore .NET packages. Check that this machine can reach https://api.nuget.org/v3/index.json." -ForegroundColor Yellow
    exit $LASTEXITCODE
}

Write-Host "Building web assets..." -ForegroundColor Cyan
corepack pnpm --filter @nevercombat/desktop web:build
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Publishing Windows desktop app..." -ForegroundColor Cyan
dotnet publish "apps\windows\NexusCombatAnalyzer.Host\NexusCombatAnalyzer.Host.csproj" -c Release -r win-x64 --self-contained false -o "dist\windows" --no-restore
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
