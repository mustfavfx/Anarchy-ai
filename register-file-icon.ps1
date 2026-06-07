# PowerShell script to register .ana file association and icon for the current developer environment

$Extension = ".ana"
$ProgID = "AnarchyAI.ana"
$IconPath = "E:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.ico"
$AppPath = "E:\New folder (5)\Anarchy Ai 0.07\src-tauri\target\debug\anarchy-ai.exe"

Write-Host "Registering file association for $Extension in HKCU..."

# 1. Create registry structure under HKCU\Software\Classes
$ClassesKey = "HKCU:\Software\Classes"

if (-not (Test-Path "$ClassesKey\$Extension")) {
    New-Item -Path "$ClassesKey\$Extension" -Force | Out-Null
}
Set-ItemProperty -Path "$ClassesKey\$Extension" -Name "(Default)" -Value $ProgID -Force

if (-not (Test-Path "$ClassesKey\$ProgID")) {
    New-Item -Path "$ClassesKey\$ProgID" -Force | Out-Null
}
Set-ItemProperty -Path "$ClassesKey\$ProgID" -Name "(Default)" -Value "Anarchy AI Project File" -Force

# 2. Set DefaultIcon path
if (-not (Test-Path "$ClassesKey\$ProgID\DefaultIcon")) {
    New-Item -Path "$ClassesKey\$ProgID\DefaultIcon" -Force | Out-Null
}
Set-ItemProperty -Path "$ClassesKey\$ProgID\DefaultIcon" -Name "(Default)" -Value $IconPath -Force

# 3. Set Open Command
if (-not (Test-Path "$ClassesKey\$ProgID\shell\open\command")) {
    New-Item -Path "$ClassesKey\$ProgID\shell\open\command" -Force | Out-Null
}
Set-ItemProperty -Path "$ClassesKey\$ProgID\shell\open\command" -Name "(Default)" -Value "`"$AppPath`" `"%1`"" -Force

# 4. Notify Windows Shell of registry changes to refresh icons immediately
Write-Host "Refreshing Windows Explorer shell..."
$Signature = '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);'
$Type = Add-Type -MemberDefinition $Signature -Name "Shell32" -Namespace "Win32" -PassThru
$Type::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "File association registered successfully! Your .ana files should now display the custom icon."
