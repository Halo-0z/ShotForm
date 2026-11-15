"""Decode once into immutable PNG frames, independent of any pose model."""
import argparse
import time
from pathlib import Path
import cv2
import numpy as np
from common import read, write, sha


def prepare(manifest, output, stride=3, maximum=60):
    started = time.perf_counter()
    samples = read(manifest)['samples']
    if not samples or stride < 1 or maximum < 1:
        raise ValueError('Need real samples and positive stride/max-frames')
    ids = [s['id'] for s in samples]
    if len(set(ids)) != len(ids) or any(not i or not all(c.isalnum() or c in '-_' for c in i) for i in ids):
        raise ValueError('Unique safe sample IDs required')
    output.mkdir(parents=True, exist_ok=False)
    records = []
    for sample in samples:
        if not sample.get('source') or sample.get('kind') not in ('image', 'video'):
            raise ValueError('Every sample needs source and kind')
        path = (manifest.resolve().parent / sample['path']).resolve()
        digest = sha(path)
        frames = []
        if sample['kind'] == 'image':
            frames = [(0, 0, cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR))]
        else:
            cap = cv2.VideoCapture(str(path))
            try:
                fps = cap.get(cv2.CAP_PROP_FPS)
                if not cap.isOpened() or fps <= 0:
                    raise ValueError(f'Cannot decode {path}')
                index = 0
                while len(frames) < maximum:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    ms = index * 1000 / fps
                    if sample.get('end_ms', 0) > 0 and ms > sample['end_ms']:
                        break
                    if ms >= sample.get('start_ms', 0) and index % stride == 0:
                        frames.append((index, ms, frame))
                    index += 1
            finally:
                cap.release()
        if not frames:
            raise ValueError(f'No frames: {path}')
        for index, ms, frame in frames:
            if frame is None:
                raise ValueError(f'Invalid image: {path}')
            name = f"{sample['id']}-{index:06d}"
            destination = output / f'{name}.png'
            cv2.imencode('.png', frame)[1].tofile(destination)
            records.append({'id': name, 'sample_id': sample['id'], 'kind': sample['kind'],
                            'source_sha256': digest, 'source': sample['source'],
                            'condition': sample.get('condition', ''), 'frame_index': index,
                            'timestamp_ms': ms, 'image': destination.name, 'sha256': sha(destination),
                            'width': frame.shape[1], 'height': frame.shape[0],
                            'subject_present': None, 'target_bbox': None,
                            'manual_keypoints': {}, 'annotator': '', 'occlusion': 'unlabeled',
                            'notes': ''})
    write(output / 'dataset.json', {'schema': 'shotform-model-lab-v1',
          'purpose': read(manifest).get('purpose', 'Unspecified; not assumed research data'),
          'stride': stride, 'preparation_wall_s': time.perf_counter() - started,
          'preparation_scope': 'source hashing + video/image decode + sampled PNG encoding + frame hashing',
          'frames': records})
    return len(records)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('manifest', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--stride', type=int, default=3)
    p.add_argument('--max-frames', type=int, default=60)
    a = p.parse_args()
    print(prepare(a.manifest, a.output, a.stride, a.max_frames))
