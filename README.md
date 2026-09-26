# MiniJeux

Petits jeux gratuits dans le navigateur, façon « salle de jeux » : on joue avec un pseudo, chaque partie coûte 10 **pièces d'or** et en rapporte selon le résultat, une **roue de la fortune** multiplie les gains une fois par jour, et chaque jeu a son **classement**.

Jeux : **Memory** (contre la montre), **Bataille navale**, **Snake**, **Démineur**, **Échecs** (3 niveaux) et **Flipper**.
Sons et musiques sont synthétisés dans le navigateur (aucun fichier audio). Bouton 🔊 en haut pour couper le son.

## Lancer le site en local

Il suffit de Python 3.9 ou plus récent, Windows compris (aucune installation) :

```
python server.py
```

Puis ouvrir http://localhost:8000. Comptes et scores : `donnees/minijeux.db` (SQLite, créé automatiquement, jamais envoyé sur GitHub).

## Tests

```
python -m unittest discover tests      # API : comptes, économie, les 6 jeux, roue, classements
pip install playwright                 # une fois, pour le test visuel
MINIJEUX_BASE=/tmp/test.db python server.py
MINIJEUX_BASE=/tmp/test.db python tests/visuel.py captures   # un robot joue aux 6 jeux : captures + vidéos
```

## Économie (réglable dans `noyau.py` et `jeux/*.py`)

| | |
|---|---|
| Inscription | 20 pièces offertes |
| Partie | 10 pièces, tous jeux confondus |
| Secours | 20 pièces une fois par jour si on n'a plus de quoi jouer |
| Roue | se lance à la fin de la 1re partie qui rapporte des pièces de la journée ; multiplie les gains de cette partie (x1 à x10) |
| Memory | 20 s au départ, +5 s par paire ; gains selon le temps restant et les erreurs |
| Bataille navale | victoire : 14 à 37 pièces selon le nombre de tirs ; défaite : 2 pièces par navire coulé |
| Snake | 1 pièce par 10 points |
| Démineur | victoire : selon la taille et la vitesse |
| Échecs | victoire : de 15 (facile) à 65 (difficile) pièces ; nulle : un quart |
| Flipper | 1 pièce par 5 000 points (40 max) |

## Anti-triche

Le navigateur n'envoie jamais un score qu'on croirait sur parole :
- Memory, Démineur, Bataille navale, Échecs : tout le jeu se déroule sur le serveur (cartes, bombes, flotte et coups de l'ordinateur), la page ne fait qu'afficher.
- Snake : la page envoie ses changements de direction, le serveur rejoue la partie (même générateur aléatoire des deux côtés) et vérifie la durée.
- Flipper : la physique tourne dans la page, le serveur ne peut que vérifier que le score est plausible pour la durée jouée. C'est le seul jeu où un tricheur déterminé pourrait gonfler son score.
