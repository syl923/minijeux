"""Duels en ligne entre joueurs : échecs et bataille navale.

Chaque joueur mise MISE pièces ; le gagnant empoche GAIN_VICTOIRE, une nulle rend la mise.
Le serveur arbitre tout (coups légaux, flottes cachées) ; les pages interrogent l'état
régulièrement (toutes les secondes). Un joueur qui dépasse le temps limite perd la partie.
"""

import json
import secrets

from jeux import bataille, echecs
from noyau import MISE, ErreurApi, db, joueur_public, lire_joueur, maintenant

GAIN_VICTOIRE = 25
DELAIS = {"echecs": 180, "bataille_placement": 150, "bataille": 60}   # secondes par coup
JEUX_DUEL = ("echecs", "bataille")
EN_LIGNE = 120  # un joueur est « en ligne » s'il a fait une requête dans les 2 dernières minutes

db.executescript(
    """
    CREATE TABLE IF NOT EXISTS duels (
        id TEXT PRIMARY KEY,
        jeu TEXT NOT NULL,
        createur INTEGER NOT NULL,
        adversaire INTEGER,
        invite INTEGER,
        statut TEXT NOT NULL DEFAULT 'attente',
        etat TEXT NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 0,
        gagnant INTEGER,
        raison TEXT,
        cree_le REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS duels_statut ON duels (statut);
    """
)


# --------------------------------------------------------------------------- outils

def pseudo(jid):
    j = lire_joueur(jid) if jid else None
    return j["pseudo"] if j else None


def lire_duel(did):
    d = db.execute("SELECT * FROM duels WHERE id = ?", (did,)).fetchone()
    if not d:
        raise ErreurApi("Duel introuvable.", 404)
    return d


def sauver(d, etat, **champs):
    champs["etat"] = json.dumps(etat)
    sets = ", ".join(f"{k} = ?" for k in champs)
    db.execute(f"UPDATE duels SET {sets}, version = version + 1 WHERE id = ?", (*champs.values(), d["id"]))


def payer(jid):
    j = lire_joueur(jid)
    if j["pieces"] < MISE:
        raise ErreurApi(f"Un duel coûte {MISE} pièces d'or : tu n'en as que {j['pieces']}.", 402)
    db.execute("UPDATE joueurs SET pieces = pieces - ? WHERE id = ?", (MISE, jid))


def crediter(jid, pieces, jeu, victoire):
    """Crédite les pièces et garde une trace dans les parties (classements et pièces gagnées)."""
    db.execute("UPDATE joueurs SET pieces = pieces + ?, pieces_gagnees = pieces_gagnees + ? WHERE id = ?", (pieces, pieces, jid))
    t = maintenant()
    db.execute(
        "INSERT INTO parties (id, joueur_id, jeu, mode, etat, statut, debut, fin, score, pieces, pieces_base) "
        "VALUES (?, ?, ?, 'en_ligne', '{}', 'terminee', ?, ?, ?, ?, ?)",
        (secrets.token_urlsafe(12), jid, "duel_" + jeu, t, t, 1 if victoire else 0, pieces, pieces),
    )


def terminer(d, etat, gagnant, raison):
    """Fin du duel : le gagnant empoche le pot, une nulle rend les mises."""
    joueurs = [d["createur"], d["adversaire"]]
    for jid in joueurs:
        if gagnant is None:
            crediter(jid, MISE, d["jeu"], False)
        else:
            crediter(jid, GAIN_VICTOIRE if jid == gagnant else 0, d["jeu"], jid == gagnant)
    sauver(d, etat, statut="termine", gagnant=gagnant, raison=raison)


def autre(d, jid):
    return d["adversaire"] if jid == d["createur"] else d["createur"]


def verifier_delai(d):
    """Si le joueur qui doit jouer a dépassé son temps, il perd (appelé à chaque consultation)."""
    if d["statut"] != "en_cours":
        return d
    etat = json.loads(d["etat"])
    if maintenant() <= etat.get("limite", 1e18):
        return d
    if d["jeu"] == "bataille" and etat["phase"] == "placement":
        manquants = [int(j) for j, f in etat["flottes"].items() if f is None]
        if len(manquants) == 2:  # personne n'a placé sa flotte : duel annulé, mises rendues
            for jid in manquants:
                crediter(jid, MISE, d["jeu"], False)
            sauver(d, etat, statut="termine", raison="Aucun joueur n'a placé sa flotte à temps")
            return lire_duel(d["id"])
        terminer(d, etat, autre(d, manquants[0]), "Temps écoulé pour placer la flotte")
    else:
        terminer(d, etat, autre(d, etat["trait"]), "Temps écoulé")
    return lire_duel(d["id"])


# --------------------------------------------------------------------------- salon

def salon(joueur, requete):
    """Défis ouverts, mes duels en cours et joueurs en ligne."""
    jid = joueur["id"] if joueur else -1
    defis = db.execute(
        "SELECT * FROM duels WHERE statut = 'attente' AND (invite IS NULL OR invite = ? OR createur = ?) ORDER BY cree_le DESC LIMIT 30",
        (jid, jid),
    ).fetchall()
    mes = db.execute(
        "SELECT * FROM duels WHERE statut = 'en_cours' AND (createur = ? OR adversaire = ?) ORDER BY cree_le DESC",
        (jid, jid),
    ).fetchall()
    en_ligne = db.execute(
        "SELECT pseudo FROM joueurs WHERE vu_le > ? AND id != ? ORDER BY vu_le DESC LIMIT 30",
        (maintenant() - EN_LIGNE, jid),
    ).fetchall()
    return {
        "defis": [{"id": d["id"], "jeu": d["jeu"], "createur": pseudo(d["createur"]), "invite": pseudo(d["invite"]),
                   "a_moi": d["createur"] == jid, "pour_moi": d["invite"] == jid} for d in defis],
        "mes_duels": [{"id": d["id"], "jeu": d["jeu"], "adversaire": pseudo(autre(d, jid))} for d in mes],
        "en_ligne": [l["pseudo"] for l in en_ligne],
        "mise": MISE, "gain": GAIN_VICTOIRE,
    }


def creer(joueur, donnees):
    jeu = donnees.get("jeu")
    if jeu not in JEUX_DUEL:
        raise ErreurApi("Jeu inconnu.")
    invite = None
    if donnees.get("adversaire"):
        cible = db.execute("SELECT id FROM joueurs WHERE pseudo_min = ?", (str(donnees["adversaire"]).lower(),)).fetchone()
        if not cible:
            raise ErreurApi("Ce joueur n'existe pas.")
        if cible["id"] == joueur["id"]:
            raise ErreurApi("Tu ne peux pas te défier toi-même !")
        invite = cible["id"]
    deja = db.execute("SELECT COUNT(*) FROM duels WHERE createur = ? AND statut = 'attente'", (joueur["id"],)).fetchone()[0]
    if deja >= 3:
        raise ErreurApi("Tu as déjà 3 défis en attente.")
    payer(joueur["id"])
    did = secrets.token_urlsafe(10)
    db.execute("INSERT INTO duels (id, jeu, createur, invite, cree_le) VALUES (?, ?, ?, ?, ?)",
               (did, jeu, joueur["id"], invite, maintenant()))
    return {"duel": did, "joueur": joueur_public(lire_joueur(joueur["id"]))}


def annuler(joueur, donnees):
    d = lire_duel(donnees.get("duel"))
    if d["createur"] != joueur["id"] or d["statut"] != "attente":
        raise ErreurApi("Impossible d'annuler ce défi.")
    db.execute("UPDATE joueurs SET pieces = pieces + ? WHERE id = ?", (MISE, joueur["id"]))
    db.execute("UPDATE duels SET statut = 'annule', version = version + 1 WHERE id = ?", (d["id"],))
    return {"ok": True, "joueur": joueur_public(lire_joueur(joueur["id"]))}


def rejoindre(joueur, donnees):
    d = lire_duel(donnees.get("duel"))
    if d["statut"] != "attente":
        raise ErreurApi("Ce défi n'est plus disponible.")
    if d["createur"] == joueur["id"]:
        raise ErreurApi("C'est ton propre défi : attends qu'un adversaire l'accepte.")
    if d["invite"] and d["invite"] != joueur["id"]:
        raise ErreurApi("Ce défi est réservé à un autre joueur.")
    payer(joueur["id"])
    ids = [d["createur"], joueur["id"]]
    if d["jeu"] == "echecs":
        secrets.SystemRandom().shuffle(ids)
        e = {"b": echecs.DEPART, "t": "w", "c": "KQkq", "ep": -1, "hm": 0}
        etat = {"e": e, "positions": {echecs.cle(e): 1}, "blancs": ids[0], "noirs": ids[1], "trait": ids[0],
                "dernier": None, "limite": maintenant() + DELAIS["echecs"], "demi_coups": 0}
    else:
        etat = {"phase": "placement", "flottes": {str(i): None for i in ids}, "tirs": {str(i): [] for i in ids},
                "trait": secrets.choice(ids), "limite": maintenant() + DELAIS["bataille_placement"], "dernier": None}
    db.execute("UPDATE duels SET adversaire = ?, statut = 'en_cours', etat = ?, version = version + 1 WHERE id = ?",
               (joueur["id"], json.dumps(etat), d["id"]))
    return {"duel": d["id"], "joueur": joueur_public(lire_joueur(joueur["id"]))}


# --------------------------------------------------------------------------- vue d'un duel

def vue(joueur, requete):
    d = lire_duel(requete.get("duel", [""])[0])
    jid = joueur["id"] if joueur else None
    if jid not in (d["createur"], d["adversaire"]):
        raise ErreurApi("Tu ne participes pas à ce duel.", 403)
    try:
        version = int(requete.get("version", ["-1"])[0])
    except ValueError:
        version = -1
    d = verifier_delai(d)
    if d["version"] == version:
        return {"inchange": True, "version": version}
    return vue_complete(d, jid)


def vue_complete(d, jid):
    etat = json.loads(d["etat"])
    base = {
        "duel": d["id"], "jeu": d["jeu"], "version": d["version"], "statut": d["statut"],
        "moi": pseudo(jid), "adversaire": pseudo(autre(d, jid)) if d["adversaire"] else None,
        "reste": max(0, round(etat.get("limite", 0) - maintenant())) if d["statut"] == "en_cours" else None,
    }
    if d["statut"] == "termine":
        gagnant = d["gagnant"]
        base["fin"] = {
            "resultat": "nulle" if gagnant is None else ("victoire" if gagnant == jid else "defaite"),
            "raison": d["raison"],
            "pieces": MISE if gagnant is None else (GAIN_VICTOIRE if gagnant == jid else 0),  # nulle : mise rendue
            "mise": MISE, "score": 0, "record": False, "roue": False,
            "joueur": joueur_public(lire_joueur(jid)),
        }
    if d["statut"] not in ("en_cours", "termine"):
        return base
    if d["jeu"] == "echecs":
        e = etat["e"]
        blanc = etat["blancs"] == jid
        mon_tour = d["statut"] == "en_cours" and etat["trait"] == jid
        base.update(
            couleur="blancs" if blanc else "noirs", plateau=e["b"], mon_tour=mon_tour, dernier=etat["dernier"],
            echec=echecs.en_echec(e["b"], e["t"] == "w"), coups=[list(c) for c in echecs.coups_legaux(e)] if mon_tour else [],
            demi_coups=etat["demi_coups"],
        )
    else:
        adv = str(autre(d, jid))
        moi = str(jid)
        ma_flotte = etat["flottes"][moi]
        flotte_adv = etat["flottes"][adv]
        base.update(
            phase=etat["phase"], mon_tour=d["statut"] == "en_cours" and etat["phase"] == "tir" and etat["trait"] == jid,
            flotte_placee=ma_flotte is not None, adversaire_pret=flotte_adv is not None,
            ma_flotte=ma_flotte, dernier=etat["dernier"],
            mes_tirs=resultats_tirs(flotte_adv, etat["tirs"][moi]) if flotte_adv else [],
            tirs_adverses=resultats_tirs(ma_flotte, etat["tirs"][adv]) if ma_flotte else [],
            coules_adverses=navires_coules(flotte_adv, etat["tirs"][moi]) if flotte_adv else [],
        )
        if d["statut"] == "termine" and flotte_adv:
            base["flotte_adverse"] = flotte_adv
    return base


def resultats_tirs(flotte, tirs):
    cases = {c for b in flotte for c in bataille.cases_bateau(b)} if flotte else set()
    return [[x, y, "touche" if (x, y) in cases else "eau"] for x, y in tirs]


def navires_coules(flotte, tirs):
    deja = {tuple(t) for t in tirs}
    return [b for b in flotte if all(c in deja for c in bataille.cases_bateau(b))]


# --------------------------------------------------------------------------- actions de jeu

def jouer(joueur, donnees):
    d = verifier_delai(lire_duel(donnees.get("duel")))
    jid = joueur["id"]
    if jid not in (d["createur"], d["adversaire"]):
        raise ErreurApi("Tu ne participes pas à ce duel.", 403)
    if d["statut"] != "en_cours":
        raise ErreurApi("Ce duel est terminé.")
    etat = json.loads(d["etat"])
    if d["jeu"] == "echecs":
        jouer_echecs(d, etat, jid, donnees)
    else:
        jouer_bataille(d, etat, jid, donnees)
    return vue_complete(lire_duel(d["id"]), jid)


def jouer_echecs(d, etat, jid, donnees):
    if etat["trait"] != jid:
        raise ErreurApi("Ce n'est pas ton tour.")
    try:
        c = (int(donnees.get("de")), int(donnees.get("vers")))
    except (TypeError, ValueError):
        raise ErreurApi("Coup invalide.")
    e = etat["e"]
    if c not in echecs.coups_legaux(e):
        raise ErreurApi("Coup illégal.")
    e = echecs.jouer(e, c)
    etat["positions"][echecs.cle(e)] = etat["positions"].get(echecs.cle(e), 0) + 1
    etat.update(e=e, dernier=list(c), trait=autre(d, jid), limite=maintenant() + DELAIS["echecs"],
                demi_coups=etat["demi_coups"] + 1)
    issue = echecs.fin_de_partie(e, etat["positions"])
    if issue is None and etat["demi_coups"] >= echecs.MAX_DEMI_COUPS:
        issue = ("nulle", "Partie trop longue")
    if issue:
        genre, detail = issue
        terminer(d, etat, jid if genre == "mat" else None, "Échec et mat" if genre == "mat" else detail)
    else:
        sauver(d, etat)


def jouer_bataille(d, etat, jid, donnees):
    moi, adv = str(jid), str(autre(d, jid))
    if etat["phase"] == "placement":
        if etat["flottes"][moi] is not None:
            raise ErreurApi("Ta flotte est déjà placée.")
        etat["flottes"][moi] = bataille.lire_flotte(donnees.get("flotte", []))
        if all(etat["flottes"].values()):
            etat.update(phase="tir", limite=maintenant() + DELAIS["bataille"])
        sauver(d, etat)
        return
    if etat["trait"] != jid:
        raise ErreurApi("Ce n'est pas ton tour.")
    try:
        x, y = int(donnees.get("x")), int(donnees.get("y"))
    except (TypeError, ValueError):
        raise ErreurApi("Case invalide.")
    if not (0 <= x < bataille.TAILLE and 0 <= y < bataille.TAILLE) or [x, y] in etat["tirs"][moi]:
        raise ErreurApi("Case déjà visée ou hors grille.")
    resultat, coule = bataille.tirer(etat["flottes"][adv], etat["tirs"][moi], x, y)
    etat["dernier"] = {"tireur": pseudo(jid), "x": x, "y": y, "resultat": resultat}
    if bataille.flotte_coulee(etat["flottes"][adv], etat["tirs"][moi]):
        terminer(d, etat, jid, "Flotte adverse coulée")
        return
    # un tir réussi permet de rejouer, un tir dans l'eau passe la main
    if resultat == "eau":
        etat["trait"] = int(adv)
    etat["limite"] = maintenant() + DELAIS["bataille"]
    sauver(d, etat)


def abandon(joueur, donnees):
    d = verifier_delai(lire_duel(donnees.get("duel")))
    jid = joueur["id"]
    if jid not in (d["createur"], d["adversaire"]) or d["statut"] != "en_cours":
        raise ErreurApi("Impossible d'abandonner ce duel.")
    terminer(d, json.loads(d["etat"]), autre(d, jid), f"{pseudo(jid)} a abandonné")
    return vue_complete(lire_duel(d["id"]), jid)


ROUTES = {
    "/api/duels/creer": creer,
    "/api/duels/annuler": annuler,
    "/api/duels/rejoindre": rejoindre,
    "/api/duels/jouer": jouer,
    "/api/duels/abandon": abandon,
}
ROUTES_GET = {"/api/duels/salon": salon, "/api/duels/etat": vue}
