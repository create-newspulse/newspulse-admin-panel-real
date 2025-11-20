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

# Start Frontend Server only
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

Write-Host "`nA PowerShell window has opened for the frontend server." -ForegroundColor Cyan
Write-Host "DO NOT CLOSE IT - it is running your dev server.`n" -ForegroundColor Red

Write-Host "Press any key to open your browser..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "http://localhost:5173"

Write-Host "`nBrowser opened. Keep the server window open.`n" -ForegroundColor Green
