#!/usr/bin/env python3
"""
publish_album.py -- put the newest chance album on the site.

Takes the most recent album_* folder made by chance_fontana.py / chance_data.py (or the one
given), and writes into the site's exp/chance/ folder:

    tracks/01.mp3 ...   streamable MP3s (128 kbps), tagged; the WAVs stay here
    cover.jpg           a cover drawn from the songs themselves: each song is a ring, read
                        clockwise from the top like a record; distance from the centre is
                        pitch (low inside, high outside), ink is loudness
    banner.jpg          a blurred strip of that cover, for the page header
    album.json          title, tracks, durations, credits -- everything the page shows

The album's title is invented from the songs' own material (a cut-up of their titles),
seeded by the album, so the same album always gets the same title and cover.
The previous album's MP3s in the site folder are replaced.

Usage:
    python publish_album.py                       # the newest album here
    python publish_album.py album_2026-10-27_144430_fontana
    python publish_album.py --site C:/path/to/samrobertsbaca.github.io/exp/chance
"""
import argparse
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import tempfile
import wave
import zipfile
import zlib

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(HERE) == 'engine':                  # running from the site repo: publish beside it
    SITE = os.path.dirname(HERE)
else:
    SITE = r"C:\Users\samro\OneDrive\Documents\GitHub\samrobertsbaca.github.io\exp\chance"
REPO = os.environ.get('GITHUB_REPOSITORY', 'samrobertsbaca/samrobertsbaca.github.io')
SITE_ROOT = os.path.dirname(os.path.dirname(SITE))      # the site itself, for scorsby's face
ARTIST = "ScorsBT4"                                 # the machine that plays the world's radio
ASKER = "Samuel John Scorsby"                           # who asked it the questions
QUOTE = "All computer programming is basically question asking, rather than choice making."
INKS = ["#00B4FF", "#EB000E", "#B34777", "#100E0E"]       # the page's own colours
PAPER = "#FDF9F8"


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def read_wav_mono(path, decim=4):
    """a 24- or 16-bit WAV as mono floats, averaged down by `decim` (for analysis only)."""
    with wave.open(path, 'rb') as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        out = []
        step = sr * 30
        for a in range(0, n, step):
            raw = np.frombuffer(w.readframes(min(step, n - a)), dtype=np.uint8)
            if sw == 3:
                b = raw.reshape(-1, 3).astype(np.int32)
                v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
                v = np.where(v >= 1 << 23, v - (1 << 24), v) / float(1 << 23)
            else:
                v = raw.view('<i2').astype(np.float64) / 32768.0
            v = v.reshape(-1, ch).mean(axis=1)
            m = len(v) // decim * decim
            out.append(v[:m].reshape(-1, decim).mean(axis=1))
    return np.concatenate(out), sr / decim, n / sr


def song_rings(x, sr, steps=900, bands=56):
    """loudness in `bands` log-spaced bands at `steps` moments through the song (0..1)."""
    nfft = 1024
    edges = np.geomspace(60.0, min(5500.0, sr / 2 - 1), bands + 1)
    f = np.fft.rfftfreq(nfft, 1 / sr)
    which = np.clip(np.searchsorted(edges, f) - 1, -1, bands - 1)
    pos = np.linspace(0, max(0, len(x) - nfft), steps).astype(int)
    win = np.hanning(nfft)
    frames = np.stack([x[p:p + nfft] for p in pos]) * win
    P = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    M = np.zeros((steps, bands))
    for b in range(bands):
        sel = which == b
        if sel.any():
            M[:, b] = P[:, sel].mean(axis=1)
    M = 10 * np.log10(M + 1e-12)
    lo, hi = np.percentile(M, 8), np.percentile(M, 99.5)
    return np.clip((M - lo) / max(1e-9, hi - lo), 0, 1)


def song_mood(x, sr):
    """four plain measures of a song: where its sound sits (spectral centre), how loud it is,
    how noisy (spectral flatness: hiss and static against clear tones), how much it moves."""
    n = 2048
    hop = max(n, len(x) // 400)
    pos = np.arange(0, max(1, len(x) - n), hop)
    fr = np.stack([x[p:p + n] for p in pos]) * np.hanning(n)
    P = np.abs(np.fft.rfft(fr, axis=1)) ** 2 + 1e-12
    f = np.fft.rfftfreq(n, 1 / sr)
    band = (f >= 60) & (f <= min(5500, sr / 2 - 1))
    Pb = P[:, band]
    e = np.sqrt(np.mean(fr ** 2, axis=1)) + 1e-9
    return {'log_centre': float(np.log(np.median((Pb * f[band]).sum(axis=1) / Pb.sum(axis=1)))),
            'rms_db': float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)),
            'flatness': float(np.median(np.exp(np.mean(np.log(Pb), axis=1)) / np.mean(Pb, axis=1))),
            'movement': float(np.std(e) / np.mean(e))}


# where whole albums tend to fall (an album's average sits nearer the middle than its songs do),
# so that the differences between albums become differences of colour
MOOD_RANGES = {'brightness': ('log_centre', np.log(650.0), np.log(2000.0)),
               'energy': ('rms_db', -31.0, -21.0),
               'noise': ('flatness', 0.03, 0.40),
               'motion': ('movement', 0.55, 1.70)}


def album_mood(moods, durations):
    """the album's mood, 0..1 on each of brightness, energy, noise and motion."""
    if not moods:
        return {k: 0.5 for k in MOOD_RANGES}
    w = np.array(durations, dtype=float)
    w = w / w.sum() if w.sum() > 0 else np.ones(len(moods)) / len(moods)
    raw = {k: float(sum(m[k] * wi for m, wi in zip(moods, w))) for k in moods[0]}
    return {name: float(np.clip((raw[key] - lo) / (hi - lo), 0.0, 1.0))
            for name, (key, lo, hi) in MOOD_RANGES.items()}


def mood_palette(m):
    """the album's colours from its mood. brightness turns the hue through deep blue, violet,
    magenta, red and orange to gold; energy makes the inks vivid or muted; noise greys them;
    a still album gets close colours, a restless one contrasting ones. the fourth ink is a
    deep shade of the album's own hue."""
    import colorsys
    hue = (215.0 + 265.0 * m['brightness']) % 360.0
    sat = float(np.clip((0.28 + 0.65 * m['energy']) * (1.0 - 0.5 * m['noise']), 0.12, 0.95))
    lum = 0.40 + 0.14 * m['brightness'] - 0.06 * (1 - m['energy'])
    spread = 15.0 + 130.0 * m['motion']                  # how far apart the inks' hues sit
    spec = [(hue, sat, lum), (hue + spread, sat * 0.9, lum + 0.08), (hue - spread * 0.6, sat * 0.8, lum - 0.03),
            (hue, 0.25 + 0.3 * sat, 0.17 + 0.05 * m['brightness'])]
    hexes = []
    for h, s_, l in spec:
        r_, g_, b_ = colorsys.hls_to_rgb((h % 360) / 360.0, float(np.clip(l, 0.08, 0.8)), float(np.clip(s_, 0, 1)))
        hexes.append('#%02X%02X%02X' % (int(r_ * 255), int(g_ * 255), int(b_ * 255)))
    pr, pg, pb = colorsys.hls_to_rgb(hue / 360.0, 0.975, 0.45 * (1 - 0.6 * m['noise']))
    return hexes, '#%02X%02X%02X' % (int(pr * 255), int(pg * 255), int(pb * 255))


def draw_cover(rings, size=1200, seed=0, inks=None, paper_hex=None):
    """each song a ring: clockwise from the top is time, outward is pitch, ink is loudness."""
    rng = np.random.default_rng(seed)
    INKS_ = inks or INKS
    T = len(rings)
    paper = hexrgb(paper_hex or PAPER)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    c = (size - 1) / 2.0
    dx, dy = xx - c, yy - c
    r = np.hypot(dx, dy)
    theta = (np.arctan2(dx, -dy) % (2 * np.pi)) / (2 * np.pi)          # 0 at the top, clockwise
    R_out, R_in = size * 0.47, size * 0.11
    gap = size * 0.006
    width = (R_out - R_in) / T
    img = np.tile(paper, (size, size, 1))
    offset = int(rng.integers(len(INKS_)))
    for i, M in enumerate(rings):
        r1 = R_out - i * width                      # first song outermost
        r0 = r1 - width + gap
        sel = (r >= r0) & (r < r1)
        if not sel.any():
            continue
        steps, bands = M.shape
        band = np.clip(((r[sel] - r0) / (r1 - r0) * bands).astype(int), 0, bands - 1)
        t = np.clip((theta[sel] * steps).astype(int), 0, steps - 1)
        v = M[t, band] ** 1.6
        ink = hexrgb(INKS_[(i + offset) % len(INKS_)])
        img[sel] = paper * (1 - v[:, None]) + ink * v[:, None]
    R_label = R_in - gap * 2
    img[r < R_label] = paper                        # the label
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').filter(ImageFilter.SMOOTH)
    face_path = os.path.join(SITE_ROOT, 'scorsbyface.png')
    if os.path.exists(face_path):                   # scorsby at the centre of the record
        face = Image.open(face_path).convert('RGBA')
        side = int(R_label * 2 * 0.82)
        face.thumbnail((side, side), Image.LANCZOS)
        # centre the whole drawn silhouette, ears to chin, not the picture's frame (its margins are
        # uneven): the gap above the ears then equals the gap below the chin
        a = np.asarray(face)[:, :, 3] > 40
        rows = np.nonzero(a.any(axis=1))[0]
        cols_ = np.nonzero(a.any(axis=0))[0]
        cx, cy = face.width / 2.0, face.height / 2.0
        if len(rows) and len(cols_):
            cy = (rows[0] + rows[-1] + 1) / 2.0
            cx = (cols_[0] + cols_[-1] + 1) / 2.0
            cy -= 0.03 * (rows[-1] - rows[0])           # a touch low: it reads as centred to the eye
        im.paste(face, (int(round(c + 0.5 - cx)), int(round(c + 0.5 - cy))), face)
    return im


TITLE_SKIP = {'the', 'a', 'of', 'and', 'in', 'to', 'de', 'la', 'el', 'data', 'radio', 'fm', 'am'}


def album_title(track_titles, seed):
    """a cut-up of the songs' own titles, two to four words, sometimes a portmanteau."""
    rng = np.random.default_rng(seed)
    words = []
    for t in track_titles:
        for w in re.split(r'\s+', t):
            w = w.strip(".,;:()[]'\"")
            if re.search(r'[^\W\d_]', w) and '->' not in w and w.lower() not in TITLE_SKIP and len(w) > 1:
                words.append(w)
    nums = [w for t in track_titles for w in t.split() if re.fullmatch(r'\d+(\.\d+)?', w)]
    words = list(dict.fromkeys(words)) or ["Untitled"]
    k = int(min(len(words), rng.integers(2, 5)))
    pick = [words[i] for i in rng.choice(len(words), size=k, replace=False)]
    if len(pick) >= 2 and rng.random() < 0.3:
        a, b = pick[0], pick[1]
        pick[:2] = [a[:max(1, len(a) // 2)] + b[len(b) // 2:]]
    if nums and rng.random() < 0.35:
        pick.insert(int(rng.integers(len(pick) + 1)), nums[int(rng.integers(len(nums)))])
    return " ".join(w[:1].upper() + w[1:] for w in pick)


def heard_on(score_texts):
    """the stations, places and recordings heard on the album, from the scores."""
    seen = []
    for s in score_texts:
        for lab in re.findall(r'radio \[([^\]]+)\]', s):
            lab = re.sub(r', \d{4}-\d\d-\d\d \d\d:\d\d UTC', '', lab).strip()
            if lab not in seen:
                seen.append(lab)
    return seen


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('album', nargs='?', help='an album folder (default: the newest album_* in --albums)')
    ap.add_argument('--albums', default=HERE, help='where to look for album_* folders (default: here)')
    ap.add_argument('--site', default=SITE, help='the site folder to publish into')
    ap.add_argument('--bitrate', default='128k')
    ap.add_argument('--release', action='store_true',
                    help="put the MP3s, cover and banner on a GitHub release (needs gh and GH_TOKEN) instead "
                         "of in the site folder; only album.json is written into the site")
    ap.add_argument('--repo', default=REPO, help='owner/name of the repository for --release')
    ap.add_argument('--prune', action='store_true', help='only delete older chance-* releases, keeping --keep')
    ap.add_argument('--keep', type=int, default=2, help='with --prune: how many recent releases to keep')
    args = ap.parse_args()
    global SITE_ROOT
    SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(args.site)))
    if args.prune:
        return prune(args.repo, args.keep)

    if args.album:
        album = args.album if os.path.isabs(args.album) else os.path.join(args.albums, args.album)
    else:
        dirs = [d for d in glob.glob(os.path.join(args.albums, 'album_*')) if os.path.isdir(d)
                and glob.glob(os.path.join(d, '*.wav'))]
        if not dirs:
            raise SystemExit("no album_* folders with WAVs here")
        album = max(dirs, key=os.path.getmtime)
    wavs = sorted(glob.glob(os.path.join(album, '*.wav')))
    manifest = open(os.path.join(album, 'album.txt'), encoding='utf-8').read() \
        if os.path.exists(os.path.join(album, 'album.txt')) else ""
    m = re.search(r'album seed: (\d+)', manifest)
    seed = int(m.group(1)) % (1 << 62) if m else zlib.crc32(os.path.basename(album).encode())
    titles_in_manifest = {k: v for k, v in re.findall(r'^(\d+)  (?!\s)(.+)$', manifest, re.M)
                          if not re.match(r'\d+\.\d+ min', v)}
    ffmpeg = shutil.which('ffmpeg') or r"C:\ffmpeg\bin\ffmpeg.exe"
    print(f"publishing {os.path.basename(album)} ({len(wavs)} tracks) to {args.site}")

    tracks, rings, scores, moods = [], [], [], []
    for path in wavs:
        stem = os.path.splitext(os.path.basename(path))[0]
        num = re.match(r'(\d+)', stem)
        n = int(num.group(1)) if num else len(tracks) + 1
        title = titles_in_manifest.get(num.group(1) if num else '', None) or \
            re.sub(r'^\d+[ _]', '', stem).replace('_', ' ')
        x, asr, secs = read_wav_mono(path)
        rings.append(song_rings(x, asr))
        moods.append(song_mood(x, asr))
        sc = os.path.splitext(path)[0] + '.score.txt'
        if os.path.exists(sc):
            scores.append(open(sc, encoding='utf-8').read())
        tracks.append({'n': n, 'title': title.strip(), 'duration': round(secs, 2), 'src': f"tracks/{n:02d}.mp3"})
        print(f"  read {n:02d} {title.strip()[:50]} ({secs / 60:.1f} min)")

    name = album_title([t['title'] for t in tracks], seed)
    stamp = re.search(r'album_(\d{4}-\d\d-\d\d)', os.path.basename(album))
    day = datetime.date.fromisoformat(stamp.group(1)) if stamp else datetime.date.today()
    if args.release:                                     # media goes to a release; the site gets only json
        media = tempfile.mkdtemp(prefix='chance_release_')
        tag = f"chance-{day.isoformat()}"
        if gh('release', 'view', tag, '--repo', args.repo, check=False).returncode == 0:
            tag += datetime.datetime.now(datetime.timezone.utc).strftime('-%H%M%S')
        base = f"https://github.com/{args.repo}/releases/download/{tag}/"
        for t in tracks:
            t['file'] = f"{t['n']:02d}.mp3"
            t['src'] = base + t['file']
    else:
        media = args.site
        base = ""
        os.makedirs(os.path.join(args.site, 'tracks'), exist_ok=True)
        for old in glob.glob(os.path.join(args.site, 'tracks', '*.mp3')):
            os.remove(old)                               # the previous album's streams
        for t in tracks:
            t['file'] = t['src']
    # the cover first, so every MP3 can carry it; its colours come from the album's mood
    mood = album_mood(moods, [t['duration'] for t in tracks])
    inks, paper_hex = mood_palette(mood)
    print("  mood " + ", ".join(f"{k} {v:.2f}" for k, v in mood.items()) + " -> inks " + " ".join(inks))
    cover = draw_cover(rings, seed=seed, inks=inks, paper_hex=paper_hex)
    cover.save(os.path.join(media, 'cover.jpg'), quality=90)
    cover.resize((300, 300), Image.LANCZOS).save(os.path.join(media, 'cover_small.jpg'), quality=88)
    strip = cover.crop((0, 420, 1200, 640)).resize((975, 180), Image.LANCZOS)
    strip.filter(ImageFilter.GaussianBlur(14)).save(os.path.join(media, 'banner.jpg'), quality=85)
    art_dir = tempfile.mkdtemp(prefix='chance_art_')
    art = os.path.join(art_dir, 'art.jpg')               # a 600 px copy to embed: small, still sharp
    cover.resize((600, 600), Image.LANCZOS).save(art, quality=88)

    for t, path in zip(tracks, wavs):
        out = os.path.join(media, t.pop('file'))
        cmd = [ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-i', art,
               '-map', '0:a', '-map', '1:v', '-codec:a', 'libmp3lame', '-b:a', args.bitrate,
               '-codec:v', 'copy', '-disposition:v', 'attached_pic', '-id3v2_version', '3',
               '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)',
               '-metadata', f"title={t['title']}", '-metadata', f"artist={ARTIST}",
               '-metadata', f"album={name}", '-metadata', f"track={t['n']}/{len(tracks)}", out]
        subprocess.run(cmd, check=True)
        t['bytes'] = os.path.getsize(out)
        print(f"  encoded {os.path.basename(out)} ({t['bytes'] / 1e6:.1f} MB, cover inside)")
    shutil.rmtree(art_dir, ignore_errors=True)
    downloads = []
    if args.release:                                     # the whole album to take home, in two forms
        safe = re.sub(r'[^\w\- ]+', '', name).strip() or "album"
        for fmt_, note, files_, ext in (
                ("MP3", f"{args.bitrate.rstrip('k')} kbps",
                 [(os.path.join(media, f"{t['n']:02d}.mp3"), t) for t in tracks], 'mp3'),
                ("WAV", "24-bit/48kHz", [(w, t) for w, t in zip(wavs, tracks)], 'wav')):
            zname = f"chance-{day.isoformat()}-{ext}.zip"
            zpath = os.path.join(media, zname)
            with zipfile.ZipFile(zpath, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as z:
                for src, t in files_:
                    inner = re.sub(r'[<>:"/\\|?*]+', ' ', f"{t['n']:02d} {t['title']}").strip()
                    z.write(src, f"{safe}/{inner}.{ext}")
                z.write(os.path.join(media, 'cover.jpg'), f"{safe}/cover.jpg")     # as in a bandcamp download
                z.writestr(f"{safe}/about.txt",
                           f"{name}\n{ARTIST}\nquestions by {ASKER}\nmade by chance, {day.isoformat()}\n\n"
                           f"\"{QUOTE}\" -- John Cage\n")
            downloads.append({'format': fmt_, 'note': note, 'url': base + zname,
                              'bytes': os.path.getsize(zpath)})
            print(f"  zipped {zname} ({os.path.getsize(zpath) / 1e6:.0f} MB)")
        files = sorted(glob.glob(os.path.join(media, '*')))
        notes = (f"{name} -- {len(tracks)} songs made by chance on {day.isoformat()}. "
                 f"Streams on https://scorsby.us/exp/chance/ ; replaced by the next day's album.")
        gh('release', 'create', tag, *files, '--repo', args.repo, '--title', f"{name} ({day.isoformat()})",
           '--notes', notes, '--prerelease')
        print(f"  released {len(files)} files as {tag}")
        shutil.rmtree(media, ignore_errors=True)         # uploaded: the local copies can go

    heard = heard_on(scores)
    credits = [f"released {day.strftime('%B')} {day.day}, {day.year}", "",
               f"questions by {ASKER}", "",
               "made by chance with chance_data.py, chance_fontana.py and publish_album.py: every sound began as data, "
               "or as radio somewhere on Earth, tuned by chance"]
    if any('live microphone' in h for h in heard):
        credits.append("open microphones: Locus Sonus Locustream (locusonus.org)")
    if any(re.search(r'\barchive\b', h) for h in heard):
        credits.append("archive recordings: the Internet Archive (archive.org), openly licensed collections")
    data = {
        'title': name, 'artist': ARTIST, 'released': day.isoformat(),
        'about': QUOTE, 'about_by': "John Cage",
        'credits': credits, 'heard': heard[:60], 'heard_total': len(heard),
        'tags': ["chance", "radio", "data", "experimental", "Albuquerque"],
        'tracks': [{k: v for k, v in t.items() if k != 'bytes'} for t in tracks],
        'cover': base + "cover.jpg", 'cover_small': base + "cover_small.jpg", 'banner': base + "banner.jpg",
        'downloads': downloads,
        'mood': {k: round(v, 3) for k, v in mood.items()}, 'palette': inks + [paper_hex],
        'seed': str(seed), 'generated_from': os.path.basename(album),
        'published': datetime.datetime.now().isoformat(timespec='seconds'),
    }
    with open(os.path.join(args.site, 'album.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    total = sum(t['bytes'] for t in tracks)
    print(f"'{name}' -- {len(tracks)} tracks, {sum(t['duration'] for t in tracks) / 60:.1f} min, "
          f"{total / 1e6:.1f} MB of MP3; album.json written" + (f"; media on release {tag}" if args.release else ""))


def gh(*args, check=True):
    """the GitHub CLI (on GitHub's runners it is already installed and GH_TOKEN is the job's token)."""
    exe = shutil.which('gh')
    if not exe:
        raise SystemExit("--release needs the GitHub CLI (gh)")
    p = subprocess.run([exe, *args], capture_output=True, text=True)
    if check and p.returncode != 0:
        raise SystemExit(f"gh {' '.join(args[:2])} failed: {p.stderr.strip()[:300]}")
    return p


def prune(repo, keep):
    """delete all but the `keep` most recent chance-* releases (and their tags)."""
    p = gh('release', 'list', '--repo', repo, '--limit', '200', '--json', 'tagName,createdAt')
    rels = sorted([r for r in json.loads(p.stdout or '[]') if r['tagName'].startswith('chance-')],
                  key=lambda r: r['createdAt'], reverse=True)
    for r in rels[max(1, keep):]:
        gh('release', 'delete', r['tagName'], '--repo', repo, '--cleanup-tag', '--yes')
        print(f"  let go of {r['tagName']}")
    print(f"kept {min(len(rels), max(1, keep))} chance release(s)")


if __name__ == '__main__':
    main()
