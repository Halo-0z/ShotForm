"""Build an offline human annotation page; import only reviewed, validated label fields."""
import argparse
import base64
import copy
import json
import math
from pathlib import Path
from common import read, write, sha, TRIPLES

POINT_IDS = {str(i) for ids in TRIPLES.values() for i in ids}
FIELDS = ('subject_present', 'target_bbox', 'manual_keypoints', 'annotator', 'occlusion', 'notes', 'reviewed_at')


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_frame(frame):
    w, h = frame['width'], frame['height']
    present = frame.get('subject_present')
    if present is not None and not isinstance(present, bool):
        raise ValueError('subject_present must be boolean or null')
    for key in ('annotator', 'occlusion', 'notes'):
        if not isinstance(frame.get(key, ''), str):
            raise ValueError(f'{key} must be text')
    bbox = frame.get('target_bbox')
    if bbox is not None and (not isinstance(bbox, list) or len(bbox) != 4 or not all(map(finite, bbox))
                            or not 0 <= bbox[0] < bbox[2] <= w or not 0 <= bbox[1] < bbox[3] <= h):
        raise ValueError('Invalid or out-of-image target box')
    points = frame.get('manual_keypoints', {})
    if not isinstance(points, dict) or not set(points) <= POINT_IDS:
        raise ValueError('Unknown keypoint IDs')
    for point in points.values():
        if not isinstance(point, dict) or point.get('state') not in ('visible', 'occluded', 'unknown'):
            raise ValueError('Invalid point state')
        if point['state'] == 'unknown':
            if point.get('x') is not None or point.get('y') is not None:
                raise ValueError('Unknown points must not contain guessed coordinates')
        elif not all(finite(point.get(k)) for k in ('x', 'y')) or not 0 <= point['x'] <= w or not 0 <= point['y'] <= h:
            raise ValueError('Invalid or out-of-image coordinates')
    reviewed = frame.get('reviewed_at')
    if reviewed:
        from datetime import datetime
        if not isinstance(reviewed, str):
            raise ValueError('Review timestamp must be ISO text')
        datetime.fromisoformat(reviewed.replace('Z', '+00:00'))
        if not frame.get('annotator', '').strip() or present is None:
            raise ValueError('Reviewed frames need annotator and presence decision')
        if present and (bbox is None or set(points) != POINT_IDS or frame.get('occlusion') not in
                        ('clear', 'arm_occluded', 'leg_occluded', 'both_occluded', 'other')):
            raise ValueError('Reviewed target needs box, occlusion group and all 12 point states')
        if present is False and (bbox is not None or points):
            raise ValueError('Absent target cannot carry a box or joint labels')


def merge_labels(base, incoming):
    result = copy.deepcopy(base)
    if incoming.get('schema') != base['schema'] or len(incoming.get('frames', [])) != len(base['frames']):
        raise ValueError('Different dataset')
    for original, updated, target in zip(base['frames'], incoming['frames'], result['frames']):
        immutable = set(original) - set(FIELDS)
        if any(updated.get(k) != original.get(k) for k in immutable):
            raise ValueError('Frame identity, provenance or order changed')
        for key in FIELDS:
            if key in updated:
                target[key] = copy.deepcopy(updated[key])
        validate_frame(target)
    result['annotation_review_required'] = True
    result['annotation_protocol'] = 'human-point-click-v1; no model prefill; explicit per-frame review'
    return result


def build(dataset_path, output, target_description=''):
    data = read(dataset_path)
    if not data['frames']:
        raise ValueError('Empty dataset')
    images = []
    for frame in data['frames']:
        validate_frame(frame)
        path = dataset_path.parent / frame['image']
        if sha(path) != frame['sha256']:
            raise ValueError('Image hash mismatch: ' + frame['id'])
        images.append('data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode('ascii'))
    payload = json.dumps({'dataset': data, 'images': images, 'target_description': target_description},
                         ensure_ascii=False, allow_nan=False).replace('<', '\\u003c')
    template = Path(__file__).with_name('annotator.html').read_text(encoding='utf-8')
    with output.open('x', encoding='utf-8') as stream:
        stream.write(template.replace('/*__PAYLOAD__*/', payload))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('dataset', type=Path)
    p.add_argument('--html', type=Path)
    p.add_argument('--import-labels', type=Path)
    p.add_argument('--output', type=Path)
    p.add_argument('--target-description', default='', help='Task instructions only; never fills manual presence/box/points')
    a = p.parse_args()
    if a.html and not a.import_labels:
        build(a.dataset, a.html, a.target_description)
    elif a.import_labels and a.output and not a.html:
        # Keep PNG references valid even if the downloaded JSON came from Downloads.
        if a.output.resolve().parent != a.dataset.resolve().parent:
            p.error('Save the merged dataset beside the original PNGs')
        merged = merge_labels(read(a.dataset), read(a.import_labels))
        for frame in merged['frames']:
            if sha(a.dataset.parent / frame['image']) != frame['sha256']:
                raise ValueError('Frame hash mismatch')
        write(a.output, merged)
        print('Reviewed frames:', sum(bool(f.get('reviewed_at')) for f in merged['frames']))
    else:
        p.error('Use --html OR --import-labels with --output')
