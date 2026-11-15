"""Render three independent HTML directions from one shared content fixture.

Run with the repository .venv Python (fontTools is already installed).
No product source files or application data are modified.
"""
import html
import json
from pathlib import Path
from fontTools import subset

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
content = json.loads((HERE / 'content.json').read_text(encoding='utf-8'))
content['FONT_URL'] = 'assets/shotform-ui.ttf'
texts = []
for name in ('a', 'b', 'c'):
    text = (HERE / 'sources' / f'{name}.html.in').read_text(encoding='utf-8')
    for key, value in content.items():
        text = text.replace('{{' + key + '}}', html.escape(value, quote=True))
    if '{{' in text:
        raise ValueError(f'Unresolved content placeholder in {name}')
    (HERE / f'{name}.html').write_text(text, encoding='utf-8')
    texts.append(text)

# Preserve the existing brand font while keeping the offline comparison small.
options = subset.Options()
font = subset.load_font(str(ROOT / 'public/fonts/HarmonyOS_Sans_SC_Regular.ttf'), options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=''.join(texts))
subsetter.subset(font)
subset.save_font(font, str(HERE / 'assets/shotform-ui.ttf'), options)
print('Rendered a.html, b.html, c.html and a shared brand-font subset.')
