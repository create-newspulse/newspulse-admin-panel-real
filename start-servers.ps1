# NewsPulse Admin Panel - Startup Script
# ==========================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "NewsPulse Admin Panel - Server Startup" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Stop any existing node processes
Write-Host "Stopping any running servers..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend Server
Write-Host "Starting Backend Server (Port 3002)..." -ForegroundColor Yellow
$BackendPath = Join-Path $ScriptDir "admin-backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; Write-Host 'Backend Server' -ForegroundColor Green; node demo-server.js"
Start-Sleep -Seconds 5

# Start Frontend Server
Write-Host "Starting Frontend Server (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir'; Write-Host 'Frontend Server' -ForegroundColor Green; npm run dev"
Start-Sleep -Seconds 5

# Verify servers are running
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ SERVERS STARTED!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

$backend = netstat -ano | findstr ":3002.*LISTENING"
$frontend = netstat -ano | findstr ":5173.*LISTENING"

if ($backend) {
    Write-Host "✅ Backend: RUNNING on http://localhost:3002" -ForegroundColor Green
} else {
    Write-Host "❌ Backend: Failed to start" -ForegroundColor Red
}

if ($frontend) {
    Write-Host "✅ Frontend: RUNNING on http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "⏳ Frontend: Starting... (wait 10 seconds)" -ForegroundColor Yellow
}

Write-Host "`nTwo PowerShell windows have opened." -ForegroundColor Cyan
Write-Host "DO NOT CLOSE THEM - they are running your servers.`n" -ForegroundColor Red

Write-Host "Press any key to open your browser..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "http://localhost:5173"

Write-Host "`nBrowser opened. Keep this window and the two server windows open.`n" -ForegroundColor Green
