#!/usr/bin/env python3
"""GEN_ASSET_SIZES.PY — rewrites ASSET_SIZES in preload.js from the files on disk.

    python3 tools/gen_asset_sizes.py      # run from anywhere; after make_voices.py too

Keeps the pictures already listed (and drops any that no longer exist), then
adds the sound effects and every voice clip, the clips IN THE ORDER THE GAME
SAYS THEM (assets/voice/manifest.json's order), so the background download
fetches each line before it is needed.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE = os.path.join(ROOT, 'preload.js')

src = open(PRE, encoding='utf-8').read()
m = re.search(r'/\*SIZES\*/(\{.*?\})/\*END\*/', src, re.S)
old = json.loads(m.group(1))

sizes = {}
for p in old:
    if p.startswith(('assets/voice/', 'assets/audio/sfx/')):
        continue
    if os.path.exists(os.path.join(ROOT, p)):
        sizes[p] = os.path.getsize(os.path.join(ROOT, p))

sfx = os.path.join(ROOT, 'assets', 'audio', 'sfx')
for f in sorted(os.listdir(sfx)):
    if f.endswith('.m4a'):
        sizes['assets/audio/sfx/' + f] = os.path.getsize(os.path.join(sfx, f))

manifest = json.load(open(os.path.join(ROOT, 'assets', 'voice', 'manifest.json'), encoding='utf-8'))
for v in manifest.values():
    p = 'assets/voice/' + v['file']
    if p not in sizes and os.path.exists(os.path.join(ROOT, p)):
        sizes[p] = os.path.getsize(os.path.join(ROOT, p))

block = '/*SIZES*/' + json.dumps(sizes, indent=1, ensure_ascii=False) + '/*END*/'
src = src[:m.start()] + block + src[m.end():]
open(PRE, 'w', encoding='utf-8').write(src)
print(len(sizes), 'files in ASSET_SIZES')
