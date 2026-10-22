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
    'rill':     ('Rishi', 168),    # the Officer
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


def key(text):
    """the same key VOICE.JS builds: tags out, spaces collapsed, lower case"""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', str(text))).strip().lower()


def lines(L):
    """every line the game says, with who says it"""
    out = []
    add = lambda who, t: t and out.append((who, t))
    S, T4, C = L['story'], L['teach']['level4'], L['commas']

    add('narrator', S['lines']['narrator'])
    for k, who in [('hello', 'rill'), ('ready', 'team'), ('error', 'computer'), ('verify', 'team'),
                   ('huge', 'team'), ('check', 'rill'), ('closer', 'rill'), ('started', 'computer')]:
        add(who, S['lines'][k])

    add('narrator', T4['narrator'])
    add('rill', T4['context'])
    for b in T4['beats']:
        add('rill', b)
    add('rill', L['lines']['swipe'])
    for t in T4['tries']:
        add(t.get('who', 'rill'), t['say'])
        add('computer', t['right'])
        add('rill', t['fb1'] + ' ' + t['fb2'])
        add('rill', t['fb3'])
        add('rill', t['idle'])
    add('team', T4['done'])
    add('rill', T4['outro'])

    add('narrator', C['narrator'])
    for i, t in enumerate(C['teach']):
        add('computer' if i == 0 else 'rill', t)
    for k in ('transitionIdle', 'howTo', 'prepIn', 'prepIntl', 'wrong1', 'wrong2', 'wrong3in', 'wrong3intl'):
        add('rill', C[k])
    for p in C['practice']:
        add('computer', C['ready'].replace('{c}', p['country']))
        add('rill', C['idle'].replace('{c}', p['country']))
    add('team', C['done'])

    add('team', S['end']['team'])
    add('rill', S['end']['officer'])

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
            say = spoken(text)
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
