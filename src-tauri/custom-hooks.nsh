!macro NSIS_HOOK_POSTINSTALL
  ; Register the file extension and associate it with AnarchyAI.ana
  WriteRegStr HKCR ".ana" "" "AnarchyAI.ana"
  
  ; Register AnarchyAI.ana ProgID
  WriteRegStr HKCR "AnarchyAI.ana" "" "Anarchy AI Project File"
  
  ; Set the default icon for the associated file type
  WriteRegStr HKCR "AnarchyAI.ana\DefaultIcon" "" "$INSTDIR\resources\icons\ana-file.ico"
  
  ; Set the default open command
  WriteRegStr HKCR "AnarchyAI.ana\shell\open\command" "" '"$INSTDIR\Anarchy AI.exe" "%1"'
  
  ; Notify Windows Shell of registry changes to refresh icons immediately
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Clean up registry keys on uninstall
  DeleteRegKey HKCR ".ana"
  DeleteRegKey HKCR "AnarchyAI.ana"
  
  ; Notify system of registry change
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
