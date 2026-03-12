Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Zh([string]$s) {
  return [Regex]::Unescape($s)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$worker = Join-Path $scriptDir "upload-new-images-r2.ps1"

if (-not (Test-Path $worker)) {
  Write-Host ("[" + (Zh '\u9519\u8BEF') + "] " + (Zh '\u627E\u4E0D\u5230\u811A\u672C') + ": $worker")
  Read-Host (Zh '\u6309\u56DE\u8F66\u9000\u51FA')
  exit 1
}

function Ensure-Token {
  if (-not $env:CLOUDFLARE_API_TOKEN) {
    $token = Read-Host (Zh '\u8BF7\u8F93\u5165 Cloudflare API Token')
    if (-not $token) {
      throw (Zh '\u672A\u63D0\u4F9B Token\uFF0C\u5DF2\u53D6\u6D88\u3002')
    }
    $env:CLOUDFLARE_API_TOKEN = $token
  }
}

function Run-Single {
  Ensure-Token
  $filePath = Read-Host (Zh '\u8BF7\u8F93\u5165\u56FE\u7247\u5B8C\u6574\u8DEF\u5F84')
  if (-not $filePath) {
    Write-Host ("[" + (Zh '\u9519\u8BEF') + "] " + (Zh '\u6587\u4EF6\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A\u3002'))
    return
  }
  & powershell -ExecutionPolicy Bypass -File $worker -FilePath $filePath
}

function Read-Hours {
  $hoursText = Read-Host (Zh '\u8BF7\u8F93\u5165\u5C0F\u65F6\u6570\uFF08\u9ED8\u8BA4 24\uFF09')
  $hours = 24
  if ($hoursText) {
    if (-not [int]::TryParse($hoursText, [ref]$hours)) {
      Write-Host ("[" + (Zh '\u9519\u8BEF') + "] " + (Zh '\u5C0F\u65F6\u6570\u683C\u5F0F\u4E0D\u6B63\u786E\u3002'))
      return $null
    }
  }
  return $hours
}

function Run-Recent {
  Ensure-Token
  $hours = Read-Hours
  if ($null -eq $hours) { return }
  & powershell -ExecutionPolicy Bypass -File $worker -SinceHours $hours
}

function Run-DryRun {
  Ensure-Token
  $hours = Read-Hours
  if ($null -eq $hours) { return }
  & powershell -ExecutionPolicy Bypass -File $worker -SinceHours $hours -DryRun
}

while ($true) {
  Clear-Host
  Write-Host "==============================="
  Write-Host (Zh 'R2 \u56FE\u7247\u4E0A\u4F20\u52A9\u624B\uFF08\u4E2D\u6587\uFF09')
  Write-Host "==============================="
  Write-Host (Zh '1. \u4E0A\u4F20\u5355\u5F20\u56FE\u7247')
  Write-Host (Zh '2. \u4E0A\u4F20\u6700\u8FD1\u53D8\u66F4\u56FE\u7247\uFF08\u9ED8\u8BA424\u5C0F\u65F6\uFF09')
  Write-Host (Zh '3. \u4EC5\u9884\u89C8\u4E0D\u4E0A\u4F20')
  Write-Host (Zh '4. \u9000\u51FA')
  Write-Host ""

  $choice = Read-Host (Zh '\u8BF7\u9009\u62E9 [1-4]')
  try {
    switch ($choice) {
      "1" { Run-Single }
      "2" { Run-Recent }
      "3" { Run-DryRun }
      "4" { break }
      default { Write-Host (Zh '\u65E0\u6548\u9009\u9879\uFF0C\u8BF7\u91CD\u8BD5\u3002') }
    }
  } catch {
    Write-Host ("[" + (Zh '\u9519\u8BEF') + "] " + $_.Exception.Message)
  }

  if ($choice -eq "4") { break }
  Read-Host (Zh '\u6309\u56DE\u8F66\u8FD4\u56DE\u83DC\u5355')
}
