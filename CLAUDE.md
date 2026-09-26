# MiniJeux — contexte pour Claude

Site de petits jeux façon Prizee : pseudo + mot de passe, pièces d'or, roue multiplicatrice, classements par jeu.
Le propriétaire parle français : réponds en français, simplement.

## Architecture

- `server.py` : serveur HTTP (bibliothèque standard uniquement) = fichiers de `public/` + API JSON sous `/api/`.
- `noyau.py` : base SQLite `donnees/minijeux.db` (non versionnée), comptes, mise de 10 pièces, secours, roue, classements.
- `jeux/<jeu>.py` : logique serveur de chaque jeu, exposée par un dictionnaire `ROUTES`.
- Toute la logique qui compte pour les points est **côté serveur** (tirage du memory, flotte et IA de la bataille navale, roue, calcul des scores et des pièces). Ne jamais faire confiance à un score envoyé par le navigateur.
- `public/assets/commun.js` : en-tête, compte, bourse, fenêtres (connexion, résultat), fonction `api()`. Chaque page a `<body data-page="...">`.
- Un jeu = `public/<jeu>.html` (+ `sons.js` et `commun.js`) + `public/assets/<jeu>.js` + `jeux/<jeu>.py`. Le `debut` appelle `nouvelle_partie()` (encaisse la mise), la fin appelle `terminer_partie()` (crédite les pièces, alimente le classement, propose la roue). Côté page, `afficherResultat()` gère la roue et l'animation des pièces. Déclarer le jeu dans `server.py`, `JEUX_CLASSES` (noyau.py) et `JEUX` (commun.js).
- `public/assets/sons.js` : effets sonores et musiques synthétisés (Web Audio), aucun fichier audio.
- HTML/CSS/JS sans framework ni build.

## Vérifications avant de pousser

```
python -m unittest discover tests
MINIJEUX_BASE=/tmp/test.db python server.py          # dans un autre terminal
MINIJEUX_BASE=/tmp/test.db python tests/visuel.py captures [jeu ...]   # playwright ; regarder captures et vidéos
```
