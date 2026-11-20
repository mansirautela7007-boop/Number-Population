#!/usr/bin/env python3
"""CONVERT_MEDIA.PY — every audio file to Ogg (Opus), every JPG/PNG to WebP.

    python3 tools/convert_media.py [--dry]      # then: gen_asset_sizes.py, stamp_build.py

Needs ffmpeg built with libopus (system `ffmpeg`, or `pip install imageio-ffmpeg`)
and Pillow with WebP (`pip install pillow`).

THE RULE: A CONVERTED FILE IS NEVER BIGGER THAN ITS SOURCE. Each file is
encoded at its target first (voices and effects Opus 64k, music Opus 96k,
pictures WebP q82); if the result is not smaller than the source it is
re-encoded at ~70% of the source's own bitrate (audio) or at a lower quality
(pictures); if it is STILL not smaller, the source is left as it is and the
file is reported. Source resolution and sample layout are kept.

Browser support: Ogg Opus plays in Chrome, Edge, Firefox and Safari 18.4+
(iOS/iPadOS 18.4+); WebP in all of them (Safari 14+).

Sources are deleted only after a smaller output is written; the voice
manifest (assets/voice/manifest.json) is updated to the new file names.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry' in sys.argv


def ffmpeg_exe():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('ffmpeg not found: install it, or `pip install imageio-ffmpeg`')


FF = ffmpeg_exe()


def probe(path):
    """(duration s, audio bitrate kb/s, channels) from ffmpeg's banner"""
    err = subprocess.run([FF, '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    d = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err)
    dur = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0
    br = re.search(r'Audio:.*?(\d+) kb/s', err)
    ch = 1 if re.search(r'Audio:.*?\bmono\b', err) else 2
    return dur, (int(br.group(1)) if br else None), ch


def opus(src, dst, kbps, ch):
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vn', '-map_metadata', '-1',
                    '-c:a', 'libopus', '-b:a', '%dk' % kbps, '-vbr', 'on', '-compression_level', '10',
                    '-ac', str(ch), dst], check=True)


def audio_target(rel):
    if '/music/' in rel:
        return 96
    return 64


def convert_audio(rel):
    src = os.path.join(ROOT, rel)
    dst_rel = os.path.splitext(rel)[0] + '.ogg'
    dst = os.path.join(ROOT, dst_rel)
    size = os.path.getsize(src)
    dur, br, ch = probe(src)
    tmp = tempfile.mktemp(suffix='.ogg')
    opus(src, tmp, audio_target(rel), ch)
    how = 'opus %dk' % audio_target(rel)
    if os.path.getsize(tmp) >= size:
        # the second pass: ~70% of what the source actually spends per second
        src_kbps = size * 8 / 1000 / dur if dur else (br or 64)
        k = max(16, int(src_kbps * 0.70))
        opus(src, tmp, k, ch)
        how = 'opus %dk (70%% of source)' % k
    out = os.path.getsize(tmp)
    if out >= size:
        os.remove(tmp)
        return rel, rel, size, size, 'KEPT SOURCE (no smaller encode)'
    if not DRY:
        shutil.move(tmp, dst)
        os.remove(src)
    else:
        os.remove(tmp)
    return rel, dst_rel, size, out, how


def convert_image(rel):
    from PIL import Image
    src = os.path.join(ROOT, rel)
    dst_rel = os.path.splitext(rel)[0] + '.webp'
    dst = os.path.join(ROOT, dst_rel)
    size = os.path.getsize(src)
    im = Image.open(src)
    alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if alpha else 'RGB')
    tmp = tempfile.mktemp(suffix='.webp')
    for q in (82, 75, 65):
        im.save(tmp, 'WEBP', quality=q, method=6)
        if os.path.getsize(tmp) < size:
            break
    out = os.path.getsize(tmp)
    if out >= size:
        os.remove(tmp)
        return rel, rel, size, size, 'KEPT SOURCE (no smaller encode)'
    if not DRY:
        shutil.move(tmp, dst)
        os.remove(src)
    else:
        os.remove(tmp)
    return rel, dst_rel, size, out, 'webp q%d' % q


def main():
    rows = []
    for d, _, files in os.walk(os.path.join(ROOT, 'assets')):
        for f in sorted(files):
            rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
            ext = f.rsplit('.', 1)[-1].lower()
            if ext in ('m4a', 'mp3', 'wav', 'aac'):
                rows.append(convert_audio(rel))
            elif ext in ('jpg', 'jpeg', 'png'):
                rows.append(convert_image(rel))
    # the voice manifest follows the new names
    man_path = os.path.join(ROOT, 'assets', 'voice', 'manifest.json')
    renamed = {os.path.basename(a): os.path.basename(b) for a, b, *_ in rows if a != b and '/voice/' in a}
    if renamed and not DRY:
        man = json.load(open(man_path, encoding='utf-8'))
        for v in man.values():
            v['file'] = renamed.get(v['file'], v['file'])
        json.dump(man, open(man_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    tot = {}
    for a, b, s, o, how in rows:
        kind = 'voice' if '/voice/' in a else 'music' if '/music/' in a else 'sfx' if '/sfx/' in a else 'image'
        t = tot.setdefault(kind, [0, 0, 0])
        t[0] += 1; t[1] += s; t[2] += o
        if kind not in ('voice',) or 'KEPT' in how:
            print('%-55s %9d -> %9d  %s' % (a, s, o, how))
    for k, (n, s, o) in tot.items():
        print('%-6s %4d files  %10d -> %10d bytes  (%.0f%%)' % (k, n, s, o, 100.0 * o / s if s else 0))
    bigger = [r for r in rows if r[3] > r[2]]
    print('outputs bigger than source:', len(bigger))


if __name__ == '__main__':
    main()
