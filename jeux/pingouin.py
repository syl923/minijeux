"""Pingu Glisse (le pingouin qui glisse le plus loin) : la partie tourne dans la page en temps réel.

Le serveur vérifie que le résultat est possible pour la durée qu'il a mesurée lui-même.
"""

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

METRES_PAR_SECONDE_MAX = 130   # vitesse maximale du pingouin (voir pingouin.js), avec de la marge
POISSONS_PAR_SECONDE = 4
POINTS_POISSON = 25
POINTS_PARFAIT = 10


def debut(joueur, donnees):
    return {"partie": nouvelle_partie(joueur, "pingouin", "normal", {})}


def fin(joueur, donnees):
    partie, _ = lire_partie(joueur, donnees.get("partie"), "pingouin")
    try:
        metres, poissons, parfaits = int(donnees.get("metres")), int(donnees.get("poissons")), int(donnees.get("parfaits"))
    except (TypeError, ValueError):
        raise ErreurApi("Résultat invalide.")
    duree = maintenant() - partie["debut"]
    if (min(metres, poissons, parfaits) < 0 or metres > duree * METRES_PAR_SECONDE_MAX
            or poissons > duree * POISSONS_PAR_SECONDE or parfaits > duree):
        raise ErreurApi("Résultat invalide.")
    score = metres + poissons * POINTS_POISSON + parfaits * POINTS_PARFAIT
    resultat = terminer_partie(joueur, partie, score, min(40, 3 + score // 350))
    resultat.update(metres=metres, poissons=poissons, parfaits=parfaits)
    return {"fin": resultat}


ROUTES = {"/api/pingouin/debut": debut, "/api/pingouin/fin": fin}
