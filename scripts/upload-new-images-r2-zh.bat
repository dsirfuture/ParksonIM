@echo off
setlocal
set "PS1=%~dp0upload-new-images-r2-zh.ps1"
if not exist "%PS1%" (
  echo [ERROR] Missing script: "%PS1%"
  pause
  exit /b 1
)
powershell -NoLogo -NoExit -ExecutionPolicy Bypass -File "%PS1%"
