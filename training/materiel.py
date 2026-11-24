"""
Catalogue du matériel d'entraînement (défini dans le code).

Une séance garde son matériel dans Seance.materiel sous la forme
{"ballon": 12, "plot": 20, ...}. Les modèles 3D correspondants sont dessinés
par static/training/js/materiel3d.js (même identifiant).

Pour ajouter un matériel : ajoute une ligne ici ET un modèle dans materiel3d.js.
"""

MATERIEL = [
    {"id": "ballon",    "nom": "Ballons",            "defaut": 12, "max": 60},
    {"id": "plot",      "nom": "Plots",              "defaut": 16, "max": 100},
    {"id": "coupelle",  "nom": "Coupelles",          "defaut": 20, "max": 100},
    {"id": "chasuble",  "nom": "Chasubles",          "defaut": 10, "max": 40},
    {"id": "piquet",    "nom": "Piquets",            "defaut": 8,  "max": 40},
    {"id": "mini_but",  "nom": "Mini-buts",          "defaut": 4,  "max": 12},
    {"id": "grand_but", "nom": "Buts mobiles",       "defaut": 2,  "max": 4},
    {"id": "mannequin", "nom": "Mannequins",         "defaut": 4,  "max": 20},
    {"id": "echelle",   "nom": "Échelles de rythme", "defaut": 2,  "max": 10},
    {"id": "haie",      "nom": "Haies",              "defaut": 6,  "max": 30},
    {"id": "cerceau",   "nom": "Cerceaux",           "defaut": 8,  "max": 30},
]

PAR_ID = {m["id"]: m for m in MATERIEL}


def materiel_affiche(valeur):
    """{"ballon": 12} -> [{"id": "ballon", "nom": "Ballons", "quantite": 12}, ...] (ordre du catalogue)."""
    valeur = valeur or {}
    return [dict(m, quantite=valeur[m["id"]]) for m in MATERIEL if valeur.get(m["id"])]
