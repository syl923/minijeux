# MiniJeux

Petits jeux gratuits dans le navigateur, façon « salle de jeux » : on joue avec un pseudo, chaque partie rapporte des **pièces d'or**, une **roue de la fortune** multiplie les gains, et chaque jeu a son **classement**.

Jeux disponibles : **Memory** (facile 16 cartes / difficile 36 cartes) et **Bataille navale** contre l'ordinateur.

## Lancer le site en local

Il suffit de Python 3.9 ou plus récent, Windows compris (aucune installation) :

```
python server.py
```

Puis ouvrir http://localhost:8000. Les comptes et scores sont enregistrés dans `donnees/minijeux.db` (SQLite, créé automatiquement, jamais envoyé sur GitHub).

## Tests

```
python -m unittest discover tests     # API : comptes, parties complètes, roue, classements
pip install playwright                # une fois, pour le test visuel
python tests/visuel.py captures       # un robot joue dans Chromium : captures d'écran + vidéo
```

## Règles du jeu (réglables en haut de `server.py`)

| | |
|---|---|
| Inscription | 20 pièces offertes |
| Memory | score = vitesse et peu d'essais ; 2 à 30 pièces |
| Bataille navale | victoire : 10 à 30 pièces selon le nombre de tirs ; défaite : 1 pièce + 1 par navire ennemi coulé |
| Roue | 1 tour gratuit par jour, puis 30 pièces le tour ; multiplicateur x1 à x10 sur les 3 parties suivantes |
| Classements | meilleur score par joueur, cette semaine (depuis lundi) ou depuis toujours ; + classement des pièces gagnées |

## Anti-triche

Le navigateur n'envoie jamais de score : le serveur tire les cartes du memory (la page ne découvre une carte qu'en la retournant), garde la flotte ennemie et joue l'ordinateur à la bataille navale, et tire la roue. Il calcule lui-même scores et pièces.
