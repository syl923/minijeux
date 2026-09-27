"""Serveur de MiniJeux : pages du site (dossier public/) + API JSON (/api/...).

Python 3, bibliothèque standard uniquement. Lancement :  python server.py
Puis ouvrir http://localhost:8000

La logique commune (comptes, mise, roue, classements) est dans noyau.py,
celle de chaque jeu dans jeux/<jeu>.py.
"""

import json
import os
import time
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import avatars
import compte
import noyau
from noyau import DUREE_SESSION, ErreurApi, creer_session, db, joueur_de_session, joueur_public, lire_joueur
from jeux import arene, bataille, candy, demineur, duels, echecs, flipper, jet, memory, pingouin, runner, snake, tetris

DOSSIER_PUBLIC = os.path.join(noyau.RACINE, "public")
PORT = int(os.environ.get("PORT", "8000"))
HOTE = os.environ.get("HOST", "0.0.0.0")               # certains hébergeurs imposent "::"
HTTPS = os.environ.get("MINIJEUX_HTTPS") == "1"         # en ligne derrière HTTPS : cookie « Secure »
DERRIERE_PROXY = os.environ.get("MINIJEUX_PROXY") == "1"  # l'hébergeur transmet l'IP réelle dans X-Forwarded-For

# Publicité Google AdSense : rien n'est chargé tant que l'identifiant d'éditeur n'est pas renseigné.
ADSENSE = os.environ.get("MINIJEUX_ADSENSE_CLIENT", "").strip()              # ex. ca-pub-1234567890123456
ADSENSE_EMPLACEMENT = os.environ.get("MINIJEUX_ADSENSE_EMPLACEMENT", "").strip()  # identifiant du bloc d'annonce (facultatif)
if ADSENSE and not ADSENSE.startswith("ca-pub-"):
    ADSENSE = "ca-pub-" + ADSENSE.removeprefix("pub-")
CODE_ADSENSE = (
    f'<meta name="google-adsense-account" content="{ADSENSE}">\n'
    f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE}" crossorigin="anonymous"></script>\n'
) if ADSENSE else ""

# Limite anti-force-brute : nombre d'essais par adresse IP sur une fenêtre de temps.
LIMITES = {"/api/connexion": (10, 600), "/api/inscription": (5, 3600)}
if os.environ.get("MINIJEUX_SANS_LIMITE") == "1":  # tests en local uniquement
    LIMITES = {chemin: (10**6, 1) for chemin in LIMITES}
essais = {}


def trop_d_essais(ip, chemin):
    maxi, fenetre = LIMITES[chemin]
    maintenant = time.time()
    liste = [t for t in essais.get((ip, chemin), []) if t > maintenant - fenetre]
    liste.append(maintenant)
    essais[(ip, chemin)] = liste
    return len(liste) > maxi

ROUTES_POST = {
    "/api/roue/tourner": noyau.roue_tourner,
    "/api/secours": noyau.secours,
    "/api/roue/bonus": noyau.roue_bonus,
}
for jeu in (memory, bataille, snake, demineur, echecs, flipper, candy, tetris, runner, duels, jet, pingouin, compte, avatars, arene):
    ROUTES_POST.update(jeu.ROUTES)
ROUTES_GET = {"/api/classement": noyau.classement, "/api/roue": noyau.roue_config, "/api/mes_records": noyau.mes_records,
              "/api/activite": noyau.activite,
              **duels.ROUTES_GET, **compte.ROUTES_GET, **avatars.ROUTES_GET}

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
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        if HTTPS:
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def ip(self):
        if DERRIERE_PROXY and self.headers.get("X-Forwarded-For"):
            return self.headers["X-Forwarded-For"].split(",")[0].strip()
        return self.client_address[0]

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
            securise = "; Secure" if HTTPS else ""
            self.send_header("Set-Cookie", f"session={cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}{securise}")
        self.end_headers()
        self.wfile.write(brut)

    def envoyer_texte(self, code, texte, type_):
        brut = texte.encode()
        self.send_response(code)
        self.send_header("Content-Type", type_)
        self.send_header("Content-Length", str(len(brut)))
        self.end_headers()
        self.wfile.write(brut)

    def page_avec_pub(self, chemin):
        """Pages HTML : on insère le code AdSense dans l'en-tête quand il est configuré."""
        fichier = os.path.join(DOSSIER_PUBLIC, "index.html" if chemin == "/" else chemin.lstrip("/"))
        fichier = os.path.normpath(fichier)
        if not fichier.startswith(DOSSIER_PUBLIC + os.sep) or not os.path.isfile(fichier):
            return False
        with open(fichier, encoding="utf-8") as f:
            html = f.read().replace("</head>", CODE_ADSENSE + "</head>", 1)
        self.envoyer_texte(200, html, "text/html; charset=utf-8")
        return True

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/ads.txt":
            if not ADSENSE:
                return self.envoyer_texte(404, "", "text/plain; charset=utf-8")
            return self.envoyer_texte(200, f"google.com, {ADSENSE.removeprefix('ca-')}, DIRECT, f08c47fec0942fa0\n", "text/plain; charset=utf-8")
        if ADSENSE and (url.path == "/" or url.path.endswith(".html")) and self.page_avec_pub(url.path):
            return
        if not url.path.startswith("/api/"):
            return super().do_GET()
        with verrou, db:  # une consultation peut écrire (présence, fin d'un duel au temps écoulé)
            try:
                joueur = joueur_de_session(self.jeton())
                if url.path == "/api/config":
                    return self.repondre(200, {"pub": {"client": ADSENSE, "emplacement": ADSENSE_EMPLACEMENT}})
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
                        if trop_d_essais(self.ip(), url.path):
                            raise ErreurApi("Trop d'essais depuis cette connexion : réessaie dans quelques minutes.", 429)
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
    if not HTTPS and os.environ.get("MINIJEUX_COMPTE_TEST", "1") == "1":
        noyau.compte_de_test()  # toto / toto avec 1000 bananes, pour tester en local
        print("Compte de test : pseudo toto, mot de passe toto (1000 bananes)")
    if ":" in HOTE:  # adresse IPv6 (ex. "::"), repli en IPv4 si la machine ne la gère pas
        import socket
        ThreadingHTTPServer.address_family = socket.AF_INET6
        try:
            serveur = ThreadingHTTPServer((HOTE, PORT), Gestionnaire)
        except OSError:
            ThreadingHTTPServer.address_family = socket.AF_INET
            serveur = ThreadingHTTPServer(("0.0.0.0", PORT), Gestionnaire)
    else:
        serveur = ThreadingHTTPServer((HOTE, PORT), Gestionnaire)
    print(f"Moka Arcade en ligne sur http://localhost:{PORT}  (Ctrl+C pour arrêter)")
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
