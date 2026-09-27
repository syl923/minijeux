"""Robots joueurs partagés par les tests de l'API et le test visuel."""

import http.cookiejar
import json
import urllib.error
import urllib.request

from jeux import snake

URL = "http://127.0.0.1:8000"


class Client:
    def __init__(self, url=None):
        self.url = url or URL
        self.ouvreur = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def appel(self, chemin, donnees=None):
        corps = None if donnees is None else json.dumps(donnees).encode()
        req = urllib.request.Request(self.url + chemin, data=corps, headers={"Content-Type": "application/json"})
        try:
            with self.ouvreur.open(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


def _espace_libre(depart, obstacles):
    """Nombre de cases atteignables depuis `depart` (remplissage)."""
    vus, pile = {depart}, [depart]
    while pile:
        x, y = pile.pop()
        for dx, dy in snake.DIRECTIONS:
            v = (x + dx, y + dy)
            if 0 <= v[0] < snake.TAILLE and 0 <= v[1] < snake.TAILLE and v not in obstacles and v not in vus:
                vus.add(v)
                pile.append(v)
    return len(vus)


def bot_snake(graine):
    """Joue au snake en allant vers les fruits (sans s'enfermer), puis fonce dans un mur. Renvoie (entrées, ticks)."""
    alea = snake.mulberry32(graine)
    corps = list(snake.DEPART)
    direction, fruit = 1, snake.placer_fruit(alea, corps)
    entrees, fruits, tick = [], 0, 0
    while fruits < 8 and tick < 3000:
        tx, ty = fruit
        hx, hy = corps[0]
        voulue = 1 if tx > hx else 3 if tx < hx else 2 if ty > hy else 0
        possibles = []
        for d in [voulue] + [d for d in range(4) if d != voulue]:
            if d == (direction + 2) % 4:
                continue
            n = (hx + snake.DIRECTIONS[d][0], hy + snake.DIRECTIONS[d][1])
            if 0 <= n[0] < snake.TAILLE and 0 <= n[1] < snake.TAILLE and n not in corps[:-1]:
                possibles.append((d, _espace_libre(n, set(corps[:-1]))))
        if not possibles:
            break  # plus aucune case sûre : on passe au suicide ci-dessous
        sures = [d for d, place in possibles if place >= len(corps)]
        d = sures[0] if sures else max(possibles, key=lambda p: p[1])[0]
        if d != direction:
            entrees.append([tick, d])
            direction = d
        dx, dy = snake.DIRECTIONS[direction]
        tete = (hx + dx, hy + dy)
        corps = [tete] + (corps if tete == fruit else corps[:-1])
        if tete == fruit:
            fruits += 1
            fruit = snake.placer_fruit(alea, corps)
        tick += 1
    # suicide : on continue tout droit jusqu'au mur (ou au corps)
    while True:
        dx, dy = snake.DIRECTIONS[direction]
        tete = (corps[0][0] + dx, corps[0][1] + dy)
        tick += 1
        if not (0 <= tete[0] < snake.TAILLE and 0 <= tete[1] < snake.TAILLE) or tete in corps[:-1]:
            return entrees, tick
        corps = [tete] + (corps if tete == fruit else corps[:-1])
        if tete == fruit:
            fruit = snake.placer_fruit(alea, corps)


def jouer_memory(c, mode="facile"):
    code, r = c.appel("/api/memory/debut", {"mode": mode})
    assert code == 200, r
    partie, n = r["partie"], r["nb_cartes"]
    connues = {}
    # 1re passe : on découvre les cartes deux par deux
    for i in range(0, n, 2):
        _, a = c.appel("/api/memory/retourner", {"partie": partie, "index": i})
        _, b = c.appel("/api/memory/retourner", {"partie": partie, "index": i + 1})
        connues[i], connues[i + 1] = a["symbole"], b["symbole"]
        if b.get("fin"):
            return b
    # 2e passe : on associe les paires restantes
    trouvees = set()
    for i in range(0, n, 2):
        if connues[i] == connues[i + 1]:
            trouvees |= {i, i + 1}
    restantes = [i for i in range(n) if i not in trouvees]
    while restantes:
        i = restantes.pop(0)
        j = next(k for k in restantes if connues[k] == connues[i])
        restantes.remove(j)
        c.appel("/api/memory/retourner", {"partie": partie, "index": i})
        _, r = c.appel("/api/memory/retourner", {"partie": partie, "index": j})
        assert r["paire"]
    return r
