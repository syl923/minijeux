"""Gestion du compte par le joueur lui-même (droits RGPD) : consulter et télécharger ses données,
changer son mot de passe, supprimer son compte."""

import secrets

from jeux import duels
from noyau import ErreurApi, db, hacher, lire_joueur, maintenant


def verifier_mot_de_passe(joueur, mdp):
    j = lire_joueur(joueur["id"])
    if not secrets.compare_digest(hacher(str(mdp or ""), j["sel"]), j["hash"]):
        raise ErreurApi("Mot de passe incorrect.")
    return j


def mes_donnees(joueur, requete):
    """Toutes les données personnelles du joueur (droit d'accès et de portabilité)."""
    if not joueur:
        raise ErreurApi("Connecte-toi d'abord.", 401)
    j = lire_joueur(joueur["id"])
    parties = db.execute(
        "SELECT jeu, mode, statut, debut, fin, score, pieces FROM parties WHERE joueur_id = ? ORDER BY debut",
        (j["id"],),
    ).fetchall()
    return {
        "compte": {"pseudo": j["pseudo"], "inscrit_le": j["cree_le"], "pieces": j["pieces"],
                   "pieces_gagnees": j["pieces_gagnees"], "derniere_visite": j["vu_le"]},
        "parties": [dict(p) for p in parties],
        "avatars": {"actuel": j["avatar"] or "moka",
                    "achetes": [dict(a) for a in db.execute(
                        "SELECT avatar, achete_le FROM avatars WHERE joueur_id = ?", (j["id"],)).fetchall()]},
        "note": "Le mot de passe n'est jamais conservé en clair : seule une empreinte chiffrée est stockée.",
    }


def changer_mot_de_passe(joueur, donnees):
    j = verifier_mot_de_passe(joueur, donnees.get("ancien"))
    nouveau = str(donnees.get("nouveau", ""))
    if len(nouveau) < 6:
        raise ErreurApi("Nouveau mot de passe : 6 caractères minimum.")
    sel = secrets.token_hex(16)
    db.execute("UPDATE joueurs SET sel = ?, hash = ? WHERE id = ?", (sel, hacher(nouveau, sel), j["id"]))
    return {"ok": True}


def supprimer(joueur, donnees):
    """Suppression définitive du compte et de toutes ses parties."""
    j = verifier_mot_de_passe(joueur, donnees.get("mot_de_passe"))
    jid = j["id"]
    # duels en cours : l'adversaire gagne ; défis en attente : annulés
    for d in db.execute("SELECT * FROM duels WHERE statut = 'en_cours' AND (createur = ? OR adversaire = ?)", (jid, jid)).fetchall():
        gagnant = duels.autre(d, jid)
        duels.crediter(gagnant, duels.GAIN_VICTOIRE, d["jeu"], True)
        db.execute("UPDATE duels SET statut = 'termine', gagnant = ?, raison = ?, version = version + 1 WHERE id = ?",
                   (gagnant, "L'adversaire a quitté le site", d["id"]))
    db.execute("UPDATE duels SET statut = 'annule', version = version + 1 WHERE statut = 'attente' AND createur = ?", (jid,))
    db.execute("DELETE FROM parties WHERE joueur_id = ?", (jid,))
    db.execute("DELETE FROM avatars WHERE joueur_id = ?", (jid,))
    db.execute("DELETE FROM sessions WHERE joueur_id = ?", (jid,))
    db.execute("DELETE FROM joueurs WHERE id = ?", (jid,))
    return {"ok": True, "supprime_le": maintenant()}


ROUTES = {"/api/compte/mot_de_passe": changer_mot_de_passe, "/api/compte/supprimer": supprimer}
ROUTES_GET = {"/api/compte/donnees": mes_donnees}
