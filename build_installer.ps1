# build_installer.ps1 - Automated Windows Installer Build for Anarchy AI
$ErrorActionPreference = "Stop"

# 1. Find Inno Setup Compiler (ISCC.exe)
$IsccPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "$env:USERPROFILE\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
)

$IsccPath = $null
foreach ($path in $IsccPaths) {
    if (Test-Path $path) {
        $IsccPath = $path
        break
    }
}

if (-not $IsccPath) {
    $IsccCmd = Get-Command "iscc" -ErrorAction SilentlyContinue
    if ($IsccCmd) {
        $IsccPath = $IsccCmd.Source
    }
}

# 2. Download and install Inno Setup if not found
if (-not $IsccPath) {
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Inno Setup 6 was not detected on this system." -ForegroundColor Yellow
    Write-Host "Installing Inno Setup 6 automatically..." -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    
    # Try using winget first
    $WingetCmd = Get-Command "winget" -ErrorAction SilentlyContinue
    if ($WingetCmd) {
        Write-Host "Installing Inno Setup 6 via winget..." -ForegroundColor Yellow
        $process = Start-Process -FilePath "winget" -ArgumentList "install --id JRSoftware.InnoSetup --silent --accept-package-agreements --accept-source-agreements" -NoNewWindow -PassThru -Wait
    } else {
        # Fallback to downloading from GitHub releases
        $InnoUrl = "https://github.com/jrsoftware/issrc/releases/download/is-6_3_3/innosetup-6.3.3.exe"
        $TempInstaller = Join-Path $env:TEMP "innosetup_setup.exe"
        
        Write-Host "Downloading from GitHub: $InnoUrl"
        Invoke-WebRequest -Uri $InnoUrl -OutFile $TempInstaller
        
        Write-Host "Installing Inno Setup 6 silently (UAC prompt may appear)..." -ForegroundColor Yellow
        $process = Start-Process -FilePath $TempInstaller -ArgumentList "/SILENT", "/NORESTART", "/SUPPRESSMSGBOXES" -PassThru -Wait
    }
    
    # Check again
    foreach ($path in $IsccPaths) {
        if (Test-Path $path) {
            $IsccPath = $path
            break
        }
    }
    
    if (-not $IsccPath) {
        Write-Error "Failed to install or locate Inno Setup 6. Please install it manually from https://jrsoftware.org/ and rerun."
    }
    
    Write-Host "Inno Setup 6 successfully installed!" -ForegroundColor Green
}

Write-Host "Found Inno Setup Compiler: $IsccPath" -ForegroundColor Green

# 3. Build the Tauri production release
$TauriExe = "src-tauri\target\release\anarchy-ai.exe"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Building Tauri production release..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Remove old binary to ensure fresh build
if (Test-Path $TauriExe) {
    Remove-Item $TauriExe -Force
}

# Run npm build
npm run tauri:build

if (-not (Test-Path $TauriExe)) {
    Write-Error "Tauri production build failed to produce the binary."
} else {
    Write-Host "Tauri production binary successfully compiled!" -ForegroundColor Green
}

# 4. Compile the Installer
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Compiling setup installer using Inno Setup..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Ensure Output Directory exists
New-Item -ItemType Directory -Force -Path "setup_dist" | Out-Null

# Run ISCC
& $IsccPath "installer.iss"

Write-Host "==================================================" -ForegroundColor Green
Write-Host "SUCCESS: Installer generated successfully!" -ForegroundColor Green
Write-Host "Location: setup_dist\Anarchy_AI_Setup.exe" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
