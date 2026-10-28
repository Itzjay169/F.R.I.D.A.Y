# F.R.I.D.A.Y. - Zero-Dependency Built-In Windows HTTP Server
# Runs using 100% native Windows PowerShell (System.Net.HttpListener) - ZERO software required!

param (
    [int]$Port = 5173,
    [string]$RootFolder = "$PSScriptRoot\dist"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " F.R.I.D.A.Y. – THE TRADING DESK (PORTABLE STANDALONE)    " -ForegroundColor Cyan
Write-Host " Zero-Software Environment Detected: Running Native Host  " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $RootFolder)) {
    Write-Host "[NOTICE] Pre-built distribution folder not found." -ForegroundColor Yellow
    Write-Host "[FORWARD] Automatically configuring environment and building..." -ForegroundColor Cyan
    & "$PSScriptRoot\setup_portable_runtime.ps1"
    exit 0
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "[WARNING] Port $Port busy, trying 5174..." -ForegroundColor Yellow
    $Port = 5174
    $listener = New-Object System.Net.HttpListener
    $prefix = "http://localhost:$Port/"
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "[SUCCESS] F.R.I.D.A.Y. HUD Server Online at: $prefix" -ForegroundColor Green
Write-Host "[INFO] Opening default browser..." -ForegroundColor Gray
Start-Process $prefix

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff2"= "font/woff2"
}

Write-Host "[DESK ACTIVE] Press Ctrl+C in this window to stop F.R.I.D.A.Y." -ForegroundColor Cyan

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) { $relPath = "index.html" }

        $filePath = Join-Path $RootFolder $relPath

        if (-not (Test-Path $filePath)) {
            $filePath = Join-Path $RootFolder "index.html"
        }

        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = $mimeMap[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }

        $response.ContentType = $contentType
        $response.Headers.Add("Access-Control-Allow-Origin", "*")

        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.OutputStream.Close()
    } catch {
        # Continue listening
    }
}
