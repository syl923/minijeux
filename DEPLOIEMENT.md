# Mettre Moka Arcade en ligne

## En résumé

| Étape | Quoi | Coût indicatif |
|---|---|---|
| 1 | Réserver le nom de domaine **mokaarcade.fr** | ~ 7 à 12 € / an |
| 2 | Ouvrir un hébergement **alwaysdata** (Python + disque permanent + HTTPS automatique) | gratuit pour démarrer, puis quelques € / mois |
| 3 | Installer le site et régler 5 variables | 30 minutes |
| 4 | Brancher le domaine, activer HTTPS | 10 minutes (+ délai DNS) |
| 5 | Compléter les mentions légales, créer l'adresse de contact | 10 minutes |
| 6 | Sauvegarde automatique chaque nuit | 5 minutes |

Les prix et offres changent : vérifie-les sur les sites des fournisseurs au moment de t'inscrire.

## Pourquoi pas Netlify cette fois ?

Netlify (utilisé pour quiditquoi2027) n'héberge que des pages fixes. Moka Arcade a besoin d'un **serveur Python qui tourne
en permanence** (comptes, parties, duels) et d'un **disque qui garde la base de données**. D'où un hébergeur qui accepte Python.

## 1. Le nom de domaine

Nom proposé : **Moka Arcade**, avec la mascotte Moka. Il est court, facile à retenir, et ne ressemble à aucune marque.
Domaines à regarder, par ordre de préférence :

1. `mokaarcade.fr`
2. `moka-arcade.fr`
3. `mokaarcade.com` (utile pour le protéger, en plus du .fr)

Si `mokaarcade.fr` est pris, d'autres idées : `jungle-arcade.fr`, `mokamania.fr`, `arcade-moka.fr`.

Où acheter : OVHcloud ou Gandi (français), ou directement chez alwaysdata (plus simple : tout au même endroit).
Pour un particulier, le .fr **masque automatiquement** ton nom et ton adresse dans l'annuaire public (Whois) : l'anonymat est conservé.

## 2. L'hébergeur : alwaysdata (recommandé)

- Société française, serveurs en France : simple côté RGPD.
- Accepte les programmes Python qui tournent en continu, avec un vrai disque (la base SQLite y est conservée).
- HTTPS gratuit et automatique (Let's Encrypt), sauvegardes quotidiennes incluses.
- Offre gratuite pour tester, puis offre payante quand le site grandit.

Autres possibilités, si besoin :

| Hébergeur | Pour | Contre |
|---|---|---|
| Petit serveur privé (VPS) OVH, Hetzner, Scaleway | Puissant, ~5 € / mois, contrôle total | Il faut tout installer et entretenir soi-même (mises à jour, pare-feu, Caddy pour HTTPS) |
| Railway, Fly.io | Déploiement depuis GitHub | Payants pour garder un disque permanent, serveurs souvent hors de France |
| Render (offre gratuite) | Gratuit | Le disque est effacé à chaque redémarrage : **les comptes seraient perdus**, à éviter |

## 3. Installer le site sur alwaysdata

1. Créer un compte sur alwaysdata.com, puis ouvrir un accès SSH (menu *Accès distant > SSH*).
2. Se connecter en SSH et récupérer le code :
   ```
   git clone https://github.com/syl923/minijeux.git
   mkdir -p ~/donnees
   ```
   (le dépôt peut rester privé : utiliser alors un jeton d'accès GitHub, ou envoyer les fichiers par SFTP.)
3. Menu *Web > Sites > Ajouter un site*, type **Programme utilisateur** :
   - Commande : `python3 /home/<compte>/minijeux/server.py`
   - Répertoire de travail : `/home/<compte>/minijeux`
   - Variables d'environnement :
     ```
     HOST=::
     MINIJEUX_BASE=/home/<compte>/donnees/minijeux.db
     MINIJEUX_HTTPS=1
     MINIJEUX_PROXY=1
     ```
     (alwaysdata fournit lui-même la variable `PORT`. Avec `MINIJEUX_HTTPS=1`, le compte de test toto/toto
     n'est jamais créé ; s'il existe dans une base copiée depuis ton ordinateur, supprime-le avant.)
4. Ouvrir l'adresse provisoire donnée par alwaysdata : le site doit s'afficher.

Mettre à jour le site plus tard : `cd ~/minijeux && git pull`, puis *Redémarrer* le site dans l'interface.

## 4. Brancher le domaine et HTTPS

- Domaine acheté chez alwaysdata : l'ajouter à la liste des adresses du site, c'est tout.
- Domaine acheté ailleurs : chez le vendeur du domaine, faire pointer les serveurs DNS vers ceux d'alwaysdata
  (ou créer les enregistrements indiqués par alwaysdata), puis ajouter l'adresse au site.
- Activer le certificat HTTPS (Let's Encrypt) dans *Web > SSL*. Ajouter aussi `www.mokaarcade.fr`.

## 5. Avant d'ouvrir au public

- [ ] Créer une adresse de contact (ex. `contact@mokaarcade.fr`, possible chez alwaysdata ou chez le vendeur du domaine).
- [ ] Compléter les passages **À COMPLÉTER** (surlignés en jaune) dans `public/mentions-legales.html` et `public/confidentialite.html` :
      adresse du site, adresse de contact, nom, adresse et téléphone de l'hébergeur (à recopier depuis ses propres mentions légales).
- [ ] Transmettre ton identité à l'hébergeur : c'est déjà fait en ouvrant le compte. C'est ce qui te permet de rester anonyme sur le site (LCEN, art. 6-III-2).
- [ ] Créer ton propre compte joueur et faire une partie de chaque jeu en ligne.
- [ ] Tester un duel avec un ami, ou avec une fenêtre de navigation privée.

## 6. Sauvegardes

alwaysdata sauvegarde déjà tout chaque jour. Pour avoir ta propre copie, ajoute une tâche planifiée (*Avancé > Tâches planifiées*) chaque nuit :
```
MINIJEUX_BASE=/home/<compte>/donnees/minijeux.db python3 /home/<compte>/minijeux/scripts/sauvegarde.py /home/<compte>/donnees/sauvegardes
```
Le script garde les 14 dernières copies.

## 7. Publicité Google AdSense (petit test)

Le site est prêt : rien ne s'affiche tant que tu n'as pas renseigné ton identifiant d'éditeur.

1. **Créer le compte** sur https://adsense.google.com avec ton compte Google (particulier). Il faut le site **déjà en ligne sur ton
   propre domaine** (pas l'adresse provisoire d'alwaysdata), avec les pages légales complétées.
2. AdSense te donne un identifiant du type **`pub-1234567890123456`**. Dans alwaysdata, onglet *Sites* → ton site → *Variables
   d'environnement*, ajoute :
   ```
   MINIJEUX_ADSENSE_CLIENT=pub-1234567890123456
   ```
   puis *Redémarrer*. Le serveur ajoute alors tout seul le code Google dans chaque page et publie `/ads.txt`.
3. Dans AdSense : *Sites* → *Ajouter un site* → ton domaine → choisis la vérification **« Extrait de code AdSense »** (il est déjà
   dans les pages) → *Vérifier*. Coche aussi *ads.txt* (déjà servi par le site). La validation par Google prend de quelques jours
   à quelques semaines.
4. **Consentement aux cookies (obligatoire en Europe)** : *Confidentialité et messages* → *RGPD* → *Créer un message* → choisis
   ton site, la langue française, et coche « Gérer les options » + « Ne pas autoriser ». *Publier*. C'est le bandeau certifié de
   Google : il s'affiche avant toute publicité, et le lien « Gérer mes cookies » en bas des pages permet de changer d'avis.
5. **Le petit bloc de pub** : *Annonces* → *Par bloc d'annonces* → *Annonces display* → nomme-le « bas de page », format
   horizontal → *Créer*. Recopie le numéro `data-ad-slot` (par ex. `9876543210`) dans une deuxième variable :
   ```
   MINIJEUX_ADSENSE_EMPLACEMENT=9876543210
   ```
   et redémarre. Le bloc apparaît au-dessus du pied de page, jamais par-dessus un jeu. Sans cette variable, ce sont les
   « annonces automatiques » réglées dans AdSense qui s'affichent (à désactiver si tu veux garder un seul bloc).
6. Laisse **désactivées** les annonces automatiques de type « ancrage » et « vignette » (plein écran) : elles gênent les jeux.

⚠️ À savoir :
- **Revenus** : les gains AdSense se déclarent aux impôts (revenus non commerciaux, micro-BNC). Google envoie un paiement à partir
  de 70 €.
- **Anonymat** : la loi (LCEN) ne permet l'anonymat qu'à un éditeur *non professionnel*. Pour une petite pub de test, ça passe ;
  si ça devient une vraie source de revenus, il faudra publier ton nom (ou créer une micro-entreprise) dans les mentions légales.
- **Règles AdSense** : ne clique jamais sur tes propres annonces et ne demande pas aux joueurs de cliquer (compte fermé sinon).

## Combien de joueurs ?

Le serveur traite les requêtes une à une, en quelques millisecondes chacune : quelques dizaines de joueurs simultanés
(et bien plus d'inscrits) passent sans problème. Au-delà de quelques centaines de joueurs en même temps, il faudra
passer à une installation plus costaude (plusieurs processus, base PostgreSQL) ; on en reparlera si ça arrive.

## À garder en tête pour plus tard

- **Récompenses réelles (cadeaux, lots)** : tant que tout est gratuit et que les bananes n'ont aucune valeur, ce n'est pas un jeu d'argent.
  Si un jour des lots réels sont offerts, il faudra un règlement de jeu-concours (participation gratuite, règles publiées)
  et ne jamais permettre d'acheter des bananes ou des tours de roue. Mieux vaut en parler avant de le faire.
- **Statistiques de visite** : un outil sans cookie (comme GoatCounter, déjà utilisé sur quiditquoi2027) ne demande pas de bandeau ;
  il faudra juste le mentionner dans la page de confidentialité.
