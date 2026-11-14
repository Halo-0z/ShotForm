"""Measure the existing Python pose pipeline on traceable materials; never fabricate labels.

Manifest: {"samples": [{"id": "S01", "path": "...", "kind": "video",
"source": "...", "condition": "...", "start_ms": 0, "end_ms": 0}]}
"""
import argparse
import base64
import hashlib
import json
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, required=True, help="New output directory; never overwrites a run")
    parser.add_argument("--extract-frames", type=int, default=20, help="Maximum frames across the run for manual annotation")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
    samples = manifest.get("samples", [])
    if not samples:
        raise SystemExit("No samples. Fill the manifest with real material paths and sources first.")
    ids = [s.get("id", "") for s in samples]
    if len(set(ids)) != len(ids) or any(not i or not all(c.isalnum() or c in "-_" for c in i) for i in ids):
        raise SystemExit("Sample IDs must be unique letters/numbers/hyphens/underscores.")
    if any(s.get("kind") not in ("image", "video") or not s.get("source") or not s.get("path") for s in samples):
        raise SystemExit("Each sample needs kind=image/video, path and source.")
    args.output.mkdir(parents=True, exist_ok=False)
    environment = subprocess.check_output([sys.executable, str(ROOT / "scripts/check_environment.py")], text=True, encoding="utf-8")
    (args.output / "environment.json").write_text(environment, encoding="utf-8")
    results, annotations = [], []
    for sample in samples:
        path = Path(sample["path"])
        if not path.is_absolute():
            path = args.manifest.resolve().parent / path
        item = dict(sample, resolved_path=str(path.resolve()))
        if not path.is_file():
            results.append(dict(item, error="File not found")); continue
        item["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        raw = args.output / f"{sample['id']}.json"
        command = [sys.executable, str(ROOT / "scripts" / ("video_pose_detect.py" if sample["kind"] == "video" else "pose_detect.py"))]
        if sample["kind"] == "video":
            command += ["--video", str(path), "--start-ms", str(sample.get("start_ms", 0)), "--end-ms", str(sample.get("end_ms", 0)), "--max-frames", "16"]
        else:
            command += ["--file", str(path)]
        command += ["--output-file", str(raw.resolve())]
        started = time.perf_counter()
        try:
            process = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
            item["elapsed_seconds"] = round(time.perf_counter() - started, 3)
            (args.output / f"{sample['id']}.stderr.txt").write_text(process.stderr, encoding="utf-8")
            data = json.loads(raw.read_text(encoding="utf-8"))
            item["model_info"] = data.get("model_info")
            item["error"] = data.get("error")
            item["exit_code"] = process.returncode
            if sample["kind"] == "video":
                frames = data.get("frames", [])
                item["sampled_frames"] = data.get("sampled_frames", 0)
                item["read_frames"] = data.get("frames_read", 0)
                item["valid_frames"] = len(frames)
                item["valid_ratio"] = len(frames) / item["sampled_frames"] if item["sampled_frames"] else None
                for frame in frames:
                    if len(annotations) >= args.extract_frames:
                        break
                    filename = f"{sample['id']}-{frame['index']}.jpg"
                    (args.output / filename).write_bytes(base64.b64decode(frame["image_data"].split(",", 1)[1]))
                    annotations.append({"sample_id": sample["id"], "image": filename, "frame_index": frame["index"], "timestamp_ms": frame["timestamp_ms"], "model_keypoints": frame["keypoints"], "manual_keypoints": {}, "annotator": "", "notes": ""})
            else:
                item["keypoint_count"] = len(data.get("keypoints", []))
        except (OSError, ValueError, subprocess.TimeoutExpired) as error:
            item["error"] = str(error)
        results.append(item)
    report = {"executed_at_utc": datetime.now(timezone.utc).isoformat(), "machine": platform.platform(), "timing_definition": "Python process startup + decoding + pose inference + JSON output; excludes Rust angles and UI", "results": results}
    (args.output / "results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output / "annotations.json").write_text(json.dumps(annotations, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Recorded {len(results)} samples in {args.output}. Manual annotations remain empty until a person labels them.")
    return 1 if any(r.get("error") or r.get("exit_code", 0) != 0 for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
