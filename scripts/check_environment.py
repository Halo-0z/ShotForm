"""Read-only environment report. Does not print credentials."""
import importlib.metadata
import json
import hashlib
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

root = Path(__file__).resolve().parent.parent
result = {"python": sys.version, "executable": sys.executable, "os": platform.platform(), "machine": platform.machine(), "packages": {}, "tools": {}, "models": {}}
for name in ["mediapipe", "opencv-contrib-python", "numpy"]:
    try:
        result["packages"][name] = importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        result["packages"][name] = "missing"
for name in ["node", "npm", "cargo", "rustc"]:
    executable = shutil.which(name)
    if not executable and name in ("cargo", "rustc"):
        candidate = Path.home() / ".cargo" / "bin" / f"{name}.exe"
        executable = str(candidate) if candidate.exists() else None
    try:
        result["tools"][name] = subprocess.check_output([executable, "--version"], text=True, timeout=15).strip() if executable else "missing"
    except (OSError, subprocess.SubprocessError) as error:
        result["tools"][name] = str(error)
for path in (root / "models").glob("*.task"):
    item = {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    try:
        from pose_detect import create_task_detector
        detector, info = create_task_detector(path)
        detector.close()
        item.update(loadable=True, loaded_model=info)
    except Exception as error:
        item.update(loadable=False, error=str(error))
    result["models"][path.name] = item
result["hunyuan_key_configured"] = bool(os.environ.get("HUNYUAN_API_KEY"))
print(json.dumps(result, ensure_ascii=False, indent=2))
