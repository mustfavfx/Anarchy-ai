@echo off
setlocal enabledelayedexpansion

REM Save current directory and handle spaces/special chars
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Check Node.js
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found! Please install from: https://nodejs.org
    pause
    exit /b 1
)

echo Node.js found: 
node --version

REM Check dependencies
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Create .env if missing
if not exist ".env" (
    echo Creating .env file...
    copy .env.example .env >nul
    echo Please edit .env and add your API token
    timeout /t 3 /nobreak >nul
)

REM Start the app
echo.
echo Starting Anarchy AI...
echo Open http://localhost:5173 in your browser
echo.
call npm run dev

if errorlevel 1 (
    echo Failed to start
    pause
)
