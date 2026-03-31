@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ================================
echo R2 图片一键启动（中文）
echo ================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 node。请先安装 Node.js
  pause
  exit /b 1
)

set "WRANGLER_SEND_METRICS=false"

echo.
echo [检查] 本地 Node 环境...
node -v
if errorlevel 1 (
  echo [错误] Node 环境异常。
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

if not exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
  where powershell.exe >nul 2>nul
  if errorlevel 1 (
    where pwsh.exe >nul 2>nul
    if errorlevel 1 (
      echo [错误] 未检测到 PowerShell。请先安装 Windows PowerShell 或 PowerShell 7
      pause
      exit /b 1
    )
  )
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
