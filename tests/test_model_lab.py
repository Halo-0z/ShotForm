import copy
import sys
import unittest
import tempfile
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'experiments/model_lab'))
from common import map_coco, angles, angle, choose_person
from evaluate import evaluate
from prepare import prepare
from worker import require_provider


class ModelLabTests(unittest.TestCase):
    def test_cuda_requires_both_detector_and_pose_on_requested_provider(self):
        with self.assertRaises(RuntimeError):
            require_provider({'det': ['CUDAExecutionProvider'], 'pose': ['CPUExecutionProvider']}, 'cuda')
        require_provider({'det': ['CUDAExecutionProvider', 'CPUExecutionProvider'],
                          'pose': ['CUDAExecutionProvider', 'CPUExecutionProvider']}, 'cuda')

    def test_mapping_preserves_pixels_confidence_and_missing_depth(self):
        points = [[i * 20, i * 10] for i in range(17)]
        mapped = map_coco(points, [.1] * 17)
        self.assertEqual(mapped['23']['x'], 220)
        self.assertEqual(mapped['23']['score'], .1)
        self.assertIsNone(mapped['23']['z'])
        self.assertNotIn('31', mapped)
        self.assertEqual(angles(mapped)['left_knee']['reason'], 'low_confidence')

    def test_wrong_skeleton_rejected_nonfinite_point_omitted(self):
        with self.assertRaises(ValueError):
            map_coco([[0, 1]] * 26, [1] * 26)
        points = [[1, 2] for _ in range(17)]
        points[5][0] = float('nan')
        self.assertNotIn('11', map_coco(points, [1] * 17))

    def test_angle_threshold_and_geometry(self):
        points = {str(i): dict(x=x, y=y, score=.55) for i, x, y in [(11, 0, 1), (13, 0, 0), (15, 1, 0)]}
        self.assertEqual(angle(points, (11, 13, 15), .55)[0], 90)
        points['11']['score'] = .1
        self.assertEqual(angle(points, (11, 13, 15), .55)[1], 'low_confidence')
        self.assertEqual(angle(points, (11, 13, 15))[0], 90)
        points['15'] = points['13']
        self.assertEqual(angle(points, (11, 13, 15))[1], 'degenerate')

    def test_multiple_people_are_not_silently_assigned(self):
        p = {str(i): {'x': 5, 'y': 5} for i in (11, 12, 23, 24)}
        q = {str(i): {'x': 50, 'y': 50} for i in (11, 12, 23, 24)}
        self.assertIsNone(choose_person([p, q])[0])
        self.assertEqual(choose_person([p, q], [0, 0, 10, 10])[0], p)
        self.assertEqual(choose_person([])[1], 'no_detection')

    def fixture(self):
        points = {str(i): {'x': x, 'y': y, 'score': 1, 'state': 'visible'}
                  for i, x, y in [(11, 0, 1), (13, 0, 0), (15, 1, 0)]}
        frame = {'id': 'f', 'sample_id': 's', 'kind': 'image', 'sha256': 'hash',
                 'manual_keypoints': points, 'subject_present': True, 'annotator': 'unit-test-synthetic',
                 'timestamp_ms': 0, 'occlusion': 'clear'}
        row = {'frame_id': 'f', 'sha256': 'hash', 'repeat': 0, 'points': points,
               'person_count': 1, 'selection_reason': None, 'pipeline_ms': 1}
        return {'frames': [frame]}, {'a': {'rows': [row]}, 'b': {'rows': [copy.deepcopy(row)]}}

    def test_missing_labels_remain_null(self):
        dataset, predictions = self.fixture()
        dataset['frames'][0]['annotator'] = ''
        dataset['frames'][0]['subject_present'] = None
        result = evaluate(dataset, predictions)
        self.assertIsNone(result['models']['a']['miss_rate'])
        self.assertIsNone(result['paired_mae_degrees']['a']['mean'])

    def test_paired_errors_exclude_low_confidence_not_zero_fill(self):
        dataset, predictions = self.fixture()
        self.assertEqual(evaluate(dataset, predictions)['paired_common_angles'], 1)
        predictions['b']['rows'][0]['points']['11']['score'] = .1
        result = evaluate(dataset, predictions)
        self.assertEqual(result['paired_common_angles'], 0)
        self.assertEqual(result['models']['b']['angles']['left_elbow']['all_finite_mae_degrees']['n'], 1)
        self.assertEqual(result['models']['b']['angles']['left_elbow']['coverage'], 0)
        self.assertEqual(result['models']['a']['angles']['left_elbow']['coverage'], 1)

    def test_pairwise_remains_available_when_third_model_has_no_valid_angles(self):
        dataset, predictions = self.fixture()
        predictions['c'] = copy.deepcopy(predictions['a'])
        predictions['c']['rows'][0]['points'] = {}
        result = evaluate(dataset, predictions)
        self.assertEqual(result['paired_common_angles'], 0)
        self.assertEqual(result['pairwise'][0]['models'], ['a', 'b'])
        self.assertEqual(result['pairwise'][0]['common_angles'], 1)

    def test_unknown_middle_frame_breaks_temporal_pairs(self):
        dataset, predictions = self.fixture()
        dataset['temporal_labels_confirmed'] = True
        dataset['frames'][0]['kind'] = 'video'
        dataset['frames'][0]['frame_index'] = 0
        for frame_id, ms in [('g', 100), ('h', 200)]:
            f = copy.deepcopy(dataset['frames'][0])
            f.update(id=frame_id, timestamp_ms=ms, frame_index=ms // 100)
            if frame_id == 'g':
                f['manual_keypoints']['11']['state'] = 'unknown'
            dataset['frames'].append(f)
            for prediction in predictions.values():
                row = copy.deepcopy(prediction['rows'][0])
                row['frame_id'] = frame_id
                prediction['rows'].append(row)
        metric = evaluate(dataset, predictions)['models']['a']['angles']['left_elbow']['temporal_residual_change_deg_per_s']
        self.assertEqual(metric['n'], 0)

    def test_frame_mismatch_fails_closed(self):
        dataset, predictions = self.fixture()
        predictions['b']['rows'][0]['sha256'] = 'different'
        with self.assertRaises(ValueError):
            evaluate(dataset, predictions)

    def test_occluded_labels_and_missed_targets_are_counted(self):
        dataset, predictions = self.fixture()
        dataset['frames'][0]['occlusion'] = 'arm_occluded'
        dataset['frames'][0]['manual_keypoints']['11']['state'] = 'occluded'
        predictions['b']['rows'][0]['points'] = {}
        predictions['b']['rows'][0]['selection_reason'] = 'no_detection'
        result = evaluate(dataset, predictions)
        self.assertEqual(result['models']['b']['target_unavailable_rate'], 1)
        self.assertEqual(result['models']['b']['no_detection_frames'], 1)
        self.assertIsNone(result['models']['b']['miss_rate'])
        self.assertEqual(result['models']['a']['angles']['left_elbow']['accepted_mae_degrees']['n'], 1)

    def test_multiple_false_detections_in_absent_frame_are_not_hidden(self):
        dataset, predictions = self.fixture()
        dataset['frames'][0]['subject_present'] = False
        predictions['b']['rows'][0].update(points={}, person_count=2, selection_reason='ambiguous_multiple_people')
        self.assertEqual(evaluate(dataset, predictions)['models']['b']['false_positive_frames'], 1)

    def test_all_joint_definitions_use_expected_pivot(self):
        left = {11: (0, 0), 13: (1, 0), 15: (2, 1), 23: (0, 2), 25: (0, 4), 27: (1, 5)}
        points = {str(i): {'x': x, 'y': y, 'score': 1} for i, (x, y) in left.items()}
        points.update({str(i + 1): {'x': 10 - x, 'y': y, 'score': 1} for i, (x, y) in left.items()})
        result = angles(points)
        for side in ('left', 'right'):
            for joint, expected in [('shoulder', 90), ('elbow', 135), ('hip', 180), ('knee', 135)]:
                self.assertAlmostEqual(result[f'{side}_{joint}']['degrees'], expected)

    def test_prepare_rejects_empty_materials_without_fabricating_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / 'manifest.json'
            manifest.write_text(json.dumps({'samples': []}))
            with self.assertRaises(ValueError):
                prepare(manifest, root / 'frames')
            self.assertFalse((root / 'frames').exists())

    def test_unknown_manual_point_not_counted_as_truth(self):
        dataset, predictions = self.fixture()
        dataset['frames'][0]['manual_keypoints']['11']['state'] = 'unknown'
        result = evaluate(dataset, predictions)
        self.assertEqual(result['paired_common_angles'], 0)

    def test_temporal_metric_requires_adjacent_labeled_residuals(self):
        dataset, predictions = self.fixture()
        dataset['temporal_labels_confirmed'] = True
        dataset['frames'][0]['kind'] = 'video'
        dataset['frames'][0]['frame_index'] = 30
        second = copy.deepcopy(dataset['frames'][0])
        second.update(id='g', timestamp_ms=100, frame_index=31)
        dataset['frames'].append(second)
        for prediction in predictions.values():
            row = copy.deepcopy(prediction['rows'][0])
            row['frame_id'] = 'g'
            row['points']['15'].update(x=1, y=1)
            prediction['rows'].append(row)
        metric = evaluate(dataset, predictions)['models']['a']['angles']['left_elbow']['temporal_residual_change_deg_per_s']
        self.assertEqual(metric['n'], 1)
        self.assertAlmostEqual(metric['mean'], 450)
