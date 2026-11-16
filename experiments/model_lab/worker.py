"""One model per process; fail closed if the requested model/provider is unavailable."""
import argparse
import importlib.metadata
import os
import sys
import time
from pathlib import Path
from common import read, write, sha, map_coco, choose_person, angles
from timing import instrument, measured, TIMING_SCOPE

ROOT = Path(__file__).resolve().parents[2]


def require_provider(providers, device):
    required = 'CUDAExecutionProvider' if device == 'cuda' else 'CPUExecutionProvider'
    if not providers or any(required not in v for v in providers.values()):
        raise RuntimeError(f'Requested {required}, actual {providers}; refusing silent fallback')


def rtm_predictor(models_path, device, io_mode='standard'):
    import onnxruntime as ort
    from rtmlib import RTMPose, YOLOX
    dll_handles = []
    if device == 'cuda':
        # cuDNN loads engine sublibraries lazily; ORT only preloads its core DLLs.
        # Keep the search path local to this experiment process, never global PATH.
        if os.name == 'nt':
            bins = sorted((Path(sys.prefix) / 'Lib/site-packages/nvidia').glob('*/bin'))
            os.environ['PATH'] = os.pathsep.join(map(str, bins)) + os.pathsep + os.environ.get('PATH', '')
            dll_handles = [os.add_dll_directory(str(path)) for path in bins]
        ort.preload_dlls()
    metadata = read(models_path)
    paths = {}
    for name, info in metadata['models'].items():
        path = models_path.parent / info['path']
        if sha(path) != info['sha256']:
            raise ValueError(f'{name} model checksum mismatch')
        paths[name] = str(path)
    det = YOLOX(paths['det'], model_input_size=(640, 640), backend='onnxruntime', device=device)
    pose = RTMPose(paths['pose'], model_input_size=(192, 256), to_openpose=False,
                   backend='onnxruntime', device=device)
    providers = {name: model.session.get_providers() for name, model in [('det', det), ('pose', pose)]}
    require_provider(providers, device)
    for model in (det, pose):
        model.session.disable_fallback()
    if io_mode == 'bound' and device != 'cuda':
        raise ValueError('Bound transfer diagnostic requires CUDA')
    timings = {}
    instrument(det, 'det', timings, io_mode)
    instrument(pose, 'pose', timings, io_mode)

    def predict(image):
        timings.clear()
        bboxes = measured(timings, 'det.total_ms', det, image)
        timings['det.people'] = len(bboxes)
        if len(bboxes) == 0:
            return [], dict(timings)  # Never use RTMPose's full-frame fallback.
        points, scores = measured(timings, 'pose.total_ms', pose, image, bboxes=bboxes)
        people = measured(timings, 'mapping_ms', lambda: [map_coco(p, s) for p, s in zip(points, scores)])
        return people, dict(timings)
    def close():
        for handle in dll_handles:
            handle.close()
    return predict, dict(metadata, providers=providers, confidence_type='raw_simcc_score'), close


def heavy_predictor():
    import mediapipe as mp
    import cv2
    sys.path.insert(0, str(ROOT / 'scripts'))
    from pose_detect import create_task_detector
    detector, info = create_task_detector(ROOT / 'models/pose_landmarker_heavy.task')
    if info['sha256'] != read(ROOT / 'models/manifest.json')['heavy']['sha256']:
        detector.close()
        raise ValueError('Heavy hash differs from baseline manifest')

    def predict(image):
        timings = {}
        rgb = measured(timings, 'rgb_ms', cv2.cvtColor, image, cv2.COLOR_BGR2RGB)
        result = measured(timings, 'detect_and_pose_ms', detector.detect,
                          mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        h, w = image.shape[:2]
        people = measured(timings, 'mapping_ms', lambda: [{str(i): {'x': p.x * w, 'y': p.y * h, 'score': p.visibility,
                         'z': None, 'native_z': p.z, 'source_id': i}
                 for i, p in enumerate(person)} for person in result.pose_landmarks])
        return people, timings
    return predict, dict(info, providers=['MediaPipe Tasks CPU'], confidence_type='visibility'), detector.close


def main(a):
    import cv2
    import numpy as np
    dataset = read(a.dataset)
    frames = dataset['frames']
    loaded = time.perf_counter()
    if a.backend == 'heavy':
        if a.device != 'cpu' or a.io_mode != 'standard':
            raise ValueError('Current Windows Heavy baseline is CPU; no GPU claim supported')
        predict, info, close = heavy_predictor()
    else:
        predict, info, close = rtm_predictor(a.models, a.device, a.io_mode)
    load_ms = (time.perf_counter() - loaded) * 1000
    rows = []
    try:
        for repeat in range(a.repeats):
            for frame in frames:
                path = a.dataset.parent / frame['image']
                if sha(path) != frame['sha256']:
                    raise ValueError('Frame checksum mismatch: ' + frame['id'])
                started = time.perf_counter()
                stages = {}
                image = measured(stages, 'png_read_decode_ms',
                                 lambda: cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR))
                if image is None or list(image.shape[:2]) != [frame['height'], frame['width']]:
                    raise ValueError('Frame dimensions changed')
                people, model_stages = predict(image)
                stages.update(model_stages)
                selected, reason = measured(stages, 'selection_ms', choose_person, people, frame.get('target_bbox'))
                computed = measured(stages, 'angles_ms', angles, selected or {})
                elapsed = (time.perf_counter() - started) * 1000
                rows.append({'frame_id': frame['id'], 'sha256': frame['sha256'], 'repeat': repeat,
                             'person_count': len(people), 'selection_reason': reason,
                             # Preserve every mapped raw prediction even when target selection fails.
                             # These are model outputs, never human labels or cross-frame track IDs.
                             'people': people,
                             'selected_person_index': next((i for i, p in enumerate(people)
                                                            if p is selected), None),
                             'points': selected or {}, 'angles': computed, 'pipeline_ms': elapsed,
                             'stages': stages})
    finally:
        close()
    packages = {}
    for name in ('mediapipe', 'rtmlib', 'onnxruntime-gpu', 'numpy', 'opencv-contrib-python'):
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            pass
    write(a.output, {'schema': 'shotform-model-lab-v1', 'backend': a.backend, 'device': a.device,
                    'dataset_sha256': sha(a.dataset), 'model': info, 'packages': packages,
                    'load_ms': load_ms, 'repeats': a.repeats, 'io_mode': a.io_mode,
                    'timing_scope': TIMING_SCOPE, 'rows': rows})


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--dataset', type=Path, required=True)
    p.add_argument('--backend', choices=['heavy', 'rtmpose'], required=True)
    p.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    p.add_argument('--models', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--repeats', type=int, default=3)
    p.add_argument('--io-mode', choices=['standard', 'bound'], default='standard')
    args = p.parse_args()
    if args.repeats < 1:
        p.error('repeats must be positive')
    main(args)
