"""Synthetic geometric fixtures only; never project human annotations."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'experiments/model_lab'))
from common import TRIPLES
from evaluate import evaluate


class EvaluationContractTests(unittest.TestCase):
    def fixture(self, n=5):
        points = {str(i): {'x': x, 'y': y, 'score': 1, 'state': 'visible'}
                  for i,x,y in [(11,0,1),(13,0,0),(15,1,0)]}
        frames = [{'id': str(i), 'sha256': str(i), 'sample_id': 'synthetic', 'kind': 'video',
                   'frame_index': i, 'timestamp_ms': i * 1000 / 30, 'manual_keypoints': copy.deepcopy(points),
                   'annotator': 'synthetic-unit-test', 'reviewed_at': '2026-11-16T00:00:00Z',
                   'subject_present': True, 'occlusion': 'clear'} for i in range(n)]
        rows = [{'frame_id': str(i), 'sha256': str(i), 'repeat': 0, 'points': copy.deepcopy(points),
                 'person_count': 1, 'selection_reason': None, 'pipeline_ms': 1} for i in range(n)]
        return {'frames': frames, 'annotation_review_required': True}, {'a': {'rows': rows}, 'b': {'rows': copy.deepcopy(rows)}}

    def test_joint_pair_table_keeps_failures_and_full_human_denominator(self):
        data, p = self.fixture()
        p['a']['rows'][4]['points']['11']['score'] = .1
        for i in (2, 3, 4):
            p['b']['rows'][i].update(points={}, person_count=0, selection_reason='no_detection')
        p['b']['rows'][1]['points']['15']['y'] = 1  # 45 degree absolute error.
        p['a']['rows'][2]['points']['15']['y'] = 1  # Excluded from common success subset.
        table = evaluate(data, p)['pairwise'][0]['by_joint']
        self.assertEqual(set(table), set(TRIPLES))
        elbow = table['left_elbow']
        self.assertEqual(elbow['human_definable_n'], 5)
        self.assertEqual(elbow['model_valid_n'], {'a': 4, 'b': 2})
        self.assertEqual(elbow['model_failed_n'], {'a': 1, 'b': 3})
        self.assertEqual(elbow['model_coverage'], {'a': .8, 'b': .4})
        self.assertEqual(elbow['model_failure_reasons'], {'a': {'low_confidence': 1}, 'b': {'missing_point': 3}})
        self.assertEqual(elbow['common_valid_n'], 2)
        self.assertEqual(elbow['common_coverage'], .4)
        self.assertAlmostEqual(elbow['paired_mae_p95_degrees']['b']['mean'], 22.5)
        self.assertAlmostEqual(elbow['paired_mae_p95_degrees']['b']['p95'], 45)
        self.assertEqual(elbow['each_model_mae_p95_degrees']['a']['n'], 4)
        self.assertAlmostEqual(elbow['each_model_mae_p95_degrees']['a']['mean'], 11.25)
        self.assertEqual(elbow['paired_mae_p95_degrees']['a']['mean'], 0)
        self.assertIsNone(table['right_knee']['common_coverage'])

    def test_unknown_and_unreviewed_are_not_in_human_denominator(self):
        data,p=self.fixture()
        data['frames'][1]['manual_keypoints']['11']={'state':'unknown'}
        data['frames'][2]['reviewed_at']=None
        elbow=evaluate(data,p)['pairwise'][0]['by_joint']['left_elbow']
        self.assertEqual(elbow['human_definable_n'],3)
        self.assertEqual(elbow['common_valid_n'],3)

    def test_target_ambiguity_is_separate_from_no_detection(self):
        data,p=self.fixture(2)
        p['a']['rows'][0].update(points={},person_count=2,selection_reason='ambiguous_multiple_people')
        p['a']['rows'][1].update(points={},person_count=0,selection_reason='no_detection')
        result=evaluate(data,p)['models']['a']
        self.assertEqual(result['target_unavailable_frames'],2)
        self.assertEqual(result['no_detection_frames'],1)
        self.assertEqual(result['ambiguous_target_frames'],1)
        self.assertEqual(result['occlusion_coverage']['clear']['target_unavailable_frames'], 2)
        self.assertNotIn('missed_targets', result['occlusion_coverage']['clear'])
        self.assertIsNone(result['miss_rate'])

    def test_temporal_requires_explicit_confirmation_and_consecutive_source_frames(self):
        data,p=self.fixture(2)
        def metric():
            return evaluate(data,p)['models']['a']['angles']['left_elbow']['temporal_residual_change_deg_per_s']
        self.assertEqual(metric()['n'],0)
        self.assertIsNone(metric()['mean'])
        data['temporal_labels_confirmed']=True
        data['frames'][1]['frame_index']=6
        self.assertEqual(metric()['n'],0)
        data['frames'][1]['frame_index']=1
        self.assertEqual(metric()['n'],1)
        data['frames'][1]['manual_keypoints']['11']={'state':'unknown'}
        self.assertEqual(metric()['n'],0)


if __name__ == '__main__':
    unittest.main()
