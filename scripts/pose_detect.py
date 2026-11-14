import base64
import json
import hashlib
import os
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

try:
    import mediapipe as mp
except ImportError:
    print(
        json.dumps(
            {
                "error": "MediaPipe not installed. Run: pip install mediapipe",
                "keypoints": [],
                "width": 0,
                "height": 0,
            },
            ensure_ascii=False,
        )
    )
    sys.exit(1)


LANDMARK_NAMES = [
    "nose",
    "left_eye_inner",
    "left_eye",
    "left_eye_outer",
    "right_eye_inner",
    "right_eye",
    "right_eye_outer",
    "left_ear",
    "right_ear",
    "mouth_left",
    "mouth_right",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_pinky",
    "right_pinky",
    "left_index",
    "right_index",
    "left_thumb",
    "right_thumb",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
    "left_heel",
    "right_heel",
    "left_foot_index",
    "right_foot_index",
]

_DETECTOR_KIND = None
_DETECTOR = None
_DETECTOR_ERROR = None
_MODEL_INFO = None


def get_model_info():
    return _MODEL_INFO


def _error_result(message: str, width: int = 0, height: int = 0) -> dict:
    return {"error": message, "keypoints": [], "width": width, "height": height, "model_info": get_model_info()}


def _decode_image_bytes(image_bytes: bytes) -> np.ndarray | None:
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _read_image_file(file_path: str) -> np.ndarray | None:
    file_bytes = np.fromfile(file_path, dtype=np.uint8)
    if file_bytes.size == 0:
        return None
    return cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)


def _candidate_model_paths() -> list[Path]:
    override = os.environ.get("SHOTFORM_POSE_MODELS")
    if override:
        return [Path(p) for p in override.split(os.pathsep) if p]
    script_dir = Path(__file__).resolve().parent
    roots = [script_dir.parent / "models", Path.cwd() / "models"]
    names = [
        "pose_landmarker_heavy.task",
        "pose_landmarker_full.task",
        "pose_landmarker_lite.task",
    ]

    candidates: list[Path] = []
    seen: set[str] = set()

    for root in roots:
        for name in names:
            path = root / name
            key = str(path.resolve()).lower()
            if key not in seen:
                seen.add(key)
                candidates.append(path)

    return candidates


def _cache_model_to_ascii_path(source_path: Path) -> Path:
    data = source_path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    cache_dir = Path(tempfile.gettempdir()) / "basketball-shot-analyzer"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached_path = cache_dir / f"{digest}.task"
    if not cached_path.exists() or hashlib.sha256(cached_path.read_bytes()).hexdigest() != digest:
        temporary = cached_path.with_suffix(f".{os.getpid()}.tmp")
        temporary.write_bytes(data)
        temporary.replace(cached_path)
    return cached_path


def create_task_detector(model_path: Path):
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision
    cached_path = _cache_model_to_ascii_path(model_path)
    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(cached_path)),
        running_mode=vision.RunningMode.IMAGE, num_poses=3,
        min_pose_detection_confidence=0.35, min_pose_presence_confidence=0.35,
        min_tracking_confidence=0.35, output_segmentation_masks=False,
    )
    detector = vision.PoseLandmarker.create_from_options(options)
    return detector, {"backend": "tasks", "name": model_path.name,
                      "sha256": cached_path.stem, "fallback_reasons": []}


def _record_model(info):
    global _MODEL_INFO
    _MODEL_INFO = info
    print("[pose-model] " + json.dumps(info, ensure_ascii=True), file=sys.stderr, flush=True)


def _create_tasks_detector():
    errors = []
    for model_path in _candidate_model_paths():
        try:
            detector, info = create_task_detector(model_path)
            info["fallback_reasons"] = errors.copy()
            _record_model(info)
            return "tasks", detector
        except Exception as exc:
            failure = f"{model_path.name}: {exc}"
            errors.append(failure)
            print("[pose-model] load failed: " + failure, file=sys.stderr, flush=True)
    raise RuntimeError("Failed to load MediaPipe task models. " + " | ".join(errors))


def _create_solutions_detector():
    pose_module = mp.solutions.pose
    detector = pose_module.Pose(
        static_image_mode=True,
        model_complexity=2,
        enable_segmentation=False,
        min_detection_confidence=0.35,
    )
    return "solutions", detector


def _get_detector():
    global _DETECTOR_KIND, _DETECTOR, _DETECTOR_ERROR

    if _DETECTOR is not None:
        return _DETECTOR_KIND, _DETECTOR

    if _DETECTOR_ERROR is not None:
        raise RuntimeError(_DETECTOR_ERROR)

    errors: list[str] = []

    if hasattr(mp, "tasks"):
        try:
            _DETECTOR_KIND, _DETECTOR = _create_tasks_detector()
            return _DETECTOR_KIND, _DETECTOR
        except Exception as exc:
            errors.append(str(exc))

    if hasattr(mp, "solutions"):
        try:
            _DETECTOR_KIND, _DETECTOR = _create_solutions_detector()
            model_path = Path(mp.__file__).parent / "modules/pose_landmark/pose_landmark_heavy.tflite"
            _record_model({"backend": "solutions", "name": model_path.name,
                           "sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
                           "fallback_reasons": errors.copy()})
            return _DETECTOR_KIND, _DETECTOR
        except Exception as exc:
            errors.append(str(exc))

    _DETECTOR_ERROR = (
        "Unable to initialize MediaPipe pose detection. " + " | ".join(errors)
        if errors
        else "Unable to initialize MediaPipe pose detection."
    )
    raise RuntimeError(_DETECTOR_ERROR)


def _landmark_visibility(landmark) -> float:
    value = getattr(landmark, "visibility", None)
    if value is None:
        value = getattr(landmark, "presence", 1.0)
    return float(value)


def _tasks_landmarks(detector, image_rgb: np.ndarray):
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    result = detector.detect(mp_image)
    return result.pose_landmarks[0] if result.pose_landmarks else None


def _tasks_all_landmarks(detector, image_rgb: np.ndarray):
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    result = detector.detect(mp_image)
    return result.pose_landmarks if result.pose_landmarks else []


def _solutions_landmarks(detector, image_rgb: np.ndarray):
    result = detector.process(image_rgb)
    return result.pose_landmarks.landmark if result.pose_landmarks else None


def detect_pose(image: np.ndarray) -> dict:
    height, width = image.shape[:2]

    try:
        detector_kind, detector = _get_detector()
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if detector_kind == "tasks":
            landmarks = _tasks_landmarks(detector, image_rgb)
        else:
            landmarks = _solutions_landmarks(detector, image_rgb)

        if not landmarks:
            return _error_result("No pose detected", width, height)

        keypoints = []
        for index, landmark in enumerate(landmarks):
            keypoints.append(
                {
                    "id": index,
                    "name": LANDMARK_NAMES[index]
                    if index < len(LANDMARK_NAMES)
                    else f"keypoint_{index}",
                    "x": float(landmark.x * width),
                    "y": float(landmark.y * height),
                    "z": float(getattr(landmark, "z", 0.0)),
                    "visibility": _landmark_visibility(landmark),
                }
            )

        return {"keypoints": keypoints, "width": width, "height": height, "model_info": get_model_info()}
    except Exception as exc:
        return _error_result(str(exc), width, height)


def compute_torso_center(keypoints: list[dict]) -> tuple[float, float]:
    torso_ids = [11, 12, 23, 24]
    xs, ys = [], []
    for kp in keypoints:
        if kp["id"] in torso_ids and kp["visibility"] >= 0.3:
            xs.append(kp["x"])
            ys.append(kp["y"])
    if xs:
        return sum(xs) / len(xs), sum(ys) / len(ys)
    visible = [kp for kp in keypoints if kp["visibility"] >= 0.3]
    if visible:
        return sum(kp["x"] for kp in visible) / len(visible), sum(kp["y"] for kp in visible) / len(visible)
    return 0.0, 0.0


def detect_poses(image: np.ndarray) -> dict:
    height, width = image.shape[:2]

    try:
        detector_kind, detector = _get_detector()
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if detector_kind == "tasks":
            all_landmarks = _tasks_all_landmarks(detector, image_rgb)
        else:
            single = _solutions_landmarks(detector, image_rgb)
            all_landmarks = [single] if single else []

        if not all_landmarks:
            return {"poses": [], "width": width, "height": height, "model_info": get_model_info()}

        poses = []
        for person_landmarks in all_landmarks:
            keypoints = []
            for index, landmark in enumerate(person_landmarks):
                keypoints.append(
                    {
                        "id": index,
                        "name": LANDMARK_NAMES[index]
                        if index < len(LANDMARK_NAMES)
                        else f"keypoint_{index}",
                        "x": float(landmark.x * width),
                        "y": float(landmark.y * height),
                        "z": float(getattr(landmark, "z", 0.0)),
                        "visibility": _landmark_visibility(landmark),
                    }
                )
            cx, cy = compute_torso_center(keypoints)
            poses.append({"keypoints": keypoints, "torso_cx": cx, "torso_cy": cy})

        return {"poses": poses, "width": width, "height": height, "model_info": get_model_info()}
    except Exception as exc:
        return {"poses": [], "width": width, "height": height, "model_info": get_model_info(), "error": str(exc)}


def detect_from_base64(image_base64: str) -> dict:
    try:
        if image_base64.startswith("data:image"):
            image_base64 = image_base64.split(",", 1)[1]

        image = _decode_image_bytes(base64.b64decode(image_base64))
        if image is None:
            return _error_result("Failed to decode image")

        return detect_pose(image)
    except Exception as exc:
        return _error_result(str(exc))


def detect_from_file(file_path: str) -> dict:
    try:
        image = _read_image_file(file_path)
        if image is None:
            return _error_result(f"Failed to read image: {file_path}")

        return detect_pose(image)
    except Exception as exc:
        return _error_result(str(exc))


def _write_result(result: dict, output_file: str | None) -> None:
    payload = json.dumps(result, ensure_ascii=False)
    if output_file:
        Path(output_file).write_text(payload, encoding="utf-8")
        return

    print(payload)


def run_daemon() -> None:
    """Read JSON requests from stdin, process them, write JSON responses to stdout.
    
    Protocol: Each line is a JSON object with a "method" field:
    - {"method": "detect_base64", "image_base64": "..."}
    - {"method": "detect_file", "file_path": "..."}
    - {"method": "shutdown"}
    
    Response: Each line is a JSON object with the detection result.
    """
    sys.stdout.write(json.dumps({"status": "ready", "pid": __import__("os").getpid()}, ensure_ascii=False) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            response = _error_result("Invalid JSON request")
            sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
            sys.stdout.flush()
            continue

        method = request.get("method", "")

        if method == "detect_base64":
            result = detect_from_base64(request["image_base64"])
        elif method == "detect_file":
            result = detect_from_file(request["file_path"])
        elif method == "shutdown":
            sys.stdout.write(json.dumps({"status": "shutting_down"}, ensure_ascii=False) + "\n")
            sys.stdout.flush()
            break
        else:
            result = _error_result(f"Unknown method: {method}")

        sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    if "--daemon" in sys.argv:
        run_daemon()
    else:
        result = _error_result("No input provided")
        args = sys.argv[1:]
        output_file = None

        if "--output-file" in args:
            output_index = args.index("--output-file")
            if output_index + 1 < len(args):
                output_file = args[output_index + 1]
                del args[output_index : output_index + 2]

        if len(args) >= 2:
            if args[0] == "--file":
                result = detect_from_file(args[1])
            elif args[0] == "--input-file":
                input_path = Path(args[1])
                image_base64 = input_path.read_text(encoding="utf-8").strip()
                result = detect_from_base64(image_base64)

        _write_result(result, output_file)
