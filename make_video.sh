#!/usr/bin/env bash
# Fabrique UNE vidéo à partir d'un script JSON.
# Usage :  bash make_video.sh scripts/p018-v01.json sortie/p018-v01 [--sans-musique]
# Produit : sortie/p018-v01.mp4 (avec musique), sortie/p018-v01_planche.png (planche de contrôle à regarder)
#           et sortie/p018-v01_qa.json ; avec --sans-musique, aussi sortie/p018-v01_sans_musique.mp4
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ $# -ge 2 ] || { echo "Usage : bash make_video.sh script.json sortie/nom [--sans-musique]"; exit 1; }
SCRIPT="$(realpath "$1")"; OUT="$(realpath -m "$2")"; NOMUSIC="${3:-}"
[ -f "$KIT/.env" ] || { echo "Lance d'abord : bash setup.sh"; exit 1; }
source "$KIT/.env"
mkdir -p "$(dirname "$OUT")" "$KIT/work"
rm -f "$KIT/work/video.mp4"

python3 "$KIT/engine/build.py" "$SCRIPT" --work "$KIT/work"

cd "$KIT/remotion"
npx remotion render src/index.ts Short "$KIT/work/video.mp4" --browser-executable="$HS" --concurrency=2 --muted \
  --crf=27 --x264-preset=medium --log=error 2>&1 | grep -v -E "memory|CGroup|meminfo|docker|lower amount" || true
[ -s "$KIT/work/video.mp4" ] || { echo "ERREUR : le rendu Remotion a échoué (voir les messages ci-dessus)."; exit 1; }

mux() { ffmpeg -v error -y -i "$KIT/work/video.mp4" -i "$1" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$2"; }
mux "$KIT/work/mix_music.wav" "$OUT.mp4"
[ "$NOMUSIC" = "--sans-musique" ] && mux "$KIT/work/mix_nomusic.wav" "${OUT}_sans_musique.mp4"
python3 "$KIT/engine/qa.py" "$OUT.mp4" "$KIT/remotion/src/timeline.json" "$OUT"
