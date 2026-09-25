"""Test visuel : un robot joue sur le site dans Chromium et prend des captures d'écran + une vidéo.

Prérequis : pip install playwright  (et un serveur lancé : python server.py)
    python tests/visuel.py [dossier_de_sortie]
"""

import json
import os
import random
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://localhost:8000"
SORTIE = Path(sys.argv[1] if len(sys.argv) > 1 else "captures")
SORTIE.mkdir(parents=True, exist_ok=True)
n_capture = 0


def capture(page, nom):
    global n_capture
    n_capture += 1
    chemin = SORTIE / f"{n_capture:02d}-{nom}.png"
    page.screenshot(path=str(chemin))
    print("capture", chemin)


def joueurs_fictifs():
    """Quelques joueurs de démonstration pour remplir les classements (base de test uniquement)."""
    import http.cookiejar
    sys.path.insert(0, str(Path(__file__).parent))
    from test_api import jouer_memory  # noqa

    class C:
        def __init__(self):
            self.o = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

        def appel(self, chemin, donnees=None):
            req = urllib.request.Request(URL + chemin, data=None if donnees is None else json.dumps(donnees).encode(),
                                         headers={"Content-Type": "application/json"})
            try:
                with self.o.open(req) as r:
                    return r.status, json.loads(r.read())
            except urllib.error.HTTPError as e:
                return e.code, json.loads(e.read())

    import test_api
    test_api.URL = URL
    for pseudo in ["Demo_Pikachu", "Demo_Zelda", "Demo_Mario"]:
        c = C()
        if c.appel("/api/inscription", {"pseudo": pseudo, "mot_de_passe": "demo123"})[0] != 200:
            continue
        for _ in range(random.randint(1, 3)):
            jouer_memory(c, random.choice(["facile", "difficile"]))


def jouer_memory(page):
    page.goto(URL + "/memory.html")
    page.click("button[data-mode=facile]")
    page.wait_for_selector(".carte-memory")
    n = page.locator(".carte-memory").count()
    connues = {}
    trouvees = set()

    def retourner(i):
        carte = page.locator(".carte-memory").nth(i)
        carte.click()
        page.wait_for_function(f"document.querySelectorAll('.carte-memory')[{i}].classList.contains('retournee')")
        connues[i] = carte.locator(".recto").inner_text()
        page.wait_for_timeout(250)
        return connues[i]

    capture_faite = False
    while len(trouvees) < n:
        paire = next(((i, j) for i in connues for j in connues
                      if i < j and i not in trouvees and j not in trouvees and connues[i] == connues[j]), None)
        if paire:
            retourner(paire[0]); retourner(paire[1])
            trouvees |= set(paire)
        else:
            inconnues = [i for i in range(n) if i not in connues]
            a = inconnues[0]
            s = retourner(a)
            double = next((j for j in connues if j != a and j not in trouvees and connues[j] == s), None)
            b = double if double is not None else inconnues[1]
            s2 = retourner(b)
            if s2 == s:
                trouvees |= {a, b}
        page.wait_for_timeout(450)
        if not capture_faite and len(trouvees) >= 6:
            capture(page, "memory-en-cours")
            capture_faite = True
    page.wait_for_selector(".fenetre")
    page.wait_for_timeout(2500)
    capture(page, "memory-resultat")


def jouer_bataille(page):
    page.goto(URL + "/bataille.html")
    page.wait_for_selector(".grille-mer")
    # Placement manuel des deux premiers navires pour montrer l'aperçu, puis hasard
    capture(page, "bataille-placement-vide")
    page.click("#btn-hasard")
    page.wait_for_timeout(400)
    page.locator("#grille-joueur .case-mer").nth(0).hover()
    capture(page, "bataille-flotte-placee")
    page.click("#btn-lancer")
    page.wait_for_selector("#grille-ennemi .grille-mer.cible")

    tires, touches, interdites = set(), [], set()
    captures = 0
    while True:
        # même stratégie que l'ordinateur : viser autour des touches, sinon damier
        cand = []
        if touches:
            if len(touches) >= 2:
                xs = {t[0] for t in touches}; ys = {t[1] for t in touches}
                cand = ([(min(xs) - 1, touches[0][1]), (max(xs) + 1, touches[0][1])] if len(ys) == 1
                        else [(touches[0][0], min(ys) - 1), (touches[0][0], max(ys) + 1)])
            else:
                x, y = touches[0]
                cand = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        cand = [c for c in cand if 0 <= c[0] < 10 and 0 <= c[1] < 10 and c not in tires and c not in interdites]
        if not cand:
            libres = [(x, y) for x in range(10) for y in range(10) if (x, y) not in tires and (x, y) not in interdites]
            cand = [c for c in libres if (c[0] + c[1]) % 2 == 0] or libres
        x, y = random.choice(cand)
        tires.add((x, y))
        with page.expect_response("**/api/bataille/tir") as info:
            page.locator("#grille-ennemi .case-mer").nth(y * 10 + x).click()
        r = info.value.json()
        res = r["joueur"]["resultat"]
        if res == "touche":
            touches.append((x, y))
        elif res == "coule":
            b = r["joueur"]["coule"]
            cases = [(b["x"] + (0 if b["vertical"] else k), b["y"] + (k if b["vertical"] else 0)) for k in range(b["taille"])]
            touches = [t for t in touches if t not in cases]
            for cx, cy in cases:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        interdites.add((cx + dx, cy + dy))
        if "fin" in r:
            break
        page.wait_for_selector("#grille-ennemi .grille-mer.cible")
        if len(tires) in (12, 35) and captures < 2:
            captures += 1
            capture(page, f"bataille-combat-{captures}")
    page.wait_for_selector(".fenetre")
    page.wait_for_timeout(2500)
    capture(page, "bataille-resultat")
    page.click("#voile", position={"x": 5, "y": 5})
    capture(page, "bataille-fin-grilles")


def main():
    joueurs_fictifs()
    with sync_playwright() as p:
        # Chromium préinstallé (environnement cloud) si présent, sinon celui de Playwright
        chrome = os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium")
        nav = p.chromium.launch(executable_path=chrome if os.path.isfile(chrome) else None)
        ctx = nav.new_context(viewport={"width": 1280, "height": 860}, record_video_dir=str(SORTIE / "video"),
                              record_video_size={"width": 1280, "height": 860})
        page = ctx.new_page()
        page.on("pageerror", lambda e: print("ERREUR JS :", e))

        page.goto(URL)
        page.wait_for_timeout(600)
        capture(page, "accueil")

        page.click("#btn-connexion")
        page.fill("#f-pseudo", "Sylvain")
        page.fill("#f-mdp", "motdepasse")
        capture(page, "inscription")
        page.click("#f-valider")
        page.wait_for_selector("#bourse")

        page.goto(URL + "/roue.html")
        page.wait_for_timeout(500)
        capture(page, "roue")
        page.click("#btn-tourner")
        page.wait_for_timeout(1500)
        capture(page, "roue-qui-tourne")
        page.wait_for_selector(".fenetre", timeout=10000)
        page.wait_for_timeout(600)
        capture(page, "roue-resultat")

        jouer_memory(page)
        jouer_bataille(page)

        page.goto(URL + "/classement.html")
        page.wait_for_timeout(700)
        capture(page, "classement-memory")
        page.click("button[data-jeu=fortune]")
        page.wait_for_timeout(500)
        capture(page, "classement-pieces")
        ctx.close()

        # Aperçu téléphone
        mobile = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        m = mobile.new_page()
        m.goto(URL + "/bataille.html")
        m.click("#btn-hasard")
        m.wait_for_timeout(400)
        capture(m, "mobile-bataille")
        m.goto(URL)
        m.wait_for_timeout(500)
        capture(m, "mobile-accueil")
        nav.close()


if __name__ == "__main__":
    main()
