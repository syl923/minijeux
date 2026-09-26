"""Bonbons Folies : jeu d'alignement de bonbons (3 ou plus), entièrement calculé sur le serveur.

La page envoie seulement l'échange demandé ; le serveur vérifie, résout les alignements,
les bonbons spéciaux et les cascades, puis renvoie les étapes à animer.

Grille : 8 lignes de 8 cases [couleur, spécial] ; couleur 0 à 5 (-1 pour la bombe),
spécial : "" (normal), "H" (rayé : vide sa ligne), "V" (rayé : vide sa colonne),
"E" (emballé : explose en 3x3), "B" (bombe arc-en-ciel : vide une couleur).
"""

import secrets

from jeux.snake import mulberry32
from noyau import ErreurApi, lire_partie, nouvelle_partie, sauver_etat, terminer_partie

TAILLE = 8
COULEURS = 6
COUPS = 20
POINTS_BONBON = 20
POINTS_SPECIAL = 60


class Alea:
    """Générateur reproductible dont l'état tient dans un entier (sauvegardé avec la partie)."""

    def __init__(self, graine):
        self.graine = graine & 0xFFFFFFFF

    def __call__(self):
        valeur = mulberry32(self.graine)()
        self.graine = (self.graine + 0x6D2B79F5) & 0xFFFFFFFF
        return valeur

    def couleur(self):
        return int(self() * COULEURS)


def dans(x, y):
    return 0 <= x < TAILLE and 0 <= y < TAILLE


def trouver_alignements(g):
    """Renvoie les alignements (listes de cases) horizontaux et verticaux de 3 ou plus."""
    h, v = [], []
    for y in range(TAILLE):
        x = 0
        while x < TAILLE:
            c = g[y][x][0]
            fin = x
            while fin + 1 < TAILLE and c >= 0 and g[y][fin + 1][0] == c:
                fin += 1
            if c >= 0 and fin - x >= 2:
                h.append([(k, y) for k in range(x, fin + 1)])
            x = fin + 1
    for x in range(TAILLE):
        y = 0
        while y < TAILLE:
            c = g[y][x][0]
            fin = y
            while fin + 1 < TAILLE and c >= 0 and g[fin + 1][x][0] == c:
                fin += 1
            if c >= 0 and fin - y >= 2:
                v.append([(x, k) for k in range(y, fin + 1)])
            y = fin + 1
    return h, v


def analyser(g, h, v, pivots):
    """Cases à retirer et bonbons spéciaux créés par les alignements."""
    retrait, nouveaux = set(), {}
    for run in h + v:
        retrait.update(run)

    def pivot(run):
        for p in pivots:
            if p in run:
                return p
        return run[len(run) // 2]

    dans_h = {c for run in h for c in run}
    dans_v = {c for run in v for c in run}
    for run in h + v:  # 5 alignés : bombe arc-en-ciel
        if len(run) >= 5:
            nouveaux[pivot(run)] = [-1, "B"]
    for c in dans_h & dans_v:  # alignements en L ou en T : bonbon emballé
        if c not in nouveaux:
            nouveaux[c] = [g[c[1]][c[0]][0], "E"]
    for run in h + v:  # 4 alignés : bonbon rayé
        if len(run) == 4:
            p = pivot(run)
            if p not in nouveaux and not any(c in nouveaux for c in run):
                nouveaux[p] = [g[p[1]][p[0]][0], "H" if run in h else "V"]
    for c in nouveaux:
        retrait.discard(c)
    return retrait, nouveaux


def effet(g, x, y, alea):
    """Cases touchées quand le bonbon spécial en (x, y) est détruit."""
    s = g[y][x][1]
    if s == "H":
        return {(k, y) for k in range(TAILLE)}
    if s == "V":
        return {(x, k) for k in range(TAILLE)}
    if s == "E":
        return {(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dans(x + dx, y + dy)}
    if s == "B":
        presentes = sorted({g[j][i][0] for j in range(TAILLE) for i in range(TAILLE) if g[j][i] and g[j][i][0] >= 0})
        if not presentes:
            return set()
        c = presentes[int(alea() * len(presentes))]
        return {(i, j) for j in range(TAILLE) for i in range(TAILLE) if g[j][i] and g[j][i][0] == c}
    return set()


def declencher(g, retrait, proteges, alea):
    """Ajoute au retrait les effets des bonbons spéciaux détruits (en chaîne)."""
    a_voir = list(retrait)
    vus = set()
    while a_voir:
        x, y = a_voir.pop()
        if (x, y) in vus or (x, y) in proteges or not g[y][x]:
            continue
        vus.add((x, y))
        if g[y][x][1]:
            for c in effet(g, x, y, alea):
                if c not in retrait:
                    retrait.add(c)
                    a_voir.append(c)
    return retrait


def gravite(g, alea):
    """Fait tomber les bonbons et remplit par le haut. Renvoie la hauteur de chute de chaque case."""
    chute = [[0] * TAILLE for _ in range(TAILLE)]
    for x in range(TAILLE):
        pleins = [(y, g[y][x]) for y in range(TAILLE - 1, -1, -1) if g[y][x]]
        y = TAILLE - 1
        for y0, case in pleins:
            g[y][x] = case
            chute[y][x] = y - y0
            y -= 1
        manquants = y + 1
        for k in range(y, -1, -1):
            g[k][x] = [alea.couleur(), ""]
            chute[k][x] = manquants
    return chute


def resoudre(g, alea, retrait=None, pivots=(), score_cascade=1):
    """Résout alignements et cascades. Renvoie (étapes à animer, points gagnés)."""
    etapes, points, cascade = [], 0, score_cascade
    retrait = set(retrait or ())
    nouveaux = {}
    while True:
        if not retrait:
            h, v = trouver_alignements(g)
            if not h and not v:
                break
            retrait, nouveaux = analyser(g, h, v, pivots)
        retrait = declencher(g, retrait, set(nouveaux), alea)
        gain = len(retrait) * POINTS_BONBON * cascade + len(nouveaux) * POINTS_SPECIAL
        points += gain
        for x, y in retrait:
            g[y][x] = None
        for (x, y), case in nouveaux.items():
            g[y][x] = case
        chute = gravite(g, alea)
        etapes.append({
            "retire": sorted([x, y] for x, y in retrait),
            "speciaux": [[x, y, c, s] for (x, y), (c, s) in nouveaux.items()],
            "grille": [[list(c) for c in ligne] for ligne in g],
            "chute": chute,
            "points": gain,
            "cascade": cascade,
        })
        cascade += 1
        retrait, nouveaux, pivots = set(), {}, ()
    return etapes, points


def combo_special(g, a, b, alea):
    """Échange de deux bonbons dont au moins un spécial qui se combinent. Renvoie les cases détruites ou None."""
    (ax, ay), (bx, by) = a, b
    ca, cb = g[ay][ax], g[by][bx]
    sa, sb = ca[1], cb[1]
    if sa == "B" or sb == "B":
        if sa == "B" and sb == "B":
            return {(i, j) for j in range(TAILLE) for i in range(TAILLE)}
        bombe, autre = (a, cb) if sa == "B" else (b, ca)
        cibles = {(i, j) for j in range(TAILLE) for i in range(TAILLE) if g[j][i][0] == autre[0]}
        if autre[1] in ("H", "V", "E"):  # tous les bonbons de cette couleur deviennent spéciaux
            for i, j in cibles:
                g[j][i] = [autre[0], autre[1] if autre[1] == "E" else ("H" if (i + j) % 2 else "V")]
        return cibles | {bombe, a, b}
    rayes = ("H", "V")
    if sa in rayes and sb in rayes:
        return {(k, by) for k in range(TAILLE)} | {(bx, k) for k in range(TAILLE)}
    if sa == "E" and sb == "E":
        return {(bx + dx, by + dy) for dx in range(-2, 3) for dy in range(-2, 3) if dans(bx + dx, by + dy)}
    if {sa, sb} in ({"E", "H"}, {"E", "V"}):
        return ({(k, by + d) for k in range(TAILLE) for d in (-1, 0, 1) if dans(0, by + d)}
                | {(bx + d, k) for k in range(TAILLE) for d in (-1, 0, 1) if dans(bx + d, 0)})
    return None


def echange_utile(g, a, b):
    (ax, ay), (bx, by) = a, b
    if g[ay][ax][1] and g[by][bx][1] or "B" in (g[ay][ax][1], g[by][bx][1]):
        return True
    g[ay][ax], g[by][bx] = g[by][bx], g[ay][ax]
    h, v = trouver_alignements(g)
    g[ay][ax], g[by][bx] = g[by][bx], g[ay][ax]
    return bool(h or v)


def coup_possible(g):
    for y in range(TAILLE):
        for x in range(TAILLE):
            for dx, dy in ((1, 0), (0, 1)):
                if dans(x + dx, y + dy) and echange_utile(g, (x, y), (x + dx, y + dy)):
                    return True
    return False


def grille_neuve(alea):
    while True:
        g = [[None] * TAILLE for _ in range(TAILLE)]
        for y in range(TAILLE):
            for x in range(TAILLE):
                while True:
                    c = alea.couleur()
                    if x >= 2 and g[y][x - 1][0] == c == g[y][x - 2][0]:
                        continue
                    if y >= 2 and g[y - 1][x][0] == c == g[y - 2][x][0]:
                        continue
                    break
                g[y][x] = [c, ""]
        if coup_possible(g):
            return g


def debut(joueur, donnees):
    alea = Alea(secrets.randbits(32))
    g = grille_neuve(alea)
    etat = {"g": g, "graine": alea.graine, "coups": COUPS, "score": 0}
    pid = nouvelle_partie(joueur, "candy", "normal", etat)
    return {"partie": pid, "grille": g, "coups": COUPS}


def echanger(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "candy")
    try:
        a = (int(donnees["a"][0]), int(donnees["a"][1]))
        b = (int(donnees["b"][0]), int(donnees["b"][1]))
    except (TypeError, ValueError, KeyError, IndexError):
        raise ErreurApi("Échange invalide.")
    if not (dans(*a) and dans(*b)) or abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1:
        raise ErreurApi("Échange invalide.")
    g, alea = etat["g"], Alea(etat["graine"])

    retrait = combo_special(g, a, b, alea)
    if retrait is None:
        (ax, ay), (bx, by) = a, b
        g[ay][ax], g[by][bx] = g[by][bx], g[ay][ax]
        h, v = trouver_alignements(g)
        if not h and not v:
            return {"valide": False}
        etapes, points = resoudre(g, alea, pivots=(a, b))
    else:
        etapes, points = resoudre(g, alea, retrait=retrait)

    melange = False
    while not coup_possible(g):  # plus aucun coup : on redistribue
        g = grille_neuve(alea)
        melange = True
    etat.update(g=g, graine=alea.graine, coups=etat["coups"] - 1, score=etat["score"] + points)
    sauver_etat(partie["id"], etat)
    reponse = {"valide": True, "etapes": etapes, "score": etat["score"], "coups": etat["coups"],
               "melange": g if melange else None}
    if etat["coups"] <= 0:
        reponse["fin"] = terminer_partie(joueur, partie, etat["score"], 6 + etat["score"] // 350)
    return reponse


ROUTES = {"/api/candy/debut": debut, "/api/candy/echanger": echanger}
