$ErrorActionPreference = 'Stop'
$labRoot = Split-Path $PSScriptRoot -Parent
Push-Location $labRoot
try {
    if (-not (Test-Path '.venv-model-lab/Scripts/python.exe')) {
        & '.venv/Scripts/python.exe' -m venv .venv-model-lab
        if ($LASTEXITCODE -ne 0) { throw 'Cannot create isolated environment' }
    }
    & '.venv-model-lab/Scripts/python.exe' -m pip install --no-deps -r experiments/requirements-lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Experiment dependencies failed' }
    & '.venv-model-lab/Scripts/python.exe' -c "import cv2,rtmlib,onnxruntime; print(cv2.__version__, onnxruntime.__version__, onnxruntime.get_available_providers())"
    if ($LASTEXITCODE -ne 0) { throw 'Experiment imports failed' }
} finally {
    Pop-Location
}
