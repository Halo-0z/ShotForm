"""Synthetic labels check tooling only; none are project accuracy ground truth."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'experiments/model_lab'))
from annotate import merge_labels, validate_frame, build, POINT_IDS
from common import sha, write
from evaluate import evaluate


class AnnotationTests(unittest.TestCase):
    def fixture(self):
        return {'schema': 'shotform-model-lab-v1', 'frames': [{
            'id': 'f', 'sample_id': 'sample', 'kind': 'video', 'frame_index': 3, 'timestamp_ms': 100,
            'sha256': 'same', 'image': 'f.png', 'width': 592, 'height': 1280,
            'subject_present': None, 'target_bbox': None, 'manual_keypoints': {}, 'annotator': '',
            'occlusion': 'unlabeled', 'notes': ''}]}

    def complete(self):
        data = self.fixture()
        data['frames'][0].update(subject_present=True, annotator='synthetic test',
                                 target_bbox=[10, 20, 400, 1000], occlusion='arm_occluded',
                                 manual_keypoints={i: {'state': 'unknown'} for i in POINT_IDS},
                                 reviewed_at='2026-11-15T00:00:00Z')
        return data

    def test_merge_keeps_original_and_only_label_fields(self):
        base = self.fixture()
        incoming = self.complete()
        incoming['frames'][0]['model_prediction'] = 'must not import'
        out = merge_labels(base, incoming)
        self.assertTrue(out['annotation_review_required'])
        self.assertIsNone(base['frames'][0]['subject_present'])
        self.assertNotIn('model_prediction', out['frames'][0])
        self.assertEqual(out['frames'][0]['sha256'], 'same')

    def test_reject_changed_provenance_frame_identity_and_size(self):
        for key, value in [('sha256', 'changed'), ('id', 'other'), ('width', 999), ('timestamp_ms', 400)]:
            incoming = self.complete()
            incoming['frames'][0][key] = value
            with self.assertRaises(ValueError):
                merge_labels(self.fixture(), incoming)

    def test_bad_coordinates_boxes_and_unknown_guesses_rejected(self):
        for patch in [dict(target_bbox=[0, 0, 600, 100]), dict(target_bbox=[0, 0, 0, 3]),
                      dict(manual_keypoints={'11': {'x': float('nan'), 'y': 2, 'state': 'visible'}}),
                      dict(manual_keypoints={'11': {'x': 3, 'y': 4, 'state': 'unknown'}}),
                      dict(manual_keypoints={'99': {'state': 'unknown'}}), dict(subject_present=1)]:
            f = self.fixture()['frames'][0]
            f.update(patch)
            with self.assertRaises(ValueError):
                validate_frame(f)

    def test_review_requires_all_decisions_but_all_unknown_is_allowed(self):
        validate_frame(self.complete()['frames'][0])
        for patch in [dict(annotator=' '), dict(target_bbox=None), dict(manual_keypoints={}),
                      dict(occlusion='unlabeled'), dict(subject_present=False)]:
            f = self.complete()['frames'][0]
            f.update(patch)
            with self.assertRaises(ValueError):
                validate_frame(f)

    def test_unreviewed_v2_labels_cannot_become_error_or_miss_ground_truth(self):
        data = self.complete()
        data['annotation_review_required'] = True
        f = data['frames'][0]
        f['reviewed_at'] = None
        f['manual_keypoints'] = {str(i): {'x': x, 'y': y, 'state': 'visible'} for i,x,y in [(11,0,1),(13,0,0),(15,1,0)]}
        row = {'frame_id': 'f', 'sha256': 'same', 'repeat': 0, 'points': {}, 'person_count': 0,
               'selection_reason': 'no_detection', 'pipeline_ms': 1}
        result = evaluate(data, {'a': {'rows': [row]}})['models']['a']
        self.assertIsNone(result['miss_rate'])
        self.assertEqual(result['angles']['left_elbow']['labeled_angles'], 0)

    def test_html_embeds_images_and_escapes_untrusted_script_end(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / 'f.png'
            image.write_bytes(b'fixture-image-only')
            data = self.fixture()
            data['frames'][0].update(sha256=sha(image), notes='</script><script>alert(1)</script>')
            write(root / 'dataset.json', data)
            build(root / 'dataset.json', root / 'page.html')
            html = (root / 'page.html').read_text(encoding='utf-8')
            self.assertIn('data:image/png;base64,', html)
            self.assertNotIn('</script><script>alert(1)</script>', html)
            self.assertIn('\\u003c/script>', html)
            image.write_bytes(b'changed')
            with self.assertRaises(ValueError):
                build(root / 'dataset.json', root / 'other.html')


if __name__ == '__main__':
    unittest.main()
