# Écrire une vidéo avec le kit (à lire avant chaque série)

Une vidéo = un fichier JSON (`scripts/xxx.json`). Le kit fait tout le reste : voix, sous-titres mot à mot,
animations, bruitages, musique, mixage. Toi, tu écris le texte, tu choisis les scènes et tu cales les repères.

```bash
bash setup.sh                                          # une fois par session (≈ 1 min)
bash make_video.sh scripts/p018-v01.json out/p018-v01  # ≈ 2,5 min par vidéo
# → out/p018-v01.mp4  +  out/p018-v01_planche.png (À REGARDER)  +  out/p018-v01_qa.json
```
Modèles complets et testés : `exemples/rattraper-retard.json` (compteur, liste barrée, 3 étapes) et
`exemples/methode-25-5.json` (phrase choc, messages, minuteur, checklist, emoji).

## 1. Règles d'écriture (les plus importantes)
- **Mots simples** : ceux qu'un élève de 4e comprend sans réfléchir. Pas de jargon (« procrastiner » → « remettre à demain »,
  « optimiser » → « mieux faire », « mémorisation active » → « te poser des questions »).
- **Phrases courtes** : 4 à 10 mots, une idée par phrase, tutoiement, ton d'un pote qui donne un bon plan.
- **Durée** : 25 à 35 s, 6 à 9 scènes, une seule idée forte par vidéo, avec une vraie valeur (une astuce utile, pas un mème).
- **Accroche** : la 1re scène est une scène d'accroche (`hook_counter`, `hook_title` ou `quote`) ; son texte est à l'écran dès l'image 0.
- **Le produit** arrive à la fin (`product_reveal`), jamais au début. Tu n'affirmes sur le produit que son titre, son sous-titre et son prix,
  plus ce qui est écrit dans la ligne « Contenu » du catalogue.
- **Garde du mystère** (vidéos « produit ») : donne 1 ou 2 astuces complètes et vraiment utiles, jamais toute la méthode.
  Juste avant `product_reveal`, une scène `locked` montre ce qu'on vient de voir (cases cochées) et ce qui reste à découvrir
  (cases verrouillées 🔒 « ??? »), puis le tampon « DANS LE GUIDE ». Ce qui est verrouillé doit être VRAIMENT dans le produit
  (ligne « Contenu » du catalogue) : jamais de faux secret, jamais de promesse de résultat.
- **Nombres** : dans `say`, en toutes lettres (« vingt-cinq ») ; dans `show`, en chiffres (« 25 »). Même nombre de mots dans `say` et `show`
  (`_` dans `show` = fusionner avec le mot précédent, ex. `"say": "Six euros quatre-vingt-dix."`, `"show": "6,90 € _"`).
- **Prononciation** : écris « planneur » dans `say` (sinon la voix dit « plané ») et « planner » dans `show`. Évite les sigles qui se prononcent mal.
- **Textes à l'écran** (en-têtes, cartes, puces) : 1 à 3 mots, 12 caractères maximum par ligne si possible ; items de checklist ≤ 25 caractères.
- Pas de faux chiffres, pas de faux témoignages, pas de promesse de note, pas de « like / abonne-toi ».

## 2. Format du script
```json
{
 "product": {"title": "…", "subtitle": "guide + planner", "brand": "Victor Scale", "price": "6,90 €", "highlight": "RETARD"},
 "scenes": [
  {"id": "hook", "type": "hook_counter", "enter": "none",
   "say": "T'as trente cours de retard et les partiels arrivent ?",
   "show": "T'as 30 cours de retard et les partiels arrivent ?",
   "params": { … voir le type … },
   "emoji":  {"retard": "anxious-face-with-sweat"},
   "colors": {"retard": "#E63946"},
   "cues": [{"id": "count_end", "at": "word:retard:end"}]}
 ]
}
```
- `enter` (transition d'entrée) : `none` (1re scène), `cut` (coupe sèche, pour un « stop »), `whip_left`, `whip_right`, `zoom`.
  Alterne `whip_left` / `whip_right` ; `zoom` pour les grands moments (chiffre, produit). Le whoosh est ajouté tout seul.
- `emoji` / `colors` : mot lu → emoji Noto ajouté au sous-titre / couleur du mot dans le sous-titre.
  Rouge `#E63946` = problème, vert `#16A34A` = solution, bleu `#2563EB` = chiffre d'étape. 1 emoji au maximum par phrase.
- `cues` (repères) : `{"id": "...", "at": "word:<mot>"}` = au début du mot ; `"word:<mot>:end"` = à la fin du mot ;
  `"word:ça#2"` = 2e fois que le mot est lu ; `"t:1.2"` = 1,2 s après le début de la scène ; `"offset": -0.05` pour décaler.
  Chaque repère déclenche une animation ET son bruitage par défaut (tu peux changer avec `"sfx": "pop"`, `"vol": 0.5`, ou `"sfx": "none"`).
- Option rare : `"gap_before"` (pause avant la scène, défaut 0,22 s), `"hold"` (temps après la voix), `"speed"` global (défaut 0,98).
- Si `build.py` affiche **[ERREUR SCRIPT]**, lis le message (il donne les mots lus de la scène), corrige le JSON et relance.

## 3. Les 14 types de scènes
Chaque scène a un rôle visuel clair. Varie : jamais deux fois le même type d'affilée, et pas plus de 2 fois le même type par vidéo
(sauf `product_reveal` et `cta`, une fois chacune à la fin).

| type | ce qu'on voit | params (★ = obligatoire) | repères (★ = obligatoire) |
|---|---|---|---|
| `hook_counter` | titre en 2 étiquettes + compteur géant qui grimpe + pile de cartes qui tombe | ★`count_to`, ★`label`, `count_from` (≈ 1/3 de count_to), `title` (1-2 lignes), `title_emoji`, `cards` (6-10 mots courts), `suffix` (« % », « h »), `end_emoji`, `alarm_emoji` | ★`count_end` (fin du chiffre lu), `alarm` |
| `hook_title` | phrase choc en 2-4 gros blocs, entière dès l'image 0, chaque bloc « tape » quand il est lu | ★`lines` (2-4 lignes ≤ 11 caractères ; `{"text":…, "color":…}` possible), `emoji` | ★`l1`…`l(n-1)` (mot de chaque ligne suivante), `emoji` |
| `quote` | bulles de messages (POV, ce qu'on se dit) avec « … en train d'écrire » | ★`messages` (2-4 : `{"text", "side": "left"/"right", "emoji"}`, ≤ 40 caractères), `header` (ex. « TOI, LA VEILLE DU PARTIEL : ») | ★`m1`…`mN`, `header` |
| `cross_list` | « ⚠️ STOP » + liste qui arrive + grande croix rouge + tampon | ★`items` (3-5), `header` (défaut « SURTOUT »), `header_emoji`, `stamp` | ★`list`, ★`cross`, `header` |
| `big_number` | disque jaune « ?! » puis gros chiffre tamponné + pastilles numérotées | ★`number`, `word` (« TRUCS », « ERREURS »…), `badges`, `teaser`, `color` | ★`number`, `badges` |
| `sort_bins` | en-tête d'étape + cartes qui volent dans deux bacs | ★`header`, ★`left`, ★`right`, ★`cards` (4-6), `n` (numéro d'étape), `left_emoji`, `right_emoji` | ★`header`, ★`left`, ★`right` |
| `calendar` | en-tête + calendrier qui se remplit + jour spécial | ★`header`, `n`, `chip`, `chip_emoji`, `weeks` (2-5), `skip_weekends`, `special_label`, `special_emoji`, `special_day` | ★`header`, ★`fill`, `chip`, `special` (obligatoires si les params existent) |
| `versus` | mauvaise méthode barrée contre bonne méthode cochée (+ jauge) | ★`header`, ★`bad`, ★`good`, `n`, `bad_emoji`, `good_emoji`, `meter` (mot de la jauge), `meter_emoji` | ★`header`, ★`bad`, ★`good`, `meter` + `meter_full` (si jauge) |
| `checklist` | en-tête + lignes qui arrivent et se cochent | ★`header`, ★`items` (3-5, ≤ 25 caractères), `n`, `header_emoji` | ★`header`, ★`i1`…`iN` |
| `timer` | minuteur rond qui défile jusqu'à 00:00 puis passe au vert | ★`header`, ★`from` (« 25:00 »), `label`, `emoji`, `sub`, `sub_emoji`, `n` | ★`header`, ★`start`, ★`done`, `sub` |
| `emoji_focus` | un emoji géant avec des ondes + un mot surligné + une petite phrase | ★`emoji`, ★`word` (1-3 mots), `sub`, `color` | ★`emoji`, ★`word`, `sub` |
| `locked` | la suite verrouillée : cases cochées ✅ (ce qu'on a vu) + cases 🔒 « ??? » qui tremblent + tampon « DANS LE GUIDE » | ★`items` (2-4 : `{"text", "open": true/false, "blur": true/false}`, ≤ 30 caractères), `header` (ex. « ET LA 3E ? »), `header_emoji`, `stamp` | ★`list`, ★`lock` (mot « guide »), `header` |
| `product_reveal` | montée sonore → boum, couverture en 3D, reflet, macaron prix, « LIEN EN BIO 👆 » | (lit le bloc `product`) `chip` | ★`bio`, ★`price`, `shine` |
| `cta` | « COMMENCE… » + gros mot tamponné + 2e ligne avec un mot raturé + « LIEN EN BIO » | ★`line1`, `line2`, `strike` (mot raturé, défaut le dernier), `top`, `top_emoji`, `line1_emoji`, `chip` | ★`line1`, `line2`, `chip` |

Astuce : place le repère `header` sur le 1er ou 2e mot de la scène pour que l'écran se remplisse tout de suite.

## 4. Structures qui marchent (choisis-en une par vidéo, varie sur la semaine)
Vidéos « produit » : toujours `locked` → `product_reveal` → `cta` à la fin. Vidéos « valeur pure » : pas de `locked` ni de `product_reveal`, et un `cta` dont la pastille est une vraie question.
1. **Problème → 3 étapes, la 3e verrouillée** : `hook_counter` → `cross_list` (cut) → `big_number` (« il y a 3 étapes, je te donne les 2 premières ») → 2 scènes d'étape (`sort_bins` / `calendar` / `versus` / `checklist` / `timer`) → `locked` → `product_reveal` → `cta` (modèle : exemples/rattraper-retard.json).
2. **Erreur à éviter** : `hook_title` (« ARRÊTE DE… ») → `versus` → `emoji_focus` (pourquoi) → `checklist` (le début du comment) → `locked` → `product_reveal` → `cta`.
3. **POV** : `quote` (ce qu'on se dit) → `emoji_focus` → `timer` ou `calendar` (une solution) → `locked` → `product_reveal` → `cta`.
4. **Méthode express** : `hook_title` → `big_number` → `timer` → `checklist` → `emoji_focus` → `product_reveal` → `cta` (modèle : exemples/methode-25-5.json ; ajoute `locked` avant le produit).
5. **Compte à rebours** : `hook_counter` (jours avant l'examen) → `calendar` → `sort_bins` → `locked` → `product_reveal` → `cta`.

## 5. Bruitages disponibles (`"sfx"`)
`whoosh`, `whoosh_big`, `swoosh`, `swoosh_x3`, `pop` (`pitch`), `pop_roll` (`n`, `spacing`), `tick`, `tick_roll` (`until`: id d'un repère),
`impact`, `boom`, `scratch`, `marker`, `check`, `ding`, `buzz`, `riser`, `sparkle`, `kaching`, `alarm`, `lock`, `none`.
Options d'un repère : `impact` (secousse 8-26), `punch` (coup de zoom 0,04-0,08), `flash` (0,3-0,6). Maximum 4 grosses secousses par vidéo.

## 6. Noms d'emojis utiles (Noto)
fire, brain, zzz, alarm-clock, stopwatch, hourglass-not-done, spiral-calendar, books, open-book, notebook, pencil, memo, graduation-cap,
check-mark-button, cross-mark, warning, light-bulb, direct-hit, sparkles, rocket, hundred-points, mobile-phone, laptop, hot-beverage,
anxious-face-with-sweat, face-screaming-in-fear, exploding-head, face-with-spiral-eyes, sleeping-face, smiling-face-with-sunglasses,
backhand-index-pointing-up, backhand-index-pointing-down, crescent-moon, sun, money-bag, red-question-mark, eyes, skull.
Un nom inconnu bloque la fabrication avec un message clair.

## 7. Contrôle avant de livrer (obligatoire)
Ouvre `*_planche.png` et vérifie : image 0 pleine et lisible ; aucun texte coupé ou caché ; rien qui déborde ;
les sous-titres disent la même chose que la voix ; pas de scène vide plus d'une seconde. `*_qa.json` doit être sans alerte
(durée 18-45 s, -14 LUFS, poids < 8 Mo). Sinon : corrige le JSON et relance `make_video.sh`.
