"""Moka Glisse (identifiant historique « pingouin ») : un ours polaire envoie Moka en doudoune
le plus loin possible d'un coup de batte, puis Moka glisse sur la neige en sautant les obstacles.

La partie tourne dans la page en temps réel ; le serveur vérifie que le résultat est possible
pour la durée qu'il a mesurée lui-même.
"""

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

METRES_PAR_SECONDE_MAX = 130   # bien au-dessus de la vitesse maximale de Moka (voir pingouin.js)
BANANES_PAR_SECONDE = 4
SAUTS_PAR_SECONDE = 2
POINTS_BANANE = 25
POINTS_SAUT = 10


def debut(joueur, donnees):
    return {"partie": nouvelle_partie(joueur, "pingouin", "normal", {})}


def fin(joueur, donnees):
    partie, _ = lire_partie(joueur, donnees.get("partie"), "pingouin")
    try:
        metres, bananes, sauts = int(donnees.get("metres")), int(donnees.get("bananes")), int(donnees.get("sauts"))
    except (TypeError, ValueError):
        raise ErreurApi("Résultat invalide.")
    duree = maintenant() - partie["debut"]
    if (min(metres, bananes, sauts) < 0 or metres > duree * METRES_PAR_SECONDE_MAX
            or bananes > duree * BANANES_PAR_SECONDE or sauts > duree * SAUTS_PAR_SECONDE):
        raise ErreurApi("Résultat invalide.")
    score = metres + bananes * POINTS_BANANE + sauts * POINTS_SAUT
    resultat = terminer_partie(joueur, partie, score, min(40, 3 + score // 60))
    resultat.update(metres=metres, bananes=bananes, sauts=sauts)
    return {"fin": resultat}


ROUTES = {"/api/pingouin/debut": debut, "/api/pingouin/fin": fin}
