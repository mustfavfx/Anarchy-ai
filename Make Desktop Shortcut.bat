@echo off
setlocal enabledelayedexpansion

REM Get desktop path from registry
for /f "tokens=2*" %%a in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v Desktop 2^>nul') do set "DESKTOP_PATH=%%b"

if not defined DESKTOP_PATH (
    set "DESKTOP_PATH=%USERPROFILE%\Desktop"
)

set "SCRIPT_DIR=%~dp0"
set "TARGET_PATH=%SCRIPT_DIR%Anarchy AI Desktop Launcher.bat"
set "SHORTCUT_NAME=Anarchy AI.lnk"

REM Create VBScript to generate shortcut
set "VBS_FILE=%TEMP%\create_anarchy_shortcut.vbs"
(
echo Set WshShell = WScript.CreateObject("WScript.Shell"^)
echo Set oLink = WshShell.CreateShortcut("%DESKTOP_PATH%\%SHORTCUT_NAME%"^)
echo oLink.TargetPath = "%TARGET_PATH%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%"
echo oLink.Description = "Anarchy AI - Architectural Visualization"
echo oLink.IconLocation = "shell32.dll, 14"
echo oLink.WindowStyle = 1
echo oLink.Save
echo Set oLink = Nothing
echo Set WshShell = Nothing
) > "%VBS_FILE%"

REM Run VBScript
cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%"

if exist "%DESKTOP_PATH%\%SHORTCUT_NAME%" (
    echo.
    echo ===========================================
    echo  DESKTOP SHORTCUT CREATED SUCCESSFULLY!
    echo ===========================================
    echo.
    echo Location: %DESKTOP_PATH%\%SHORTCUT_NAME%
    echo.
    echo Double-click "Anarchy AI" on your desktop to start!
    echo.
) else (
    echo Failed to create shortcut
)

pause
