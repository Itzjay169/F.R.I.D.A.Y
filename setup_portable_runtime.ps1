# F.R.I.D.A.Y. - Portable Auto-Bootstrapper
# Automatically equips a new Windows laptop with a self-contained portable Node.js runtime if not present.

$projectRoot = $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$nodeDir = Join-Path $runtimeDir "node"
$nodeExe = Join-Path $nodeDir "node.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   F.R.I.D.A.Y. - THE TRADING DESK ENVIRONMENT CHECK      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check if Node.js is already installed system-wide
$systemNode = Get-Command "node" -ErrorAction SilentlyContinue

if ($systemNode) {
    Write-Host "[OK] System Node.js detected: $(& node -v)" -ForegroundColor Green
    $nodeCmd = "node"
    $npmCmd = "npm"
} elseif (Test-Path $nodeExe) {
    Write-Host "[OK] Local Portable Node.js detected: $(& $nodeExe -v)" -ForegroundColor Green
    $env:PATH = "$nodeDir;$env:PATH"
    $nodeCmd = $nodeExe
    $npmCmd = Join-Path $nodeDir "npm.cmd"
} else {
    Write-Host "[NOTICE] No Node.js found on this laptop." -ForegroundColor Yellow
    Write-Host "[BOOTSTRAP] Internet detected. Preparing portable Node.js runtime..." -ForegroundColor Cyan

    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    $zipPath = Join-Path $runtimeDir "node-portable.zip"
    $downloadUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"

    Write-Host "[DOWNLOAD] Fetching portable Node.js v20 LTS from official nodejs.org..." -ForegroundColor Gray
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
        Write-Host "[UNPACK] Extracting portable runtime..." -ForegroundColor Gray
        
        $extractTemp = Join-Path $runtimeDir "temp_extract"
        Expand-Archive -Path $zipPath -DestinationPath $extractTemp -Force
        
        $innerFolder = Get-ChildItem -Path $extractTemp -Directory | Select-Object -First 1
        Move-Item -Path $innerFolder.FullName -Destination $nodeDir -Force
        Remove-Item -Path $extractTemp -Recurse -Force
        Remove-Item -Path $zipPath -Force
        
        Write-Host "[SUCCESS] Portable Node.js runtime installed successfully." -ForegroundColor Green
        $env:PATH = "$nodeDir;$env:PATH"
        $nodeCmd = $nodeExe
        $npmCmd = Join-Path $nodeDir "npm.cmd"
    } catch {
        Write-Host "[ERROR] Could not download portable runtime: $_" -ForegroundColor Red
        Write-Host "[FALLBACK] Switching to zero-dependency native standalone mode..." -ForegroundColor Yellow
        & "$projectRoot\start_portable_server.ps1"
        exit
    }
}

# 2. Check .env file
$envPath = Join-Path $projectRoot ".env"
$envExamplePath = Join-Path $projectRoot ".env.example"
if (-not (Test-Path $envPath) -and (Test-Path $envExamplePath)) {
    Write-Host "[CONFIG] Creating .env from .env.example..." -ForegroundColor Gray
    Copy-Item $envExamplePath $envPath
}

# 3. Check node_modules
$nodeModules = Join-Path $projectRoot "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "[DEPS] node_modules missing. Installing dependencies..." -ForegroundColor Yellow
    & $npmCmd install
}

# 4. Launch F.R.I.D.A.Y.
Write-Host "[LAUNCH] Starting F.R.I.D.A.Y. Trading Desk..." -ForegroundColor Green
Start-Process "http://localhost:5173"
& $npmCmd run dev:vite
