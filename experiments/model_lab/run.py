"""Separate interpreters, process wall time, sampled RSS and GPU device memory."""
import argparse
from datetime import datetime, timezone
import os
import platform
import shutil
import subprocess
import sys
import time
import threading
from pathlib import Path
import psutil
from common import read, write, sha

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def gpu_info():
    try:
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,driver_version,memory.total,memory.used',
                                 '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=3)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def process_vram(pids):
    try:
        result = subprocess.run(['nvidia-smi', '--query-compute-apps=pid,used_memory',
                                 '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=3)
        measured = []
        for row in result.stdout.splitlines():
            fields = [x.strip() for x in row.split(',')]
            if len(fields) == 2 and fields[0] in {str(pid) for pid in pids} and fields[1].isdigit():
                measured.append(int(fields[1]) * 1024 * 1024)
        if measured:
            return sum(measured)
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def execute(command, output, timeout):
    rss, gpu_samples = 0, []
    started = time.perf_counter()
    with (output / 'stdout.txt').open('w') as stdout, (output / 'stderr.txt').open('w') as stderr:
        child = subprocess.Popen(command, stdout=stdout, stderr=stderr,
                                 creationflags=0x08000000 if os.name == 'nt' else 0)
        try:
            process = psutil.Process(child.pid)
        except psutil.NoSuchProcess:
            process = None
        error = None
        tracked = {process.pid: process} if process else {}
        stopped = threading.Event()
        def sample_gpu():
            while not stopped.is_set():
                snapshot = {'elapsed_s': time.perf_counter() - started,
                            'device_snapshot': gpu_info(), 'process_bytes': process_vram(list(tracked))}
                if not stopped.is_set():
                    gpu_samples.append(snapshot)
                stopped.wait(1)
        threading.Thread(target=sample_gpu, daemon=True).start()
        try:
            while child.poll() is None:
                elapsed = time.perf_counter() - started
                if elapsed >= timeout:
                    error = f'Experiment exceeded {timeout}s'
                    break
                try:
                    if process is not None:
                        # Windows venv python.exe is a redirector; measure/reap its real worker too.
                        for descendant in process.children(recursive=True):
                            tracked[descendant.pid] = descendant
                        total = 0
                        for member in list(tracked.values()):
                            try:
                                total += member.memory_info().rss
                            except psutil.NoSuchProcess:
                                pass
                        rss = max(rss, total)
                except psutil.NoSuchProcess:
                    pass
                time.sleep(0.05)
        except KeyboardInterrupt:
            error = 'Cancelled by user'
        finally:
            stopped.set()
            if process is not None:
                try:
                    for descendant in process.children(recursive=True):
                        tracked[descendant.pid] = descendant
                except psutil.NoSuchProcess:
                    pass
            for member in reversed(list(tracked.values())):
                try:
                    if member.is_running():
                        member.kill()
                except psutil.NoSuchProcess:
                    pass
            if child.poll() is None:
                child.kill()
            child.wait()
            _, alive = psutil.wait_procs(list(tracked.values()), timeout=2)
            if alive:
                error = (error or '') + '; process tree cleanup incomplete'
    gpu_samples = list(gpu_samples)
    process_samples = [s['process_bytes'] for s in gpu_samples if s['process_bytes'] is not None]
    return {'exit_code': child.returncode, 'error': error,
            'process_wall_s': time.perf_counter() - started,
            'rss_sampled_peak_bytes': rss, 'gpu_device_samples': gpu_samples,
            'gpu_process_peak_bytes': max(process_samples) if process_samples else None,
            'gpu_process_memory_status': 'sampled' if process_samples else 'unavailable (e.g. Windows WDDM N/A)',
            'memory_scope': 'Python worker tree summed RSS sampled >=50ms (shared pages may be counted twice); GPU tree >=1s; device snapshots include other apps, never substitute for process VRAM'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('dataset', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--machine-label', required=True)
    p.add_argument('--backends', nargs='+', choices=['heavy-cpu', 'rtmpose-cpu', 'rtmpose-cuda'],
                   default=['heavy-cpu', 'rtmpose-cpu', 'rtmpose-cuda'])
    p.add_argument('--heavy-python', type=Path, default=ROOT / '.venv/Scripts/python.exe')
    p.add_argument('--models', type=Path, default=ROOT / 'models/experimental/rtmpose-m/models.json')
    p.add_argument('--repeats', type=int, default=3)
    p.add_argument('--timeout', type=float, default=600)
    a = p.parse_args()
    if a.repeats < 1 or a.timeout <= 0 or len(set(a.backends)) != len(a.backends):
        p.error('Positive repeats/timeout and unique backends required')
    a.output.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(a.dataset, a.output / 'dataset.json')
    records = {}
    for name in a.backends:
        destination = a.output / name
        destination.mkdir()
        backend, device = name.split('-')
        python = str(a.heavy_python.resolve()) if backend == 'heavy' else sys.executable
        command = [python, str(HERE / 'worker.py'), '--dataset', str(a.dataset.resolve()),
                   '--backend', backend, '--device', device, '--models', str(a.models.resolve()),
                   '--output', str((destination / 'predictions.json').resolve()), '--repeats', str(a.repeats)]
        records[name] = execute(command, destination, a.timeout)
        preparation = read(a.dataset).get('preparation_wall_s')
        records[name]['source_to_results_wall_s'] = (
            preparation + records[name]['process_wall_s'] if preparation is not None else None)
        print(name, records[name]['exit_code'], flush=True)
        if records[name]['error'] == 'Cancelled by user':
            break
    write(a.output / 'run.json', {'schema': 'shotform-model-lab-v1',
          'executed_at_utc': datetime.now(timezone.utc).isoformat(), 'machine_label': a.machine_label,
          'system': platform.platform(), 'cpu': platform.processor(),
          'logical_cpus': psutil.cpu_count(), 'physical_cpus': psutil.cpu_count(logical=False),
          'ram_bytes': psutil.virtual_memory().total, 'gpu': gpu_info(),
          'dataset_sha256': sha(a.dataset), 'runs': records,
          'timing_scope': 'process wall includes startup/import/load, PNG decoding, detection, pose, angles, JSON and exit polling; source_to_results adds shared preparation of source video/images once; excludes Rust/UI; pipeline_ms excludes load/hash/output'})
    raise SystemExit(1 if any(r['exit_code'] or r['error'] for r in records.values()) else 0)
