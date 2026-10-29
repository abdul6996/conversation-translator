@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:3000 in Chrome or Edge.
call npm run dev
