# NewsPulse Admin Panel - Startup Script
# ==========================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "NewsPulse Admin Panel - Server Startup" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

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

Write-Host "Stopping any running dev servers on ports 5173 and 5000..." -ForegroundColor Yellow
Stop-ProcessOnPort 5173
Stop-ProcessOnPort 5000
Start-Sleep -Seconds 2

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Demo Backend Server (Express on :5000)
Write-Host "Starting Demo Backend Server (Express :5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\\admin-backend'; Write-Host 'Demo Backend Server (5000)' -ForegroundColor Green; npm run dev:demo"
Start-Sleep -Seconds 3

# Start Frontend Server (Vite on :5173)
Write-Host "Starting Frontend Server (Vite)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir'; Write-Host 'Frontend Server' -ForegroundColor Green; npm run dev"
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

$backend = netstat -ano | findstr ":5000.*LISTENING"
if ($backend) {
    Write-Host "✅ Backend: RUNNING (Demo backend :5000)" -ForegroundColor Green
} else {
    Write-Host "⏳ Backend: Starting... (wait 10 seconds)" -ForegroundColor Yellow
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
