from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def resolve_command(*candidates: str) -> str:
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    joined = ', '.join(candidates)
    raise SystemExit(f"Missing required command: {joined}")


def run_step(name: str, command: list[str]) -> None:
    print(f"\n==> {name}")
    print(" ".join(command))
    result = subprocess.run(command, cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> int:
    npm = resolve_command('npm.cmd', 'npm')
    cargo = resolve_command('cargo.exe', 'cargo')
    python = sys.executable

    run_step("Frontend build", [npm, 'run', 'build'])
    run_step("Rust tests", [cargo, 'test', '--manifest-path', 'src-tauri/Cargo.toml'])
    run_step(
        "Python syntax smoke",
        [
            python,
            '-m',
            'py_compile',
            'scripts/pose_detect.py',
            'scripts/video_pose_detect.py',
        ],
    )

    print("\nCI checks passed.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
