"""Serveur de MiniJeux : pages du site (dossier public/) + API JSON (/api/...).

Python 3, bibliothèque standard uniquement. Lancement :  python server.py
Puis ouvrir http://localhost:8000

La logique commune (comptes, mise, roue, classements) est dans noyau.py,
celle de chaque jeu dans jeux/<jeu>.py.
"""

import json
import os
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import noyau
from noyau import DUREE_SESSION, ErreurApi, creer_session, db, joueur_de_session, joueur_public, lire_joueur
from jeux import bataille, demineur, echecs, flipper, memory, snake

DOSSIER_PUBLIC = os.path.join(noyau.RACINE, "public")
PORT = int(os.environ.get("PORT", "8000"))

ROUTES_POST = {
    "/api/roue/tourner": noyau.roue_tourner,
    "/api/secours": noyau.secours,
}
for jeu in (memory, bataille, snake, demineur, echecs, flipper):
    ROUTES_POST.update(jeu.ROUTES)
ROUTES_GET = {"/api/classement": noyau.classement, "/api/roue": noyau.roue_config}

verrou = noyau.verrou


class Gestionnaire(SimpleHTTPRequestHandler):
    # Types fixés ici : sous Windows, Python les lit dans le registre, parfois faux (.js en text/plain).
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOSSIER_PUBLIC, **kwargs)

    def log_message(self, format, *args):
        if os.environ.get("MINIJEUX_LOG"):
            super().log_message(format, *args)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def jeton(self):
        c = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        return c["session"].value if "session" in c else None

    def repondre(self, code, corps, cookie=None):
        brut = json.dumps(corps, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(brut)))
        if cookie is not None:
            age = DUREE_SESSION if cookie else 0
            self.send_header("Set-Cookie", f"session={cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}")
        self.end_headers()
        self.wfile.write(brut)

    def do_GET(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            return super().do_GET()
        with verrou:
            try:
                joueur = joueur_de_session(self.jeton())
                if url.path == "/api/moi":
                    return self.repondre(200, {"joueur": joueur_public(joueur) if joueur else None})
                if url.path not in ROUTES_GET:
                    raise ErreurApi("Adresse inconnue.", 404)
                return self.repondre(200, ROUTES_GET[url.path](joueur, parse_qs(url.query)))
            except ErreurApi as e:
                return self.repondre(e.code, {"erreur": str(e)})

    def do_POST(self):
        url = urlparse(self.path)
        try:
            taille = min(int(self.headers.get("Content-Length", 0)), 100_000)
            donnees = json.loads(self.rfile.read(taille) or b"{}")
            if not isinstance(donnees, dict):
                raise ValueError
        except ValueError:
            return self.repondre(400, {"erreur": "Requête invalide."})
        with verrou:
            try:
                with db:
                    if url.path in ("/api/inscription", "/api/connexion"):
                        jid = (noyau.inscription if url.path == "/api/inscription" else noyau.connexion)(donnees)
                        jeton = creer_session(jid)
                        return self.repondre(200, {"joueur": joueur_public(lire_joueur(jid))}, cookie=jeton)
                    if url.path == "/api/deconnexion":
                        db.execute("DELETE FROM sessions WHERE jeton = ?", (self.jeton(),))
                        return self.repondre(200, {"ok": True}, cookie="")
                    if url.path not in ROUTES_POST:
                        raise ErreurApi("Adresse inconnue.", 404)
                    joueur = joueur_de_session(self.jeton())
                    if not joueur:
                        raise ErreurApi("Connecte-toi avec ton pseudo pour jouer.", 401)
                    reponse = ROUTES_POST[url.path](joueur, donnees)
                    if url.path.endswith("/debut"):  # la mise vient d'être encaissée : solde à jour
                        reponse["joueur"] = joueur_public(lire_joueur(joueur["id"]))
                    return self.repondre(200, reponse)
            except ErreurApi as e:
                return self.repondre(e.code, {"erreur": str(e)})


if __name__ == "__main__":
    serveur = ThreadingHTTPServer(("0.0.0.0", PORT), Gestionnaire)
    print(f"MiniJeux en ligne sur http://localhost:{PORT}  (Ctrl+C pour arrêter)")
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
