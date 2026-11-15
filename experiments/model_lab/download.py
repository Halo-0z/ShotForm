"""Official OpenMMLab artifacts, bounded downloads and recorded archive/model hashes."""
import argparse
import urllib.request
import zipfile
from pathlib import Path
from common import write, sha

BASE = 'https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/'
FILES = {
    'det': 'yolox_m_8xb8-300e_humanart-c2c7a14a.zip',
    'pose': 'rtmpose-m_simcc-body7_pt-body7_420e-256x192-e48f03d0_20230504.zip',
}


def download(output):
    output.mkdir(parents=True, exist_ok=False)
    metadata = {'candidate': 'RTMPose-m body7 256x192 + YOLOX-m HumanArt 640x640', 'models': {}}
    for name, filename in FILES.items():
        url = BASE + filename
        archive = output / filename
        with urllib.request.urlopen(url, timeout=60) as response, archive.open('xb') as target:
            size = 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > 600 * 1024 * 1024:
                    raise ValueError('Archive exceeds 600 MiB')
                target.write(chunk)
        with zipfile.ZipFile(archive) as bundle:
            if bundle.testzip() is not None:
                raise ValueError('ZIP CRC failed')
            entries = [n for n in bundle.namelist() if n.endswith('.onnx')]
            if len(entries) != 1:
                raise ValueError('Expected exactly one ONNX model')
            model = output / f'{name}.onnx'
            # No extractall: archive paths cannot escape output directory.
            model.write_bytes(bundle.read(entries[0]))
        metadata['models'][name] = {'url': url, 'archive_sha256': sha(archive),
                                    'path': model.name, 'sha256': sha(model), 'bytes': model.stat().st_size}
    write(output / 'models.json', metadata)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--output', type=Path, required=True)
    download(p.parse_args().output)
