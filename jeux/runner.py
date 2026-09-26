"""Safari Rush (Moka s'échappe du zoo) : la partie tourne dans la page, en temps réel.

Le serveur vérifie la vraisemblance du résultat avec la durée qu'il a mesurée lui-même :
distance possible à la vitesse maximale, nombre de bananes ramassables, score cohérent.
"""

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

VITESSE_MAX = 32          # unités par seconde (doit rester >= à la vitesse max de runner.js)
PIECES_PAR_SECONDE = 14   # largement au-dessus de ce qu'on peut ramasser
POINTS_PIECE = 10


def debut(joueur, donnees):
    return {"partie": nouvelle_partie(joueur, "runner", "normal", {})}


def fin(joueur, donnees):
    partie, _ = lire_partie(joueur, donnees.get("partie"), "runner")
    try:
        distance, pieces, score = int(donnees.get("distance")), int(donnees.get("pieces")), int(donnees.get("score"))
    except (TypeError, ValueError):
        raise ErreurApi("Résultat invalide.")
    duree = maintenant() - partie["debut"]
    if (min(distance, pieces, score) < 0 or distance > duree * VITESSE_MAX or pieces > duree * PIECES_PAR_SECONDE
            or score > 2 * distance + pieces * POINTS_PIECE * 2):
        raise ErreurApi("Résultat invalide.")
    resultat = terminer_partie(joueur, partie, score, min(45, 3 + score // 300))
    resultat.update(distance=distance, pieces_ramassees=pieces)
    return {"fin": resultat}


ROUTES = {"/api/runner/debut": debut, "/api/runner/fin": fin}
