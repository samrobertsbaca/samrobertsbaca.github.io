#!/usr/bin/env python3
"""
day_radio.py -- carry a day's listening between the daily job's runs, as GitHub Actions artifacts.

Each album's radio is gathered over the course of a day, an hour at a time: each hour's run keeps
its clips as an artifact named radio-DAY-HH (DAY is the album's day, HH the mountain-time hour it
was gathered in) and what it visited as listened-DAY-HH. The evening's run gathers them all up.

    python day_radio.py exists DAY HH           # prints 1 if that hour's clips are kept, else 0
    python day_radio.py state DAY today.json    # who was visited so far today, how many clips the day has,
                                                # and whether it is a pure day (decided by chance at the
                                                # day's first hour); prints 1/0
    python day_radio.py radio DAY radio_cache   # every hour's clips, into the folder; prints how many
    python day_radio.py forget DAY              # delete the day's artifacts (once the album is made)

Needs gh, and GH_TOKEN with actions: read (forget: actions: write).
"""
import io
import json
import os
import secrets
import subprocess
import sys
import zipfile

REPO = os.environ.get('GITHUB_REPOSITORY', 'samrobertsbaca/samrobertsbaca.github.io')


def gh(*args):
    return subprocess.run(['gh', 'api', *args], capture_output=True, check=True).stdout


def artifacts(kind, day):
    """the day's artifacts of one kind (radio or listened), oldest first, one per name: every hour
    is asked after by name, as a listing of everything would be long and mostly expired."""
    found = []
    for hh in range(24):
        r = json.loads(gh(f'repos/{REPO}/actions/artifacts?name={kind}-{day}-{hh:02d}&per_page=10') or b'{}')
        live = [a for a in r.get('artifacts', []) if not a.get('expired')]
        if live:
            found.append(max(live, key=lambda a: a['created_at']))
    return sorted(found, key=lambda a: a['created_at'])


def unzip(a, folder, keep=('.wav', '.json')):
    """an artifact's files into folder, by their bare names (nothing else, nowhere else)."""
    n = 0                                                # how many clips (each a .wav with its .json)
    with zipfile.ZipFile(io.BytesIO(gh(f'repos/{REPO}/actions/artifacts/{a["id"]}/zip'))) as z:
        for info in z.infolist():
            name = os.path.basename(info.filename)
            if info.is_dir() or not name.endswith(keep) or name.startswith('.'):
                continue
            with open(os.path.join(folder, name), 'wb') as f:
                f.write(z.read(info))
            n += name.endswith('.wav')
    return n


def main():
    cmd, day = sys.argv[1], sys.argv[2]
    if cmd == 'exists':
        hh = int(sys.argv[3])
        r = json.loads(gh(f'repos/{REPO}/actions/artifacts?name=radio-{day}-{hh:02d}&per_page=10') or b'{}')
        print('1' if any(not a.get('expired') for a in r.get('artifacts', [])) else '0')
    elif cmd == 'state':
        out = sys.argv[3]
        merged = {'day': day, 'receivers': set(), 'mics': set(), 'stations': set()}
        pure = None
        tmp = out + '.d'
        os.makedirs(tmp, exist_ok=True)
        for a in artifacts('listened', day):
            try:
                if os.path.exists(os.path.join(tmp, 'today.json')):
                    os.remove(os.path.join(tmp, 'today.json'))
                unzip(a, tmp, keep=('.json',))
                st = json.load(open(os.path.join(tmp, 'today.json'), encoding='utf-8'))
            except (OSError, ValueError, subprocess.CalledProcessError, zipfile.BadZipFile) as e:
                print(f"  {a['name']}: unreadable ({e})", file=sys.stderr)
                continue
            for k in ('receivers', 'mics', 'stations'):
                merged[k].update(st.get(k) or [])
            merged['clips'] = max(merged.get('clips', 0), int(st.get('clips') or 0))   # each note counts the day so far
            if pure is None and 'pure' in st:          # the day's first word on it stands
                pure = bool(st['pure'])
        if pure is None:                                 # the day's first hour: about one day in seven is pure
            pure = secrets.randbelow(7) == 0
            print(f"  {day}: {'a pure day' if pure else 'not a pure day'}, decided now", file=sys.stderr)
        merged = {k: sorted(v) if isinstance(v, set) else v for k, v in merged.items()}
        merged['pure'] = pure
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(merged, f, indent=1)
        print('1' if pure else '0')
    elif cmd == 'radio':
        folder = sys.argv[3]
        os.makedirs(folder, exist_ok=True)
        total = 0
        for a in artifacts('radio', day):
            try:
                n = unzip(a, folder)
            except (subprocess.CalledProcessError, zipfile.BadZipFile) as e:
                print(f"  {a['name']}: unreadable ({e})", file=sys.stderr)
                continue
            total += n
            print(f"  {a['name']}: {n} clips", file=sys.stderr)
        print(total)
    elif cmd == 'forget':
        for kind in ('radio', 'listened'):
            for a in artifacts(kind, day):
                try:
                    gh('-X', 'DELETE', f'repos/{REPO}/actions/artifacts/{a["id"]}')
                    print(f"  let go of {a['name']}", file=sys.stderr)
                except subprocess.CalledProcessError:
                    print(f"  {a['name']} stays (it expires on its own)", file=sys.stderr)
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main()
