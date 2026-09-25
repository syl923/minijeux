"""Tests de l'API : lance un serveur sur une base temporaire et joue des parties complètes.

    python -m unittest discover tests
"""

import http.cookiejar
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

os.environ["MINIJEUX_BASE"] = os.path.join(tempfile.mkdtemp(), "test.db")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402

httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Gestionnaire)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{httpd.server_port}"


class Client:
    def __init__(self):
        self.ouvreur = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def appel(self, chemin, donnees=None):
        corps = None if donnees is None else json.dumps(donnees).encode()
        req = urllib.request.Request(URL + chemin, data=corps, headers={"Content-Type": "application/json"})
        try:
            with self.ouvreur.open(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


def nouveau_joueur(pseudo):
    c = Client()
    code, r = c.appel("/api/inscription", {"pseudo": pseudo, "mot_de_passe": "secret123"})
    assert code == 200, r
    return c, r["joueur"]


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


class TestApi(unittest.TestCase):
    def test_comptes(self):
        c, j = nouveau_joueur("Alice")
        self.assertEqual(j["pieces"], server.OR_BIENVENUE)
        self.assertEqual(Client().appel("/api/inscription", {"pseudo": "alice", "mot_de_passe": "xxxxxx"})[0], 400)
        self.assertEqual(Client().appel("/api/connexion", {"pseudo": "ALICE", "mot_de_passe": "mauvais"})[0], 400)
        self.assertEqual(Client().appel("/api/connexion", {"pseudo": "ALICE", "mot_de_passe": "secret123"})[0], 200)
        self.assertEqual(Client().appel("/api/memory/debut", {"mode": "facile"})[0], 401)
        self.assertEqual(Client().appel("/api/inscription", {"pseudo": "<script>", "mot_de_passe": "secret123"})[0], 400)

    def test_memory(self):
        c, _ = nouveau_joueur("Bob")
        r = jouer_memory(c)
        fin = r["fin"]
        self.assertGreater(fin["score"], 0)
        self.assertEqual(fin["joueur"]["pieces"], server.OR_BIENVENUE + fin["pieces"])
        # carte déjà trouvée ou partie terminée : refusé
        _, lig = Client().appel("/api/classement?jeu=memory&periode=semaine")
        self.assertIn("Bob", [l["pseudo"] for l in lig["lignes"]])

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
        code, r = c.appel("/api/bataille/debut", {"flotte": server.flotte_aleatoire()})
        self.assertEqual(code, 200)
        partie = r["partie"]
        # On tire sur toutes les cases, dans l'ordre, jusqu'à la fin de la partie.
        for y in range(10):
            for x in range(10):
                code, t = c.appel("/api/bataille/tir", {"partie": partie, "x": x, "y": y})
                self.assertEqual(code, 200, t)
                if "fin" in t:
                    fin = t["fin"]
                    self.assertIn("victoire", fin)
                    self.assertGreater(fin["pieces"], 0)
                    self.assertEqual(c.appel("/api/bataille/tir", {"partie": partie, "x": 9, "y": 9})[0], 400)
                    return
        self.fail("La partie ne s'est pas terminée")

    def test_ia_toujours_legale(self):
        for _ in range(30):
            etat = {"flotte_joueur": server.flotte_aleatoire(), "tirs_ia": [], "touches_ia": [], "coules_ia": []}
            for _ in range(100):
                x, y = server.ia_choisir(etat)
                self.assertNotIn([x, y], etat["tirs_ia"])
                res, coule = server.tirer(etat["flotte_joueur"], etat["tirs_ia"], x, y)
                if res == "touche":
                    etat["touches_ia"].append([x, y])
                elif res == "coule":
                    etat["coules_ia"].append(coule)
                    cases = set(server.cases_bateau(coule))
                    etat["touches_ia"] = [t for t in etat["touches_ia"] if tuple(t) not in cases]
                if server.flotte_coulee(etat["flotte_joueur"], etat["tirs_ia"]):
                    break
            self.assertTrue(server.flotte_coulee(etat["flotte_joueur"], etat["tirs_ia"]))

    def test_roue_et_multiplicateur(self):
        c, _ = nouveau_joueur("Chanceux")
        code, r = c.appel("/api/roue/tourner", {})
        self.assertEqual(code, 200)
        self.assertTrue(r["gratuit"])
        self.assertEqual(r["mult"], server.ROUE[r["secteur"]]["mult"])
        # 2e tour : payant, et 20 pièces ne suffisent pas
        self.assertEqual(c.appel("/api/roue/tourner", {})[0], 400)
        # Multiplicateur forcé à x2 : il s'applique puis se décompte
        server.db.execute("UPDATE joueurs SET mult = 2, mult_parties = 3 WHERE pseudo = 'Chanceux'")
        server.db.commit()
        fin = jouer_memory(c)["fin"]
        self.assertEqual(fin["mult"], 2)
        self.assertEqual(fin["pieces"], fin["pieces_base"] * 2)
        self.assertEqual(fin["joueur"]["mult_parties"], 2)

    def test_classement_fortune(self):
        code, r = Client().appel("/api/classement?jeu=fortune&periode=tout")
        self.assertEqual(code, 200)
        self.assertEqual(Client().appel("/api/classement?jeu=inconnu")[0], 400)


if __name__ == "__main__":
    unittest.main()
