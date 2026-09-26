"""Démineur : les bombes sont placées ici, après le premier clic (jamais sous le premier clic).

La page n'apprend le contenu d'une case qu'en la découvrant ; les drapeaux restent dans la page.
"""

import random

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, sauver_etat, terminer_partie

MODES = {
    "facile": {"l": 9, "h": 9, "bombes": 10, "base": 1000},
    "moyen": {"l": 16, "h": 16, "bombes": 40, "base": 3000},
}


def voisins(x, y, l, h):
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if (dx or dy) and 0 <= x + dx < l and 0 <= y + dy < h:
                yield x + dx, y + dy


def debut(joueur, donnees):
    mode = donnees.get("mode", "facile")
    if mode not in MODES:
        raise ErreurApi("Mode inconnu.")
    m = MODES[mode]
    etat = {"l": m["l"], "h": m["h"], "nb": m["bombes"], "bombes": None, "vues": []}
    pid = nouvelle_partie(joueur, "demineur", mode, etat)
    return {"partie": pid, "largeur": m["l"], "hauteur": m["h"], "bombes": m["bombes"]}


def reveler(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "demineur")
    l, h = etat["l"], etat["h"]
    try:
        demandees = [(int(c[0]), int(c[1])) for c in donnees.get("cases", [])][:9]
    except (TypeError, ValueError, IndexError):
        raise ErreurApi("Case invalide.")
    if not demandees or not all(0 <= x < l and 0 <= y < h for x, y in demandees):
        raise ErreurApi("Case invalide.")

    if etat["bombes"] is None:  # premier clic : on pose les bombes loin de lui
        x0, y0 = demandees[0]
        protegees = {(x0, y0), *voisins(x0, y0, l, h)}
        possibles = [(x, y) for y in range(h) for x in range(l) if (x, y) not in protegees]
        etat["bombes"] = [list(c) for c in random.sample(possibles, etat["nb"])]

    bombes = {tuple(b) for b in etat["bombes"]}
    vues = {tuple(v) for v in etat["vues"]}
    nouvelles = []

    def compte(x, y):
        return sum((vx, vy) in bombes for vx, vy in voisins(x, y, l, h))

    for x, y in demandees:
        if (x, y) in vues:
            continue
        if (x, y) in bombes:
            etat["vues"] = [list(v) for v in vues]
            sauver_etat(partie["id"], etat)
            ratio = len(vues) / (l * h - len(bombes))
            fin = terminer_partie(joueur, partie, 0, int(ratio * 6))
            fin.update(victoire=False, bombe=[x, y])
            return {"cases": nouvelles, "fin": fin, "bombes": etat["bombes"]}
        # découverte en cascade des zones sans bombe autour
        pile = [(x, y)]
        while pile:
            cx, cy = pile.pop()
            if (cx, cy) in vues:
                continue
            vues.add((cx, cy))
            n = compte(cx, cy)
            nouvelles.append([cx, cy, n])
            if n == 0:
                pile.extend(v for v in voisins(cx, cy, l, h) if v not in vues)

    etat["vues"] = [list(v) for v in vues]
    sauver_etat(partie["id"], etat)
    reponse = {"cases": nouvelles}
    if len(vues) == l * h - len(bombes):
        secondes = int(maintenant() - partie["debut"])
        base = MODES[partie["mode"]]["base"]
        score = max(base // 5, base - secondes * 5)
        reponse["fin"] = terminer_partie(joueur, partie, score, 8 + score // 60)
        reponse["fin"].update(victoire=True, secondes=secondes)
        reponse["bombes"] = etat["bombes"]
    return reponse


ROUTES = {"/api/demineur/debut": debut, "/api/demineur/reveler": reveler}
