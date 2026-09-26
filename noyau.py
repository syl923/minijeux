"""Noyau de MiniJeux : base de données, comptes, économie (mise, gains, roue), classements.

Chaque jeu (dossier `jeux/`) s'appuie sur `nouvelle_partie`, `lire_partie`, `sauver_etat`
et `terminer_partie`. Toute la logique qui compte pour les points tourne côté serveur.
"""

import hashlib
import hmac
import json
import os
import random
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

RACINE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("MINIJEUX_BASE", os.path.join(RACINE, "donnees", "minijeux.db"))

OR_BIENVENUE = 20
MISE = 10                 # prix d'une partie, tous jeux confondus
SECOURS = 20              # pièces offertes une fois par jour à un joueur qui n'a plus de quoi jouer
DUREE_SESSION = 60 * 60 * 24 * 30
DELAI_ROUE = 15 * 60      # la roue doit être lancée dans les 15 minutes après la partie

# Roue : l'ordre est celui des secteurs affichés (sens horaire), le poids leur probabilité.
ROUE = [
    {"mult": 1.5, "poids": 15},
    {"mult": 2, "poids": 13},
    {"mult": 1, "poids": 20},
    {"mult": 3, "poids": 14},
    {"mult": 1.5, "poids": 15},
    {"mult": 2, "poids": 13},
    {"mult": 5, "poids": 7},
    {"mult": 10, "poids": 3},
]


# Un seul verrou protège la base : chaque requête est courte (quelques millisecondes).
# Les calculs longs (réflexion de l'ordinateur aux échecs) se font hors verrou, voir sans_verrou().
verrou = threading.Lock()


@contextmanager
def sans_verrou():
    """Libère la base le temps d'un calcul long, pour ne pas faire attendre les autres joueurs."""
    db.commit()
    verrou.release()
    try:
        yield
    finally:
        verrou.acquire()


class ErreurApi(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def maintenant():
    return time.time()


def heure_paris():
    """Heure de Paris. Windows n'a pas toujours la base des fuseaux (module tzdata) :
    on applique alors directement la règle européenne (heure d'été du dernier dimanche
    de mars au dernier dimanche d'octobre, à 1 h UTC)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/Paris"))
    except Exception:
        utc = datetime.now(timezone.utc)

        def dernier_dimanche(mois):
            fin = datetime(utc.year, mois + 1, 1, 1, tzinfo=timezone.utc) - timedelta(days=1)
            return fin - timedelta(days=(fin.weekday() + 1) % 7)

        ete = dernier_dimanche(3) <= utc < dernier_dimanche(10)
        return utc.astimezone(timezone(timedelta(hours=2 if ete else 1)))


def debut_semaine():
    """Lundi 0 h (heure de Paris) de la semaine en cours, en horodatage."""
    jour = heure_paris().replace(hour=0, minute=0, second=0, microsecond=0)
    return (jour - timedelta(days=jour.weekday())).timestamp()


def aujourd_hui():
    return heure_paris().strftime("%Y-%m-%d")


# --------------------------------------------------------------------------- base

def connexion_base():
    os.makedirs(os.path.dirname(BASE), exist_ok=True)
    base = sqlite3.connect(BASE, check_same_thread=False)
    base.row_factory = sqlite3.Row
    base.executescript(
        """
        CREATE TABLE IF NOT EXISTS joueurs (
            id INTEGER PRIMARY KEY,
            pseudo TEXT NOT NULL,
            pseudo_min TEXT NOT NULL UNIQUE,
            sel TEXT NOT NULL,
            hash TEXT NOT NULL,
            pieces INTEGER NOT NULL DEFAULT 0,
            pieces_gagnees INTEGER NOT NULL DEFAULT 0,
            dernier_tour_gratuit TEXT,
            cree_le REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            jeton TEXT PRIMARY KEY,
            joueur_id INTEGER NOT NULL,
            cree_le REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS parties (
            id TEXT PRIMARY KEY,
            joueur_id INTEGER NOT NULL,
            jeu TEXT NOT NULL,
            mode TEXT NOT NULL,
            etat TEXT NOT NULL,
            statut TEXT NOT NULL DEFAULT 'en_cours',
            debut REAL NOT NULL,
            fin REAL,
            score INTEGER,
            pieces INTEGER
        );
        CREATE INDEX IF NOT EXISTS parties_classement ON parties (jeu, statut, fin);
        """
    )
    # Colonnes ajoutées après la première version : on complète les bases existantes.
    for table, colonne in (("joueurs", "dernier_secours TEXT"), ("parties", "mult REAL"), ("parties", "pieces_base INTEGER")):
        try:
            base.execute(f"ALTER TABLE {table} ADD COLUMN {colonne}")
        except sqlite3.OperationalError:
            pass
    return base


db = connexion_base()


# --------------------------------------------------------------------------- comptes

def hacher(mot_de_passe, sel):
    return hashlib.pbkdf2_hmac("sha256", mot_de_passe.encode(), bytes.fromhex(sel), 200_000).hex()


def joueur_public(j):
    return {
        "pseudo": j["pseudo"],
        "pieces": j["pieces"],
        "mise": MISE,
        "tour_gratuit": j["dernier_tour_gratuit"] != aujourd_hui(),
        "secours": j["pieces"] < MISE and j["dernier_secours"] != aujourd_hui(),
    }


def lire_joueur(joueur_id):
    return db.execute("SELECT * FROM joueurs WHERE id = ?", (joueur_id,)).fetchone()


def creer_session(joueur_id):
    jeton = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions VALUES (?, ?, ?)", (jeton, joueur_id, maintenant()))
    return jeton


def inscription(donnees):
    pseudo = str(donnees.get("pseudo", "")).strip()
    mdp = str(donnees.get("mot_de_passe", ""))
    if not re.fullmatch(r"[A-Za-z0-9_\-]{3,16}", pseudo):
        raise ErreurApi("Pseudo : 3 à 16 caractères, lettres, chiffres, - ou _ uniquement.")
    if len(mdp) < 6:
        raise ErreurApi("Mot de passe : 6 caractères minimum.")
    if db.execute("SELECT 1 FROM joueurs WHERE pseudo_min = ?", (pseudo.lower(),)).fetchone():
        raise ErreurApi("Ce pseudo est déjà pris.")
    sel = secrets.token_hex(16)
    cur = db.execute(
        "INSERT INTO joueurs (pseudo, pseudo_min, sel, hash, pieces, cree_le) VALUES (?, ?, ?, ?, ?, ?)",
        (pseudo, pseudo.lower(), sel, hacher(mdp, sel), OR_BIENVENUE, maintenant()),
    )
    return cur.lastrowid


def connexion(donnees):
    pseudo = str(donnees.get("pseudo", "")).strip().lower()
    mdp = str(donnees.get("mot_de_passe", ""))
    j = db.execute("SELECT * FROM joueurs WHERE pseudo_min = ?", (pseudo,)).fetchone()
    if not j or not hmac.compare_digest(hacher(mdp, j["sel"]), j["hash"]):
        raise ErreurApi("Pseudo ou mot de passe incorrect.")
    return j["id"]


def joueur_de_session(jeton):
    if not jeton:
        return None
    return db.execute(
        "SELECT j.* FROM sessions s JOIN joueurs j ON j.id = s.joueur_id WHERE s.jeton = ? AND s.cree_le > ?",
        (jeton, maintenant() - DUREE_SESSION),
    ).fetchone()


def secours(joueur, donnees):
    j = lire_joueur(joueur["id"])
    if not joueur_public(j)["secours"]:
        raise ErreurApi("Les pièces de secours sont réservées aux joueurs à court de pièces, une fois par jour.")
    db.execute("UPDATE joueurs SET pieces = pieces + ?, dernier_secours = ? WHERE id = ?", (SECOURS, aujourd_hui(), j["id"]))
    return {"joueur": joueur_public(lire_joueur(j["id"]))}


# --------------------------------------------------------------------------- parties

def nouvelle_partie(joueur, jeu, mode, etat):
    """Encaisse la mise et ouvre une partie. Une seule partie en cours par jeu."""
    j = lire_joueur(joueur["id"])
    if j["pieces"] < MISE:
        raise ErreurApi(f"Une partie coûte {MISE} pièces d'or : tu n'en as que {j['pieces']}.", 402)
    db.execute("UPDATE joueurs SET pieces = pieces - ? WHERE id = ?", (MISE, j["id"]))
    db.execute(
        "UPDATE parties SET statut = 'abandon' WHERE joueur_id = ? AND jeu = ? AND statut = 'en_cours'",
        (j["id"], jeu),
    )
    pid = secrets.token_urlsafe(12)
    db.execute(
        "INSERT INTO parties (id, joueur_id, jeu, mode, etat, debut) VALUES (?, ?, ?, ?, ?, ?)",
        (pid, j["id"], jeu, mode, json.dumps(etat), maintenant()),
    )
    return pid


def lire_partie(joueur, pid, jeu):
    p = db.execute(
        "SELECT * FROM parties WHERE id = ? AND joueur_id = ? AND jeu = ?", (pid, joueur["id"], jeu)
    ).fetchone()
    if not p:
        raise ErreurApi("Partie introuvable.", 404)
    if p["statut"] != "en_cours":
        raise ErreurApi("Cette partie est terminée.")
    return p, json.loads(p["etat"])


def sauver_etat(pid, etat):
    db.execute("UPDATE parties SET etat = ? WHERE id = ?", (json.dumps(etat), pid))


def terminer_partie(joueur, partie, score, pieces):
    """Enregistre le résultat et crédite les pièces. La roue pourra ensuite les multiplier."""
    pieces = max(0, int(pieces))
    record = db.execute(
        "SELECT MAX(score) FROM parties WHERE joueur_id = ? AND jeu = ? AND statut = 'terminee'",
        (joueur["id"], partie["jeu"]),
    ).fetchone()[0]
    db.execute(
        "UPDATE parties SET statut = 'terminee', fin = ?, score = ?, pieces = ?, pieces_base = ? WHERE id = ?",
        (maintenant(), score, pieces, pieces, partie["id"]),
    )
    db.execute(
        "UPDATE joueurs SET pieces = pieces + ?, pieces_gagnees = pieces_gagnees + ? WHERE id = ?",
        (pieces, pieces, joueur["id"]),
    )
    j = lire_joueur(joueur["id"])
    return {
        "partie": partie["id"],
        "score": score,
        "pieces": pieces,
        "mise": MISE,
        "record": score > 0 and (record is None or score > record),
        "roue": pieces > 0 and joueur_public(j)["tour_gratuit"],
        "joueur": joueur_public(j),
    }


# --------------------------------------------------------------------------- roue

def roue_tourner(joueur, donnees):
    """Tour de roue gratuit du jour : multiplie les pièces d'une partie qui vient de se terminer."""
    j = lire_joueur(joueur["id"])
    if j["dernier_tour_gratuit"] == aujourd_hui():
        raise ErreurApi("Tu as déjà tourné la roue aujourd'hui. Reviens demain !")
    p = db.execute(
        "SELECT * FROM parties WHERE id = ? AND joueur_id = ?", (donnees.get("partie"), j["id"])
    ).fetchone()
    if not p or p["statut"] != "terminee" or p["mult"] is not None or not p["pieces"]:
        raise ErreurApi("La roue se lance à la fin d'une partie qui a rapporté des pièces.")
    if maintenant() - p["fin"] > DELAI_ROUE:
        raise ErreurApi("Trop tard pour lancer la roue sur cette partie.")
    secteur = random.choices(range(len(ROUE)), weights=[s["poids"] for s in ROUE])[0]
    mult = ROUE[secteur]["mult"]
    total = int(round(p["pieces"] * mult))
    bonus = total - p["pieces"]
    db.execute("UPDATE parties SET mult = ?, pieces = ? WHERE id = ?", (mult, total, p["id"]))
    db.execute(
        "UPDATE joueurs SET pieces = pieces + ?, pieces_gagnees = pieces_gagnees + ?, dernier_tour_gratuit = ? WHERE id = ?",
        (bonus, bonus, aujourd_hui(), j["id"]),
    )
    return {"secteur": secteur, "mult": mult, "pieces": total, "bonus": bonus, "joueur": joueur_public(lire_joueur(j["id"]))}


def roue_config(joueur, requete):
    return {"secteurs": [s["mult"] for s in ROUE], "probas": [s["poids"] for s in ROUE]}


# --------------------------------------------------------------------------- classements

JEUX_CLASSES = ("memory", "bataille", "snake", "demineur", "echecs", "flipper", "candy", "tetris", "runner")


def classement(joueur, requete):
    jeu = requete.get("jeu", ["memory"])[0]
    periode = requete.get("periode", ["semaine"])[0]
    depuis = debut_semaine() if periode == "semaine" else 0
    if jeu == "fortune":
        lignes = db.execute(
            """SELECT j.pseudo, SUM(p.pieces) AS valeur, COUNT(*) AS parties
               FROM parties p JOIN joueurs j ON j.id = p.joueur_id
               WHERE p.statut = 'terminee' AND p.fin >= ?
               GROUP BY p.joueur_id HAVING valeur > 0 ORDER BY valeur DESC, MIN(p.fin) LIMIT 50""",
            (depuis,),
        ).fetchall()
    elif jeu in JEUX_CLASSES:
        lignes = db.execute(
            """SELECT j.pseudo, MAX(p.score) AS valeur, COUNT(*) AS parties
               FROM parties p JOIN joueurs j ON j.id = p.joueur_id
               WHERE p.statut = 'terminee' AND p.jeu = ? AND p.fin >= ? AND p.score > 0
               GROUP BY p.joueur_id ORDER BY valeur DESC, MIN(p.fin) LIMIT 50""",
            (jeu, depuis),
        ).fetchall()
    else:
        raise ErreurApi("Classement inconnu.")
    return {"jeu": jeu, "periode": periode, "lignes": [dict(l) for l in lignes]}


def mes_records(joueur, requete):
    if not joueur:
        return {"records": {}}
    lignes = db.execute(
        "SELECT jeu, MAX(score) AS s, COUNT(*) AS n FROM parties WHERE joueur_id = ? AND statut = 'terminee' GROUP BY jeu",
        (joueur["id"],),
    ).fetchall()
    return {"records": {l["jeu"]: {"score": l["s"], "parties": l["n"]} for l in lignes}}
