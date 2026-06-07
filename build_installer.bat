@echo off
title Anarchy AI - Installer Builder
cd /d "%~dp0"
echo Starting Anarchy AI Setup Installer Builder...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_installer.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Builder failed. Check the error message above.
    pause
    exit /b %errorlevel%
)
echo.
echo [SUCCESS] Setup Installer built!
pause
