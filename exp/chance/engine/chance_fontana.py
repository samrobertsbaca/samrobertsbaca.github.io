#!/usr/bin/env python3
"""
chance_fontana.py -- a chance tape-mix of live radio from around the world, after the
spirit of Cage's Fontana Mix, built on chance_data.py.

Two steps:

GATHER (--gather N)
    Chance gathers N clips from all sources, split by chance between shortwave off
    real receivers, broadcast stations' live streams, the Internet Archive, and open
    microphones. (--from shortwave,archive ... keeps to the ones named.)

    SHORTWAVE. For each clip chance picks a public KiwiSDR receiver
    somewhere on Earth (from the kiwisdr.com list), then a handful of things that
    should be on the air right now where that receiver is: stations from the EiBi
    shortwave schedule (broadcasters aimed at that part of the world, time signals,
    VLF navy transmitters, weather fax, VOLMET, beacons, oddities like the Buzzer),
    and amateur frequencies that are always busy (FT8 and FT4 data, NCDXF beacons,
    WSPR, SSTV). It LISTENS before it records: a few seconds of each candidate are
    measured, and static (spectrally flat, no peaks) is passed over until something
    with a voice, music, tones or data turns up. --dial wild goes back to tuning
    anywhere at all and keeping whatever is there. Several receivers are listened
    to at once (--workers, default 4), never more than one connection to each.
    When mixing, clips that are only static are skipped (--keep-static to use them);
    nothing in the cache is ever deleted. Recent finds are preferred: a clip gathered
    --half-life days ago (default 2) is half as likely to be chosen as one gathered
    today, and none ever falls below a twentieth (--half-life 0: no preference).
    Clips go into a cache folder (default radio_cache/ next to this script) as 16-bit
    WAVs with a .json beside each saying what station, where, when, and what else was
    tried first. Receivers are shared and have few listener slots: one connection per
    receiver, short clips, and it identifies itself as "chance_fontana".

    STATIONS. Chance picks a country (weighted so small ones still come up), then a
    station there from the Radio Browser directory -- FM broadcasters and internet-
    only stations alike (--fm-only for FM; --fm-country NO,JP to stay in places) --
    and records 8-45 s of its live stream with ffmpeg. A station that gives its FM
    frequency sits there on the dial; the rest sit in an "internet band" above FM.
    Broadcast stations mostly play copyrighted music: check before releasing a mix.

    ARCHIVE. A clip from the Internet Archive's openly licensed collections: old time
    radio, NASA audio, netlabel releases (Creative Commons) and LibriVox public-domain
    readings -- a chance item, a chance file, a chance moment in it. On the dial the
    archive sits above everything else, ordered by the year the Archive gives (often the
    year it was put online rather than recorded).
    Each clip's .json keeps the item, file, licence and rights given.

    MICS. A live clip from one of Locus Sonus' open microphones (locusonus.org): rooftops,
    gardens, hydrophones in canals, streets -- whichever are streaming at that moment.
    Quiet places are welcome; only dead air is skipped. Credit Locus Sonus Locustream
    if you release anything made with them.

MIX (every run)
    The cached clips become a new data source, 'radio'. A clip can be heard as tape
    (at a chance speed, steady, wandering, or reversed), as a tiny loop that turns it
    into a tone, or as data: the WAV file's own bytes reread in the wrong format.
    All of chance_data.py's sources and manipulations stay available alongside.

THE BASELINE FORM (--form baseline)
    Radio first, data on top. One to three lanes of radio clips are laid end to end
    across the whole track, mostly at their own speed, each clip cross-fading into the
    next, so the track starts as a bed of the world's radio. Then, at chance moments,
    stretches of that bed are BENT: run through chance_data's data operations (bit
    masks, sorting, stutter, xor ...) and cross-faded back in place of themselves.
    Then a score of data voices (automaton or drift, by chance) is laid over it all.

FUSION (four more sources, and --form fusion)
    Ways for radio and data to become one sound instead of two layers:
      mosaic    a data stream rebuilt from grains of radio: every few milliseconds the
                radio grain that best matches the data's loudness and brightness
      spectral  radio heard through a pattern: its spectrum split into bands that a
                cellular automaton (or Thue-Morse grid) opens and closes over time
      cross     cross-synthesis: a morph between radio's and data's spectra, or one
                given the other's spectral shape
      playhead  data playing the radio: a data stream sets where in a clip to read,
                how fast, or which way
    They are sources like any other, so every form can use them. --form fusion makes
    the bed out of them, the technique drifting across the track, with some plain
    radio, a few bends, and sometimes a few data voices over the top. A fusion song
    may also take an arc, without any loops: accumulation (the second lane joins),
    arch (it joins and leaves), erosion (data slowly eats the fused sound), revelation
    (plain radio surfaces through it), or none (free drift, the fusion as it comes).
    Some changes between segments are hard cuts.

THE FORM OF EACH SONG (--form; default: chance)
    By default every song's form is a chance draw, fusion most often (about half the
    songs), then loops, baseline, fontana, and now and then a data-only automaton or
    drift form. --form fusion / loops / baseline / fontana / automaton / drift fixes it.

THE LOOPS FORM (--form loops)
    A song that commits to its ideas. The program finds the repetitions in a clip's
    own loudness (FT8's cycles, a time station's ticks, a beat) and cuts a loop to
    them; that loop's length becomes the song's pulse, and everything else locks to
    it. Before deciding, it LISTENS: it renders a few candidate loops, scores them
    (how strongly they repeat, how much they move, how far from static) and builds
    the song on the best. One to three long sections, the stronger ideas getting
    more time. In each, a main loop (sometimes walking slowly through its clip) and
    one to three more lanes:
      a phasing twin   the same loop a few milliseconds longer per cycle, sliding in
                       and out of step over minutes (after Reich's tape pieces)
      another loop     from the palette, a half, one, two or a quarter of a bar long
      a fused loop     the main loop put through mosaic, spectral (rows on the beat),
                       cross or playhead
      hits             a rhythm of short radio slices struck on the pulse's grid in a
                       data pattern: Euclidean, Thue-Morse, Fibonacci word, an automaton
    Every song travels somewhere, with or without sections (half are a single
    movement): chance picks an ARC and every lane follows it --
      accumulation  lanes enter one by one across the song, the hits filling in
      erosion       starts clear; data processes slowly eat into every lane
      revelation    starts fused and processed; clears until the raw radio is plain
      acceleration  the main loop halves in length stage by stage
      convergence   phasing twins start far apart and close into unison at the end
      opening       a filter opens from a low murmur to the full spectrum
      arch          builds lane by lane to a peak, then thins out
    with a loudness shape of its own and an ending that suits it. Between sections
    the change is a hard cut on the bar, a drop (a bar of near silence), a handoff
    (only the main loop changes), a swell, or a crossfade.

LENGTHS, BEGINNINGS AND ENDINGS
    Most tracks run 2-5 minutes (typical length --median-dur, default 210 s); long ones
    are rare, about 1 in 11 past 8 minutes. A track starts cold on its
    first sound (about 6 in 10) or emerges over a slow 6-30 s fade, and ends with a long
    fade, a quick fade, or a hard stop (on a bar line,
    in the loops form) -- each by chance.

TITLES
    Each track is titled with a cut-up of its own material: words from the stations
    it heard, their frequencies and where they were received, and the techniques and
    data patterns that shaped it (a rule number, a bytebeat formula, Kolakoski...).
    Every title ever made is kept in titles.txt next to this script; a title that
    would repeat one takes on more of its material until it doesn't. --no-titles
    numbers the tracks plainly.

THE FONTANA FORM (--form fontana)
    A score made the way Fontana Mix's materials suggest, though not a copy of it:
    a sheet with a 100 x 20 grid, six random curves across it and a scatter of points.
    Each point is an event. Its horizontal position is when it starts; its distance
    from each of the six curves sets one parameter:
        1  the dial: which clip (ordered: VLF, shortwave, FM, internet, open mics, archive)
        2  tape speed
        3  loudness
        4  place in the stereo field
        5  how much it is manipulated
        6  how long it lasts
    The sheet is drawn in the score (digits are the curves, * are the points).

Usage:
    python chance_fontana.py --gather 12            # gather 12 clips, then mix a track
    python chance_fontana.py --gather 20 --gather-only
    python chance_fontana.py --gather 8 --from stations --fm-country BR,NG
    python chance_fontana.py --gather 8 --from shortwave --dial wild   # static and all
    python chance_fontana.py -n 4                   # mix an album from the cache
    python chance_fontana.py --sources radio        # radio only, nothing else
    python chance_fontana.py --form automaton       # radio inside chance_data's forms
    python chance_fontana.py --list-clips

Requires: numpy; for --gather, websocket-client (ships with Anaconda) and ffmpeg.
"""
import datetime
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import wave
import zlib

import numpy as np

import chance_data as cd
from chance_data import SR, log_uniform, ramp, drift, box_smooth, interpret_bytes, transport, pick_hold

HERE = os.path.dirname(os.path.abspath(__file__))
RECEIVER_LIST_URL = "http://rx.linkfanel.net/kiwisdr_com.js"
IDENT = "chance_fontana"

RADIO_CLIPS = []      # filled in main(): cached clips, ordered by frequency


# ------------------------------------------------------------------ the dial

TIME_SIGNALS = [2500, 3330, 5000, 7850, 10000, 14670, 15000, 20000, 4996, 9996, 14996]

# (name, lo kHz, hi kHz, modes, weight, channel step kHz or 0)
BANDS = [
    ("VLF", 10, 30, ['usb', 'lsb'], 0.5, 0),
    ("longwave broadcast", 153, 279, ['am'], 0.6, 9),
    ("longwave beacons", 280, 530, ['cw', 'usb'], 0.6, 0),
    ("mediumwave broadcast", 531, 1700, ['am'], 1.2, 9),
    ("160 m amateur", 1800, 2000, ['lsb', 'cw'], 0.5, 0),
    ("time signals", 0, 0, ['am'], 0.8, 0),
    ("80 m amateur", 3500, 3800, ['lsb', 'cw'], 0.7, 0),
    ("49 m broadcast", 5900, 6200, ['am'], 1.2, 5),
    ("40 m amateur", 7000, 7200, ['lsb', 'cw'], 0.8, 0),
    ("41 m broadcast", 7200, 7450, ['am'], 1.0, 5),
    ("31 m broadcast", 9400, 9900, ['am'], 1.2, 5),
    ("25 m broadcast", 11600, 12100, ['am'], 1.0, 5),
    ("20 m amateur", 14000, 14350, ['usb', 'cw'], 0.8, 0),
    ("19 m broadcast", 15100, 15800, ['am'], 1.0, 5),
    ("13 m broadcast", 21450, 21850, ['am'], 0.5, 5),
    ("anywhere", 10, 30000, ['am', 'usb', 'lsb', 'cw'], 1.6, 0),
]

PASSBANDS = {'am': (-4900, 4900), 'usb': (300, 2700), 'lsb': (-2700, -300), 'cw': (300, 700)}


def tune(rng):
    """chance picks a place on the dial: (band name, frequency in kHz, mode)."""
    w = np.array([b[4] for b in BANDS])
    name, lo, hi, modes, _, step = BANDS[int(rng.choice(len(BANDS), p=w / w.sum()))]
    if name == "time signals":
        f = float(rng.choice(TIME_SIGNALS))
    elif name == "anywhere":
        f = log_uniform(rng, lo, hi)
    else:
        f = float(rng.uniform(lo, hi))
        if step:
            f = round(f / step) * step
    mode = str(rng.choice(modes))
    if name == "anywhere" and mode in ('usb', 'lsb'):
        mode = 'lsb' if f < 10000 else 'usb'
    return name, round(f, 3), mode


# --------------------------------------------------------------- receivers

def load_receivers(radio_dir, refresh=False, max_age_h=6.0):
    path = os.path.join(radio_dir, "receivers.js")
    fresh = os.path.exists(path) and (time.time() - os.path.getmtime(path)) < max_age_h * 3600
    if refresh or not fresh:
        try:
            req = urllib.request.Request(RECEIVER_LIST_URL, headers={'User-Agent': IDENT})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            with open(path, 'wb') as f:
                f.write(data)
        except OSError as e:
            if not os.path.exists(path):
                raise SystemExit(f"could not fetch the receiver list ({e})")
            print(f"  receiver list: using the cached copy ({e})")
    txt = open(path, encoding='utf-8', errors='replace').read()
    body = re.sub(r',\s*\]', ']', txt[txt.index('['):txt.rindex(']') + 1])
    out = []
    for r in json.loads(body):
        try:
            if r.get('offline') != 'no' or r.get('status') != 'active':
                continue
            if int(r.get('users', 99)) >= int(r.get('users_max', 0)):
                continue
            lo, hi = (float(v) / 1000.0 for v in str(r.get('bands', '0-30000000')).split('-')[:2])
            out.append({'name': r.get('name', '?'), 'loc': r.get('loc', ''), 'gps': r.get('gps', ''),
                        'url': r['url'], 'lo': lo, 'hi': hi})
        except (KeyError, ValueError):
            continue
    return out


# ------------------------------------------------------------- what is on air

EIBI_URL = "http://www.eibispace.de/dx/sked-{}.csv"
WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

# always-busy amateur data and beacon frequencies: (kHz, mode, label)
AMATEUR = [
    (1840, 'usb', "FT8 data, 160 m"), (3573, 'usb', "FT8 data, 80 m"), (7074, 'usb', "FT8 data, 40 m"),
    (10136, 'usb', "FT8 data, 30 m"), (14074, 'usb', "FT8 data, 20 m"), (18100, 'usb', "FT8 data, 17 m"),
    (21074, 'usb', "FT8 data, 15 m"), (24915, 'usb', "FT8 data, 12 m"), (28074, 'usb', "FT8 data, 10 m"),
    (7047.5, 'usb', "FT4 data, 40 m"), (14080, 'usb', "FT4 data, 20 m"), (14070, 'usb', "PSK31, 20 m"),
    (14095.6, 'usb', "WSPR beacons, 20 m"), (7038.6, 'usb', "WSPR beacons, 40 m"),
    (14100, 'cw', "NCDXF beacons, 20 m"), (18110, 'cw', "NCDXF beacons, 17 m"),
    (21150, 'cw', "NCDXF beacons, 15 m"), (28200, 'cw', "NCDXF beacons, 10 m"),
    (14230, 'usb', "SSTV pictures, 20 m"), (3845, 'lsb', "SSTV pictures, 80 m"),
]

# EiBi target and transmitter codes -> rough continent
REGION_CODES = {
    'EU': ['Eu', 'WEu', 'NEu', 'EEu', 'SEu', 'CEu', 'SEE', 'RUS', 'G', 'D', 'F', 'I', 'E', 'HOL', 'BEL', 'AUT',
           'SUI', 'POL', 'ROU', 'UKR', 'BUL', 'HNG', 'NOR', 'S', 'FIN', 'DNK', 'IRL', 'POR', 'GRC', 'CZE',
           'SVK', 'SRB', 'HRV', 'LTU', 'LVA', 'EST', 'BLR', 'MDA', 'ALB', 'MLT', 'ISL', 'LUX', 'MCO', 'VTC'],
    'NA': ['NAm', 'ENA', 'WNA', 'CNA', 'USA', 'CAN', 'Car', 'CAm', 'MEX', 'CUB', 'ALS', 'HWA', 'GRL', 'LAm'],
    'SA': ['SAm', 'LAm', 'B', 'ARG', 'CHL', 'PRU', 'CLM', 'VEN', 'BOL', 'EQA', 'URG', 'PRG', 'GUF', 'SUR'],
    'AF': ['Af', 'WAf', 'EAf', 'SAf', 'CAf', 'NAf', 'AFS', 'NIG', 'KEN', 'EGY', 'MRC', 'ALG', 'TUN', 'ETH',
           'SDN', 'MDG', 'ZMB', 'MLI', 'GAB', 'ASC', 'STP', 'RRW', 'TZA', 'UGA', 'SSD', 'LBY', 'MTN'],
    'AS': ['ME', 'IRN', 'IRQ', 'ARS', 'TUR', 'ISR', 'AFG', 'CAs', 'SAs', 'IND', 'PAK', 'BGD', 'SEA', 'INS',
           'MLA', 'THA', 'VTN', 'PHL', 'FE', 'CHN', 'KRE', 'KOR', 'J', 'TWN', 'MNG', 'Sib', 'As', 'UAE', 'OMA',
           'KWT', 'SYR', 'JOR', 'CYP', 'UZB', 'TJK', 'KAZ', 'KGZ', 'TKM', 'MYA', 'CBG', 'LAO', 'SNG', 'NPL',
           'CLN', 'BTN', 'HKG', 'MAC'],
    'OC': ['Oc', 'WOc', 'NOc', 'SOc', 'AUS', 'NZL', 'PNG', 'Pac', 'FJI', 'GUM', 'MRA', 'SLM', 'VUT', 'NCL'],
}
CODE_REGION = {}
for _reg, _codes in REGION_CODES.items():
    for _c in _codes:
        CODE_REGION.setdefault(_c, set()).add(_reg)

USB_WORDS = re.compile(r'volmet|fax|meteo|dwd|coast|stanag|hfdl|\bale\b|ldoc|usb|navy|naval|'
                       r'\bmil\b|aero|arinc|sstv|wfax|weather|^vm[cw]\b|radio [a-z](?![a-z])', re.I)


def gps_region(gps):
    m = re.findall(r'-?\d+(?:\.\d+)?', gps or '')
    if len(m) < 2:
        return None
    lat, lon = float(m[0]), float(m[1])
    if 35 <= lat <= 72 and -25 <= lon <= 45:
        return 'EU'
    if 12 <= lat <= 42 and 35 <= lon <= 63:
        return 'AS'
    if -36 <= lat <= 37 and -20 <= lon <= 52:
        return 'AF'
    if 7 <= lat <= 85 and -170 <= lon <= -50:
        return 'NA'
    if -56 <= lat <= 13 and -92 <= lon <= -30:
        return 'SA'
    if (-50 <= lat <= -11 and 110 <= lon <= 180) or lon <= -150:
        return 'OC'
    if lon > 45:
        return 'AS'
    return None


def _on_day(spec, wd):
    spec = spec.strip()
    if not spec:
        return True
    if spec.isdigit():
        return str(wd + 1) in spec
    hit = False
    for part in spec.split(','):
        if '-' in part:
            a, _, b = part.partition('-')
            if a not in WEEKDAYS or b not in WEEKDAYS:
                return False                      # 'irr', 'Test', dates: unknown, skip it
            i, j = WEEKDAYS.index(a), WEEKDAYS.index(b)
            days = range(i, j + 1) if i <= j else list(range(i, 7)) + list(range(0, j + 1))
            hit = hit or wd in days
        else:
            toks = [part[k:k + 2] for k in range(0, len(part), 2)]
            if not toks or not all(t in WEEKDAYS for t in toks):
                return False
            hit = hit or WEEKDAYS[wd] in toks
    return hit


def _on_now(span, minute):
    m = re.match(r'(\d{2})(\d{2})-(\d{2})(\d{2})', span)
    if not m:
        return False
    a = int(m.group(1)) * 60 + int(m.group(2))
    b = int(m.group(3)) * 60 + int(m.group(4))
    return a <= minute < b if a < b else (minute >= a or minute < b)


def _season_names(now):
    """EiBi files are named a/b + two-digit year: A from late March, B from late October."""
    y = now.year % 100
    winter = now.month >= 11 or now.month <= 3 or (now.month == 10 and now.day >= 25)
    if winter:
        b_year = y if now.month >= 10 else y - 1
        return [f"b{b_year:02d}", f"a{b_year:02d}", f"b{b_year - 1:02d}"]
    return [f"a{y:02d}", f"b{y - 1:02d}", f"a{y - 1:02d}"]


def load_schedule(radio_dir, refresh=False, max_age_days=7.0):
    path = os.path.join(radio_dir, "eibi.csv")
    fresh = os.path.exists(path) and (time.time() - os.path.getmtime(path)) < max_age_days * 86400
    if refresh or not fresh:
        now = datetime.datetime.now(datetime.timezone.utc)
        for name in _season_names(now):
            try:
                req = urllib.request.Request(EIBI_URL.format(name), headers={'User-Agent': IDENT})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read()
                if data[:4] == b'kHz:':
                    with open(path, 'wb') as f:
                        f.write(data)
                    print(f"  schedule: EiBi {name.upper()}")
                    break
            except OSError:
                continue
    if not os.path.exists(path):
        print("  schedule: none (EiBi unreachable); using only the fixed list")
        return []
    rows = []
    with open(path, encoding='latin-1') as f:
        next(f, None)
        for line in f:
            p = line.rstrip('\n').split(';')
            if len(p) < 7:
                continue
            try:
                khz = float(p[0])
            except ValueError:
                continue
            if 0 < khz <= 30000:
                rows.append({'khz': khz, 'time': p[1], 'days': p[2], 'itu': p[3], 'station': p[4].strip(),
                             'lng': p[5].strip(), 'target': p[6].strip()})
    return rows


def eibi_tuning(e):
    """how to listen to a schedule entry: (dial kHz, mode)."""
    f, lng = e['khz'], e['lng']
    if f < 30:
        return f - 1.0, 'usb'                     # VLF: hear the MSK data a kHz up
    if lng in ('-TS', '-MX'):
        return f, 'am'
    if lng == '-CW':
        return f, 'cw'
    if lng in ('-TY', '-HF'):
        return f - 1.5, 'usb'
    if re.search(r'fax', e['station'], re.I):
        return f - 1.9, 'usb'
    if not lng or USB_WORDS.search(e['station']):
        return (f, 'usb') if f >= 1800 else (f, 'am')
    return f, 'am'


def candidates(rng, rx, schedule, k=6):
    """a handful of things worth tuning to on this receiver, right now."""
    now = datetime.datetime.now(datetime.timezone.utc)
    minute, wd = now.hour * 60 + now.minute, now.weekday()
    reg = rx.get('region')
    on = [e for e in schedule if rx['lo'] <= e['khz'] <= rx['hi']
          and _on_now(e['time'], minute) and _on_day(e['days'], wd)]
    pool = []
    for e in on:
        regs = CODE_REGION.get(e['target'], set()) | CODE_REGION.get(e['itu'], set())
        utility = e['lng'].startswith('-') or not e['lng'] or e['khz'] < 30
        w = (4.0 if reg in regs else (1.0 if not regs else 0.35)) * (0.9 if utility else 1.5)
        f, mode = eibi_tuning(e)
        what = e['station'] + (f" ({e['lng']} to {e['target']})" if e['lng'] and not e['lng'].startswith('-')
                               else "")
        pool.append((w, round(f, 3), mode, what, "utility" if utility else "broadcast"))
    for f, mode, what in AMATEUR:
        if rx['lo'] <= f <= rx['hi']:
            pool.append((len(on) / 60.0 + 3.0, f, mode, what, "amateur"))
    if not pool:
        return []
    w = np.array([p[0] for p in pool])
    take = rng.choice(len(pool), size=min(k, len(pool)), replace=False, p=w / w.sum())
    return [pool[i][1:] for i in take]


# --------------------------------------------------------------- listening

def _connect(rx, timeout):
    """open the receiver's audio stream; tries ws/wss and the newer and older paths."""
    import websocket
    host = re.sub(r'^https?://', '', rx['url']).rstrip('/')
    first = 'wss' if rx['url'].startswith('https') or 'proxy.kiwisdr.com' in host else 'ws'
    last = None
    for scheme in (first, 'ws' if first == 'wss' else 'wss'):
        for path in ("/kiwi/{}/SND", "/{}/SND"):
            ws = None
            try:
                ws = websocket.create_connection(f"{scheme}://{host}" + path.format(int(time.time())),
                                                 timeout=timeout)
                ws.send("SET auth t=kiwi p=")
                return ws, ws.recv()                 # a live receiver answers at once
            except Exception as e:
                last = e
                if ws is not None:
                    try:
                        ws.close()
                    except Exception:
                        pass
                if 'timed out' in str(e).lower() or 'Timeout' in type(e).__name__:
                    raise                            # not answering at all: don't knock again
                if 'scheme' in str(e):
                    break                            # redirected: try the other scheme
        else:
            break                                    # both paths failed without a redirect
    raise last or RuntimeError("could not connect")


def features(x, rate, mode):
    """how much is there: spectral flatness (1 = static), the tallest spectral peak over the
    median (dB), and how much the loudness moves (envelope coefficient of variation)."""
    x = x - np.mean(x)
    lo, hi = {'am': (200, 4000), 'usb': (400, 2500), 'lsb': (400, 2500), 'cw': (300, 800)}[mode]
    if len(x) < 1024:
        return 1.0, 0.0, 0.0
    fr = np.lib.stride_tricks.sliding_window_view(x, 512)[::256] * np.hanning(512)
    P = (np.abs(np.fft.rfft(fr, axis=1)) ** 2).mean(axis=0)
    f = np.fft.rfftfreq(512, 1 / rate)
    b = P[(f >= lo) & (f <= hi)] + 1e-9
    flat = float(np.exp(np.mean(np.log(b))) / np.mean(b))
    peak = float(10 * np.log10(b.max() / np.median(b)))
    e = np.sqrt((x[:len(x) // 240 * 240].reshape(-1, 240) ** 2).mean(axis=1))
    cv = float(e.std() / (e.mean() + 1e-9))
    return flat, peak, cv


def lively(mode, flat, peak, cv):
    """static is spectrally flat with no peaks; voices, music, data tones and carriers are not."""
    if mode == 'cw':
        return peak > 10.0 or cv > 0.45
    return flat < 0.7 or peak > 14.0 or (cv > 0.45 and flat < 0.85)


def listen(rx, cands, secs, probe_s=2.4, settle_s=1.2, timeout=6.0, judge=True):
    """open one receiver and try each candidate in turn; the first that is alive is recorded.
    returns (int16 samples or None, rate, chosen candidate, its metrics, everything tried)."""
    ws, first = _connect(rx, timeout)
    st = {'rate': None, 'ar': False, 'ka': time.time()}

    def handle(m):
        for kv in m[4:].decode(errors='replace').split(' '):
            k, _, v = kv.partition('=')
            if k == 'sample_rate':
                st['rate'] = float(v)
            elif k == 'audio_rate':
                ws.send(f"SET AR OK in={int(float(v))} out=44100")
                st['ar'] = True
            elif (k in ('too_busy', 'badp') and v not in ('', '0')) or k in ('down', 'redirect'):
                raise RuntimeError(f"receiver said {kv}")

    def recv():
        m = ws.recv()
        if time.time() - st['ka'] > 1.0:
            ws.send("SET keepalive")
            st['ka'] = time.time()
        return m.encode() if isinstance(m, str) else m

    tried = []
    try:
        m = first.encode() if isinstance(first, str) else first
        give_up = time.time() + 15
        while True:
            if m[:3] == b'MSG':
                handle(m)
            if st['rate'] and st['ar']:
                break
            if time.time() > give_up:
                raise RuntimeError("no audio setup")
            m = recv()
        rate = st['rate']
        for c in ("SET squelch=0 max=0", "SET genattn=0", "SET gen=0 mix=-1", f"SET ident_user={IDENT}",
                  "SET agc=1 hang=0 thresh=-100 slope=6 decay=1000 manGain=50", "SET compression=0"):
            ws.send(c)

        for cand in cands:
            f, mode = cand[0], cand[1]
            lc, hc = PASSBANDS[mode]
            ws.send(f"SET mod={mode} low_cut={lc} high_cut={hc} freq={f:.3f}")
            t0 = time.time()
            chunks, sm, metrics = [], [], {}
            decided = not judge
            limit = settle_s + (secs + 0.5 if decided else probe_s)
            rejected = False
            try:
                while time.time() - t0 < limit:
                    m = recv()
                    if m[:3] == b'MSG':
                        handle(m)
                    elif m[:3] == b'SND' and time.time() - t0 > settle_s:
                        sm.append(0.1 * int.from_bytes(m[8:10], 'big') - 127.0)
                        chunks.append(np.frombuffer(m[10:], dtype='>i2'))
                    if not decided and chunks and time.time() - t0 >= settle_s + probe_s:
                        flat, peak, cv = features(np.concatenate(chunks).astype(np.float64), rate, mode)
                        metrics = {'rssi_dbm': round(float(np.median(sm)), 1), 'flatness': round(flat, 3),
                                   'peak_db': round(peak, 1), 'envelope_cv': round(cv, 3)}
                        tried.append({'freq_khz': f, 'mode': mode, 'what': cand[2], **metrics})
                        if not lively(mode, flat, peak, cv):
                            rejected = True
                            break
                        decided = True
                        limit = settle_s + secs + 0.5
            except Exception:
                if decided and chunks:                       # cut off mid-recording: keep what came
                    return np.concatenate(chunks).astype(np.int16), rate, cand, metrics, tried
                raise
            if not rejected and decided and chunks:
                return np.concatenate(chunks).astype(np.int16), rate, cand, metrics, tried
        return None, rate, None, {}, tried
    finally:
        try:
            ws.close()
        except Exception:
            pass


def _reachable(rxs, n, rng, timeout=4.0):
    """knock on a sample of receivers at once (a plain TCP connect) and keep those that answer."""
    import socket
    from concurrent.futures import ThreadPoolExecutor
    pick = [rxs[i] for i in rng.permutation(len(rxs))[:n]]

    def knock(r):
        h = re.sub(r'^https?://', '', r['url']).rstrip('/')
        host, _, port = h.partition(':')
        try:
            socket.create_connection((host, int(port or (443 if r['url'].startswith('https') else 80))),
                                     timeout=timeout).close()
            return True
        except (OSError, ValueError):
            return False

    with ThreadPoolExecutor(max_workers=24) as ex:
        ok = list(ex.map(knock, pick))
    return [r for r, o in zip(pick, ok) if o]


def save_clip(radio_dir, x, rate, meta, utc):
    stem = f"{utc:%Y%m%dT%H%M%SZ}_{meta['freq_khz']:09.3f}kHz_{meta['mode']}"
    with wave.open(os.path.join(radio_dir, stem + ".wav"), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(round(rate)))
        w.writeframes(x.astype('<i2').tobytes())
    with open(os.path.join(radio_dir, stem + ".json"), 'w', encoding='utf-8') as fj:
        json.dump(meta, fj, indent=1, ensure_ascii=False)


def gather(count, radio_dir, refresh=False, dial='stations', workers=4):
    """record `count` clips, listening to up to `workers` different receivers at a time
    (never more than one connection to any one receiver)."""
    rng = np.random.default_rng(int.from_bytes(os.urandom(8), 'big'))
    rxs = load_receivers(radio_dir, refresh)
    for r in rxs:
        r['region'] = gps_region(r['gps'])
    schedule = load_schedule(radio_dir, refresh) if dial == 'stations' else []
    print(f"gathering {count} clip(s); {len(rxs)} receivers with free slots"
          + (f", {len(schedule)} schedule entries" if schedule else "")
          + (" (dial: anywhere, keeping whatever is there)" if dial == 'wild' else ""))
    from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

    def visit(rx, cands, judge, secs):
        utc = datetime.datetime.now(datetime.timezone.utc)
        try:
            return rx, utc, listen(rx, cands, secs, judge=judge), None
        except Exception as e:
            return rx, utc, None, e

    def next_job():
        while True:
            if not live:
                live.extend(_reachable(rxs, 48, rng))
                if not live:
                    return None
            rx = live.pop()
            secs = log_uniform(rng, 8, 45)
            if dial == 'wild':
                band, f, mode = tune(rng)
                if rx['lo'] <= f <= rx['hi']:
                    return rx, [(f, mode, f"the dial at random ({band})", "wild")], False, secs
            else:
                cands = candidates(rng, rx, schedule)
                if cands:
                    return rx, cands, True, secs

    live, got, visits = [], 0, 0
    asked = set()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        running = set()
        while True:
            while len(running) < workers and got + len(running) < count and visits < count * 10:
                job = next_job()
                if job is None:
                    break
                if job[0]['url'] in asked:                 # never two connections to one receiver
                    continue
                asked.add(job[0]['url'])
                visits += 1
                running.add(ex.submit(visit, *job))
            if not running:
                break
            done, running = wait(running, return_when=FIRST_COMPLETED)
            for fut in done:
                rx, utc, res, err = fut.result()
                label = f"{rx['name'][:44].encode('ascii', 'replace').decode()} ({rx.get('region') or '?'})"
                if err is not None:
                    print(f"  .. {label}: no ({str(err)[:50]})")
                    continue
                x, rate, cand, metrics, tried = res
                if x is None or len(x) < 3 * rate:
                    print(f"  .. {label}: only static on {len(tried)} tries")
                    continue
                if got >= count:
                    continue
                f, mode, what, kind = cand
                meta = {'freq_khz': f, 'mode': mode, 'station': what, 'kind': kind, 'band': kind,
                        'utc': utc.isoformat(timespec='seconds'), 'seconds': round(len(x) / rate, 2),
                        'rate': rate, 'receiver': rx['name'], 'location': rx['loc'], 'gps': rx['gps'],
                        'url': rx['url'], 'listened': metrics,
                        'also_tried': [t for t in tried if t['freq_khz'] != f]}
                save_clip(radio_dir, x, rate, meta, utc)
                got += 1
                print(f"  [{got}/{count}] {label}: {f:.1f} kHz {mode.upper()} -- "
                      f"{what.encode('ascii', 'replace').decode()[:48]} ({len(x) / rate:.0f} s, "
                      f"try {len(tried) or 1})")
    print(f"gathered {got} clip(s) into {radio_dir}")
    return got


# ----------------------------------------------------- broadcast streams (FM and internet)

RB_HOSTS = ["de1", "de2", "fi1", "at1", "nl1"]          # Radio Browser mirrors (plain http works anywhere)
FM_RE = re.compile(r'(?<![\d.,])(8[7-9]|9\d|10[0-8])[.,](\d)(?![\d.,])')
FM_WORD = re.compile(r'\bfm\b', re.I)
INTERNET_BAND = (110000.0, 130000.0)                     # kHz: where stations with no frequency sit on the dial


def rb_get(path, params=None, timeout=25):
    q = ("?" + urllib.parse.urlencode(params)) if params else ""
    last = None
    for h in RB_HOSTS:
        try:
            req = urllib.request.Request(f"http://{h}.api.radio-browser.info{path}{q}",
                                         headers={'User-Agent': IDENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode('utf-8', errors='replace'))
        except (OSError, ValueError) as e:
            last = e
    raise RuntimeError(f"Radio Browser unreachable ({last})")


def rb_countries(radio_dir, refresh=False, max_age_days=7.0):
    path = os.path.join(radio_dir, "stations_countries.json")
    if refresh or not os.path.exists(path) or time.time() - os.path.getmtime(path) > max_age_days * 86400:
        try:
            data = rb_get("/json/countries")
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f)
        except RuntimeError as e:
            if not os.path.exists(path):
                raise SystemExit(str(e))
    with open(path, encoding='utf-8') as f:
        return [c for c in json.load(f) if c.get('stationcount', 0) >= 3 and c.get('iso_3166_1')]


def station_dial(st):
    """an FM station's frequency from its name or tags (kHz), or a place in the internet band."""
    m = FM_RE.search(f"{st.get('name', '')} {st.get('tags', '')}")
    if m:
        return float(m.group(1)) * 1000 + float(m.group(2)) * 100, True
    h = int(re.sub(r'[^0-9a-f]', '', (st.get('stationuuid') or '0').lower())[:6] or '0', 16)
    lo, hi = INTERNET_BAND
    return round(lo + h % int(hi - lo), 1), False


def find_ffmpeg():
    import shutil
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def record_stream(ffmpeg, url, secs, rate=32000, lead=1.5, seek=None):
    """record `secs` of a stream (or, with `seek`, of a file from that many seconds in) as mono 16-bit
    at `rate`; the first `lead` seconds are dropped."""
    import subprocess
    tries = [url] + ([url.replace('https://', 'http://', 1)] if url.startswith('https://') else [])
    last = "no audio"
    for u in tries:
        cmd = [ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error', '-rw_timeout', '10000000',
               '-user_agent', IDENT] + (['-ss', f"{seek:.2f}"] if seek else []) + \
              ['-i', u, '-t', f"{secs + lead:.2f}", '-vn', '-ac', '1',
               '-ar', str(rate), '-f', 's16le', 'pipe:1']
        try:
            p = subprocess.run(cmd, capture_output=True, timeout=secs + 40)
        except subprocess.TimeoutExpired:
            last = "stream stalled"
            continue
        x = np.frombuffer(p.stdout, dtype='<i2')
        if len(x) > int((lead + 3) * rate):
            return x[int(lead * rate):].copy(), rate
        last = (p.stderr.decode(errors='replace').strip().splitlines() or ["no audio"])[-1][:60]
    raise RuntimeError(last)


def gather_streams(count, radio_dir, fm_only=False, countries=None, workers=4, refresh=False):
    """record `count` clips from broadcast stations' live streams, anywhere on Earth."""
    from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise SystemExit("gathering station streams needs ffmpeg (on PATH, or the imageio-ffmpeg package)")
    rng = np.random.default_rng(int.from_bytes(os.urandom(8), 'big'))
    allc = rb_countries(radio_dir, refresh)
    if countries:
        want = {c.strip().upper() for c in countries.split(',')}
        allc = [c for c in allc if c['iso_3166_1'].upper() in want]
        if not allc:
            raise SystemExit(f"no stations listed for {countries}")
    cw = np.sqrt(np.array([c['stationcount'] for c in allc], dtype=float))   # every country gets a voice
    print(f"gathering {count} station clip(s) from {len(allc)} countries"
          + (" (FM stations only)" if fm_only else " (FM and internet-only stations)"))
    used = set()

    def next_job():
        for _ in range(12):
            c = allc[int(rng.choice(len(allc), p=cw / cw.sum()))]
            try:
                found = rb_get("/json/stations/search", {'countrycode': c['iso_3166_1'], 'order': 'random',
                                                          'limit': 60, 'hidebroken': 'true'})
            except RuntimeError:
                continue
            found = [s for s in found if s.get('url_resolved') and s.get('stationuuid') not in used
                     and s.get('lastcheckok') == 1]
            if fm_only:
                found = [s for s in found if FM_RE.search(f"{s.get('name', '')} {s.get('tags', '')}")
                         or FM_WORD.search(f"{s.get('name', '')} {s.get('tags', '')}")]
            if found:
                s = found[int(rng.integers(len(found)))]
                used.add(s['stationuuid'])
                return s, c['name'], log_uniform(rng, 8, 45)
        return None

    def visit(st, country, secs):
        utc = datetime.datetime.now(datetime.timezone.utc)
        try:
            x, rate = record_stream(ffmpeg, st['url_resolved'], secs)
            return st, country, utc, x, rate, None
        except Exception as e:
            return st, country, utc, None, None, e

    got, visits = 0, 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        running = set()
        while True:
            while len(running) < workers and got + len(running) < count and visits < count * 6:
                job = next_job()
                if job is None:
                    break
                visits += 1
                running.add(ex.submit(visit, *job))
            if not running:
                break
            done, running = wait(running, return_when=FIRST_COMPLETED)
            for fut in done:
                st, country, utc, x, rate, err = fut.result()
                name = st.get('name', '?').strip()
                where = ", ".join(v for v in (st.get('state', '').strip(), country) if v)
                label = f"{name[:40]} ({where[:30]})".encode('ascii', 'replace').decode()
                if err is not None:
                    print(f"  .. {label}: no ({str(err)[:50]})")
                    continue
                xf = x.astype(np.float64)
                flat, peak, cv = features(xf, rate, 'am')
                if xf.std() < 30 or not lively('am', flat, peak, cv):
                    print(f"  .. {label}: silent or empty")
                    continue
                if got >= count:
                    continue
                f, stated = station_dial(st)
                meta = {'freq_khz': f, 'freq_stated': stated, 'mode': 'fm' if stated else 'net',
                        'station': f"{name} ({where})", 'kind': 'fm' if stated else 'internet',
                        'band': 'FM broadcast' if stated else 'internet radio',
                        'utc': utc.isoformat(timespec='seconds'), 'seconds': round(len(x) / rate, 2),
                        'rate': rate, 'country': country, 'state': st.get('state', ''),
                        'language': st.get('language', ''), 'tags': st.get('tags', ''),
                        'homepage': st.get('homepage', ''), 'url': st.get('url_resolved'),
                        'stationuuid': st.get('stationuuid'), 'codec': st.get('codec'),
                        'bitrate': st.get('bitrate'),
                        'listened': {'flatness': round(flat, 3), 'peak_db': round(peak, 1),
                                     'envelope_cv': round(cv, 3), 'rms': round(float(xf.std()), 1)}}
                save_clip(radio_dir, x, rate, meta, utc)
                try:
                    rb_get(f"/json/url/{st['stationuuid']}", timeout=8)   # count the listen, as the directory asks
                except RuntimeError:
                    pass
                got += 1
                freq = f"{f / 1000:.1f} MHz FM" if stated else "internet"
                print(f"  [{got}/{count}] {label}: {freq} ({len(x) / rate:.0f} s)")
    print(f"gathered {got} station clip(s) into {radio_dir}")
    return got


# --------------------------------------------- the Internet Archive and open microphones

ARCHIVE = "https://archive.org"
# openly licensed collections, by design: (collection, weight, what it is)
ARCHIVE_COLLECTIONS = [
    ("oldtimeradio", 3.0, "old time radio"),
    ("nasaaudiocollection", 2.0, "NASA audio"),
    ("netlabels", 3.0, "netlabel releases (Creative Commons)"),
    ("librivoxaudio", 1.5, "LibriVox public-domain readings"),
]
ARCHIVE_BAND = (140000.0, 142200.0)     # kHz: the archive sits above the internet band, ordered by year
MIC_BAND = (132000.0, 138000.0)         # and the open microphones between them
LOCUS_STATUS = "http://locus.creacast.com:9001/status-json.xsl"


def unmangle(t):
    """text that was UTF-8 but got read as Latin-1 ("LuÅ¾Ã¡nky") back to what it was ("Lužánky")."""
    try:
        fixed = t.encode('latin-1').decode('utf-8')
        return fixed if fixed != t else t
    except (UnicodeEncodeError, UnicodeDecodeError):
        return t


def get_json(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': IDENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8', errors='replace'))


def run_pool(count, workers, next_job, visit, accept):
    """keep up to `workers` jobs running until `count` are accepted or jobs run out."""
    from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
    got, visits = 0, 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        running = set()
        while True:
            while len(running) < workers and got + len(running) < count and visits < count * 6:
                job = next_job()
                if job is None:
                    break
                visits += 1
                running.add(ex.submit(visit, job))
            if not running:
                break
            done, running = wait(running, return_when=FIRST_COMPLETED)
            for fut in done:
                if got < count and accept(fut.result(), got):
                    got += 1
    return got


def archive_year(m):
    for k in ('year', 'date'):
        v = str(m.get(k) or '')
        mm = re.search(r'(1[89]\d\d|20\d\d)', v)
        if mm:
            return int(mm.group(1))
    return None


def gather_archive(count, radio_dir, workers=4):
    """record `count` clips from openly licensed Internet Archive collections."""
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise SystemExit("gathering from the Internet Archive needs ffmpeg")
    rng = np.random.default_rng(int.from_bytes(os.urandom(8), 'big'))
    w = np.array([c[1] for c in ARCHIVE_COLLECTIONS])
    sizes = {}
    print(f"gathering {count} clip(s) from the Internet Archive "
          f"({', '.join(c[0] for c in ARCHIVE_COLLECTIONS)})")

    def next_job():
        for _ in range(8):
            coll, _, what = ARCHIVE_COLLECTIONS[int(rng.choice(len(ARCHIVE_COLLECTIONS), p=w / w.sum()))]
            q = urllib.parse.quote(f"collection:{coll} AND mediatype:audio")
            try:
                if coll not in sizes:
                    sizes[coll] = get_json(f"{ARCHIVE}/advancedsearch.php?q={q}&fl[]=identifier&rows=0"
                                           f"&output=json")['response']['numFound']
                page = int(rng.integers(1, max(2, min(sizes[coll], 9000) // 50 + 1)))
                docs = get_json(f"{ARCHIVE}/advancedsearch.php?q={q}&fl[]=identifier&rows=50&page={page}"
                                f"&output=json")['response']['docs']
            except (OSError, ValueError, KeyError):
                continue
            if docs:
                return docs[int(rng.integers(len(docs)))]['identifier'], coll, what, log_uniform(rng, 8, 45), \
                    int(rng.integers(1 << 30))
        return None

    def visit(job):
        ident, coll, what, secs, salt = job
        utc = datetime.datetime.now(datetime.timezone.utc)
        try:
            d = get_json(f"{ARCHIVE}/metadata/{urllib.parse.quote(ident)}")
            files = [f for f in d.get('files', []) if re.search(r'mp3|ogg', str(f.get('format', '')), re.I)
                     and f.get('length')]
            if not files:
                return job, utc, None, None, None, None, "no audio files"
            f = files[salt % len(files)]
            length = float(re.sub(r'[^0-9.]', '', str(f['length'])) or 0)
            if ':' in str(f['length']):                       # some lengths are mm:ss
                parts = [float(p) for p in str(f['length']).split(':')]
                length = sum(p * 60 ** i for i, p in enumerate(reversed(parts)))
            seek = (salt % 1000) / 1000.0 * max(0.0, length - secs - 2)
            url = f"{ARCHIVE}/download/{urllib.parse.quote(ident)}/{urllib.parse.quote(f['name'])}"
            x, rate = record_stream(ffmpeg, url, secs, lead=0.2, seek=seek)
            return job, utc, x, rate, d.get('metadata', {}), (f['name'], seek, url), None
        except Exception as e:
            return job, utc, None, None, None, None, str(e)[:50]

    def accept(res, got):
        job, utc, x, rate, m, fileinfo, err = res
        ident, coll, what, secs, salt = job
        if err is not None or x is None:
            print(f"  .. {ident[:50]}: no ({err})")
            return False
        xf = x.astype(np.float64)
        if xf.std() < 30:
            print(f"  .. {ident[:50]}: silent there")
            return False
        title = str(m.get('title') or ident).strip()
        creator = m.get('creator')
        creator = (creator[0] if isinstance(creator, list) else str(creator or '')).strip()
        year = archive_year(m)
        lo, hi = ARCHIVE_BAND
        f = lo + (year - 1880) * 15.0 if year else lo + (zlib.crc32(ident.encode()) % 2000) + 0.5
        flat, peak, cv = features(xf, rate, 'am')
        name, seek, url = fileinfo
        meta = {'freq_khz': round(min(max(f, lo), hi), 1), 'mode': 'archive', 'year': year,
                'station': f"{title} ({', '.join(v for v in (creator, str(year) if year else '') if v)})",
                'kind': 'archive', 'band': what, 'collection': coll, 'identifier': ident, 'file': name,
                'from_s': round(seek, 1), 'utc': utc.isoformat(timespec='seconds'),
                'seconds': round(len(x) / rate, 2), 'rate': rate, 'url': url,
                'licenseurl': m.get('licenseurl'), 'rights': m.get('rights'),
                'listened': {'flatness': round(flat, 3), 'peak_db': round(peak, 1), 'envelope_cv': round(cv, 3)}}
        save_clip(radio_dir, x, rate, meta, utc)
        label = f"{title[:44]} ({year or '?'})".encode('ascii', 'replace').decode()
        print(f"  [{got + 1}/{count}] {label} -- {what} ({len(x) / rate:.0f} s from {seek / 60:.1f} min in)")
        return True

    got = run_pool(count, workers, next_job, visit, accept)
    print(f"gathered {got} archive clip(s) into {radio_dir}")
    return got


def gather_mics(count, radio_dir, workers=4):
    """record `count` clips from Locus Sonus' open microphones, live, around the world."""
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise SystemExit("gathering from open microphones needs ffmpeg")
    rng = np.random.default_rng(int.from_bytes(os.urandom(8), 'big'))
    try:
        src = get_json(LOCUS_STATUS)['icestats'].get('source', [])
    except (OSError, ValueError, KeyError) as e:
        print(f"open microphones: the stream list is unreachable ({e})")
        return 0
    mics = [s for s in (src if isinstance(src, list) else [src]) if s.get('listenurl')]
    order = [mics[i] for i in rng.permutation(len(mics))]
    print(f"gathering {count} clip(s) from {len(mics)} live open microphones (Locus Sonus)")

    def next_job():
        return (order.pop(), log_uniform(rng, 12, 50)) if order else None

    def visit(job):
        s, secs = job
        utc = datetime.datetime.now(datetime.timezone.utc)
        try:
            x, rate = record_stream(ffmpeg, s['listenurl'], secs, lead=2.0)
            return s, utc, x, rate, None
        except Exception as e:
            return s, utc, None, None, str(e)[:50]

    def accept(res, got):
        s, utc, x, rate, err = res
        name = unmangle(str(s.get('server_name') or s['listenurl'].rsplit('/', 1)[-1]).strip())
        label = name[:44].encode('ascii', 'replace').decode()
        if err is not None:
            print(f"  .. {label}: no ({err})")
            return False
        xf = x.astype(np.float64)
        if xf.std() < 20:                                  # quiet places are welcome; dead air is not
            print(f"  .. {label}: silent")
            return False
        flat, peak, cv = features(xf, rate, 'am')
        lo, hi = MIC_BAND
        f = lo + (int.from_bytes(name.encode('utf-8')[:6].ljust(6, b'.'), 'big') % int(hi - lo))
        parts = [q.strip() for q in name.split(' - ') if q.strip()]
        place = parts[0] if parts else name
        if '.' in place and len(parts) > 1:              # "radio.earth - Brno ..." names the network
            place = parts[1].split()[0]
        meta = {'freq_khz': float(f), 'mode': 'mic', 'station': name, 'kind': 'mic', 'band': 'open microphone',
                'location': place, 'description': unmangle(str(s.get('server_description', ''))),
                'utc': utc.isoformat(timespec='seconds'), 'seconds': round(len(x) / rate, 2), 'rate': rate,
                'url': s['listenurl'], 'credit': "Locus Sonus Locustream (locusonus.org)",
                'listened': {'flatness': round(flat, 3), 'peak_db': round(peak, 1), 'envelope_cv': round(cv, 3)}}
        save_clip(radio_dir, x, rate, meta, utc)
        print(f"  [{got + 1}/{count}] {label} -- live ({len(x) / rate:.0f} s)")
        return True

    got = run_pool(count, workers, next_job, visit, accept)
    print(f"gathered {got} open-microphone clip(s) into {radio_dir}")
    return got


def dial_text(c):
    """how a clip's place on the dial reads in a score."""
    if c.get('mode') == 'net':
        return "internet radio"
    if c.get('mode') == 'mic':
        return "live microphone"
    if c.get('mode') == 'archive':
        return f"archive, {c['year']}" if c.get('year') else "archive"
    if c.get('mode') == 'fm' or c['freq_khz'] >= 30000:
        return f"{c['freq_khz'] / 1000:.1f} MHz FM"
    return f"{c['freq_khz']:.1f} kHz {c['mode'].upper()}"


def load_clips(radio_dir):
    clips = []
    for name in sorted(os.listdir(radio_dir)) if os.path.isdir(radio_dir) else []:
        if not name.endswith('.wav'):
            continue
        path = os.path.join(radio_dir, name)
        meta = {}
        try:
            with open(path[:-4] + '.json', encoding='utf-8') as f:
                meta = json.load(f)
        except (OSError, ValueError):
            pass
        meta.setdefault('freq_khz', 0.0)
        meta.setdefault('mode', '?')
        meta['path'] = path
        if meta.get('listened') and meta.get('kind') != 'wild':
            meta['lively'] = True                         # it was heard to be alive when recorded
        else:                                             # older or wild clips: listen to them now
            try:
                x, rate = _read_clip(path)
                x = x[:int(60 * rate)]
                mode = meta['mode'] if meta['mode'] in PASSBANDS else 'am'
                meta['lively'] = lively(mode, *features(x * 32768.0, rate, mode))
            except (OSError, wave.Error, ValueError):
                meta['lively'] = False
        clips.append(meta)
    clips.sort(key=lambda c: (c['freq_khz'], c['path']))
    return clips


# -------------------------------------------------------------- the source

def _read_clip(path):
    with wave.open(path, 'rb') as w:
        rate = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768.0
    return x, rate


def _tape(x, rate, n, start, speed_path):
    """play x (at rate) from `start` with a per-output-sample speed; loops."""
    L = len(x)
    pos = (start + np.cumsum(speed_path * (rate / SR))) % L
    return np.interp(pos, np.arange(L), x)


def src_radio(rng, n, hint=None):
    hint = hint or {}
    if not RADIO_CLIPS:
        return cd.src_bytes(rng, n)
    if 'clip' in hint:
        i = int(hint['clip']) % len(RADIO_CLIPS)
    elif 'dial' in hint:
        i = int(round(float(hint['dial']) * (len(RADIO_CLIPS) - 1)))
    else:
        i = fresh_clip(rng)
    c = RADIO_CLIPS[i]
    heard = ((f"{c['station']}, " if c.get('station') else "")
             + dial_text(c)
             + (f" via {c['receiver']}" if c.get('receiver') else "")
             + (f", {c['utc'][:16].replace('T', ' ')} UTC" if c.get('utc') else ""))
    reading = hint.get('reading') or str(rng.choice(['tape', 'tape', 'varispeed', 'reverse', 'loop', 'data']))
    note_clip(c)
    note_tech({'loop': 'Loop', 'reverse': 'Backwards', 'varispeed': 'Varispeed', 'data': 'Misread'}.get(reading))

    if reading == 'data':
        with open(c['path'], 'rb') as f:
            raw = np.frombuffer(f.read(), dtype=np.uint8)
        vals, idesc = interpret_bytes(rng, raw)
        x, tdesc = transport(rng, vals, n, pick_hold(rng, 1, 16))
        return x, f"radio [{heard}] as data: the WAV file's bytes reread as {idesc}; {tdesc}"

    x, rate = _read_clip(c['path'])
    if len(x) < 64:
        return np.zeros(n), f"radio [{heard}] (empty)"
    e = min(len(x) // 4, int(0.02 * rate))
    x[:e] *= ramp(e)
    x[-e:] *= ramp(e)[::-1]
    if 'speed' in hint:
        speed = float(hint['speed'])
    else:
        speed = 1.0 if rng.random() < 0.3 else 2.0 ** rng.uniform(-2.0, 1.0)
    start = float(rng.uniform(0, len(x)))
    if hint.get('fit'):                    # start where the clip can play through without wrapping
        start = float(rng.uniform(0, max(1.0, len(x) - n * speed * rate / SR)))

    if reading == 'loop':
        L = int(max(16, log_uniform(rng, 0.004, 0.4) * rate))
        a = int(rng.integers(0, max(1, len(x) - L)))
        frag = x[a:a + L].copy()
        r2 = max(1, min(L // 8, int(0.002 * rate)))
        frag[:r2] *= ramp(r2)
        frag[-r2:] *= ramp(r2)[::-1]
        y = _tape(frag, rate, n, 0.0, np.full(n, speed))
        return y, (f"radio [{heard}]: a {1000 * L / rate:.0f} ms fragment looped "
                   f"(~{speed * rate / L:.1f} Hz) at speed x{speed:.2f}")
    if reading == 'reverse':
        y = _tape(x[::-1].copy(), rate, n, start, np.full(n, speed))
        return y, f"radio [{heard}] reversed, tape speed x{speed:.2f}"
    if reading == 'varispeed' and n > SR:
        span = float(rng.uniform(0.3, 2.0))
        octs, k = drift(rng, n, -span, span)
        y = _tape(x, rate, n, start, speed * 2.0 ** octs)
        return y, f"radio [{heard}], tape speed x{speed:.2f} wandering +-{span:.1f} oct ({k} pts)"
    y = _tape(x, rate, n, start, np.full(n, speed))
    loops = n * speed * rate / SR / len(x)
    lp = f", looping ({loops:.1f} passes)" if loops > 1.05 else ""
    return y, f"radio [{heard}], tape speed x{speed:.2f}{lp}"


# --------------------------------------------------------- the fontana form

# ------------------------------------------------------------------- titles
# each track is named with a cut-up of its own material: the stations and frequencies it
# heard, where they were heard, and the techniques and data patterns that shaped them.
# every title ever made is kept in titles.txt beside this script, so none repeats.

TRACK_NOTES = {'clips': [], 'tech': []}
TITLE_FILE = os.path.join(HERE, "titles.txt")
_GENERIC = {'radio', 'fm', 'am', 'the', 'de', 'la', 'el', 'le', 'of', 'and', 'y', 'e', 'di', 'da', 'do',
            'du', 'des', 'del', 'online', 'stream', 'live', 'net', 'web', 'station', 'mhz', 'khz', 'hd',
            'mp3', 'aac', 'kbps', 'k', 'int', 'internacional', 'international', 'via', 'sdr', 'kiwisdr'}


def note_clip(c):
    TRACK_NOTES['clips'].append(c)


def note_tech(word):
    if word:
        TRACK_NOTES['tech'].append(word)


def data_token(desc):
    """the one most nameable thing in a data description, if any."""
    d = desc or ""
    m = re.search(r'bytebeat\s+\((.*?)\) &', d)
    if m and len(m.group(1)) <= 26:
        return m.group(1)
    m = re.search(r'(B[\d]*/S[\d]*) ([^,;]+?) on a', d)
    if m:
        return m.group(2).strip()
    m = re.search(r'rule (\d+) automaton', d)
    if m:
        return f"Rule {m.group(1)}"
    for nm in cd.SEQUENCES:
        if nm in d:
            return nm.split(' (')[0]
    for key, word in (('logistic map', 'Logistic'), ('Henon map', 'Hénon'), ('circle map', 'Circle Map'),
                      ('odd-even transposition', 'Odd-Even'), ('bottom-up merge', 'Merge Sort'),
                      ('shell (gap', 'Shell Sort')):
        if key in d:
            return word
    m = re.search(r'taps (0x[0-9a-f]+)', d)
    if m:
        return f"LFSR {m.group(1)}"
    m = re.search(r'sqrt\((\d+)\)', d)
    if m:
        return f"√{m.group(1)}"
    m = re.search(r'expansion of 1/(\d+)', d)
    if m:
        return f"1/{m.group(1)}"
    m = re.search(r"L-system (a->[a-d]+)", d)
    if m:
        return m.group(1)
    m = re.search(r"file '([^']+)'", d)
    if m:
        return m.group(1)
    return None


def _clip_tokens(c):
    """(name words, places, frequency) for one clip."""
    st = c.get('station') or ""
    name = re.sub(r'\s*\([^)]*\)', '', st).strip()            # drop "(E to WNA)" / "(City, Country)"
    words = [w.strip(".,;:!-–—|/\"'[]") for w in re.split(r'[\s|/_]+', name)]
    words = [w for w in words if w and not re.fullmatch(r'[\d.,:-]+', w) and '@' not in w
             and not re.search(r'\.(wav|mp3|ogg|flac)$', w, re.I) and len(w) <= 24]
    places = []
    m = re.search(r'\(([^)]*)\)\s*$', st)
    if m and ' to ' not in m.group(1):
        places += [p.strip() for p in m.group(1).split(',') if p.strip()]
    if c.get('location'):
        places += [p.strip() for p in re.split(r'[,|]', c['location']) if p.strip()]
    elif c.get('receiver') and '|' in c['receiver']:
        places += [p.strip() for p in c['receiver'].split('|')[-1].split(',') if p.strip()]
    places = [re.sub(r'^the\s+', '', p, flags=re.I) for p in places
              if len(p) <= 28 and '@' not in p and not re.fullmatch(r'\d{4}', p)]
    if c.get('mode') in ('net', 'mic'):
        freq = None
    elif c.get('mode') == 'archive':
        freq = str(c['year']) if c.get('year') else None
    elif c.get('mode') == 'fm' or c['freq_khz'] >= 30000:
        freq = f"{c['freq_khz'] / 1000:.1f}"
    else:
        f = c['freq_khz']
        freq = f"{f:.0f}" if abs(f - round(f)) < 0.05 else f"{f:.1f}"
    return words, places, freq


def _splice(rng, a, b):
    i = max(1, len(a) // 2 + int(rng.integers(-1, 2)))
    j = max(1, len(b) // 2 + int(rng.integers(-1, 2)))
    return a[:i] + b[j:]


def make_title(rng, log, tag, voices, taken):
    clips = []
    seen = set()
    for c in TRACK_NOTES['clips']:
        if c['path'] not in seen:
            seen.add(c['path'])
            clips.append(c)
    names, places, freqs = [], [], []
    for c in clips:
        w, p, f = _clip_tokens(c)
        names += w
        places += p
        if f:
            freqs.append(f)
    techs = list(dict.fromkeys(TRACK_NOTES['tech']))
    for v in voices:
        t = data_token(v.first)
        if t:
            techs.append(t)
    techs = list(dict.fromkeys(techs))
    good = lambda ws: [w for w in dict.fromkeys(ws) if w.lower() not in _GENERIC and len(w) > 1]
    names, places, freqs = good(names) or list(dict.fromkeys(names)), list(dict.fromkeys(places)), \
        list(dict.fromkeys(freqs))

    def draw(bucket):
        return bucket.pop(int(rng.integers(len(bucket)))) if bucket else None

    buckets = {'name': names[:], 'place': places[:], 'freq': freqs[:], 'tech': techs[:]}
    order = ['name', 'tech', 'freq', 'place', 'name', 'tech', 'place', 'freq']
    want = int(rng.integers(3, 6))
    words = []
    for b in order:
        if len(words) >= want:
            break
        if b in ('freq', 'place') and rng.random() < 0.35:
            continue
        w = draw(buckets[b])
        if w:
            if b == 'name' and buckets['name'] and rng.random() < 0.25:
                w = _splice(rng, w, draw(buckets['name']))          # a portmanteau of two stations
            words.append(w)
    if not words:
        words = [tag]
    words = [words[i] for i in rng.permutation(len(words))]
    title = " ".join(words)

    try:
        with open(TITLE_FILE, encoding='utf-8') as f:
            ever = {ln.strip() for ln in f if ln.strip()}
    except OSError:
        ever = set()
    spare = [w for b in ('tech', 'freq', 'place', 'name') for w in buckets[b]]
    k = 2
    while title in ever or title in taken:
        if spare:
            title = f"{title} {spare.pop(0)}"
        else:
            title = f"{' '.join(words)} {k}"
            k += 1
    try:
        with open(TITLE_FILE, 'a', encoding='utf-8') as f:
            f.write(title + "\n")
    except OSError:
        pass
    TRACK_NOTES['clips'].clear()
    TRACK_NOTES['tech'].clear()
    return title


# ------------------------------------------------------------- a track's palette
# what one track keeps to, so it holds together while every track is different:
# a few related clips, a family of one or two data sources, a few data operations.

_SOUND = {}
DATA_FAMILY = []          # the current track's data sources (the fusion techniques draw from it)


def clip_sound(c):
    """a small description of how a clip sounds: brightness, noisiness, movement, peakiness."""
    v = _SOUND.get(c['path'])
    if v is None:
        try:
            x, rate = _read_clip(c['path'])
            x = x[:int(30 * rate)]
            mode = c['mode'] if c['mode'] in PASSBANDS else 'am'
            flat, peak, cv = features(x * 32768.0, rate, mode)
            m = min(len(x), 1 << 18)
            sp = np.abs(np.fft.rfft(x[:m]))
            f = np.fft.rfftfreq(m, 1 / rate)
            cen = float((sp * f).sum() / (sp.sum() + 1e-9))
            v = np.array([math.log(cen + 50.0), flat, min(cv, 2.0), peak / 20.0])
        except (OSError, wave.Error, ValueError):
            v = np.zeros(4)
        _SOUND[c['path']] = v
    return v


FRESH = {'half_life_days': 2.0}


def set_freshness(clips, half_life_days):
    """weight each clip by how recently it was gathered: today's finds count fully, a clip
    `half_life_days` old counts half, and nothing ever drops below a twentieth."""
    FRESH['half_life_days'] = half_life_days
    now = datetime.datetime.now(datetime.timezone.utc)
    for c in clips:
        if half_life_days <= 0:
            c['fresh'] = 1.0
            continue
        try:
            t = datetime.datetime.fromisoformat(str(c.get('utc')))
            age = max(0.0, (now - t).total_seconds() / 86400.0)
        except (TypeError, ValueError):
            age = 30.0 * half_life_days                       # no date: treat it as long ago
        c['fresh'] = max(0.05, 0.5 ** (age / half_life_days))


def fresh_weights():
    w = np.array([float(c.get('fresh', 1.0)) for c in RADIO_CLIPS])
    return w / w.sum()


def fresh_clip(rng):
    """a clip index, leaning towards recent finds."""
    return int(rng.choice(len(RADIO_CLIPS), p=fresh_weights()))


def palette(rng, allowed, log):
    pal = {'clips': [], 'data': [], 'ops': []}
    if RADIO_CLIPS:
        N = len(RADIO_CLIPS)
        k = int(min(N, rng.integers(3, 9)))
        p = fresh_weights()
        seed = int(rng.choice(N, p=p))
        # the clips a palette can gather around its seed: a draw that leans towards recent finds
        cand = set(int(i) for i in rng.choice(N, size=min(N, max(3 * k, 16)), replace=False, p=p)) | {seed}
        cand = np.array(sorted(cand))
        if rng.random() < 0.5:
            order = cand[np.argsort(np.abs(cand - seed) + rng.random(len(cand)) * 0.5)]
            how = "neighbours on the dial"
        else:
            F = np.array([clip_sound(RADIO_CLIPS[i]) for i in cand])
            F = (F - F.mean(axis=0)) / (F.std(axis=0) + 1e-9)
            me = int(np.nonzero(cand == seed)[0][0])
            order = cand[np.argsort(((F - F[me]) ** 2).sum(axis=1))]
            how = "the clips that sound most alike"
        pal['clips'] = [int(i) for i in order[:k]]
        ages = []
        for i in pal['clips']:
            try:
                t = datetime.datetime.fromisoformat(str(RADIO_CLIPS[i].get('utc')))
                ages.append((datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() / 3600.0)
            except (TypeError, ValueError):
                pass
        lean = (f", leaning to recent finds (half-life {FRESH['half_life_days']:g} days; these were "
                f"gathered {min(ages):.0f}-{max(ages):.0f} h ago)" if ages and FRESH['half_life_days'] > 0 else "")
        log.append(f"palette: {k} clips, {how}{lean}:")
        for i in pal['clips']:
            log.append(f"    {clip_label(RADIO_CLIPS[i])}")
    data_only = [i for i in allowed if cd.SOURCES[i][0] not in NOT_DATA]
    if data_only:
        m = int(min(len(data_only), rng.integers(1, 3)))
        pal['data'] = [int(i) for i in rng.choice(data_only, size=m, replace=False)]
        log.append("palette: data family " + ", ".join(cd.SOURCES[i][3] for i in pal['data']))
    pal['ops'] = sorted(int(i) for i in rng.choice(len(cd.OPS), size=int(rng.integers(2, 5)), replace=False))
    log.append("palette: operations " + ", ".join(cd.OPS[i].__name__[3:] for i in pal['ops']))
    DATA_FAMILY[:] = pal['data']
    return pal


def pick_clip(rng, pal):
    return pal['clips'][int(rng.integers(len(pal['clips'])))] if pal['clips'] else fresh_clip(rng)


def baseline_score(rng, total, cap, log, allowed):
    """radio first: lanes of radio clips laid end to end across the whole track, cross-fading;
    then 'bends', where stretches of that bed are run through data operations in place;
    then a score of data voices (automaton or drift) on top."""
    secs = total / SR
    radio = cd.SOURCE_INDEX.get('radio')
    pal = palette(rng, allowed, log)
    data_only = pal['data']
    slots, pic = [], []
    W = 100
    col = lambda t: int(min(W - 1, max(0, t / secs * W)))
    if RADIO_CLIPS and radio in allowed:
        lanes = int(rng.integers(1, 4))
        bed_db = float(rng.uniform(-20.0, -12.0))
        per_lane = bed_db - 10.0 * math.log10(lanes)
        log.append(f"baseline: {lanes} lane(s) of radio across the whole track, around {bed_db:.0f} dB, "
                   f"clip cross-fading into clip; then bends of the bed; then data voices on top")
        pic.append(f"--- the baseline over {fmt(secs)} (letters are successive clips in each lane, "
                   f"~ marks a bend) ---")
        for L in range(lanes):
            home = float(rng.uniform(0.15, 0.85)) if lanes > 1 else 0.5
            t = float(rng.uniform(0.0, 3.0)) if L else 0.0
            row = [' '] * W
            k = 0
            while t < secs - 1.0:
                if L and rng.random() < 0.12:             # a second or third lane sometimes rests
                    t += log_uniform(rng, 2.0, 15.0)
                    continue
                ci = pick_clip(rng, pal)
                speed = 1.0 if rng.random() < 0.7 else float(2.0 ** rng.normal(0.0, 0.35))
                avail = float(RADIO_CLIPS[ci].get('seconds') or 10.0) / speed
                seg = min(log_uniform(rng, 5.0, 40.0), max(3.0, avail))
                xf = float(min(seg / 3.0, rng.uniform(0.5, 4.0)))
                st = int(t * SR)
                n = int(min(seg * SR, total - st))
                if n < SR:
                    break
                xf = min(xf, n / SR / 3.0)                # a cut-short last clip still moves time forward
                hint = {'src': radio, 'depth': 0.0, 'slip': 0, 'fade': xf,
                        'amp_db': per_lane + float(rng.normal(0.0, 1.5)),
                        'pan': float(np.clip(home + rng.normal(0.0, 0.08), 0.0, 1.0)),
                        'source_hint': {'clip': ci, 'speed': speed, 'reading': 'tape', 'fit': True}}
                slots.append((st, n, f"bed {L + 1}.{k + 1}", hint))
                for c in range(col(t), col(t + n / SR) + 1):
                    row[c] = chr(ord('a') + k % 26)
                k += 1
                if st + n >= total:
                    break
                t += n / SR - xf
            pic.append(f"  lane {L + 1} |" + "".join(row) + "|")
        nb = int(round(log_uniform(rng, 0.15, 1.0) * secs / 60.0))     # bends are events, not weather
        brow = [' '] * W
        for j in range(nb):
            st = int(rng.uniform(0.0, max(1.0, secs - 3.0)) * SR)
            n = int(min(log_uniform(rng, 2.0, 25.0) * SR, total - st))
            slots.append((st, n, f"bend {j + 1}", {'bend': True, 'depth': float(rng.uniform(0.3, 1.0)),
                                                    'fade': float(rng.uniform(0.2, 1.5)), 'ops': pal['ops']}))
            for c in range(col(st / SR), col((st + n) / SR) + 1):
                brow[c] = '~'
        pic.append("  bends  |" + "".join(brow) + "|")
        log.append(f"  {nb} bend(s): stretches of the bed run through data operations and cross-faded in place")
    else:
        log.append("baseline: no radio clips to lay down, so data voices only")
    tag = "baseline"
    if data_only:
        sub = str(rng.choice(['automaton', 'drift']))
        oslots, opic, otag = cd.FORMS[sub](rng, total, cap, log, data_only)
        slots += [(s0, n0, c0, {'pool': data_only, 'ops': pal['ops']}) for (s0, n0, c0, *_) in oslots]
        pic += opic
        tag = f"baseline-{otag}"
    return slots, pic, tag


# ------------------------------------------- fusion: radio and data as one sound
# four techniques, each a source of its own: data gives the shape, radio the matter.

FUSION_KEYS = ['mosaic', 'spectral', 'cross', 'playhead']
NOT_DATA = set(FUSION_KEYS) | {'radio', 'impulses', 'loop', 'hits'}


def clip_label(c):
    return ((f"{c['station']}, " if c.get('station') else "") + dial_text(c)
            + (f" via {c['receiver']}" if c.get('receiver') else ""))


_AT_SR = {}


def clip_at_sr(i):
    """clip i resampled to the working rate, peak-normalised, ends softened (cached; not noted)."""
    c = RADIO_CLIPS[i]
    y = _AT_SR.get(c['path'])
    if y is None:
        x, rate = _read_clip(c['path'])
        m = int(len(x) * SR / rate)
        y = np.interp(np.arange(m) * (rate / SR), np.arange(len(x)), x)
        e = min(m // 4, int(0.02 * SR))
        if e > 1:
            y[:e] *= ramp(e)
            y[-e:] *= ramp(e)[::-1]
        pk = float(np.max(np.abs(y)))
        y = y / pk if pk > 0 else y
        if len(_AT_SR) > 24:
            _AT_SR.clear()
        _AT_SR[c['path']] = y
    return y.copy(), c


def radio_at_sr(rng, hint=None):
    """one cached clip (or, with hint 'material', a given stretch of sound), at the working rate."""
    hint = hint or {}
    if 'material' in hint:
        c = hint['material_clip']
        note_clip(c)
        y = np.asarray(hint['material'], dtype=np.float64)
        pk = float(np.max(np.abs(y)))
        return (y / pk if pk > 0 else y.copy()), c
    if 'clip' in hint:
        i = int(hint['clip']) % len(RADIO_CLIPS)
    elif 'dial' in hint:
        i = int(round(float(hint['dial']) * (len(RADIO_CLIPS) - 1)))
    else:
        i = fresh_clip(rng)
    y, c = clip_at_sr(i)
    note_clip(c)
    return y, c


def looped(rng, y, n):
    """y read from a chance point for n samples, wrapping round if it is shorter."""
    s = int(rng.integers(0, max(1, len(y))))
    return y[(s + np.arange(n)) % len(y)]


def data_stream(rng, n):
    """a stream from one of chance_data's own sources."""
    keys = list(DATA_FAMILY) or [i for i, s in enumerate(cd.SOURCES) if s[0] not in NOT_DATA]
    w = np.array([cd.SOURCES[i][2] for i in keys])
    i = keys[int(rng.choice(len(keys), p=w / w.sum()))]
    x, desc = cd.SOURCES[i][1](rng, n)
    note_tech(data_token(desc))
    x = cd.dc_block(cd.fit(np.asarray(x, dtype=np.float64), n))
    pk = float(np.max(np.abs(x)))
    return (x / pk if pk > 0 else x), desc


def stft_process(signals, n, fn, nfft=2048, hop=512):
    """short-time Fourier analysis of each signal, fn(frame indices, spectra) -> spectra,
    then overlap-add resynthesis. works through the frames in chunks to keep memory small."""
    win = np.hanning(nfft)
    padded = [np.concatenate([np.zeros(nfft), cd.fit(s, n), np.zeros(nfft)]) for s in signals]
    frames = (n + nfft) // hop + 1
    out = np.zeros(n + 3 * nfft)
    wsum = np.zeros(n + 3 * nfft)
    views = [np.lib.stride_tricks.sliding_window_view(p, nfft) for p in padded]
    for a in range(0, frames, 1024):
        idx = np.arange(a, min(frames, a + 1024))
        idx = idx[idx * hop < views[0].shape[0]]
        if not len(idx):
            break
        specs = [np.fft.rfft(v[idx * hop] * win, axis=1) for v in views]
        yf = np.fft.irfft(fn(idx, specs), nfft, axis=1) * win
        for j, f in enumerate(idx):
            out[f * hop:f * hop + nfft] += yf[j]
            wsum[f * hop:f * hop + nfft] += win * win
    return out[nfft:nfft + n] / np.maximum(wsum[nfft:nfft + n], 1e-3)


def smooth_bins(M, w):
    """moving average across frequency bins (rows are frames)."""
    w = int(max(1, w))
    if w <= 1:
        return M
    pad = np.pad(M, ((0, 0), (w // 2, w - w // 2)), mode='edge')
    c = np.concatenate([np.zeros((M.shape[0], 1)), np.cumsum(pad, axis=1)], axis=1)
    return (c[:, w:] - c[:, :-w])[:, :M.shape[1]] / w


def src_mosaic(rng, n, hint=None):
    """a data stream rebuilt from grains of radio: each grain of the data is replaced by the
    radio grain whose loudness and brightness match it best."""
    if not RADIO_CLIPS:
        return cd.src_bytes(rng, n)
    note_tech("Mosaic")
    target, tdesc = data_stream(rng, n)
    clips = [radio_at_sr(rng, hint)] + [radio_at_sr(rng) for _ in range(int(rng.integers(0, 3)))]
    g = int(rng.choice([512, 1024, 1024, 2048, 4096]))
    hop = g // 2
    win = np.hanning(g)
    freqs = np.fft.rfftfreq(g, 1 / SR)

    def feats(G):
        r = np.sqrt(np.mean(G * G, axis=1)) + 1e-9
        sp = np.abs(np.fft.rfft(G, axis=1)) + 1e-12
        cen = (sp * freqs).sum(axis=1) / sp.sum(axis=1)
        F = np.stack([np.log(r), np.log(cen + 20.0)], axis=1)
        return (F - F.mean(axis=0)) / (F.std(axis=0) + 1e-9), r

    corpus = np.concatenate([np.lib.stride_tricks.sliding_window_view(y, g)[::hop] for y, _ in clips
                             if len(y) > g])
    if len(corpus) > 12000:
        corpus = corpus[np.sort(rng.choice(len(corpus), 12000, replace=False))]
    corpus = corpus * win
    Fc, rc = feats(corpus)
    tp = np.concatenate([target, np.zeros(g)])
    T = np.lib.stride_tricks.sliding_window_view(tp, g)[::hop][: n // hop + 1] * win
    Ft, rt = feats(T)
    wt = np.array([float(rng.uniform(0.3, 1.0)), float(rng.uniform(0.3, 1.0))])
    k = int(rng.integers(1, 5))
    pick = np.empty(len(T), dtype=np.int64)
    for a in range(0, len(T), 256):
        d = (((Ft[a:a + 256, None, :] - Fc[None, :, :]) * wt) ** 2).sum(axis=2)
        near = np.argpartition(d, min(k, d.shape[1] - 1), axis=1)[:, :k]
        pick[a:a + 256] = near[np.arange(len(near)), rng.integers(0, k, len(near))]
    out = np.zeros(n + g)
    gain = np.minimum(rt / rc[pick], 20.0)
    for i, j in enumerate(pick):
        out[i * hop:i * hop + g] += corpus[j] * gain[i]
    names = " + ".join(clip_label(c) for _, c in clips)
    return out[:n], (f"mosaic: [{tdesc}] rebuilt from {g}-sample grains of radio [{names}] "
                     f"(nearest {k} by loudness and brightness)")


def src_spectral(rng, n, hint=None):
    """radio heard through a pattern: its spectrum split into bands that a cellular automaton
    (or a Thue-Morse or Rudin-Shapiro grid) opens and closes over time."""
    if not RADIO_CLIPS:
        return cd.src_bytes(rng, n)
    y, c = radio_at_sr(rng, hint)
    r = looped(rng, y, n)
    nfft, hop = 2048, 512
    B = int(rng.choice([12, 16, 24, 32, 48, 64, 96]))
    edges = np.geomspace(40.0, 16000.0, B + 1)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    band = np.clip(np.searchsorted(edges, f) - 1, 0, B - 1)
    row_frames = max(1, int(log_uniform(rng, 0.04, 1.5) * SR / hop))
    if hint and 'row_s' in hint:                       # rows locked to the song's pulse
        row_frames = max(1, int(round(float(hint['row_s']) * SR / hop)))
    frames = (n + nfft) // hop + 1
    R = frames // row_frames + 2
    kind = str(rng.choice(['automaton', 'automaton', 'automaton', 'Thue-Morse', 'Rudin-Shapiro']))
    if kind == 'automaton':
        rule = int(rng.choice(cd.RULES_1D))
        row = (rng.random(B) < rng.uniform(0.2, 0.6)).astype(np.uint8) if rng.random() < 0.7 else \
            np.eye(1, B, B // 2, dtype=np.uint8)[0]
        grid = cd.run_eca(rule, row, R).astype(np.float64)
        what = f"rule {rule} automaton"
    else:
        k = int(rng.integers(1, 2 * B))
        idx = np.arange(R)[:, None] * k + np.arange(B)[None, :]
        seq = cd.seq_thue_morse if kind == 'Thue-Morse' else cd.seq_rudin_shapiro
        grid = seq(int(idx.max()) + 1)[idx].astype(np.float64)
        what = f"{kind} grid (stride {k})"
    floor = 10 ** (-float(rng.uniform(18, 45)) / 20)
    m = np.repeat(grid, row_frames, axis=0)[:frames]
    w = max(1, int(row_frames * rng.uniform(0.1, 0.6)))
    for b in range(B):
        m[:, b] = box_smooth(m[:, b], w, passes=2)
    m = floor + (1.0 - floor) * m

    def fn(idx, specs):
        return specs[0] * m[np.minimum(idx, frames - 1)][:, band]

    out = stft_process([r], n, fn, nfft, hop)
    note_tech("Spectral")
    note_tech(what.split(' grid')[0].replace('rule', 'Rule').replace(' automaton', ''))
    return out, (f"spectral: radio [{clip_label(c)}] through a {what}, {B} bands, each row "
                 f"{row_frames * hop / SR * 1000:.0f} ms, closed bands at {20 * np.log10(floor):.0f} dB")


def src_cross(rng, n, hint=None):
    """cross-synthesis of radio and data in the frequency domain."""
    if not RADIO_CLIPS:
        return cd.src_bytes(rng, n)
    y, c = radio_at_sr(rng, hint)
    r = looped(rng, y, n)
    d, ddesc = data_stream(rng, n)
    r = r / (np.sqrt(np.mean(r * r)) + 1e-9)
    d = d / (np.sqrt(np.mean(d * d)) + 1e-9)
    mode = str(rng.choice(['morph', 'radio through data', 'data through radio']))
    frames = (n + 2048) // 512 + 1
    sw = int(rng.integers(6, 40))
    if mode == 'morph':
        a_path, kp = drift(rng, max(frames, 8), 0.0, 1.0, per_secs=0.5)
        phase_from = str(rng.choice(['radio', 'data']))

        def fn(idx, specs):
            R, D = specs
            a = a_path[np.minimum(idx, len(a_path) - 1)][:, None]
            mag = np.abs(R) ** (1 - a) * np.abs(D) ** a
            ph = R if phase_from == 'radio' else D
            return mag * np.exp(1j * np.angle(ph))
        how = f"morphing between them ({kp} pts), the {phase_from}'s phase"
    else:
        carrier, shaper = (0, 1) if mode == 'radio through data' else (1, 0)

        def fn(idx, specs):
            C, S = specs[carrier], specs[shaper]
            fine = C / (smooth_bins(np.abs(C), sw) + 1e-9)
            return fine * smooth_bins(np.abs(S), sw)
        how = f"the {'data' if mode == 'radio through data' else 'radio'}'s spectral shape ({sw}-bin envelope)"
    out = stft_process([r, d], n, fn)
    note_tech({'morph': 'Morph', 'radio through data': 'Vocoder', 'data through radio': 'Inverse'}[mode])
    return out, f"cross: radio [{clip_label(c)}] x data [{ddesc}], {mode}: {how}"


def src_playhead(rng, n, hint=None):
    """data playing the radio: a data stream sets where in a clip to read, how fast, or which way."""
    if not RADIO_CLIPS:
        return cd.src_bytes(rng, n)
    y, c = radio_at_sr(rng, hint)
    L = len(y)
    d, ddesc = data_stream(rng, n)
    sw = int(log_uniform(rng, 1, 400))
    d = box_smooth(d, sw, passes=1) if sw > 1 else d
    d = d / (np.max(np.abs(d)) + 1e-9)
    mode = str(rng.choice(['position', 'position', 'speed', 'direction']))
    if mode == 'position':
        span = log_uniform(rng, 0.01, max(0.02, min(L / SR * 0.8, 6.0))) * SR
        centre, kc = drift(rng, n, span / 2, max(span / 2 + 1, L - span / 2), per_secs=6.0)
        pos = centre + d * span / 2
        how = f"sets the read position within a {span / SR * 1000:.0f} ms window drifting through the clip"
    elif mode == 'speed':
        octs = float(rng.uniform(0.5, 3.0))
        pos = float(rng.uniform(0, L)) + np.cumsum(2.0 ** (d * octs))
        how = f"sets the speed (+-{octs:.1f} oct)"
    else:
        base = 2.0 ** float(rng.uniform(-1.0, 1.0))
        pos = float(rng.uniform(0, L)) + np.cumsum(np.where(d >= 0, base, -base))
        how = f"turns the tape forward and back (x{base:.2f})"
    out = np.interp(np.mod(pos, L), np.arange(L), y)
    note_tech("Playhead")
    soft = f", softened over {sw} samples" if sw > 1 else ""
    return out, f"playhead: data [{ddesc}] {how}{soft}, reading radio [{clip_label(c)}]"


def fusion_score(rng, total, cap, log, allowed):
    """a bed of radio fused with data. each track has one main technique (perhaps a second
    in another lane), keeps to its palette of clips and data, and each lane keeps its own
    process from segment to segment, so the track is one sound changing, not many."""
    tech = [cd.SOURCE_INDEX[k] for k in FUSION_KEYS if cd.SOURCE_INDEX.get(k) in allowed]
    radio = cd.SOURCE_INDEX.get('radio')
    if not tech or not RADIO_CLIPS:
        log.append("fusion: no radio clips or fusion sources allowed; falling back to the baseline")
        return baseline_score(rng, total, cap, log, allowed)
    secs = total / SR
    W = 100
    col = lambda t: int(min(W - 1, max(0, t / secs * W)))
    pal = palette(rng, allowed, log)
    main = tech[int(rng.integers(len(tech)))]
    rest = [t for t in tech if t != main]
    second = rest[int(rng.integers(len(rest)))] if rest and rng.random() < 0.5 else None
    lanes = int(rng.integers(1, 3))
    lane_tech = [main] + [second or main] * (lanes - 1)
    p_plain = float(rng.uniform(0.0, 0.2)) if radio in allowed else 0.0
    p_same = float(rng.uniform(0.7, 0.95))
    lane_db = float(rng.uniform(-18.0, -11.0)) - 10.0 * math.log10(lanes)
    letter = {cd.SOURCE_INDEX[k]: k[0].upper() for k in FUSION_KEYS if k in cd.SOURCE_INDEX}
    log.append(f"fusion: {lanes} lane(s); main technique {cd.SOURCES[main][0]}"
               + (f", second {cd.SOURCES[second][0]}" if second and lanes > 1 else "")
               + f"; each lane keeps its process {100 * p_same:.0f}% of the time; "
               f"{100 * p_plain:.0f}% of segments plain radio; around {lane_db:.0f} dB per lane")
    pic = [f"--- the fusion bed over {fmt(secs)} (M mosaic, S spectral, C cross, P playhead, "
           f"r plain radio, ~ bend) ---"]
    slots = []
    for L in range(lanes):
        home = float(rng.uniform(0.2, 0.8)) if lanes > 1 else 0.5
        t = float(rng.uniform(0.0, 4.0)) if L else 0.0
        row = [' '] * W
        k = 0
        while t < secs - 1.0:
            seg = log_uniform(rng, 12.0, 70.0)
            xf = float(min(seg / 3.0, rng.uniform(2.0, 8.0)))
            st = int(t * SR)
            n = int(min(seg * SR, total - st))
            if n < 2 * SR:
                break
            xf = min(xf, n / SR / 3.0)                    # a cut-short last segment still moves time forward
            ci = pick_clip(rng, pal)
            if rng.random() < p_plain:
                src, mark, key = radio, 'r', f"plain {L + 1}"
                sh = {'clip': ci, 'reading': 'tape', 'speed': 1.0, 'fit': True}
            else:
                src, key = lane_tech[L], f"lane {L + 1}"
                mark = letter[src]
                sh = {'clip': ci}
            hint = {'src': src, 'depth': float(rng.uniform(0.0, 0.2)), 'slip': 0, 'fade': xf,
                    'amp_db': lane_db + float(rng.normal(0.0, 1.0)),
                    'pan': float(np.clip(home + rng.normal(0.0, 0.06), 0.0, 1.0)), 'source_hint': sh,
                    'p_return': p_same, 'ops': pal['ops']}
            if pal['data']:
                hint['pool'] = pal['data']
            slots.append((st, n, key, hint))
            for cc in range(col(t), col(t + n / SR) + 1):
                row[cc] = mark
            k += 1
            if st + n >= total:
                break
            t += n / SR - xf
        pic.append(f"  lane {L + 1} |" + "".join(row) + "|")
    nb = int(round(log_uniform(rng, 0.2, 1.2) * secs / 60.0))
    brow = [' '] * W
    for j in range(nb):
        st = int(rng.uniform(0.0, max(1.0, secs - 3.0)) * SR)
        n = int(min(log_uniform(rng, 2.0, 20.0) * SR, total - st))
        slots.append((st, n, f"bend {j + 1}", {'bend': True, 'depth': float(rng.uniform(0.3, 1.0)),
                                                'fade': float(rng.uniform(0.3, 2.0)), 'ops': pal['ops']}))
        for cc in range(col(st / SR), col((st + n) / SR) + 1):
            brow[cc] = '~'
    pic.append("  bends  |" + "".join(brow) + "|")
    tag = "fusion-" + cd.SOURCES[main][0]
    if pal['data'] and rng.random() < 0.4:
        oslots, opic, otag = cd.drift_score(rng, total, int(rng.integers(1, 3)), log)
        keep = oslots[:max(1, len(oslots) // 2)]
        slots += [(s0, n0, c0, {'pool': pal['data'], 'ops': pal['ops']}) for (s0, n0, c0, *_) in keep]
        log.append(f"  and {len(keep)} sparse data voice(s) from the family over the top")
    # the arc comes last, with its own draws, so the material above is exactly what it would be
    slots = fusion_arc(np.random.default_rng(int(rng.integers(1 << 62))), slots, total, lanes, pal, radio,
                       log, pic, col, W)
    return slots, pic, tag


FUSION_ARCS = [('none', 0.35), ('accumulation', 0.2), ('erosion', 0.15), ('revelation', 0.15), ('arch', 0.15)]


def fusion_arc(rng, slots, total, lanes, pal, radio, log, pic, col, W):
    """give a fusion song somewhere to go, without loops: lanes join (accumulation) or join and
    leave (arch), data slowly eats the sound (erosion), or plain radio surfaces through it
    (revelation) -- each with its loudness shape -- and some segment changes become hard cuts.
    'none' leaves the free-drifting fusion as it is."""
    choices = [a for a in FUSION_ARCS if lanes > 1 or a[0] not in ('accumulation', 'arch')]
    w = np.array([p for _, p in choices])
    arc = choices[int(rng.choice(len(choices), p=w / w.sum()))][0]
    frac = lambda st: st / total
    lane_of = lambda key: key.split()[-1] if key.split()[0] in ('lane', 'plain') else None
    out = []

    # accumulation and arch: the second lane has a window it lives in
    window = None
    if arc == 'accumulation':
        window = (float(rng.uniform(0.25, 0.5)), 1.01)
    elif arc == 'arch':
        window = (float(rng.uniform(0.15, 0.35)), float(rng.uniform(0.7, 0.85)))
    morph_ops = [cd.OPS.index(getattr(cd, nm)) for nm in MORPH_OPS]
    pick = sorted(set(int(i) for i in rng.choice(morph_ops, size=int(rng.integers(2, 4)), replace=False)))
    loud = ARCS[arc][1] if arc != 'none' else None
    revealed = 0
    for st, n, key, *rest in slots:
        hint = dict(rest[0]) if rest else {}
        ln = lane_of(key) if isinstance(key, str) else None
        g0, g1 = frac(st), frac(st + n)
        if window and ln == '2':
            if g0 < window[0] or g0 > window[1]:
                continue                                       # outside its window: not yet, or gone
        if window and arc == 'accumulation' and not isinstance(key, str) and g0 < 0.5:
            continue                                           # data voices join late
        if loud and not hint.get('bend'):
            pts = []
            for q in np.linspace(0, 1, 12):
                gq = g0 + (g1 - g0) * q
                pts.append((float(q), float(np.interp(gq, [p for p, _ in loud], [v for _, v in loud]))))
            hint['curve'] = pts
        if arc == 'erosion' and ln and not hint.get('bend'):
            wet = lambda g: float(np.interp(g, [0.0, 0.2, 1.0], [0.0, 0.0, 0.9]))
            hint['morph'] = {'seed': int(rng.integers(1 << 62)), 'ops': pick,
                             'curve': [(0.0, wet(g0)), (1.0, wet(g1))]}
        if arc == 'revelation' and ln and not hint.get('bend'):
            wet = lambda g: float(np.interp(g, [0.0, 0.7, 1.0], [0.8, 0.0, 0.0]))
            hint['morph'] = {'seed': int(rng.integers(1 << 62)), 'ops': pick,
                             'curve': [(0.0, wet(g0)), (1.0, wet(g1))]}
            p_reveal = float(np.interp(g0, [0.0, 0.45, 0.9], [0.0, 0.0, 0.85]))
            if key.startswith('lane') and radio is not None and rng.random() < p_reveal:
                sh = hint.get('source_hint') or {}
                hint['src'] = radio
                hint['source_hint'] = {'clip': sh.get('clip', 0), 'reading': 'tape', 'speed': 1.0, 'fit': True}
                key = f"plain {ln}"
                revealed += 1
        out.append([st, n, key, hint])

    # some segment changes become hard cuts: the next segment simply arrives
    p_cut = float(rng.uniform(0.0, 0.45))
    cuts = 0
    by_lane = {}
    for s_ in out:
        ln = lane_of(s_[2]) if isinstance(s_[2], str) else None
        if ln and not s_[3].get('bend'):
            by_lane.setdefault(ln, []).append(s_)
    for segs in by_lane.values():
        segs.sort(key=lambda s_: s_[0])
        for prev, cur in zip(segs, segs[1:]):
            if cur[0] > prev[0] and rng.random() < p_cut:
                prev[1] = cur[0] - prev[0]                     # the old one stops where the new one starts
                prev[3]['fade_out'] = 0.008
                cur[3]['fade_in'] = 0.004
                cuts += 1
        if window and segs:
            segs[0][3]['fade_in'] = max(segs[0][3].get('fade', 2.0), 4.0)    # the lane's entrance
            if arc == 'arch':
                segs[-1][3]['fade_out'] = max(segs[-1][3].get('fade', 2.0), 6.0)
    desc = {'none': "free drift: no arc, the fusion as it comes",
            'accumulation': f"the second lane joins at {window[0] * 100:.0f}% of the way through" if window else "",
            'erosion': "data processes slowly eat into the fused sound",
            'revelation': f"the fusion clears and plain radio surfaces ({revealed} segment(s) revealed)",
            'arch': (f"the second lane joins at {window[0] * 100:.0f}% and leaves at {window[1] * 100:.0f}%"
                     if window else "")}[arc]
    log.append(f"fusion arc: {arc} -- {desc}; {cuts} segment change(s) are hard cuts")
    if arc != 'none':
        note_tech(arc.capitalize())
        cd.END_PREF = ARCS[arc][2]
    # redraw the lane rows so the picture shows what is left
    rows = {}
    for st, n, key, hint in out:
        ln = lane_of(key) if isinstance(key, str) else None
        if ln and not hint.get('bend'):
            r = rows.setdefault(ln, [' '] * W)
            mark = 'r' if key.startswith('plain') else {cd.SOURCE_INDEX[k]: k[0].upper()
                                                        for k in FUSION_KEYS if k in cd.SOURCE_INDEX}.get(hint['src'], '?')
            for cc in range(col(st / SR), col((st + n) / SR) + 1):
                r[cc] = mark
    pic[:] = [p for p in pic if not p.startswith("  lane ")]
    for ln in sorted(rows):
        pic.insert(len(pic) - 1, f"  lane {ln} |" + "".join(rows[ln]) + "|")
    pic.insert(1, f"  arc: {arc}")
    return [tuple(s_[:3]) + (s_[3],) for s_ in out]


# ------------------------------------------------------------------- loops
# a song that commits: a pulse found in the radio itself, loops cut to it, lanes phasing,
# rhythms of radio slices played in data patterns, and a few long sections, the strongest
# ideas (heard first, by the program, before it decides) given the most time.

def envelope_100(y):
    """loudness 100 times a second."""
    w = SR // 100
    m = len(y) // w
    if m < 2:
        return np.zeros(2)
    return np.sqrt((y[:m * w].reshape(m, w) ** 2).mean(axis=1))


def periods(y, lo=0.15, hi=8.0, k=5):
    """the strongest repetitions in a sound's loudness: [(period in s, strength 0..1)]."""
    e = envelope_100(y)
    e = e - e.mean()
    if len(e) < 60 or not e.any():
        return []
    nf = cd.fast_len(2 * len(e))
    F = np.fft.rfft(e, nf)
    ac = np.fft.irfft(F * np.conj(F), nf)[:len(e)]
    ac = ac / (ac[0] + 1e-12)
    a, b = int(lo * 100), min(len(ac) - 2, int(hi * 100), len(e) // 2)
    if b <= a + 2:
        return []
    seg = ac[a:b]
    pk = np.nonzero((seg[1:-1] > seg[:-2]) & (seg[1:-1] >= seg[2:]))[0] + 1
    pk = pk[np.argsort(seg[pk])[::-1][:k]]
    return [((a + int(i)) / 100.0, float(seg[i])) for i in pk]


def rhythm_of(x, lo=0.08, hi=None):
    """how strongly a sound repeats itself in time (0..1)."""
    hi = hi or max(lo * 2, len(x) / SR / 2)
    p = periods(x, lo, hi, 1)
    return max(0.0, p[0][1]) if p else 0.0


def render_loop(y, n, L, start, creep=0.0, extra=0, xf_s=0.006):
    """tile one stretch of y, L samples long (+extra per cycle, for phasing), over n samples.
    cycle k reads from start + creep*k/K, so a loop can slowly walk through its clip.
    cycles overlap by a few ms with complementary fades: no clicks, no dips."""
    Lk = max(64, int(round(L + extra)))
    r = max(2, min(Lk // 6, int(xf_s * SR)))
    K = n // Lk + 2
    win = np.ones(Lk + r)
    win[:r] = ramp(r)
    win[-r:] = ramp(r)[::-1]
    out = np.zeros(K * Lk + r)
    idx = np.arange(Lk + r)
    for k in range(K):
        s = int(start + creep * k / max(1, K - 1))
        out[k * Lk:k * Lk + Lk + r] += y[(s + idx) % len(y)] * win
    return out[r:r + n] if len(out) >= r + n else cd.fit(out[r:], n)


def src_loop(rng, n, hint=None):
    """a loop cut from a clip: its length, start, slow walk and phasing all given by the score."""
    hint = hint or {}
    if not RADIO_CLIPS and 'material' not in hint:
        return cd.src_bytes(rng, n)
    y, c = radio_at_sr(rng, hint)
    speed = float(hint.get('speed', 1.0))
    if speed != 1.0:
        m = int(len(y) / speed)
        y = np.interp(np.arange(m) * speed, np.arange(len(y)), y)
    L = int(float(hint.get('len_s', log_uniform(rng, 0.3, 4.0))) * SR)
    start = float(hint.get('start_s', rng.uniform(0, len(y) / SR))) * SR
    creep = float(hint.get('creep_s', 0.0)) * SR
    extra = float(hint.get('extra', 0.0))
    if hint.get('stages'):                            # the loop changes length at given moments
        bounds = [int(a_ * SR) for a_, _ in hint['stages']] + [n]
        out = np.zeros(n)
        for (a_s, Ls), b_ in zip(hint['stages'], bounds[1:]):
            a_ = int(a_s * SR)
            if b_ - a_ < 64:
                continue
            seg = render_loop(y, b_ - a_, int(Ls * SR), start)
            r_ = min((b_ - a_) // 4, int(0.004 * SR))
            if r_ > 1:
                seg[:r_] *= ramp(r_)
                seg[-r_:] *= ramp(r_)[::-1]
            out[a_:b_] = seg
        note_tech("Accelerando")
        stages = ", then ".join(f"{Ls * 1000:.0f} ms" for _, Ls in hint['stages'])
    else:
        out = render_loop(y, n, L, start, creep, extra)
        note_tech("Phase" if extra else "Loop")
        stages = ""
    if hint.get('sweep'):                             # a lowpass opening (or closing) over the layer
        pts = hint['sweep']
        frames = (n + 2048) // 512 + 1
        tf = np.clip((np.arange(frames) * 512 - 2048) / max(1, n), 0.0, 1.0)
        fc = np.exp(np.interp(tf, [q for q, _ in pts], [np.log(f) for _, f in pts]))
        ff = np.fft.rfftfreq(2048, 1 / SR)

        def fn(idx, specs):
            c_ = fc[np.minimum(idx, frames - 1)][:, None]
            return specs[0] / np.sqrt(1.0 + (ff[None, :] / c_) ** 4)
        out = stft_process([out], n, fn)
        stages += f"; a lowpass opening from {pts[0][1]:.0f} Hz to {pts[-1][1]:.0f} Hz"
        note_tech("Opening")
    walk = f", walking {creep / SR:.1f} s through the clip" if creep else ""
    ph = f", {extra:+.0f} samples a cycle (phasing)" if extra else ""
    sp = f", at x{speed:g}" if speed != 1.0 else ""
    if hint.get('stages'):
        return out, f"loop: radio [{clip_label(c)}] from {start / SR:.2f} s in stages of {stages}"
    return out, (f"loop: {L / SR * 1000:.0f} ms of radio [{clip_label(c)}] from {start / SR:.2f} s"
                 f"{sp}{walk}{ph}{stages}")


def euclid(k, m, rot=0):
    """k hits spread as evenly as possible over m steps (a Euclidean rhythm)."""
    i = np.arange(m)
    hits = ((i + 1) * k // m - i * k // m).astype(np.int64)
    return np.roll(hits, rot)


def onset_slices(y, count, rng, max_len):
    """short slices that begin where the clip's loudness jumps (its attacks)."""
    e = envelope_100(y)
    d = np.diff(e, prepend=e[:1])
    cand = np.argsort(d)[::-1][:max(count * 6, 12)]
    cand = cand[(cand * (SR // 100)) < len(y) - max_len]
    if not len(cand):
        cand = np.array([0])
    picks = rng.choice(cand, size=min(count, len(cand)), replace=False)
    return [int(p) * (SR // 100) for p in picks]


def src_hits(rng, n, hint=None):
    """a rhythm made of radio: a few slices of the palette's clips, struck on a grid locked to
    the song's pulse, in a pattern from data (Euclidean, Thue-Morse, Fibonacci, an automaton...)."""
    hint = hint or {}
    if not RADIO_CLIPS:
        return cd.src_impulses(rng, n)
    step = int(float(hint.get('step_s', log_uniform(rng, 0.1, 0.4))) * SR)
    per_bar = int(hint.get('per_bar', 8))
    clips = hint.get('clips') or [int(rng.integers(len(RADIO_CLIPS)))]
    nsounds = int(rng.integers(2, 5))
    sounds, names = [], []
    for j in range(nsounds):
        ci = clips[int(rng.integers(len(clips)))]
        y, c = clip_at_sr(ci)
        note_clip(c)
        L = int(log_uniform(rng, 0.02, max(0.03, min(0.35, 1.6 * step / SR))) * SR)
        p0 = onset_slices(y, 1, rng, L)[0]
        s = y[p0:p0 + L].copy()
        a = min(len(s) // 4, int(0.0015 * SR))
        if a > 1:
            s[:a] *= ramp(a)
        s *= np.exp(-np.arange(len(s)) / (len(s) / float(rng.uniform(2.0, 5.0))))
        pk = float(np.max(np.abs(s)))
        sounds.append(s / pk if pk > 0 else s)
        names.append(clip_label(c))
    steps = n // step + 1
    kind = str(rng.choice(['euclid', 'euclid', 'Thue-Morse', 'Fibonacci word', 'Rudin-Shapiro', 'automaton']))
    if kind == 'euclid':
        k = int(rng.integers(max(2, per_bar // 4), max(3, per_bar - 1)))
        rot = int(rng.integers(per_bar))
        if 'k_path' in hint:                          # filling in: more strokes to the bar as it goes
            k0, k1 = hint['k_path']
            nbars = steps // per_bar + 1
            ks = np.clip(np.round(np.linspace(k0, k1, nbars)), 1, per_bar).astype(int)
            hits = np.concatenate([euclid(int(kk), per_bar, rot) for kk in ks])[:steps]
            what = f"Euclidean, filling in from {k0} to {k1} in {per_bar}"
            note_tech(f"E({k0}..{k1},{per_bar})")
        else:
            hits = np.tile(euclid(k, per_bar, rot), steps // per_bar + 1)[:steps]
            what = f"Euclidean {k}-in-{per_bar}"
            note_tech(f"E({k},{per_bar})")
    elif kind == 'automaton':
        rule = int(rng.choice(cd.RULES_1D))
        row = (rng.random(per_bar) < 0.4).astype(np.uint8)
        rows_per = int(rng.choice([1, 2, 4]))                     # each row heard 1, 2 or 4 bars
        grid = cd.run_eca(rule, row, steps // per_bar // rows_per + 2)
        hits = np.repeat(grid, rows_per, axis=0).ravel()[:steps]
        what = f"rule {rule} automaton, one row per {rows_per} bar(s)"
        note_tech(f"Rule {rule}")
    else:
        fn = {'Thue-Morse': cd.seq_thue_morse, 'Fibonacci word': cd.seq_fibonacci_word,
              'Rudin-Shapiro': cd.seq_rudin_shapiro}[kind]
        hits = fn(steps)
        what = f"{kind} sequence, one term per step"
        note_tech(kind)
    which = cd.seq_thue_morse(steps + 7)[7:] if rng.random() < 0.5 else (np.arange(steps) // per_bar)
    which = (np.asarray(which) + np.arange(steps) % 2) % nsounds
    accent = np.where(np.arange(steps) % per_bar == 0, 1.0, rng.uniform(0.45, 0.85, steps))
    out = np.zeros(n + int(0.4 * SR))
    for i in np.nonzero(hits[:steps])[0]:
        s = sounds[int(which[i])]
        a = i * step
        if a >= n:
            break
        out[a:a + len(s)] += s * accent[i]
    return out[:n], (f"hits: {nsounds} radio slices on a {step / SR * 1000:.0f} ms grid "
                     f"({per_bar} to a bar), {what}; from [{'; '.join(dict.fromkeys(names))}]")


def groove_score(x):
    """how much a rendered idea is worth riding: repetition, movement, and not being static."""
    e = envelope_100(x)
    if e.mean() < 1e-4:
        return -9.0
    cv = float(e.std() / (e.mean() + 1e-9))
    flat = features(x * 32768.0, SR, 'am')[0]
    return 1.5 * rhythm_of(x) + min(cv, 1.2) + (1.0 - flat)


def loop_idea(rng, pal, bar_s=None, ratio=1.0):
    """one candidate loop from the palette: a clip, a length (from the clip's own repetitions,
    or from the song's bar), a start where something happens. returns (idea, score)."""
    ci = pick_clip(rng, pal)
    y, c = clip_at_sr(ci)
    clip_s = len(y) / SR
    if bar_s is None:
        ps = [p for p in periods(y, 0.18, min(6.0, clip_s / 2)) if p[1] > 0.2]
        if ps and rng.random() < 0.85:
            w = np.array([s for _, s in ps])
            lag = ps[int(rng.choice(len(ps), p=w / w.sum()))][0]
            mult = [m for m in (1, 2, 4, 8) if 0.7 <= lag * m <= 6.0] or [1]
            L = lag * mult[int(rng.integers(len(mult)))]
            how = f"its own {lag * 1000:.0f} ms repetition"
        else:
            L = log_uniform(rng, 0.7, 4.0)
            how = "a chance length"
    else:
        L = bar_s * ratio
        how = f"{ratio:g} bar(s)"
    L = float(min(L, clip_s * 0.9))
    e = envelope_100(y)
    hot = np.nonzero(e >= np.quantile(e, 0.6))[0]
    start = float(hot[int(rng.integers(len(hot)))]) / 100.0 if len(hot) else float(rng.uniform(0, clip_s))
    start = min(start, max(0.0, clip_s - L))
    trial = render_loop(y, int(min(2.0 * L, 12.0) * SR) + 1, int(L * SR), start * SR)
    idea = {'clip': ci, 'len_s': L, 'start_s': start, 'how': how, 'clip_s': clip_s}
    return idea, groove_score(trial)


def best_idea(rng, pal, tries, bar_s=None, ratio=1.0):
    ideas = [loop_idea(rng, pal, bar_s, ratio) for _ in range(tries)]
    ideas.sort(key=lambda t: -t[1])
    return ideas[0][0], ideas[0][1], [s for _, s in ideas]


ARCS = {
    # name: (what it does, loudness across the song [(fraction, dB)], how it likes to end)
    'accumulation': ("lanes enter one by one across the whole song, the hits filling in",
                     [(0.0, -10.0), (1.0, 0.0)], "hard stop"),
    'erosion':      ("starts clear; data processes slowly eat into every lane",
                     [(0.0, 0.0), (0.7, -1.0), (1.0, -6.0)], "fade out"),
    'revelation':   ("starts as fused, processed sound; clears until the raw radio is plain",
                     [(0.0, -6.0), (0.8, 0.0), (1.0, 0.0)], "hard stop"),
    'acceleration': ("the main loop halves in length stage by stage, tightening",
                     [(0.0, -8.0), (1.0, 0.0)], "hard stop"),
    'convergence':  ("phasing twins start far apart and close into unison at the end",
                     [(0.0, -4.0), (0.9, 0.0), (1.0, 0.0)], "quick fade"),
    'opening':      ("a filter opens from a low murmur to the full spectrum; lanes join as it opens",
                     [(0.0, -12.0), (0.6, -2.0), (1.0, 0.0)], "fade out"),
    'arch':         ("builds lane by lane to a peak, then thins out again",
                     [(0.0, -10.0), (0.55, 0.0), (1.0, -10.0)], "fade out"),
}
TRANSITIONS = [('cut', 0.3), ('drop', 0.2), ('handoff', 0.2), ('swell', 0.1), ('crossfade', 0.2)]
MORPH_OPS = ['op_granulate', 'op_sort_blocks', 'op_bitplane', 'op_overflow', 'op_stutter',
             'op_bitcrush', 'op_shuffle_blocks', 'op_gray']


def loops_score(rng, total, cap, log, allowed):
    radio = cd.SOURCE_INDEX.get('radio')
    lp, hits = cd.SOURCE_INDEX.get('loop'), cd.SOURCE_INDEX.get('hits')
    if not RADIO_CLIPS or lp not in allowed:
        log.append("loops: no radio clips (or the loop source is not allowed); falling back to fusion")
        return fusion_score(rng, total, cap, log, allowed)
    secs = total / SR
    W = 100
    col = lambda t: int(min(W - 1, max(0, t / secs * W)))
    pal = palette(rng, allowed, log)
    tech = [cd.SOURCE_INDEX[k] for k in FUSION_KEYS if cd.SOURCE_INDEX.get(k) in allowed]
    names = list(ARCS)
    arc = names[int(rng.integers(len(names)))]
    arc_what, arc_loud, arc_end = ARCS[arc]
    note_tech(arc.capitalize())

    # the pulse: the opening idea, chosen by listening to a few candidates
    if secs >= 100:
        S = int(rng.choice([1, 2, 3], p=[0.5, 0.35, 0.15]))
    else:
        S = int(rng.choice([1, 2], p=[0.7, 0.3]))
    first, s0, heard = best_idea(rng, pal, 5)
    bar = first['len_s']
    beats = max(1, int(round(bar / 0.6)))
    bpm = 60.0 * beats / bar
    note_tech(f"{bpm:.0f} BPM")
    bars_total = max(S * 4, int(secs / bar))
    log.append(f"loops: arc '{arc}' -- {arc_what}")
    log.append(f"  the pulse is one bar of {bar:.3f} s ({beats} beat(s), about {bpm:.0f} BPM), found in "
               f"{first['how']}; {S} section(s), {bars_total} bars")
    log.append(f"  listened to {len(heard)} candidate loops for the opening idea; scores "
               + ", ".join(f"{h:.2f}" for h in heard))

    mains = [(first, s0)]
    for j in range(1, S):
        idea, sc, _ = best_idea(rng, pal, 4, bar, float(rng.choice([1.0, 1.0, 2.0, 0.5])))
        mains.append((idea, sc))
    w = np.array([float(rng.uniform(0.6, 1.4)) * (0.6 + max(0.0, sc)) for _, sc in mains])
    sec_bars = np.maximum(4, np.round(w / w.sum() * bars_total)).astype(int)
    while sec_bars.sum() > bars_total and sec_bars.max() > 4:
        sec_bars[np.argmax(sec_bars)] -= 1
    if sec_bars.sum() < bars_total:
        sec_bars[-1] += bars_total - sec_bars.sum()
    bounds = np.concatenate([[0], np.cumsum(sec_bars)])
    tw = np.array([p for _, p in TRANSITIONS])
    trans = [TRANSITIONS[int(rng.choice(len(TRANSITIONS), p=tw / tw.sum()))][0] for _ in range(S - 1)]
    lane_db = float(rng.uniform(-16.0, -11.0))
    per_bar = int(rng.choice([4, 6, 8, 8, 12, 16]))
    morph_ops = [cd.OPS.index(getattr(cd, nm)) for nm in MORPH_OPS]
    morph_pick = sorted(set(int(i) for i in rng.choice(morph_ops, size=int(rng.integers(2, 4)), replace=False))
                        | set(pal['ops'][:1]))
    XF = 1 if bar > 2.5 else 2                              # crossfades, in bars

    lanes = {}           # key -> lane: start/end bar, fades (s), source, hints, curves (song fractions)
    order = []
    state = {'fin': 0.004, 'handoff': False}           # how the coming section's lanes come in

    def add(key, src, sh, mark, a, b):
        lanes[key] = dict(src=src, sh=sh, mark=mark, a=a, b=b,
                          fin=state['fin'] if a == sec_a[0] else 0.004, fout=0.008)
        order.append(key)
    sec_a = [0]

    for j, ((idea, sc), nb) in enumerate(zip(mains, sec_bars)):
        a, b = int(bounds[j]), int(bounds[j + 1])
        sec_a[0] = a
        span = b - a
        creep = float(rng.uniform(0.05, 0.35)) * max(0.0, idea['clip_s'] - idea['len_s']) \
            if rng.random() < 0.5 and arc != 'convergence' else 0.0
        main = {'clip': idea['clip'], 'len_s': idea['len_s'], 'start_s': idea['start_s'], 'creep_s': creep}
        extras = ['phase', 'loop2', 'fused', 'hits']
        rng.shuffle(extras)
        n_extra = int(rng.integers(1, 4))
        if arc in ('accumulation', 'arch', 'opening'):
            n_extra = int(rng.integers(2, 4))
        if arc == 'accumulation' and 'hits' not in extras[:n_extra] and hits is not None:
            extras.remove('hits')
            extras.insert(0, 'hits')
        if arc == 'revelation' and tech and 'fused' not in extras[:n_extra]:
            extras.remove('fused')
            extras.insert(0, 'fused')
        if arc == 'convergence' and 'phase' not in extras[:n_extra]:
            extras.remove('phase')
            extras.insert(0, 'phase')
        if state['handoff']:                              # the previous lanes carry on: add little
            n_extra = int(rng.integers(0, 2))
        chosen = extras[:n_extra]
        if arc == 'acceleration':
            st_n = int(rng.integers(3, 5))
            L0 = idea['len_s'] * (2.0 if idea['len_s'] < 1.5 and rng.random() < 0.6 else 1.0)
            at = [int(round(span * k / st_n)) * bar for k in range(st_n)]
            main['stages'] = [(at[k], L0 / 2 ** k) for k in range(st_n)]
        if arc == 'opening':                              # one filter opening across the whole song
            if j == 0:
                state['f0'] = log_uniform(rng, 150.0, 450.0)
            g0, g1 = a / bars_total, b / bars_total
            main['sweep'] = [(float(q), float(np.exp(np.interp(g0 + (g1 - g0) * q, [0.0, 0.85, 1.0],
                             [np.log(state['f0']), np.log(16000.0), np.log(16000.0)]))))
                             for q in np.linspace(0.0, 1.0, 9)]

        # when the extras come in: spread over the whole section for builds, early otherwise
        if arc in ('accumulation', 'opening'):
            hi = 0.7 if arc == 'accumulation' else 0.6
            lo = 0.3 if arc == 'opening' else 0.1
            enters = [int(round(span * (lo + (hi - lo) * k / max(1, len(chosen) - 1)))) if len(chosen) > 1
                      else int(round(span * lo)) for k in range(len(chosen))]
        elif arc == 'arch':
            enters = [int(round(span * 0.45 * (k + 1) / len(chosen))) for k in range(len(chosen))]
        else:
            enters = [int(rng.integers(0, max(1, span // 4))) for _ in chosen]
        add(f"main {j + 1}", lp, main, 'L', a, b)
        for kind, e in zip(chosen, enters):
            if kind == 'phase':
                L = idea['len_s'] * SR
                if arc == 'convergence':
                    D = float(rng.uniform(0.15, 0.45)) * idea['len_s']
                    sh = dict(main, start_s=main['start_s'] + D, creep_s=-D)      # closes the gap exactly
                else:
                    sh = dict(main, creep_s=0.0, extra=float(rng.choice([-1, 1]) * rng.uniform(0.0015, 0.008) * L))
                sh.pop('stages', None)
                add(f"phase {j + 1}", lp, sh, 'p', a + e, b)
            elif kind == 'loop2':
                i2, _, _ = best_idea(rng, pal, 3, bar, float(rng.choice([0.5, 1.0, 2.0, 0.25])))
                add(f"loop {j + 1}", lp, {'clip': i2['clip'], 'len_s': i2['len_s'], 'start_s': i2['start_s']},
                    'l', a + e, b)
            elif kind == 'fused' and tech:
                y, c = clip_at_sr(idea['clip'])
                cyc = render_loop(y, int(idea['len_s'] * SR), int(idea['len_s'] * SR), idea['start_s'] * SR)
                t = tech[int(rng.integers(len(tech)))]
                sh = {'material': cyc, 'material_clip': c,
                      'row_s': bar / float(rng.choice([per_bar, per_bar / 2, 1, 2]))}
                add(f"fused {j + 1}", t, sh, cd.SOURCES[t][0][0].upper(), a + (0 if arc == 'revelation' else e), b)
            elif kind == 'hits' and hits is not None:
                sh = {'step_s': bar / per_bar, 'per_bar': per_bar, 'clips': pal['clips']}
                if arc in ('accumulation', 'arch'):
                    k0 = max(1, per_bar // 5)
                    sh['k_path'] = (k0, max(k0 + 1, per_bar - 1 - per_bar // 6))
                add(f"hits {j + 1}", hits, sh, 'h', a + e, b)

        # how this section hands over to the next
        state['fin'], state['handoff'] = 0.004, False
        if j < S - 1:
            tr = trans[j]
            mine = [k for k in order if lanes[k]['b'] == b and lanes[k]['a'] >= a]
            if tr == 'crossfade':
                for k in mine:
                    lanes[k]['b'] = b + XF
                    lanes[k]['fout'] = XF * bar
                state['fin'] = XF * bar
            elif tr == 'drop':
                gap = 1 if bar > 1.5 else 2
                for k in mine:
                    if not (k.startswith('main') and rng.random() < 0.5):
                        lanes[k]['b'] = b - gap
            elif tr == 'handoff':
                for k in mine:
                    if not k.startswith('main'):
                        lanes[k]['b'] = int(bounds[j + 2])                  # carries through the next section
                lanes[f"main {j + 1}"]['b'] = b + 1
                lanes[f"main {j + 1}"]['fout'] = bar
                state['handoff'] = True
            elif tr == 'swell':
                for k in mine:
                    lanes[k]['swell'] = (max(a, b - 2), b)
                    lanes[k]['fout'] = 0.05
            log.append(f"  section {j + 1}: bars {a + 1}-{b} ({span * bar:.0f} s), idea scored {sc:.2f}, "
                       f"lanes: " + ", ".join(k for k in order if lanes[k]['a'] >= a and k[-1] == str(j + 1))
                       + f"; then a {tr}")
        else:
            log.append(f"  section {j + 1}: bars {a + 1}-{b} ({span * bar:.0f} s), idea scored {sc:.2f}, "
                       f"lanes: " + ", ".join(k for k in order if lanes[k]['a'] >= a and k[-1] == str(j + 1)))

    # arc shapes on the lanes: exits for the arch, morphs for erosion and revelation
    last = int(bounds[-1])
    if arc == 'arch':
        tail = [k for k in order if not k.startswith('main')]
        for i_, k in enumerate(tail):
            lanes[k]['b'] = min(lanes[k]['b'], int(round(last * (0.6 + 0.35 * (i_ + 1) / (len(tail) + 1)))))
            lanes[k]['fout'] = bar
    for k in order:
        ln = lanes[k]
        if arc == 'erosion':
            ln['morph'] = {'seed': int(rng.integers(1 << 62)), 'ops': morph_pick,
                           'curve': [(0.0, 0.0), (0.2, 0.0), (1.0, float(rng.uniform(0.7, 1.0)))], 'song': True}
        elif arc == 'revelation':
            if k.startswith('main') or k.startswith('loop'):
                ln['morph'] = {'seed': int(rng.integers(1 << 62)), 'ops': morph_pick,
                               'curve': [(0.0, 1.0), (0.75, 0.0), (1.0, 0.0)], 'song': True}
            elif k.startswith('fused'):
                ln['own'] = [(0.0, 0.0), (0.6, 0.0), (0.95, -24.0), (1.0, -40.0)]

    slots = []
    marks = {'cut': '|', 'drop': '_', 'handoff': '=', 'swell': '>', 'crossfade': ':'}
    pic = [f"--- the loops over {fmt(secs)}: arc '{arc}' (L main loop, p phasing twin, l another loop, "
           f"h hits, M S C P fused; section changes: | cut  _ drop  = handoff  > swell  : crossfade) ---"]
    nl = max(1, len(order))
    for k in order:
        ln = lanes[k]
        st = int(ln['a'] * bar * SR)
        en = int(min(total, ln['b'] * bar * SR + ln['fout'] * SR))
        n = en - st
        if n < SR // 2:
            continue
        g0, g1 = st / total, en / total                        # this lane's span as fractions of the song
        pts = []
        for q in np.linspace(0.0, 1.0, 24):
            gq = g0 + (g1 - g0) * q
            db = float(np.interp(gq, [p for p, _ in arc_loud], [v for _, v in arc_loud]))
            if ln.get('own'):
                gs = [p for p, _ in ln['own']]
                db += float(np.interp(gq, gs, [v for _, v in ln['own']]))
            if ln.get('swell'):
                s0_, s1_ = ln['swell'][0] * bar * SR / total, ln['swell'][1] * bar * SR / total
                if gq > s0_:
                    db += 6.0 * min(1.0, (gq - s0_) / max(1e-9, s1_ - s0_))
            pts.append((float(q), db))
        base = lane_db if k.startswith('main') else lane_db - float(rng.uniform(2.0, 7.0))
        hint = {'src': ln['src'], 'depth': 0.0, 'slip': 0, 'fade': 0.01,
                'fade_in': ln['fin'] if ln['a'] > 0 else 0.004, 'fade_out': ln['fout'],
                'amp_db': base - 5.0 * math.log10(nl),
                'pan': 0.5 + float(rng.normal(0, 0.05)) if k.startswith('main') else float(rng.uniform(0.2, 0.8)),
                'source_hint': ln['sh'], 'p_return': 1.0, 'ops': pal['ops'], 'curve': pts}
        if ln.get('morph'):
            m = dict(ln['morph'])
            if m.pop('song', False):                           # morph curves are drawn in song time
                cpts = m['curve']
                m['curve'] = [(float(q), float(np.interp(g0 + (g1 - g0) * q, [p for p, _ in cpts],
                                                         [v for _, v in cpts]))) for q in np.linspace(0, 1, 12)]
            hint['morph'] = m
        if pal['data']:
            hint['pool'] = pal['data']
        slots.append((st, n, k, hint))
        row = [' '] * W
        for cc in range(col(st / SR), col(en / SR) + 1):
            row[cc] = ln['mark']
        pic.append(f"  {k:9s}|" + "".join(row) + "|")
    srow = [' '] * W
    for j, tr in enumerate(trans):
        srow[col(bounds[j + 1] * bar)] = marks[tr]
    pic.append("  sections |" + "".join(srow) + "|")
    nbend = int(rng.poisson(0.4 * secs / 180.0)) if arc not in ('erosion', 'revelation') else 0
    for j in range(nbend):
        b0 = int(rng.integers(0, max(1, bars_total - 2)))
        st, n = int(b0 * bar * SR), int(int(rng.integers(1, 3)) * bar * SR)
        n = min(n, total - st)
        if n > SR // 2:
            slots.append((st, n, f"bend {j + 1}", {'bend': True, 'depth': float(rng.uniform(0.3, 0.9)),
                                                    'fade': float(min(0.5, bar / 4)), 'ops': pal['ops']}))
    if nbend:
        log.append(f"  {nbend} bend(s), a bar or two each")
    cd.END_AT = int(bars_total * bar * SR)
    cd.END_PREF = arc_end
    return slots, pic, "loops"


GW, GH = 100, 20
PARAMS = ["dial", "speed", "loudness", "pan", "depth", "length"]


def fontana_score(rng, total, cap, log, allowed):
    secs = total / SR
    radio_ok = bool(RADIO_CLIPS) and cd.SOURCE_INDEX.get('radio') in allowed
    others = [i for i in allowed if cd.SOURCES[i][0] != 'radio']
    p_radio = float(rng.uniform(0.55, 0.95)) if radio_ok and others else (1.0 if radio_ok else 0.0)

    # six curves across the sheet: smooth random heights over the grid's width
    xs = np.arange(GW)
    curves = []
    for _ in range(6):
        k = int(rng.integers(3, 9))
        curves.append(np.clip(cd.smooth_path(rng.uniform(-2, GH + 2, k), GW * 8)[::8], 0, GH - 0.01))
    per_min = log_uniform(rng, 3.0, 12.0)
    K = int(np.clip(round(per_min * secs / 60.0), 3, 80))
    px = np.sort(rng.uniform(0, GW, K))
    py = rng.uniform(0, GH, K)

    log.append(f"score: a Fontana-style sheet -- {GW} x {GH} grid, six curves, {K} points "
               f"({per_min:.1f}/min); a point's distance from each curve sets one parameter")
    log.append("  curves: " + ", ".join(f"{j + 1}={p}" for j, p in enumerate(PARAMS)))
    pal = palette(rng, allowed, log)
    dial = sorted(pal['clips'], key=lambda i: RADIO_CLIPS[i]['freq_khz']) if pal['clips'] else []
    if radio_ok:
        log.append(f"  {100 * p_radio:.0f}% of points are radio, the dial running across the palette's "
                   f"{len(dial)} clips; the rest are the data family")
    else:
        log.append("  no radio clips in the cache: every point is data")

    slots = []
    for j in range(K):
        col = int(min(GW - 1, px[j]))
        d = [float(abs(curves[i][col] - py[j]) / GH) for i in range(6)]   # 0 (on the curve) .. 1
        start = int(px[j] / GW * total)
        length = float(np.clip(4.0 * 35.0 ** d[5], MIN_S, cd.MAX_LAYER_S))     # 4 s on the curve .. 2+ min far off
        n = int(min(length * SR, total - start))
        if n < SR // 2:
            continue
        hint = {'amp_db': -34.0 + 26.0 * (1.0 - d[2]), 'pan': d[3], 'depth': d[4], 'ops': pal['ops']}
        if pal['data']:
            hint['pool'] = pal['data']
        if radio_ok and rng.random() < p_radio and dial:
            hint['src'] = cd.SOURCE_INDEX['radio']
            speed = 1.0 if d[1] < 0.12 else 2.0 ** (-2.0 + 3.0 * d[1])
            hint['source_hint'] = {'clip': dial[int(round(d[0] * (len(dial) - 1)))], 'speed': speed}
        slots.append((start, n, f"point {j + 1}", hint))

    canvas = [[' '] * GW for _ in range(GH)]
    for i, cv in enumerate(curves):
        for x_ in xs:
            canvas[GH - 1 - int(cv[x_])][x_] = str(i + 1)
    for x_, y_ in zip(px, py):
        canvas[GH - 1 - int(y_)][int(min(GW - 1, x_))] = '*'
    picture = ["--- the sheet (time runs left to right over "
               f"{fmt(secs)}; digits are curves 1-6, * are points) ---"]
    picture.append("  +" + "-" * GW + "+")
    picture += ["  |" + "".join(r) + "|" for r in canvas]
    picture.append("  +" + "-" * GW + "+")
    return slots, picture, "fontana"


MIN_S = 1.0


def fmt(s):
    return f"{int(s // 60)}:{int(s % 60):02d}"


# ------------------------------------------------------------------- main

def main():
    cd.SOURCES.append(("radio", src_radio, 4.0, "radio"))
    cd.SOURCE_INDEX['radio'] = len(cd.SOURCES) - 1
    cd.FORMS['fontana'] = fontana_score
    cd.CHANCE_FORMS.append(('fontana', 1.0))
    cd.FORMS['baseline'] = baseline_score
    cd.CHANCE_FORMS.append(('baseline', 1.0))
    for key, fn, w, label in [("mosaic", src_mosaic, 1.5, "data rebuilt from radio grains"),
                              ("spectral", src_spectral, 1.5, "radio through an automaton"),
                              ("cross", src_cross, 1.5, "radio x data cross-synthesis"),
                              ("playhead", src_playhead, 1.5, "data playing the radio")]:
        cd.SOURCES.append((key, fn, w, label))
        cd.SOURCE_INDEX[key] = len(cd.SOURCES) - 1
    cd.FORMS['fusion'] = fusion_score
    cd.CHANCE_FORMS.append(('fusion', 1.0))
    for key, fn, w, label in [("loop", src_loop, 1.0, "a loop of radio"),
                              ("hits", src_hits, 0.8, "radio slices in a data rhythm")]:
        cd.SOURCES.append((key, fn, w, label))
        cd.SOURCE_INDEX[key] = len(cd.SOURCES) - 1
    cd.FORMS['loops'] = loops_score
    cd.CHANCE_FORMS.append(('loops', 1.5))
    # by default each song's form is a chance draw, fusion most often; loops only now and then
    cd.CHANCE_FORMS[:] = [('fusion', 3.0), ('loops', 1.0), ('baseline', 0.8), ('fontana', 0.6),
                          ('automaton', 0.2), ('drift', 0.2)]
    cd.TITLER = make_title
    cd.ENDINGS = True

    ap = cd.make_parser(__doc__, default_form='chance')
    ap.add_argument('--gather', type=int, default=0, metavar='N',
                    help='first record N new clips from all sources (shortwave and station streams)')
    ap.add_argument('--from', dest='gather_from', default='all',
                    help='where --gather looks: all (default), or any of shortwave, stations, archive, mics '
                         '(comma-separated)')
    ap.add_argument('--gather-only', action='store_true', help='record clips, then stop')
    ap.add_argument('--dial', choices=['stations', 'wild'], default='stations',
                    help="stations: tune to what is on air and skip static (default); wild: anywhere")
    ap.add_argument('--radio-dir', default=os.path.join(HERE, 'radio_cache'), help='where clips are kept')
    ap.add_argument('--refresh-receivers', action='store_true', help='fetch a fresh receiver list now')
    ap.add_argument('--list-clips', action='store_true', help='list the cached clips and stop')
    ap.add_argument('--no-titles', action='store_true',
                    help='number the tracks plainly instead of titling them from their material')
    ap.add_argument('--keep-static', action='store_true',
                    help='also mix clips that are only static (they are skipped by default, never deleted)')
    ap.add_argument('--half-life', type=float, default=2.0, metavar='DAYS',
                    help='prefer recently gathered clips: one this many days old counts half as much as '
                         "today's (default 2; 0 = no preference)")
    ap.add_argument('--workers', type=int, default=4,
                    help='receivers listened to at once while gathering (default 4; one connection each)')
    ap.add_argument('--fm-only', action='store_true', help='station streams: only stations that say they are FM')
    ap.add_argument('--fm-country', default=None, metavar='CC',
                    help='station streams: only these countries, e.g. NO,JP,BR (default: anywhere)')
    args = ap.parse_args()

    os.makedirs(args.radio_dir, exist_ok=True)
    if args.no_titles:
        cd.TITLER = None
    if args.list_sources:
        for key, fn, w, label in cd.SOURCES:
            print(f"  {key:13s} weight {w:3.1f}  {label}")
        return
    if args.gather > 0:
        n = args.gather
        kinds = ['shortwave', 'stations', 'archive', 'mics']
        want = kinds if args.gather_from == 'all' else [k.strip() for k in args.gather_from.split(',')]
        bad = [k for k in want if k not in kinds]
        if bad:
            ap.error(f"--from: unknown source(s) {', '.join(bad)}; choose from all, {', '.join(kinds)}")
        weight = {'shortwave': 0.35, 'stations': 0.3, 'archive': 0.2, 'mics': 0.15}
        w = np.array([weight[k] for k in want])
        split = np.random.default_rng(int.from_bytes(os.urandom(8), 'big')).multinomial(n, w / w.sum())
        plan = {k: int(c) for k, c in zip(want, split) if c}
        print(f"gathering {n} clip(s): " + ", ".join(f"{c} {k}" for k, c in plan.items()))
        wk = max(1, args.workers)
        got = 0
        for k, c in plan.items():
            if k == 'shortwave':
                got += gather(c, args.radio_dir, args.refresh_receivers, args.dial, wk)
            elif k == 'stations':
                got += gather_streams(c, args.radio_dir, args.fm_only, args.fm_country, wk, args.refresh_receivers)
            elif k == 'archive':
                got += gather_archive(c, args.radio_dir, wk)
            else:
                got += gather_mics(c, args.radio_dir, wk)
        if got < n and 'stations' in want:                 # whatever fell short, the stations make up
            print(f"{n - got} short; topping up from station streams")
            gather_streams(n - got, args.radio_dir, args.fm_only, args.fm_country, wk, args.refresh_receivers)
    every = load_clips(args.radio_dir)
    RADIO_CLIPS[:] = every if args.keep_static else [c for c in every if c['lively']]
    set_freshness(RADIO_CLIPS, args.half_life)
    if args.list_clips:
        for c in every:
            rcv = c.get('receiver', '')[:40].encode('ascii', 'replace').decode()
            what = (c.get('station') or c.get('band', ''))[:34].encode('ascii', 'replace').decode()
            print(f"  {' ' if c['lively'] else 's'} {dial_text(c):>20s}  "
                  f"{c.get('seconds', '?'):>6} s  {what:34s} {rcv}  {c.get('utc', '')[:16]}")
        static = sum(1 for c in every if not c['lively'])
        print(f"{len(every)} clip(s) in {args.radio_dir}"
              + (f"; {static} marked s are only static and are skipped (use --keep-static)" if static else ""))
        return
    if args.gather_only:
        return

    allowed = cd.allowed_sources(ap, args)
    if not RADIO_CLIPS:
        allowed = [i for i in allowed if cd.SOURCES[i][0] not in ('radio', 'loop', 'hits', *FUSION_KEYS)]
        print("no radio clips cached yet (try --gather 12); mixing data only")
        if not allowed:
            ap.error("only 'radio' was allowed and there are no clips")
    notes = [f"radio clips on the dial: {len(RADIO_CLIPS)} (from {args.radio_dir})",
             f"recent finds preferred: half-life {args.half_life:g} days" if args.half_life > 0
             else "all clips equally likely, however old"]
    cd.run_album(args, allowed, suffix="fontana", title="fontana album", notes=notes,
                 creed="every sample below began as data, or as radio somewhere on Earth, tuned by chance")


if __name__ == '__main__':
    main()
