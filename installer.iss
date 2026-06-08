; Inno Setup Script for Anarchy AI
#define AppName "Anarchy AI"
#define AppVersion "0.0.7"
#define AppPublisher "Anarchy AI Team"
#define AppExeName "Anarchy AI.exe"

[Setup]
AppId={{D8168249-1651-40F1-A8EA-8A1C49C52E58}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppMutex=Anarchy AI,{{D8168249-1651-40F1-A8EA-8A1C49C52E58}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
OutputDir=setup_dist
OutputBaseFilename=Anarchy_AI_Setup
SetupIconFile=src-tauri\icons\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
LicenseFile=LICENSE.txt
ChangesAssociations=yes
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Tauri executable - rename to "Anarchy AI.exe"
Source: "src-tauri\target\release\anarchy-ai.exe"; DestDir: "{app}"; DestName: "{#AppExeName}"; Flags: ignoreversion
; Project icons
Source: "src-tauri\icons\ana-file.ico"; DestDir: "{app}\resources\icons"; Flags: ignoreversion
; Revit plugin source files
Source: "src-tauri\resources\revit-plugin\AnarchyRevit.cs"; DestDir: "{app}\resources\revit-plugin"; Flags: ignoreversion
Source: "src-tauri\resources\revit-plugin\AnarchyLogo_32.png"; DestDir: "{app}\resources\revit-plugin"; Flags: ignoreversion
Source: "src-tauri\resources\revit-plugin\AnarchyLogo_16.png"; DestDir: "{app}\resources\revit-plugin"; Flags: ignoreversion
; 3ds Max icons
Source: "src-tauri\resources\maxicons\AnarchyLogo_24i.bmp"; DestDir: "{app}\resources\maxicons"; Flags: ignoreversion
Source: "src-tauri\resources\maxicons\AnarchyLogo_24a.bmp"; DestDir: "{app}\resources\maxicons"; Flags: ignoreversion
Source: "src-tauri\resources\maxicons\AnarchyLogo_16i.bmp"; DestDir: "{app}\resources\maxicons"; Flags: ignoreversion
Source: "src-tauri\resources\maxicons\AnarchyLogo_16a.bmp"; DestDir: "{app}\resources\maxicons"; Flags: ignoreversion
; 3ds Max script plugin
Source: "src-tauri\resources\AnarchyConnector.ms"; DestDir: "{app}\resources"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
; File Association for .ana (Anarchy AI Project)
Root: HKA; Subkey: "Software\Classes\.ana"; ValueType: string; ValueName: ""; ValueData: "AnarchyAI.ana"; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\AnarchyAI.ana"; ValueType: string; ValueName: ""; ValueData: "Anarchy AI Project File"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\AnarchyAI.ana\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\resources\icons\ana-file.ico,0"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\AnarchyAI.ana\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""; Flags: uninsdeletekey

; URL Protocol Association for anarchy-ai:// deep linking
Root: HKA; Subkey: "Software\Classes\anarchy-ai"; ValueType: string; ValueName: ""; ValueData: "URL:Anarchy AI Protocol"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\anarchy-ai"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\anarchy-ai\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""; Flags: uninsdeletekey


[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
var
  IntegrationsPage: TWizardPage;
  CheckListBox: TNewCheckListBox;
  RevitCount: Integer;
  MaxCount: Integer;
  
  RevitVersions: array[0..9] of String;
  RevitPaths: array[0..9] of String;
  RevitCheckListIndexes: array[0..9] of Integer;
  
  MaxVersions: array[0..9] of String;
  MaxPaths: array[0..9] of String;
  MaxCheckListIndexes: array[0..9] of Integer;

// Revit installations scan
procedure DetectRevit();
var
  FindRec: TFindRec;
  RevitDir: String;
  APIDll: String;
  VerStr: String;
begin
  RevitCount := 0;
  RevitDir := 'C:\Program Files\Autodesk\';
  if FindFirst(RevitDir + 'Revit *', FindRec) then
  begin
    try
      repeat
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY <> 0) and (FindRec.Name <> '.') and (FindRec.Name <> '..') then
        begin
          APIDll := RevitDir + FindRec.Name + '\RevitAPI.dll';
          if FileExists(APIDll) then
          begin
            VerStr := Copy(FindRec.Name, 7, Length(FindRec.Name) - 6);
            if (VerStr = '2022') or (VerStr = '2023') or (VerStr = '2024') or (VerStr = '2025') or (VerStr = '2026') or (VerStr = '2027') then
            begin
              RevitVersions[RevitCount] := VerStr;
              RevitPaths[RevitCount] := RevitDir + FindRec.Name;
              RevitCount := RevitCount + 1;
              if RevitCount >= 10 then break;
            end;
          end;
        end;
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

// 3ds Max profiles scan
procedure Detect3dsMax();
var
  FindRec: TFindRec;
  MaxDir: String;
  VerStr: String;
  SpacePos: Integer;
begin
  MaxCount := 0;
  MaxDir := ExpandConstant('{localappdata}') + '\Autodesk\3dsMax\';
  if FindFirst(MaxDir + '*', FindRec) then
  begin
    try
      repeat
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY <> 0) and (FindRec.Name <> '.') and (FindRec.Name <> '..') then
        begin
          if Pos(' - 64bit', FindRec.Name) > 0 then
          begin
            SpacePos := Pos(' ', FindRec.Name);
            if SpacePos > 0 then
            begin
              VerStr := Copy(FindRec.Name, 1, SpacePos - 1);
              if (VerStr = '2022') or (VerStr = '2023') or (VerStr = '2024') or (VerStr = '2025') or (VerStr = '2026') or (VerStr = '2027') then
              begin
                MaxVersions[MaxCount] := VerStr;
                MaxPaths[MaxCount] := MaxDir + FindRec.Name;
                MaxCount := MaxCount + 1;
                if MaxCount >= 10 then break;
              end;
            end;
          end;
        end;
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

procedure InitializeWizard();
var
  I: Integer;
  GroupIdx: Integer;
begin
  DetectRevit();
  Detect3dsMax();

  // Create Custom Integrations Page
  IntegrationsPage := CreateCustomPage(wpSelectDir, 'Select Autodesk Integrations', 'Detecting installed Autodesk products for plugins...');
  
  CheckListBox := TNewCheckListBox.Create(IntegrationsPage);
  CheckListBox.Parent := IntegrationsPage.Surface;
  CheckListBox.Align := alClient;

  if (RevitCount > 0) or (MaxCount > 0) then
  begin
    GroupIdx := CheckListBox.AddGroup('Detected Autodesk Integrations', '', 0, nil);
    
    if RevitCount > 0 then
    begin
      CheckListBox.AddGroup('Revit Plugins (Compiled on-the-fly)', '', 0, nil);
      for I := 0 to RevitCount - 1 do
      begin
        RevitCheckListIndexes[I] := CheckListBox.AddCheckBox('Install Revit ' + RevitVersions[I] + ' Integration', '', 1, True, True, False, True, nil);
      end;
    end;
    
    if MaxCount > 0 then
    begin
      CheckListBox.AddGroup('3ds Max Scripts', '', 0, nil);
      for I := 0 to MaxCount - 1 do
      begin
        MaxCheckListIndexes[I] := CheckListBox.AddCheckBox('Install 3ds Max ' + MaxVersions[I] + ' Integration', '', 1, True, True, False, True, nil);
      end;
    end;
  end
  else
  begin
    CheckListBox.AddGroup('No Revit or 3ds Max (2022-2027) installations were detected.', '', 0, nil);
    CheckListBox.AddGroup('You can install integrations later from inside the Anarchy AI application.', '', 0, nil);
  end;
end;

procedure InstallPrerequisites();
var
  ResultCode: Integer;
  TmpDir: String;
begin
  TmpDir := ExpandConstant('{tmp}');
  
  // 1. WebView2 check
  if not (RegKeyExists(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8ABB-3D73947896C7}') or
          RegKeyExists(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8ABB-3D73947896C7}') or
          RegKeyExists(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8ABB-3D73947896C7}')) then
  begin
    WizardForm.StatusLabel.Caption := 'Installing Edge WebView2 Runtime (Prerequisite)...';
    Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri ''https://go.microsoft.com/fwlink/p/?LinkId=2124703'' -OutFile ''' + TmpDir + '\MicrosoftEdgeWebview2Setup.exe''; Start-Process -FilePath ''' + TmpDir + '\MicrosoftEdgeWebview2Setup.exe'' -ArgumentList ''/silent'', ''/install'' -Wait"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;

  // 2. VC++ Redistributable check
  if not (RegKeyExists(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64') or
          RegKeyExists(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64')) then
  begin
    WizardForm.StatusLabel.Caption := 'Installing Visual C++ Redistributable (Prerequisite)...';
    Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri ''https://aka.ms/vs/17/release/vc_redist.x64.exe'' -OutFile ''' + TmpDir + '\vc_redist.x64.exe''; Start-Process -FilePath ''' + TmpDir + '\vc_redist.x64.exe'' -ArgumentList ''/passive'', ''/norestart'' -Wait"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

procedure WriteRevitAddinFile(AddinPath: String; DllPath: String);
var
  Lines: TArrayOfString;
begin
  SetArrayLength(Lines, 11);
  Lines[0] := '<?xml version="1.0" encoding="utf-8"?>';
  Lines[1] := '<RevitAddins>';
  Lines[2] := '  <AddIn Type="Application">';
  Lines[3] := '    <Name>AnarchyRevit</Name>';
  Lines[4] := '    <Assembly>' + DllPath + '</Assembly>';
  Lines[5] := '    <FullClassName>AnarchyRevit.App</FullClassName>';
  Lines[6] := '    <ClientId>B845C227-F346-4447-B5E3-F35E34EFBF68</ClientId>';
  Lines[7] := '    <VendorId>ANARCHY</VendorId>';
  Lines[8] := '    <VendorDescription>Anarchy AI Team</VendorDescription>';
  Lines[9] := '  </AddIn>';
  Lines[10] := '</RevitAddins>';
  SaveStringsToFile(AddinPath, Lines, False);
end;

procedure InstallPlugins();
var
  I: Integer;
  ResultCode: Integer;
  AppRoamingAutodesk: String;
  RevitPluginsSrc: String;
  RevitDest: String;
  MaxSrc: String;
  CscPath: String;
  WpfDir: String;
  FwDir: String;
begin
  AppRoamingAutodesk := ExpandConstant('{userappdata}') + '\Autodesk\';
  RevitPluginsSrc := ExpandConstant('{app}') + '\resources\revit-plugin\';
  MaxSrc := ExpandConstant('{app}') + '\resources\maxicons\';
  
  CscPath := 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe';
  if not FileExists(CscPath) then
  begin
    CscPath := 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe';
  end;
  
  WpfDir := 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\';
  if not DirExists(WpfDir) then
  begin
    WpfDir := 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\WPF\';
  end;

  FwDir := 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\';
  if not DirExists(FwDir) then
  begin
    FwDir := 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\';
  end;

  // 1. Install Revit Plugins
  for I := 0 to RevitCount - 1 do
  begin
    if (RevitCheckListIndexes[I] > 0) and CheckListBox.Checked[RevitCheckListIndexes[I]] then
    begin
      RevitDest := AppRoamingAutodesk + 'Revit\Addins\' + RevitVersions[I] + '\';
      ForceDirectories(RevitDest);
      ForceDirectories(RevitDest + 'AnarchyRevit');
      
      // Copy Revit source assets to their addin folder
      CopyFile(RevitPluginsSrc + 'AnarchyRevit.cs', RevitDest + 'AnarchyRevit\AnarchyRevit.cs', False);
      CopyFile(RevitPluginsSrc + 'AnarchyLogo_32.png', RevitDest + 'AnarchyRevit\AnarchyLogo_32.png', False);
      CopyFile(RevitPluginsSrc + 'AnarchyLogo_16.png', RevitDest + 'AnarchyRevit\AnarchyLogo_16.png', False);
      
      // Compile plugin dll using csc.exe
      if FileExists(CscPath) then
      begin
        WizardForm.StatusLabel.Caption := 'Compiling Revit ' + RevitVersions[I] + ' plugin...';
        Exec(CscPath,
          '/target:library /nologo /platform:x64 /out:"' + RevitDest + 'AnarchyRevit\AnarchyRevit.dll" ' +
          '/reference:"' + RevitPaths[I] + '\RevitAPI.dll" ' +
          '/reference:"' + RevitPaths[I] + '\RevitAPIUI.dll" ' +
          '/reference:"' + WpfDir + 'PresentationCore.dll" ' +
          '/reference:"' + WpfDir + 'WindowsBase.dll" ' +
          '/reference:"' + FwDir + 'System.Xaml.dll" ' +
          '/reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll ' +
          '"' + RevitDest + 'AnarchyRevit\AnarchyRevit.cs"',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
      
      // Write manifest
      WriteRevitAddinFile(RevitDest + 'Anarchy.addin', RevitDest + 'AnarchyRevit\AnarchyRevit.dll');
    end;
  end;

  // 2. Install 3ds Max Scripts
  for I := 0 to MaxCount - 1 do
  begin
    if (MaxCheckListIndexes[I] > 0) and CheckListBox.Checked[MaxCheckListIndexes[I]] then
    begin
      ForceDirectories(MaxPaths[I] + '\ENU');
      ForceDirectories(MaxPaths[I] + '\ENU\scripts');
      ForceDirectories(MaxPaths[I] + '\ENU\scripts\startup');
      ForceDirectories(MaxPaths[I] + '\ENU\usermacros');
      ForceDirectories(MaxPaths[I] + '\ENU\usericons');
      
      // Copy scripts
      CopyFile(ExpandConstant('{app}') + '\resources\AnarchyConnector.ms', MaxPaths[I] + '\ENU\scripts\startup\AnarchyConnector.ms', False);
      CopyFile(ExpandConstant('{app}') + '\resources\AnarchyConnector.ms', MaxPaths[I] + '\ENU\usermacros\Anarchy-AnarchySync.mcr', False);
      
      // Copy icons
      CopyFile(MaxSrc + 'AnarchyLogo_24i.bmp', MaxPaths[I] + '\ENU\usericons\AnarchyLogo_24i.bmp', False);
      CopyFile(MaxSrc + 'AnarchyLogo_24a.bmp', MaxPaths[I] + '\ENU\usericons\AnarchyLogo_24a.bmp', False);
      CopyFile(MaxSrc + 'AnarchyLogo_16i.bmp', MaxPaths[I] + '\ENU\usericons\AnarchyLogo_16i.bmp', False);
      CopyFile(MaxSrc + 'AnarchyLogo_16a.bmp', MaxPaths[I] + '\ENU\usericons\AnarchyLogo_16a.bmp', False);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    InstallPrerequisites();
    InstallPlugins();
  end;
end;
