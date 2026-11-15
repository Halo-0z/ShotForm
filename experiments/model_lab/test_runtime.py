"""Run with the isolated lab interpreter (psutil dependency)."""
import tempfile
import time
import sys
import psutil
import unittest
from pathlib import Path
from unittest.mock import patch
from run import execute


class RuntimeTests(unittest.TestCase):
    def test_worker_timeout_is_not_blocked_by_slow_gpu_probe(self):
        with tempfile.TemporaryDirectory() as directory:
            pid_path = Path(directory) / 'actual-worker.pid'
            code = f'import os,time; from pathlib import Path; Path({str(pid_path)!r}).write_text(str(os.getpid())); time.sleep(20)'
            with patch('run.gpu_info', side_effect=lambda: time.sleep(3)):
                start = time.perf_counter()
                result = execute([sys.executable, '-c', code], Path(directory), .5)
            self.assertLess(time.perf_counter() - start, 2)
            self.assertIsNotNone(result['error'])
            self.assertNotEqual(result['exit_code'], 0)
            self.assertFalse(psutil.pid_exists(int(pid_path.read_text())))

    def test_memory_includes_real_worker_behind_venv_redirector(self):
        with tempfile.TemporaryDirectory() as directory:
            result = execute([sys.executable, '-c', 'import time; data=bytearray(50*1024*1024); time.sleep(.4)'], Path(directory), 5)
            self.assertEqual(result['exit_code'], 0)
            self.assertGreater(result['rss_sampled_peak_bytes'], 50*1024*1024)

    def test_worker_failure_is_not_success(self):
        with tempfile.TemporaryDirectory() as directory:
            result = execute([sys.executable, '-c', 'raise RuntimeError("fixture failure")'], Path(directory), 5)
            self.assertNotEqual(result['exit_code'], 0)
            self.assertIn('fixture failure', (Path(directory) / 'stderr.txt').read_text())


if __name__ == '__main__':
    unittest.main()
