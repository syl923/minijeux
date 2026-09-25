"""Serveur de MiniJeux : pages du site + API (comptes, parties, roue, classements).

Python 3, bibliothèque standard uniquement. Lancement :  python server.py
Puis ouvrir http://localhost:8000

Toute la logique des jeux qui compte pour les points (tirage des cartes du memory,
flotte de l'ordinateur à la bataille navale, roue) tourne ici, côté serveur :
le navigateur ne fait qu'afficher. Un joueur ne peut donc pas s'attribuer un score
en trafiquant la page.
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
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

RACINE = os.path.dirname(os.path.abspath(__file__))
DOSSIER_PUBLIC = os.path.join(RACINE, "public")
BASE = os.environ.get("MINIJEUX_BASE", os.path.join(RACINE, "donnees", "minijeux.db"))
PORT = int(os.environ.get("PORT", "8000"))

OR_BIENVENUE = 20
PRIX_TOUR_ROUE = 30
PARTIES_PAR_MULTIPLICATEUR = 3
DUREE_SESSION = 60 * 60 * 24 * 30

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

MEMORY_MODES = {"facile": 8, "difficile": 18}
MEMORY_NB_SYMBOLES = 24  # doit correspondre au nombre d'images dans memory.js

BATAILLE_TAILLE = 10
BATAILLE_FLOTTE = [5, 4, 3, 3, 2]

verrou = threading.Lock()


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


# --------------------------------------------------------------------------- base

def connexion_base():
    os.makedirs(os.path.dirname(BASE), exist_ok=True)
    db = sqlite3.connect(BASE, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS joueurs (
            id INTEGER PRIMARY KEY,
            pseudo TEXT NOT NULL,
            pseudo_min TEXT NOT NULL UNIQUE,
            sel TEXT NOT NULL,
            hash TEXT NOT NULL,
            pieces INTEGER NOT NULL DEFAULT 0,
            pieces_gagnees INTEGER NOT NULL DEFAULT 0,
            mult REAL NOT NULL DEFAULT 1,
            mult_parties INTEGER NOT NULL DEFAULT 0,
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
    return db


db = connexion_base()


class ErreurApi(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def maintenant():
    return time.time()


def debut_semaine():
    """Lundi 0 h (heure de Paris) de la semaine en cours, en horodatage."""
    jour = heure_paris().replace(hour=0, minute=0, second=0, microsecond=0)
    return (jour - timedelta(days=jour.weekday())).timestamp()


def aujourd_hui():
    return heure_paris().strftime("%Y-%m-%d")


# --------------------------------------------------------------------------- comptes

def hacher(mot_de_passe, sel):
    return hashlib.pbkdf2_hmac("sha256", mot_de_passe.encode(), bytes.fromhex(sel), 200_000).hex()


def joueur_public(j):
    tour_gratuit = j["dernier_tour_gratuit"] != aujourd_hui()
    return {
        "pseudo": j["pseudo"],
        "pieces": j["pieces"],
        "mult": j["mult"] if j["mult_parties"] > 0 else 1,
        "mult_parties": j["mult_parties"],
        "tour_gratuit": tour_gratuit,
        "prix_tour": PRIX_TOUR_ROUE,
    }


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


def lire_joueur(joueur_id):
    return db.execute("SELECT * FROM joueurs WHERE id = ?", (joueur_id,)).fetchone()


# --------------------------------------------------------------------------- parties

def nouvelle_partie(joueur, jeu, mode, etat):
    # Une seule partie en cours par jeu : la précédente est abandonnée.
    db.execute(
        "UPDATE parties SET statut = 'abandon' WHERE joueur_id = ? AND jeu = ? AND statut = 'en_cours'",
        (joueur["id"], jeu),
    )
    pid = secrets.token_urlsafe(12)
    db.execute(
        "INSERT INTO parties (id, joueur_id, jeu, mode, etat, debut) VALUES (?, ?, ?, ?, ?, ?)",
        (pid, joueur["id"], jeu, mode, json.dumps(etat), maintenant()),
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


def terminer_partie(joueur, partie, score, pieces_base):
    """Enregistre le résultat, applique le multiplicateur de la roue, crédite les pièces."""
    j = lire_joueur(joueur["id"])
    mult = j["mult"] if j["mult_parties"] > 0 else 1
    pieces = int(round(pieces_base * mult))
    reste = max(0, j["mult_parties"] - 1)
    db.execute(
        "UPDATE joueurs SET pieces = pieces + ?, pieces_gagnees = pieces_gagnees + ?, mult_parties = ?, mult = ? WHERE id = ?",
        (pieces, pieces, reste, mult if reste else 1, j["id"]),
    )
    record = db.execute(
        "SELECT MAX(score) FROM parties WHERE joueur_id = ? AND jeu = ? AND statut = 'terminee'",
        (j["id"], partie["jeu"]),
    ).fetchone()[0]
    db.execute(
        "UPDATE parties SET statut = 'terminee', fin = ?, score = ?, pieces = ? WHERE id = ?",
        (maintenant(), score, pieces, partie["id"]),
    )
    return {
        "score": score,
        "pieces_base": pieces_base,
        "mult": mult,
        "pieces": pieces,
        "record": record is None or score > record,
        "joueur": joueur_public(lire_joueur(j["id"])),
    }


# --------------------------------------------------------------------------- memory

def memory_debut(joueur, donnees):
    mode = donnees.get("mode", "facile")
    if mode not in MEMORY_MODES:
        raise ErreurApi("Mode inconnu.")
    paires = MEMORY_MODES[mode]
    symboles = random.sample(range(MEMORY_NB_SYMBOLES), paires)
    cartes = symboles * 2
    random.shuffle(cartes)
    etat = {"cartes": cartes, "trouvees": [], "attente": None, "coups": 0}
    pid = nouvelle_partie(joueur, "memory", mode, etat)
    return {"partie": pid, "nb_cartes": len(cartes)}


def memory_retourner(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "memory")
    cartes = etat["cartes"]
    try:
        i = int(donnees.get("index"))
    except (TypeError, ValueError):
        raise ErreurApi("Carte invalide.")
    if not 0 <= i < len(cartes) or i in etat["trouvees"] or i == etat["attente"]:
        raise ErreurApi("Carte non retournable.")
    reponse = {"index": i, "symbole": cartes[i]}
    if etat["attente"] is None:
        etat["attente"] = i
    else:
        autre = etat["attente"]
        etat["attente"] = None
        etat["coups"] += 1
        reponse["paire"] = cartes[autre] == cartes[i]
        reponse["autre"] = autre
        if reponse["paire"]:
            etat["trouvees"] += [autre, i]
    reponse["coups"] = etat["coups"]
    sauver_etat(partie["id"], etat)
    if len(etat["trouvees"]) == len(cartes):
        paires = len(cartes) // 2
        secondes = int(maintenant() - partie["debut"])
        erreurs = etat["coups"] - paires
        score = max(paires * 20, paires * 100 - erreurs * 15 - secondes * 3)
        pieces_base = max(2, score // 60)
        reponse["fin"] = terminer_partie(joueur, partie, score, pieces_base)
        reponse["fin"].update(secondes=secondes, coups=etat["coups"])
    return reponse


# --------------------------------------------------------------------------- bataille navale

def cases_bateau(b):
    return [(b["x"] + (0 if b["vertical"] else k), b["y"] + (k if b["vertical"] else 0)) for k in range(b["taille"])]


def placement_ok(flotte):
    """Bateaux dans la grille, sans chevauchement ni contact (même en diagonale)."""
    occupees = {}
    for n, b in enumerate(flotte):
        for x, y in cases_bateau(b):
            if not (0 <= x < BATAILLE_TAILLE and 0 <= y < BATAILLE_TAILLE):
                return False
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if occupees.get((x + dx, y + dy), n) != n:
                        return False
            occupees[(x, y)] = n
    return True


def flotte_valide(flotte):
    return sorted(b["taille"] for b in flotte) == sorted(BATAILLE_FLOTTE) and placement_ok(flotte)


def flotte_aleatoire():
    while True:
        flotte = []
        for taille in BATAILLE_FLOTTE:
            for _ in range(200):
                b = {"taille": taille, "vertical": random.random() < 0.5,
                     "x": random.randrange(BATAILLE_TAILLE), "y": random.randrange(BATAILLE_TAILLE)}
                if placement_ok(flotte + [b]):
                    flotte.append(b)
                    break
            else:
                break  # coincé : on recommence tout
        if len(flotte) == len(BATAILLE_FLOTTE):
            return flotte


def lire_flotte(brute):
    try:
        flotte = [
            {"x": int(b["x"]), "y": int(b["y"]), "taille": int(b["taille"]), "vertical": bool(b["vertical"])}
            for b in brute
        ]
    except (TypeError, KeyError, ValueError):
        raise ErreurApi("Flotte invalide.")
    if not flotte_valide(flotte):
        raise ErreurApi("Flotte invalide : bateaux hors grille, qui se chevauchent ou se touchent.")
    return flotte


def tirer(flotte, tirs, x, y):
    """Applique un tir sur une flotte. Renvoie (résultat, bateau coulé ou None)."""
    tirs.append([x, y])
    deja = {tuple(t) for t in tirs}
    for b in flotte:
        cases = cases_bateau(b)
        if (x, y) in cases:
            if all(c in deja for c in cases):
                return "coule", b
            return "touche", None
    return "eau", None


def flotte_coulee(flotte, tirs):
    deja = {tuple(t) for t in tirs}
    return all(c in deja for b in flotte for c in cases_bateau(b))


def ia_choisir(etat):
    """Ordinateur : vise autour des touches non coulées, sinon tire en damier au hasard."""
    tires = {tuple(t) for t in etat["tirs_ia"]}
    interdites = set(tires)
    for b in etat["coules_ia"]:  # autour d'un bateau coulé, il n'y a rien (règle du non-contact)
        for x, y in cases_bateau(b):
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    interdites.add((x + dx, y + dy))
    touches = [tuple(t) for t in etat["touches_ia"]]
    libre = lambda x, y: 0 <= x < BATAILLE_TAILLE and 0 <= y < BATAILLE_TAILLE and (x, y) not in interdites
    if touches:
        if len(touches) >= 2:
            xs = {t[0] for t in touches}
            ys = {t[1] for t in touches}
            if len(ys) == 1:
                y = touches[0][1]
                candidats = [(min(xs) - 1, y), (max(xs) + 1, y)]
            else:
                x = touches[0][0]
                candidats = [(x, min(ys) - 1), (x, max(ys) + 1)]
        else:
            x, y = touches[0]
            candidats = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        candidats = [c for c in candidats if libre(*c)]
        if candidats:
            return random.choice(candidats)
    cases = [(x, y) for x in range(BATAILLE_TAILLE) for y in range(BATAILLE_TAILLE) if libre(x, y)]
    damier = [c for c in cases if (c[0] + c[1]) % 2 == 0]
    return random.choice(damier or cases)


def bataille_debut(joueur, donnees):
    flotte_joueur = lire_flotte(donnees.get("flotte", []))
    etat = {
        "flotte_joueur": flotte_joueur,
        "flotte_ia": flotte_aleatoire(),
        "tirs_joueur": [],
        "tirs_ia": [],
        "touches_ia": [],
        "coules_ia": [],
    }
    pid = nouvelle_partie(joueur, "bataille", "normal", etat)
    return {"partie": pid}


def bataille_tir(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "bataille")
    try:
        x, y = int(donnees.get("x")), int(donnees.get("y"))
    except (TypeError, ValueError):
        raise ErreurApi("Case invalide.")
    if not (0 <= x < BATAILLE_TAILLE and 0 <= y < BATAILLE_TAILLE) or [x, y] in etat["tirs_joueur"]:
        raise ErreurApi("Case déjà visée ou hors grille.")

    resultat, coule = tirer(etat["flotte_ia"], etat["tirs_joueur"], x, y)
    reponse = {"joueur": {"x": x, "y": y, "resultat": resultat, "coule": coule}}

    if flotte_coulee(etat["flotte_ia"], etat["tirs_joueur"]):
        sauver_etat(partie["id"], etat)
        nb_tirs = len(etat["tirs_joueur"])
        score = max(100, 1000 - (nb_tirs - sum(BATAILLE_FLOTTE)) * 12)
        reponse["fin"] = terminer_partie(joueur, partie, score, 10 + score // 50)
        reponse["fin"].update(victoire=True, tirs=nb_tirs)
        return reponse

    ix, iy = ia_choisir(etat)
    res_ia, coule_ia = tirer(etat["flotte_joueur"], etat["tirs_ia"], ix, iy)
    if res_ia == "touche":
        etat["touches_ia"].append([ix, iy])
    elif res_ia == "coule":
        etat["coules_ia"].append(coule_ia)
        cases = set(cases_bateau(coule_ia))
        etat["touches_ia"] = [t for t in etat["touches_ia"] if tuple(t) not in cases]
    reponse["ia"] = {"x": ix, "y": iy, "resultat": res_ia, "coule": coule_ia}
    sauver_etat(partie["id"], etat)

    if flotte_coulee(etat["flotte_joueur"], etat["tirs_ia"]):
        # Défaite : pas de score au classement, mais une petite récompense par bateau coulé.
        deja = {tuple(t) for t in etat["tirs_joueur"]}
        coules = sum(all(c in deja for c in cases_bateau(b)) for b in etat["flotte_ia"])
        reponse["fin"] = terminer_partie(joueur, partie, 0, 1 + coules)
        reponse["fin"].update(victoire=False, tirs=len(etat["tirs_joueur"]), flotte_ia=etat["flotte_ia"])
    return reponse


# --------------------------------------------------------------------------- roue

def roue_tourner(joueur, donnees):
    j = lire_joueur(joueur["id"])
    gratuit = j["dernier_tour_gratuit"] != aujourd_hui()
    if gratuit:
        db.execute("UPDATE joueurs SET dernier_tour_gratuit = ? WHERE id = ?", (aujourd_hui(), j["id"]))
    else:
        if j["pieces"] < PRIX_TOUR_ROUE:
            raise ErreurApi(f"Il faut {PRIX_TOUR_ROUE} pièces d'or pour relancer la roue.")
        db.execute("UPDATE joueurs SET pieces = pieces - ? WHERE id = ?", (PRIX_TOUR_ROUE, j["id"]))
    secteur = random.choices(range(len(ROUE)), weights=[s["poids"] for s in ROUE])[0]
    mult = ROUE[secteur]["mult"]
    # Le nouveau multiplicateur remplace l'ancien seulement s'il est meilleur ou si l'ancien est épuisé.
    actuel = j["mult"] if j["mult_parties"] > 0 else 1
    if mult >= actuel:
        db.execute(
            "UPDATE joueurs SET mult = ?, mult_parties = ? WHERE id = ?",
            (mult, PARTIES_PAR_MULTIPLICATEUR if mult > 1 else 0, j["id"]),
        )
    return {"secteur": secteur, "mult": mult, "gratuit": gratuit, "joueur": joueur_public(lire_joueur(j["id"]))}


# --------------------------------------------------------------------------- classements

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
    elif jeu in ("memory", "bataille"):
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


def roue_config(joueur, requete):
    return {"secteurs": [s["mult"] for s in ROUE], "prix": PRIX_TOUR_ROUE, "parties": PARTIES_PAR_MULTIPLICATEUR}


# --------------------------------------------------------------------------- HTTP

ROUTES_POST = {
    "/api/memory/debut": memory_debut,
    "/api/memory/retourner": memory_retourner,
    "/api/bataille/debut": bataille_debut,
    "/api/bataille/tir": bataille_tir,
    "/api/roue/tourner": roue_tourner,
}
ROUTES_GET = {"/api/classement": classement, "/api/roue": roue_config}


class Gestionnaire(SimpleHTTPRequestHandler):
    # Types fixés ici : sous Windows, Python les lit dans le registre, parfois faux (.js en text/plain).
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOSSIER_PUBLIC, **kwargs)

    def log_message(self, format, *args):
        if os.environ.get("MINIJEUX_LOG"):
            super().log_message(format, *args)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def jeton(self):
        c = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        return c["session"].value if "session" in c else None

    def repondre(self, code, corps, cookie=None):
        brut = json.dumps(corps, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(brut)))
        if cookie is not None:
            age = DUREE_SESSION if cookie else 0
            self.send_header("Set-Cookie", f"session={cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}")
        self.end_headers()
        self.wfile.write(brut)

    def do_GET(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            return super().do_GET()
        with verrou:
            try:
                joueur = joueur_de_session(self.jeton())
                if url.path == "/api/moi":
                    return self.repondre(200, {"joueur": joueur_public(joueur) if joueur else None})
                if url.path not in ROUTES_GET:
                    raise ErreurApi("Adresse inconnue.", 404)
                return self.repondre(200, ROUTES_GET[url.path](joueur, parse_qs(url.query)))
            except ErreurApi as e:
                return self.repondre(e.code, {"erreur": str(e)})

    def do_POST(self):
        url = urlparse(self.path)
        try:
            taille = min(int(self.headers.get("Content-Length", 0)), 100_000)
            donnees = json.loads(self.rfile.read(taille) or b"{}")
            if not isinstance(donnees, dict):
                raise ValueError
        except ValueError:
            return self.repondre(400, {"erreur": "Requête invalide."})
        with verrou:
            try:
                with db:
                    if url.path in ("/api/inscription", "/api/connexion"):
                        jid = (inscription if url.path == "/api/inscription" else connexion)(donnees)
                        jeton = creer_session(jid)
                        return self.repondre(200, {"joueur": joueur_public(lire_joueur(jid))}, cookie=jeton)
                    if url.path == "/api/deconnexion":
                        db.execute("DELETE FROM sessions WHERE jeton = ?", (self.jeton(),))
                        return self.repondre(200, {"ok": True}, cookie="")
                    if url.path not in ROUTES_POST:
                        raise ErreurApi("Adresse inconnue.", 404)
                    joueur = joueur_de_session(self.jeton())
                    if not joueur:
                        raise ErreurApi("Connecte-toi avec ton pseudo pour jouer.", 401)
                    return self.repondre(200, ROUTES_POST[url.path](joueur, donnees))
            except ErreurApi as e:
                return self.repondre(e.code, {"erreur": str(e)})


if __name__ == "__main__":
    serveur = ThreadingHTTPServer(("0.0.0.0", PORT), Gestionnaire)
    print(f"MiniJeux en ligne sur http://localhost:{PORT}  (Ctrl+C pour arrêter)")
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
