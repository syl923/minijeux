"""Blocomania (blocs qui tombent) : la partie tourne dans la page, en temps réel.

Le serveur ne peut pas rejouer chaque pièce, mais il vérifie que le résultat annoncé est
possible : pas plus de lignes que le temps le permet, un score cohérent avec les lignes
et le niveau, et une durée réelle mesurée par lui-même.
"""

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

POINTS_LIGNES = {1: 100, 2: 300, 3: 500, 4: 800}
SECONDES_PAR_LIGNE_MIN = 0.3     # même en jouant très vite, pas plus de ~3 lignes par seconde
PIECES_PAR_SECONDE_MAX = 8       # chaque pièce posée rapporte au plus 2 x 20 cases de descente


def score_maximal(lignes, duree):
    """Score le plus haut possible avec ce nombre de lignes (tout en quadruples, au niveau le plus haut)."""
    niveau_max = 1 + lignes // 10
    return (lignes // 4 + 1) * POINTS_LIGNES[4] * niveau_max + int(duree * PIECES_PAR_SECONDE_MAX) * 40


def debut(joueur, donnees):
    return {"partie": nouvelle_partie(joueur, "tetris", "normal", {})}


def fin(joueur, donnees):
    partie, _ = lire_partie(joueur, donnees.get("partie"), "tetris")
    try:
        score, lignes = int(donnees.get("score")), int(donnees.get("lignes"))
    except (TypeError, ValueError):
        raise ErreurApi("Résultat invalide.")
    duree = maintenant() - partie["debut"]
    if score < 0 or lignes < 0 or lignes > duree / SECONDES_PAR_LIGNE_MIN or score > score_maximal(lignes, duree):
        raise ErreurApi("Résultat invalide.")
    resultat = terminer_partie(joueur, partie, score, min(45, 3 + score // 700))
    resultat.update(lignes=lignes)
    return {"fin": resultat}


ROUTES = {"/api/tetris/debut": debut, "/api/tetris/fin": fin}
