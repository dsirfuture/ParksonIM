@echo off
setlocal EnableExtensions

cd /d "%~dp0"

rem ======================================
rem One-time local config (do NOT commit real token)
rem Paste your Cloudflare API token below.
rem ======================================
set "LOCAL_CF_TOKEN=QJox8wsFp4dHB_ifKviiOQ-OJo-_wqCwKZwx4HKZ"

echo ================================
echo R2 图片一键启动（中文）
echo ================================
echo.

where wrangler >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 wrangler。请先安装：npm i -g wrangler
  pause
  exit /b 1
)

if /I not "%LOCAL_CF_TOKEN%"=="PASTE_YOUR_CLOUDFLARE_API_TOKEN_HERE" (
  set "CLOUDFLARE_API_TOKEN=%LOCAL_CF_TOKEN%"
)

if "%CLOUDFLARE_API_TOKEN%"=="" (
  echo 未检测到 CLOUDFLARE_API_TOKEN。
  set /p CLOUDFLARE_API_TOKEN=请粘贴 Cloudflare API Token（当前窗口生效）: 
)

if "%CLOUDFLARE_API_TOKEN%"=="" (
  echo [错误] Token 为空，已取消。
  pause
  exit /b 1
)

set "WRANGLER_SEND_METRICS=false"

echo.
echo [检查] wrangler whoami...
wrangler whoami
if errorlevel 1 (
  echo [错误] whoami 失败，请检查 token。
  pause
  exit /b 1
)

echo.
echo [检查] wrangler r2 bucket list...
wrangler r2 bucket list
if errorlevel 1 (
  echo [错误] 无法读取 R2 存储桶，请检查 token 权限。
  pause
  exit /b 1
)

echo.
if not exist "%~dp0upload-new-images-r2-zh.bat" (
  echo [错误] 未找到 upload-new-images-r2-zh.bat
  echo [路径] %~dp0upload-new-images-r2-zh.bat
  pause
  exit /b 1
)

call "%~dp0upload-new-images-r2-zh.bat"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo [结束] 脚本执行失败，错误码：%EXIT_CODE%
) else (
  echo [结束] 脚本执行完成。
)
pause

endlocal
