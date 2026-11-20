#!/usr/bin/env python3
"""CSS_DEAD.PY — lists (or with --fix removes) CSS rules that can never match.

    python3 tools/css_dead.py [--fix]

A rule is dead when ANY class or id in EVERY one of its selectors appears
nowhere in index.html, game.js or preload.js (the only places markup and class
names are made). Also reports @keyframes no animation names, and custom
properties (--x) that nothing reads. Run after removing code; check the game.
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = '--fix' in sys.argv
code = ''.join(open(os.path.join(ROOT, f), encoding='utf-8').read() for f in ('index.html', 'game.js', 'preload.js'))
words = set(re.findall(r'[A-Za-z_][\w-]*', code))
# class names the code builds ('hq-' + sys): anything with that prefix counts as used
prefixes = set(re.findall(r"([A-Za-z][\w-]*-)['\"]\s*\+", code))

def selector_dead(sel):
    sel = re.sub(r':(?:not|is|where|has)\(([^()]*)\)', ' ', sel)       # inner selectors are filters: ignore
    sel = re.sub(r'\[[^\]]*\]', '', sel)
    toks = re.findall(r'[.#]([A-Za-z_][\w-]*)', sel)
    return any(t not in words and not any(t.startswith(p) for p in prefixes) for t in toks)

def parse(css):
    """top-level and @media-nested rules: yields (start, end, selector, block_text)"""
    out, i, n = [], 0, len(css)
    def walk(s, e, depth):
        i = s
        while i < e:
            if css.startswith('/*', i):
                j = css.find('*/', i + 2); i = (j + 2) if j >= 0 else e; continue
            j = css.find('{', i)
            if j < 0 or j >= e: break
            head = css[i:j].strip()
            # find matching brace
            d, k = 1, j + 1
            while k < e and d:
                if css.startswith('/*', k):
                    k = css.find('*/', k + 2) + 2; continue
                if css[k] == '{': d += 1
                elif css[k] == '}': d -= 1
                k += 1
            # strip leading comments from head for display
            hs = re.sub(r'/\*.*?\*/', '', head, flags=re.S).strip()
            if hs.startswith('@media') or hs.startswith('@supports'):
                walk(j + 1, k - 1, depth + 1)
            else:
                out.append((i + (len(head) - len(head.lstrip())) + len(css[i:j]) - len(css[i:j].lstrip()) if False else css.find(hs, i), k, hs, css[j:k]))
            i = k
    walk(0, n, 0)
    return out

all_css = {f: open(os.path.join(ROOT, f), encoding='utf-8').read() for f in sorted(os.listdir(ROOT)) if f.endswith('.css')}
anim_used = set()
for c in all_css.values():
    for m in re.finditer(r'animation(?:-name)?\s*:\s*([^;}]+)', c):
        anim_used |= set(re.findall(r'[A-Za-z_][\w-]*', m.group(1)))
anim_used |= words
var_used = set(re.findall(r'var\(\s*(--[\w-]+)', ''.join(all_css.values()) + code)) | set(re.findall(r"'(--[\w-]+)'", code))

total_dead = 0
for f, css in all_css.items():
    rules = parse(css)
    dead = []
    for s, e, head, body in rules:
        if head.startswith('@keyframes'):
            name = head.split()[1]
            if name not in anim_used: dead.append((s, e, head))
            continue
        if head.startswith('@font-face') or head.startswith('@'):
            continue
        sels = [x.strip() for x in head.split(',') if x.strip()]
        if sels and all(selector_dead(x) for x in sels):
            dead.append((s, e, head))
    size = sum(e - s for s, e, _ in dead)
    total_dead += size
    print('%-12s %4d rules, %3d dead (%d of %d bytes)' % (f, len(rules), len(dead), size, len(css)))
    if '-v' in sys.argv:
        for s, e, h in dead: print('     ', h[:90].replace('\n', ' '))
    if FIX and dead:
        for s, e, h in sorted(dead, reverse=True):
            css = css[:s] + css[e:]
        css = re.sub(r'\n{3,}', '\n\n', css)
        open(os.path.join(ROOT, f), 'w', encoding='utf-8').write(css)
unused_vars = set()
for c in all_css.values():
    unused_vars |= {v for v in re.findall(r'(--[\w-]+)\s*:', c) if v not in var_used}
print('custom properties never read:', sorted(unused_vars))
print('dead CSS bytes:', total_dead)
