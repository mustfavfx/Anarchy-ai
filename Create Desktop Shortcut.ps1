# Create Anarchy AI Desktop Shortcut
$WshShell = New-Object -ComObject WScript.Shell

# Get desktop path
$DesktopPath = [Environment]::GetFolderPath("Desktop")

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetPath = Join-Path $ScriptDir "Anarchy AI Desktop Launcher.bat"

# Create shortcut
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Anarchy AI.lnk")
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Anarchy AI - Architectural Visualization"
$Shortcut.IconLocation = "shell32.dll, 14"
$Shortcut.WindowStyle = 1
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "Location: $DesktopPath\Anarchy AI.lnk" -ForegroundColor Cyan
pause
