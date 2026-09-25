; Atalho na área de trabalho e no menu Iniciar, com o logo do OrBullets.
!macro customInstall
  Delete "$DESKTOP\OrBullets.lnk"
  CreateShortCut "$DESKTOP\OrBullets.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\OrBullets.ico" 0 "" "" "OrBullets"
  Delete "$SMPROGRAMS\OrBullets.lnk"
  CreateShortCut "$SMPROGRAMS\OrBullets.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\OrBullets.ico" 0 "" "" "OrBullets"
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  Delete "$DESKTOP\OrBullets.lnk"
  Delete "$SMPROGRAMS\OrBullets.lnk"
!macroend
