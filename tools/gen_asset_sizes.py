#!/usr/bin/env python3
"""GEN_ASSET_SIZES.PY — rewrites ASSET_SIZES in preload.js from the files on disk.

    python3 tools/gen_asset_sizes.py      # after convert_media.py / make_voices.py;
                                          # then stamp_build.py

20 Nov 2026: THE PRELOADER FETCHES EVERY FILE THE GAME USES (START waits for
100%), so the list is every media file under assets/ — pictures, fonts, music,
sound effects and the voice lines the manifest names — weighted by its real
size on disk. Licence and credit texts and the manifest itself are not media
and are not listed. Keep assets/ to live files only: anything placed there is
downloaded before START.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE = os.path.join(ROOT, 'preload.js')
MEDIA = ('.webp', '.ogg', '.webm', '.woff2', '.jpg', '.jpeg', '.png', '.m4a')

src = open(PRE, encoding='utf-8').read()
m = re.search(r'/\*SIZES\*/(\{.*?\})/\*END\*/', src, re.S)

man = json.load(open(os.path.join(ROOT, 'assets', 'voice', 'manifest.json'), encoding='utf-8'))
voices = {'assets/voice/' + v['file'] for v in man.values()}

sizes = {}
for d, _, files in os.walk(os.path.join(ROOT, 'assets')):
    for f in sorted(files):
        rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
        if not f.lower().endswith(MEDIA):
            continue
        if rel.startswith('assets/voice/') and rel not in voices:
            print('  not in the manifest, skipped:', rel)
            continue
        sizes[rel] = os.path.getsize(os.path.join(ROOT, rel))
missing = sorted(v for v in voices if v not in sizes)
if missing:
    print('  manifest names missing clips:', missing)

sizes = dict(sorted(sizes.items()))
block = '/*SIZES*/' + json.dumps(sizes, indent=1, ensure_ascii=False) + '/*END*/'
src = src[:m.start()] + block + src[m.end():]
open(PRE, 'w', encoding='utf-8').write(src)
print(len(sizes), 'files,', sum(sizes.values()), 'bytes in ASSET_SIZES')
