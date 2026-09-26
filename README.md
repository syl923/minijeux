# Moka Arcade

Salle de petits jeux gratuits dans le navigateur, façon sites flash des années 2000, avec Moka le singe comme mascotte.
Mise en ligne : voir **[DEPLOIEMENT.md](DEPLOIEMENT.md)** (hébergeur, nom de domaine, mentions légales, sauvegardes).
On joue avec un pseudo, chaque partie coûte 10 **pièces d'or** et en rapporte selon le résultat, une **roue de la fortune**
multiplie les gains une fois par jour, chaque jeu a son **classement**, et on peut **défier d'autres joueurs en ligne**.

| Jeu | Décor | Principe |
|---|---|---|
| 🚀 Moka Jet | jungle | Moka et son jetpack entre les bambous ; partie rejouée par le serveur (anti-triche) |
| 🐧 Pingu Glisse | banquise | glisser sur des collines enneigées, plonger, s'envoler, fuir la tempête |
| 🛹 Rail Rush | ville (jour → nuit) | course sans fin en perspective : trains, rampes et toits, barrières, pièces, bonus (aimant, jetpack, x2, super-baskets) |
| 🍬 Bonbons Folies | bonbons | alignements de 3+, bonbons rayés, emballés, arc-en-ciel, combos ; 20 coups |
| 🧱 Blocomania | arcade | blocs qui tombent, réserve, fantôme, niveaux |
| 🎸 Flipper Néon | futuriste | bumpers, bille en feu, multibille, jackpots, trou mystère, tir d'adresse, musique rock |
| 🐍 Snake | savane | serpent python dans une prairie 15 × 15 |
| 🃏 Memory | magie | contre la montre : 20 s (30 s en difficile), +5 s par paire |
| 💣 Démineur | chantier | bombes farceuses dessinées à la main, sons cartoon |
| ♞ Échecs | bois | contre l'ordinateur (3 niveaux) ou **en ligne** contre un joueur |
| 🚢 Bataille navale | océan | contre l'ordinateur ou **en ligne** contre un joueur |

Sons et musiques sont synthétisés dans le navigateur (aucun fichier audio). Bouton 🔊 en haut pour couper le son.
Les noms des jeux sont volontairement originaux (les noms Tetris, Candy Crush, Subway Surfers sont des marques déposées).

## Lancer le site en local

Il suffit de Python 3.9 ou plus récent, Windows compris (aucune installation) :

```
python server.py
```

Puis ouvrir http://localhost:8000. Comptes et scores : `donnees/minijeux.db` (SQLite, créé et mis à jour automatiquement).
Pour essayer les duels seul : ouvrir un deuxième navigateur (ou une fenêtre de navigation privée) avec un autre pseudo.

## Tests

```
python -m unittest discover tests      # API : comptes, économie, tous les jeux, duels, roue, classements
pip install playwright                 # une fois, pour le test visuel
MINIJEUX_SANS_LIMITE=1 MINIJEUX_BASE=/tmp/test.db python server.py
MINIJEUX_BASE=/tmp/test.db python tests/visuel.py captures [jeu ...]   # un robot joue à tout : captures + vidéos
```

## Économie (réglable dans `noyau.py`, `jeux/*.py`)

| | |
|---|---|
| Inscription | 20 pièces offertes |
| Partie solo | 10 pièces |
| Secours | 20 pièces une fois par jour si on n'a plus de quoi jouer |
| Roue | à la fin de la 1re partie gagnante du jour : multiplie les gains de cette partie (x1 à x10) |
| Duel en ligne | chacun mise 10, le gagnant reçoit 25 ; nulle = mises rendues ; temps limite par coup |

## Plusieurs joueurs en même temps

Chaque joueur a ses propres parties : personne ne se gêne. Le serveur traite les requêtes une par une (elles durent
quelques millisecondes) ; le seul calcul long, la réflexion de l'ordinateur aux échecs, se fait sans bloquer les autres.
Cela suffit largement pour quelques dizaines de joueurs simultanés. Pour des centaines, il faudrait passer à un
serveur plus costaud (plusieurs processus, base PostgreSQL) : le code est organisé pour que ce soit faisable.

## Anti-triche

- Memory, Démineur, Bonbons Folies, Bataille navale, Échecs, duels : tout se joue sur le serveur, la page ne fait qu'afficher.
- Snake et Moka Jet : la page envoie ses commandes, le serveur rejoue la partie à l'identique et vérifie la durée.
- Flipper, Blocomania, Rail Rush, Pingu Glisse (temps réel) : le serveur vérifie que le score est possible pour la durée réellement jouée.

## Données personnelles

Pages `mentions-legales.html`, `confidentialite.html`, `cgu.html` (à compléter avant la mise en ligne : voir DEPLOIEMENT.md).
Chaque joueur peut télécharger ses données et supprimer son compte depuis `compte.html` (module `compte.py`).
