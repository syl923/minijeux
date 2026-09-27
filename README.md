# Moka Arcade

Salle de petits jeux gratuits dans le navigateur, façon sites flash des années 2000, avec Moka le singe comme mascotte.
Mise en ligne : voir **[DEPLOIEMENT.md](DEPLOIEMENT.md)** (hébergeur, nom de domaine, mentions légales, sauvegardes).
On joue avec un pseudo, chaque partie coûte 10 **bananes** et en rapporte selon le résultat, une **roue de la fortune**
multiplie les gains une fois par jour, chaque jeu a son **classement**, et on peut **défier d'autres joueurs en ligne**.

| Jeu | Décor | Principe |
|---|---|---|
| 🥊 Stickman Arena | arène néon | combats de bonshommes bâtons (ZQSD/WASD + souris), armes qui tombent du ciel, manches de 60 s, Moka qui s'en mêle ; solo contre 3 robots ou **duel en ligne** arbitré par le serveur |
| 🚀 Moka Jet | jungle | Moka et son jetpack entre les bambous ; partie rejouée par le serveur (anti-triche) |
| 🏏 Moka Glisse | banquise | Nounours l'ours polaire envoie Moka en doudoune d'un coup de batte (puissance puis angle), vol plané, glissade, obstacles à sauter |
| 🐒 Safari Rush | savane / forêt (jour → nuit) | Moka s'échappe du zoo : course sans fin en perspective, camions du zoo, troncs, rampes, bananes, bonus ; un choc toléré, au second le gardien l'attrape |
| 🍬 Bonbons Folies | bonbons | alignements de 3+, bonbons rayés, emballés, arc-en-ciel, combos ; 20 coups |
| 🧱 Blocomania | arcade | blocs qui tombent, réserve, fantôme, niveaux |
| 🎸 Flipper Néon | futuriste | bumpers, bille en feu, multibille, jackpots, trou mystère, tir d'adresse, musique rock |
| 🐍 Snake | savane | serpent python dans une prairie 15 × 15 |
| 🃏 Memory | magie | contre la montre : 20 s (30 s en difficile), +5 s par paire |
| 💣 Démineur | chantier | bombes farceuses dessinées à la main, sons cartoon |
| ♞ Échecs | bois | contre l'ordinateur (3 niveaux) ou **en ligne** contre un joueur |
| 🚢 Bataille navale | océan | contre l'ordinateur ou **en ligne** contre un joueur |

Moka est la mascotte de tous les jeux : dans chaque page il porte la tenue du jeu (capitaine, professeur, pilote, chef
pâtissier…) et commente la partie dans une bulle (`singes.js` dessine toutes ses variantes en SVG).
**Boutique d'avatars** (`avatars.html`, `avatars.py`) : 40 têtes de singe (dont 3 exclusives à la box mystère),
affichées dans l'en-tête, les classements, les duels et sur les cartes du Memory. **Box mystère** : 250 bananes,
un avatar au hasard jamais en double (commun 45 %, rare 30 %, épique 18 %, légendaire 7 %).

Sons et musiques sont synthétisés dans le navigateur (aucun fichier audio). Bouton 🔊 en haut pour couper le son.
Les noms des jeux sont volontairement originaux (les noms Tetris, Candy Crush, Subway Surfers sont des marques déposées).

## Lancer le site en local

Il suffit de Python 3.9 ou plus récent, Windows compris (aucune installation) :

```
python server.py
```

Puis ouvrir http://localhost:8000. Compte de test prêt à l'emploi : **toto / toto** (remis à 1000 bananes à chaque
démarrage, jamais créé quand `MINIJEUX_HTTPS=1`). Comptes et scores : `donnees/minijeux.db` (SQLite, créé et mis à jour automatiquement).
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
| Inscription | 20 bananes offertes |
| Partie solo | 10 bananes |
| Secours | 20 bananes une fois par jour si on n'a plus de quoi jouer |
| Avatars | de 0 à 1000 bananes selon la rareté (achat vérifié côté serveur) ; box mystère 250 bananes |
| Roue bonus | gratuite après chaque partie : +1 à +10 bananes, ou (2 %) une box mystère gratuite |
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
- Stickman Arena en duel : le serveur fait tourner le combat lui-même (moteur identique à celui de la page) ; les pages
  n'envoient que leurs commandes et affichent une prédiction. En solo : vérification de la durée et de la vraisemblance.
- Flipper, Blocomania, Safari Rush, Moka Glisse (temps réel) : le serveur vérifie que le score est possible pour la durée réellement jouée.

## Publicité

Google AdSense, désactivé par défaut : voir la section 7 de DEPLOIEMENT.md (variables `MINIJEUX_ADSENSE_CLIENT` et
`MINIJEUX_ADSENSE_EMPLACEMENT`, consentement géré par le message RGPD de Google).

## Données personnelles

Pages `mentions-legales.html`, `confidentialite.html`, `cgu.html` (à compléter avant la mise en ligne : voir DEPLOIEMENT.md).
Chaque joueur peut télécharger ses données et supprimer son compte depuis `compte.html` (module `compte.py`).
