import argparse
import base64
import json
from pathlib import Path

import cv2
import numpy as np

from pose_detect import detect_pose, detect_poses, compute_torso_center


def _error_result(message: str) -> dict:
    return {
        "error": message,
        "frames": [],
        "width": 0,
        "height": 0,
        "fps": 0.0,
        "duration_ms": 0,
        "trim_start_ms": 0,
        "trim_end_ms": 0,
        "total_frames": 0,
    }


def _clamp_trim(duration_ms: int, start_ms: int, end_ms: int) -> tuple[int, int]:
    safe_start = max(0, min(start_ms, duration_ms))
    safe_end = max(safe_start, min(end_ms if end_ms > 0 else duration_ms, duration_ms))

    if safe_end <= safe_start:
        safe_end = min(duration_ms, safe_start + 800)

    return safe_start, max(safe_end, safe_start + 1)


def _resize_frame(frame: np.ndarray, max_edge: int = 960) -> np.ndarray:
    height, width = frame.shape[:2]
    longest_edge = max(width, height)
    if longest_edge <= max_edge:
        return frame

    scale = max_edge / float(longest_edge)
    resized_width = max(1, int(round(width * scale)))
    resized_height = max(1, int(round(height * scale)))
    return cv2.resize(frame, (resized_width, resized_height), interpolation=cv2.INTER_AREA)


def _frame_to_data_url(frame: np.ndarray) -> str:
    success, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        raise RuntimeError('Failed to encode video frame')

    payload = base64.b64encode(encoded.tobytes()).decode('utf-8')
    return f'data:image/jpeg;base64,{payload}'


def _sample_frame_indices(start_frame: int, end_frame: int, max_frames: int) -> list[int]:
    frame_span = max(1, end_frame - start_frame + 1)
    sample_count = min(max_frames, max(6, frame_span // max(1, frame_span // max_frames)))
    sample_count = min(sample_count, frame_span)

    if sample_count <= 1:
        return [start_frame]

    indices = np.linspace(start_frame, end_frame, num=sample_count, dtype=int)
    unique_indices: list[int] = []
    seen: set[int] = set()

    for index in indices.tolist():
        if index not in seen:
            unique_indices.append(index)
            seen.add(index)

    if end_frame not in seen:
        unique_indices.append(end_frame)

    return unique_indices


def _select_subject_by_index(poses: list[dict], subject_index: int) -> dict | None:
    if 0 <= subject_index < len(poses):
        return poses[subject_index]
    return None


def _select_subject_by_proximity(poses: list[dict], prev_cx: float, prev_cy: float, max_distance: float) -> dict | None:
    if not poses:
        return None

    best_pose = None
    best_dist = float('inf')
    for pose in poses:
        cx = pose.get('torso_cx', 0.0)
        cy = pose.get('torso_cy', 0.0)
        dist = ((cx - prev_cx) ** 2 + (cy - prev_cy) ** 2) ** 0.5
        if dist < best_dist:
            best_dist = dist
            best_pose = pose

    if best_dist > max_distance:
        return None

    return best_pose


def _auto_select_subject(poses: list[dict], image_width: int, image_height: int) -> int:
    if not poses:
        return 0

    if len(poses) == 1:
        return 0

    best_index = 0
    best_score = -1.0
    for i, pose in enumerate(poses):
        kps = pose.get('keypoints', [])
        visible_count = sum(1 for kp in kps if kp.get('visibility', 0) >= 0.4)
        torso_ids = {11, 12, 23, 24}
        torso_visible = sum(1 for kp in kps if kp.get('id') in torso_ids and kp.get('visibility', 0) >= 0.4)
        cx = pose.get('torso_cx', 0.0)
        cy = pose.get('torso_cy', 0.0)
        center_x = image_width / 2.0
        center_y = image_height * 0.4
        center_dist = ((cx - center_x) ** 2 + (cy - center_y) ** 2) ** 0.5
        max_dist = (image_width ** 2 + image_height ** 2) ** 0.5
        center_score = 1.0 - (center_dist / max_dist)
        score = visible_count * 0.3 + torso_visible * 2.0 + center_score * 5.0
        if score > best_score:
            best_score = score
            best_index = i

    return best_index


def analyze_video(file_path: str, start_ms: int, end_ms: int, max_frames: int, subject_pose_index: int | None = None) -> dict:
    video_path = Path(file_path)
    if not video_path.exists():
        return _error_result(f'Video file not found: {file_path}')

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        return _error_result(f'Failed to open video: {file_path}')

    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        if fps <= 0.0 or total_frames <= 0:
            return _error_result('Unable to read video metadata')

        duration_ms = int(round(total_frames / fps * 1000.0))
        trim_start_ms, trim_end_ms = _clamp_trim(duration_ms, start_ms, end_ms)
        start_frame = max(0, min(total_frames - 1, int(trim_start_ms / 1000.0 * fps)))
        end_frame = max(start_frame, min(total_frames - 1, int(trim_end_ms / 1000.0 * fps)))

        max_track_distance = max(width, height) * 0.35
        locked_subject_cx: float | None = None
        locked_subject_cy: float | None = None
        detected_pose_count = 0
        first_frame_multi_pose = None

        frames = []
        for frame_index in _sample_frame_indices(start_frame, end_frame, max(4, max_frames)):
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            success, frame = capture.read()
            if not success or frame is None:
                continue

            processed_frame = _resize_frame(frame)
            multi_result = detect_poses(processed_frame)
            poses = multi_result.get('poses', [])
            frame_w = multi_result.get('width', processed_frame.shape[1])
            frame_h = multi_result.get('height', processed_frame.shape[0])

            if not poses:
                continue

            if first_frame_multi_pose is None and len(poses) > 1:
                first_frame_multi_pose = {
                    'index': frame_index,
                    'image_data': _frame_to_data_url(processed_frame),
                    'poses': [
                        {
                            'pose_index': i,
                            'keypoints': p['keypoints'],
                            'torso_cx': p['torso_cx'],
                            'torso_cy': p['torso_cy'],
                        }
                        for i, p in enumerate(poses)
                    ],
                    'width': frame_w,
                    'height': frame_h,
                }

            selected_pose = None

            if locked_subject_cx is not None and locked_subject_cy is not None:
                selected_pose = _select_subject_by_proximity(
                    poses, locked_subject_cx, locked_subject_cy, max_track_distance
                )

            if selected_pose is None and subject_pose_index is not None:
                selected_pose = _select_subject_by_index(poses, subject_pose_index)
                if selected_pose and locked_subject_cx is None:
                    locked_subject_cx = selected_pose['torso_cx']
                    locked_subject_cy = selected_pose['torso_cy']

            if selected_pose is None and locked_subject_cx is None:
                auto_index = _auto_select_subject(poses, frame_w, frame_h)
                selected_pose = poses[auto_index] if auto_index < len(poses) else poses[0]
                locked_subject_cx = selected_pose['torso_cx']
                locked_subject_cy = selected_pose['torso_cy']

            if selected_pose is None:
                continue

            locked_subject_cx = selected_pose['torso_cx']
            locked_subject_cy = selected_pose['torso_cy']
            detected_pose_count = max(detected_pose_count, len(poses))

            timestamp_ms = int(round(frame_index / fps * 1000.0))
            frames.append(
                {
                    'index': frame_index,
                    'timestamp_ms': timestamp_ms,
                    'image_data': _frame_to_data_url(processed_frame),
                    'keypoints': selected_pose['keypoints'],
                    'width': frame_w,
                    'height': frame_h,
                }
            )

        if not frames:
            return {
                'error': 'No usable pose frames detected in the selected clip',
                'frames': [],
                'width': width,
                'height': height,
                'fps': fps,
                'duration_ms': duration_ms,
                'trim_start_ms': trim_start_ms,
                'trim_end_ms': trim_end_ms,
                'total_frames': total_frames,
            }

        result = {
            'frames': frames,
            'width': width,
            'height': height,
            'fps': fps,
            'duration_ms': duration_ms,
            'trim_start_ms': trim_start_ms,
            'trim_end_ms': trim_end_ms,
            'total_frames': total_frames,
            'detected_pose_count': detected_pose_count,
        }

        if first_frame_multi_pose is not None:
            result['first_frame_multi_pose'] = first_frame_multi_pose

        return result
    finally:
        capture.release()


def _write_result(result: dict, output_file: str | None) -> None:
    payload = json.dumps(result, ensure_ascii=False)
    if output_file:
        Path(output_file).write_text(payload, encoding='utf-8')
        return

    print(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', required=True)
    parser.add_argument('--start-ms', type=int, default=0)
    parser.add_argument('--end-ms', type=int, default=0)
    parser.add_argument('--max-frames', type=int, default=16)
    parser.add_argument('--subject-pose-index', type=int, default=None)
    parser.add_argument('--output-file')
    args = parser.parse_args()

    result = analyze_video(args.video, args.start_ms, args.end_ms, args.max_frames, args.subject_pose_index)
    _write_result(result, args.output_file)


if __name__ == '__main__':
    main()
