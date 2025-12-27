# NewsPulse Admin Panel - Startup Script
# ==========================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "NewsPulse Admin Panel - Server Startup" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

param(
    [switch]$Demo
)

# Stop only the dev servers we own (avoid killing unrelated Node processes)
function Stop-ProcessOnPort([int]$port) {
    $lines = netstat -ano | Select-String -Pattern (":${port}\s+.*LISTENING")
    if (-not $lines) { return }

    $pids = @()
    foreach ($line in $lines) {
        $parts = ($line -split "\s+" | Where-Object { $_ -ne "" })
        if ($parts.Length -ge 5) {
            $procId = $parts[-1]
            if ($procId -match "^\d+$") { $pids += [int]$procId }
        }
    }

    $pids = $pids | Sort-Object -Unique
    foreach ($procId in $pids) {
        try {
            Write-Host "Stopping process PID $procId on port $port..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            Write-Host "Could not stop PID $procId on port ${port}: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }
}

Write-Host "Stopping any running dev servers on ports 5173 and the demo backend port..." -ForegroundColor Yellow
Stop-ProcessOnPort 5173
$DemoPort = 5000
if ($env:NP_DEMO_PORT -and ($env:NP_DEMO_PORT -match '^\d+$')) { $DemoPort = [int]$env:NP_DEMO_PORT }
Stop-ProcessOnPort $DemoPort
Start-Sleep -Seconds 2

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Default: use NP_REAL_BACKEND if provided
$RealBackend = $env:NP_REAL_BACKEND
if (-not $RealBackend) { $RealBackend = 'https://your-backend-host.tld' }

$DemoHost = $env:NP_DEMO_HOST
if (-not $DemoHost) { $DemoHost = 'localhost' }
$DemoBackendOrigin = "http://${DemoHost}:${DemoPort}"

if ($Demo) {
    Write-Host "Starting Demo Backend Server (Express) because -Demo was provided..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\admin-backend'; Write-Host 'Demo Backend Server' -ForegroundColor Green; npm run dev:demo"
    Start-Sleep -Seconds 3
} else {
    Write-Host "Skipping demo backend (using real backend: $RealBackend)" -ForegroundColor Cyan
}

# Start Frontend Server (Vite on :5173)
Write-Host "Starting Frontend Server (Vite)..." -ForegroundColor Yellow

$target = $RealBackend
if ($Demo) { $target = $DemoBackendOrigin }

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir'; Write-Host 'Frontend Server' -ForegroundColor Green; `$env:VITE_ADMIN_API_TARGET='$target'; `$env:VITE_DEMO_MODE='false'; `$env:VITE_USE_MOCK='false'; npm run dev"
Start-Sleep -Seconds 5

# Verify servers are running
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ SERVERS STARTED!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

$frontend = netstat -ano | findstr ":5173.*LISTENING"
if ($frontend) {
    Write-Host "✅ Frontend: RUNNING (Vite dev)" -ForegroundColor Green
} else {
    Write-Host "⏳ Frontend: Starting... (wait 10 seconds)" -ForegroundColor Yellow
}

if ($Demo) {
    $backend = netstat -ano | findstr ":$DemoPort.*LISTENING"
    if ($backend) {
        Write-Host "✅ Backend: RUNNING (Demo backend)" -ForegroundColor Green
    } else {
        Write-Host "⏳ Backend: Starting... (wait 10 seconds)" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Backend: REAL (proxy target: $RealBackend)" -ForegroundColor Green
}

Write-Host "`nPowerShell windows have opened for the backend and frontend servers." -ForegroundColor Cyan
Write-Host "DO NOT CLOSE THEM - they run your dev servers.`n" -ForegroundColor Red

Write-Host "Open your browser to: http://localhost:5173" -ForegroundColor Yellow
try {
    Write-Host "Press any key to open your browser..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Start-Process "http://localhost:5173"
} catch {
    Write-Host "(Skipping auto-open browser: non-interactive session)" -ForegroundColor DarkYellow
}

Write-Host "`nBrowser opened. Keep the server window open.`n" -ForegroundColor Green
