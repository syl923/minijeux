"""Stickman Arena : combats de bonshommes bâtons, manches de 60 secondes, Moka qui s'en mêle.

- Solo (contre 3 robots) : la partie tourne dans la page ; le serveur vérifie la durée et la vraisemblance.
- Duel en ligne (1 contre 1) : le serveur fait tourner la simulation lui-même (il est l'arbitre) ; chaque page
  envoie ses commandes une vingtaine de fois par seconde et reçoit l'état du combat.

La simulation doit rester identique à public/assets/arene-sim.js (mêmes nombres, même ordre des calculs).
"""

import json
import math
import secrets

from jeux import duels
from jeux.snake import imul
from noyau import ErreurApi, lire_partie, maintenant, nouvelle_partie, terminer_partie

W, H, SOL, G, DT = 960, 540, 500, 1900, 1 / 60
DEPART, DUREE = 180, 3600
LARG, HAUT, VMAX, ACC_SOL, ACC_AIR, FROT, SAUT, SAUT2 = 26, 64, 340, 3400, 1800, 2600, -660, -580
PLATEFORMES = [[110, 390, 210], [640, 390, 210], [375, 290, 210], [60, 195, 150], [750, 195, 150], [405, 150, 150]]
SPAWNS = [[160, 500], [800, 500], [480, 290], [135, 195], [825, 195], [480, 150]]
ARMES = {
    "poings": {"cd": 20, "degats": 14, "portee": 54, "mun": -1, "recul": 260},
    "pistolet": {"cd": 16, "vit": 1150, "degats": 15, "mun": 14, "vie": 48, "recul": 90},
    "pompe": {"cd": 50, "vit": 1050, "degats": 10, "mun": 6, "vie": 20, "recul": 150, "plombs": 5},
    "mitraillette": {"cd": 5, "vit": 1250, "degats": 7, "mun": 45, "vie": 42, "recul": 40},
    "bazooka": {"cd": 60, "vit": 620, "degats": 55, "mun": 3, "vie": 150, "recul": 520, "rayon": 95},
    "canon_or": {"cd": 36, "vit": 700, "degats": 60, "mun": 5, "vie": 150, "recul": 560, "rayon": 115},
}
ARMES_CAISSES = ["pistolet", "pompe", "mitraillette", "bazooka", "pistolet", "mitraillette"]
MOKA = ["bananes", "soin", "lune", "coco", "bouclier", "inverse", "arme_or"]
DISPERSION = {"pompe": [[0.98722728, -0.15931821], [0.99680171, -0.07991469], [1, 0], [0.99680171, 0.07991469], [0.98722728, 0.15931821]],
              "mitraillette": [[0.99955003, 0.0299955], [0.99955003, -0.0299955]]}


def alea(sim):
    sim["alea"] = (sim["alea"] + 0x6D2B79F5) & 0xFFFFFFFF
    t = sim["alea"]
    t = imul(t ^ (t >> 15), t | 1)
    t = ((t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF) ^ t
    return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def arrondi(x):
    return math.floor(x + 0.5)


def signe(x):
    return (x > 0) - (x < 0)


def nouveau(graine, noms):
    sim = {"t": 0, "alea": graine & 0xFFFFFFFF, "lune": 0, "joueurs": [], "balles": [], "caisses": [], "peaux": [], "cocos": [],
           "fx": [], "messages": [], "prochaineCaisse": DEPART + 120, "prochainMoka": DEPART + 600, "fini": False}
    for i, nom in enumerate(noms):
        x, y = SPAWNS[i % len(SPAWNS)]
        sim["joueurs"].append({"i": i, "nom": nom, "x": x, "y": y, "vx": 0, "vy": 0, "sol": True, "dj": True, "hp": 100,
                               "arme": "pistolet", "mun": 14, "cd": 0, "ax": -1000 if i % 2 else 1000, "ay": 0,
                               "dir": -1 if i % 2 else 1, "mort": 0, "k": 0, "m": 0, "glisse": 0, "bouclier": 0, "inverse": 0,
                               "traverse": 0, "sautVu": 0, "touche": 0,
                               "entree": {"g": 0, "d": 0, "b": 0, "t": 0, "saut": 0, "ax": 1000, "ay": 0}})
    return sim


def message(sim, texte, type_):
    sim["messages"].append({"t": sim["t"], "texte": texte, "type": type_})
    if len(sim["messages"]) > 6:
        sim["messages"].pop(0)


def fx(sim, f):
    f["t"] = sim["t"]
    sim["fx"].append(f)
    while sim["fx"] and sim["fx"][0]["t"] < sim["t"] - 40:
        sim["fx"].pop(0)


# --------------------------------------------------------------------------- dégâts, explosions

def blesser(sim, cible, degats, source, kx, ky):
    if cible["mort"] > 0:
        return
    if cible["bouclier"] > 0:
        fx(sim, {"type": "bouclier", "x": cible["x"], "y": cible["y"] - 32})
        return
    cible["hp"] -= degats
    cible["touche"] = 10
    cible["vx"] += kx
    cible["vy"] += ky
    fx(sim, {"type": "degats", "x": cible["x"], "y": cible["y"] - HAUT - 6, "v": degats})
    if cible["hp"] <= 0:
        cible["hp"] = 0
        cible["mort"] = 90
        cible["m"] += 1
        tueur = sim["joueurs"][source] if source >= 0 and source != cible["i"] else None
        if tueur:
            tueur["k"] += 1
        fx(sim, {"type": "ko", "x": cible["x"], "y": cible["y"] - 32, "par": tueur["i"] if tueur else -1, "qui": cible["i"]})


def explosion(sim, x, y, rayon, degats, recul, source):
    fx(sim, {"type": "explosion", "x": x, "y": y, "r": rayon})
    for j in sim["joueurs"]:
        if j["mort"] > 0:
            continue
        dx, dy = j["x"] - x, j["y"] - 32 - y
        d = math.sqrt(dx * dx + dy * dy)
        if d >= rayon:
            continue
        f = 1 - d / rayon * 0.6
        n = d if d > 0.001 else 1
        moi = 0.5 if j["i"] == source else 1
        blesser(sim, j, arrondi(degats * f * moi), source, dx / n * recul * f, dy / n * recul * f - 180)


def reapparaitre(sim, j):
    meilleur, dist = 0, -1
    for k, (x, y) in enumerate(SPAWNS):
        d = 1e9
        for o in sim["joueurs"]:
            if o is not j and o["mort"] <= 0:
                d = min(d, abs(o["x"] - x) + abs(o["y"] - y))
        if d > dist:
            dist, meilleur = d, k
    x, y = SPAWNS[meilleur]
    j.update(x=x, y=y, vx=0, vy=0, hp=100, arme="pistolet", mun=14, cd=0, sol=True, dj=True, glisse=0, bouclier=90, inverse=0)


def meneur(sim):
    m = max(j["k"] for j in sim["joueurs"])
    tete = [j for j in sim["joueurs"] if j["k"] == m]
    return tete[math.floor(alea(sim) * len(tete))]


def dernier(sim):
    m = min(j["k"] for j in sim["joueurs"])
    queue = [j for j in sim["joueurs"] if j["k"] == m]
    return queue[math.floor(alea(sim) * len(queue))]


def moka(sim):
    type_ = MOKA[math.floor(alea(sim) * len(MOKA))]
    if type_ == "bananes":
        for _ in range(4):
            p = [0, SOL, W] if alea(sim) < 0.35 else PLATEFORMES[math.floor(alea(sim) * len(PLATEFORMES))]
            sim["peaux"].append({"x": p[0] + 20 + alea(sim) * (p[2] - 40), "y": p[1]})
        message(sim, "Moka sème des peaux de banane ! Attention où vous marchez, hi hi !", type_)
    elif type_ == "soin":
        sim["caisses"].append({"x": 60 + alea(sim) * (W - 120), "y": -20, "vy": 0, "arme": "soin", "vie": 720})
        message(sim, "Moka lance une banane dorée : +45 PV pour qui l'attrape !", type_)
    elif type_ == "lune":
        sim["lune"] = 420
        message(sim, "Moka coupe la gravité ! Tout le monde sur la lune !", type_)
    elif type_ == "coco":
        cible = meneur(sim)
        sim["cocos"].append({"x": cible["x"], "y": -30, "vy": 0})
        message(sim, f"Moka balance une noix de coco sur {cible['nom']} ! Hou hou ha ha !", type_)
    elif type_ == "bouclier":
        cible = dernier(sim)
        cible["bouclier"] = 360
        message(sim, f"Moka protège {cible['nom']} avec une bulle !", type_)
    elif type_ == "inverse":
        cible = meneur(sim)
        cible["inverse"] = 300
        message(sim, f"Moka a mélangé les commandes de {cible['nom']} ! Gauche-droite, droite-gauche…", type_)
    else:
        sim["caisses"].append({"x": 60 + alea(sim) * (W - 120), "y": -20, "vy": 0, "arme": "canon_or", "vie": 720})
        message(sim, "Moka largue le CANON À BANANES EN OR !", type_)


# --------------------------------------------------------------------------- un pas de simulation

def tirer(sim, j):
    a = ARMES[j["arme"]]
    n = math.sqrt(j["ax"] * j["ax"] + j["ay"] * j["ay"])
    ux, uy = (j["ax"] / n, j["ay"] / n) if n > 0 else (j["dir"], 0)
    j["cd"] = a["cd"]
    if j["arme"] == "poings":
        fx(sim, {"type": "coup", "x": j["x"] + j["dir"] * 30, "y": j["y"] - 40, "par": j["i"]})
        for o in sim["joueurs"]:
            if o is j or o["mort"] > 0:
                continue
            dx = o["x"] - j["x"]
            if dx * j["dir"] > -8 and abs(dx) < a["portee"] and abs(o["y"] - j["y"]) < 50:
                blesser(sim, o, a["degats"], j["i"], j["dir"] * a["recul"], -160)
        return
    bx, by = j["x"] + ux * 22, j["y"] - 42 + uy * 22
    if j["arme"] == "pompe":
        tirs = DISPERSION["pompe"]
    elif j["arme"] == "mitraillette":
        tirs = [DISPERSION["mitraillette"][j["mun"] % 2]]
    else:
        tirs = [[1, 0]]
    for c, s in tirs:
        sim["balles"].append({"x": bx, "y": by, "vx": (ux * c - uy * s) * a["vit"], "vy": (ux * s + uy * c) * a["vit"],
                              "arme": j["arme"], "par": j["i"], "vie": a["vie"]})
    fx(sim, {"type": "tir", "x": bx, "y": by, "ux": ux, "uy": uy, "arme": j["arme"]})
    j["vx"] -= ux * a["recul"] * 0.35
    j["mun"] -= 1
    if j["mun"] <= 0:
        j["arme"], j["mun"] = "poings", -1


def pas(sim):
    if sim["fini"]:
        return
    sim["t"] += 1
    actif = sim["t"] > DEPART
    g = G * (0.42 if sim["lune"] > 0 else 1)
    if sim["lune"] > 0:
        sim["lune"] -= 1

    for j in sim["joueurs"]:
        e = j["entree"]
        for cle in ("cd", "touche", "bouclier", "inverse", "traverse"):
            if j[cle] > 0:
                j[cle] -= 1
        if j["mort"] > 0:
            j["mort"] -= 1
            if j["mort"] == 0:
                reapparaitre(sim, j)
            continue
        j["ax"], j["ay"] = e["ax"], e["ay"]
        if e["ax"] != 0:
            j["dir"] = 1 if e["ax"] > 0 else -1
        dir_x = 0
        if actif:
            dir_x = (1 if e["d"] else 0) - (1 if e["g"] else 0)
            if j["inverse"] > 0:
                dir_x = -dir_x
        if j["glisse"] > 0:
            j["glisse"] -= 1
            dir_x = 0
        acc = ACC_SOL if j["sol"] else ACC_AIR
        if dir_x != 0:
            j["vx"] += dir_x * acc * DT
            if j["vx"] > VMAX:
                j["vx"] = max(VMAX, j["vx"] - FROT * DT)
            if j["vx"] < -VMAX:
                j["vx"] = min(-VMAX, j["vx"] + FROT * DT)
        elif j["sol"]:
            f = (250 if j["glisse"] > 0 else FROT) * DT
            j["vx"] = 0 if abs(j["vx"]) <= f else j["vx"] - signe(j["vx"]) * f
        if actif and e["saut"] != j["sautVu"]:
            j["sautVu"] = e["saut"]
            if j["glisse"] <= 0:
                if j["sol"]:
                    j["vy"], j["sol"] = SAUT, False
                    fx(sim, {"type": "saut", "x": j["x"], "y": j["y"]})
                elif j["dj"]:
                    j["vy"], j["dj"] = SAUT2, False
                    fx(sim, {"type": "saut2", "x": j["x"], "y": j["y"]})
        if actif and e["b"] and j["sol"] and j["y"] < SOL:
            j["traverse"], j["sol"] = 14, False
        j["vy"] += g * DT
        if j["vy"] > 1400:
            j["vy"] = 1400
        avant_y = j["y"]
        j["x"] += j["vx"] * DT
        j["y"] += j["vy"] * DT
        if j["x"] < LARG / 2:
            j["x"], j["vx"] = LARG / 2, 0
        if j["x"] > W - LARG / 2:
            j["x"], j["vx"] = W - LARG / 2, 0
        if j["y"] - HAUT < 0:
            j["y"] = HAUT
            if j["vy"] < 0:
                j["vy"] = 0
        j["sol"] = False
        if j["y"] >= SOL:
            j["y"], j["vy"], j["sol"] = SOL, 0, True
        elif j["vy"] >= 0 and j["traverse"] <= 0:
            for px, py, pw in PLATEFORMES:
                if avant_y <= py <= j["y"] and px - 8 < j["x"] < px + pw + 8:
                    j["y"], j["vy"], j["sol"] = py, 0, True
                    break
        if j["sol"]:
            j["dj"] = True
        if j["sol"] and j["glisse"] <= 0 and abs(j["vx"]) > 60:
            for k, p in enumerate(sim["peaux"]):
                if abs(p["x"] - j["x"]) < 16 and abs(p["y"] - j["y"]) < 4:
                    sim["peaux"].pop(k)
                    j["glisse"] = 55
                    j["vx"] = signe(j["vx"]) * 520
                    fx(sim, {"type": "glisse", "x": j["x"], "y": j["y"], "qui": j["i"]})
                    break
        if actif and e["t"] and j["cd"] <= 0 and j["glisse"] <= 0:
            tirer(sim, j)

    for k in range(len(sim["balles"]) - 1, -1, -1):
        b = sim["balles"][k]
        a = ARMES[b["arme"]]
        b["x"] += b["vx"] * DT
        b["y"] += b["vy"] * DT
        if "rayon" in a:
            b["vy"] += 260 * DT
        b["vie"] -= 1
        explose = b["x"] < 0 or b["x"] > W or b["y"] > SOL or b["y"] < -40 or b["vie"] <= 0
        touche = None
        for o in sim["joueurs"]:
            if o["i"] == b["par"] or o["mort"] > 0:
                continue
            if o["x"] - 14 < b["x"] < o["x"] + 14 and o["y"] - HAUT < b["y"] < o["y"]:
                touche = o
                break
        if touche and "rayon" not in a:
            n = math.sqrt(b["vx"] * b["vx"] + b["vy"] * b["vy"])
            blesser(sim, touche, a["degats"], b["par"], b["vx"] / n * a["recul"], -80)
            fx(sim, {"type": "impact", "x": b["x"], "y": b["y"]})
            sim["balles"].pop(k)
            continue
        if "rayon" in a and (touche or explose):
            explosion(sim, b["x"], min(b["y"], SOL), a["rayon"], a["degats"], a["recul"], b["par"])
            sim["balles"].pop(k)
            continue
        if explose:
            sim["balles"].pop(k)

    if actif and sim["t"] >= sim["prochaineCaisse"]:
        if len(sim["caisses"]) < 3:
            sim["caisses"].append({"x": 60 + alea(sim) * (W - 120), "y": -20, "vy": 0,
                                   "arme": ARMES_CAISSES[math.floor(alea(sim) * len(ARMES_CAISSES))], "vie": 720})
        sim["prochaineCaisse"] = sim["t"] + 240 + math.floor(alea(sim) * 180)
    for k in range(len(sim["caisses"]) - 1, -1, -1):
        c = sim["caisses"][k]
        c["vie"] -= 1
        if c["vie"] <= 0:
            sim["caisses"].pop(k)
            continue
        avant = c["y"]
        c["vy"] = min(700, c["vy"] + G * 0.5 * DT)
        c["y"] += c["vy"] * DT
        if c["y"] >= SOL:
            c["y"], c["vy"] = SOL, 0
        else:
            for px, py, pw in PLATEFORMES:
                if avant <= py <= c["y"] and px < c["x"] < px + pw:
                    c["y"], c["vy"] = py, 0
        for j in sim["joueurs"]:
            if j["mort"] > 0 or abs(j["x"] - c["x"]) > 26 or c["y"] < j["y"] - HAUT - 10 or c["y"] > j["y"] + 20:
                continue
            if c["arme"] == "soin":
                j["hp"] = min(100, j["hp"] + 45)
                fx(sim, {"type": "soin", "x": c["x"], "y": c["y"]})
            else:
                j["arme"], j["mun"], j["cd"] = c["arme"], ARMES[c["arme"]]["mun"], 0
                fx(sim, {"type": "ramasse", "x": c["x"], "y": c["y"], "arme": c["arme"], "qui": j["i"]})
            sim["caisses"].pop(k)
            break

    for k in range(len(sim["cocos"]) - 1, -1, -1):
        c = sim["cocos"][k]
        c["vy"] = min(900, c["vy"] + G * 0.6 * DT)
        avant = c["y"]
        c["y"] += c["vy"] * DT
        boum = c["y"] >= SOL
        for px, py, pw in PLATEFORMES:
            if avant <= py <= c["y"] and px < c["x"] < px + pw:
                boum = True
        for j in sim["joueurs"]:
            if j["mort"] <= 0 and abs(j["x"] - c["x"]) < 16 and j["y"] - HAUT < c["y"] < j["y"]:
                boum = True
        if boum:
            explosion(sim, c["x"], min(c["y"], SOL), 100, 40, 480, -1)
            sim["cocos"].pop(k)

    if actif and sim["t"] >= sim["prochainMoka"]:
        moka(sim)
        sim["prochainMoka"] = sim["t"] + 600 + math.floor(alea(sim) * 240)
    if sim["t"] >= DEPART + DUREE:
        sim["fini"] = True


def lire_entree(brut):
    """Commandes envoyées par la page : bornées et converties, rien d'autre n'est accepté."""
    if not isinstance(brut, dict):
        brut = {}

    def entier(cle, mini, maxi):
        try:
            return max(mini, min(maxi, int(brut.get(cle, 0))))
        except (TypeError, ValueError):
            return 0

    return {"g": entier("g", 0, 1), "d": entier("d", 0, 1), "b": entier("b", 0, 1), "t": entier("t", 0, 1),
            "saut": entier("saut", 0, 10**9), "ax": entier("ax", -1000, 1000), "ay": entier("ay", -1000, 1000)}


# --------------------------------------------------------------------------- solo contre les robots

def debut(joueur, donnees):
    graine = secrets.randbits(32)
    return {"partie": nouvelle_partie(joueur, "arene", "solo", {"graine": graine}), "graine": graine}


def fin(joueur, donnees):
    partie, _ = lire_partie(joueur, donnees.get("partie"), "arene")
    try:
        k, m, place = int(donnees.get("k")), int(donnees.get("m")), int(donnees.get("place"))
    except (TypeError, ValueError):
        raise ErreurApi("Résultat invalide.")
    duree = maintenant() - partie["debut"]
    if duree < (DEPART + DUREE) / 60 * 0.9 or not (0 <= k <= 40 and 0 <= m <= 60 and 1 <= place <= 4):
        raise ErreurApi("Résultat invalide.")
    score = k * 100 + {1: 300, 2: 100}.get(place, 0)
    bananes = min(35, 3 + 2 * k + {1: 8, 2: 3}.get(place, 0))
    resultat = terminer_partie(joueur, partie, score, bananes)
    resultat.update(k=k, m=m, place=place)
    return {"fin": resultat}


# --------------------------------------------------------------------------- duel en ligne (1 contre 1)

MATCHS = {}          # duel -> {"sim", "debut", "ids", "vu"} (en mémoire : un redémarrage relance la manche)
ATTENTE_MAX = 60     # secondes pour que les deux joueurs arrivent dans l'arène
ABSENCE_MAX = 8      # secondes sans nouvelles d'un joueur pendant le combat : il perd par forfait


def match_de(d):
    m = MATCHS.get(d["id"])
    if m is None:
        etat = json.loads(d["etat"])
        ids = [d["createur"], d["adversaire"]]
        m = {"sim": nouveau(etat["graine"], [duels.pseudo(i) for i in ids]), "debut": None, "ids": ids, "vu": {},
             "cree": maintenant()}
        MATCHS[d["id"]] = m
    return m


def conclure(d, m, gagnant, raison):
    duels.terminer(d, json.loads(d["etat"]), gagnant, raison)
    MATCHS.pop(d["id"], None)


def jouer_duel(joueur, donnees):
    d = duels.verifier_delai(duels.lire_duel(donnees.get("duel")))
    jid = joueur["id"]
    if d["jeu"] != "arene" or jid not in (d["createur"], d["adversaire"]):
        raise ErreurApi("Tu ne participes pas à ce duel.", 403)
    if d["statut"] != "en_cours":
        MATCHS.pop(d["id"], None)
        return {"fini": True, "vue": duels.vue_complete(d, jid)}
    m = match_de(d)
    sim, moi = m["sim"], m["ids"].index(jid)
    maintenant_ = maintenant()
    m["vu"][jid] = maintenant_
    sim["joueurs"][moi]["entree"] = lire_entree(donnees.get("entree"))
    if m["debut"] is None:  # on attend que les deux joueurs soient dans l'arène
        if len(m["vu"]) == 2:
            m["debut"] = maintenant_
            etat = json.loads(d["etat"])
            etat["limite"] = maintenant_ + duels.DUREE_ARENE
            duels.sauver(d, etat)
        elif maintenant_ - m["cree"] > ATTENTE_MAX:
            conclure(d, m, None, "L'adversaire n'est jamais arrivé")
            return {"fini": True, "moi": moi, "sim": sim, "vue": duels.vue_complete(duels.lire_duel(d["id"]), jid)}
        else:
            return {"fini": False, "attente": True, "moi": moi, "sim": sim}
    cible = int((maintenant_ - m["debut"]) * 60)
    for _ in range(min(30, cible - sim["t"])):
        pas(sim)
    autre = m["ids"][1 - moi]
    if sim["t"] > DEPART and maintenant_ - m["vu"][autre] > ABSENCE_MAX:
        conclure(d, m, jid, f"{duels.pseudo(autre)} a quitté l'arène")
    elif sim["fini"]:
        a, b = sim["joueurs"]
        if a["k"] == b["k"]:
            conclure(d, m, None, f"Égalité {a['k']} à {b['k']}")
        else:
            g = a if a["k"] > b["k"] else b
            conclure(d, m, m["ids"][g["i"]], f"{g['nom']} gagne {max(a['k'], b['k'])} à {min(a['k'], b['k'])}")
    else:
        return {"fini": False, "moi": moi, "sim": sim}
    return {"fini": True, "moi": moi, "sim": sim, "vue": duels.vue_complete(duels.lire_duel(d["id"]), jid)}


ROUTES = {"/api/arene/debut": debut, "/api/arene/fin": fin, "/api/arene/duel": jouer_duel}
