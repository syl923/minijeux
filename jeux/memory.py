"""Memory contre la montre : 20 secondes au départ, +5 secondes par paire trouvée.

Le serveur connaît l'ordre des cartes et tient le chrono : la page ne découvre une carte
qu'en la retournant, et une carte retournée après la fin du temps ne compte pas.
"""

import random

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, sauver_etat, terminer_partie

MODES = {"facile": 8, "difficile": 18}
NB_SYMBOLES = 24      # doit correspondre au nombre d'images dans memory.js
TEMPS_DEPART = 20
BONUS_PAIRE = 5
TOLERANCE = 1.0       # latence réseau acceptée, en secondes


def temps_restant(partie, etat):
    limite = partie["debut"] + TEMPS_DEPART + BONUS_PAIRE * (len(etat["trouvees"]) // 2)
    return limite - maintenant()


def perdre(joueur, partie, etat):
    fin = terminer_partie(joueur, partie, 0, 0)
    fin.update(victoire=False, paires=len(etat["trouvees"]) // 2, coups=etat["coups"])
    return fin


def debut(joueur, donnees):
    mode = donnees.get("mode", "facile")
    if mode not in MODES:
        raise ErreurApi("Mode inconnu.")
    symboles = random.sample(range(NB_SYMBOLES), MODES[mode])
    cartes = symboles * 2
    random.shuffle(cartes)
    etat = {"cartes": cartes, "trouvees": [], "attente": None, "coups": 0}
    pid = nouvelle_partie(joueur, "memory", mode, etat)
    return {"partie": pid, "nb_cartes": len(cartes), "temps": TEMPS_DEPART, "bonus": BONUS_PAIRE}


def retourner(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "memory")
    if temps_restant(partie, etat) < -TOLERANCE:
        return {"fin": perdre(joueur, partie, etat)}
    cartes = etat["cartes"]
    try:
        i = int(donnees.get("index"))
    except (TypeError, ValueError):
        raise ErreurApi("Carte invalide.")
    if not 0 <= i < len(cartes) or i in etat["trouvees"] or i == etat["attente"]:
        raise ErreurApi("Carte non retournable.")
    reponse = {"index": i, "symbole": cartes[i]}
    if etat["attente"] is None:
        etat["attente"] = i
    else:
        autre = etat["attente"]
        etat["attente"] = None
        etat["coups"] += 1
        reponse["paire"] = cartes[autre] == cartes[i]
        reponse["autre"] = autre
        if reponse["paire"]:
            etat["trouvees"] += [autre, i]
    reponse["coups"] = etat["coups"]
    reponse["temps_restant"] = round(max(0, temps_restant(partie, etat)), 2)
    sauver_etat(partie["id"], etat)
    if len(etat["trouvees"]) == len(cartes):
        paires = len(cartes) // 2
        erreurs = etat["coups"] - paires
        reste = max(0, int(temps_restant(partie, etat)))
        score = max(paires * 10, paires * 50 + reste * 20 - erreurs * 10)
        reponse["fin"] = terminer_partie(joueur, partie, score, 10 + score // 50)
        reponse["fin"].update(victoire=True, coups=etat["coups"], temps_restant=reste)
    return reponse


def temps_ecoule(joueur, donnees):
    """La page signale la fin du chrono : le serveur vérifie avant de clore la partie."""
    partie, etat = lire_partie(joueur, donnees.get("partie"), "memory")
    if temps_restant(partie, etat) > TOLERANCE:
        raise ErreurApi("Il reste du temps !")
    return {"fin": perdre(joueur, partie, etat)}


ROUTES = {
    "/api/memory/debut": debut,
    "/api/memory/retourner": retourner,
    "/api/memory/temps_ecoule": temps_ecoule,
}
