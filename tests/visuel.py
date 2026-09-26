"""Test visuel : un robot joue aux 9 jeux et à un duel en ligne dans Chromium, prend des captures et filme chaque jeu.

Prérequis : pip install playwright, et un serveur lancé sur une base de test :
    MINIJEUX_BASE=/tmp/test.db python server.py
    MINIJEUX_BASE=/tmp/test.db python tests/visuel.py [dossier_de_sortie] [jeu ...]
(la même base permet au robot de créditer des pièces au compte de test).
Pour les démonstrations, le robot déclenche lui-même certains bonus rares (flipper en feu, multibille).
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
        c.appel("/api/flipper/fin", {"partie": r["partie"], "score": random.randrange(80000, 400000, 10)})
        for jeu, res in (("tetris", {"score": random.randrange(2000, 9000, 10), "lignes": random.randint(10, 30)}),
                         ("runner", {"score": random.randrange(1500, 4000), "distance": 1200, "pieces": 60})):
            _, r = c.appel(f"/api/{jeu}/debut", {})
            sql("UPDATE parties SET debut = debut - 300 WHERE id = ?", r["partie"])
            c.appel(f"/api/{jeu}/fin", {"partie": r["partie"], **res})


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
        if e["file"] or e["n"] >= 12:  # après 12 fruits, le robot fonce dans le mur
            page.wait_for_timeout(20)
            continue
        corps = [tuple(c) for c in e["c"]]
        hx, hy = corps[0]

        def sure(d):
            nx, ny = hx + dirs[d][0], hy + dirs[d][1]
            if not (0 <= nx < 15 and 0 <= ny < 15) or (nx, ny) in corps[:-1]:
                return False
            vus, pile, bloque = {(nx, ny)}, [(nx, ny)], set(corps[:-1])
            while pile and len(vus) < len(corps) + 5:
                x, y = pile.pop()
                for dx, dy in dirs:
                    v = (x + dx, y + dy)
                    if 0 <= v[0] < 15 and 0 <= v[1] < 15 and v not in bloque and v not in vus:
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


def jouer_flipper(page, duree_max=45):
    page.goto(URL + "/flipper.html")
    page.wait_for_timeout(500)
    capture(page, "flipper-accueil")
    page.click("#btn-jouer", force=True)
    page.wait_for_function("jeu && jeu.billes.length")
    debut = time.time()
    actifs = {"g": 0.0, "d": 0.0}
    captures, declenche = 0, set()
    while True:
        e = page.evaluate("({b: jeu.billes.map(b => [b.p[0], b.p[1], b.v[1]]), l: jeu.lanceurOccupe, fini: jeu.fini})")
        if e["fini"]:
            break
        maintenant = time.time()
        ecoule = maintenant - debut
        joue = ecoule < duree_max
        if e["l"]:
            page.keyboard.down("Space")
            page.wait_for_timeout(random.randint(600, 1000))
            page.keyboard.up("Space")
            continue
        # démonstration : on déclenche la bille en feu puis le multibille
        if ecoule > 6 and "feu" not in declenche:
            declenche.add("feu")
            page.evaluate("jeu.fievre = FIEVRE_MAX - 1")
        if ecoule > 18 and "multi" not in declenche:
            declenche.add("multi")
            page.evaluate("lancerMultibille()")
        for cote, touche in (("g", "ArrowLeft"), ("d", "ArrowRight")):
            proche = any(y > 655 and vy > -50 and ((cote == "g" and 110 < x < 222) or (cote == "d" and 222 <= x < 335))
                         for x, y, vy in e["b"])
            if joue and proche and actifs[cote] == 0:
                page.keyboard.down(touche)
                actifs[cote] = maintenant
            elif actifs[cote] and maintenant - actifs[cote] > 0.18:
                page.keyboard.up(touche)
                actifs[cote] = 0.0
        if captures < 3 and ecoule > 9 + captures * 10:
            captures += 1
            capture(page, f"flipper-jeu-{captures}")
        page.wait_for_timeout(8)
    page.wait_for_timeout(1000)
    capture(page, "flipper-game-over")
    roue_et_resultat(page, "flipper")


def jouer_candy(page):
    page.goto(URL + "/candy.html")
    page.wait_for_timeout(500)
    page.click("#btn-jouer", force=True)
    page.wait_for_timeout(1200)
    for n in range(20):
        coup = page.evaluate("""() => {
          const g = grille, N = 8;
          let best = null;
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [dx, dy] of [[1,0],[0,1]]) {
            if (x + dx >= N || y + dy >= N) continue;
            if (g[y][x][1] && g[y+dy][x+dx][1]) return [[x,y],[x+dx,y+dy]];
            const t = g.map(l => l.map(v => v.slice()));
            const a = t[y][x]; t[y][x] = t[y+dy][x+dx]; t[y+dy][x+dx] = a;
            let n = 0;
            for (let j = 0; j < N; j++) for (let i = 0; i < N - 2; i++) if (t[j][i][0] >= 0 && t[j][i][0] === t[j][i+1][0] && t[j][i][0] === t[j][i+2][0]) n++;
            for (let i = 0; i < N; i++) for (let j = 0; j < N - 2; j++) if (t[j][i][0] >= 0 && t[j][i][0] === t[j+1][i][0] && t[j][i][0] === t[j+2][i][0]) n++;
            if (n && (!best || n > best[0])) best = [n, [x,y], [x+dx,y+dy]];
          }
          return best && [best[1], best[2]]; }""")
        if not coup:
            break
        (ax, ay), (bx, by) = coup
        page.locator(".case-c").nth(ay * 8 + ax).click()
        page.locator(".case-c").nth(by * 8 + bx).click()
        page.wait_for_function("!occupe", timeout=20000)
        if n in (4, 12):
            capture(page, f"candy-coup-{n}")
        if page.locator(".fenetre").count():
            break
    roue_et_resultat(page, "candy")


def jouer_tetris(page, pieces_max=70):
    page.goto(URL + "/tetris.html")
    page.wait_for_timeout(400)
    page.click("#btn-jouer", force=True)
    page.wait_for_function("jeu && jeu.piece")
    n = 0
    while not page.evaluate("jeu.fini"):
        if n >= pieces_max:  # assez joué : on lâche les pièces sans les placer jusqu'à la fin
            page.keyboard.press("Space")
            page.wait_for_timeout(120)
            continue
        coup = page.evaluate("""() => {
          const p = jeu.piece; let best = null; let m = p.m;
          for (let r = 0; r < 4; r++) {
            for (let x = -3; x < 11; x++) {
              if (collision(m, x, p.y)) continue;
              let y = p.y; while (!collision(m, x, y + 1)) y++;
              const g = jeu.grille.map(l => l.slice());
              m.forEach((l, j) => l.forEach((v, i) => { if (v && y + j >= 0) g[y + j][x + i] = 1; }));
              let lignes = 0, trous = 0, haut = 0, bosses = 0; const hs = [];
              for (let j = 0; j < 20; j++) if (g[j].every(Boolean)) lignes++;
              for (let i = 0; i < 10; i++) { let vu = false, h = 0; for (let j = 0; j < 20; j++) { if (g[j][i]) { if (!vu) h = 20 - j; vu = true; } else if (vu) trous++; } hs.push(h); haut += h; }
              for (let i = 0; i < 9; i++) bosses += Math.abs(hs[i] - hs[i+1]);
              const note = lignes * 8 - trous * 7 - haut * 0.5 - bosses * 0.4;
              if (!best || note > best.note) best = { note, r, x };
            }
            m = tourner(m, 1);
          }
          return best; }""")
        if not coup:
            page.keyboard.press("Space")
            continue
        for _ in range(coup["r"]):
            page.keyboard.press("ArrowUp")
        dx = coup["x"] - page.evaluate("jeu.piece.x")
        for _ in range(abs(dx)):
            page.keyboard.press("ArrowRight" if dx > 0 else "ArrowLeft")
        page.wait_for_timeout(90)
        page.keyboard.press("Space")
        page.wait_for_timeout(110)
        n += 1
        if n in (25, 60):
            capture(page, f"tetris-{n}-pieces")
    page.wait_for_timeout(600)
    capture(page, "tetris-game-over")
    roue_et_resultat(page, "tetris")


def jouer_runner(page, duree_max=40):
    page.goto(URL + "/runner.html")
    page.wait_for_timeout(500)
    capture(page, "runner-accueil")
    page.click("#btn-jouer", force=True)
    page.wait_for_function("jeu && jeu.compte === 0", timeout=10000)
    debut, captures = time.time(), 0
    while True:
        e = page.evaluate("""() => ({fini: jeu.fini, voie: jeu.voie, y: jeu.y, obs: jeu.objets.filter(o => o.type !== 'piece'
            && o.type !== 'bonus' && o.z + o.long > -0.5 && o.z < 14).map(o => [o.type, o.voie, o.z, o.long])})""")
        if e["fini"]:
            break
        if time.time() - debut < duree_max:  # ensuite, le robot arrête d'esquiver
            danger = [o for o in e["obs"] if o[1] == e["voie"]]
            if danger:
                typ, v, z, lg = min(danger, key=lambda o: o[2])
                if typ == "train":
                    libres = [w for w in range(3) if not any(o[1] == w and o[0] == "train" for o in e["obs"])]
                    if libres:
                        cible = min(libres, key=lambda w: abs(w - e["voie"]))
                        page.keyboard.press("ArrowLeft" if cible < e["voie"] else "ArrowRight")
                elif typ == "basse" and z < 3.5 and e["y"] < 0.05:
                    page.keyboard.press("ArrowUp")
                elif typ == "haute" and z < 3.0:
                    page.keyboard.press("ArrowDown")
        if captures < 3 and time.time() - debut > 5 + captures * 9:
            captures += 1
            capture(page, f"runner-course-{captures}")
        page.wait_for_timeout(30)
    page.wait_for_timeout(400)
    capture(page, "runner-crash")
    roue_et_resultat(page, "runner")


def jouer_duels(nav, taille, etat_a, etat_b):
    """Deux navigateurs, deux joueurs : un duel d'échecs (mat du berger) puis un duel de bataille navale."""
    ctx_a = nav.new_context(viewport=taille, storage_state=etat_a, record_video_dir=str(SORTIE / "videos"), record_video_size=taille)
    ctx_b = nav.new_context(viewport=taille, storage_state=etat_b)
    a, b = ctx_a.new_page(), ctx_b.new_page()
    for p in (a, b):
        p.on("pageerror", lambda e: print("ERREUR JS :", e, flush=True))
        p.on("dialog", lambda d: d.accept())
    b.goto(URL + "/duels.html")   # le rival est dans le salon
    a.goto(URL + "/duels.html")
    a.wait_for_timeout(1200)
    a.click("#choix-jeu button[data-jeu=echecs]")
    a.click("#btn-defi")
    b.wait_for_selector(".ligne-duel .bouton.vert", timeout=10000)
    b.wait_for_timeout(500)
    capture(b, "duels-salon")
    b.click(".ligne-duel .bouton.vert")
    a.wait_for_url("**/echecs.html?duel=*", timeout=15000)
    b.wait_for_url("**/echecs.html?duel=*", timeout=15000)
    a.wait_for_function("vueDuel && vueDuel.statut === 'en_cours'")
    b.wait_for_function("vueDuel && vueDuel.statut === 'en_cours'")
    blancs, noirs = (a, b) if a.evaluate("vueDuel.couleur") == "blancs" else (b, a)
    ecran = lambda page, sq: page.locator(".case-e").nth(63 - sq if page.evaluate("retourne") else sq)
    for joueur, (de, vers) in [(blancs, (52, 36)), (noirs, (12, 28)), (blancs, (61, 34)), (noirs, (1, 18)),
                               (blancs, (59, 31)), (noirs, (6, 21)), (blancs, (31, 13))]:
        joueur.wait_for_function("vueDuel && vueDuel.mon_tour", timeout=15000)
        ecran(joueur, de).click()
        joueur.wait_for_timeout(300)
        ecran(joueur, vers).click()
        joueur.wait_for_timeout(900)
        if (de, vers) == (6, 21):
            capture(noirs, "duel-echecs-vu-des-noirs")
    a.wait_for_selector("#r-rejouer", timeout=15000)
    b.wait_for_selector("#r-rejouer", timeout=15000)
    a.wait_for_timeout(2500)
    capture(blancs, "duel-echecs-victoire")
    capture(noirs, "duel-echecs-defaite")

    # duel de bataille navale
    a.goto(URL + "/duels.html")
    b.goto(URL + "/duels.html")
    a.wait_for_timeout(800)
    a.click("#choix-jeu button[data-jeu=bataille]")
    a.click("#btn-defi")
    b.wait_for_selector(".ligne-duel .bouton.vert", timeout=10000)
    b.click(".ligne-duel .bouton.vert")
    for p in (a, b):
        p.wait_for_url("**/bataille.html?duel=*", timeout=15000)
        p.wait_for_function("vueDuel && vueDuel.statut === 'en_cours'")
        p.click("#btn-hasard")
        p.wait_for_timeout(300)
        p.click("#btn-lancer")
    for p in (a, b):
        p.wait_for_function("vueDuel && vueDuel.phase === 'tir'", timeout=15000)
    def viser(v):
        """Chasse : autour des touches non coulées, sinon en damier (jamais à côté d'un navire coulé)."""
        tires = {(t[0], t[1]) for t in v["mes_tirs"]}
        coulees = {(bt["x"] + (0 if bt["vertical"] else k), bt["y"] + (k if bt["vertical"] else 0))
                   for bt in v["coules_adverses"] for k in range(bt["taille"])}
        interdites = {(x + dx, y + dy) for x, y in coulees for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        touches = [(t[0], t[1]) for t in v["mes_tirs"] if t[2] == "touche" and (t[0], t[1]) not in coulees]
        cand = [(x + dx, y + dy) for x, y in touches for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        if len(touches) >= 2:
            if len({t[1] for t in touches}) == 1:
                cand = [c for c in cand if c[1] == touches[0][1]]
            else:
                cand = [c for c in cand if c[0] == touches[0][0]]
        ok = lambda c: 0 <= c[0] < 10 and 0 <= c[1] < 10 and c not in tires and c not in interdites
        cand = [c for c in cand if ok(c)]
        if not cand:
            libres = [(x, y) for y in range(10) for x in range(10) if ok((x, y))]
            cand = [c for c in libres if (c[0] + c[1]) % 2 == 0] or libres
        return random.choice(cand)

    n = 0
    while not a.evaluate("vueDuel.statut === 'termine'") and n < 250:
        joueur = a if a.evaluate("vueDuel.mon_tour") else b if b.evaluate("vueDuel.mon_tour") else None
        if joueur is None:
            a.wait_for_timeout(200)
            continue
        x, y = viser(joueur.evaluate("vueDuel"))
        joueur.locator("#grille-ennemi .case-mer").nth(y * 10 + x).click()
        joueur.wait_for_timeout(150)
        n += 1
        if n == 40:
            capture(a, "duel-bataille-en-cours")
    a.wait_for_selector("#r-rejouer", timeout=15000)
    a.wait_for_timeout(2500)
    capture(a, "duel-bataille-fin")
    video = a.video
    ctx_a.close()
    ctx_b.close()
    video.save_as(str(SORTIE / "videos" / "duels.webm"))
    video.delete()


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
        sql("UPDATE joueurs SET pieces = 400 WHERE pseudo = 'Sylvain'")
        etat = ctx.storage_state()
        ctx.close()
        ctx = nav.new_context(viewport=taille)  # un deuxième joueur pour les duels
        page = ctx.new_page()
        page.goto(URL)
        page.click("#btn-connexion")
        page.fill("#f-pseudo", "Rival")
        page.fill("#f-mdp", "motdepasse")
        page.click("#f-valider")
        page.wait_for_selector("#bourse")
        sql("UPDATE joueurs SET pieces = 400 WHERE pseudo = 'Rival'")
        etat_rival = ctx.storage_state()
        ctx.close()

        # un contexte (et donc une vidéo) par jeu
        seuls = sys.argv[2:]  # on peut ne lancer que certains jeux
        for nom, robot in [("runner", jouer_runner), ("candy", jouer_candy), ("tetris", jouer_tetris), ("flipper", jouer_flipper),
                           ("memory", jouer_memory), ("bataille", jouer_bataille), ("snake", jouer_snake),
                           ("demineur", jouer_demineur), ("echecs", jouer_echecs)]:
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

        if not seuls or "duels" in seuls:
            try:
                jouer_duels(nav, taille, etat, etat_rival)
            except Exception as e:
                print("ÉCHEC du robot duels :", e, flush=True)

        ctx = nav.new_context(viewport=taille, storage_state=etat)
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_timeout(900)
        capture(page, "accueil-connecte")
        page.hover(".menu-jeux")
        page.wait_for_timeout(300)
        capture(page, "menu-des-jeux")
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
        for nom in ["", "runner.html", "candy.html", "tetris.html", "flipper.html"]:
            m.goto(URL + "/" + nom)
            m.wait_for_timeout(700)
            capture(m, "mobile-" + (nom.replace(".html", "") or "accueil"))
        nav.close()


if __name__ == "__main__":
    main()
