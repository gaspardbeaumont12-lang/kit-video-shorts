#!/usr/bin/env bash
# Installe le kit (≈ 2 à 3 min). À lancer une fois par session :  bash setup.sh
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$KIT/tts" "$KIT/work" "$KIT/out"

echo "1/4 Remotion (npm)…"
cd "$KIT/remotion" && npm install --no-audit --no-fund --loglevel=error

echo "2/4 Python (pip)…"
pip install --break-system-packages -q kokoro-onnx soundfile scipy onnx numpy pillow >/dev/null 2>&1 || pip install --break-system-packages kokoro-onnx soundfile scipy onnx numpy pillow

echo "3/4 Voix française (Kokoro)…"
cd "$KIT/tts"
[ -s kokoro-v1.0.onnx ] || curl -fsSL -o kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
[ -s voices-v1.0.bin ] || curl -fsSL -o voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
if [ ! -s kokoro-v1.0-timed.onnx ]; then
python3 - <<'PY'
import onnx
from onnx import helper, TensorProto
m = onnx.load("kokoro-v1.0.onnx")
m.graph.node.append(helper.make_node("Identity", ["/encoder/Gather_output_0"], ["duration"]))
m.graph.output.append(helper.make_tensor_value_info("duration", TensorProto.INT64, ["phonemes"]))
onnx.save(m, "kokoro-v1.0-timed.onnx")
PY
fi
python3 - <<'PY'
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0-timed.onnx", "voices-v1.0.bin")
assert k.has_timings, "modèle sans durées"
a, sr, t = k.create_timed("Test de la voix.", voice="ff_siwis", speed=0.98, lang="fr-fr")
print(f"   voix OK ({len(a)/sr:.1f} s, {len(t)} phonèmes)")
PY

echo "4/4 Navigateur de rendu…"
find_hs() { find /opt /usr /root "$HOME" -type f -name chrome-headless-shell -perm -u+x 2>/dev/null | head -1 || true; }
HS="$(find_hs)"
if [ -z "$HS" ]; then (cd "$KIT/remotion" && npx remotion browser ensure >/dev/null 2>&1 || true); HS="$(find_hs)"; fi
[ -n "$HS" ] || { echo "ERREUR : chrome-headless-shell introuvable (ni installé, ni téléchargeable)."; exit 1; }
echo "HS=\"$HS\"" > "$KIT/.env"
echo "   navigateur : $HS"
echo "PRÊT. Exemple :  bash make_video.sh exemples/rattraper-retard.json out/test"
