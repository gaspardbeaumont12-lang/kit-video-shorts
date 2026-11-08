# kit-video-shorts

Moteur de shorts TikTok / Reels (1080×1920, 30 i/s) pour les produits Victor Scale :
voix française de synthèse avec sous-titres mot à mot, animations « cahier d'étudiant » (Remotion),
bruitages et musique générés par le code (libres de droits), mixage à -14 LUFS.

```bash
bash setup.sh                                                   # installe tout (≈ 1 min)
bash make_video.sh exemples/rattraper-retard.json out/test      # ≈ 2,5 min → out/test.mp4 + out/test_planche.png
```

- Écrire une vidéo : lire **SCENES.md** (règles, 14 types de scènes, structures qui marchent, fin « verrouillée » avant le produit).
- `engine/build.py` : voix (Kokoro, voix `ff_siwis`), repères, bruitages, musique, mixage → `remotion/src/timeline.json`.
- `remotion/src/` : les scènes animées. `engine/qa.py` : planche de contrôle + mesures.

Crédits : voix [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx) (Apache-2.0), emojis [Noto Emoji](https://github.com/googlefonts/noto-emoji) (Apache-2.0),
polices Montserrat et Permanent Marker (SIL OFL), rendu [Remotion](https://www.remotion.dev) (licence gratuite pour les particuliers).
