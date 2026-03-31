@echo off
setlocal
set "PS1=%~dp0upload-new-images-r2-zh.ps1"
if not exist "%PS1%" (
  echo [ERROR] Missing script: "%PS1%"
  pause
  exit /b 1
)
set "PSHOST="
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" set "PSHOST=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not defined PSHOST for /f "delims=" %%I in ('where powershell.exe 2^>nul') do if not defined PSHOST set "PSHOST=%%I"
if not defined PSHOST for /f "delims=" %%I in ('where pwsh.exe 2^>nul') do if not defined PSHOST set "PSHOST=%%I"
if not defined PSHOST (
  echo [ERROR] 未找到 PowerShell。请先安装 Windows PowerShell 或 PowerShell 7。
  pause
  exit /b 1
)
"%PSHOST%" -NoLogo -NoExit -ExecutionPolicy Bypass -File "%PS1%"
