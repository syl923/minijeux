"""Flipper : la physique tourne dans la page, le serveur ne peut donc pas rejouer la partie.
Il vérifie au moins que le score est plausible pour la durée réellement jouée.
"""

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

POINTS_MAX_PAR_SECONDE = 30000  # bonus, feu, MOKA MANIA et multibille compris : largement au-dessus d'un très bon joueur
SCORE_MAX = 20_000_000
POINTS_PAR_PIECE = 25000
PIECES_MAX = 40


def debut(joueur, donnees):
    return {"partie": nouvelle_partie(joueur, "flipper", "normal", {})}


def fin(joueur, donnees):
    partie, _ = lire_partie(joueur, donnees.get("partie"), "flipper")
    try:
        score = int(donnees.get("score"))
    except (TypeError, ValueError):
        raise ErreurApi("Score invalide.")
    duree = maintenant() - partie["debut"]
    if not 0 <= score <= SCORE_MAX or score > duree * POINTS_MAX_PAR_SECONDE:
        raise ErreurApi("Score invalide.")
    resultat = terminer_partie(joueur, partie, score, min(PIECES_MAX, 5 + score // POINTS_PAR_PIECE))
    return {"fin": resultat}


ROUTES = {"/api/flipper/debut": debut, "/api/flipper/fin": fin}
