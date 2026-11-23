"""
Règles de validation d'une séance (partagées par le formulaire Django et la
validation en direct dans le navigateur, cf. static/training/js/validation.js).
"""
from datetime import time

TITRE_MIN, TITRE_MAX = 3, 80
JOURS_MAX_AVANCE = 365            # on ne planifie pas plus d'un an à l'avance
HEURE_MIN, HEURE_MAX = time(7, 0), time(22, 0)
DUREE_MIN, DUREE_MAX = 30, 180    # minutes
TERRAIN_MIN, TERRAIN_MAX = 2, 50
DESCRIPTION_MAX = 1000
JOUEURS_MAX = 30
# Nombre minimum de joueurs convoqués selon le type
JOUEURS_MIN = {"ENTRAINEMENT": 6, "DECRASSAGE": 1, "REPOS": 0}
# Au moins un exercice pour ces types
EXERCICE_OBLIGATOIRE = ["ENTRAINEMENT"]
# RPE cohérent avec l'objectif
RPE_OBJECTIF = {"RECUPERATION": {"max": 5}, "PHYSIQUE": {"min": 5}}


def pour_js():
    return {
        "titre": [TITRE_MIN, TITRE_MAX], "jours_max": JOURS_MAX_AVANCE,
        "heures": [HEURE_MIN.strftime("%H:%M"), HEURE_MAX.strftime("%H:%M")],
        "duree": [DUREE_MIN, DUREE_MAX], "terrain": [TERRAIN_MIN, TERRAIN_MAX],
        "description_max": DESCRIPTION_MAX, "joueurs_max": JOUEURS_MAX, "joueurs_min": JOUEURS_MIN,
        "exercice_obligatoire": EXERCICE_OBLIGATOIRE, "rpe_objectif": RPE_OBJECTIF,
    }
