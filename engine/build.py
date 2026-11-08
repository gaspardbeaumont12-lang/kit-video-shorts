#!/usr/bin/env python3
"""Moteur des shorts : voix off FR (Kokoro + timings mot à mot), timeline Remotion,
bruitages synthétisés, musique originale, mixage -14 LUFS.

Usage : python3 engine/build.py chemin/script.json [--work DOSSIER] [--stems]
Écrit : remotion/src/timeline.json, remotion/src/emoji.json, WORK/mix_music.wav, WORK/mix_nomusic.wav
"""
import argparse, hashlib, json, math, os, re, subprocess, sys
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REMOTION = os.path.join(KIT, "remotion")
TTS_DIR = os.environ.get("TTS_DIR", os.path.join(KIT, "tts"))

# ================================================================== réglages par défaut (rythme validé : ~0,875× du premier test)
VOICE, SPEED = "ff_siwis", 0.98
GAP_FIRST, GAP, HOLD = 0.06, 0.22, 0.15
HOLD_BY_TYPE = {"product_reveal": 0.45}
HOLD_LAST = 0.9

def fail(msg):
    sys.exit(f"\n[ERREUR SCRIPT] {msg}\n")

# ================================================================== utilitaires
def db(x):
    return 10 ** (x / 20)

def norm_word(w):
    w = w.lower().replace("’", "'").strip()
    return re.sub(r"^[^\w€%]+|[^\w€%]+$", "", w)

def word_matches(key, word):
    k, w = norm_word(key), norm_word(word)
    return k == w or w.split("'")[-1] == k

def stereo(x, pan=0.0):
    th = (pan + 1) * math.pi / 4
    return np.stack([x * math.cos(th), x * math.sin(th)], axis=1).astype(np.float32)

def peak_norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return (x / m * peak).astype(np.float32)

def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)

def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)

def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)

def shaped_noise(n, centers, width_oct=0.9, seed=0):
    """Bruit filtré dont la bande suit `centers` (Hz, un par échantillon) — via STFT."""
    rng = np.random.default_rng(seed)
    x = rng.standard_normal(n + 2048)
    f, t, Z = signal.stft(x, fs=SR, nperseg=1024, noverlap=768)
    idx = np.clip((t * SR).astype(int), 0, n - 1)
    c = np.asarray(centers)[idx]
    lf = np.log2(np.maximum(f, 20))[:, None]
    mask = np.exp(-0.5 * ((lf - np.log2(c)[None, :]) / (width_oct / 2)) ** 2)
    _, y = signal.istft(Z * mask, fs=SR, nperseg=1024, noverlap=768)
    return y[:n]

# ================================================================== bruitages (renvoient : stéréo float32, instant du pic en s)
def sfx_whoosh(dur=0.5, lo=300, hi=3800, peak=0.62, pan=0.75, seed=1, big=False):
    n = int(dur * SR); t = np.arange(n) / SR; p = dur * peak
    up = np.clip(t / p, 0, 1); down = np.clip((t - p) / (dur - p), 0, 1)
    centers = np.where(t < p, lo * (hi / lo) ** (up ** 1.5), hi * (lo * 1.5 / hi) ** down)
    x = shaped_noise(n, centers, 1.1 if big else 0.9, seed)
    envl = np.where(t < p, up ** 2.2, np.exp(-down * 5.0))
    x = x * envl
    if big:
        sub = np.sin(2 * np.pi * np.cumsum(np.where(t < p, 60 + 40 * up, 90 - 50 * down)) / SR) * envl * 0.6
        x = x / (np.max(np.abs(x)) + 1e-9) + sub
    th = np.linspace(-pan, pan, n)
    y = np.stack([x * np.cos((th + 1) * np.pi / 4), x * np.sin((th + 1) * np.pi / 4)], axis=1)
    return peak_norm(y), p

def sfx_swoosh(seed=3, pan=0.6):
    return sfx_whoosh(0.26, 1400, 7000, 0.55, pan, seed)

def sfx_pop(pitch=1.0):
    n = int(0.13 * SR); t = np.arange(n) / SR
    f = 180 * pitch + (560 * pitch - 180 * pitch) * np.exp(-t / 0.012)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * np.minimum(t / 0.0015, 1)
    click = hp(np.random.default_rng(7).standard_normal(n), 2500) * np.exp(-t / 0.002) * 0.35
    return stereo(peak_norm(x + click)), 0.004

def sfx_tick(pitch=1.0, seed=0):
    n = int(0.03 * SR); t = np.arange(n) / SR
    x = hp(np.random.default_rng(seed).standard_normal(n), 2000) * np.exp(-t / 0.0025)
    x += np.sin(2 * np.pi * 3200 * pitch * t) * np.exp(-t / 0.006) * 0.6
    return stereo(peak_norm(x)), 0.0

def sfx_tick_roll(times):
    """Tics aux instants donnés (s, relatifs) : deux timbres alternés, volume dégressif."""
    total = times[-1] + 0.05 if times else 0.1
    y = np.zeros((int(total * SR) + 2000, 2), np.float32)
    for i, tt in enumerate(times):
        s, _ = sfx_tick(1.0 if i % 2 == 0 else 1.18, seed=i)
        g = 0.9 - 0.35 * (i / max(1, len(times) - 1))
        a = int(tt * SR); y[a:a + len(s)] += s * g
    return y, 0.0

def sfx_impact(seed=11, size=1.0):
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = 48 + 95 * np.exp(-t / 0.05)
    body = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.22 * size)) * 2.2)
    rng = np.random.default_rng(seed)
    thump = lp(rng.standard_normal(n), 900) * np.exp(-t / 0.05) * 0.6
    crack = bp(rng.standard_normal(n), 1200, 5000) * np.exp(-t / 0.012) * 0.5
    x = body + thump + crack
    return peak_norm(np.stack([x, np.roll(x, 40)], axis=1)), 0.004

def sfx_boom(seed=13):
    imp, _ = sfx_impact(seed, size=1.6)
    n = len(imp); t = np.arange(n) / SR
    crash = hp(np.random.default_rng(seed + 1).standard_normal((n, 2)).T, 4500).T * np.exp(-t / 0.45)[:, None] * 0.35
    return peak_norm(imp + crash), 0.004

def sfx_scratch(seed=21):
    rng = np.random.default_rng(seed)
    src_n = int(0.6 * SR); ts = np.arange(src_n) / SR
    src = lp(0.6 * signal.sawtooth(2 * np.pi * 180 * ts) + 0.5 * bp(rng.standard_normal(src_n), 300, 5000), 4000)
    dur = 0.38; n = int(dur * SR); t = np.arange(n) / SR
    speed = np.interp(t, [0, 0.06, 0.15, 0.2, 0.3, dur], [0.2, 2.6, -2.2, -0.4, 1.8, 0.0])
    pos = np.clip(src_n / 3 + np.cumsum(speed), 0, src_n - 2)
    i = pos.astype(int); fr = pos - i
    x = (src[i] * (1 - fr) + src[i + 1] * fr) * np.minimum(np.abs(speed) / 1.2, 1.0) * np.exp(-t / 0.25)
    return stereo(peak_norm(bp(x, 250, 6000))), 0.03

def sfx_marker(dur=0.32, strokes=2, seed=31):
    n = int(dur * SR); t = np.arange(n) / SR
    x = bp(np.random.default_rng(seed).standard_normal(n), 1800, 6500)
    sq = np.sin(2 * np.pi * (2700 + 120 * np.sin(2 * np.pi * 9 * t)) * t) * 0.18
    e = np.zeros(n); seg = dur / strokes
    for k in range(strokes):
        a, b = int(k * seg * SR), int((k * seg + seg * 0.82) * SR)
        e[a:b] = np.sin(np.linspace(0, np.pi, b - a)) ** 0.6
    return stereo(peak_norm((x + sq) * e), 0.15), 0.02

def sfx_check(seed=33):
    m, _ = sfx_marker(0.13, 1, seed)
    p, _ = sfx_pop(1.25)
    y = np.zeros((max(len(m), len(p) + int(0.09 * SR)), 2), np.float32)
    y[:len(m)] += m * 0.8
    a = int(0.09 * SR); y[a:a + len(p)] += p * 0.7
    return peak_norm(y), 0.0

def sfx_ding(f0=1318.5):
    n = int(1.3 * SR); t = np.arange(n) / SR
    def bell(f, start):
        tt = np.clip(t - start, 0, None); on = (t >= start)
        parts = [(1, 1.0, 0.9), (2.0, 0.45, 0.6), (2.76, 0.22, 0.4), (5.4, 0.08, 0.2)]
        return sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt / d) for r, a, d in parts) * on * np.minimum(tt / 0.002, 1)
    x = bell(f0, 0.0) + 0.8 * bell(f0 * 1.5, 0.085)
    return peak_norm(np.stack([x, np.roll(x, 90)], axis=1)), 0.002

def sfx_buzz():
    n = int(0.36 * SR); t = np.arange(n) / SR
    x = signal.square(2 * np.pi * 118 * t) + signal.square(2 * np.pi * 124.5 * t)
    gate = ((t < 0.13) | ((t > 0.18) & (t < 0.33))).astype(float)
    gate = np.convolve(gate, np.ones(200) / 200, mode="same")
    return stereo(peak_norm(lp(x, 1800) * gate)), 0.005

def sfx_riser(dur=1.1, seed=41):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    noise = shaped_noise(n, 400 * (7000 / 400) ** (u ** 1.3), 1.0, seed)
    noise /= np.max(np.abs(noise)) + 1e-9
    tone = np.sin(2 * np.pi * np.cumsum(220 * (1400 / 220) ** u) / SR) * 0.35
    x = (noise * 0.8 + tone) * u ** 2.2
    th = np.linspace(-0.4, 0.4, n)
    y = np.stack([x * np.cos((th + 1) * np.pi / 4), x * np.sin((th + 1) * np.pi / 4)], axis=1)
    return peak_norm(y), dur

def sfx_sparkle(seed=51):
    n = int(0.75 * SR); t = np.arange(n) / SR
    rng = np.random.default_rng(seed); y = np.zeros((n, 2))
    for _ in range(9):
        st = rng.uniform(0, 0.4); f = rng.uniform(2600, 7200); pan = rng.uniform(-0.8, 0.8)
        tt = np.clip(t - st, 0, None)
        y += stereo(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.07) * (t >= st) * rng.uniform(0.4, 1.0), pan)
    y += stereo(hp(rng.standard_normal(n), 7000) * np.exp(-t / 0.25) * 0.15)
    return peak_norm(y), 0.0

def sfx_kaching(seed=61):
    n = int(1.0 * SR); t = np.arange(n) / SR; rng = np.random.default_rng(seed)
    x = np.zeros(n)
    for st in (0.0, 0.055):
        tt = np.clip(t - st, 0, None)
        x += bp(rng.standard_normal(n), 2000, 7000) * np.exp(-tt / 0.008) * (t >= st) * 0.7
    for f, a in ((2093, 1.0), (2637, 0.8), (3136, 0.5)):
        tt = np.clip(t - 0.09, 0, None)
        x += a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.35) * (t >= 0.09) * 0.5
    tt = np.clip(t - 0.17, 0, None)
    x += lp(rng.standard_normal(n), 350) * np.exp(-tt / 0.03) * (t >= 0.17) * 0.8
    return stereo(peak_norm(x)), 0.0

def sfx_alarm(dur=0.7):
    n = int(dur * SR); t = np.arange(n) / SR
    strike = (np.sin(2 * np.pi * 22 * t) > 0).astype(float)
    hammer = np.abs(np.sin(2 * np.pi * 11 * t)) ** 6
    x = (np.sin(2 * np.pi * 2650 * t) * strike + np.sin(2 * np.pi * 3150 * t) * (1 - strike)) * (0.4 + 0.6 * hammer)
    x *= np.minimum(t / 0.02, 1) * np.minimum((dur - t) / 0.12, 1)
    return stereo(peak_norm(x)), 0.0

def sfx_pop_roll(n, spacing):
    total = (n - 1) * spacing + 0.15
    y = np.zeros((int(total * SR) + 100, 2), np.float32)
    for i in range(n):
        s, _ = sfx_pop(0.9 + 0.7 * i / max(1, n - 1))
        a = int(i * spacing * SR); y[a:a + len(s)] += s * (0.85 if i % 2 else 1.0)
    return peak_norm(y), 0.004

def sfx_swoosh_x3():
    y = np.zeros((int(0.6 * SR), 2), np.float32)
    for i, (st, g) in enumerate(((0.0, 1.0), (0.13, 0.75), (0.26, 0.55))):
        s, _ = sfx_swoosh(seed=5 + i, pan=0.6 if i % 2 == 0 else -0.6)
        a = int(st * SR); y[a:a + len(s)] += s * g
    return peak_norm(y), 0.14

SFX = {
    "whoosh": lambda c: sfx_whoosh(seed=c.get("seed", 1)),
    "whoosh_big": lambda c: sfx_whoosh(0.8, 120, 2600, 0.7, 0.5, c.get("seed", 2), big=True),
    "swoosh": lambda c: sfx_swoosh(seed=c.get("seed", 3)),
    "swoosh_x3": lambda c: sfx_swoosh_x3(),
    "pop": lambda c: sfx_pop(c.get("pitch", 1.0)),
    "tick": lambda c: sfx_tick(),
    "impact": lambda c: sfx_impact(seed=c.get("seed", 11)),
    "boom": lambda c: sfx_boom(),
    "scratch": lambda c: sfx_scratch(),
    "marker": lambda c: sfx_marker(),
    "check": lambda c: sfx_check(),
    "ding": lambda c: sfx_ding(c.get("f0", 1318.5)),
    "buzz": lambda c: sfx_buzz(),
    "riser": lambda c: sfx_riser(c.get("dur", 1.1)),
    "sparkle": lambda c: sfx_sparkle(),
    "kaching": lambda c: sfx_kaching(),
    "alarm": lambda c: sfx_alarm(),
    "pop_roll": lambda c: sfx_pop_roll(c.get("n", 4), c.get("spacing", 0.07)),
}
SFX_BASE_DB = -7.0  # crête d'un bruitage à vol = 1.0, avant normalisation finale

# ================================================================== catalogue des scènes : repères obligatoires + sons par défaut
def _n_lines(sc): return len(sc.get("params", {}).get("lines", []))
def _n_msgs(sc): return len(sc.get("params", {}).get("messages", []))
def _n_items(sc): return len(sc.get("params", {}).get("items", []))

SCENE_TYPES = {
    "hook_counter": {"required": lambda sc: ["count_end"], "params": ["count_to", "label"],
                     "defaults": {"_start": {"sfx": "boom", "vol": 0.9, "impact": 26},
                                  "count_end": {"sfx": "impact", "vol": 0.75, "impact": 18, "punch": 0.07},
                                  "alarm": {"sfx": "alarm", "vol": 0.45}}},
    "hook_title": {"required": lambda sc: [f"l{i}" for i in range(1, _n_lines(sc))], "params": ["lines"],
                   "defaults": {"_start": {"sfx": "boom", "vol": 0.9, "impact": 24},
                                **{f"l{i}": {"sfx": "impact", "vol": 0.55, "impact": 10, "punch": 0.04, "seed": 11 + i} for i in range(1, 5)},
                                "emoji": {"sfx": "pop", "vol": 0.7}}},
    "quote": {"required": lambda sc: [f"m{i}" for i in range(1, _n_msgs(sc) + 1)], "params": ["messages"],
              "defaults": {**{f"m{i}": {"sfx": "pop", "pitch": 1.5 - 0.1 * i, "vol": 0.6} for i in range(1, 6)},
                           "header": {"sfx": "pop", "vol": 0.5}}},
    "cross_list": {"required": lambda sc: ["list", "cross"], "params": ["items"],
                   "defaults": {"_start": {"sfx": "scratch", "vol": 0.8, "flash": 0.35},
                                "header": {"sfx": "pop", "vol": 0.55},
                                "list": {"sfx": "pop_roll", "spacing": 0.07, "vol": 0.5},
                                "cross": {"sfx": "impact", "vol": 0.85, "impact": 22, "punch": 0.08, "marker": True}}},
    "big_number": {"required": lambda sc: ["number"], "params": ["number"],
                   "defaults": {"number": {"sfx": "impact", "vol": 0.7, "impact": 14, "punch": 0.06},
                                "badges": {"sfx": "pop_roll", "spacing": 0.09, "vol": 0.55}}},
    "sort_bins": {"required": lambda sc: ["header", "left", "right"], "params": ["header", "left", "right", "cards"],
                  "defaults": {"header": {"sfx": "pop", "vol": 0.7, "punch": 0.05},
                               "left": {"sfx": "swoosh_x3", "vol": 0.55, "offset": -0.08},
                               "right": {"sfx": "swoosh_x3", "vol": 0.5, "offset": -0.08}}},
    "calendar": {"required": lambda sc: ["header", "fill"] + (["chip"] if sc["params"].get("chip") else [])
                 + (["special"] if sc["params"].get("special_label") or sc["params"].get("special_emoji") else []),
                 "params": ["header"],
                 "defaults": {"header": {"sfx": "pop", "vol": 0.65}, "chip": {"sfx": "pop", "pitch": 1.3, "vol": 0.55},
                              "fill": {"sfx": "pop_roll", "n": 12, "spacing": 0.055, "vol": 0.42},
                              "special": {"sfx": "ding", "vol": 0.55, "punch": 0.06}}},
    "versus": {"required": lambda sc: ["header", "bad", "good"] + (["meter", "meter_full"] if sc["params"].get("meter") else []),
               "params": ["header", "bad", "good"],
               "defaults": {"header": {"sfx": "pop", "vol": 0.65}, "bad": {"sfx": "buzz", "vol": 0.5, "impact": 8},
                            "good": {"sfx": "ding", "vol": 0.55, "punch": 0.05}, "meter_full": {"sfx": "sparkle", "vol": 0.5}}},
    "checklist": {"required": lambda sc: ["header"] + [f"i{i}" for i in range(1, _n_items(sc) + 1)], "params": ["header", "items"],
                  "defaults": {"header": {"sfx": "pop", "vol": 0.65}, **{f"i{i}": {"sfx": "check", "vol": 0.55} for i in range(1, 6)}}},
    "timer": {"required": lambda sc: ["header", "start", "done"] + (["sub"] if sc["params"].get("sub") else []),
              "params": ["header", "from"],
              "defaults": {"header": {"sfx": "pop", "vol": 0.65}, "start": {"sfx": "tick_roll", "until": "done", "vol": 0.4},
                           "done": {"sfx": "ding", "vol": 0.6, "punch": 0.06}, "sub": {"sfx": "pop", "vol": 0.55}}},
    "emoji_focus": {"required": lambda sc: ["emoji", "word"] + (["sub"] if sc["params"].get("sub") else []),
                    "params": ["emoji", "word"],
                    "defaults": {"emoji": {"sfx": "pop", "pitch": 0.8, "vol": 0.7},
                                 "word": {"sfx": "impact", "vol": 0.6, "impact": 10, "punch": 0.05},
                                 "sub": {"sfx": "pop", "vol": 0.5}}},
    "product_reveal": {"required": lambda sc: ["bio", "price"], "params": [],
                       "defaults": {"_pre": {"sfx": "riser", "vol": 0.45, "align": "end"},
                                    "_start": {"sfx": "boom", "vol": 0.85, "impact": 20, "flash": 0.55},
                                    "shine": {"sfx": "sparkle", "vol": 0.4}, "bio": {"sfx": "pop", "vol": 0.6, "punch": 0.05},
                                    "price": {"sfx": "kaching", "vol": 0.6, "impact": 10}}},
    "cta": {"required": lambda sc: ["line1"] + (["line2"] if sc["params"].get("line2") else []), "params": ["line1"],
            "defaults": {"line1": {"sfx": "impact", "vol": 0.7, "impact": 14, "punch": 0.07},
                         "line2": {"sfx": "marker", "vol": 0.55}, "chip": {"sfx": "pop", "vol": 0.55}}},
}
ALIASES = {"order_cross": "cross_list", "three_steps": "big_number", "step_sort": "sort_bins", "step_plan": "calendar", "step_test": "versus"}

# ================================================================== musique originale (variée selon la graine)
def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

PROGS = [
    [(45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])],  # la m – fa – do – sol
    [(48, [55, 60, 64, 67]), (43, [55, 59, 62, 67]), (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65])],  # do – sol – la m – fa
    [(50, [57, 62, 65, 69]), (46, [58, 62, 65, 70]), (41, [57, 60, 65, 69]), (48, [55, 60, 64, 67])],  # ré m – si♭ – fa – do
    [(45, [57, 60, 64, 69]), (43, [55, 59, 62, 67]), (41, [53, 57, 60, 65]), (43, [55, 59, 62, 67])],  # la m – sol – fa – sol
]

def render_music(dur, bpm, seed=0, transpose=0, prog=0):
    rng = np.random.default_rng(seed)
    n = int((dur + 1.0) * SR); out = np.zeros((n, 2))
    beat = 60.0 / bpm; s16 = beat / 4; bar = 4 * beat
    def add(sig, at, pan=0.0, g=1.0):
        a = int(at * SR)
        if a >= n: return
        sig = sig[: n - a]
        out[a:a + len(sig)] += stereo(sig * g, pan) if sig.ndim == 1 else sig * g
    def kick():
        m = int(0.35 * SR); t = np.arange(m) / SR
        x = np.tanh(2.5 * np.sin(2 * np.pi * np.cumsum(50 + 110 * np.exp(-t / 0.035)) / SR) * np.exp(-t / 0.16))
        return x + hp(rng.standard_normal(m), 3000) * np.exp(-t / 0.003) * 0.5
    def snare():
        m = int(0.3 * SR); t = np.arange(m) / SR
        return bp(rng.standard_normal(m), 1200, 7000) * np.exp(-t / 0.07) + 0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    def clap():
        m = int(0.25 * SR); t = np.arange(m) / SR; x = np.zeros(m)
        for d in (0.0, 0.011, 0.022):
            tt = np.clip(t - d, 0, None); x += bp(rng.standard_normal(m), 900, 4000) * np.exp(-tt / 0.012) * (t >= d)
        tt = np.clip(t - 0.022, 0, None)
        return x + bp(rng.standard_normal(m), 900, 4000) * np.exp(-tt / 0.09) * (t >= 0.022) * 0.6
    def hat(open_=False):
        m = int((0.25 if open_ else 0.05) * SR); t = np.arange(m) / SR
        return hp(rng.standard_normal(m), 7500) * np.exp(-t / (0.09 if open_ else 0.012))
    def pluck(notes, length=0.16):
        m = int(length * SR * 1.6); t = np.arange(m) / SR; x = np.zeros(m)
        for note in notes:
            f = midi_hz(note + transpose)
            for det in (-0.06, 0.06):
                x += signal.sawtooth(2 * np.pi * f * (1 + det / 12) * t)
        return lp(x, 2600) * np.exp(-t / length) * np.minimum(t / 0.003, 1) / len(notes)
    def bass(note, length):
        m = int(length * SR); t = np.arange(m) / SR; f = midi_hz(note + transpose)
        x = np.tanh(1.8 * (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)))
        return lp(x * np.minimum(t / 0.004, 1) * np.minimum((length - t) / 0.02, 1), 900)
    P = PROGS[prog % len(PROGS)]
    K, S, Cl = kick(), snare(), clap()
    for b in range(int(math.ceil(dur / bar)) + 1):
        t0 = b * bar; root, chord = P[b % 4]
        for q in range(16):
            tt = t0 + q * s16
            if q in (0, 8) or (q == 7 and b % 2 == 1) or (q == 14 and b % 4 == 3):
                add(K, tt, 0, 0.95)
            if q in (4, 12):
                add(S, tt, 0.05, 0.42); add(Cl, tt, -0.05, 0.5)
            acc = (1.0, 0.45, 0.7, 0.45)[q % 4]
            add(hat(q == 14), tt, 0.35, 0.16 * (1.0 if q == 14 else acc))
            if q % 4 == 2:
                add(pluck(chord), tt, -0.2 if q % 8 == 2 else 0.2, 0.22)
            if q % 2 == 0:
                add(bass(root + (12 if q in (6, 14) else 0), s16 * 1.7), tt, 0, 0.42)
    t = np.arange(n) / SR
    pump = 1 - 0.32 * np.exp(-((t % beat) / beat) * 9) * (np.floor(t / beat) % 2 == 0)
    out *= pump[:, None]
    return out[: int(dur * SR)].astype(np.float32)

def tape_stop(x, start, dur=0.45):
    a = int(start * SR); m = int(dur * SR)
    if a + m + 2 >= len(x): return x
    speed = np.linspace(1, 0, m) ** 1.6
    pos = a + np.cumsum(speed); i = pos.astype(int); fr = pos - i
    y = (x[i] * (1 - fr)[:, None] + x[i + 1] * fr[:, None]) * (np.linspace(1, 0, m) ** 0.5)[:, None]
    x = x.copy(); x[a:a + m] = y; x[a + m:] = 0
    return x

def duck_gain(vo_mono, depth_db=-12.0, thr=0.015, att=0.015, rel=0.22):
    hop = 480; n = len(vo_mono) // hop
    fr = np.abs(vo_mono[: n * hop]).reshape(n, hop).max(axis=1)
    tgt = (fr > thr).astype(float); g = np.zeros(n); s = 0.0
    aa = 1 - math.exp(-hop / SR / att); ar = 1 - math.exp(-hop / SR / rel)
    for k in range(n):
        s += (aa if tgt[k] > s else ar) * (tgt[k] - s); g[k] = s
    gain = np.repeat(db(depth_db * g), hop)
    return np.pad(gain, (0, len(vo_mono) - len(gain)), constant_values=gain[-1] if len(gain) else 1.0)

# ================================================================== voix off
_K = None
def kokoro():
    global _K
    if _K is None:
        from kokoro_onnx import Kokoro
        model = os.path.join(TTS_DIR, "kokoro-v1.0-timed.onnx")
        if not os.path.exists(model):
            fail(f"Modèle de voix introuvable ({model}) : lance d'abord bash setup.sh")
        _K = Kokoro(model, os.path.join(TTS_DIR, "voices-v1.0.bin"))
        if not _K.has_timings:
            fail("Le modèle Kokoro n'expose pas 'duration' : relance bash setup.sh")
    return _K

PUNCT_PH = set(",.;:!?…«»—–-\"()[]")

def tts(text, voice, speed):
    audio, sr, timings = kokoro().create_timed(text, voice=voice, speed=speed, lang="fr-fr")
    groups, cur = [], []
    for t in timings:
        if t.phoneme == " ":
            if cur: groups.append(cur); cur = []
        else:
            cur.append(t)
    if cur: groups.append(cur)
    spans = []
    for g in groups:
        core = [t for t in g if t.phoneme not in PUNCT_PH]
        if core: spans.append((core[0].start, core[-1].end))
    words = [w for w in text.split() if re.search(r"\w", w)]
    if len(spans) != len(words):
        print(f"  [!] alignement approximatif ({len(words)} mots / {len(spans)} groupes) : {text}")
        a = spans[0][0] if spans else 0.0; b = spans[-1][1] if spans else len(audio) / sr
        L = np.cumsum([0] + [len(norm_word(w)) + 1 for w in words]); L = L / L[-1]
        spans = [(a + (b - a) * L[i], a + (b - a) * L[i + 1]) for i in range(len(words))]
    audio48 = signal.resample_poly(audio, SR // sr, 1).astype(np.float32)
    return audio48, [{"say": w, "start": s, "end": e} for w, (s, e) in zip(words, spans)]

# ================================================================== emojis utilisés (Noto, Apache-2.0)
EMOJI_DEFAULTS = ["sparkles", "warning", "check-mark-button", "cross-mark", "crescent-moon", "backhand-index-pointing-up",
                  "alarm-clock", "anxious-face-with-sweat", "graduation-cap", "stopwatch", "backhand-index-pointing-down"]

def collect_emojis(obj, out):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and k.endswith("emoji"): out.add(v)
            else: collect_emojis(v, out)
    elif isinstance(obj, list):
        for v in obj: collect_emojis(v, out)

def export_emojis(S, dst):
    names = set(EMOJI_DEFAULTS)
    for sc in S["scenes"]:
        names |= set(sc.get("emoji", {}).values())
        collect_emojis(sc.get("params", {}), names)
    src_path = os.path.join(REMOTION, "node_modules/@iconify-json/noto/icons.json")
    if not os.path.exists(src_path): fail("node_modules manquant dans remotion/ : lance d'abord bash setup.sh")
    src = json.load(open(src_path))
    out, unknown = {}, []
    for n in sorted(names):
        ic = src["icons"].get(n)
        if ic is None and n in src.get("aliases", {}): ic = src["icons"].get(src["aliases"][n]["parent"])
        if ic is None: unknown.append(n); continue
        out[n] = {"body": ic["body"], "w": ic.get("width", src.get("width", 128)), "h": ic.get("height", src.get("height", 128))}
    if unknown:
        fail("Emoji inconnu : " + ", ".join(unknown) + ". Utilise les noms Noto (ex. fire, brain, alarm-clock) — voir SCENES.md.")
    json.dump(out, open(dst, "w"))

# ================================================================== construction
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--work", default=os.path.join(KIT, "work"))
    ap.add_argument("--stems", action="store_true")
    a = ap.parse_args()
    WORK = a.work; os.makedirs(WORK, exist_ok=True)
    S = json.load(open(a.script, encoding="utf-8"))
    fps = S.get("fps", 30)
    voice, speed = S.get("voice", VOICE), S.get("speed", SPEED)
    seed = int(hashlib.md5(os.path.basename(a.script).encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)

    # ---------- validation
    if not S.get("scenes"): fail("Le script n'a aucune scène.")
    ids = set()
    for i, sc in enumerate(S["scenes"]):
        sc["type"] = ALIASES.get(sc.get("type"), sc.get("type"))
        if sc["type"] not in SCENE_TYPES:
            fail(f"Scène {i + 1} : type inconnu « {sc.get('type')} ». Types possibles : {', '.join(SCENE_TYPES)}")
        sc.setdefault("id", f"s{i + 1}"); sc.setdefault("params", {}); sc.setdefault("cues", [])
        if sc["id"] in ids: fail(f"Deux scènes ont le même id « {sc['id']} ».")
        ids.add(sc["id"])
        if not sc.get("say"): fail(f"Scène {sc['id']} : texte « say » vide.")
        for p in SCENE_TYPES[sc["type"]]["params"]:
            if p not in sc["params"]: fail(f"Scène {sc['id']} ({sc['type']}) : paramètre « {p} » manquant.")
        have = {c.get("id") for c in sc["cues"]}
        miss = [c for c in SCENE_TYPES[sc["type"]]["required"](sc) if c not in have]
        if miss: fail(f"Scène {sc['id']} ({sc['type']}) : repère(s) manquant(s) {miss}. Ajoute-les dans « cues » avec at: \"word:<mot>\".")
    if S["scenes"][0]["type"] not in ("hook_counter", "hook_title", "quote", "emoji_focus", "big_number", "cross_list"):
        print("  [!] La 1re scène n'est pas une scène d'accroche : vérifie que l'image 0 est forte.")

    # ---------- typographie française : espaces insécables avant ? ! : ; et dans « »
    def frtypo(v):
        if isinstance(v, str):
            v = re.sub(r" ([?!:;»])", "\u00a0\\1", v); return re.sub(r"« ", "«\u00a0", v)
        if isinstance(v, list): return [frtypo(x) for x in v]
        if isinstance(v, dict): return {k: (frtypo(x) if not k.endswith("emoji") else x) for k, x in v.items()}
        return v
    for sc in S["scenes"]: sc["params"] = frtypo(sc["params"])
    if "product" in S: S["product"] = frtypo(S["product"])

    # ---------- voix + mots
    scenes = []; t = 0.0; vo_parts = []
    for i, sc in enumerate(S["scenes"]):
        audio, words = tts(sc["say"], voice, speed)
        gap = sc.get("gap_before", GAP_FIRST if i == 0 else GAP)
        last = i == len(S["scenes"]) - 1
        hold = sc.get("hold", HOLD_LAST if last else HOLD_BY_TYPE.get(sc["type"], HOLD))
        start = t; vo_start = t + gap; vo_end = vo_start + len(audio) / SR; end = vo_end + hold
        vo_parts.append((vo_start, audio))
        show = None
        if "show" in sc:
            toks = [w for w in sc["show"].split() if re.search(r"[\w€$%]", w) or w == "_"]
            if len(toks) == len(words): show = toks
            else: print(f"  [!] « show » ignoré pour {sc['id']} ({len(toks)} mots affichés pour {len(words)} mots lus)")
        ws = []
        for k, w in enumerate(words):
            txt = show[k] if show else w["say"]
            if txt == "_" and ws:
                ws[-1]["end"] = vo_start + w["end"]; continue
            ws.append({"say": w["say"], "text": re.sub(r"[,.;:]+$", "", txt), "start": vo_start + w["start"], "end": vo_start + w["end"]})
        for w in ws:
            for key, col in sc.get("colors", {}).items():
                if word_matches(key, w["say"]) or word_matches(key, w["text"]): w["color"] = col
            for key, emo in sc.get("emoji", {}).items():
                if word_matches(key, w["say"]) or word_matches(key, w["text"]): w["emoji"] = emo
        scenes.append({"src": sc, "start": start, "end": end, "vo_start": vo_start, "words": ws})
        print(f"- {sc['id']:10s} {sc['type']:15s} {start:6.2f}→{end:6.2f}s  « {sc['say']} »")
        t = end
    total = t
    byid = {s["src"]["id"]: s for s in scenes}

    def resolve(at, s):
        if at in ("start", None): return s["start"]
        if at == "end": return s["end"]
        if at.startswith("t:"): return s["start"] + float(at[2:])
        if at.startswith("scene:"):
            _, sid, edge = at.split(":")
            if sid not in byid: fail(f"Repère {at!r} : scène « {sid} » inconnue.")
            return byid[sid]["start" if edge == "start" else "end"]
        if at.startswith("word:"):
            parts = at.split(":"); key = parts[1]; edge = parts[2] if len(parts) > 2 else "start"
            occ = 1
            if "#" in key: key, occ = key.split("#")[0], int(key.split("#")[1])
            hits = [w for w in s["words"] if word_matches(key, w["say"]) or word_matches(key, w["text"])]
            if len(hits) < occ:
                fail(f"Scène {s['src']['id']} : mot « {key} » introuvable pour le repère {at!r}. Mots lus : "
                     + " | ".join(w["say"] for w in s["words"]))
            w = hits[occ - 1]
            return w["start"] if edge == "start" else w["end"]
        try: return float(at)
        except ValueError: fail(f"Repère {at!r} illisible.")

    # ---------- repères + bruitages
    sfx_bus = np.zeros((int((total + 2) * SR), 2), np.float32)
    impacts, punches, flashes = [], [], []
    def place(sig, at_s):
        a_ = int(round(at_s * SR))
        if a_ < 0: sig = sig[-a_:]; a_ = 0
        m = min(len(sig), len(sfx_bus) - a_)
        if m > 0: sfx_bus[a_:a_ + m] += sig[:m]
    def fire(spec, tc, s):
        if spec.get("impact"): impacts.append({"frame": round(tc * fps), "amount": spec["impact"]})
        if spec.get("punch"): punches.append({"frame": round(tc * fps), "amount": spec["punch"]})
        if spec.get("flash"): flashes.append({"frame": round(tc * fps), "amount": spec["flash"]})
        name = spec.get("sfx")
        if not name or name == "none": return
        if name == "tick_roll":
            until = resolve(spec["until"], s) if spec.get("until", "").startswith(("word:", "scene:", "t:")) else s["cues"].get(spec.get("until"), tc + 1.0)
            dur = max(0.2, until - tc)
            nt = max(4, int(dur / 0.11)); ticks = [dur * k / nt for k in range(nt)]
            sig, pk = sfx_tick_roll(ticks)
        elif name == "pop_roll":
            spec = dict(spec)
            if "n" not in spec:
                p = s["src"]["params"]
                spec["n"] = len(p.get("items", [])) or p.get("badges") or (int(p["number"]) if str(p.get("number", "")).isdigit() and int(p["number"]) <= 6 else 4)
            sig, pk = SFX[name](spec)
        else:
            if name not in SFX: fail(f"Bruitage inconnu « {name} ». Possibles : {', '.join(list(SFX) + ['tick_roll'])}")
            sig, pk = SFX[name](spec)
        align = spec.get("align", "attack")
        off = len(sig) / SR if align == "end" else pk
        place(sig * db(SFX_BASE_DB) * spec.get("vol", 0.7), tc - off)
        if spec.get("marker"):
            m, _ = sfx_marker(); place(m * db(SFX_BASE_DB) * 0.6, tc - 0.12)

    for idx, s in enumerate(scenes):
        sc = s["src"]; T = SCENE_TYPES[sc["type"]]; D = T["defaults"]
        s["cues"] = {}
        for c in sc["cues"]:
            s["cues"][c["id"]] = resolve(c.get("at", "start"), s) + c.get("offset", D.get(c["id"], {}).get("offset", 0.0))
        # transition sonore automatique
        auto = sc.get("auto_whoosh", True) and sc["type"] != "product_reveal"
        if auto and sc.get("enter") in ("whip_left", "whip_right"):
            fire({"sfx": "whoosh", "vol": 0.55, "seed": 1 + idx}, s["start"], s)
        elif auto and sc.get("enter") == "zoom":
            fire({"sfx": "whoosh_big", "vol": 0.65, "seed": 2 + idx}, s["start"], s)
        if "_pre" in D: fire(D["_pre"], s["start"], s)
        if "_start" in D and (sc["type"] != "cross_list" or sc.get("enter") == "cut"): fire(D["_start"], s["start"], s)
        if sc["type"] == "hook_counter":
            end_t = s["cues"]["count_end"]
            dur = max(0.2, end_t - (s["start"] + 0.05))
            p = sc["params"]; steps = max(1, p.get("count_to", 10) - p.get("count_from", 0))
            ticks = [dur * (1 - (1 - (k / steps)) ** 1.6) for k in range(1, steps + 1)]
            s["ticks"] = [round((s["start"] + 0.05 + x) * fps) for x in ticks]
            sig, _ = sfx_tick_roll(ticks); place(sig * db(SFX_BASE_DB) * 0.55, s["start"] + 0.05)
        for c in sc["cues"]:
            spec = {**D.get(c["id"], {}), **{k: v for k, v in c.items() if k not in ("id", "at", "offset")}}
            if spec.get("sfx") == "tick_roll" and spec.get("until") in s["cues"]:
                until_t = s["cues"][spec["until"]]; spec = dict(spec); spec["until"] = f"t:{until_t - s['start']}"
            fire(spec, s["cues"][c["id"]], s)

    # ---------- voix
    vo = np.zeros(len(sfx_bus), np.float32)
    for st, au in vo_parts:
        i = int(round(st * SR)); vo[i:i + len(au)] += au
    vo = peak_norm(vo, db(-3.0))
    vo2 = np.stack([vo, vo], axis=1)

    # ---------- musique (variée selon la vidéo)
    bpm = S.get("bpm", int(rng.integers(102, 117)))
    transpose = int(rng.integers(-3, 4)); prog = int(rng.integers(0, len(PROGS)))
    events = S.get("music")
    if events is None:
        events = [{"event": "start", "at": "0"}]
        for k, sc in enumerate(S["scenes"]):
            if sc["type"] == "cross_list" and sc.get("enter") == "cut" and k + 1 < len(S["scenes"]):
                events += [{"event": "tape_stop", "at": f"scene:{sc['id']}:start"}, {"event": "restart", "at": f"scene:{S['scenes'][k + 1]['id']}:start"}]
                break
        events.append({"event": "fade_out", "at": "end", "dur": 0.6})
    music = np.zeros_like(sfx_bus); evs = []
    for e in events:
        at = e["at"]
        tt = total if at == "end" else (resolve(at, scenes[0]) if at.startswith("scene:") else float(at))
        evs.append((tt, e))
    for k, (tt, e) in enumerate(sorted(evs, key=lambda x: x[0])):
        if e["event"] in ("start", "restart"):
            seg = render_music(total - tt + 0.5, bpm, seed=seed + k, transpose=transpose, prog=prog)
            a_ = int(tt * SR); m = min(len(seg), len(music) - a_)
            music[a_:] = 0; music[a_:a_ + m] = seg[:m]
        elif e["event"] == "tape_stop":
            music = tape_stop(music, tt, e.get("dur", 0.45))
        elif e["event"] == "fade_out":
            d = e.get("dur", 0.6); a_ = int((tt - d) * SR); b_ = int(tt * SR)
            music[a_:b_] *= np.linspace(1, 0, b_ - a_)[:, None]; music[b_:] = 0
    music = music / (np.sqrt(np.mean(music ** 2)) + 1e-9) * db(-21.0)
    music *= duck_gain(vo)[:, None]

    n_end = int((total + 0.05) * SR)
    if a.stems:
        for nm, x in (("stem_vo", vo2), ("stem_music", music), ("stem_sfx", sfx_bus)):
            sf.write(os.path.join(WORK, nm + ".wav"), x[:n_end], SR)
    def master(x, name):
        x = np.tanh(x[:n_end] / db(-1.0)) * db(-1.0)
        raw = os.path.join(WORK, name + "_raw.wav"); sf.write(raw, x, SR)
        dst = os.path.join(WORK, name + ".wav")
        m = subprocess.run(["ffmpeg", "-hide_banner", "-y", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
        js = json.loads(m[m.rfind("{"):m.rfind("}") + 1])
        af = ("loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I={input_i}:measured_TP={input_tp}:"
              "measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}").format(**js)
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", af, "-ar", str(SR), dst], check=True)
        os.remove(raw)
    master(vo2 + music + sfx_bus, "mix_music")
    master(vo2 + sfx_bus, "mix_nomusic")

    # ---------- timeline pour Remotion
    def F(x): return int(round(x * fps))
    allw = [dict(w, scene=s["src"]["id"]) for s in scenes for w in s["words"]]
    pages, cur = [], []
    for i, w in enumerate(allw):
        cur.append(w); nxt = allw[i + 1] if i + 1 < len(allw) else None
        txt = " ".join(x["text"] for x in cur)
        if (nxt is None or len(cur) >= 3 or re.search(r"[,.!?:;…]$", w["say"]) or w.get("emoji")
                or nxt["scene"] != w["scene"] or nxt["start"] - w["end"] > 0.25 or len(txt + " " + nxt["text"]) > 15):
            pages.append(cur); cur = []
    tl_pages = []
    for k, p in enumerate(pages):
        st = p[0]["start"]; nxt_st = pages[k + 1][0]["start"] if k + 1 < len(pages) else total
        tl_pages.append({"from": F(st), "to": F(min(nxt_st, p[-1]["end"] + 0.4)), "words": [
            {"text": w["text"], "from": F(w["start"]), "to": F(w["end"]), "color": w.get("color"), "emoji": w.get("emoji")} for w in p]})
    tl = {"fps": fps, "width": 1080, "height": 1920, "durationInFrames": F(total), "product": S.get("product", {}),
          "impacts": impacts, "punches": punches, "flashes": flashes, "pages": tl_pages, "scenes": []}
    for si, s in enumerate(scenes):
        f0 = F(s["start"])
        f1 = tl["durationInFrames"] if si == len(scenes) - 1 else F(s["end"])
        tl["scenes"].append({
            "id": s["src"]["id"], "type": s["src"]["type"], "from": f0, "durationInFrames": f1 - f0,
            "enter": s["src"].get("enter", "whip_left"), "params": s["src"].get("params", {}), "voFrom": F(s["vo_start"]) - f0,
            "cues": {k: F(v) - f0 for k, v in s["cues"].items()}, "ticks": [x - f0 for x in s.get("ticks", [])],
            "words": [{"text": w["text"], "say": w["say"], "from": F(w["start"]) - f0, "to": F(w["end"]) - f0} for w in s["words"]],
        })
    json.dump(tl, open(os.path.join(REMOTION, "src", "timeline.json"), "w"), ensure_ascii=False, indent=1)
    export_emojis(S, os.path.join(REMOTION, "src", "emoji.json"))
    json.dump({"duration": round(total, 2), "frames": tl["durationInFrames"], "bpm": bpm, "scenes": len(scenes), "pages": len(tl_pages)},
              open(os.path.join(WORK, "build.json"), "w"))
    print(f"Durée : {total:.2f} s ({tl['durationInFrames']} images) — {len(tl_pages)} pages de sous-titres — musique {bpm} BPM")
    if total < 18 or total > 45:
        print(f"  [!] Durée hors cible (18-45 s) : {total:.1f} s")

if __name__ == "__main__":
    main()
