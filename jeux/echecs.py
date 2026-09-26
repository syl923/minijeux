"""Échecs contre l'ordinateur. Règles complètes (roque, prise en passant, promotion en dame,
pat, triple répétition, règle des 50 coups, matériel insuffisant) et moteur alpha-bêta.

Le plateau est une chaîne de 64 caractères, case 0 = a8, case 63 = h1.
Majuscules = blancs (le joueur), minuscules = noirs (l'ordinateur), "." = vide.
"""

import random

from noyau import ErreurApi, lire_partie, nouvelle_partie, sauver_etat, terminer_partie

DEPART = "rnbqkbnrpppppppp" + "." * 32 + "PPPPPPPPRNBQKBNR"
NIVEAUX = {"facile": 1, "normal": 2, "difficile": 3}
BASE_SCORE = {"facile": 300, "normal": 600, "difficile": 1000}
MAX_DEMI_COUPS = 400

# ------------------------------------------------------------------ tables de déplacement

def _cases(pas):
    table = []
    for sq in range(64):
        r, f = divmod(sq, 8)
        table.append([(r + dr) * 8 + f + df for dr, df in pas if 0 <= r + dr < 8 and 0 <= f + df < 8])
    return table


CAVALIER = _cases([(1, 2), (2, 1), (-1, 2), (-2, 1), (1, -2), (2, -1), (-1, -2), (-2, -1)])
ROI = _cases([(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)])
DIAG = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
DROIT = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def _rayons(directions):
    table = []
    for sq in range(64):
        r, f = divmod(sq, 8)
        rayons = []
        for dr, df in directions:
            rayon, rr, ff = [], r + dr, f + df
            while 0 <= rr < 8 and 0 <= ff < 8:
                rayon.append(rr * 8 + ff)
                rr += dr
                ff += df
            if rayon:
                rayons.append(rayon)
        table.append(rayons)
    return table


RAYONS_DIAG = _rayons(DIAG)
RAYONS_DROIT = _rayons(DROIT)

VALEUR = {"P": 100, "N": 320, "B": 330, "R": 500, "Q": 900, "K": 0}
# Bonus de position (du point de vue des blancs, case 0 = a8)
PST = {
    "P": [0] * 8 + [50] * 8 + [10, 10, 20, 30, 30, 20, 10, 10] + [5, 5, 10, 25, 25, 10, 5, 5]
    + [0, 0, 0, 20, 20, 0, 0, 0] + [5, -5, -10, 0, 0, -10, -5, 5] + [5, 10, 10, -20, -20, 10, 10, 5] + [0] * 8,
    "N": [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30,
          -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30,
          -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    "B": [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
          -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
          -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    "R": [0] * 8 + [5, 10, 10, 10, 10, 10, 10, 5] + [-5, 0, 0, 0, 0, 0, 0, -5] * 5 + [0, 0, 0, 5, 5, 0, 0, 0],
    "Q": [-20, -10, -10, -5, -5, -10, -10, -20] + [-10, 0, 0, 0, 0, 0, 0, -10] + [-10, 0, 5, 5, 5, 5, 0, -10] * 2
    + [0, 0, 5, 5, 5, 5, 0, -5] + [-10, 5, 5, 5, 5, 5, 0, -10] + [-10, 0, 5, 0, 0, 0, 0, -10]
    + [-20, -10, -10, -5, -5, -10, -10, -20],
    "K": [-30, -40, -40, -50, -50, -40, -40, -30] * 4 + [-20, -30, -30, -40, -40, -30, -30, -20]
    + [-10, -20, -20, -20, -20, -20, -20, -10] + [20, 20, 0, 0, 0, 0, 20, 20] + [20, 30, 10, 0, 0, 10, 30, 20],
}


def blanc(p):
    return p.isupper()


def attaquee(b, sq, par_blancs):
    """La case `sq` est-elle attaquée par le camp indiqué ?"""
    r, f = divmod(sq, 8)
    pion, cav, fou, tour, dame, roi = ("P", "N", "B", "R", "Q", "K") if par_blancs else ("p", "n", "b", "r", "q", "k")
    rp = r + 1 if par_blancs else r - 1  # rangée d'où un pion attaquerait
    if 0 <= rp < 8:
        for ff in (f - 1, f + 1):
            if 0 <= ff < 8 and b[rp * 8 + ff] == pion:
                return True
    for c in CAVALIER[sq]:
        if b[c] == cav:
            return True
    for c in ROI[sq]:
        if b[c] == roi:
            return True
    for rayon in RAYONS_DIAG[sq]:
        for c in rayon:
            if b[c] != ".":
                if b[c] == fou or b[c] == dame:
                    return True
                break
    for rayon in RAYONS_DROIT[sq]:
        for c in rayon:
            if b[c] != ".":
                if b[c] == tour or b[c] == dame:
                    return True
                break
    return False


def en_echec(b, blancs):
    return attaquee(b, b.index("K" if blancs else "k"), not blancs)


def coups_pseudo(e):
    """Coups sans vérifier que le roi reste hors d'échec. Coup = (de, vers)."""
    b, blancs = e["b"], e["t"] == "w"
    coups = []
    for sq, p in enumerate(b):
        if p == "." or blanc(p) != blancs:
            continue
        u = p.upper()
        if u == "P":
            r, f = divmod(sq, 8)
            pas = -8 if blancs else 8
            devant = sq + pas
            if 0 <= devant < 64 and b[devant] == ".":
                coups.append((sq, devant))
                if r == (6 if blancs else 1) and b[devant + pas] == ".":
                    coups.append((sq, devant + pas))
            for df in (-1, 1):
                if 0 <= f + df < 8:
                    c = devant + df
                    if 0 <= c < 64 and ((b[c] != "." and blanc(b[c]) != blancs) or c == e["ep"]):
                        coups.append((sq, c))
        elif u == "N" or u == "K":
            for c in (CAVALIER if u == "N" else ROI)[sq]:
                if b[c] == "." or blanc(b[c]) != blancs:
                    coups.append((sq, c))
            if u == "K":
                coups.extend(roques(e, sq, blancs))
        else:
            rayons = (RAYONS_DIAG[sq] if u in "BQ" else []) + (RAYONS_DROIT[sq] if u in "RQ" else [])
            for rayon in rayons:
                for c in rayon:
                    if b[c] == ".":
                        coups.append((sq, c))
                    else:
                        if blanc(b[c]) != blancs:
                            coups.append((sq, c))
                        break
    return coups


def roques(e, sq, blancs):
    b, droits = e["b"], e["c"]
    res = []
    depart = 60 if blancs else 4
    if sq != depart or attaquee(b, depart, not blancs):
        return res
    petit, grand = ("K", "Q") if blancs else ("k", "q")
    if petit in droits and b[depart + 1] == "." and b[depart + 2] == "." \
            and not attaquee(b, depart + 1, not blancs) and not attaquee(b, depart + 2, not blancs):
        res.append((depart, depart + 2))
    if grand in droits and b[depart - 1] == "." and b[depart - 2] == "." and b[depart - 3] == "." \
            and not attaquee(b, depart - 1, not blancs) and not attaquee(b, depart - 2, not blancs):
        res.append((depart, depart - 2))
    return res


def jouer(e, coup):
    """Nouvel état après le coup (promotion automatique en dame)."""
    de, vers = coup
    b = list(e["b"])
    p = b[de]
    u = p.upper()
    blancs = blanc(p)
    prise = b[vers] != "."
    b[vers], b[de] = p, "."
    if u == "P":
        if vers == e["ep"]:
            b[vers + (8 if blancs else -8)] = "."
            prise = True
        if vers < 8 or vers >= 56:
            b[vers] = "Q" if blancs else "q"
    if u == "K" and abs(vers - de) == 2:
        if vers > de:
            b[de + 1], b[de + 3] = b[de + 3], "."
        else:
            b[de - 1], b[de - 4] = b[de - 4], "."
    droits = e["c"]
    for case, lettres in ((60, "KQ"), (4, "kq"), (63, "K"), (56, "Q"), (7, "k"), (0, "q")):
        if de == case or vers == case:
            droits = "".join(c for c in droits if c not in lettres)
    return {
        "b": "".join(b),
        "t": "b" if e["t"] == "w" else "w",
        "c": droits,
        "ep": (de + vers) // 2 if u == "P" and abs(vers - de) == 16 else -1,
        "hm": 0 if u == "P" or prise else e["hm"] + 1,
    }


def coups_legaux(e):
    blancs = e["t"] == "w"
    return [c for c in coups_pseudo(e) if not en_echec(jouer(e, c)["b"], blancs)]


def materiel_insuffisant(b):
    pieces = [p for p in b if p not in ".Kk"]
    return not pieces or (len(pieces) == 1 and pieces[0] in "NBnb")


def cle(e):
    return f"{e['b']}{e['t']}{e['c']}{e['ep']}"


# ------------------------------------------------------------------ moteur

def evaluer(b):
    """Évaluation du point de vue des blancs, en centièmes de pion."""
    s = 0
    for sq, p in enumerate(b):
        if p == ".":
            continue
        if blanc(p):
            s += VALEUR[p] + PST[p][sq]
        else:
            u = p.upper()
            s -= VALEUR[u] + PST[u][(7 - sq // 8) * 8 + sq % 8]
    return s


def ordonner(e, coups):
    b = e["b"]
    return sorted(coups, key=lambda c: -(VALEUR[b[c[1]].upper()] * 10 - VALEUR[b[c[0]].upper()] // 10) if b[c[1]] != "." else 0)


def quiescence(e, alpha, beta, profondeur):
    signe = 1 if e["t"] == "w" else -1
    immobile = signe * evaluer(e["b"])
    if immobile >= beta or profondeur == 0:
        return immobile
    alpha = max(alpha, immobile)
    blancs = e["t"] == "w"
    for c in ordonner(e, [c for c in coups_pseudo(e) if e["b"][c[1]] != "."]):
        suite = jouer(e, c)
        if en_echec(suite["b"], blancs):
            continue
        v = -quiescence(suite, -beta, -alpha, profondeur - 1)
        if v >= beta:
            return v
        alpha = max(alpha, v)
    return alpha


def negamax(e, profondeur, alpha, beta, ply):
    if profondeur == 0:
        return quiescence(e, alpha, beta, 4)
    blancs = e["t"] == "w"
    meilleur = -10**9
    joue = False
    for c in ordonner(e, coups_pseudo(e)):
        suite = jouer(e, c)
        if en_echec(suite["b"], blancs):
            continue
        joue = True
        v = -negamax(suite, profondeur - 1, -beta, -alpha, ply + 1)
        if v > meilleur:
            meilleur = v
        alpha = max(alpha, v)
        if alpha >= beta:
            break
    if not joue:
        return -100000 + ply if en_echec(e["b"], blancs) else 0
    return meilleur


def choisir_coup(e, niveau):
    coups = coups_legaux(e)
    profondeur = NIVEAUX[niveau]
    bruit = {"facile": 120, "normal": 15, "difficile": 0}[niveau]
    notes = []
    for c in ordonner(e, coups):
        v = -negamax(jouer(e, c), profondeur - 1, -10**9, 10**9, 1)
        notes.append((v + random.uniform(-bruit, bruit), c))
    return max(notes)[1]


# ------------------------------------------------------------------ partie

def fin_de_partie(e, positions):
    """None si la partie continue, sinon ('mat'|'pat'|'nulle', détail)."""
    if not coups_legaux(e):
        return ("mat", None) if en_echec(e["b"], e["t"] == "w") else ("pat", "Pat")
    if positions.get(cle(e), 0) >= 3:
        return ("nulle", "Triple répétition")
    if e["hm"] >= 100:
        return ("nulle", "Règle des 50 coups")
    if materiel_insuffisant(e["b"]):
        return ("nulle", "Matériel insuffisant")
    return None


def vue(e):
    return {
        "plateau": e["b"],
        "coups": [list(c) for c in coups_legaux(e)] if e["t"] == "w" else [],
        "echec": en_echec(e["b"], e["t"] == "w"),
    }


def debut(joueur, donnees):
    niveau = donnees.get("niveau", "normal")
    if niveau not in NIVEAUX:
        raise ErreurApi("Niveau inconnu.")
    e = {"b": DEPART, "t": "w", "c": "KQkq", "ep": -1, "hm": 0}
    etat = {"e": e, "positions": {cle(e): 1}, "demi_coups": 0}
    pid = nouvelle_partie(joueur, "echecs", niveau, etat)
    return {"partie": pid, **vue(e)}


def terminer(joueur, partie, etat, resultat, detail):
    niveau = partie["mode"]
    coups_joueur = (etat["demi_coups"] + 1) // 2
    if resultat == "victoire":
        score = BASE_SCORE[niveau] + max(0, 300 - coups_joueur * 5)
    elif resultat == "nulle":
        score = BASE_SCORE[niveau] // 4
    else:
        score = 0
    fin = terminer_partie(joueur, partie, score, score // 20)
    fin.update(resultat=resultat, detail=detail, coups=coups_joueur)
    return fin


def coup(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "echecs")
    e = etat["e"]
    try:
        c = (int(donnees.get("de")), int(donnees.get("vers")))
    except (TypeError, ValueError):
        raise ErreurApi("Coup invalide.")
    if e["t"] != "w" or c not in coups_legaux(e):
        raise ErreurApi("Coup illégal.")

    def avancer(e, c):
        e = jouer(e, c)
        etat["positions"][cle(e)] = etat["positions"].get(cle(e), 0) + 1
        etat["demi_coups"] += 1
        return e

    e = avancer(e, c)
    reponse = {"joueur": list(c)}
    issue = fin_de_partie(e, etat["positions"])
    if issue is None and etat["demi_coups"] >= MAX_DEMI_COUPS:
        issue = ("nulle", "Partie trop longue")
    if issue is None:
        c_ia = choisir_coup(e, partie["mode"])
        e = avancer(e, c_ia)
        reponse["ia"] = list(c_ia)
        issue = fin_de_partie(e, etat["positions"])
    etat["e"] = e
    sauver_etat(partie["id"], etat)
    reponse.update(vue(e))
    if issue:
        genre, detail = issue
        if genre == "mat":
            resultat = "defaite" if e["t"] == "w" else "victoire"
            detail = "Échec et mat"
        else:
            resultat = "nulle"
        reponse["fin"] = terminer(joueur, partie, etat, resultat, detail)
    return reponse


def abandon(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "echecs")
    return {"fin": terminer(joueur, partie, etat, "defaite", "Abandon")}


ROUTES = {"/api/echecs/debut": debut, "/api/echecs/coup": coup, "/api/echecs/abandon": abandon}
