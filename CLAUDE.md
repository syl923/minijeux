# Moka Arcade (dépôt minijeux) — contexte pour Claude

Site de petits jeux façon salle de jeux flash des années 2000 : pseudo + mot de passe, bananes, roue multiplicatrice,
classements par jeu, duels en ligne (échecs, bataille navale). Mascotte : Moka, singe original (ne pas reprendre la
mascotte ni la marque de Prizee ; noms de jeux originaux, pas de marques déposées).
Le propriétaire parle français : réponds en français, simplement.

## Architecture

- `server.py` : serveur HTTP (bibliothèque standard uniquement) = fichiers de `public/` + API JSON sous `/api/`.
- `noyau.py` : base SQLite `donnees/minijeux.db` (non versionnée), comptes, mise de 10 bananes, secours, roue, classements.
- `jeux/<jeu>.py` : logique serveur de chaque jeu, exposée par un dictionnaire `ROUTES`.
- Toute la logique qui compte pour les points est **côté serveur** (tirage du memory, flotte et IA de la bataille navale, roue, calcul des scores et des bananes). Ne jamais faire confiance à un score envoyé par le navigateur.
- `public/assets/commun.js` : en-tête, compte, bourse, fenêtres (connexion, résultat), fonction `api()`. Chaque page a `<body data-page="...">`.
- Un jeu = `public/<jeu>.html` (+ `sons.js` et `commun.js`) + `public/assets/<jeu>.js` + `jeux/<jeu>.py`. Le `debut` appelle `nouvelle_partie()` (encaisse la mise), la fin appelle `terminer_partie()` (crédite les bananes, alimente le classement, propose la roue). Côté page, `afficherResultat()` gère la roue et l'animation des bananes. Déclarer le jeu dans `server.py`, `JEUX_CLASSES` (noyau.py) et `JEUX` (commun.js).
- `public/assets/sons.js` : effets sonores et musiques synthétisés (Web Audio), aucun fichier audio.
- Thème graphique : chaque jeu déclare un `theme` dans `JEUX` (commun.js) ; le décor correspondant est `.theme-xxx` dans style.css.
- `jeux/duels.py` : duels en ligne (table `duels`), les pages interrogent `/api/duels/etat` toutes les secondes.
- `public/assets/icones.js` : icônes SVG des jeux (`iconeJeu(id)`), à compléter pour tout nouveau jeu.
- `public/assets/singes.js` : générateur SVG de Moka (`singe()`), avatars (`LOOKS_AVATARS`, mêmes identifiants que `avatars.py`), tenues par jeu (`TENUES`), humeurs, `imageTenue()` pour les canvas. `commun.js` ajoute le coach Moka sur chaque page de jeu : `mokaDit(texte, humeur)`.
- `avatars.py` : boutique d'avatars (table `avatars`, colonne `joueurs.avatar`), prix vérifiés côté serveur ; box mystère (`joueurs.boxes` = box gratuites gagnées).
- Roue bonus après chaque partie : `noyau.roue_bonus` (`ROUE_BONUS`, colonne `parties.bonus`), affichée dans `afficherResultat()`.
- Voix de Moka synthétisées dans `sons.js` (`rire`, `taquin`, `pleure`, `cri`) ; `mokaDit()` les joue selon l'humeur.
- Monnaie affichée « bananes » ; dans le code et la base elle s'appelle toujours `pieces`. Les identifiants `runner` (Safari Rush) et `pingouin` (Moka Glisse) sont conservés pour garder les classements.
- `compte.py` : droits RGPD (export des données, changement de mot de passe, suppression du compte).
- Production : variables `HOST`, `PORT`, `MINIJEUX_BASE`, `MINIJEUX_HTTPS=1`, `MINIJEUX_PROXY=1` ; hors HTTPS, le serveur crée le compte de test toto/toto (1000 bananes), sauf si `MINIJEUX_COMPTE_TEST=0` ; plan complet dans DEPLOIEMENT.md.
  Limite anti-force-brute sur connexion/inscription (désactivable en local avec `MINIJEUX_SANS_LIMITE=1`).
- Moka Jet et Snake : la simulation JS et Python doit rester identique au bit près (le serveur rejoue les parties).
- Stickman Arena : moteur `public/assets/arene-sim.js` ⇔ `jeux/arene.py`, identiques (test `test_arene_moteurs_identiques`, via node).
  En duel, le serveur fait tourner le combat en mémoire (`arene.MATCHS`) ; les pages envoient leurs commandes toutes les 50 ms.
- Intros de Moka : `introMoka()` (commun.js) est jouée par `api()` avant chaque requête `/debut` (avant le chrono du serveur).
- Publicité : `MINIJEUX_ADSENSE_CLIENT` / `MINIJEUX_ADSENSE_EMPLACEMENT` ; le serveur injecte le code dans les pages HTML et sert `/ads.txt`.
- Concurrence : un verrou global (`noyau.verrou`) ; un calcul long se fait dans `with sans_verrou():`.
- HTML/CSS/JS sans framework ni build.

## Vérifications avant de pousser

```
python -m unittest discover tests
MINIJEUX_SANS_LIMITE=1 MINIJEUX_BASE=/tmp/test.db python server.py   # dans un autre terminal
MINIJEUX_BASE=/tmp/test.db python tests/visuel.py captures [jeu ...]   # playwright ; regarder captures et vidéos
```
