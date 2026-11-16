"""Offline inspection of frozen predictions. Never produce human labels or accuracy claims."""
import argparse
from collections import Counter
from html import escape
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from common import read, write, sha
from evaluate import summary

BODY_IDS = ('11', '12', '13', '14', '15', '16', '23', '24', '25', '26', '27', '28')
EDGES = [('11', '12'), ('11', '13'), ('13', '15'), ('12', '14'), ('14', '16'),
         ('11', '23'), ('12', '24'), ('23', '24'), ('23', '25'), ('25', '27'), ('24', '26'), ('26', '28')]


def point_status(point, width, height):
    if point is None:
        return 'missing'
    if not all(isinstance(point.get(k), (int, float)) and math.isfinite(point[k]) for k in ('x', 'y', 'score')):
        return 'nonfinite'
    if not 0 <= point['x'] < width or not 0 <= point['y'] < height:
        return 'outside_image'
    return 'score_ge_055' if point['score'] >= .55 else 'low_score'


def index_prediction(dataset, prediction, digest, repeat=0):
    if prediction['dataset_sha256'] != digest:
        raise ValueError('Prediction dataset version mismatch')
    frames = {f['id']: f for f in dataset['frames']}
    rows = [r for r in prediction['rows'] if r['repeat'] == repeat]
    index = {r['frame_id']: r for r in rows}
    if len(frames) != len(dataset['frames']) or len(index) != len(rows) or set(index) != set(frames):
        raise ValueError('Missing or duplicate prediction/frame IDs')
    for key, row in index.items():
        if row['sha256'] != frames[key]['sha256']:
            raise ValueError('Frame hash mismatch')
        if 'people' not in row:
            raise ValueError('All-person predictions required; rerun worker, do not reconstruct missing people')
        if len(row['people']) != row['person_count']:
            raise ValueError('Person count mismatch')
        chosen = row.get('selected_person_index')
        if chosen is None:
            if row['points'] or row['selection_reason'] is None:
                raise ValueError('Unselected row must retain a reason and empty selected points')
        elif not isinstance(chosen, int) or not 0 <= chosen < len(row['people']) or row['people'][chosen] != row['points'] or row['selection_reason']:
            raise ValueError('Selected person does not match stored points')
    return index


def observations(frame, row):
    points = Counter(point_status(person.get(i), frame['width'], frame['height'])
                     for person in row['people'] for i in BODY_IDS)
    return {'people': row['person_count'], 'selected_person_index': row['selected_person_index'],
            'selection_reason': row['selection_reason'], 'body_point_status_all_people': dict(points),
            'selected_angle_reasons': {k: v['reason'] for k, v in row['angles'].items() if v['reason']},
            'pipeline_ms': row['pipeline_ms'], 'stages': row['stages']}


def font(size):
    for name in ('C:/Windows/Fonts/arial.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def skeleton_panel(original, row):
    image = original.copy().convert('RGB')
    draw = ImageDraw.Draw(image)
    for number, person in enumerate(row['people']):
        selected = number == row['selected_person_index']
        high = '#5ee1c6' if selected else '#96b8ee'
        low = '#ffb547'
        states = {i: point_status(person.get(i), image.width, image.height) for i in BODY_IDS}
        for left, right in EDGES:
            if states[left] not in ('score_ge_055', 'low_score') or states[right] not in ('score_ge_055', 'low_score'):
                continue  # Never clamp an out-of-image prediction onto the border.
            a, b = person[left], person[right]
            if states[left] == states[right] == 'score_ge_055':
                draw.line((a['x'], a['y'], b['x'], b['y']), fill=high, width=3)
            else:
                # Dashes distinguish weak model scores from accepted points.
                length = math.hypot(b['x'] - a['x'], b['y'] - a['y'])
                steps = max(1, int(length / 7))
                for i in range(0, steps, 2):
                    start, end = i / steps, min(i + 1, steps) / steps
                    draw.line((a['x'] + (b['x'] - a['x']) * start, a['y'] + (b['y'] - a['y']) * start,
                               a['x'] + (b['x'] - a['x']) * end, a['y'] + (b['y'] - a['y']) * end), fill=low, width=2)
        for key in BODY_IDS:
            if states[key] not in ('score_ge_055', 'low_score'):
                continue
            p = person[key]
            color = high if states[key] == 'score_ge_055' else low
            draw.ellipse((p['x'] - 5, p['y'] - 5, p['x'] + 5, p['y'] + 5), outline=color,
                         fill=color if states[key] == 'score_ge_055' else None, width=2)
            draw.text((p['x'] + 7, p['y'] - 5), key, fill=color, font=font(15), stroke_width=1, stroke_fill='black')
        visible = [person[i] for i in BODY_IDS if states[i] in ('score_ge_055', 'low_score')]
        if visible:
            draw.text((min(p['x'] for p in visible), max(0, min(p['y'] for p in visible) - 25)),
                      f'P{number} ' + ('selected' if selected else 'UNASSIGNED'), fill=high,
                      font=font(17), stroke_width=1, stroke_fill='black')
    return image


def render(dataset_path, run_path, output):
    dataset = read(dataset_path)
    digest = sha(dataset_path)
    run = read(run_path / 'run.json')
    if digest != run['dataset_sha256'] or sha(run_path / 'dataset.json') != digest:
        raise ValueError('Run/input dataset changed')
    indexed, models, failures = {}, {}, {}
    for name, status in run['runs'].items():
        if status['exit_code'] != 0 or status['error']:
            failures[name] = status
            continue
        prediction = read(run_path / name / 'predictions.json')
        indexed[name] = index_prediction(dataset, prediction, digest)
        models[name] = {'model': prediction['model'], 'load_ms': prediction['load_ms'],
                        'prediction_sha256': sha(run_path / name / 'predictions.json'), 'samples': {}}
    if not indexed:
        raise ValueError('No successful model predictions; inspect run.json/stderr')
    output.mkdir(parents=True, exist_ok=False)
    figures = output / 'frames'
    figures.mkdir()
    frame_notes, sections = [], []
    for order, frame in enumerate(dataset['frames']):
        path = dataset_path.parent / frame['image']
        if sha(path) != frame['sha256']:
            raise ValueError('Source PNG changed: ' + frame['id'])
        with Image.open(path) as source:
            original = source.convert('RGB')
        if original.size != (frame['width'], frame['height']):
            raise ValueError('Source dimensions changed')
        panels = [('ORIGINAL - no human labels shown', original, '')]
        note = {'frame_id': frame['id'], 'sample_id': frame['sample_id'], 'sha256': frame['sha256'],
                'frame_index': frame['frame_index'], 'timestamp_ms': frame['timestamp_ms'], 'models': {}}
        for name, rows in indexed.items():
            row = rows[frame['id']]
            info = observations(frame, row)
            note['models'][name] = info
            selected_status = 'bbox-selected' if frame.get('target_bbox') else 'single-unreviewed'
            panels.append((name, skeleton_panel(original, row),
                           f"people={row['person_count']}  {row['selection_reason'] or selected_status} | {row['pipeline_ms']:.2f} ms"))
        canvas = Image.new('RGB', (original.width * len(panels), original.height + 130), '#141922')
        draw = ImageDraw.Draw(canvas)
        for i, (name, panel, status) in enumerate(panels):
            x = i * original.width
            canvas.paste(panel, (x, 100))
            draw.text((x + 12, 6), name, font=font(24), fill='#f3eee6')
            draw.text((x + 12, 39), f"{frame['id']} | f{frame['frame_index']} | {frame['timestamp_ms']/1000:.3f}s", font=font(18), fill='#f3eee6')
            draw.text((x + 12, 68), status, font=font(16), fill='#ffb547')
        draw.text((12, original.height + 104), 'MODEL OUTPUT ONLY | green: selected score>=0.55 | blue: unassigned | amber dashed: low score | outside points omitted', font=font(17), fill='#f3eee6')
        filename = f'{order:03d}.jpg'
        canvas.save(figures / filename, quality=95)
        note['figure'] = 'frames/' + filename
        frame_notes.append(note)
        detail = escape(str({k: v for k, v in note['models'].items()}))
        sections.append(f'<section id="f{order}"><h2>{escape(frame["id"])} · {frame["timestamp_ms"]/1000:.3f} s</h2>'
                        f'<a href="frames/{filename}"><img loading="lazy" src="frames/{filename}" alt="{escape(frame["id"], quote=True)} 模型骨架对照"></a>'
                        f'<details><summary>本帧预测状态与阶段耗时</summary><pre>{detail}</pre></details></section>')
    for name, rows in indexed.items():
        for sample in dict.fromkeys(f['sample_id'] for f in dataset['frames']):
            subset = [rows[f['id']] for f in dataset['frames'] if f['sample_id'] == sample]
            models[name]['samples'][sample] = {
                'frames': len(subset), 'person_count_histogram': dict(Counter(r['person_count'] for r in subset)),
                'selection_reasons': dict(Counter(r['selection_reason'] or 'selected' for r in subset)),
                'selected_angle_reasons': dict(Counter(a['reason'] or 'score_rule_accepted' for r in subset for a in r['angles'].values())),
                'pipeline_ms_observed_single_pass': summary([r['pipeline_ms'] for r in subset])}
    report = {'schema': 'shotform-model-review-v1', 'dataset_sha256': digest, 'run_sha256': sha(run_path/'run.json'),
              'models': models, 'failed_runs': failures, 'frames': frame_notes,
              'human_reviewed_frames': sum(bool(f.get('reviewed_at')) for f in dataset['frames']),
              'scope': 'Model output inspection only. Score-based acceptance and selection counts are NOT human coverage, accuracy or miss rate. No human errors are calculated. Frame person indices are not tracks.'}
    write(output / 'review.json', report)
    links = ' '.join(f'<a href="#f{i}">{escape(f["id"])}</a>' for i, f in enumerate(dataset['frames']))
    failed_notice = '<p>失败的模型运行：' + escape(str(failures)) + '</p>' if failures else ''
    (output / 'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>ShotForm 模型预测复核</title>'
        '<style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#f3eee6;color:#1c2128;margin:24px}h1{font-size:28px}h2{font-size:19px}img{width:100%;height:auto}a{color:#495f80}nav{max-height:140px;overflow:auto}nav a{margin-right:16px;white-space:nowrap}section{background:#faf7f2;padding:16px;margin:24px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}</style>'
        '<h1>模型预测复核 · 待人工标注</h1>' + failed_notice + '<p>每帧从左到右为原图及本次成功运行的模型（列名见图上方）。图上只画共同的12个身体点，JSON保留所有模型返回点及所有人物。'
        '绿点/实线为已选人物分数≥0.55，蓝色为未归属人物，橙色空心点/虚线为低分预测；图外点保留在JSON，未夹到边缘。'
        '数字为MediaPipe语义点号，P编号仅在本帧内有效。</p><p><strong>没有人工标注，不报告精度、漏检率或人工角度覆盖率。</strong>'
        '两个模型的分数含义不同，颜色不能当作准确性。单人检测也可能选中错误的人。耗时为本次单遍观测，含首帧启动开销，不能作为新的速度排名。</p>'
        '<p>为了避免模型结果影响人工真值，请先在无预测叠加的试标页面独立标注，再查看此页复核。无法可靠定位的点设为未知。</p>'
        '<p><a href="review.json">逐帧状态与耗时 JSON</a></p><nav>' + links + '</nav>' + ''.join(sections) + '</html>', encoding='utf-8')
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--dataset', type=Path, required=True)
    p.add_argument('--run', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    result = render(a.dataset, a.run, a.output)
    print(f"Rendered {len(result['frames'])} frames; human reviewed: {result['human_reviewed_frames']}; no accuracy calculated")
