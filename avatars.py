"""Boutique d'avatars : des têtes de singe à acheter avec les bananes gagnées, ou à gagner dans la box mystère.

Le serveur ne connaît que l'identifiant, le nom, le prix et la rareté de chaque avatar ;
les dessins sont dans public/assets/singes.js (mêmes identifiants).
"""

import random

from noyau import ErreurApi, db, joueur_public, lire_joueur, maintenant

# identifiant : (nom, prix en bananes). 0 = offert à tout le monde ; None = seulement dans la box mystère.
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
    "clown": ("Bozo le clown", 90),
    "dejante": ("Complètement déjanté", 100),
    "bebe": ("Bébé Moka", 100),
    "hippie": ("Peace & Banane", 110),
    "chef": ("Chef cuistot", 120),
    "momie": ("La momie", 130),
    "cowboy": ("Cow-boy", 150),
    "punk": ("Punk à banane", 150),
    "costume_banane": ("Déguisé en banane", 160),
    "pirate": ("Barbe-Banane", 180),
    "rappeur": ("MC Moka", 200),
    "disco": ("Disco Fever", 210),
    "ninja": ("Ninja", 220),
    "catcheur": ("El Macaco", 240),
    "magicien": ("Grand sorcier", 250),
    "dj": ("DJ Banana", 260),
    "zombie": ("Zombie", 300),
    "vampire": ("Comte Bananula", 300),
    "diable": ("Petit diable", 320),
    "savant_fou": ("Savant fou", 350),
    "robot": ("Robo-Moka 3000", 380),
    "astronaute": ("Astronaute", 400),
    "alien": ("Moka de Mars", 420),
    "licorne": ("Licorne", 450),
    "chevalier": ("Sire Moka", 480),
    "super_heros": ("Super-Moka", 550),
    "roi": ("Sa Majesté", 600),
    "dore": ("Moka d'or", 1000),
    "arc_en_ciel": ("Moka arc-en-ciel", None),
    "cosmique": ("Moka cosmique", None),
    "fantome": ("Le fantôme", None),
}

PRIX_BOX = 250
# chances de chaque rareté dans la box mystère (en %)
CHANCES_BOX = {"commun": 45, "rare": 30, "epique": 18, "legendaire": 7}
DEDOMMAGEMENT = 120   # bananes rendues si on possède déjà tous les avatars de la rareté tirée


def rarete(avatar):
    prix = AVATARS[avatar][1]
    if prix is None or prix >= 500:
        return "legendaire"
    return "epique" if prix >= 200 else "rare" if prix >= 100 else "commun"


def possedes(joueur_id):
    lignes = db.execute("SELECT avatar FROM avatars WHERE joueur_id = ?", (joueur_id,)).fetchall()
    return {a for a, (_, prix) in AVATARS.items() if prix == 0} | {l["avatar"] for l in lignes}


def catalogue(joueur, requete):
    return {
        "avatars": [{"id": a, "nom": nom, "prix": prix, "rarete": rarete(a)} for a, (nom, prix) in AVATARS.items()],
        "possedes": sorted(possedes(joueur["id"])) if joueur else [],
        "actuel": (joueur["avatar"] or "moka") if joueur else None,
        "box": {"prix": PRIX_BOX, "chances": CHANCES_BOX, "gratuites": joueur["boxes"] if joueur else 0},
    }


def acheter(joueur, donnees):
    a = str(donnees.get("avatar", ""))
    if a not in AVATARS:
        raise ErreurApi("Avatar inconnu.")
    if a in possedes(joueur["id"]):
        raise ErreurApi("Tu as déjà cet avatar.")
    prix = AVATARS[a][1]
    if prix is None:
        raise ErreurApi("Cet avatar ne se trouve que dans la box mystère !")
    j = lire_joueur(joueur["id"])
    if j["pieces"] < prix:
        raise ErreurApi(f"Il te faut {prix} bananes : tu n'en as que {j['pieces']}.")
    db.execute("UPDATE joueurs SET pieces = pieces - ?, avatar = ? WHERE id = ?", (prix, a, j["id"]))
    db.execute("INSERT INTO avatars VALUES (?, ?, ?)", (j["id"], a, maintenant()))
    return {"joueur": joueur_public(lire_joueur(j["id"])), "possedes": sorted(possedes(j["id"]))}


def ouvrir_box(joueur, donnees):
    """Box mystère : payée en bananes, ou gratuite si on en a gagné une à la roue bonus."""
    j = lire_joueur(joueur["id"])
    if donnees.get("gratuite"):
        if j["boxes"] < 1:
            raise ErreurApi("Tu n'as pas de box mystère gratuite.")
        db.execute("UPDATE joueurs SET boxes = boxes - 1 WHERE id = ?", (j["id"],))
    else:
        if j["pieces"] < PRIX_BOX:
            raise ErreurApi(f"La box mystère coûte {PRIX_BOX} bananes : tu n'en as que {j['pieces']}.")
        db.execute("UPDATE joueurs SET pieces = pieces - ? WHERE id = ?", (PRIX_BOX, j["id"]))
    r = random.choices(list(CHANCES_BOX), weights=list(CHANCES_BOX.values()))[0]
    deja = possedes(j["id"])
    choix = [a for a in AVATARS if rarete(a) == r and a not in deja]
    if not choix:  # collection complète dans cette rareté : on dédommage
        db.execute("UPDATE joueurs SET pieces = pieces + ? WHERE id = ?", (DEDOMMAGEMENT, j["id"]))
        return {"rarete": r, "avatar": None, "bananes": DEDOMMAGEMENT, "joueur": joueur_public(lire_joueur(j["id"])),
                "possedes": sorted(deja)}
    a = random.choice(choix)
    db.execute("INSERT INTO avatars VALUES (?, ?, ?)", (j["id"], a, maintenant()))
    db.execute("UPDATE joueurs SET avatar = ? WHERE id = ?", (a, j["id"]))
    return {"rarete": r, "avatar": a, "nom": AVATARS[a][0], "joueur": joueur_public(lire_joueur(j["id"])),
            "possedes": sorted(possedes(j["id"]))}


def choisir(joueur, donnees):
    a = str(donnees.get("avatar", ""))
    if a not in possedes(joueur["id"]):
        raise ErreurApi("Achète d'abord cet avatar.")
    db.execute("UPDATE joueurs SET avatar = ? WHERE id = ?", (a, joueur["id"]))
    return {"joueur": joueur_public(lire_joueur(joueur["id"]))}


ROUTES = {"/api/avatars/acheter": acheter, "/api/avatars/choisir": choisir, "/api/avatars/box": ouvrir_box}
ROUTES_GET = {"/api/avatars": catalogue}
