"""Fetch official, pinned MediaPipe task bundles; validate bytes and actual loading before replacement."""
import argparse
import hashlib
import json
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from pose_detect import create_task_detector

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('variant', choices=['heavy', 'lite'])
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'models/manifest.json').read_text(encoding='utf-8'))
    entry = manifest[args.variant]
    with urllib.request.urlopen(entry['url'], timeout=120) as response:
        data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != entry['sha256']:
        raise RuntimeError(f'Model checksum mismatch: {digest}')
    with tempfile.TemporaryDirectory(prefix='shotform-model-') as temporary:
        candidate = Path(temporary) / entry['name']
        candidate.write_bytes(data)
        with zipfile.ZipFile(candidate) as bundle:
            if bundle.testzip() is not None:
                raise RuntimeError('Model archive CRC failed')
        detector, info = create_task_detector(candidate)
        detector.close()
    target = ROOT / 'models' / entry['name']
    staging = target.with_suffix('.download')
    staging.write_bytes(data)
    staging.replace(target)
    print(json.dumps(dict(info, bytes=len(data), source=entry['url']), indent=2))


if __name__ == '__main__':
    main()
