import argparse
import base64
import json
from pathlib import Path

import cv2
import numpy as np

from pose_detect import detect_pose


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


def analyze_video(file_path: str, start_ms: int, end_ms: int, max_frames: int) -> dict:
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

        frames = []
        for frame_index in _sample_frame_indices(start_frame, end_frame, max(4, max_frames)):
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            success, frame = capture.read()
            if not success or frame is None:
                continue

            processed_frame = _resize_frame(frame)
            pose_result = detect_pose(processed_frame)
            if pose_result.get('error') or not pose_result.get('keypoints'):
                continue

            timestamp_ms = int(round(frame_index / fps * 1000.0))
            frames.append(
                {
                    'index': frame_index,
                    'timestamp_ms': timestamp_ms,
                    'image_data': _frame_to_data_url(processed_frame),
                    'keypoints': pose_result['keypoints'],
                    'width': pose_result['width'],
                    'height': pose_result['height'],
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

        return {
            'frames': frames,
            'width': width,
            'height': height,
            'fps': fps,
            'duration_ms': duration_ms,
            'trim_start_ms': trim_start_ms,
            'trim_end_ms': trim_end_ms,
            'total_frames': total_frames,
        }
    finally:
        capture.release()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', required=True)
    parser.add_argument('--start-ms', type=int, default=0)
    parser.add_argument('--end-ms', type=int, default=0)
    parser.add_argument('--max-frames', type=int, default=16)
    args = parser.parse_args()

    result = analyze_video(args.video, args.start_ms, args.end_ms, args.max_frames)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
