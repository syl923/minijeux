"""Snake : la page envoie la liste des changements de direction, le serveur rejoue la partie.

Les fruits apparaissent selon un générateur pseudo-aléatoire (mulberry32) dont la graine est
tirée ici : la page et le serveur calculent exactement les mêmes positions. Le score n'est
donc jamais transmis par la page, il est recalculé en rejouant les coups.
"""

import secrets

from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

TAILLE = 20
DIRECTIONS = [(0, -1), (1, 0), (0, 1), (-1, 0)]  # haut, droite, bas, gauche
MAX_TICKS = 50_000
POINTS_FRUIT = 10
POINTS_OR = 50        # un fruit sur cinq est doré


def intervalle_ms(fruits):
    """Vitesse du serpent (doit correspondre à snake.js)."""
    return max(55, 150 - fruits * 4)


def imul(a, b):
    return (a * b) & 0xFFFFFFFF


def mulberry32(graine):
    etat = graine & 0xFFFFFFFF

    def suivant():
        nonlocal etat
        etat = (etat + 0x6D2B79F5) & 0xFFFFFFFF
        t = imul(etat ^ (etat >> 15), 1 | etat)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return suivant


def placer_fruit(alea, corps):
    occupees = set(corps)
    libres = [(x, y) for y in range(TAILLE) for x in range(TAILLE) if (x, y) not in occupees]
    return libres[int(alea() * len(libres))]


def rejouer(graine, entrees, ticks):
    """Rejoue la partie. Renvoie (score, fruits, durée minimale en ms) ou lève ErreurApi."""
    alea = mulberry32(graine)
    corps = [(10, 10), (9, 10), (8, 10)]
    direction = 1
    fruit = placer_fruit(alea, corps)
    fruits = score = duree = 0
    changements = {}
    for t, d in entrees:
        if t in changements or not 0 <= d < 4:
            raise ErreurApi("Partie invalide.")
        changements[t] = d
    for tick in range(ticks):
        if tick in changements:
            d = changements.pop(tick)
            if d == direction or d == (direction + 2) % 4:
                raise ErreurApi("Partie invalide.")
            direction = d
        dx, dy = DIRECTIONS[direction]
        tete = (corps[0][0] + dx, corps[0][1] + dy)
        mange = tete == fruit
        reste = corps if mange else corps[:-1]
        mort = not (0 <= tete[0] < TAILLE and 0 <= tete[1] < TAILLE) or tete in reste
        duree += intervalle_ms(fruits)
        if mort:
            if tick != ticks - 1 or changements:
                raise ErreurApi("Partie invalide.")
            return score, fruits, duree
        corps = [tete] + reste
        if mange:
            fruits += 1
            score += POINTS_OR if fruits % 5 == 0 else POINTS_FRUIT
            if len(corps) == TAILLE * TAILLE:
                return score, fruits, duree
            fruit = placer_fruit(alea, corps)
    raise ErreurApi("Partie invalide : le serpent est toujours vivant.")


def debut(joueur, donnees):
    graine = secrets.randbits(32)
    pid = nouvelle_partie(joueur, "snake", "normal", {"graine": graine})
    return {"partie": pid, "graine": graine}


def fin(joueur, donnees):
    partie, etat = lire_partie(joueur, donnees.get("partie"), "snake")
    try:
        ticks = int(donnees.get("ticks"))
        entrees = [(int(t), int(d)) for t, d in donnees.get("entrees", [])]
    except (TypeError, ValueError):
        raise ErreurApi("Partie invalide.")
    if not 0 < ticks <= MAX_TICKS:
        raise ErreurApi("Partie invalide.")
    score, fruits, duree_ms = rejouer(etat["graine"], entrees, ticks)
    # Une partie jouée plus vite que la vitesse du serpent le permet a été simulée.
    if maintenant() - partie["debut"] < duree_ms / 1000 * 0.8 - 1:
        raise ErreurApi("Partie trop rapide pour être vraie.")
    resultat = terminer_partie(joueur, partie, score, score // 10)
    resultat.update(fruits=fruits)
    return {"fin": resultat}


ROUTES = {"/api/snake/debut": debut, "/api/snake/fin": fin}
