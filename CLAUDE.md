# MiniJeux — contexte pour Claude

Site de petits jeux façon Prizee : pseudo + mot de passe, pièces d'or, roue multiplicatrice, classements par jeu.
Le propriétaire parle français : réponds en français, simplement.

## Architecture

- `server.py` : serveur Python (bibliothèque standard uniquement) = fichiers de `public/` + API JSON sous `/api/`. Base SQLite `donnees/minijeux.db` (non versionnée).
- Toute la logique qui compte pour les points est **côté serveur** (tirage du memory, flotte et IA de la bataille navale, roue, calcul des scores et des pièces). Ne jamais faire confiance à un score envoyé par le navigateur.
- `public/assets/commun.js` : en-tête, compte, bourse, fenêtres (connexion, résultat), fonction `api()`. Chaque page a `<body data-page="...">`.
- Un jeu = une page `public/<jeu>.html` + `public/assets/<jeu>.js` + des routes `/api/<jeu>/...` dans `server.py` qui finissent par `terminer_partie()` (applique le multiplicateur, crédite les pièces, alimente le classement). Ajouter le jeu à l'accueil et aux onglets de `classement.html`.
- HTML/CSS/JS sans framework ni build.

## Vérifications avant de pousser

```
python -m unittest discover tests
python tests/visuel.py captures   # nécessite playwright ; regarder les captures
```
