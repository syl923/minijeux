"""Bataille navale : la flotte de l'ordinateur et son intelligence vivent ici, jamais dans la page."""

import random

from noyau import ErreurApi, lire_partie, nouvelle_partie, sauver_etat, terminer_partie

TAILLE = 10
FLOTTE = [5, 4, 3, 3, 2]


def cases_bateau(b):
    return [(b["x"] + (0 if b["vertical"] else k), b["y"] + (k if b["vertical"] else 0)) for k in range(b["taille"])]


def placement_ok(flotte):
    """Bateaux dans la grille, sans chevauchement ni contact (même en diagonale)."""
    occupees = {}
    for n, b in enumerate(flotte):
        for x, y in cases_bateau(b):
            if not (0 <= x < TAILLE and 0 <= y < TAILLE):
                return False
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if occupees.get((x + dx, y + dy), n) != n:
                        return False
            occupees[(x, y)] = n
    return True


def flotte_valide(flotte):
    return sorted(b["taille"] for b in flotte) == sorted(FLOTTE) and placement_ok(flotte)


def flotte_aleatoire():
    while True:
        flotte = []
        for taille in FLOTTE:
            for _ in range(200):
                b = {"taille": taille, "vertical": random.random() < 0.5,
                     "x": random.randrange(TAILLE), "y": random.randrange(TAILLE)}
                if placement_ok(flotte + [b]):
                    flotte.append(b)
                    break
            else:
                break  # coincé : on recommence tout
        if len(flotte) == len(FLOTTE):
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
    libre = lambda x, y: 0 <= x < TAILLE and 0 <= y < TAILLE and (x, y) not in interdites
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
    cases = [(x, y) for x in range(TAILLE) for y in range(TAILLE) if libre(x, y)]
    damier = [c for c in cases if (c[0] + c[1]) % 2 == 0]
    return random.choice(damier or cases)


def debut(joueur, donnees):
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


def tir(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "bataille")
    try:
        x, y = int(donnees.get("x")), int(donnees.get("y"))
    except (TypeError, ValueError):
        raise ErreurApi("Case invalide.")
    if not (0 <= x < TAILLE and 0 <= y < TAILLE) or [x, y] in etat["tirs_joueur"]:
        raise ErreurApi("Case déjà visée ou hors grille.")

    resultat, coule = tirer(etat["flotte_ia"], etat["tirs_joueur"], x, y)
    reponse = {"joueur": {"x": x, "y": y, "resultat": resultat, "coule": coule}}

    if flotte_coulee(etat["flotte_ia"], etat["tirs_joueur"]):
        sauver_etat(partie["id"], etat)
        nb_tirs = len(etat["tirs_joueur"])
        score = max(100, 1000 - (nb_tirs - sum(FLOTTE)) * 12)
        reponse["fin"] = terminer_partie(joueur, partie, score, 12 + score // 40)
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
        reponse["fin"] = terminer_partie(joueur, partie, 0, 2 * coules)
        reponse["fin"].update(victoire=False, tirs=len(etat["tirs_joueur"]), flotte_ia=etat["flotte_ia"])
    return reponse


ROUTES = {"/api/bataille/debut": debut, "/api/bataille/tir": tir}
