"""Tests de l'API : lance un serveur sur une base temporaire et joue des parties complètes.

    python -m unittest discover tests
"""

import json
import os
import sys
import tempfile
import threading
import unittest

os.environ["MINIJEUX_BASE"] = os.path.join(tempfile.mkdtemp(), "test.db")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402
import noyau  # noqa: E402
from jeux import bataille, echecs, snake  # noqa: E402
import robots  # noqa: E402
from robots import bot_snake, jouer_memory  # noqa: E402

httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Gestionnaire)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
robots.URL = f"http://127.0.0.1:{httpd.server_port}"
Client = robots.Client


def nouveau_joueur(pseudo, pieces=None):
    c = Client()
    code, r = c.appel("/api/inscription", {"pseudo": pseudo, "mot_de_passe": "secret123"})
    assert code == 200, r
    if pieces is not None:
        with noyau.db:
            noyau.db.execute("UPDATE joueurs SET pieces = ? WHERE pseudo = ?", (pieces, pseudo))
    return c, r["joueur"]


def etat_partie(pid):
    return json.loads(noyau.db.execute("SELECT etat FROM parties WHERE id = ?", (pid,)).fetchone()[0])


class TestApi(unittest.TestCase):
    def test_comptes(self):
        c, j = nouveau_joueur("Alice")
        self.assertEqual(j["pieces"], noyau.OR_BIENVENUE)
        self.assertEqual(Client().appel("/api/inscription", {"pseudo": "alice", "mot_de_passe": "xxxxxx"})[0], 400)
        self.assertEqual(Client().appel("/api/connexion", {"pseudo": "ALICE", "mot_de_passe": "mauvais"})[0], 400)
        self.assertEqual(Client().appel("/api/connexion", {"pseudo": "ALICE", "mot_de_passe": "secret123"})[0], 200)
        self.assertEqual(Client().appel("/api/memory/debut", {"mode": "facile"})[0], 401)
        self.assertEqual(Client().appel("/api/inscription", {"pseudo": "<script>", "mot_de_passe": "secret123"})[0], 400)

    def test_mise_et_secours(self):
        c, _ = nouveau_joueur("Fauche", pieces=15)
        self.assertEqual(c.appel("/api/memory/debut", {"mode": "facile"})[0], 200)
        self.assertEqual(c.appel("/api/moi")[1]["joueur"]["pieces"], 5)
        self.assertEqual(c.appel("/api/memory/debut", {"mode": "facile"})[0], 402)
        code, r = c.appel("/api/secours", {})
        self.assertEqual((code, r["joueur"]["pieces"]), (200, 5 + noyau.SECOURS))
        self.assertEqual(c.appel("/api/secours", {})[0], 400)  # une fois par jour

    def test_memory(self):
        c, _ = nouveau_joueur("Bob")
        fin = jouer_memory(c)["fin"]
        self.assertTrue(fin["victoire"])
        self.assertGreater(fin["score"], 0)
        self.assertEqual(fin["joueur"]["pieces"], noyau.OR_BIENVENUE - noyau.MISE + fin["pieces"])
        _, lig = Client().appel("/api/classement?jeu=memory&periode=semaine")
        self.assertIn("Bob", [l["pseudo"] for l in lig["lignes"]])

    def test_memory_chrono(self):
        c, _ = nouveau_joueur("Lent")
        _, r = c.appel("/api/memory/debut", {"mode": "facile"})
        self.assertEqual(c.appel("/api/memory/temps_ecoule", {"partie": r["partie"]})[0], 400)  # trop tôt
        with noyau.db:  # on recule l'heure de début de 30 s
            noyau.db.execute("UPDATE parties SET debut = debut - 30 WHERE id = ?", (r["partie"],))
        code, t = c.appel("/api/memory/retourner", {"partie": r["partie"], "index": 0})
        self.assertEqual(code, 200)
        self.assertFalse(t["fin"]["victoire"])
        self.assertEqual(t["fin"]["pieces"], 0)

    def test_memory_triche(self):
        c, _ = nouveau_joueur("Tricheur")
        _, r = c.appel("/api/memory/debut", {"mode": "facile"})
        self.assertEqual(c.appel("/api/memory/retourner", {"partie": r["partie"], "index": 99})[0], 400)
        c.appel("/api/memory/retourner", {"partie": r["partie"], "index": 0})
        self.assertEqual(c.appel("/api/memory/retourner", {"partie": r["partie"], "index": 0})[0], 400)
        autre, _ = nouveau_joueur("Voleur")
        self.assertEqual(autre.appel("/api/memory/retourner", {"partie": r["partie"], "index": 1})[0], 404)

    def test_bataille(self):
        c, _ = nouveau_joueur("Amiral")
        mauvaise = [{"x": 0, "y": 0, "taille": 5, "vertical": False}] * 5
        self.assertEqual(c.appel("/api/bataille/debut", {"flotte": mauvaise})[0], 400)
        code, r = c.appel("/api/bataille/debut", {"flotte": bataille.flotte_aleatoire()})
        self.assertEqual(code, 200)
        partie = r["partie"]
        for y in range(10):
            for x in range(10):
                code, t = c.appel("/api/bataille/tir", {"partie": partie, "x": x, "y": y})
                self.assertEqual(code, 200, t)
                if "fin" in t:
                    self.assertIn("victoire", t["fin"])
                    self.assertEqual(c.appel("/api/bataille/tir", {"partie": partie, "x": 9, "y": 9})[0], 400)
                    return
        self.fail("La partie ne s'est pas terminée")

    def test_ia_bataille_toujours_legale(self):
        for _ in range(30):
            etat = {"flotte_joueur": bataille.flotte_aleatoire(), "tirs_ia": [], "touches_ia": [], "coules_ia": []}
            for _ in range(100):
                x, y = bataille.ia_choisir(etat)
                self.assertNotIn([x, y], etat["tirs_ia"])
                res, coule = bataille.tirer(etat["flotte_joueur"], etat["tirs_ia"], x, y)
                if res == "touche":
                    etat["touches_ia"].append([x, y])
                elif res == "coule":
                    etat["coules_ia"].append(coule)
                    cases = set(bataille.cases_bateau(coule))
                    etat["touches_ia"] = [t for t in etat["touches_ia"] if tuple(t) not in cases]
                if bataille.flotte_coulee(etat["flotte_joueur"], etat["tirs_ia"]):
                    break
            self.assertTrue(bataille.flotte_coulee(etat["flotte_joueur"], etat["tirs_ia"]))

    def test_snake(self):
        c, _ = nouveau_joueur("Serpent")
        _, r = c.appel("/api/snake/debut", {})
        entrees, ticks = bot_snake(r["graine"])
        with noyau.db:  # la partie « a duré » assez longtemps
            noyau.db.execute("UPDATE parties SET debut = debut - 600 WHERE id = ?", (r["partie"],))
        # une partie trafiquée (mort annoncée trop tôt) est refusée
        self.assertEqual(c.appel("/api/snake/fin", {"partie": r["partie"], "entrees": entrees, "ticks": ticks - 3})[0], 400)
        code, f = c.appel("/api/snake/fin", {"partie": r["partie"], "entrees": entrees, "ticks": ticks})
        self.assertEqual(code, 200, f)
        self.assertGreaterEqual(f["fin"]["fruits"], 8)

    def test_snake_trop_rapide(self):
        c, _ = nouveau_joueur("Flash")
        _, r = c.appel("/api/snake/debut", {})
        entrees, ticks = bot_snake(r["graine"])
        self.assertEqual(c.appel("/api/snake/fin", {"partie": r["partie"], "entrees": entrees, "ticks": ticks})[0], 400)

    def test_mulberry_identique_au_js(self):
        # valeurs calculées avec la version JavaScript de snake.js (graine 12345)
        alea = snake.mulberry32(12345)
        self.assertEqual([round(alea(), 10) for _ in range(3)], [0.9797282678, 0.3067522645, 0.4842054215])

    def test_demineur(self):
        c, _ = nouveau_joueur("Sapeur")
        _, r = c.appel("/api/demineur/debut", {"mode": "facile"})
        code, t = c.appel("/api/demineur/reveler", {"partie": r["partie"], "cases": [[4, 4]]})
        self.assertEqual(code, 200)
        self.assertNotIn("fin", t)  # le premier clic n'est jamais une bombe
        bombes = {tuple(b) for b in etat_partie(r["partie"])["bombes"]}
        self.assertEqual(len(bombes), 10)
        for y in range(9):
            for x in range(9):
                if (x, y) not in bombes:
                    code, t = c.appel("/api/demineur/reveler", {"partie": r["partie"], "cases": [[x, y]]})
                    if "fin" in t:
                        self.assertTrue(t["fin"]["victoire"])
                        return
        self.fail("Pas de victoire")

    def test_demineur_boum(self):
        c, _ = nouveau_joueur("Boum")
        _, r = c.appel("/api/demineur/debut", {"mode": "facile"})
        c.appel("/api/demineur/reveler", {"partie": r["partie"], "cases": [[0, 0]]})
        bombe = etat_partie(r["partie"])["bombes"][0]
        _, t = c.appel("/api/demineur/reveler", {"partie": r["partie"], "cases": [bombe]})
        self.assertFalse(t["fin"]["victoire"])
        self.assertEqual(len(t["bombes"]), 10)

    def test_echecs(self):
        c, _ = nouveau_joueur("Kasparov")
        _, r = c.appel("/api/echecs/debut", {"niveau": "facile"})
        self.assertEqual(len(r["coups"]), 20)
        self.assertEqual(c.appel("/api/echecs/coup", {"partie": r["partie"], "de": 52, "vers": 20})[0], 400)
        code, t = c.appel("/api/echecs/coup", {"partie": r["partie"], "de": 52, "vers": 36})  # e2-e4
        self.assertEqual(code, 200)
        self.assertEqual(t["plateau"][36], "P")
        self.assertIn("ia", t)
        code, t = c.appel("/api/echecs/abandon", {"partie": r["partie"]})
        self.assertEqual(t["fin"]["resultat"], "defaite")

    def test_echecs_mat(self):
        # Mat du berger contre un ordinateur qui joue exprès mal : on vérifie la détection du mat.
        e = echecs.jouer(echecs.jouer(echecs.jouer(echecs.jouer(echecs.jouer(echecs.jouer(echecs.jouer(
            {"b": echecs.DEPART, "t": "w", "c": "KQkq", "ep": -1, "hm": 0},
            (52, 36)), (12, 28)), (61, 34)), (1, 18)), (59, 31)), (6, 21)), (31, 13))
        self.assertEqual(echecs.fin_de_partie(e, {}), ("mat", None))

    def test_flipper(self):
        c, _ = nouveau_joueur("Flippeur")
        _, r = c.appel("/api/flipper/debut", {})
        self.assertEqual(c.appel("/api/flipper/fin", {"partie": r["partie"], "score": 10**6})[0], 400)
        with noyau.db:
            noyau.db.execute("UPDATE parties SET debut = debut - 120 WHERE id = ?", (r["partie"],))
        code, f = c.appel("/api/flipper/fin", {"partie": r["partie"], "score": 50000})
        self.assertEqual((code, f["fin"]["pieces"]), (200, 10))

    def test_roue(self):
        c, _ = nouveau_joueur("Chanceux")
        fin = jouer_memory(c)["fin"]
        self.assertTrue(fin["roue"])
        code, r = c.appel("/api/roue/tourner", {"partie": fin["partie"]})
        self.assertEqual(code, 200)
        self.assertEqual(r["mult"], noyau.ROUE[r["secteur"]]["mult"])
        self.assertEqual(r["pieces"], round(fin["pieces"] * r["mult"]))
        self.assertEqual(r["joueur"]["pieces"], fin["joueur"]["pieces"] + r["bonus"])
        self.assertFalse(r["joueur"]["tour_gratuit"])
        self.assertEqual(c.appel("/api/roue/tourner", {"partie": fin["partie"]})[0], 400)  # une fois par jour
        fin2 = jouer_memory(c)["fin"]
        self.assertFalse(fin2["roue"])

    def test_classements(self):
        for jeu in noyau.JEUX_CLASSES + ("fortune",):
            self.assertEqual(Client().appel(f"/api/classement?jeu={jeu}&periode=tout")[0], 200)
        self.assertEqual(Client().appel("/api/classement?jeu=inconnu")[0], 400)


if __name__ == "__main__":
    unittest.main()
