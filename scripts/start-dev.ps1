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

$webUrl = "http://127.0.0.1:1420"
$webArgs = @("pnpm", "--filter", "@nevercombat/desktop", "web:dev")

Write-Host "Starting React dev server..." -ForegroundColor Cyan
$webProcess = Start-Process -FilePath "corepack" -ArgumentList $webArgs -PassThru -WindowStyle Hidden

try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try {
            Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
            $ready = $true
            break
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $ready) {
        Write-Host ""
        Write-Host "React dev server did not become ready at $webUrl." -ForegroundColor Red
        exit 1
    }

    Write-Host "Starting Nexus Combat Analyzer .NET host..." -ForegroundColor Cyan
    $env:NCA_WEB_DEV_URL = $webUrl
    dotnet restore "apps\windows\NexusCombatAnalyzer.Host\NexusCombatAnalyzer.Host.csproj" --configfile "NuGet.Config"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Could not restore .NET packages. Check that this machine can reach https://api.nuget.org/v3/index.json." -ForegroundColor Yellow
        exit $LASTEXITCODE
    }

    dotnet build "apps\windows\NexusCombatAnalyzer.Host\NexusCombatAnalyzer.Host.csproj" -c Debug --no-restore /p:UseAppHost=false
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    $hostDll = Join-Path $repoRoot "apps\windows\NexusCombatAnalyzer.Host\bin\Debug\net8.0-windows\NexusCombatAnalyzer.dll"
    dotnet $hostDll
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Nexus Combat Analyzer did not start. If Windows still reports os error 4551, the local policy is blocking generated .NET assemblies too." -ForegroundColor Yellow
        exit $LASTEXITCODE
    }
}
finally {
    if ($webProcess -and -not $webProcess.HasExited) {
        Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
