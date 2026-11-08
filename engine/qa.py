#!/usr/bin/env python3
"""Contrôle qualité d'une vidéo terminée.
Usage : python3 engine/qa.py video.mp4 remotion/src/timeline.json prefixe
Écrit prefixe_planche.png (une image au début et vers la fin de chaque scène + 1re et dernière image)
et prefixe_qa.json (durée, loudness, crête, poids, alertes). À REGARDER avant de livrer.
"""
import io, json, os, re, subprocess, sys
from PIL import Image, ImageDraw

mp4, tl_path, prefix = sys.argv[1:4]
tl = json.load(open(tl_path))
fps, n = tl["fps"], tl["durationInFrames"]

frames = {0, n - 2}
for s in tl["scenes"]:
    frames.add(s["from"] + min(14, s["durationInFrames"] // 2))
    frames.add(s["from"] + int(s["durationInFrames"] * 0.85))
frames = sorted(f for f in frames if 0 <= f < n)[:20]

ims = []
for f in frames:
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{f / fps:.3f}", "-i", mp4, "-frames:v", "1", "-vf", "scale=216:-1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGB")
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 64, 20], fill="black"); d.text((4, 4), f"{f / fps:.1f}s", fill="white")
    ims.append(im)
w, h = ims[0].size
cols = 10 if len(ims) > 10 else len(ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows), "white")
for i, im in enumerate(ims):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(prefix + "_planche.png")

log = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
Ls, Ps = re.findall(r"I:\s+(-?[\d.]+) LUFS", log), re.findall(r"Peak:\s+(-?[\d.]+) dBFS", log)
I = float(Ls[-1]) if Ls else None
peak = float(Ps[-1]) if Ps else None
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4], capture_output=True, text=True).stdout)
size_mb = os.path.getsize(mp4) / 1e6
alerts = []
if not 18 <= dur <= 45: alerts.append(f"durée {dur:.1f} s hors de 18-45 s")
if I is None: alerts.append("pas de piste audio")
elif not -15.5 <= I <= -12.5: alerts.append(f"volume {I} LUFS (cible -14)")
if peak is not None and peak > -0.5: alerts.append(f"crête {peak} dBFS trop haute")
if size_mb > 8: alerts.append(f"fichier lourd ({size_mb:.1f} Mo)")
qa = {"video": os.path.basename(mp4), "duree_s": round(dur, 2), "lufs": I, "crete_dbfs": peak, "poids_mo": round(size_mb, 2), "alertes": alerts,
      "planche": os.path.basename(prefix + "_planche.png")}
json.dump(qa, open(prefix + "_qa.json", "w"), ensure_ascii=False, indent=1)
print(f"QA {qa['video']} : {dur:.1f} s, {I} LUFS, crête {peak} dBFS, {size_mb:.1f} Mo" + (" — ALERTES : " + " ; ".join(alerts) if alerts else " — OK"))
print(f"→ Regarde la planche : {prefix}_planche.png")
