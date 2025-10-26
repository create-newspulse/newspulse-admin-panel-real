@echo off
echo ========================================
echo NewsPulse Admin Panel - Server Startup
echo ========================================
echo.

REM Kill any existing node processes
echo Stopping any running servers...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Start backend server in new window
echo Starting Backend Server (Port 3002)...
start "NewsPulse Backend" cmd /k "cd /d "%~dp0admin-backend" && node demo-server.js"
timeout /t 5 /nobreak

REM Start frontend server in new window  
echo Starting Frontend Server (Port 5173)...
start "NewsPulse Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ========================================
echo ✅ SERVERS STARTED!
echo ========================================
echo.
echo Backend:  http://localhost:3002
echo Frontend: http://localhost:5173
echo.
echo Two terminal windows will open.
echo DO NOT CLOSE THEM!
echo.
echo Press any key to open your browser...
pause >nul
start http://localhost:5173
