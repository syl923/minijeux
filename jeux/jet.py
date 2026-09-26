"""Moka Jet (vol entre les bambous) : la page envoie les instants où le joueur a appuyé,
le serveur rejoue la partie à l'identique et calcule lui-même le score.

La simulation avance par pas fixes (60 par seconde) et n'utilise que des additions et des
multiplications : Python et JavaScript obtiennent exactement les mêmes nombres.
Elle doit rester identique à simuler() dans public/assets/jet.js.
"""

import secrets

from jeux.snake import mulberry32
from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

H = 720
SOL = 650
X_JOUEUR = 140
RAYON = 17
GRAVITE = 0.45
POUSSEE = -8.2
CHUTE_MAX = 11
LARGEUR_BAMBOU = 84
ECART_BAMBOUS = 270
RAYON_BANANE = 16
MAX_TICKS = 60 * 60 * 30   # 30 minutes


def vitesse(points):
    return 3.4 + min(2.2, points * 0.05)


def ouverture(points):
    return 190 - min(50, points * 1.5)


def nouveau_bambou(alea, x, points):
    haut = 90 + alea() * (SOL - 180 - ouverture(points))
    banane = alea() < 0.45
    by = 120 + alea() * 420
    return {"x": x, "haut": haut, "bas": haut + ouverture(points), "passe": False,
            "banane": banane, "bx": x + LARGEUR_BAMBOU + (ECART_BAMBOUS - LARGEUR_BAMBOU) / 2, "by": by, "prise": False}


def touche_rect(px, py, x1, y1, x2, y2):
    cx = min(max(px, x1), x2)
    cy = min(max(py, y1), y2)
    return (px - cx) * (px - cx) + (py - cy) * (py - cy) < RAYON * RAYON


def simuler(graine, appuis, ticks):
    """Rejoue la partie. Renvoie (bambous passés, bananes, mort au dernier pas ?)."""
    alea = mulberry32(graine)
    y, vy, dist, points, bananes = 360.0, 0.0, 0.0, 0, 0
    bambous = [nouveau_bambou(alea, 620.0, 0)]
    appuis = set(appuis)
    for t in range(ticks):
        if t in appuis:
            vy = POUSSEE
        vy += GRAVITE
        if vy > CHUTE_MAX:
            vy = CHUTE_MAX
        y += vy
        dist += vitesse(points)
        while bambous[-1]["x"] < dist + 900:
            bambous.append(nouveau_bambou(alea, bambous[-1]["x"] + ECART_BAMBOUS, points))
        px = dist + X_JOUEUR
        mort = y + RAYON >= SOL or y - RAYON <= 0
        for b in bambous:
            if b["x"] > px + 200:
                break
            if not b["passe"] and b["x"] + LARGEUR_BAMBOU < px - RAYON:
                b["passe"] = True
                points += 1
            if touche_rect(px, y, b["x"], -1000, b["x"] + LARGEUR_BAMBOU, b["haut"]) or \
                    touche_rect(px, y, b["x"], b["bas"], b["x"] + LARGEUR_BAMBOU, SOL):
                mort = True
            if b["banane"] and not b["prise"]:
                dx, dy = px - b["bx"], y - b["by"]
                if dx * dx + dy * dy < (RAYON + RAYON_BANANE) * (RAYON + RAYON_BANANE):
                    b["prise"] = True
                    bananes += 1
        bambous = [b for b in bambous if b["x"] + LARGEUR_BAMBOU > dist - 50]
        if mort:
            return points, bananes, t == ticks - 1
    return points, bananes, False


def debut(joueur, donnees):
    graine = secrets.randbits(32)
    return {"partie": nouvelle_partie(joueur, "jet", "normal", {"graine": graine}), "graine": graine}


def fin(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "jet")
    try:
        ticks = int(donnees.get("ticks"))
        appuis = [int(t) for t in donnees.get("appuis", [])]
    except (TypeError, ValueError):
        raise ErreurApi("Partie invalide.")
    if not 0 < ticks <= MAX_TICKS or len(appuis) > ticks or any(not 0 <= t < ticks for t in appuis):
        raise ErreurApi("Partie invalide.")
    points, bananes, mort = simuler(etat["graine"], appuis, ticks)
    if not mort:
        raise ErreurApi("Partie invalide.")
    if maintenant() - partie["debut"] < ticks / 60 * 0.8 - 1:
        raise ErreurApi("Partie trop rapide pour être vraie.")
    score = points * 10 + bananes * 5
    resultat = terminer_partie(joueur, partie, score, min(40, 2 + score // 12))
    resultat.update(bambous=points, bananes=bananes)
    return {"fin": resultat}


ROUTES = {"/api/jet/debut": debut, "/api/jet/fin": fin}
