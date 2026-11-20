#!/usr/bin/env python3
"""STAMP_BUILD.PY — fingerprints every file the game loads, so a browser can
never run an old copy from its cache.

    python3 tools/stamp_build.py      # run LAST, before every upload/share:
                                      # after make_voices.py and gen_asset_sizes.py

WHY. A normal browser window keeps the files it has downloaded and may reuse
them without asking the server again; a private (incognito) window always
downloads fresh. Files the game updates under the SAME name (game.js, the CSS,
locales.json, the voice manifest, a re-made clip or picture) could then differ
between the two windows. Each file's URL now carries a short hash of its
contents (?v=1a2b3c4d), so a changed file has a new URL and is always fetched,
and an unchanged one is still served from the cache.

What it writes:
  preload.js   the /*HASHES*/…/*END*/ map: every file under assets/ plus
               locales.json -> its hash. ASSET() and the preloader add it.
  *.css        url('assets/…') references get ?v=
  index.html   the stylesheet, script and preload links get ?v=, and the
               page's own build id (a stale cached copy of index.html
               notices the newer build and reloads itself once)
"""
import hashlib
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def h(path):
    with open(os.path.join(ROOT, path), 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def read(p):
    return open(os.path.join(ROOT, p), encoding='utf-8').read()


def write(p, s):
    open(os.path.join(ROOT, p), 'w', encoding='utf-8').write(s)


# 1. every asset, and the text file, into preload.js
hashes = {}
for d, _, files in os.walk(os.path.join(ROOT, 'assets')):
    for f in sorted(files):
        if f.startswith('.'):
            continue
        rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
        hashes[rel] = h(rel)
hashes['locales.json'] = h('locales.json')
hashes = dict(sorted(hashes.items()))

pre = read('preload.js')
block = '/*HASHES*/' + json.dumps(hashes, indent=0, ensure_ascii=False) + '/*END*/'
pre, n = re.subn(r'/\*HASHES\*/\{.*?\}/\*END\*/', lambda m: block, pre, flags=re.S)
assert n == 1, 'preload.js has no /*HASHES*/ block'
write('preload.js', pre)


def stamp(ref):
    """'assets/x.webp' or 'assets/x.webp?v=old' -> 'assets/x.webp?v=<hash>'"""
    bare = ref.split('?')[0]
    path = bare
    try:
        from urllib.parse import unquote
        path = unquote(bare)
    except Exception:
        pass
    if not os.path.isfile(os.path.join(ROOT, path)):
        return ref
    return bare + '?v=' + h(path)


# 2. url() references inside the stylesheets
css_files = sorted(f for f in os.listdir(ROOT) if f.endswith('.css'))
for c in css_files:
    s = read(c)
    s2 = re.sub(r"url\((['\"]?)((?:assets/)[^'\")]+)\1\)",
                lambda m: 'url(' + m.group(1) + stamp(m.group(2)) + m.group(1) + ')', s)
    if s2 != s:
        write(c, s2)

# 3. index.html: every local href/src, then the build id over all of it
idx = read('index.html')
idx = re.sub(r'((?:href|src)=")([^"#:]+?\.(?:css|js|jpg|jpeg|png|webp|woff2|json))(?:\?v=[0-9a-f]+)?(")',
             lambda m: m.group(1) + stamp(m.group(2)) + m.group(3), idx)
everything = ''.join(sorted(hashes.values())) + ''.join(h(c) for c in css_files) + h('preload.js') + h('game.js')
build = hashlib.md5(everything.encode()).hexdigest()[:10]
idx, n = re.subn(r'<meta name="build" content="[^"]*">', '<meta name="build" content="' + build + '">', idx)
assert n == 1, 'index.html has no <meta name="build">'
write('index.html', idx)

print('build', build, '-', len(hashes), 'assets fingerprinted')
