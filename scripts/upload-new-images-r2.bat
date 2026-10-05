@echo off
setlocal

set "PS1=%~dp0upload-new-images-r2.ps1"
if not exist "%PS1%" (
  echo [ERROR] Missing script: "%PS1%"
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
call :ensure_token
if "%ARG2%"=="" (
  echo [ERROR] Missing file path.
  echo Example: upload-new-images-r2.bat single "Y:\projects\ParksonIM-main\public\products\07921.jpg"
  pause
  exit /b 1
)
powershell -ExecutionPolicy Bypass -File "%PS1%" -FilePath "%ARG2%"
goto :end

:recent
call :ensure_token
set "HOURS=%ARG2%"
if "%HOURS%"=="" set "HOURS=24"
powershell -ExecutionPolicy Bypass -File "%PS1%" -SinceHours %HOURS%
goto :end

:dryrun
call :ensure_token
set "HOURS=%ARG2%"
if "%HOURS%"=="" set "HOURS=24"
powershell -ExecutionPolicy Bypass -File "%PS1%" -SinceHours %HOURS% -DryRun
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

:ensure_token
if "%CLOUDFLARE_API_TOKEN%"=="" (
  echo CLOUDFLARE_API_TOKEN is not set.
  set /p CLOUDFLARE_API_TOKEN=Paste your Cloudflare API token: 
)
exit /b 0

:end
echo.
pause
exit /b %errorlevel%
