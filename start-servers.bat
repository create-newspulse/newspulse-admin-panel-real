@echo off
echo ========================================
echo NewsPulse Admin Panel - Server Startup
echo ========================================
echo.

REM Kill any existing node processes
echo Stopping any running servers...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Start frontend server in new window only
echo Starting Frontend Server (Vite)...
start "NewsPulse Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ========================================
echo ✅ SERVERS STARTED!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo.
echo Three terminal windows will open.
echo DO NOT CLOSE THEM!
echo.
echo Press any key to open your browser...
pause >nul
start http://localhost:5173
