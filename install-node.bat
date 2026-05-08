@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Installing Node.js for Anarchy AI
cls

:: Save current directory with quotes to handle spaces and special chars
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║     Installing Node.js 18+ for Anarchy AI                  ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Check if already installed
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%a in ('node --version') do set "NODE_VERSION=%%a"
    echo  ✅ Node.js %NODE_VERSION% already installed!
    timeout /t 2 /nobreak >nul
    exit /b 0
)

echo  Node.js not found. Installing now...
echo.
echo  This will download and install Node.js 20 LTS
echo.

:: Check for winget (Windows 11/10 with App Installer)
winget --version >nul 2>&1
if %errorlevel% equ 0 (
    echo  [📦] Using Windows Package Manager (winget)...
    echo  Installing Node.js. Please wait...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    
    if %errorlevel% equ 0 (
        echo.
        echo  ✅ Node.js installed successfully!
        echo.
        echo  ⚠ IMPORTANT: Please RESTART your computer,
        echo     then run start.bat again.
        echo.
        pause
        exit /b 0
    )
)

:: If winget not available, download installer manually
echo  [📥] Downloading Node.js installer...
echo.

:: Create temp directory
set "TEMP_DIR=%TEMP%\anarchy-ai-setup"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

:: Download Node.js MSI (64-bit)
set "NODE_INSTALLER=%TEMP_DIR%\nodejs.msi"
set "NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"

echo  Downloading from: %NODE_URL%
echo  Please wait...
echo.

:: Use PowerShell to download
powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%'" >nul 2>&1

if not exist "%NODE_INSTALLER%" (
    echo  ❌ Failed to download Node.js
    echo.
    echo  Please download manually from:
    echo  https://nodejs.org
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

echo  ✅ Downloaded successfully!
echo.
echo  [⚙] Running installer...
echo  Please follow the installation wizard.
echo.

:: Run the installer
msiexec /i "%NODE_INSTALLER%" /passive /norestart

if %errorlevel% equ 0 (
    echo.
    echo  ✅ Node.js installation completed!
    echo.
    echo  ⚠ IMPORTANT: Please RESTART your computer,
    echo     then run start.bat again.
    echo.
) else (
    echo.
    echo  ⚠ Installation may require administrator privileges.
    echo.
    echo  Please:
    echo  1. Download Node.js from https://nodejs.org
    echo  2. Install it manually
    echo  3. Run start.bat again
    echo.
    start https://nodejs.org
)

:: Cleanup
del "%NODE_INSTALLER%" >nul 2>&1
rmdir "%TEMP_DIR%" >nul 2>&1

pause
