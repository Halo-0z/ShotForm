"""Paired geometric errors and labeled temporal residuals; absent truth stays null."""
import argparse
from collections import Counter
import math
from pathlib import Path
import statistics
from itertools import combinations
from common import read, write, sha, angle, TRIPLES


def summary(values):
    values = sorted(values)
    return {'n': len(values), 'mean': statistics.mean(values) if values else None,
            'median': statistics.median(values) if values else None,
            'p95': values[max(0, math.ceil(len(values) * .95) - 1)] if values else None}


def truth(frame, ids, review_required=False):
    points = frame.get('manual_keypoints', {})
    if not frame.get('annotator', '').strip() or frame.get('subject_present') is not True or (review_required and not frame.get('reviewed_at')):
        return None
    # Occluded but confidently human-labeled points are allowed; unknown is excluded.
    if any(points.get(str(i), {}).get('state') not in ('visible', 'occluded') for i in ids):
        return None
    return angle(points, ids)[0]


def evaluate(dataset, predictions):
    frames = {f['id']: f for f in dataset['frames']}
    if len(frames) != len(dataset['frames']):
        raise ValueError('Duplicate frame ID')
    report, accepted_errors = {}, {}
    review_required = dataset.get('annotation_review_required', False)
    temporal_enabled = dataset.get('temporal_labels_confirmed') is True
    def reviewed(frame):
        return bool(frame.get('annotator', '').strip()) and (not review_required or bool(frame.get('reviewed_at')))
    for name, prediction in predictions.items():
        rows = [r for r in prediction['rows'] if r['repeat'] == 0]
        indexed = {r['frame_id']: r for r in rows}
        if set(indexed) != set(frames) or len(indexed) != len(rows):
            raise ValueError('Frame set mismatch')
        if any(r['sha256'] != frames[r['frame_id']]['sha256'] for r in rows):
            raise ValueError('Frame hash mismatch')
        errors, skips, occlusion_errors = {}, Counter(), {}
        accepted_errors[name] = {}
        for joint, ids in TRIPLES.items():
            all_errors, accepted = [], []
            residuals = {}
            labeled_count, joint_skips, groups = 0, Counter(), {}
            for frame_id, frame in frames.items():
                expected = truth(frame, ids, review_required)
                points = indexed[frame_id]['points']
                raw, raw_reason = angle(points, ids)
                valid, reason = angle(points, ids, .55)
                if expected is None:
                    skips['unlabeled_or_uncertain'] += 1
                    continue
                labeled_count += 1
                group = groups.setdefault(frame.get('occlusion', 'unlabeled'), {'labeled_angles': 0, 'accepted_angles': 0})
                group['labeled_angles'] += 1
                if raw is not None:
                    all_errors.append(abs(raw - expected))
                if valid is None:
                    skips[reason or raw_reason or 'missing'] += 1
                    joint_skips[reason or raw_reason or 'missing'] += 1
                    continue
                error = abs(valid - expected)
                accepted.append(error)
                group['accepted_angles'] += 1
                accepted_errors[name][(frame_id, joint)] = error
                occlusion_errors.setdefault(frame.get('occlusion', 'unlabeled'), []).append(error)
                residuals[frame_id] = valid - expected
            # Explicitly confirmed dense labels only; sparse trial frames are not a jitter sequence.
            temporal = []
            for sample_id in ({f['sample_id'] for f in frames.values() if f['kind'] == 'video'} if temporal_enabled else set()):
                sequence = sorted([f for f in frames.values() if f['sample_id'] == sample_id],
                                  key=lambda f: f['timestamp_ms'])
                for before, after in zip(sequence, sequence[1:]):
                    dt = (after['timestamp_ms'] - before['timestamp_ms']) / 1000
                    consecutive = (isinstance(before.get('frame_index'), int)
                                   and after.get('frame_index') == before['frame_index'] + 1)
                    if consecutive and dt > 0 and before['id'] in residuals and after['id'] in residuals:
                        temporal.append(abs(residuals[after['id']] - residuals[before['id']]) / dt)
            errors[joint] = {'all_finite_mae_degrees': summary(all_errors),
                             'accepted_mae_degrees': summary(accepted),
                             'labeled_angles': labeled_count, 'accepted_angles': len(accepted),
                             'coverage': len(accepted) / labeled_count if labeled_count else None,
                             'rejected_reasons': dict(joint_skips), 'coverage_by_occlusion': groups,
                             'temporal_status': 'confirmed_dense_labels' if temporal_enabled else 'not_enabled_without_confirmed_dense_labels',
                             'temporal_residual_change_deg_per_s': summary(temporal)}
        labeled = [f for f in frames.values() if f.get('subject_present') is True and reviewed(f)]
        absent = [f for f in frames.values() if f.get('subject_present') is False and reviewed(f)]
        missing = sum(not indexed[f['id']]['points'] for f in labeled)
        unavailable_reasons = Counter(indexed[f['id']]['selection_reason'] or 'missing_selected_points'
                                      for f in labeled if not indexed[f['id']]['points'])
        occlusion_coverage = {}
        for group in {f.get('occlusion', 'unlabeled') for f in labeled}:
            subset = [f for f in labeled if f.get('occlusion', 'unlabeled') == group]
            occlusion_coverage[group] = {'labeled_present': len(subset),
                'target_unavailable_frames': sum(not indexed[f['id']]['points'] for f in subset)}
        report[name] = {'frames': len(rows), 'selected_frames': sum(bool(r['points']) for r in rows),
                        'selection_failures': dict(Counter(r['selection_reason'] for r in rows if r['selection_reason'])),
                        'annotated_present_frames': len(labeled),
                        'target_unavailable_frames': missing if labeled else None,
                        'target_unavailable_rate': missing / len(labeled) if labeled else None,
                        'target_unavailable_reasons': dict(unavailable_reasons),
                        'no_detection_frames': unavailable_reasons.get('no_detection', 0) if labeled else None,
                        'ambiguous_target_frames': (unavailable_reasons.get('ambiguous_multiple_people', 0)
                                                    + unavailable_reasons.get('target_unmatched_or_ambiguous', 0)) if labeled else None,
                        'miss_rate': None,
                        'miss_rate_status': 'not_inferred_from_selection_failure; review identity and distinguish no detection from ambiguity',
                        'annotated_absent_frames': len(absent),
                        'false_positive_frames': sum(indexed[f['id']]['person_count'] > 0 for f in absent) if absent else None,
                        'angles': errors, 'skips': dict(skips),
                        'occlusion_accepted_error': {k: summary(v) for k, v in occlusion_errors.items()},
                        'occlusion_coverage': occlusion_coverage,
                        'pipeline_ms_first_pass': summary([r['pipeline_ms'] for r in rows]),
                        'pipeline_ms_warm_passes': summary([r['pipeline_ms'] for r in prediction['rows'] if r['repeat'] > 0])}
    common = set.intersection(*(set(r) for r in accepted_errors.values())) if len(accepted_errors) >= 2 else set()
    pairs = []
    for left, right in combinations(accepted_errors, 2):
        shared = accepted_errors[left].keys() & accepted_errors[right].keys()
        by_joint = {}
        for joint in TRIPLES:
            truth_n = report[left]['angles'][joint]['labeled_angles']
            common_joint = {k for k in shared if k[1] == joint}
            counts = {n: report[n]['angles'][joint]['accepted_angles'] for n in (left, right)}
            by_joint[joint] = {
                'human_definable_n': truth_n, 'model_valid_n': counts,
                'model_failed_n': {n: truth_n - count for n, count in counts.items()},
                'model_coverage': {n: count / truth_n if truth_n else None for n, count in counts.items()},
                'model_failure_reasons': {n: report[n]['angles'][joint]['rejected_reasons'] for n in (left, right)},
                'common_valid_n': len(common_joint),
                'common_coverage': len(common_joint) / truth_n if truth_n else None,
                'each_model_mae_p95_degrees': {n: report[n]['angles'][joint]['accepted_mae_degrees'] for n in (left, right)},
                'paired_mae_p95_degrees': {n: summary([accepted_errors[n][k] for k in common_joint]) for n in (left, right)},
            }
        pairs.append({'models': [left, right], 'common_angles': len(shared),
                      'by_joint': by_joint,
                      'mae_degrees': {n: summary([accepted_errors[n][k] for k in shared]) for n in (left, right)},
                      'right_minus_left_absolute_error_degrees': summary([
                          accepted_errors[right][k] - accepted_errors[left][k] for k in shared])})
    return {'models': report, 'paired_common_angles': len(common),
            'pairwise': pairs,
            'paired_mae_degrees': {name: summary([values[k] for k in common]) for name, values in accepted_errors.items()},
            'paired_by_joint': {joint: {name: summary([values[k] for k in common if k[1] == joint])
                               for name, values in accepted_errors.items()} for joint in TRIPLES},
            'decision': 'No automatic model switch; require labeled paired results and target-machine acceptance',
            'temporal_definition': 'Only when temporal_labels_confirmed=true and source frame indices differ by exactly one: mean absolute adjacent residual change/dt; sparse/unreviewed/missing labels never imply jitter'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('run', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    dataset_path = a.run / 'dataset.json'
    dataset = read(dataset_path)
    runs = read(a.run / 'run.json')
    if sha(dataset_path) != runs['dataset_sha256']:
        raise ValueError('Run dataset/annotations changed; rerun with the revised dataset')
    predictions = {}
    for name, status in runs['runs'].items():
        if status['exit_code'] == 0 and status['error'] is None:
            prediction = read(a.run / name / 'predictions.json')
            # Dataset copy is byte-identical to the frozen input, including annotations.
            if prediction['dataset_sha256'] != runs['dataset_sha256']:
                raise ValueError('Dataset version mismatch')
            predictions[name] = prediction
    result = evaluate(dataset, predictions)
    result['failed_runs'] = {n: r for n, r in runs['runs'].items() if r['exit_code'] or r['error']}
    write(a.output, result)
