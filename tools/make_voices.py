#!/usr/bin/env python3
"""MAKE_VOICES.PY — sample voice clips for every spoken line, from locales.json.

Uses the voices built into macOS (`say`), so it costs nothing and sends no
text anywhere. These are SAMPLE voices, good enough to hear the pacing; swap
in recorded or AI voices later by replacing the files listed in the manifest.

    python3 tools/make_voices.py          # run from the game's folder

Writes assets/voice/<id>.m4a and assets/voice/manifest.json. The manifest is
keyed by the line's own wording (lower-cased, spaces collapsed) — the same key
VOICE.JS looks a line up by — so changing a line in locales.json only needs
this script to be run again. A line with no clip is still shown and paced,
just silently.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'voice')

# who speaks with which macOS voice, and how fast (words per minute)
VOICES = {
    'narrator': ('Daniel', 165),   # warm UK storyteller
    'veth':     ('Rishi', 165),    # Commander Veth, who teaches
    'rill':     ('Aman', 175),     # Rill
    'team':     ('Tara', 175),     # the team member
    'computer': ('Fred', 165),     # the control-centre computer
}

ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
        'eighteen', 'nineteen']
TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']


def two(n):
    return ONES[n] if n < 20 else TENS[n // 10] + ('-' + ONES[n % 10] if n % 10 else '')


def three(n):
    h, r = divmod(n, 100)
    return ' '.join(x for x in [(ONES[h] + ' hundred') if h else '', two(r) if r else ''] if x)


def indian_words(n):
    """4,32,56,781 -> four crore thirty-two lakh fifty-six thousand seven hundred eighty-one"""
    if n == 0:
        return 'zero'
    parts = []
    for size, name in ((10 ** 7, 'crore'), (10 ** 5, 'lakh'), (10 ** 3, 'thousand')):
        q, n = divmod(n, size)
        if q:
            parts.append((three(q) if q >= 100 else two(q)) + ' ' + name)
    if n:
        parts.append(three(n))
    return ' '.join(parts)


def spoken(text):
    """what the voice should actually say: Indian-grouped figures read the
    Indian way, the arrow read as 'becomes', and shouted words in lower case
    so they are read as words rather than spelled out"""
    t = re.sub(r'\d{1,2}(?:,\d{2})+,\d{3}|\d{1,3},\d{3}',
               lambda m: indian_words(int(m.group(0).replace(',', ''))), text)
    t = t.replace('→', ' becomes ')
    t = re.sub(r'\b([A-Z]{2,})\b', lambda m: m.group(1).capitalize(), t)
    return t


def group_lines(n):
    """the guided read-back, one caption per group, exactly as TEACH.JS's
    groupLine() builds them: "Four crore…", …, "Seven hundred eighty-one." """
    parts = []
    for size, name in ((10 ** 7, 'crore'), (10 ** 5, 'lakh'), (10 ** 3, 'thousand')):
        q, n = divmod(n, size)
        if q:
            parts.append((three(q) if q >= 100 else two(q)) + ' ' + name)
    if n:
        parts.append(three(n))
    return [p[0].upper() + p[1:] + ('.' if i == len(parts) - 1 else '\u2026')
            for i, p in enumerate(parts)]


def correct_line(n, system, template):
    """Level 2's read-back, built exactly as COMMAS.JS's spokenParts() does:
    "Correct! The number is 3 crore 46 lakh 25 thousand 7 hundred 81." """
    units = ([(10 ** 7, 'crore'), (10 ** 5, 'lakh'), (10 ** 3, 'thousand')] if system == 'in'
             else [(10 ** 9, 'billion'), (10 ** 6, 'million'), (10 ** 3, 'thousand')])
    parts, rest = [], n
    for size, name in units:
        q, rest = divmod(rest, size)
        if q:
            parts.append('%d %s' % (q, name))
    h, r = divmod(rest, 100)
    if h:
        parts.append('%d hundred' % h)
    if r:
        parts.append(str(r))
    return template.replace('{n}', ' '.join(parts))


def cap(t):
    return t[0].upper() + t[1:]


def key(text):
    """the same key VOICE.JS builds: tags out, spaces collapsed, lower case"""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', str(text))).strip().lower()


def link_countries(L):
    """the shared list of countries and numbers (locales.json "countries"),
    joined onto both levels exactly as game.js's linkCountries() does"""
    lst = L.get('countries', [])
    by = {c['country']: c['n'] for c in lst}
    for k, t in enumerate(L['teach']['level4']['tries']):
        if k < len(lst):
            t['country'], t['target'] = lst[k]['country'], lst[k]['n']
    C = L['commas']
    # Level 2 has its own list (commas.countries), 12 Nov 2026
    by2 = {c['country']: c['n'] for c in C.get('countries', lst)}
    for g in C['guided'] + C['practice']:
        if g['country'] in by2:
            g['n'] = by2[g['country']]


def group_hints(n, H):
    """one hint per digit group of the 9-place chart, as groupHint() words it"""
    w = str(n).rjust(9, '0')
    out = []
    for name, a, b in (('crore', 0, 2), ('lakh', 2, 4), ('thousand', 4, 6), ('ones', 6, 9)):
        part = w[a:b]; val = int(part)
        k = name + ('' if val else '0')
        out.append(H[k].replace('{n}', part if name == 'ones' else str(val)))
    return out


def group_digits(n, system):
    """the digit groups from the right, as COMMAS.JS's groups() makes them:
    the digits of each group, ones first"""
    s = str(n)
    counts = [3, 5, 7, 9, 11] if system == 'in' else [3, 6, 9, 12]
    cuts = [len(s)] + [len(s) - r for r in counts if r < len(s)] + [0]
    return [s[cuts[k + 1]:cuts[k]] for k in range(len(cuts) - 1)]


def lines(L):
    """every line the game says, with who says it"""
    link_countries(L)
    out = []
    add = lambda who, t: t and out.append((who, t))
    S, T4, C = L['story'], L['teach']['level4'], L['commas']

    add('narrator', L['cover']['vo'])
    for k, who in [('request', 'veth'), ('ready', 'rill'), ('error', 'computer'), ('verify', 'rill'), ('check', 'veth')]:
        add(who, S['lines'][k])

    add('veth', T4['context'])
    for b in T4['beats']:
        add('veth', b)
    for h in T4.get('howTo', []):
        add('veth', h)
    add('veth', T4.get('speakerHint'))
    # the number names, said when the number box is tapped
    add('narrator', cap(indian_words(T4['example'])))
    for t in T4['tries']:
        add('narrator', cap(indian_words(t['target'])))
    for t in T4['tries']:
        add(t.get('who', 'veth'), t['say'])
        add(t.get('rightWho', 'computer'), t['right'])
        # 13 Nov 2026: the hint names the first wrong group, so every group's
        # hint for this number is made (TEACH.JS's groupHint())
        for h in group_hints(t['target'], T4['hints']):
            add('veth', t['fb1'] + ' ' + h)
        add('veth', t['fb3'])
        add('veth', t['idle'])
        if t.get('after'):
            add('veth', t['after'])
    add(T4.get('doneWho', 'team'), T4['done'])
    add('veth', T4['outro'])

    for t in C['teach']:
        add('veth', t)
    for g in C['guided']:
        gd = group_digits(g['n'], g['sys'])
        for j, st in enumerate(g['steps']):
            for k in ('say', 'right', 'fb1', 'fb2', 'idle'):
                add('veth', st[k])
            # "Place the comma before 547." — the digits come from the number
            add('veth', st['fb3'].replace('{d}', gd[j]))
        for k in ('remaining', 'ready', 'sent'):
            add('veth', g[k])
    for k in ('transitionIdle', 'sendIdle', 'yourTurn', 'prepIn', 'prepIntl', 'wrong1', 'wrong2',
              'wrong3in', 'wrong3intl'):
        add('veth', C[k])
    add('veth', C['retry'])
    for p in C['practice']:
        # every report is done in both systems, Indian first (11 Nov 2026)
        for sys in ('in', 'intl'):
            add('veth', correct_line(p['n'], sys, C['correct']))
            add(C.get('readyWho', 'computer'), C['readyIn' if sys == 'in' else 'readyIntl'])
        add('veth', C['idle'].replace('{c}', p['country']))

    add('rill', S['end']['rill'])
    add('veth', S['end']['veth'])

    seen, uniq = set(), []
    for who, t in out:
        if key(t) not in seen:
            seen.add(key(t))
            uniq.append((who, t))
    return uniq


def duration_ms(path):
    info = subprocess.run(['afinfo', path], capture_output=True, text=True).stdout
    m = re.search(r'estimated duration:\s*([\d.]+)', info)
    return int(float(m.group(1)) * 1000) if m else 0


def main():
    if sys.platform != 'darwin':
        sys.exit('This script uses the macOS voices (say/afconvert) — run it on a Mac.')
    L = json.load(open(os.path.join(ROOT, 'locales.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    manifest, keep = {}, set()
    with tempfile.TemporaryDirectory() as tmp:
        for who, text in lines(L):
            voice, rate = VOICES[who]
            # 13 Nov 2026: a breath of silence before and after every line,
            # so neither its first nor its last syllable can be clipped
            say = '[[slnc 60]] ' + spoken(text) + ' [[slnc 260]]'
            fid = who + '-' + hashlib.sha1((voice + str(rate) + say).encode()).hexdigest()[:10]
            dst = os.path.join(OUT, fid + '.m4a')
            if not os.path.exists(dst):
                aiff = os.path.join(tmp, fid + '.aiff')
                # `say` can stall the first time a voice is loaded: try again
                for attempt in range(3):
                    try:
                        subprocess.run(['say', '-v', voice, '-r', str(rate), '-o', aiff, say],
                                       check=True, timeout=30)
                        break
                    except subprocess.TimeoutExpired:
                        print('  say stalled, retrying', fid)
                else:
                    print('  SKIPPED (no clip):', text[:60])
                    continue
                subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', aiff, dst], check=True)
                print('made', fid, '-', text[:60])
            manifest[key(text)] = {'file': fid + '.m4a', 'ms': duration_ms(dst), 'who': who}
            keep.add(fid + '.m4a')
    # clips for lines that no longer exist go
    for f in os.listdir(OUT):
        if f.endswith('.m4a') and f not in keep:
            os.remove(os.path.join(OUT, f))
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print(len(manifest), 'lines in assets/voice/manifest.json')


if __name__ == '__main__':
    main()
