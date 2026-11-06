@echo off
title LifeLine Blood Bank server
cd /d "%~dp0backend"
if not exist node_modules (
  echo Installing packages, please wait...
  call npm install
  if errorlevel 1 ( echo npm install failed. Check your internet connection. & pause & exit /b 1 )
)
call npm run setup
if errorlevel 1 ( echo. & echo Fix the problem above, then double-click start.bat again. & pause & exit /b 1 )
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
echo Starting server. Keep this window open. Close it to stop the website.
call npm start
pause
