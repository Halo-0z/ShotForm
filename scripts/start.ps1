$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path -LiteralPath $cargoBin) { $env:PATH = "$cargoBin;$env:PATH" }
foreach ($tool in @('node', 'npm', 'cargo')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing $tool. See README.md." }
}
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) { throw 'Missing .venv. See README.md.' }
if (-not (Test-Path -LiteralPath 'node_modules')) { throw 'Run npm ci first.' }
& '.venv\Scripts\python.exe' -c 'import cv2, mediapipe, numpy'
if ($LASTEXITCODE -ne 0) { throw 'Python dependencies are unavailable.' }
npm run tauri dev
exit $LASTEXITCODE
