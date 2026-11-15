"""Run with the isolated lab interpreter (psutil dependency)."""
import tempfile
import time
import sys
import psutil
import unittest
from pathlib import Path
from unittest.mock import patch
from run import execute
from benchmark import orders, idle_gate


class RuntimeTests(unittest.TestCase):
    def test_counterbalanced_schedule_covers_positions_and_orders(self):
        schedule = orders(['a', 'b', 'c'], 6)
        self.assertEqual(len({tuple(row) for row in schedule}), 6)
        for position in range(3):
            self.assertEqual(sorted(row[position] for row in schedule), ['a', 'a', 'b', 'b', 'c', 'c'])
        with self.assertRaises(ValueError):
            orders(['a', 'a'], 3)

    def test_idle_gate_resets_streak_and_requires_known_gpu_load(self):
        rows = [{'cpu_percent': 5, 'gpu_percent': 3}, {'cpu_percent': 5, 'gpu_percent': None},
                {'cpu_percent': 30, 'gpu_percent': 3}] + [{'cpu_percent': 5, 'gpu_percent': 3}] * 3
        with patch('benchmark.load_sample', side_effect=rows), patch('benchmark.time.sleep'):
            result = idle_gate(True)
        self.assertTrue(result['passed'])
        self.assertEqual(len(result['samples']), 6)

    def test_busy_machine_does_not_run_when_gate_expires(self):
        with patch('benchmark.time.perf_counter', side_effect=[0, 0, 2]), patch('benchmark.time.sleep'), \
                patch('benchmark.load_sample', return_value={'cpu_percent': 90, 'gpu_percent': 99}):
            self.assertFalse(idle_gate(True, timeout=1)['passed'])

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
