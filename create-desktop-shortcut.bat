@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Create Anarchy AI Desktop Shortcut

:: Get desktop path
for /f "tokens=2*" %%a in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v Desktop 2^>nul') do set "DESKTOP_PATH=%%b"

if not defined DESKTOP_PATH (
    set "DESKTOP_PATH=%USERPROFILE%\Desktop"
)

set "SHORTCUT_NAME=Anarchy AI.lnk"
set "TARGET_PATH=%~dp0start.bat"
set "ICON_PATH=%~dp0src\assets\icon.ico"
set "WORKING_DIR=%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║     Creating Anarchy AI Desktop Shortcut                 ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Desktop: %DESKTOP_PATH%
echo  Target:  %TARGET_PATH%
echo.

:: Create VBScript to generate shortcut
set "VBS_FILE=%TEMP%\create_shortcut.vbs"
(
echo Set WshShell = WScript.CreateObject("WScript.Shell"^)
echo Set oLink = WshShell.CreateShortcut("%DESKTOP_PATH%\%SHORTCUT_NAME%"^)
echo oLink.TargetPath = "%TARGET_PATH%"
echo oLink.WorkingDirectory = "%WORKING_DIR%"
echo oLink.Description = "Anarchy AI - Architectural Visualization"
echo oLink.IconLocation = "%SystemRoot%\System32\SHELL32.dll, 14"
echo oLink.WindowStyle = 1
echo oLink.Save
echo Set oLink = Nothing
echo Set WshShell = Nothing
) > "%VBS_FILE%"

:: Run VBScript
cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%"

if exist "%DESKTOP_PATH%\%SHORTCUT_NAME%" (
    echo  ✅ Shortcut created successfully!
    echo  📌 Location: %DESKTOP_PATH%\%SHORTCUT_NAME%
    echo.
    echo  Double-click the shortcut to start Anarchy AI.
) else (
    echo  ❌ Failed to create shortcut
)

echo.
pause
