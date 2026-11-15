"""Real CUDA diagnostic parity check, all detected people (not only selected targets)."""
import argparse
import math
from pathlib import Path
import cv2
import numpy as np
from common import read, write, sha
from worker import rtm_predictor


def check(dataset_path, models_path):
    dataset = read(dataset_path)
    predictions, model_metadata = {}, {}
    for mode in ('standard', 'bound'):
        predict, info, close = rtm_predictor(models_path, 'cuda', mode)
        model_metadata[mode] = info
        try:
            predictions[mode] = []
            for frame in dataset['frames']:
                path = dataset_path.parent / frame['image']
                if sha(path) != frame['sha256']:
                    raise ValueError('Frame checksum mismatch')
                image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
                people, _ = predict(image)
                predictions[mode].append(people)
        finally:
            close()
            del predict
    pixels, scores, count = [], [], 0
    for standard, bound in zip(predictions['standard'], predictions['bound']):
        if len(standard) != len(bound):
            raise ValueError('Person count changed between execution modes')
        for left, right in zip(standard, bound):
            count += 1
            if left.keys() != right.keys():
                raise ValueError('Keypoint presence changed between execution modes')
            for key in left:
                pixels.extend(abs(left[key][axis] - right[key][axis]) for axis in ('x', 'y'))
                scores.append(abs(left[key]['score'] - right[key]['score']))
    if not pixels or not all(math.isfinite(x) for x in pixels + scores):
        raise ValueError('No finite detections to verify')
    # Predeclared near-equality tolerances, not labels or an accuracy test.
    result = {'dataset_sha256': sha(dataset_path), 'model_manifest_sha256': sha(models_path),
              'frames': len(dataset['frames']), 'compared_people': count,
              'pixel_tolerance': .01, 'score_tolerance': .00001,
              'max_coordinate_difference_pixels': max(pixels), 'max_score_difference': max(scores),
              'passed': max(pixels) <= .01 and max(scores) <= .00001,
              'model_metadata': model_metadata,
              'scope': 'same ordered detections for all people; execution-mode parity only, no human accuracy claim'}
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('dataset', type=Path)
    p.add_argument('--models', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    result = check(a.dataset, a.models)
    write(a.output, result)
    print({k: v for k, v in result.items() if k != 'model_metadata'})
    raise SystemExit(0 if result['passed'] else 1)
