@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Anarchy AI - Setup
cls

:: Save current directory with quotes to handle spaces and special chars
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║     █████╗ ███╗   ██╗███████╗██████╗  ██████╗██╗  ██╗   ║
echo  ║    ██╔══██╗████╗  ██║██╔════╝██╔══██╗██╔════╝██║  ██║   ║
echo  ║    ███████║██╔██╗ ██║█████╗  ██████╔╝██║     ███████║   ║
echo  ║    ██╔══██║██║╚██╗██║██╔══╝  ██╔══██╗██║     ██╔══██║   ║
echo  ║    ██║  ██║██║ ╚████║███████╗██║  ██║╚██████╗██║  ██║   ║
echo  ║    ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝   ║
echo  ║                                                          ║
echo  ║        AI-Powered Architectural Visualization          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [❌] Node.js not found!
    echo.
    echo  Node.js 18+ is required to run Anarchy AI.
    echo.
    
    :: Check if install-node.bat exists
    if exist "install-node.bat" (
        echo  [📦] Running automatic installer...
        echo.
        call "install-node.bat"
        
        :: Check if Node.js is now installed
        node --version >nul 2>&1
        if %errorlevel% neq 0 (
            echo.
            echo  ❌ Node.js still not found after installation.
            echo  Please restart your computer and try again.
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo  Please install Node.js 18+ from:
        echo  https://nodejs.org
        echo.
        start https://nodejs.org
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%a in ('node --version') do set NODE_VERSION=%%a
echo  [✓] Node.js %NODE_VERSION% detected

:: Check if .env exists
if not exist ".env" (
    echo  [⚠]  .env file not found, creating from template...
    copy .env.example .env >nul
    echo  [✓] Created .env file
    echo.
    echo  ⚠ IMPORTANT: Please edit .env and add your Supabase credentials!
    echo.
    timeout /t 3 /nobreak >nul
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo  [📦] Installing dependencies...
    echo  This may take a few minutes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [❌] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
    echo  [✓] Dependencies installed successfully
)

:: Check if data was exported
if exist "*.json" (
    echo.
    echo  [📂] Found backup file(s):
    dir /b *.json
    echo.
    echo  ℹ You can import your data in Settings ^> Storage
    timeout /t 2 /nobreak >nul
)

echo.
echo  [🚀] Starting Anarchy AI...
echo  The app will open at: http://localhost:5173
echo.
echo  ════════════════════════════════════════════════════════════
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo  [❌] Failed to start the app
    pause
)
