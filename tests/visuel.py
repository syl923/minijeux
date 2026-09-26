"""Test visuel : un robot joue aux 6 jeux dans Chromium, prend des captures d'écran et filme chaque jeu.

Prérequis : pip install playwright, et un serveur lancé sur une base de test :
    MINIJEUX_BASE=/tmp/test.db python server.py
    MINIJEUX_BASE=/tmp/test.db python tests/visuel.py [dossier_de_sortie]
(la même base permet au robot de créditer des pièces au compte de test).
"""

import os
import random
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright  # noqa: E402

import robots  # noqa: E402

URL = "http://localhost:8000"
robots.URL = URL
SORTIE = Path(sys.argv[1] if len(sys.argv) > 1 else "captures")
SORTIE.mkdir(parents=True, exist_ok=True)
BASE = os.environ["MINIJEUX_BASE"]
n_capture = 0


def capture(page, nom):
    global n_capture
    n_capture += 1
    chemin = SORTIE / f"{n_capture:02d}-{nom}.png"
    page.screenshot(path=str(chemin))
    print("capture", chemin, flush=True)


def sql(requete, *args):
    with sqlite3.connect(BASE) as c:
        return c.execute(requete, args).fetchall()


def joueurs_fictifs():
    """Joueurs de démonstration pour remplir les classements (base de test uniquement)."""
    for pseudo in ["Demo_Pikachu", "Demo_Zelda", "Demo_Mario"]:
        c = robots.Client(URL)
        if c.appel("/api/inscription", {"pseudo": pseudo, "mot_de_passe": "demo123"})[0] != 200:
            continue
        sql("UPDATE joueurs SET pieces = 500, dernier_tour_gratuit = '2999-01-01' WHERE pseudo = ?", pseudo)
        robots.jouer_memory(c, random.choice(["facile", "difficile"]))
        _, r = c.appel("/api/snake/debut", {})
        entrees, ticks = robots.bot_snake(r["graine"])
        sql("UPDATE parties SET debut = debut - 600 WHERE id = ?", r["partie"])
        c.appel("/api/snake/fin", {"partie": r["partie"], "entrees": entrees, "ticks": ticks})
        _, r = c.appel("/api/flipper/debut", {})
        sql("UPDATE parties SET debut = debut - 300 WHERE id = ?", r["partie"])
        c.appel("/api/flipper/fin", {"partie": r["partie"], "score": random.randrange(20000, 90000, 10)})


# ------------------------------------------------------------ robots dans le navigateur

def roue_et_resultat(page, prefixe):
    """Après une partie gagnée : la roue s'ouvre si le tour du jour est disponible, puis le résultat."""
    page.wait_for_selector(".fenetre", timeout=20000)
    if page.locator("#btn-lancer-roue").count():
        page.wait_for_timeout(500)
        capture(page, f"{prefixe}-roue-ouverte")
        page.click("#btn-lancer-roue", force=True)
        page.wait_for_timeout(1800)
        capture(page, f"{prefixe}-roue-qui-tourne")
        page.wait_for_function("document.querySelector('#btn-lancer-roue').textContent.includes('Continuer')", timeout=15000)
        page.wait_for_timeout(700)
        capture(page, f"{prefixe}-roue-resultat")
        page.click("#btn-lancer-roue", force=True)
    page.wait_for_selector("#r-rejouer")
    page.wait_for_timeout(2600)
    capture(page, f"{prefixe}-resultat")


def jouer_memory(page):
    page.goto(URL + "/memory.html")
    page.click("button[data-mode=facile]")
    page.wait_for_selector(".carte-memory")
    n = page.locator(".carte-memory").count()
    connues, trouvees = {}, set()

    def retourner(i):
        page.locator(".carte-memory").nth(i).click()
        page.wait_for_function(f"document.querySelectorAll('.carte-memory')[{i}].classList.contains('retournee')")
        connues[i] = page.locator(".carte-memory").nth(i).locator(".recto").inner_text()
        page.wait_for_timeout(200)
        return connues[i]

    capture_faite = False
    while len(trouvees) < n:
        paire = next(((i, j) for i in connues for j in connues
                      if i < j and i not in trouvees and j not in trouvees and connues[i] == connues[j]), None)
        if paire:
            retourner(paire[0])
            retourner(paire[1])
            trouvees |= set(paire)
        else:
            inconnues = [i for i in range(n) if i not in connues]
            a = inconnues[0]
            s = retourner(a)
            double = next((j for j in connues if j != a and j not in trouvees and connues[j] == s), None)
            b = double if double is not None else inconnues[1]
            if retourner(b) == s:
                trouvees |= {a, b}
        page.wait_for_timeout(350)
        if not capture_faite and len(trouvees) >= 4:
            page.wait_for_timeout(150)
            capture(page, "memory-chrono")
            capture_faite = True
    roue_et_resultat(page, "memory")


def jouer_bataille(page):
    page.goto(URL + "/bataille.html")
    page.wait_for_selector(".grille-mer")
    page.locator("#grille-joueur .case-mer").nth(12).hover()
    capture(page, "bataille-placement")
    page.click("#btn-hasard")
    page.wait_for_timeout(300)
    capture(page, "bataille-flotte")
    page.click("#btn-lancer")
    page.wait_for_selector("#grille-ennemi .grille-mer.cible")
    tires, touches, interdites = set(), [], set()
    n = 0
    while True:
        cand = []
        if touches:
            if len(touches) >= 2:
                xs = {t[0] for t in touches}
                ys = {t[1] for t in touches}
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
            interdites |= {(cx + dx, cy + dy) for cx, cy in cases for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        if "fin" in r:
            break
        page.wait_for_selector("#grille-ennemi .grille-mer.cible")
        n += 1
        if n in (15, 38):
            capture(page, f"bataille-combat-{n}")
    roue_et_resultat(page, "bataille")


def jouer_snake(page):
    page.goto(URL + "/snake.html")
    page.click("#btn-jouer", force=True)
    page.wait_for_function("jeu && jeu.dernier > 0", timeout=10000)
    touches = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]
    dirs = [(0, -1), (1, 0), (0, 1), (-1, 0)]
    captures = set()
    while True:
        e = page.evaluate("({c: jeu.corps, f: jeu.fruit, d: jeu.dir, fini: jeu.fini, n: jeu.fruits, file: jeu.file.length})")
        if e["fini"]:
            break
        if e["n"] in (5, 11) and e["n"] not in captures:
            captures.add(e["n"])
            page.keyboard.press("Space")  # pause pendant la capture
            page.wait_for_timeout(50)
            capture(page, f"snake-{e['n']}-fruits")
            page.keyboard.press("Space")
        if e["file"] or e["n"] >= 14:  # après 14 fruits, le robot fonce dans le mur
            page.wait_for_timeout(20)
            continue
        corps = [tuple(c) for c in e["c"]]
        hx, hy = corps[0]

        def sure(d):
            nx, ny = hx + dirs[d][0], hy + dirs[d][1]
            if not (0 <= nx < 20 and 0 <= ny < 20) or (nx, ny) in corps[:-1]:
                return False
            vus, pile, bloque = {(nx, ny)}, [(nx, ny)], set(corps[:-1])
            while pile and len(vus) < len(corps) + 5:
                x, y = pile.pop()
                for dx, dy in dirs:
                    v = (x + dx, y + dy)
                    if 0 <= v[0] < 20 and 0 <= v[1] < 20 and v not in bloque and v not in vus:
                        vus.add(v)
                        pile.append(v)
            return len(vus) >= len(corps) + 5

        fx, fy = e["f"]
        voulues = sorted(range(4), key=lambda d: abs(hx + dirs[d][0] - fx) + abs(hy + dirs[d][1] - fy))
        choix = next((d for d in voulues if d != (e["d"] + 2) % 4 and sure(d)), e["d"])
        if choix != e["d"]:
            page.keyboard.press(touches[choix])
        page.wait_for_timeout(25)
    page.wait_for_timeout(500)
    capture(page, "snake-crash")
    roue_et_resultat(page, "snake")


def jouer_demineur(page):
    page.goto(URL + "/demineur.html")
    page.wait_for_timeout(900)
    capture(page, "demineur-bombes-farceuses")
    page.click("button[data-mode=facile]")
    page.wait_for_selector(".tuile")
    L = 9
    page.locator(".tuile").nth(4 * L + 4).click()
    page.wait_for_timeout(700)
    capture_faite = False
    while not page.locator(".fenetre").count():
        etat = page.evaluate("""[...document.querySelectorAll('.tuile')].map(t =>
            t.classList.contains('vue') ? Number(t.dataset.n) : t.classList.contains('avec-drapeau') ? -2 : -1)""")
        action = None
        for i, v in enumerate(etat):
            if v <= 0:
                continue
            x, y = i % L, i // L
            vois = [(x + dx) + (y + dy) * L for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                    if (dx or dy) and 0 <= x + dx < L and 0 <= y + dy < L]
            cachees = [j for j in vois if etat[j] == -1]
            drapeaux = [j for j in vois if etat[j] == -2]
            if cachees and len(drapeaux) == v:
                action = ("clic", cachees[0])
                break
            if cachees and len(cachees) + len(drapeaux) == v:
                action = ("drapeau", cachees[0])
                break
        if action is None:
            cachees = [i for i, v in enumerate(etat) if v == -1]
            if not cachees:
                break
            action = ("clic", random.choice(cachees))
        tuile = page.locator(".tuile").nth(action[1])
        if action[0] == "drapeau":
            tuile.click(button="right")
        else:
            tuile.click()
        page.wait_for_timeout(260)
        if not capture_faite and sum(v == -2 for v in etat) >= 3:
            capture(page, "demineur-en-cours")
            capture_faite = True
        if page.locator(".explosee, .bombe-dodo").count():
            page.wait_for_timeout(1400)
            capture(page, "demineur-fin-plateau")
            break
    roue_et_resultat(page, "demineur")


def jouer_echecs(page):
    page.goto(URL + "/echecs.html")
    page.click("button[data-niveau=facile]")
    page.wait_for_selector(".case-e")
    page.on("dialog", lambda d: d.accept())
    for n in range(1, 13):
        e = page.evaluate("({coups, plateau})")
        if not e["coups"]:
            break
        prises = [c for c in e["coups"] if e["plateau"][c[1]] != "."]
        de, vers = random.choice(prises or e["coups"])
        page.locator(".case-e").nth(de).click()
        if n == 3:
            capture(page, "echecs-coups-possibles")
        page.locator(".case-e").nth(vers).click()
        page.wait_for_function("!enAttente", timeout=20000)
        page.wait_for_timeout(500)
        if page.locator(".fenetre").count():
            break
        if n in (6, 12):
            capture(page, f"echecs-coup-{n}")
    if not page.locator(".fenetre").count():
        page.click("#btn-abandon")
    roue_et_resultat(page, "echecs")


def jouer_flipper(page, duree_max=60):
    page.goto(URL + "/flipper.html")
    page.wait_for_timeout(500)
    capture(page, "flipper-accueil")
    page.click("#btn-jouer", force=True)
    page.wait_for_function("jeu && jeu.bille")
    debut = time.time()
    actifs = {"g": 0.0, "d": 0.0}
    captures = 0
    while True:
        e = page.evaluate("jeu && ({x: jeu.bille.p[0], y: jeu.bille.p[1], vy: jeu.bille.v[1], lance: jeu.dansCouloir, fini: jeu.fini})")
        if not e or e["fini"]:
            break
        maintenant = time.time()
        joue = maintenant - debut < duree_max
        if e["lance"]:
            page.keyboard.down("Space")
            page.wait_for_timeout(random.randint(600, 1000))
            page.keyboard.up("Space")
            continue
        for cote, touche in (("g", "ArrowLeft"), ("d", "ArrowRight")):
            proche = e["y"] > 655 and e["vy"] > -50 and ((cote == "g" and 110 < e["x"] < 222) or (cote == "d" and 222 <= e["x"] < 335))
            if joue and proche and actifs[cote] == 0:
                page.keyboard.down(touche)
                actifs[cote] = maintenant
            elif actifs[cote] and maintenant - actifs[cote] > 0.18:
                page.keyboard.up(touche)
                actifs[cote] = 0.0
        if captures < 3 and maintenant - debut > 8 + captures * 14:
            captures += 1
            capture(page, f"flipper-jeu-{captures}")
        page.wait_for_timeout(8)
    page.wait_for_timeout(1000)
    capture(page, "flipper-game-over")
    roue_et_resultat(page, "flipper")


def main():
    joueurs_fictifs()
    with sync_playwright() as p:
        chrome = os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium")
        nav = p.chromium.launch(executable_path=chrome if os.path.isfile(chrome) else None,
                                args=["--autoplay-policy=no-user-gesture-required"])
        taille = {"width": 1280, "height": 900}

        # inscription du joueur de test
        ctx = nav.new_context(viewport=taille)
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_timeout(600)
        capture(page, "accueil")
        page.click("#btn-connexion")
        page.fill("#f-pseudo", "Sylvain")
        page.fill("#f-mdp", "motdepasse")
        page.click("#f-valider")
        page.wait_for_selector("#bourse")
        sql("UPDATE joueurs SET pieces = 200 WHERE pseudo = 'Sylvain'")
        etat = ctx.storage_state()
        ctx.close()

        # un contexte (et donc une vidéo) par jeu
        seuls = sys.argv[2:]  # on peut ne lancer que certains jeux
        for nom, robot in [("memory", jouer_memory), ("bataille", jouer_bataille), ("snake", jouer_snake),
                           ("demineur", jouer_demineur), ("echecs", jouer_echecs), ("flipper", jouer_flipper)]:
            if seuls and nom not in seuls:
                continue
            ctx = nav.new_context(viewport=taille, storage_state=etat, record_video_dir=str(SORTIE / "videos"),
                                  record_video_size=taille)
            page = ctx.new_page()
            page.on("pageerror", lambda e: print("ERREUR JS :", e, flush=True))
            try:
                robot(page)
            except Exception as e:  # on continue avec les autres jeux, mais on le signale
                print(f"ÉCHEC du robot {nom} :", e, flush=True)
                capture(page, f"{nom}-echec")
            video = page.video
            ctx.close()
            video.save_as(str(SORTIE / "videos" / f"{nom}.webm"))
            video.delete()

        ctx = nav.new_context(viewport=taille, storage_state=etat)
        page = ctx.new_page()
        page.goto(URL + "/classement.html?jeu=flipper")
        page.wait_for_timeout(700)
        capture(page, "classement-flipper")
        page.click("button[data-jeu=fortune]")
        page.wait_for_timeout(500)
        capture(page, "classement-pieces")
        page.goto(URL + "/roue.html")
        page.wait_for_timeout(700)
        capture(page, "page-roue")
        ctx.close()

        mobile = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                                 has_touch=True, storage_state=etat)
        m = mobile.new_page()
        for nom in ["", "demineur.html", "flipper.html", "echecs.html"]:
            m.goto(URL + "/" + nom)
            m.wait_for_timeout(700)
            capture(m, "mobile-" + (nom.replace(".html", "") or "accueil"))
        nav.close()


if __name__ == "__main__":
    main()
