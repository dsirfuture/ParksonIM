@echo off
setlocal

set "PS1=%~dp0upload-new-images-r2.ps1"
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
  echo [ERROR] PowerShell not found. Install Windows PowerShell or PowerShell 7 first.
  pause
  exit /b 1
)

set "MODE=%~1"
set "ARG2=%~2"

if "%MODE%"=="" goto :menu

if /I "%MODE%"=="single" goto :single
if /I "%MODE%"=="recent" goto :recent
if /I "%MODE%"=="dryrun" goto :dryrun
goto :help

:menu
echo.
echo ================================
echo R2 Image Upload Helper
echo ================================
echo 1. Upload single file
echo 2. Upload recent changed files (default 24h)
echo 3. Dry run recent files (no upload)
echo 4. Exit
echo.
set /p CHOICE=Select [1-4]:
if "%CHOICE%"=="1" goto :menu_single
if "%CHOICE%"=="2" goto :menu_recent
if "%CHOICE%"=="3" goto :menu_dryrun
goto :end

:menu_single
set /p ARG2=Input full file path:
set "MODE=single"
goto :single

:menu_recent
set /p ARG2=Hours (default 24):
set "MODE=recent"
goto :recent

:menu_dryrun
set /p ARG2=Hours (default 24):
set "MODE=dryrun"
goto :dryrun

:single
if "%ARG2%"=="" (
  echo [ERROR] Missing file path.
  echo Example: upload-new-images-r2.bat single "Y:\projects\ParksonIM-main\public\products\07921.jpg"
  pause
  exit /b 1
)
"%PSHOST%" -ExecutionPolicy Bypass -File "%PS1%" -FilePath "%ARG2%"
goto :end

:recent
set "HOURS=%ARG2%"
if "%HOURS%"=="" set "HOURS=24"
"%PSHOST%" -ExecutionPolicy Bypass -File "%PS1%" -SinceHours %HOURS%
goto :end

:dryrun
set "HOURS=%ARG2%"
if "%HOURS%"=="" set "HOURS=24"
"%PSHOST%" -ExecutionPolicy Bypass -File "%PS1%" -SinceHours %HOURS% -DryRun
goto :end

:help
echo Usage:
echo   upload-new-images-r2.bat single "FULL_FILE_PATH"
echo   upload-new-images-r2.bat recent [HOURS]
echo   upload-new-images-r2.bat dryrun [HOURS]
echo.
echo Examples:
echo   upload-new-images-r2.bat single "Y:\projects\ParksonIM-main\public\products\07921.jpg"
echo   upload-new-images-r2.bat recent 24
echo   upload-new-images-r2.bat dryrun 24
goto :end

:end
echo.
pause
exit /b %errorlevel%
