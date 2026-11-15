"""Experimental 2D contract. Never serialized as production PoseData or SQLite history."""
import hashlib
import json
import math
from pathlib import Path

COCO_TO_MP = dict(enumerate([0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]))
TRIPLES = {
    'left_shoulder': (23, 11, 13), 'right_shoulder': (24, 12, 14),
    'left_elbow': (11, 13, 15), 'right_elbow': (12, 14, 16),
    'left_hip': (11, 23, 25), 'right_hip': (12, 24, 26),
    'left_knee': (23, 25, 27), 'right_knee': (24, 26, 28),
}


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write(path, value):
    with Path(path).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)


def map_coco(points, scores):
    if len(points) not in (17, 133) or len(scores) != len(points):
        raise ValueError('Expected COCO17 or COCO-WholeBody133, to_openpose=False')
    mapped = {}
    for source, target in COCO_TO_MP.items():
        x, y, score = float(points[source][0]), float(points[source][1]), float(scores[source])
        if all(math.isfinite(v) for v in (x, y, score)):
            mapped[str(target)] = {'x': x, 'y': y, 'score': score, 'z': None,
                                   'source_id': source}
    return mapped


def angle(points, ids, threshold=None):
    try:
        selected = [points[str(i)] for i in ids]
        if not all(math.isfinite(p[k]) for p in selected for k in ('x', 'y')):
            return None, 'nonfinite'
        if threshold is not None and any(not math.isfinite(p.get('score', float('nan')))
                                         or p['score'] < threshold for p in selected):
            return None, 'low_confidence'
        a, b, c = selected
        ux, uy = a['x'] - b['x'], a['y'] - b['y']
        vx, vy = c['x'] - b['x'], c['y'] - b['y']
        norm = math.hypot(ux, uy) * math.hypot(vx, vy)
        if norm == 0:
            return None, 'degenerate'
        return math.degrees(math.acos(max(-1, min(1, (ux * vx + uy * vy) / norm)))), None
    except (KeyError, TypeError):
        return None, 'missing_point'


def angles(points, threshold=0.55):
    return {name: dict(zip(('degrees', 'reason'), angle(points, ids, threshold)))
            for name, ids in TRIPLES.items()}


def choose_person(people, target_bbox=None):
    # For multiple people require a manually defined target, never silently switch identities.
    if not people:
        return None, 'no_detection'
    if target_bbox is None:
        return (people[0], None) if len(people) == 1 else (None, 'ambiguous_multiple_people')
    x1, y1, x2, y2 = target_bbox
    if not x1 < x2 or not y1 < y2:
        raise ValueError('Invalid target_bbox')
    matches = []
    for person in people:
        torso = [person[str(i)] for i in (11, 12, 23, 24) if str(i) in person]
        if len(torso) == 4:
            cx = sum(p['x'] for p in torso) / 4
            cy = sum(p['y'] for p in torso) / 4
            if x1 <= cx <= x2 and y1 <= cy <= y2:
                matches.append(person)
    return (matches[0], None) if len(matches) == 1 else (None, 'target_unmatched_or_ambiguous')
