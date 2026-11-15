"""Counterbalanced fresh-process trials with an auditable idle gate (no app termination)."""
import argparse
from datetime import datetime, timezone
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path
import psutil
from common import read, write, sha
from evaluate import summary
from run import execute, HERE, ROOT, gpu_info


def orders(names, rounds):
    if len(names) != len(set(names)) or not names or rounds < 1:
        raise ValueError('Unique configurations and positive rounds required')
    # Three configurations, six rounds: every position occurs twice, mirrored order.
    cycle = [names[i:] + names[:i] for i in range(len(names))]
    cycle += [list(reversed(row)) for row in cycle]
    return [cycle[i % len(cycle)] for i in range(rounds)]


def load_sample(require_gpu):
    sample = {'utc': datetime.now(timezone.utc).isoformat(), 'cpu_percent': psutil.cpu_percent(interval=.5)}
    if require_gpu:
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,temperature.gpu,clocks.sm,power.draw',
                                     '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=3)
            sample['gpu_raw'] = result.stdout.strip()
            # Multiple GPUs: all must satisfy idle threshold.
            sample['gpu_percent'] = max(float(line.split(',')[0]) for line in result.stdout.splitlines()) if result.returncode == 0 else None
        except (OSError, ValueError, subprocess.TimeoutExpired):
            sample['gpu_percent'] = None
    return sample


def idle_gate(require_gpu, timeout=30, consecutive=3, cpu_limit=20, gpu_limit=15):
    samples, streak = [], 0
    start = time.perf_counter()
    while time.perf_counter() - start < timeout:
        row = load_sample(require_gpu)
        samples.append(row)
        acceptable = row['cpu_percent'] <= cpu_limit and (
            not require_gpu or row.get('gpu_percent') is not None and row['gpu_percent'] <= gpu_limit)
        streak = streak + 1 if acceptable else 0
        if streak >= consecutive:
            return {'passed': True, 'samples': samples}
        time.sleep(.5)
    return {'passed': False, 'samples': samples}


def summarize(records, output):
    grouped = {}
    for key, record in records.items():
        if record['exit_code'] != 0 or record['error']:
            continue
        prediction = read(output / key / 'predictions.json')
        group = grouped.setdefault(record['configuration'], [])
        warm = [r for r in prediction['rows'] if r['repeat'] > 0]
        stages = {name: summary([r['stages'][name] for r in warm if name in r['stages']])
                  for name in sorted({k for r in warm for k in r['stages']})}
        group.append({'trial': key, 'prediction_sha256': sha(output / key / 'predictions.json'),
                      'load_ms': prediction['load_ms'], 'process_wall_s': record['process_wall_s'],
                      'rss_sampled_peak_bytes': record['rss_sampled_peak_bytes'],
                      'gpu_process_peak_bytes': record['gpu_process_peak_bytes'],
                      'first_pass_ms': summary([r['pipeline_ms'] for r in prediction['rows'] if r['repeat'] == 0]),
                      'warm_ms': summary([r['pipeline_ms'] for r in warm]), 'warm_stages': stages})
    return {name: {'trials': trials,
                   'trial_warm_medians_ms': summary([r['warm_ms']['median'] for r in trials if r['warm_ms']['n']]),
                   'process_wall_s': summary([r['process_wall_s'] for r in trials])}
            for name, trials in grouped.items()}


def main(a):
    a.output.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(a.dataset, a.output / 'dataset.json')
    schedule = orders(a.configurations, a.rounds)
    records = {}
    try:
        power = subprocess.run(['powercfg', '/getactivescheme'], capture_output=True, timeout=3).stdout.decode(errors='replace')
    except (OSError, subprocess.TimeoutExpired):
        power = None
    info = {'schema': 'shotform-model-lab-v1', 'executed_at_utc': datetime.now(timezone.utc).isoformat(),
            'machine_label': a.machine_label, 'system': platform.platform(), 'cpu': platform.processor(),
            'logical_cpus': psutil.cpu_count(), 'ram_bytes': psutil.virtual_memory().total,
            'gpu': gpu_info(), 'power_scheme_raw': power, 'schedule': schedule,
            'dataset_sha256': sha(a.dataset), 'models_manifest_sha256': sha(a.models),
            'idle_policy': {'cpu_max_percent': 20, 'gpu_max_percent': 15, 'consecutive_samples': 3,
                            'timeout_s': a.idle_timeout, 'scope': 'before every fresh worker; cannot exclude background activity during inference'},
            'timing_scope': 'fixed identical PNGs; each trial fresh process, pass 0 separated; bound mode is an execution-mode diagnostic; process wall includes imports/load/output, excludes UI and source preparation',
            'runs': records}
    require_gpu = any('cuda' in c for c in a.configurations)
    try:
        for round_id, order in enumerate(schedule, 1):
            for position, name in enumerate(order, 1):
                key = f'round-{round_id:02d}/{name}'
                destination = a.output / key
                destination.mkdir(parents=True)
                gate = idle_gate(require_gpu, timeout=a.idle_timeout)
                write(destination / 'idle.json', gate)
                if not gate['passed']:
                    records[key] = {'configuration': name, 'position': position, 'exit_code': None,
                                    'error': 'Idle gate failed; inference not run'}
                    print(key, 'BLOCKED by background load', flush=True)
                    return 1
                parts = name.split('-')
                backend, device = parts[:2]
                mode = 'bound' if len(parts) == 3 else 'standard'
                python = str(a.heavy_python.resolve()) if backend == 'heavy' else sys.executable
                command = [python, str(HERE / 'worker.py'), '--dataset', str(a.dataset.resolve()),
                           '--backend', backend, '--device', device, '--models', str(a.models.resolve()),
                           '--io-mode', mode, '--output', str((destination / 'predictions.json').resolve()),
                           '--repeats', str(a.repeats)]
                records[key] = dict(execute(command, destination, a.timeout), configuration=name, position=position)
                print(key, records[key]['exit_code'], records[key]['error'], flush=True)
                if records[key]['error'] == 'Cancelled by user':
                    return 1
    finally:
        write(a.output / 'run.json', info)
        write(a.output / 'timing-summary.json', summarize(records, a.output))
    return int(any(r['exit_code'] != 0 or r['error'] for r in records.values()))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('dataset', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--machine-label', required=True)
    p.add_argument('--configurations', nargs='+', choices=['heavy-cpu', 'rtmpose-cpu', 'rtmpose-cuda', 'rtmpose-cuda-bound'],
                   default=['heavy-cpu', 'rtmpose-cpu', 'rtmpose-cuda'])
    p.add_argument('--rounds', type=int, default=6)
    p.add_argument('--repeats', type=int, default=3)
    p.add_argument('--timeout', type=float, default=600)
    p.add_argument('--idle-timeout', type=float, default=30)
    p.add_argument('--heavy-python', type=Path, default=ROOT / '.venv/Scripts/python.exe')
    p.add_argument('--models', type=Path, default=ROOT / 'models/experimental/rtmpose-m/models.json')
    a = p.parse_args()
    if a.rounds < 1 or a.repeats < 2 or a.timeout <= 0 or a.idle_timeout <= 0:
        p.error('Positive rounds/timeouts and at least two passes required')
    orders(a.configurations, a.rounds)
    raise SystemExit(main(a))
