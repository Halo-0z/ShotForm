"""Actual local model loading/inference tests, no network and no AI API."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import pose_detect


class ModelLoadingTests(unittest.TestCase):
    def run_detector(self, paths):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'result.json'
            process = subprocess.run([sys.executable, str(ROOT / 'scripts/pose_detect.py'),
                                      '--file', str(ROOT / 'public/hero/kobe-shot.png'),
                                      '--output-file', str(output)],
                                     env=dict(os.environ, SHOTFORM_POSE_MODELS=os.pathsep.join(map(str, paths))),
                                     capture_output=True, text=True, timeout=90)
            self.assertEqual(process.returncode, 0, process.stderr)
            result = json.loads(output.read_text(encoding='utf-8'))
            self.assertNotIn('error', result)
            self.assertEqual(len(result['keypoints']), 33)
            self.assertIn('[pose-model]', process.stderr)
            return result['model_info'], process.stderr

    def test_heavy_and_lite_real_inference(self):
        for variant in ['heavy', 'lite']:
            with self.subTest(variant=variant):
                path = ROOT / f'models/pose_landmarker_{variant}.task'
                info, _ = self.run_detector([path])
                self.assertEqual(info['name'], path.name)
                self.assertEqual(info['sha256'], hashlib.sha256(path.read_bytes()).hexdigest())
                self.assertEqual(info['fallback_reasons'], [])
                self.assertEqual(info['backend'], 'tasks')

    def test_corrupt_or_missing_heavy_reports_lite_fallback(self):
        with tempfile.TemporaryDirectory() as temporary:
            heavy = Path(temporary) / 'pose_landmarker_heavy.task'
            lite = ROOT / 'models/pose_landmarker_lite.task'
            for content in [None, b'invalid task archive']:
                with self.subTest(content=content):
                    if content is not None:
                        heavy.write_bytes(content)
                    info, stderr = self.run_detector([heavy, lite])
                    self.assertEqual(info['name'], lite.name)
                    self.assertEqual(info['sha256'], hashlib.sha256(lite.read_bytes()).hexdigest())
                    self.assertEqual(len(info['fallback_reasons']), 1)
                    self.assertIn(heavy.name, info['fallback_reasons'][0])
                    self.assertIn('load failed', stderr)

    def test_ascii_cache_uses_content_not_name_size_or_timestamp(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / 'model.task'
            source.write_bytes(b'old bytes')
            old = pose_detect._cache_model_to_ascii_path(source)
            stamp = source.stat().st_mtime_ns
            source.write_bytes(b'new bytes')
            os.utime(source, ns=(stamp, stamp))
            new = pose_detect._cache_model_to_ascii_path(source)
            self.assertNotEqual(old, new)
            new.write_bytes(b'bad cache')
            repaired = pose_detect._cache_model_to_ascii_path(source)
            self.assertEqual(repaired.read_bytes(), b'new bytes')

    def test_all_model_failure_never_reports_success(self):
        with patch.object(pose_detect, '_candidate_model_paths', return_value=[Path('missing-heavy.task')]):
            with self.assertRaisesRegex(RuntimeError, 'Failed to load MediaPipe task models'):
                pose_detect._create_tasks_detector()


if __name__ == '__main__':
    unittest.main()
