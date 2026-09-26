"""Boutique d'avatars : des têtes de singe à acheter avec les bananes gagnées.

Le serveur ne connaît que l'identifiant, le nom et le prix de chaque avatar ;
les dessins sont dans public/assets/singes.js (mêmes identifiants).
"""

from noyau import ErreurApi, db, joueur_public, lire_joueur, maintenant

# identifiant : (nom, prix en bananes). Les avatars à 0 banane sont offerts à tout le monde.
AVATARS = {
    "moka": ("Moka le classique", 0),
    "content": ("Tout content", 0),
    "triste": ("Le cafard", 30),
    "choque": ("Oh la la !", 40),
    "grognon": ("Grognon", 40),
    "cool": ("Trop cool", 60),
    "amoureux": ("Cœur d'artichaut", 60),
    "mdr": ("Mort de rire", 70),
    "dodo": ("Marmotte", 80),
    "dejante": ("Complètement déjanté", 100),
    "bebe": ("Bébé Moka", 100),
    "chef": ("Chef cuistot", 120),
    "cowboy": ("Cow-boy", 150),
    "punk": ("Punk à banane", 150),
    "pirate": ("Barbe-Banane", 180),
    "rappeur": ("MC Moka", 200),
    "ninja": ("Ninja", 220),
    "magicien": ("Grand sorcier", 250),
    "zombie": ("Zombie", 300),
    "vampire": ("Comte Bananula", 300),
    "astronaute": ("Astronaute", 400),
    "licorne": ("Licorne", 450),
    "roi": ("Sa Majesté", 600),
    "dore": ("Moka d'or", 1000),
}


def possedes(joueur_id):
    lignes = db.execute("SELECT avatar FROM avatars WHERE joueur_id = ?", (joueur_id,)).fetchall()
    return {a for a, (_, prix) in AVATARS.items() if prix == 0} | {l["avatar"] for l in lignes}


def catalogue(joueur, requete):
    return {
        "avatars": [{"id": a, "nom": nom, "prix": prix} for a, (nom, prix) in AVATARS.items()],
        "possedes": sorted(possedes(joueur["id"])) if joueur else [],
        "actuel": (joueur["avatar"] or "moka") if joueur else None,
    }


def acheter(joueur, donnees):
    a = str(donnees.get("avatar", ""))
    if a not in AVATARS:
        raise ErreurApi("Avatar inconnu.")
    if a in possedes(joueur["id"]):
        raise ErreurApi("Tu as déjà cet avatar.")
    prix = AVATARS[a][1]
    j = lire_joueur(joueur["id"])
    if j["pieces"] < prix:
        raise ErreurApi(f"Il te faut {prix} bananes : tu n'en as que {j['pieces']}.")
    db.execute("UPDATE joueurs SET pieces = pieces - ?, avatar = ? WHERE id = ?", (prix, a, j["id"]))
    db.execute("INSERT INTO avatars VALUES (?, ?, ?)", (j["id"], a, maintenant()))
    return {"joueur": joueur_public(lire_joueur(j["id"])), "possedes": sorted(possedes(j["id"]))}


def choisir(joueur, donnees):
    a = str(donnees.get("avatar", ""))
    if a not in possedes(joueur["id"]):
        raise ErreurApi("Achète d'abord cet avatar.")
    db.execute("UPDATE joueurs SET avatar = ? WHERE id = ?", (a, joueur["id"]))
    return {"joueur": joueur_public(lire_joueur(joueur["id"]))}


ROUTES = {"/api/avatars/acheter": acheter, "/api/avatars/choisir": choisir}
ROUTES_GET = {"/api/avatars": catalogue}
