@echo off
echo ========================================
echo NewsPulse Admin Panel - Server Startup
echo ========================================
echo.

REM Kill any existing node processes
echo Stopping any running servers...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Start backend server in new window (dev on 5000, will retry 5001 if busy)
echo Starting Backend Server (Port 5000)...
start "NewsPulse Backend" cmd /k "cd /d "%~dp0admin-backend" && npm run dev"
timeout /t 5 /nobreak

REM Start frontend server in new window  
echo Starting Frontend Server (Port 5173)...
start "NewsPulse Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

REM Start Next.js Advanced Auth server in new window
echo Starting Next.js Advanced Auth (Port 3000)...
start "NewsPulse Next-Auth" cmd /k "cd /d "%~dp0next-auth" && npm run dev"

echo.
echo ========================================
echo ✅ SERVERS STARTED!
echo ========================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo Next-Auth: http://localhost:3000/auth
echo.
echo Three terminal windows will open.
echo DO NOT CLOSE THEM!
echo.
echo Press any key to open your browser...
pause >nul
start http://localhost:5173
