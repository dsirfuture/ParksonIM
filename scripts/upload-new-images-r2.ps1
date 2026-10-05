param(
  [string]$Bucket = "parkson-products",
  [string]$BaseDir = "Y:\projects\ParksonIM-main\public\products",
  [string]$FilePath = "",
  [int]$SinceHours = 24,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing command: $name. Please install it first."
  }
}

Require-Command "wrangler"

if (-not $env:CLOUDFLARE_API_TOKEN) {
  throw "CLOUDFLARE_API_TOKEN is not set. Example: `$env:CLOUDFLARE_API_TOKEN='your-token'"
}

if (-not (Test-Path $BaseDir)) {
  throw "BaseDir does not exist: $BaseDir"
}

$env:WRANGLER_SEND_METRICS = "false"

function Upload-File([string]$absolutePath) {
  if (-not (Test-Path $absolutePath)) {
    Write-Warning "Skip missing file: $absolutePath"
    return
  }

  $resolvedBase = (Resolve-Path $BaseDir).Path
  $resolvedFile = (Resolve-Path $absolutePath).Path
  if (-not $resolvedFile.StartsWith($resolvedBase, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "File is outside BaseDir: $resolvedFile"
  }

  $key = $resolvedFile.Substring($resolvedBase.Length + 1).Replace('\', '/')
  $target = "$Bucket/$key"

  if ($DryRun) {
    Write-Host "[DRYRUN] wrangler r2 object put `"$target`" --file `"$resolvedFile`" --remote"
    return
  }

  wrangler r2 object put $target --file $resolvedFile --remote
}

if ($FilePath) {
  Upload-File -absolutePath $FilePath
  Write-Host "Done (single file)."
  exit 0
}

$since = (Get-Date).AddHours(-1 * [Math]::Abs($SinceHours))
$files = Get-ChildItem $BaseDir -Recurse -File | Where-Object { $_.LastWriteTime -ge $since }

if (-not $files -or $files.Count -eq 0) {
  Write-Host "No files changed since $since."
  exit 0
}

$failed = New-Object System.Collections.Generic.List[string]
foreach ($f in $files) {
  $ok = $false
  for ($i = 1; $i -le 3 -and -not $ok; $i++) {
    try {
      Upload-File -absolutePath $f.FullName
      $ok = $true
    } catch {
      if ($i -lt 3) {
        Start-Sleep -Seconds (2 * $i)
      }
    }
  }
  if (-not $ok) {
    $failed.Add($f.FullName)
    Write-Host "FAILED: $($f.FullName)"
  }
}

if ($failed.Count -gt 0) {
  $failedFile = Join-Path (Split-Path $BaseDir -Parent) "tmp\r2_failed_new_images.txt"
  New-Item -ItemType Directory -Force -Path (Split-Path $failedFile -Parent) | Out-Null
  $failed | Set-Content $failedFile
  Write-Host "Done with failures: $($failed.Count)"
  Write-Host "Failed list: $failedFile"
  exit 2
}

Write-Host "Done. Uploaded files: $($files.Count)"
