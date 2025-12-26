@echo off
echo ========================================
echo NewsPulse Admin Panel - Server Startup
echo ========================================
@echo off
setlocal

REM Default: use REAL backend so local matches production data.
REM Optional: set DEMO=1 to run the demo backend on localhost:5000.

set REAL_BACKEND=https://newspulse-backend-real.onrender.com

echo Starting NewsPulse Admin Panel...
echo.

if "%DEMO%"=="1" (
	echo Starting Demo Backend Server...
	start cmd /k "cd /d admin-backend && npm run dev:demo"
	timeout /t 3 /nobreak >nul
	set VITE_ADMIN_API_TARGET=http://localhost:5000
) else (
	echo Skipping demo backend. Using real backend: %REAL_BACKEND%
	set VITE_ADMIN_API_TARGET=%REAL_BACKEND%
)

set VITE_DEMO_MODE=false
set VITE_USE_MOCK=false

echo Starting Frontend Server...
start cmd /k "npm run dev"

echo.
echo Servers started!
echo Frontend: http://localhost:5173
if "%DEMO%"=="1" (
	echo Backend: http://localhost:5000
) else (
	echo Backend target: %VITE_ADMIN_API_TARGET%
)
pause
echo Frontend: http://localhost:5173
echo.
echo Three terminal windows will open.
echo DO NOT CLOSE THEM!
echo.
echo Press any key to open your browser...
pause >nul
start http://localhost:5173
