@echo off
title Anarchy AI - Admin Dashboard
cd /d "%~dp0"

set "HTML_FILE=%~dp0index.html"

:: Check for Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%HTML_FILE:\=/%" --window-size=1280,850
    exit
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%HTML_FILE:\=/%" --window-size=1280,850
    exit
)

:: Check for Google Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%HTML_FILE:\=/%" --window-size=1280,850
    exit
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="file:///%HTML_FILE:\=/%" --window-size=1280,850
    exit
)

:: Fallback to default browser
start "" "%HTML_FILE%"
exit
