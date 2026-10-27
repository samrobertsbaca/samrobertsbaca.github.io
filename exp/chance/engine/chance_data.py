#!/usr/bin/env python3
"""
chance_data.py -- 48 kHz / 24-bit WAV albums made only from data patterns.

There are no oscillators, no wavetables and no synthesized tones here. Every
sample that reaches the file was a number in some data structure first:
the bytes of real files, integer formulas run over a clock (bytebeat),
cellular automata, the Game of Life, shift registers, chaotic maps, the binary
expansions of irrational numbers, self-similar integer sequences, string
rewriting systems, and the working memory of a sorting algorithm. Any pitch
you hear is a pattern repeating; any rhythm is a pattern unfolding slowly.

Nothing is composed. An album seed is drawn from the operating system's
entropy (or given with --seed) and every decision after that is a random draw.

Data sources
------------
  bytes         random bytes read as 1/4/8/16/24/32-bit ints or float bit patterns
  files         slices of real files on this computer (the script itself, the Python
                standard library, the interpreter binary, anything given with --feed)
  bytebeat      a random integer formula over t, e.g. (t*(t>>5|t>>8))&255, run on a clock
  automaton     an elementary cellular automaton (rule 0-255) read row by row
  life          a 2D life-like automaton (Life, HighLife, Seeds, Day & Night ...)
  lfsr          a Galois linear-feedback shift register; short ones loop into tones
  chaos         logistic / circle / Henon maps, their parameter drifting through
                period-doubling and mode-locking
  irrational    the binary expansion of sqrt(k) or of 1/p (which repeats)
  sequence      Thue-Morse, Rudin-Shapiro, paperfolding, Fibonacci word, Kolakoski,
                Stern's diatomic, Collatz stopping times, Recaman, prime gaps, digit sums
  substitution  a random L-system (a->ab, b->a ...) grown until it is long enough
  sort          snapshots of an array while it is being sorted: noise resolving into a ramp
  impulses      sparse single-sample clicks

Every source ends in a TRANSPORT: a read head that holds each value for some
number of samples (that is the "sample rate" of the data) and sometimes wanders
in speed. Manipulations are data operations too: bit masks and rotations, Gray
code, byte swaps, xor, overflow wraparound, sorting blocks, CD-skip stutter,
running sums and differences, grains cut from the material itself, gates driven
by Thue-Morse or Fibonacci patterns. Two sources can be combined bitwise
(xor / and / or), multiplied, or one can scrub through the other.

Form
----
  automaton  the score itself is a cellular automaton. Each column is a voice,
             each row a span of time; a run of live cells is a layer. The picture
             of the automaton is printed in the score.
  drift      onsets drawn from a smooth random density curve, with a cap on how
             many voices sound at once.

Voices and lineage
------------------
A voice is a gene: a data source plus the seed that fixes its parameters (which
file, which rule, which formula). When a voice returns it can play the very same
data again (a recognisable return) or a fresh draw of the same kind (a variation).
Across an album, voices born in earlier tracks can come back in later ones; the
album.txt lists where each one returned.

Opening tone
------------
With --tone the first track begins with the album's one deliberate exception to
"data only": a 1111 Hz tone on a 1111 Hz carrier. The carrier is amplitude-
modulated by a phase-locked 1111 Hz modulator, which sounds as a pure 1111 Hz
tone with a quieter 2222 Hz partial. It starts abruptly at full level and
fades slowly away across its whole length, the data rising underneath it.
It is off by default; shape it with --tone-hz, --carrier-hz, --tone-dur and
--tone-db.

Usage:
    python chance_data.py                     # one track, usually 2-5 min (rarely up to 13)
    python chance_data.py -n 6                # an album of six tracks
    python chance_data.py --form automaton    # force the automaton score
    python chance_data.py --sources bytebeat,automaton,sort
    python chance_data.py --feed C:/photos    # bend your own files too
    python chance_data.py --seed 1234 -n 4    # reproducible (on the same machine)
    python chance_data.py --list-sources

Requires: numpy
"""
import argparse
import datetime
import glob
import math
import os
import re
import sys
import wave
from dataclasses import dataclass

import numpy as np

SR = 48000
BITS = 24

DEFAULT_MIN_DUR = 60.0
DEFAULT_MAX_DUR = 13 * 60.0
MIN_LAYER_S = 0.5
MAX_LAYER_S = 180.0
MAX_VALUES = 1 << 21              # most data values any source computes; the transport loops them

FILE_POOL = []                    # filled in main(): files whose bytes can be read as sound
TITLER = None                     # optional: (rng, log, tag, voices, taken) -> a title for each track
ENDINGS = False                   # True: beginnings and endings vary by chance (cold starts, hard stops)
END_AT = None                     # a form may name the sample a hard stop should land on (a bar line)
END_PREF = None                   # a form may suggest its ending: "fade out", "quick fade", "hard stop"


# ---------------------------------------------------------------- helpers

def log_uniform(rng, lo, hi):
    return float(np.exp(rng.uniform(np.log(lo), np.log(hi))))


def ramp(n):
    """raised-cosine ramp 0 -> 1 over n samples."""
    if n <= 0:
        return np.ones(0)
    if n == 1:
        return np.ones(1)
    return 0.5 - 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, n))


def _pchip_slopes(p):
    k = len(p)
    m = np.zeros(k)
    if k < 3:
        return m
    d = np.diff(p)
    d0, d1 = d[:-1], d[1:]
    same = d0 * d1 > 0
    denom = np.where(same, d0 + d1, 1.0)
    m[1:-1] = np.where(same, 2.0 * d0 * d1 / denom, 0.0)
    return m


def pchip(pts, xq):
    """monotone cubic Hermite through pts at unit spacing, evaluated at xq (0..k-1)."""
    pts = np.asarray(pts, dtype=float)
    k = len(pts)
    xq = np.clip(np.asarray(xq, dtype=float), 0.0, k - 1.0)
    if k == 1:
        return np.full(xq.shape, pts[0])
    m = _pchip_slopes(pts)
    i = np.minimum(xq.astype(np.int64), k - 2)
    t = xq - i
    t2 = t * t
    t3 = t2 * t
    return ((2 * t3 - 3 * t2 + 1) * pts[i] + (t3 - 2 * t2 + t) * m[i]
            + (-2 * t3 + 3 * t2) * pts[i + 1] + (t3 - t2) * m[i + 1])


def smooth_path(pts, n):
    """a smooth path through pts, resampled to n samples."""
    k = len(pts)
    m = int(min(n, max(8, (n / SR) * 200)))
    if m >= n:
        return pchip(pts, np.linspace(0, k - 1, n))
    coarse = pchip(pts, np.linspace(0, k - 1, m))
    return np.interp(np.linspace(0, m - 1, n), np.arange(m), coarse)


def drift(rng, n, lo, hi, per_secs=4.0, kmax=40):
    """random smooth path over n samples in [lo, hi], about one breakpoint per `per_secs`."""
    k = int(np.clip(2 + rng.integers(0, 3 + int(n / SR / per_secs)), 2, kmax))
    return smooth_path(rng.uniform(lo, hi, k), n), k


def box_smooth(x, w, passes=2):
    """moving average (repeated -> bell-shaped kernel), edge-padded, O(n)."""
    w = int(max(1, w))
    if w <= 1 or len(x) == 0:
        return x
    for _ in range(passes):
        lpad = w // 2
        padded = np.concatenate([np.full(lpad, x[0]), x, np.full(w - lpad, x[-1])])
        c = np.concatenate([[0.0], np.cumsum(padded)])
        x = (c[w:] - c[:-w])[:len(x)] / w
    return x


def dc_block(x, w=SR // 25):
    """remove offset and sub-audio drift (much raw data is unsigned, so it sits off centre)."""
    if len(x) < 4:
        return x - np.mean(x)
    return x - box_smooth(x, min(w, max(2, len(x) // 2)), passes=2)


def fast_len(n):
    n = int(n)
    while True:
        m = n
        for p in (2, 3, 5):
            while m % p == 0:
                m //= p
        if m == 1:
            return n
        n += 1


def lowpass_fft(x, fc, order=1):
    n = len(x)
    nf = fast_len(n)
    spec = np.fft.rfft(x, nf)
    f = np.arange(len(spec)) * (SR / nf)
    spec *= (1.0 + (f / fc) ** (2 * order)) ** -0.5
    return np.fft.irfft(spec, nf)[:n]


def fit(x, n):
    """trim or zero-pad to exactly n samples."""
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])


def to_unit(v):
    """any numeric array -> [-1, 1] by its own range (a constant becomes silence)."""
    v = np.asarray(v, dtype=np.float64)
    if len(v) == 0:
        return v
    lo, hi = float(v.min()), float(v.max())
    if hi - lo < 1e-12:
        return np.zeros(len(v))
    return (v - lo) * (2.0 / (hi - lo)) - 1.0


def to_i16(x):
    return np.clip(np.round(x * 32767.0), -32768, 32767).astype(np.int16)


def from_i16(i):
    return i.astype(np.float64) / 32768.0


def popcount(a):
    a = np.asarray(a).astype(np.uint64)
    c = np.zeros(a.shape, dtype=np.int64)
    one = np.uint64(1)
    while a.any():
        c += (a & one).astype(np.int64)
        a = a >> one
    return c


def add_to_mix(mix, ch, start, y):
    m = min(len(y), mix.shape[1] - start)
    if m > 0:
        mix[ch, start:start + m] += y[:m]


def fmt_time(s):
    return f"{int(s // 60)}:{s % 60:04.1f}"


class Curve:
    """a random smooth control curve across the piece, position 0..1 -> [lo, hi]."""

    def __init__(self, rng, name, kmin, kmax, lo, hi):
        self.name = name
        self.k = max(2, int(round(log_uniform(rng, kmin, kmax))))
        self.pts = rng.uniform(0, 1, self.k)
        self.lo, self.hi = lo, hi

    def __call__(self, pos):
        p = float(np.clip(pos, 0.0, 1.0))
        return float(self.lo + pchip(self.pts, np.array([p * (self.k - 1)]))[0] * (self.hi - self.lo))

    def describe(self):
        return f"{self.name}: {self.k} breakpoints, range {self.lo:g}..{self.hi:g}"


# -------------------------------------------------------------- transport
# every data stream is played by a read head: one value per `h` samples, looping,
# sometimes with its speed wandering. a stream of L values held h samples that
# repeats is heard as a pitch of SR / (L * h).

def pick_hold(rng, lo, hi):
    return max(1, int(round(log_uniform(rng, lo, hi))))


def need_values(n, h):
    return int(min(MAX_VALUES, n // h + 2))


def transport(rng, vals, n, h, glide_p=0.35):
    vals = np.asarray(vals, dtype=np.float64)
    L = len(vals)
    if L == 0 or n <= 0:
        return np.zeros(max(n, 0)), "nothing to read"
    if n > SR and rng.random() < glide_p:
        span = float(rng.uniform(0.3, 2.5))
        octs, k = drift(rng, n, -span, span)
        idx = np.cumsum(2.0 ** octs / h).astype(np.int64) % L
        desc = f"read 1 value / {h} samples, speed wandering +-{span:.1f} oct ({k} pts)"
    else:
        idx = (np.arange(n, dtype=np.int64) // h) % L
        desc = f"each value held {h} sample{'s' if h > 1 else ''}"
    cyc = L * h
    if cyc < n:
        if cyc <= SR // 20:
            desc += f", {L}-value loop (~{SR / cyc:.1f} Hz)"
        else:
            desc += f", loops every {cyc / SR:.2f} s"
    return vals[idx], desc


def interpret_bytes(rng, raw):
    """read a byte array as samples: width, signedness, endianness or float bit patterns, by chance."""
    raw = np.frombuffer(bytes(raw), dtype=np.uint8) if not isinstance(raw, np.ndarray) else raw
    kind = rng.choice(['int', 'int', 'int', 'int', 'float', 'bits', 'nibbles'])
    if kind == 'bits':
        return np.unpackbits(raw).astype(np.float64) * 2.0 - 1.0, "1-bit stream"
    if kind == 'nibbles':
        v = np.stack([raw >> 4, raw & 15], axis=1).ravel().astype(np.float64)
        return (v - 7.5) / 7.5, "4-bit nibbles"
    endian = '<' if rng.random() < 0.5 else '>'
    ename = "little-endian" if endian == '<' else "big-endian"
    if kind == 'float':
        width = int(rng.choice([2, 4]))
        m = len(raw) // width * width
        if m == 0:
            return np.zeros(1), "empty"
        with np.errstate(invalid='ignore', over='ignore'):
            f = raw[:m].copy().view(np.dtype(f"{endian}f{width}")).astype(np.float64)
        f = np.nan_to_num(f, nan=0.0, posinf=0.0, neginf=0.0)
        v = np.sign(f) * np.log1p(np.abs(f))
        pk = float(np.max(np.abs(v)))
        return (v / pk if pk > 0 else v), f"float{width * 8} bit patterns ({ename}, log-scaled)"
    width = int(rng.choice([1, 2, 2, 3, 4]))
    signed = bool(rng.random() < 0.6)
    m = len(raw) // width * width
    if m == 0:
        return np.zeros(1), "empty"
    if width == 3:
        b = raw[:m].reshape(-1, 3).astype(np.int64)
        if endian == '>':
            b = b[:, ::-1]
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        if signed:
            v = np.where(v >= 1 << 23, v - (1 << 24), v)
        vals = v.astype(np.float64)
    else:
        dt = np.dtype(f"{endian}{'i' if signed else 'u'}{width}")
        vals = raw[:m].copy().view(dt).astype(np.float64)
    full = float(1 << (8 * width - 1))
    vals = vals / full if signed else vals / full - 1.0
    return vals, f"{'signed' if signed else 'unsigned'} {width * 8}-bit {ename}"


# --------------------------------------------------------- data sequences
# integer sequences with structure at every scale. each returns m ints.

def seq_thue_morse(m):
    return popcount(np.arange(m)) & 1


def seq_rudin_shapiro(m):
    i = np.arange(m, dtype=np.int64)
    return popcount(i & (i >> 1)) & 1


def seq_paperfolding(m):
    i = np.arange(1, m + 1, dtype=np.int64)
    return ((i // (i & -i)) >> 1) & 1


def seq_fibonacci_word(m):
    i = np.arange(1, m + 1, dtype=np.float64)
    phi = (1 + 5 ** 0.5) / 2
    return (2 + np.floor(i * phi) - np.floor((i + 1) * phi)).astype(np.int64)


def seq_kolakoski(m):
    m = min(m, 400000)
    s = [1, 2, 2]
    i = 2
    while len(s) < m:
        s.extend([3 - s[-1]] * s[i])
        i += 1
    return np.array(s[:m], dtype=np.int64)


def seq_stern(m):
    a = np.zeros(2 * m + 8, dtype=np.int64)
    a[1] = 1
    s = 1
    while 2 * s < m + 2:
        nn = np.arange(s, 2 * s)
        a[2 * nn] = a[nn]
        a[2 * nn + 1] = a[nn] + a[nn + 1]
        s *= 2
    return a[:m]


def seq_collatz(m):
    m = min(m, 300000)
    v = np.arange(1, m + 1, dtype=np.int64)
    steps = np.zeros(m, dtype=np.int64)
    idx = np.nonzero(v > 1)[0]
    while len(idx):
        vv = v[idx]
        v[idx] = np.where(vv % 2 == 0, vv // 2, 3 * vv + 1)
        steps[idx] += 1
        idx = idx[v[idx] > 1]
    return steps


def seq_recaman(m):
    m = min(m, 250000)
    out = [0]
    seen = {0}
    for k in range(1, m):
        a = out[-1] - k
        if a <= 0 or a in seen:
            a = out[-1] + k
        out.append(a)
        seen.add(a)
    return np.array(out, dtype=np.int64)


def seq_prime_gaps(m):
    m = min(m, 600000)
    N = int(max(100, m * (math.log(m + 3) + math.log(math.log(m + 3) + 1) + 3)))
    sieve = np.ones(N, dtype=bool)
    sieve[:2] = False
    for p in range(2, int(N ** 0.5) + 1):
        if sieve[p]:
            sieve[p * p::p] = False
    return np.diff(np.nonzero(sieve)[0])[:m]


def seq_digit_sum(m, base=None):
    v = np.arange(m, dtype=np.int64)
    b = base or 3
    s = np.zeros(m, dtype=np.int64)
    while v.any():
        s += v % b
        v //= b
    return s


SEQUENCES = {
    "Thue-Morse": seq_thue_morse,
    "Rudin-Shapiro": seq_rudin_shapiro,
    "paperfolding (dragon curve)": seq_paperfolding,
    "Fibonacci word": seq_fibonacci_word,
    "Kolakoski": seq_kolakoski,
    "Stern's diatomic": seq_stern,
    "Collatz stopping times": seq_collatz,
    "Recaman": seq_recaman,
    "prime gaps": seq_prime_gaps,
    "digit sums": seq_digit_sum,
}
BINARY_SEQS = ["Thue-Morse", "Rudin-Shapiro", "paperfolding (dragon curve)", "Fibonacci word"]


def pulses(rng, vals, n, h):
    """a rhythm: one click at the start of each held value that is non-zero, its size from the value."""
    vals = np.asarray(vals, dtype=np.float64)
    out = np.zeros(n)
    count = min(len(vals), n // h + 1)
    v = vals[np.arange(count) % len(vals)]
    on = np.nonzero(v)[0]
    pos = on * h
    keep = pos < n
    width = int(rng.integers(1, 4))
    a = np.abs(v[on[keep]]) / (np.max(np.abs(v)) + 1e-12)
    if rng.random() < 0.5:
        a = a * np.where(rng.random(len(a)) < 0.5, -1.0, 1.0)
    for j in range(width):
        p = pos[keep] + j
        ok = p < n
        out[p[ok]] = a[ok]
    return out, f"clicks on non-zero terms, one term per {h} samples ({SR / h:.1f} terms/s)"


# ---------------------------------------------------------- data sources
# each source: (rng, n) -> (float array of length n, description)

def src_bytes(rng, n):
    chunk = int(log_uniform(rng, 8, 1 << 16))
    raw = rng.integers(0, 256, size=chunk, dtype=np.uint8)
    vals, idesc = interpret_bytes(rng, raw)
    x, tdesc = transport(rng, vals, n, pick_hold(rng, 1, 24))
    return x, f"random bytes ({chunk} B) as {idesc}; {tdesc}"


def src_files(rng, n):
    if not FILE_POOL:
        return src_bytes(rng, n)
    path = FILE_POOL[int(rng.integers(len(FILE_POOL)))]
    try:
        size = os.path.getsize(path)
        length = int(min(size, log_uniform(rng, 256, 1 << 20)))
        off = int(rng.integers(0, max(1, size - length + 1)))
        with open(path, 'rb') as f:
            f.seek(off)
            raw = f.read(length)
    except OSError:
        return src_bytes(rng, n)
    if len(raw) < 16:
        return src_bytes(rng, n)
    vals, idesc = interpret_bytes(rng, np.frombuffer(raw, dtype=np.uint8))
    x, tdesc = transport(rng, vals, n, pick_hold(rng, 1, 32))
    return x, f"file '{os.path.basename(path)}' bytes {off}-{off + len(raw)} as {idesc}; {tdesc}"


# --- bytebeat: a random integer expression over the clock t

def _bb_leaf(rng):
    r = rng.random()
    if r < 0.5:
        return ('t',)
    if r < 0.8:
        return ('>>', ('t',), ('c', int(rng.integers(1, 14))))
    return ('c', int(rng.choice([1, 2, 3, 4, 5, 7, 8, 9, 11, 13, 15, 16, 31, 42, 63, 64, 127, 128, 255])))


def _bb_tree(rng, depth):
    if depth <= 0 or rng.random() < 0.2:
        return _bb_leaf(rng)
    op = str(rng.choice(['+', '-', '*', '*', '&', '&', '|', '|', '^', '^', '>>', '%']))
    a = _bb_tree(rng, depth - 1)
    if op == '>>':
        b = ('c', int(rng.integers(1, 13)))
    elif op == '%':
        b = ('c', int(rng.integers(2, 257)))
    else:
        b = _bb_tree(rng, depth - 1)
    return (op, a, b)


def _bb_template(rng):
    t = ('t',)
    sh = lambda: ('>>', t, ('c', int(rng.integers(2, 14))))
    c = lambda lo, hi: ('c', int(rng.integers(lo, hi)))
    k = int(rng.integers(5))
    if k == 0:   # t*((t>>a|t>>b)&c)
        return ('*', t, ('&', ('|', sh(), sh()), c(8, 128)))
    if k == 1:   # (t*a&t>>b)|(t*c&t>>d)
        return ('|', ('&', ('*', t, c(2, 12)), sh()), ('&', ('*', t, c(2, 12)), sh()))
    if k == 2:   # (t*(t>>a&c))^(t>>b)
        return ('^', ('*', t, ('&', sh(), c(1, 64))), sh())
    if k == 3:   # t*(c&t>>a)|t>>b
        return ('|', ('*', t, ('&', c(2, 64), sh())), sh())
    return ('-', ('*', t, ('&', sh(), sh())), ('>>', t, c(1, 6)))   # t*(t>>a&t>>b)-(t>>c)


def _bb_eval(node, t):
    k = node[0]
    if k == 't':
        return t
    if k == 'c':
        return np.int64(node[1])
    a = _bb_eval(node[1], t)
    b = _bb_eval(node[2], t)
    if k == '+':
        return a + b
    if k == '-':
        return a - b
    if k == '*':
        return a * b
    if k == '&':
        return a & b
    if k == '|':
        return a | b
    if k == '^':
        return a ^ b
    if k == '>>':
        return a >> b
    return np.remainder(a, b)


def _bb_str(node, top=True):
    k = node[0]
    if k == 't':
        return 't'
    if k == 'c':
        return str(node[1])
    s = f"{_bb_str(node[1], False)}{k}{_bb_str(node[2], False)}"
    return s if top else f"({s})"


def src_bytebeat(rng, n):
    expr = None
    probe = np.arange(1 << 16, dtype=np.int64) * 7
    with np.errstate(all='ignore'):
        for _ in range(40):
            tree = _bb_template(rng) if rng.random() < 0.35 else _bb_tree(rng, int(rng.integers(2, 6)))
            v = np.broadcast_to(_bb_eval(tree, probe), probe.shape) & 255
            if np.std(v) > 18 and len(np.unique(v[:4096])) > 3:
                expr = tree
                break
        if expr is None:
            expr = ('*', ('t',), ('&', ('|', ('>>', ('t',), ('c', 5)), ('>>', ('t',), ('c', 8))), ('c', 63)))
        bits = int(rng.choice([8, 8, 8, 4, 6, 12]))
        mask = (1 << bits) - 1
        clock = int(rng.choice([8000, 8000, 11025, 11025, 16000, 22050, 32000, 44100]))
        t0 = int(rng.integers(0, 1 << 18)) if rng.random() < 0.5 else 0
        if n > SR and rng.random() < 0.3:
            span = float(rng.uniform(0.2, 1.5))
            octs, kk = drift(rng, n, -span, span)
            tt = (np.cumsum(2.0 ** octs) * (clock / SR)).astype(np.int64) + t0
            cdesc = f", clock wandering +-{span:.1f} oct"
        else:
            tt = (np.arange(n, dtype=np.int64) * clock) // SR + t0
            cdesc = ""
        out = np.empty(n)
        step = 1 << 20
        for a in range(0, n, step):
            blk = tt[a:a + step]
            out[a:a + len(blk)] = np.broadcast_to(_bb_eval(expr, blk), blk.shape) & mask
    out = out * (2.0 / mask) - 1.0
    start = f" from t={t0}" if t0 else ""
    return out, f"bytebeat  ({_bb_str(expr)}) & {mask}  on a {clock} Hz clock{start}{cdesc}"


# --- cellular automata

RULES_1D = [18, 22, 26, 30, 45, 54, 57, 60, 62, 73, 75, 82, 86, 89, 90, 99, 101, 102, 105, 106,
            109, 110, 120, 122, 124, 126, 129, 135, 137, 146, 147, 149, 150, 153, 161, 165, 169,
            182, 193, 195, 225]


def run_eca(rule, row, gens):
    """elementary cellular automaton on a ring; returns (gens, width) uint8 rows (row 0 = start)."""
    table = np.array([(rule >> i) & 1 for i in range(8)], dtype=np.uint8)
    W = len(row)
    rows = np.empty((gens, W), dtype=np.uint8)
    r = row.astype(np.uint8)
    for g in range(gens):
        rows[g] = r
        r = table[(np.roll(r, 1) << 2) | (r << 1) | np.roll(r, -1)]
    return rows


def src_automaton(rng, n):
    readout = str(rng.choice(['bits', 'bits', 'words', 'density', 'column']))
    W = int(rng.choice([8, 12, 16, 24, 32, 48, 64, 96, 128, 256]))
    if readout == 'bits':
        h = pick_hold(rng, 1, 12)
        gens = int(min(30000, need_values(n, h) // W + 2))
    else:
        h = pick_hold(rng, 3, 3000)
        gens = int(min(30000, need_values(n, h)))
    for _ in range(12):
        rule = int(rng.choice(RULES_1D)) if rng.random() < 0.85 else int(rng.integers(1, 255))
        if rng.random() < 0.4:
            row = np.zeros(W, dtype=np.uint8)
            row[W // 2] = 1
            init = "one live cell"
        else:
            p = float(rng.uniform(0.1, 0.6))
            row = (rng.random(W) < p).astype(np.uint8)
            init = f"random row (p={p:.2f})"
        rows = run_eca(rule, row, gens)
        if rows[gens // 2:].std() > 0.05:
            break
    if readout == 'bits':
        vals = rows.ravel().astype(np.float64) * 2 - 1
        rd = f"each row read as {W} one-bit samples"
    elif readout == 'words':
        b = min(W, 16)
        vals = to_unit(rows[:, :b].astype(np.int64) @ (1 << np.arange(b, dtype=np.int64)))
        rd = f"each row read as one {b}-bit number"
    elif readout == 'density':
        vals = to_unit(rows.mean(axis=1))
        rd = "each row's population as one sample"
    else:
        c = int(rng.integers(W))
        vals = rows[:, c].astype(np.float64) * 2 - 1
        rd = f"cell {c} over time"
    x, tdesc = transport(rng, vals, n, h)
    return x, f"rule {rule} automaton, width {W}, from {init}, {gens} generations; {rd}; {tdesc}"


LIFE_RULES = [
    ("B3/S23 Life", (3,), (2, 3)), ("B36/S23 HighLife", (3, 6), (2, 3)),
    ("B2/S Seeds", (2,), ()), ("B3678/S34678 Day & Night", (3, 6, 7, 8), (3, 4, 6, 7, 8)),
    ("B368/S245 Morley", (3, 6, 8), (2, 4, 5)), ("B35678/S5678 Diamoeba", (3, 5, 6, 7, 8), (5, 6, 7, 8)),
    ("B1357/S1357 Replicator", (1, 3, 5, 7), (1, 3, 5, 7)), ("B34/S34", (3, 4), (3, 4)),
    ("B3/S12345 Maze", (3,), (1, 2, 3, 4, 5)), ("B36/S125 2x2", (3, 6), (1, 2, 5)),
]


def src_life(rng, n):
    name, born, survive = LIFE_RULES[int(rng.integers(len(LIFE_RULES)))]
    H = int(rng.choice([6, 8, 12, 16, 24, 32]))
    W = int(rng.choice([6, 8, 12, 16, 24, 32]))
    readout = str(rng.choice(['scan', 'scan', 'rows', 'census']))
    per = {'scan': H * W, 'rows': H, 'census': 1}[readout]
    h = pick_hold(rng, 1, 8) if readout == 'scan' else pick_hold(rng, 2, 2500)
    gens = int(min(6000, need_values(n, h) // per + 2))
    p = float(rng.uniform(0.15, 0.5))
    g = (rng.random((H, W)) < p).astype(np.uint8)
    bmask = np.zeros(9, dtype=bool)
    bmask[list(born)] = True
    smask = np.zeros(9, dtype=bool)
    smask[list(survive)] = True
    frames = np.empty((gens, H, W), dtype=np.uint8)
    reseeds = 0
    for k in range(gens):
        frames[k] = g
        nb = sum(np.roll(np.roll(g, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                 if dy or dx)
        g = np.where(g == 1, smask[nb], bmask[nb]).astype(np.uint8)
        if not g.any():
            g = (rng.random((H, W)) < p).astype(np.uint8)
            reseeds += 1
    if readout == 'scan':
        vals = frames.reshape(-1).astype(np.float64) * 2 - 1
        rd = f"each generation scanned as {H * W} one-bit samples"
    elif readout == 'rows':
        vals = to_unit(frames.sum(axis=2).reshape(-1))
        rd = "each row's population as a sample"
    else:
        vals = to_unit(frames.reshape(gens, -1).sum(axis=1))
        rd = "the population of each generation as a sample"
    x, tdesc = transport(rng, vals, n, h)
    rs = f", died and was reseeded {reseeds}x" if reseeds else ""
    return x, f"{name} on a {H}x{W} torus (p={p:.2f}), {gens} generations{rs}; {rd}; {tdesc}"


def src_lfsr(rng, n):
    nb = int(rng.integers(3, 25))
    taps = int(rng.integers(1, 1 << nb)) | (1 << (nb - 1))
    s0 = s = int(rng.integers(1, 1 << nb))
    readout = str(rng.choice(['bit', 'bit', 'word']))
    h = pick_hold(rng, 1, 40)
    steps = min(need_values(n, h), 1 << 18)
    out = np.empty(steps)
    period = None
    for i in range(steps):
        out[i] = (s & 1) if readout == 'bit' else s
        lsb = s & 1
        s >>= 1
        if lsb:
            s ^= taps
        if s == s0:
            period = i + 1
            break
    vals = out[:period] if period else out
    vals = vals * 2 - 1 if readout == 'bit' else to_unit(vals)
    x, tdesc = transport(rng, vals, n, h)
    pd = f"period {period}" if period else f"period > {steps}"
    rd = "output bit" if readout == 'bit' else "whole register as a number"
    return x, f"{nb}-bit Galois LFSR, taps 0x{taps:x}, {pd}; {rd}; {tdesc}"


def src_chaos(rng, n):
    kind = str(rng.choice(['logistic', 'logistic', 'circle', 'henon']))
    h = pick_hold(rng, 1, 400)
    steps = min(need_values(n, h), 400000)
    kp = int(rng.integers(2, 9))
    out = np.empty(steps)
    if kind == 'logistic':
        lo = float(rng.uniform(2.9, 3.9))
        hi = float(rng.uniform(lo, 4.0))
        path = smooth_path(rng.uniform(lo, hi, kp), steps).tolist()
        x = float(rng.uniform(0.1, 0.9))
        for i, r in enumerate(path):
            x = r * x * (1.0 - x)
            out[i] = x
        desc = f"logistic map x->rx(1-x), r drifting {lo:.3f}..{hi:.3f}"
    elif kind == 'circle':
        K = float(rng.uniform(0.3, 1.6))
        a = float(rng.uniform(0, 1))
        b = float(np.clip(a + rng.uniform(-0.3, 0.3), 0, 1))
        path = smooth_path(rng.uniform(min(a, b), max(a, b) + 1e-6, kp), steps).tolist()
        th = float(rng.random())
        c = K / (2 * math.pi)
        tp = 2 * math.pi
        for i, om in enumerate(path):
            th = (th + om - c * math.sin(tp * th)) % 1.0
            out[i] = th
        desc = f"circle map (K={K:.2f}), winding drifting {min(a, b):.3f}..{max(a, b):.3f}"
    else:
        lo = float(rng.uniform(0.9, 1.3))
        hi = float(rng.uniform(lo, 1.42))
        bb = float(rng.uniform(0.2, 0.32))
        path = smooth_path(rng.uniform(lo, hi, kp), steps).tolist()
        x, y = 0.1, 0.1
        for i, a in enumerate(path):
            x, y = 1.0 - a * x * x + y, bb * x
            if abs(x) > 1e3:
                x, y = 0.1, 0.1
            out[i] = x
        desc = f"Henon map (b={bb:.2f}), a drifting {lo:.3f}..{hi:.3f}"
    xx, tdesc = transport(rng, to_unit(out), n, h)
    return xx, f"{desc}, {steps} iterations; {tdesc}"


def src_irrational(rng, n):
    if rng.random() < 0.5:
        while True:
            k = int(rng.integers(2, 1000))
            if math.isqrt(k) ** 2 != k:
                break
        B = int(log_uniform(rng, 1 << 12, 1 << 19))
        v = math.isqrt(k << (2 * B))
        desc = f"binary expansion of sqrt({k}), {B} bits"
    else:
        primes = [p for p in range(3, 4000) if all(p % q for q in range(2, math.isqrt(p) + 1))]
        p = int(rng.choice(primes))
        order = 1
        t = 2 % p
        while t != 1:
            t = (t * 2) % p
            order += 1
        B = int(min(1 << 18, max(order * 8, 4096)))
        v = (1 << B) // p
        desc = f"binary expansion of 1/{p} (repeats every {order} bits), {B} bits"
    raw = np.frombuffer(v.to_bytes((v.bit_length() + 7) // 8, 'big'), dtype=np.uint8)
    vals, idesc = interpret_bytes(rng, raw)
    x, tdesc = transport(rng, vals, n, pick_hold(rng, 1, 48))
    return x, f"{desc}, as {idesc}; {tdesc}"


def src_sequence(rng, n):
    name = str(rng.choice(list(SEQUENCES)))
    readout = str(rng.choice(['level', 'parity', 'mod', 'pulse']))
    if name in BINARY_SEQS and readout in ('parity', 'mod'):
        readout = 'level'
    if readout == 'pulse':
        h = pick_hold(rng, 600, 12000)
    else:
        h = pick_hold(rng, 1, 3000)
    m = need_values(n, h)
    fn = SEQUENCES[name]
    if name == "digit sums":
        base = int(rng.integers(2, 11))
        v = fn(m, base)
        name = f"base-{base} digit sums"
    else:
        v = fn(m)
    if rng.random() < 0.3 and len(v) > 2:
        v = np.diff(v)
        name = f"first differences of {name}"
    if readout == 'pulse':
        x, tdesc = pulses(rng, v, n, h)
        return x, f"{name} sequence ({len(v)} terms); {tdesc}"
    if readout == 'parity':
        vals = (v & 1).astype(np.float64) * 2 - 1
        rd = "parity of each term"
    elif readout == 'mod':
        M = int(rng.integers(3, 65))
        vals = to_unit(v % M)
        rd = f"each term mod {M}"
    else:
        vals = to_unit(v)
        rd = "terms scaled to full range"
    x, tdesc = transport(rng, vals, n, h)
    return x, f"{name} sequence ({len(v)} terms), {rd}; {tdesc}"


def src_substitution(rng, n):
    readout = str(rng.choice(['level', 'level', 'pulse']))
    h = pick_hold(rng, 600, 10000) if readout == 'pulse' else pick_hold(rng, 1, 2000)
    need = need_values(n, h)
    letters = "abcd"
    for _ in range(12):
        k = int(rng.integers(2, 5))
        rules = [rng.integers(0, k, int(rng.integers(1, 5))) for _ in range(k)]
        if len(rules[0]) < 2:
            rules[0] = np.concatenate([rules[0], rng.integers(0, k, 1)])
        lens = np.array([len(r) for r in rules])
        R = np.full((k, 4), 0, dtype=np.int64)
        for i, r in enumerate(rules):
            R[i, :len(r)] = r
        s = np.array([0], dtype=np.int64)
        it = 0
        while len(s) < need and it < 80:
            L = lens[s]
            starts = np.concatenate([[0], np.cumsum(L)[:-1]])
            out = np.empty(int(L.sum()), dtype=np.int64)
            for j in range(4):
                msk = L > j
                out[starts[msk] + j] = R[s[msk], j]
            if len(out) == len(s):
                break
            s = out[:MAX_VALUES]
            it += 1
        if len(s) >= min(need, 4096) and len(np.unique(s)) > 1:
            break
    rtext = ", ".join(f"{letters[i]}->{''.join(letters[c] for c in r)}" for i, r in enumerate(rules))
    if readout == 'pulse':
        x, tdesc = pulses(rng, (s == 0).astype(np.int64), n, h)
        return x, f"L-system {rtext}, {it} rewrites, {len(s)} letters, 'a' clicks; {tdesc}"
    levels = rng.permutation(np.linspace(-1, 1, k))
    x, tdesc = transport(rng, levels[s], n, h)
    return x, f"L-system {rtext}, {it} rewrites, {len(s)} letters as {k} levels; {tdesc}"


def src_sort(rng, n):
    m = int(rng.choice([32, 64, 128, 256, 512, 1024]))
    if rng.random() < 0.5:
        arr = rng.permutation(m).astype(np.float64)
        start = "a shuffled ramp"
    else:
        arr = rng.integers(0, 256, m).astype(np.float64)
        start = "random bytes"
    algo = str(rng.choice(['odd-even transposition', 'odd-even transposition', 'bottom-up merge',
                           'shell (gap halving)']))
    snaps = [arr.copy()]
    if algo == 'odd-even transposition':
        for p in range(m):
            i = np.arange(p % 2, m - 1, 2)
            a, b = arr[i], arr[i + 1]
            sw = a > b
            arr[i[sw]], arr[i[sw] + 1] = b[sw], a[sw]
            snaps.append(arr.copy())
    elif algo == 'bottom-up merge':
        w = 2
        while w <= m:
            arr = np.sort(arr.reshape(-1, w), axis=1).ravel()
            snaps.append(arr.copy())
            w *= 2
    else:
        gap = m // 2
        while gap >= 1:
            for _ in range(int(rng.integers(1, 4))):
                for off in range(gap):
                    arr[off::gap] = np.sort(arr[off::gap]) if rng.random() < 0.5 else arr[off::gap]
                snaps.append(arr.copy())
            gap //= 2
        arr = np.sort(arr)
        snaps.append(arr.copy())
    if rng.random() < 0.4:
        snaps = snaps + snaps[::-1]
        start += ", then unsorting itself"
    h = pick_hold(rng, 1, 6)
    rep = int(np.clip(round(need_values(n, h) / (len(snaps) * m)), 1, 600))
    vals = to_unit(np.repeat(np.array(snaps), rep, axis=0).ravel())
    x, tdesc = transport(rng, vals, n, h, glide_p=0.2)
    return x, (f"{algo} sort of {m} values from {start}: {len(snaps)} snapshots, "
               f"each heard {rep}x; {tdesc}")


def src_impulses(rng, n):
    rate = log_uniform(rng, 0.2, 40)
    count = max(1, int(rate * n / SR))
    out = np.zeros(n)
    out[rng.integers(0, n, count)] = rng.uniform(-1, 1, count)
    return out, f"{count} single-sample impulses (~{rate:.1f}/s)"


# (key, function, base weight, label)
SOURCES = [
    ("bytes", src_bytes, 2.0, "random bytes"),
    ("files", src_files, 2.5, "file bytes"),
    ("bytebeat", src_bytebeat, 3.0, "bytebeat"),
    ("automaton", src_automaton, 3.0, "1D automaton"),
    ("life", src_life, 2.0, "life-like automaton"),
    ("lfsr", src_lfsr, 2.0, "shift register"),
    ("chaos", src_chaos, 2.0, "chaotic map"),
    ("irrational", src_irrational, 1.2, "irrational digits"),
    ("sequence", src_sequence, 2.5, "integer sequence"),
    ("substitution", src_substitution, 1.5, "L-system"),
    ("sort", src_sort, 1.5, "sorting trace"),
    ("impulses", src_impulses, 0.6, "impulses"),
]
SOURCE_INDEX = {s[0]: i for i, s in enumerate(SOURCES)}


# ------------------------------------------------------------ manipulations
# data operations. each takes (rng, x) and returns (same-length array, description).

def op_bitcrush(rng, x):
    bits = int(rng.integers(2, 12))
    q = 2 ** (bits - 1)
    return np.round(x * q) / q, f"bitcrush to {bits} bits"


def op_samplehold(rng, x):
    k = int(rng.integers(2, 200))
    return np.repeat(x[::k], k)[:len(x)], f"sample-and-hold every {k}"


def op_reverse_blend(rng, x):
    k = int(log_uniform(rng, 64, max(128, min(len(x) // 2, 2 * SR))))
    r = x.copy()
    m = np.zeros(len(x))
    for i in range(0, len(x) - k, k * 2):
        r[i:i + k] = x[i:i + k][::-1]
        m[i:i + k] = 1.0
    m = box_smooth(m, min(k // 2, 2400), passes=3)
    return x * (1 - m) + r * m, f"reverse alternate chunks of {k}"


def op_soft_gate(rng, x):
    k = int(log_uniform(rng, 200, max(400, min(len(x) // 2, 10 * SR))))
    p = float(rng.uniform(0.2, 0.8))
    nb = len(x) // k + 1
    mask = np.repeat((rng.random(nb) < p).astype(float), k)[:len(x)]
    w = int(min(k // 2, log_uniform(rng, 240, 9600)))
    return x * box_smooth(mask, max(3, w), passes=3), f"chance gate, blocks of {k}, p(open)={p:.2f}"


def op_pattern_gate(rng, x):
    """open and close in a self-similar pattern: Thue-Morse, Fibonacci word ..."""
    n = len(x)
    k = int(log_uniform(rng, 0.03 * SR, max(0.06 * SR, min(n / 4, 3 * SR))))
    nb = n // k + 2
    name = str(rng.choice(BINARY_SEQS))
    bits = SEQUENCES[name](nb).astype(float)
    inv = rng.random() < 0.5
    if inv:
        bits = 1.0 - bits
    mask = np.repeat(bits, k)[:n]
    w = int(min(k // 3, log_uniform(rng, 48, 4800)))
    return x * box_smooth(mask, max(3, w), passes=2), \
        f"{name} gate{' (inverted)' if inv else ''}, {1000 * k / SR:.0f} ms per term"


def op_fold(rng, x):
    g = float(rng.uniform(1.5, 10))
    y = (x * g + 1.0) / 4.0
    return 4.0 * np.abs(y - np.floor(y + 0.5)) - 1.0, f"triangle fold, gain {g:.1f}"


def op_overflow(rng, x):
    g = float(rng.uniform(1.3, 8))
    return np.mod(x * g + 1.0, 2.0) - 1.0, f"integer overflow wraparound, gain {g:.1f}"


def op_xor_bits(rng, x):
    mask = int(rng.integers(1, 1 << 15))
    i = (to_i16(x).view(np.uint16) ^ np.uint16(mask)).view(np.int16)
    return from_i16(i), f"xor 16-bit words with 0x{mask:04x}"


def op_bitplane(rng, x):
    nbits = int(rng.integers(1, 7))
    planes = sorted(int(b) for b in rng.choice(16, nbits, replace=False))
    if max(planes) < 9:
        planes[-1] = int(rng.integers(9, 16))
        planes = sorted(set(planes))
    mask = sum(1 << b for b in planes)
    i = (to_i16(x).view(np.uint16) & np.uint16(mask)).view(np.int16)
    return from_i16(i), f"keep only bit-planes {planes}"


def op_rotate_bits(rng, x):
    r = int(rng.integers(1, 16))
    u = to_i16(x).view(np.uint16)
    rot = ((u << np.uint16(r)) | (u >> np.uint16(16 - r))).astype(np.uint16)
    return from_i16(rot.view(np.int16)), f"rotate 16-bit words left by {r}"


def op_gray(rng, x):
    u = to_i16(x).view(np.uint16)
    return from_i16((u ^ (u >> np.uint16(1))).view(np.int16)), "Gray-code the 16-bit words"


def op_byteswap(rng, x):
    return from_i16(to_i16(x).byteswap()), "swap the byte order of every 16-bit word"


def op_shuffle_blocks(rng, x):
    k = int(log_uniform(rng, 100, max(200, min(len(x) // 2, 5 * SR))))
    nb = len(x) // k
    if nb < 2:
        return x, "shuffle (skipped, too short)"
    rl = max(2, min(k // 4, 1200))
    win = np.ones(k)
    win[:rl] = ramp(rl)
    win[-rl:] = ramp(rl)[::-1]
    blocks = x[:nb * k].reshape(nb, k) * win
    blocks = blocks[rng.permutation(nb)]
    return np.concatenate([blocks.ravel(), x[nb * k:]]), f"shuffle {nb} blocks of {k}"


def op_sort_blocks(rng, x):
    k = int(log_uniform(rng, 16, max(32, min(len(x) // 2, SR // 2))))
    nb = len(x) // k
    if nb < 1:
        return x, "sort (skipped, too short)"
    p = float(rng.uniform(0.2, 1.0))
    mode = str(rng.choice(['ascending', 'descending', 'alternating']))
    y = x.copy()
    b = np.sort(x[:nb * k].reshape(nb, k), axis=1)
    if mode == 'descending':
        b = b[:, ::-1]
    elif mode == 'alternating':
        b[1::2] = b[1::2, ::-1]
    pick = rng.random(nb) < p
    yb = y[:nb * k].reshape(nb, k)
    yb[pick] = b[pick]
    return y, f"sort {pick.sum()} of {nb} blocks of {k} samples ({mode})"


def op_stutter(rng, x):
    """a skipping CD: little buffers caught and repeated."""
    n = len(x)
    y = x.copy()
    events = int(max(1, log_uniform(rng, 1, max(2, n / SR * 1.5))))
    xf = 32
    for _ in range(events):
        b = int(log_uniform(rng, 128, 0.25 * SR))
        if b * 2 >= n:
            continue
        reps = int(rng.integers(2, 17))
        p0 = int(rng.integers(0, n - b))
        buf = x[p0:p0 + b].copy()
        buf[:xf] *= ramp(xf)
        buf[-xf:] *= ramp(xf)[::-1]
        for r in range(reps):
            a = p0 + r * b
            if a >= n:
                break
            m = min(b, n - a)
            y[a:a + m] = buf[:m]
    return y, f"stutter: {events} skips, buffers repeated up to 16x"


def op_delta(rng, x):
    return np.diff(x, prepend=x[:1]), "first difference (each sample minus the last)"


def op_integrate(rng, x):
    y = np.cumsum(x - np.mean(x))
    y -= box_smooth(y, int(log_uniform(rng, 200, 4800)), passes=2)
    return y, "running sum, drift removed"


def op_granulate(rng, x):
    n = len(x)
    out = np.zeros(n)
    density = log_uniform(rng, 3, 300)
    count = int(min(max(1, density * n / SR), 8000))
    gmax = int(max(64, min(log_uniform(rng, 240, 0.25 * SR), n // 2)))
    glens = np.exp(rng.uniform(np.log(32), np.log(gmax), count)).astype(int)
    srcs = (rng.random(count) * (n - glens)).astype(int)
    dsts = (rng.random(count) * (n - glens)).astype(int)
    wins = {}
    for gl, s, d in zip(glens, srcs, dsts):
        w = wins.get(gl)
        if w is None:
            w = wins[gl] = np.hanning(gl)
        out[d:d + gl] += x[s:s + gl] * w
    return out, f"granulate itself: {count} grains up to {gmax} samples"


def op_lowpass(rng, x):
    fc = log_uniform(rng, 200, 9000)
    order = int(rng.integers(1, 3))
    return lowpass_fft(x, fc, order), f"lowpass {fc:.0f} Hz (order {order})"


OPS = [op_bitcrush, op_samplehold, op_reverse_blend, op_soft_gate, op_pattern_gate, op_fold,
       op_overflow, op_xor_bits, op_bitplane, op_rotate_bits, op_gray, op_byteswap,
       op_shuffle_blocks, op_sort_blocks, op_stutter, op_delta, op_integrate, op_granulate,
       op_lowpass, op_lowpass]
ALL_OPS = list(range(len(OPS)))     # a slot hint may narrow this to a palette of indices


def cross(rng, x, y):
    """combine a layer with a second data stream."""
    pk = float(np.max(np.abs(y)))
    y = y / pk if pk > 0 else y
    kind = str(rng.choice(['xor', 'and', 'or', 'multiply', 'min', 'max', 'scrub']))
    if kind in ('xor', 'and', 'or'):
        a, b = to_i16(x), to_i16(y)
        r = a ^ b if kind == 'xor' else (a & b if kind == 'and' else a | b)
        return from_i16(r), f"{kind} with"
    if kind == 'multiply':
        return x * y, "multiplied by"
    if kind == 'min':
        return np.minimum(x, y), "minimum with"
    if kind == 'max':
        return np.maximum(x, y), "maximum with"
    n = len(x)
    span = log_uniform(rng, 64, max(128, min(n / 2, 2 * SR)))
    idx = (np.arange(n) - (y * 0.5 + 0.5) * span).astype(np.int64) % n
    return x[idx], f"scrubbed (+-{span / SR * 1000:.0f} ms) by"


# ------------------------------------------------------------------ form

@dataclass
class Voice:
    vid: int
    src: int           # index into SOURCES
    seed: int          # fixes the data: which rule, which file, which formula
    home: float        # where it lives in the stereo field
    origin: str
    track: int
    first: str = ""    # description of its first appearance
    heard: bool = False


def automaton_score(rng, total, voices, log):
    """the score as a cellular automaton: columns are voices, rows are time, live runs are layers."""
    secs = total / SR
    best = None
    for _ in range(80):
        rule = int(rng.choice(RULES_1D)) if rng.random() < 0.8 else int(rng.integers(1, 255))
        W = voices + int(rng.integers(0, 3 * voices + 1))
        row_s = log_uniform(rng, 2.0, 24.0)
        R = max(8, int(math.ceil(secs / row_s)))
        if rng.random() < 0.35:
            row = np.zeros(W, dtype=np.uint8)
            row[int(rng.integers(W))] = 1
            init = "one live cell"
        else:
            p = float(rng.uniform(0.15, 0.6))
            row = (rng.random(W) < p).astype(np.uint8)
            init = f"random row (p={p:.2f})"
        rows = run_eca(rule, row, R)
        c0 = int(rng.integers(0, W - voices + 1))
        grid = rows[:, c0:c0 + voices]
        dens = float(grid.mean())
        runs = int(np.sum(np.diff(np.vstack([np.zeros((1, voices)), grid]), axis=0) == 1))
        best = (rule, W, R, init, c0, grid)
        if 0.12 <= dens <= 0.6 and runs >= max(3, voices):
            break
    rule, W, R, init, c0, grid = best
    row_s = secs / R
    log.append(f"score: rule {rule} automaton, width {W} from {init}; columns {c0}-{c0 + voices - 1} "
               f"are the {voices} voices; {R} rows of {row_s:.2f} s; {100 * grid.mean():.0f}% alive")
    slots = []
    for v in range(voices):
        col = np.concatenate([[0], grid[:, v], [0]]).astype(int)
        d = np.diff(col)
        for a, b in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]):
            s0 = a * row_s
            length = (b - a) * row_s + rng.uniform(0.0, 0.6) * row_s
            while length > MIN_LAYER_S:
                seg = min(length, MAX_LAYER_S)
                st = int(s0 * SR)
                if st < total - SR // 4:
                    slots.append((st, int(min(seg * SR, total - st)), v))
                s0 += seg * 0.94
                length -= seg * 0.94
                if seg < MAX_LAYER_S:
                    break
    slots.sort()
    picture = ["--- the score (each column a voice, each row "
               f"{row_s:.2f} s; # = sounding) ---"]
    for r in range(R):
        picture.append(f"  {fmt_time(r * row_s):>7}  " + "".join('#' if c else '.' for c in grid[r]))
    return slots, picture, f"rule{rule}"


def drift_score(rng, total, cap, log):
    """onsets from a smooth density curve, with a cap on simultaneous voices."""
    secs = total / SR
    lpm = log_uniform(rng, 0.8, 6.0)
    n_layers = max(4, int(round(lpm * secs / 60.0)))
    median = log_uniform(rng, 6.0, max(12.0, min(100.0, secs / 3.0)))
    sigma = float(rng.uniform(0.4, 1.4))
    density = Curve(rng, "onset density", 2, 10, 0.02, 1.0)
    length = Curve(rng, "layer-length multiplier", 2, 8, 0.5, 2.0)
    grid = np.linspace(0, 1, 1024)
    cdf = np.cumsum([density(g) for g in grid])
    cdf = (cdf - cdf[0]) / (cdf[-1] - cdf[0])
    log.append(f"score: drifting density, {lpm:.2f} layers/min -> {n_layers} layers, "
               f"median length {median:.1f} s (spread {sigma:.2f}), at most {cap} at once")
    log.append("  " + density.describe())
    log.append("  " + length.describe())
    cres = SR // 10
    occ = np.zeros(total // cres + 2, dtype=int)
    slots = []
    for _ in range(n_layers):
        for _ in range(30):
            pos = float(np.interp(rng.random(), cdf, grid))
            st = min(int(pos * total), total - SR // 2)
            sec = float(np.clip(median * length(pos) * np.exp(rng.normal(0, sigma)), MIN_LAYER_S, MAX_LAYER_S))
            n = min(int(sec * SR), total - st)
            a, b = st // cres, -(-(st + n) // cres)
            if occ[a:b].max() < cap:
                occ[a:b] += 1
                slots.append((st, n, -1))
                break
    slots.sort()
    return slots, [], "drift"


# ----------------------------------------------------------------- piece

def envelope(rng, n, fade_range=(0.3, 10.0)):
    secs = n / SR
    k = int(np.clip(2 + rng.integers(0, 3 + int(secs / 3)), 2, 48))
    env = smooth_path(rng.uniform(0.2, 1.0, k), n)
    fade = int(min(n // 2, SR * log_uniform(rng, *fade_range)))
    if fade > 1:
        r = ramp(fade)
        env[:fade] *= r
        env[-fade:] *= r[::-1]
    return env


def steady(n, fade_s, fade_in=None, fade_out=None):
    """a steady level with raised-cosine fades at both ends (for beds and continuous layers);
    the two ends may be given their own lengths (a hard cut in, a slow fade out ...)."""
    env = np.ones(n)
    fi = int(min(n // 2, (fade_s if fade_in is None else fade_in) * SR))
    fo = int(min(n // 2, (fade_s if fade_out is None else fade_out) * SR))
    if fi > 1:
        env[:fi] = ramp(fi)
    if fo > 1:
        env[-fo:] *= ramp(fo)[::-1]
    return env


def curve_at(n, pts):
    """breakpoints [(fraction of the layer 0..1, value)] -> n values, smooth between points."""
    pts = sorted(pts)
    t = np.array([p[0] for p in pts], dtype=float)
    v = np.array([p[1] for p in pts], dtype=float)
    m = int(min(n, max(16, n // 480)))
    coarse = np.interp(np.linspace(0, 1, m), t, v)
    return np.interp(np.linspace(0, m - 1, n), np.arange(m), box_smooth(coarse, max(1, m // 64), passes=2))


def render_source(src, seed, n, hint=None):
    fn = SOURCES[src][1]
    rng = np.random.default_rng(seed)
    x, desc = fn(rng, n, hint) if hint is not None else fn(rng, n)
    return fit(np.asarray(x, dtype=np.float64), n), desc


def choose_source(rng, allowed, curves, pos):
    w = np.array([SOURCES[i][2] * (0.03 + curves[i](pos)) for i in allowed])
    return allowed[int(rng.choice(len(allowed), p=w / w.sum()))]


# a form takes (rng, total samples, voice cap, log, allowed sources) and returns
# (slots, picture lines, tag). a slot is (start, n, voice key) or (start, n, voice key, hint):
# key >= 0 is a score column (one voice per column), -1 lets the piece pick or make a voice,
# a string is a voice of its own. a hint may fix 'src', 'amp_db', 'pan', 'depth', 'slip',
# 'fade' (seconds: a steady level with fades instead of a wandering envelope), 'pool' (the
# sources a new voice may come from), and pass 'source_hint' through to the source.
# a slot whose hint has 'bend' does not add a sound: it runs data operations over what is
# already in the mix there and cross-fades the result in place.
FORMS = {
    'automaton': lambda rng, total, cap, log, allowed: automaton_score(rng, total, cap, log),
    'drift': lambda rng, total, cap, log, allowed: drift_score(rng, total, cap, log),
}
CHANCE_FORMS = [('automaton', 0.6), ('drift', 0.4)]


def make_piece(rng, duration, channels, log, allowed, form, pool, track_no, progress=False):
    total = int(duration * SR)
    mix = np.zeros((channels, total))
    cap = int(rng.integers(2, 7))
    p_return = float(rng.uniform(0.4, 0.9))
    p_album = 0.3 if pool else 0.0
    loud = Curve(rng, "loudness centre (dB)", 2, 10, -28.0, -8.0)
    depth = Curve(rng, "manipulation depth", 2, 8, 0.0, 1.0)
    pan_c = Curve(rng, "pan centre", 2, 8, 0.2, 0.8)
    pan_w = Curve(rng, "pan width", 2, 8, 0.0, 1.0)
    curves = {i: Curve(rng, f"weight of '{SOURCES[i][3]}'", 2, 10, 0.0, 1.0) for i in allowed}

    if form == 'chance':
        names = [f for f, _ in CHANCE_FORMS]
        w = np.array([wt for _, wt in CHANCE_FORMS])
        form = names[int(rng.choice(len(names), p=w / w.sum()))]
    slots, picture, tag = FORMS[form](rng, total, cap, log, allowed)
    log.append(f"voices return with the same data {100 * p_return:.0f}% of the time "
               f"(otherwise a fresh draw of the same kind)"
               + (f"; a new voice is an earlier track's {100 * p_album:.0f}% of the time" if p_album else ""))
    log.append("--- control curves across the piece ---")
    for c in [loud, depth, pan_c, pan_w] + [curves[i] for i in allowed]:
        log.append("  " + c.describe())
    log.extend(picture)
    log.append("--- layers ---")

    voices = {}           # column (automaton) or own id (drift) -> Voice
    born = []

    def new_voice(key, pos, src=None, among=None):
        vid = len(voices) + 1
        among = among or allowed
        if src is not None:
            v = Voice(vid, src, int(rng.integers(1 << 62)), float(rng.uniform(0, 1)), "born here", track_no)
            voices[key] = v
            born.append(v)
            return v
        if p_album and rng.random() < p_album:
            cands = [v for v in pool if v.src in among]
            if cands:
                old = cands[int(rng.integers(len(cands)))]
                v = Voice(vid, old.src, old.seed, float(rng.uniform(0, 1)),
                          f"returns from track {old.track} (voice {old.vid})", track_no)
                voices[key] = v
                return v
        v = Voice(vid, choose_source(rng, among, curves, pos), int(rng.integers(1 << 62)),
                  float(rng.uniform(0, 1)), "born here", track_no)
        voices[key] = v
        born.append(v)
        return v

    def bend(li, start, n, hint, pos):
        """run data operations over what is already sounding here, and cross-fade it in place.
        each channel gets the same operations (same seed), so the stereo picture holds."""
        e = min(total, start + n)
        n = e - start
        if n < SR // 2:
            return
        bseed = int(rng.integers(1 << 62))
        dpt = hint.get('depth', depth(pos))
        opool = hint.get('ops') or ALL_OPS
        nops = max(1, int(rng.binomial(4, dpt * 0.75)))
        fade = int(min(n // 3, SR * hint.get('fade', 0.4)))
        w = np.ones(n)
        if fade > 1:
            w[:fade] = ramp(fade)
            w[-fade:] = ramp(fade)[::-1]
        steps = []
        for ch in range(channels):
            seg = mix[ch, start:e].copy()
            pk = float(np.max(np.abs(seg)))
            if pk <= 1e-9:
                return
            r2 = np.random.default_rng(bseed)
            y = seg / pk
            steps = []
            for _ in range(nops):
                op = OPS[opool[int(r2.integers(len(opool)))]]
                y, d = op(r2, y)
                y = fit(y, n)
                steps.append(d)
            y = dc_block(y)
            ry, py = float(np.sqrt(np.mean(y * y))), float(np.max(np.abs(y)))
            if py <= 1e-9:
                continue
            lvl = float(np.sqrt(np.mean(seg * seg)))
            y *= min(lvl / max(ry, 1e-12), 1.5 * pk / py)          # as loud as what it replaces
            mix[ch, start:e] = seg * (1.0 - w) + y * w
        log.append(f"[{li + 1:03d}] t={start / SR:7.1f}s len={n / SR:6.1f}s  BEND what is sounding | "
                   + " | ".join(steps))

    for li, (start, n, col, *rest) in enumerate(slots):
        hint = rest[0] if rest else {}
        pos = start / total
        if hint.get('bend'):
            bend(li, start, n, hint, pos)
            continue
        among = hint.get('pool')
        if isinstance(col, str) or col >= 0:
            v = voices.get(col) or new_voice(col, pos, hint.get('src'), among)
        elif voices and rng.random() < 0.55 and \
                (among is None or any(vv.src in among for vv in voices.values())):
            keys = list(voices) if among is None else [k for k in voices if voices[k].src in among]
            v = voices[keys[int(rng.integers(len(keys)))]]
        else:
            v = new_voice(len(voices), pos, None, among)
        if not v.heard:
            seed, how = v.seed, ("birth" if v.origin == "born here" else v.origin)
            v.heard = True
        elif rng.random() < hint.get('p_return', p_return):
            seed, how = v.seed, "return (same data)"
        else:
            seed, how = int(rng.integers(1 << 62)), "variation (fresh draw)"

        if 'slip' in hint:
            slip = int(hint['slip']) if channels == 2 else 0
        else:
            slip = int(log_uniform(rng, 1, 4800)) if channels == 2 and rng.random() < 0.3 else 0
        x, desc = render_source(v.src, seed, n + slip, hint.get('source_hint'))
        if not v.first:
            v.first = desc
        steps = [desc]

        dpt = hint.get('depth', depth(pos))
        opool = hint.get('ops') or ALL_OPS
        for _ in range(int(rng.binomial(4, dpt * 0.75))):
            op = OPS[opool[int(rng.integers(len(opool)))]]
            x, d = op(rng, x)
            x = fit(x, n + slip)
            steps.append(d)
        if rng.random() < 0.35 * dpt:
            psrc = choose_source(rng, among or allowed, curves, pos)
            y, pdesc = render_source(psrc, int(rng.integers(1 << 62)), n + slip)
            x, how_c = cross(rng, x, y)
            steps.append(f"{how_c} [{pdesc}]")
        if 'morph' in hint:                        # turn gradually into a processed self
            mh = hint['morph']
            r3 = np.random.default_rng(mh['seed'])
            y = x.copy()
            ds = []
            for oi in mh['ops']:
                y, d = OPS[oi](r3, y)
                y = fit(y, n + slip)
                ds.append(d)
            y = dc_block(y)
            rx, ry = float(np.sqrt(np.mean(x * x))), float(np.sqrt(np.mean(y * y)))
            if ry > 1e-12:
                y *= rx / ry
            w = np.clip(curve_at(n + slip, mh['curve']), 0.0, 1.0)
            x = x * (1.0 - w) + y * w
            steps.append("morphing (wet " + " > ".join(f"{v:.1f}" for _, v in sorted(mh['curve']))
                         + ") into: " + "; ".join(ds))

        x = dc_block(x)
        pk = float(np.max(np.abs(x)))
        rms = float(np.sqrt(np.mean(x * x)))
        if pk <= 1e-9:
            log.append(f"[{li + 1:03d}] t={start / SR:7.1f}s  voice {v.vid}: came out silent | " + " | ".join(steps))
            continue
        x *= min(1.0 / pk, 0.3 / max(rms, 1e-9))
        amp_db = float(hint['amp_db']) if 'amp_db' in hint else \
            float(np.clip(loud(pos) + rng.normal(0, 5.0), -46.0, -3.0))
        env = steady(n, hint['fade'], hint.get('fade_in'), hint.get('fade_out')) if 'fade' in hint \
            else envelope(rng, n)
        if 'curve' in hint:                        # a gain shape across the layer, in dB
            env = env * 10 ** (curve_at(n, hint['curve']) / 20)
        g = env * 10 ** (amp_db / 20)

        if channels == 2:
            base = float(hint['pan']) if 'pan' in hint else \
                float(np.clip(0.5 + (v.home - 0.5) * pan_w(pos) + (pan_c(pos) - 0.5) * 0.6, 0, 1))
            if n > 2 * SR and rng.random() < 0.4:
                p, kp = drift(rng, n, max(0.0, base - 0.25), min(1.0, base + 0.25), per_secs=8.0)
                pdesc = f"pan moving around {base:.2f} ({kp} pts)"
            else:
                p = base
                pdesc = f"pan {base:.2f}"
            left, right = x[:n], x[slip:slip + n]
            if slip:
                pdesc += f", right ear reads {slip} samples ahead"
            add_to_mix(mix, 0, start, left * g * np.cos(p * np.pi / 2))
            add_to_mix(mix, 1, start, right * g * np.sin(p * np.pi / 2))
        else:
            add_to_mix(mix, 0, start, x[:n] * g)
            pdesc = "mono"

        log.append(f"[{li + 1:03d}] t={start / SR:7.1f}s len={n / SR:6.1f}s amp={amp_db:6.1f} dB "
                   f"voice {v.vid} ({SOURCES[v.src][3]}, {how}) {pdesc} | " + " | ".join(steps))
        if progress:
            sys.stderr.write(f"\r  layer {li + 1}/{len(slots)}")
            sys.stderr.flush()
    if progress:
        sys.stderr.write("\n")

    fin = int(min(total * 0.25, SR * log_uniform(rng, 1.0, 8.0)))
    fout = int(min(total * 0.25, SR * log_uniform(rng, 3.0, 20.0)))
    begin, end = "fade in", "fade out"
    if ENDINGS:
        global END_AT
        if rng.random() < 0.6:
            fin, begin = int(0.004 * SR), "cold start"
            pk = float(np.max(np.abs(mix)))
            loud = np.nonzero(np.max(np.abs(mix), axis=0) > pk * 10 ** (-30 / 20))[0] if pk > 0 else []
            if len(loud) and 0 < loud[0] < total * 0.3:         # begin on the first sound, not before it
                first = int(loud[0])
                mix = mix[:, first:].copy()
                if END_AT is not None:
                    END_AT -= first
                begin = f"cold start on the first sound ({first / SR:.1f} s of silence cut)"
        else:                                          # a fade-in worth the name: slow emergence
            fin = int(min(total * 0.3, SR * log_uniform(rng, 6.0, 30.0)))
            begin = "slow fade in"
        end = str(rng.choice(["fade out", "quick fade", "hard stop"], p=[0.4, 0.25, 0.35]))
        global END_PREF
        if END_PREF and rng.random() < 0.75:          # the form's arc suggests how it should end
            end = END_PREF
        END_PREF = None
        if end == "quick fade":
            fout = int(min(total * 0.25, SR * rng.uniform(0.3, 2.5)))
        elif end == "hard stop":
            fout = int(0.008 * SR)
            if END_AT is not None and mix.shape[1] * 0.75 < END_AT < mix.shape[1]:
                mix = mix[:, :int(END_AT)].copy()           # stop on the form's bar line
        END_AT = None
    if fin > 1:
        mix[:, :fin] *= ramp(fin)
    if fout > 1:
        mix[:, -fout:] *= ramp(fout)[::-1]
    log.append(f"track begins: {begin} ({fin / SR:.1f} s); ends: {end} ({fout / SR:.1f} s)"
               if ENDINGS else f"track fades: in {fin / SR:.1f} s, out {fout / SR:.1f} s")
    peak = max(float(mix.max()), float(-mix.min()))
    target_db = float(rng.uniform(-6, -0.5))
    if peak > 0:
        mix *= 10 ** (target_db / 20) / peak
    log.append(f"final peak set to {target_db:.2f} dBFS")
    pool.extend(born)
    return mix, tag, list(voices.values())


def opening_tone(channels, hz, carrier_hz, dur, db, depth=0.5):
    """the opening tone: a carrier at carrier_hz, amplitude-modulated at hz. with both at 1111 Hz
    this is 1111 Hz plus a 2222 Hz partial (the constant term of the modulation is removed)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    car = np.sin(2 * np.pi * carrier_hz * t)
    mod = np.sin(2 * np.pi * hz * t)
    y = car * (1.0 + depth * mod)
    if hz == carrier_hz:
        y -= depth / 2                      # sin^2 has a mean of 1/2: take the offset out exactly
    else:
        y -= np.mean(y)
    y /= np.max(np.abs(y))
    up = np.nonzero((y[:-1] < 0) & (y[1:] >= 0))[0]
    if len(up):
        y = y[up[0] + 1:]                   # begin on an upward zero crossing: abrupt, but no click
    y *= ramp(len(y))[::-1]                 # full level at once, then a slow fade over the whole tone
    y *= 10 ** (db / 20)
    return np.tile(y, (channels, 1)), len(y) // 2


def safe_name(s, limit=90):
    """a title made safe to be a file name on any system (keeps letters of every script)."""
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', ' ', s or '')
    s = re.sub(r'\s+', ' ', s).strip().rstrip('. ')
    return s[:limit].rstrip('. ') or "untitled"


def write_wav24(path, data):
    ch, frames = data.shape
    step = SR * 20
    with wave.open(path, 'wb') as w:
        w.setnchannels(ch)
        w.setsampwidth(3)
        w.setframerate(SR)
        for a in range(0, frames, step):
            blk = np.ascontiguousarray(data[:, a:a + step].T)
            ints = np.clip(np.round(blk * (2 ** 23 - 1)), -(2 ** 23), 2 ** 23 - 1).astype('<i4')
            w.writeframes(ints.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())


def pick_length(rng, lo, hi, median, spread=0.7):
    """a track length: log-normal around `median`, so most tracks are a few minutes long and
    long ones are rare (with the defaults about 1 in 8 runs past 8 minutes), kept within lo..hi."""
    lo, hi = min(lo, hi), max(lo, hi)
    for _ in range(64):
        d = float(median * np.exp(rng.normal(0.0, spread)))
        if lo <= d <= hi:
            return d
    return float(np.clip(median, lo, hi))


def build_file_pool(feeds):
    files = [os.path.abspath(__file__), sys.executable]
    stdlib = os.path.dirname(os.__file__)
    files += sorted(glob.glob(os.path.join(stdlib, '*.py')))
    dlls = os.path.join(sys.base_prefix, 'DLLs')
    if os.path.isdir(dlls):
        files += sorted(glob.glob(os.path.join(dlls, '*')))
    for f in feeds or []:
        if os.path.isdir(f):
            for root, _, names in os.walk(f):
                files += [os.path.join(root, nm) for nm in sorted(names)]
        else:
            files += sorted(glob.glob(f))
    seen = set()
    out = []
    for f in files:
        if f not in seen and os.path.isfile(f):
            try:
                if os.path.getsize(f) >= 64:
                    out.append(f)
                    seen.add(f)
            except OSError:
                pass
    return out


def make_parser(doc=__doc__, default_form='chance'):
    ap = argparse.ArgumentParser(description=doc, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-n', '--count', type=int, default=1, help='number of tracks (default 1)')
    ap.add_argument('-d', '--duration', type=float, default=None, help='fixed track length in seconds')
    ap.add_argument('--min-dur', type=float, default=DEFAULT_MIN_DUR, help='shortest random length (s, default 60)')
    ap.add_argument('--max-dur', type=float, default=DEFAULT_MAX_DUR, help='longest random length (s, default 780)')
    ap.add_argument('--median-dur', type=float, default=210.0,
                    help='typical random length (s, default 210): most tracks land near it, long ones are rare')
    ap.add_argument('--seed', type=int, default=None, help='album seed (default: OS entropy)')
    ap.add_argument('--form', choices=['chance'] + list(FORMS), default=default_form,
                    help=f'how layers are placed (default: {default_form})')
    ap.add_argument('--sources', default=None, help='comma-separated source keys to allow (see --list-sources)')
    ap.add_argument('--feed', action='append', default=[], help='file, glob or folder whose bytes may be heard')
    ap.add_argument('--list-sources', action='store_true')
    ap.add_argument('--tone', action='store_true', help='open the first track with the 1111 Hz tone (off by default)')
    ap.add_argument('--tone-hz', type=float, default=1111.0, help='opening tone frequency (default 1111)')
    ap.add_argument('--carrier-hz', type=float, default=1111.0, help='opening tone carrier (default 1111)')
    ap.add_argument('--tone-dur', type=float, default=11.11, help='opening tone length in seconds (default 11.11)')
    ap.add_argument('--tone-db', type=float, default=-12.0, help='opening tone peak level, dBFS (default -12)')
    ap.add_argument('--mono', action='store_true')
    ap.add_argument('-o', '--outdir', default='.')
    return ap


def allowed_sources(ap, args):
    if args.sources:
        keys = [k.strip() for k in args.sources.split(',') if k.strip()]
        bad = [k for k in keys if k not in SOURCE_INDEX]
        if bad:
            ap.error(f"unknown source(s): {', '.join(bad)} (try --list-sources)")
        return [SOURCE_INDEX[k] for k in keys]
    return list(range(len(SOURCES)))


def main():
    ap = make_parser()
    args = ap.parse_args()
    if args.list_sources:
        for key, fn, w, label in SOURCES:
            print(f"  {key:13s} weight {w:3.1f}  {label}")
        return
    run_album(args, allowed_sources(ap, args))


def run_album(args, allowed, suffix="data", title="data album", notes=(),
              creed="every sample below began as data: no oscillators, no wavetables"):
    FILE_POOL[:] = build_file_pool(args.feed)
    album_seed = args.seed if args.seed is not None else int.from_bytes(os.urandom(8), 'big')
    stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')
    album_dir = os.path.join(args.outdir, f"album_{stamp}_{suffix}")
    os.makedirs(album_dir, exist_ok=True)
    channels = 1 if args.mono else 2
    progress = sys.stderr.isatty()
    count = max(1, args.count)
    width = max(2, len(str(count)))

    manifest = [f"{title} {stamp}", f"album seed: {album_seed}", f"{count} track(s)",
                f"sources allowed: {', '.join(SOURCES[i][0] for i in allowed)}",
                f"files that could be heard: {len(FILE_POOL)}", *notes,
                f"reproduce: python {os.path.basename(sys.argv[0])} --seed {album_seed} -n {count}"
                + (f" --sources {args.sources}" if args.sources else "")
                + (f" --form {args.form}" if args.form != 'chance' else "")
                + (" --tone" if args.tone else "")
                + "  (same machine, same files)", ""]
    pool = []
    titles_taken = set()
    total_s = 0.0
    for i in range(count):
        rng = np.random.default_rng([album_seed, i])
        if args.duration:
            duration = float(args.duration)
        else:
            duration = pick_length(rng, args.min_dur, args.max_dur, args.median_dur)
        total_s += duration
        log = [f"album seed: {album_seed}, track {i + 1}",
               f"duration: {duration:.2f} s ({duration / 60:.2f} min)",
               f"channels: {channels}", f"format: {SR} Hz / {BITS}-bit PCM",
               creed]
        print(f"track {i + 1}/{count}: {duration / 60:.2f} min")
        data, tag, voices = make_piece(rng, duration, channels, log, allowed, args.form, pool, i + 1, progress)
        if data.shape[1] != int(duration * SR):           # a hard stop on a bar line shortened it
            total_s += data.shape[1] / SR - duration
            duration = data.shape[1] / SR
            log[1] = f"duration: {duration:.2f} s ({duration / 60:.2f} min)"
        if i == 0 and args.tone and args.tone_dur > 0:
            tone, xf = opening_tone(channels, args.tone_hz, args.carrier_hz, args.tone_dur, args.tone_db)
            L = tone.shape[1]
            joined = np.zeros((channels, L - xf + data.shape[1]))
            joined[:, :L] += tone
            joined[:, L - xf:] += data
            pk = float(np.max(np.abs(joined)))
            if pk > 0.98:
                joined *= 0.98 / pk
            data = joined
            extra = (L - xf) / SR
            duration += extra
            total_s += extra
            log.insert(5, f"opens with a {args.tone_hz:g} Hz tone on a {args.carrier_hz:g} Hz carrier "
                          f"(amplitude modulation), {args.tone_dur:g} s at {args.tone_db:g} dBFS: starts abruptly, "
                          f"fades slowly away, the data entering under its last {xf / SR:.1f} s (the only non-data sound; "
                          f"layer times below are after it)")
            log[1] = f"duration: {duration:.2f} s ({duration / 60:.2f} min) including the opening tone"
        name = None
        if TITLER is not None:
            name = TITLER(np.random.default_rng([album_seed, i, 7]), log, tag, voices, titles_taken)
            titles_taken.add(name)
            log.insert(0, f"title: {name}")
        stem = f"{i + 1:0{width}d} {safe_name(name)}" if name else f"{i + 1:0{width}d}_{tag}"
        base = os.path.join(album_dir, stem)
        write_wav24(base + '.wav', data)
        with open(base + '.score.txt', 'w', encoding='utf-8') as f:
            f.write("\n".join(log) + "\n")
        if name:
            manifest.append(f"{i + 1:0{width}d}  {name}")
        manifest.append(f"{' ' * width if name else f'{i + 1:0{width}d}'}  {duration / 60:5.2f} min  "
                        f"{stem}.wav  ({len(voices)} voices)"
                        + (f", opens with the {args.tone_hz:g} Hz tone" if i == 0 and args.tone else ""))
        for v in voices:
            manifest.append(f"      voice {v.vid}: {SOURCES[v.src][3]}, {v.origin}")
        print(f"  wrote {base}.wav")
        del data
    manifest += ["", f"total: {total_s / 60:.1f} min"]
    with open(os.path.join(album_dir, 'album.txt'), 'w', encoding='utf-8') as f:
        f.write("\n".join(manifest) + "\n")
    print(f"album folder: {album_dir}  ({total_s / 60:.1f} min)")


if __name__ == '__main__':
    main()
