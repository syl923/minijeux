"""Sauvegarde de la base Moka Arcade (copie cohérente même pendant que le site tourne).

    python scripts/sauvegarde.py [dossier]        # par défaut : donnees/sauvegardes/

Garde les 14 dernières copies. À lancer chaque nuit (tâche planifiée de l'hébergeur).
"""

import os
import sqlite3
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
BASE = os.environ.get("MINIJEUX_BASE", str(RACINE / "donnees" / "minijeux.db"))
DOSSIER = Path(sys.argv[1] if len(sys.argv) > 1 else RACINE / "donnees" / "sauvegardes")
GARDER = 14

DOSSIER.mkdir(parents=True, exist_ok=True)
cible = DOSSIER / f"minijeux-{time.strftime('%Y-%m-%d-%H%M')}.db"
with sqlite3.connect(BASE) as source, sqlite3.connect(cible) as copie:
    source.backup(copie)
print("Sauvegarde :", cible)
for ancienne in sorted(DOSSIER.glob("minijeux-*.db"))[:-GARDER]:
    ancienne.unlink()
    print("Supprimée :", ancienne)
