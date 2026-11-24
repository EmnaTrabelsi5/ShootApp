"""
Bibliothèque d'exercices animés en 3D (définis dans le code, pas de base de données).

Chaque exercice est lié à un OBJECTIF de séance (Tactique, Technique, Physique,
Finition, Récupération). Une séance garde seulement la liste des identifiants
choisis (Seance.exercices).

Le "scenario" décrit l'animation 3D jouée par static/training/js/exercices3d.js :
  - unités en mètres ; x = longueur du terrain (le but est en x = 22), z = largeur
  - acteurs : équipe "A" (maillot vert), "B" (chasubles orange), "GK" (gardien)
  - chemins : liste de [temps_s, x, z]  (le joueur court d'un point au suivant)
  - ballons : liste de [temps_s, x, z, hauteur, lob]  (lob = hauteur de la courbe
    jusqu'au point suivant, 0 = passe à ras de terre)
  - plots : positions [x, z] ;  but : True pour afficher le but en x = 22
  - boucle : True si la fin rejoint le début (sinon fondu entre deux répétitions)

Pour ajouter un exercice : copie un bloc de EXERCICES, change l'id, l'objectif et
le scénario. Rien d'autre à modifier.
"""
import math


def _cercle(cx, cz, rx, rz, duree, depart=0.0, pas=16, sens=1):
    """Chemin qui fait le tour d'une ellipse en `duree` secondes (boucle parfaite)."""
    pts = []
    for i in range(pas + 1):
        a = depart + sens * 2 * math.pi * i / pas
        pts.append([round(duree * i / pas, 2), round(cx + rx * math.cos(a), 2), round(cz + rz * math.sin(a), 2)])
    return pts


def _immobile(x, z, duree):
    return [[0, x, z], [duree, x, z]]


EXERCICES = [
    # ------------------------------------------------------------------ TACTIQUE
    {
        "id": "rondo-4v2",
        "nom": "Rondo 4 contre 2",
        "objectif": "TACTIQUE",
        "duree": 15,
        "joueurs": 6,
        "materiel": "4 plots, 1 ballon, 2 chasubles",
        "description": "Conservation dans un carré de 10 m : 4 joueurs à l'extérieur, 2 récupérateurs au centre.",
        "consignes": ["2 touches maximum", "Passe qui casse les deux récupérateurs = 1 point",
                      "Le joueur qui perd le ballon passe au centre"],
        "scenario": {
            "duree": 8.4, "boucle": True, "but": False,
            "plots": [[-5, -5], [5, -5], [5, 5], [-5, 5]],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, -5.6, -5.6], [4, -5.4, -5.8], [8.4, -5.6, -5.6]]},
                {"equipe": "A", "chemin": [[0, 5.6, -5.6], [4, 5.8, -5.4], [8.4, 5.6, -5.6]]},
                {"equipe": "A", "chemin": [[0, 5.6, 5.6], [4, 5.4, 5.8], [8.4, 5.6, 5.6]]},
                {"equipe": "A", "chemin": [[0, -5.6, 5.6], [4, -5.8, 5.4], [8.4, -5.6, 5.6]]},
                {"equipe": "B", "chemin": [[0, -1, -1], [1.3, 2, -2.6], [2.9, 2.6, 2.4], [4.4, -2, 2.6],
                                            [6.2, 1, -1], [7.8, -2, -2.6], [8.4, -1, -1]]},
                {"equipe": "B", "chemin": [[0, 1, 1], [1.3, 1, -1], [2.9, 1.2, 1.2], [4.4, -1, 1],
                                            [6.2, 2.2, 0], [7.8, -1, -1.2], [8.4, 1, 1]]},
            ],
            "ballons": [[[0, -5, -5, 0, 0], [0.3, -5, -5, 0, 0], [1.3, 5, -5, 0, 0], [1.9, 5, -5, 0, 0],
                         [2.9, 5, 5, 0, 0], [3.4, 5, 5, 0, 0], [4.4, -5, 5, 0, 0], [4.9, -5, 5, 0, 0],
                         [6.2, 5, -5, 0, 0], [6.7, 5, -5, 0, 0], [7.8, -5, -5, 0, 0], [8.4, -5, -5, 0, 0]]],
        },
    },
    {
        "id": "pressing-3v3",
        "nom": "Pressing : déclencheur sur passe latérale",
        "objectif": "TACTIQUE",
        "duree": 20,
        "joueurs": 6,
        "materiel": "1 ballon, 3 chasubles, 6 plots",
        "description": "Les attaquants verts déclenchent le pressing dès la passe vers le latéral orange, ferment la passe en retrait et récupèrent haut.",
        "consignes": ["Déclencheur : passe vers le côté", "Le 2e joueur coupe la passe en retrait",
                      "Récupération en moins de 5 secondes"],
        "scenario": {
            "duree": 7.5, "boucle": False, "but": False,
            "plots": [[-14, -12], [-14, 12], [2, -12], [2, 12]],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, -2, 6], [1.0, -2.5, 6], [2.5, -7.4, 7.2], [3.2, -6, 6],
                                            [4.6, -2, 3], [7.5, -1.5, 2.5]]},
                {"equipe": "A", "chemin": [[0, -3, 0], [1.0, -3.4, 0], [2.6, -8.5, 2.5], [7.5, -6.5, 1.5]]},
                {"equipe": "A", "chemin": [[0, -2, -6], [1.0, -2.4, -6], [2.6, -5.5, -7], [4.6, 0, -4],
                                            [5.6, 2, -3], [7.5, 3, -2]]},
                {"equipe": "B", "chemin": [[0, -12, 0], [2.6, -11.5, 0.5], [7.5, -11, 1]]},
                {"equipe": "B", "chemin": [[0, -10, 10], [1.4, -8.6, 8.2], [2.6, -8.2, 7.8], [4, -9, 9.5], [7.5, -9.5, 10]]},
                {"equipe": "B", "chemin": [[0, -7, -8], [4.6, -5, -7], [7.5, -4, -6]]},
            ],
            "ballons": [[[0, -11.4, 0, 0, 0], [0.8, -11.4, 0, 0, 0], [2.0, -8.2, 7.6, 0, 0], [2.6, -7.9, 7.3, 0, 0],
                         [3.2, -5.6, 5.8, 0, 0], [4.6, -1.6, 2.8, 0, 0], [5.6, 1.6, -2.8, 0, 0], [7.5, 2.6, -1.8, 0, 0]]],
        },
    },
    # ----------------------------------------------------------------- TECHNIQUE
    {
        "id": "passes-triangle",
        "nom": "Passes en triangle (passe et suis)",
        "objectif": "TECHNIQUE",
        "duree": 15,
        "joueurs": 4,
        "materiel": "3 plots, 1 ballon",
        "description": "Triangle de 12 m : je passe et je suis ma passe. Qualité de la passe et du contrôle orienté.",
        "consignes": ["Contrôle orienté vers le plot suivant", "Passe à ras de terre, pied ferme",
                      "Changer de sens toutes les 2 minutes"],
        "scenario": {
            "duree": 6.0, "boucle": False, "but": False,
            "plots": [[-6, -5], [6, -5], [0, 6]],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, -6.6, -5.4], [0.5, -6.6, -5.4], [2.4, 5.6, -6], [6, 5.8, -6]]},
                {"equipe": "A", "chemin": [[0, 6.6, -5.4], [2.0, 6.6, -5.4], [4.0, 0.8, 6.8], [6, 1, 7]]},
                {"equipe": "A", "chemin": [[0, 0, 6.8], [3.6, 0, 6.8], [5.6, -6.2, -4.6], [6, -6.2, -4.6]]},
                {"equipe": "A", "chemin": [[0, -8, -7], [3.2, -8, -7], [4.6, -6.8, -5.6], [6, -6.8, -5.6]]},
            ],
            "ballons": [[[0, -6, -5, 0, 0], [0.5, -6, -5, 0, 0], [1.6, 6, -5, 0, 0], [2.0, 6, -5, 0, 0],
                         [3.2, 0, 6, 0, 0], [3.6, 0, 6, 0, 0], [4.8, -6.2, -5.2, 0, 0], [6, -6.2, -5.2, 0, 0]]],
        },
    },
    {
        "id": "conduite-slalom",
        "nom": "Conduite de balle en slalom",
        "objectif": "TECHNIQUE",
        "duree": 10,
        "joueurs": 2,
        "materiel": "12 plots, 2 ballons",
        "description": "Deux colonnes de plots tous les 4 m : slalom balle au pied, puis accélération sur 5 m.",
        "consignes": ["Toucher le ballon à chaque pas", "Utiliser l'intérieur et l'extérieur du pied",
                      "Tête levée entre deux plots"],
        "scenario": {
            "duree": 7.0, "boucle": False, "but": False,
            "plots": [[x, z] for z in (-4, 4) for x in (-10, -6, -2, 2, 6, 10)],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, -13, -4], [0.8, -10, -5.4], [1.6, -6, -2.6], [2.4, -2, -5.4],
                                            [3.2, 2, -2.6], [4.0, 6, -5.4], [4.8, 10, -2.6], [5.8, 15, -4], [7, 16, -4]]},
                {"equipe": "A", "chemin": [[0, -15, 4], [0.9, -15, 4], [1.8, -10, 5.4], [2.6, -6, 2.6], [3.4, -2, 5.4],
                                            [4.2, 2, 2.6], [5.0, 6, 5.4], [5.8, 10, 2.6], [7, 14, 4]]},
            ],
            "ballons": [
                [[0, -12.4, -4, 0, 0], [0.8, -9.4, -5.3, 0, 0], [1.6, -5.4, -2.7, 0, 0], [2.4, -1.4, -5.3, 0, 0],
                 [3.2, 2.6, -2.7, 0, 0], [4.0, 6.6, -5.3, 0, 0], [4.8, 10.6, -2.7, 0, 0], [5.8, 15.8, -4, 0, 0], [7, 16.6, -4, 0, 0]],
                [[0, -14.4, 4, 0, 0], [0.9, -14.4, 4, 0, 0], [1.8, -9.4, 5.3, 0, 0], [2.6, -5.4, 2.7, 0, 0], [3.4, -1.4, 5.3, 0, 0],
                 [4.2, 2.6, 2.7, 0, 0], [5.0, 6.6, 5.3, 0, 0], [5.8, 10.6, 2.7, 0, 0], [7, 14.6, 4, 0, 0]],
            ],
        },
    },
    # ------------------------------------------------------------------ PHYSIQUE
    {
        "id": "sprints-navette",
        "nom": "Sprints navette 20 m",
        "objectif": "PHYSIQUE",
        "duree": 12,
        "joueurs": 3,
        "materiel": "6 plots",
        "description": "Aller-retour de 20 m à intensité maximale, départs décalés, récupération active entre les répétitions.",
        "consignes": ["6 à 8 répétitions", "Appuis courts au demi-tour", "30 s de récupération marchée"],
        "scenario": {
            "duree": 6.4, "boucle": False, "but": False,
            "plots": [[x, z] for z in (-5, 0, 5) for x in (-10, 10)],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, -11, -5], [0.2, -11, -5], [2.4, 9.6, -5], [2.6, 9.6, -5], [4.8, -10.6, -5], [6.4, -11.5, -5]]},
                {"equipe": "A", "chemin": [[0, -11, 0], [0.7, -11, 0], [2.9, 9.6, 0], [3.1, 9.6, 0], [5.3, -10.6, 0], [6.4, -11.2, 0]]},
                {"equipe": "A", "chemin": [[0, -11, 5], [1.2, -11, 5], [3.4, 9.6, 5], [3.6, 9.6, 5], [5.8, -10.6, 5], [6.4, -10.9, 5]]},
            ],
            "ballons": [],
        },
    },
    {
        "id": "circuit-agilite",
        "nom": "Circuit d'agilité en zigzag",
        "objectif": "PHYSIQUE",
        "duree": 12,
        "joueurs": 2,
        "materiel": "5 plots",
        "description": "Zigzag entre 5 plots : changements de direction rapides, centre de gravité bas.",
        "consignes": ["Contourner chaque plot par l'extérieur", "Pas chassés sur les appuis",
                      "Départ du 2e joueur au 3e plot du 1er"],
        "scenario": {
            "duree": 7.0, "boucle": False, "but": False,
            "plots": [[-8, -3], [-4, 3], [0, -3], [4, 3], [8, -3]],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, -12, 0], [0.3, -12, 0], [1.1, -8, -4], [1.9, -4, 4], [2.7, 0, -4],
                                            [3.5, 4, 4], [4.3, 8, -4], [5.4, 13, 0], [7, 14, 0]]},
                {"equipe": "A", "chemin": [[0, -14, 1.5], [1.9, -13, 0.5], [2.7, -8, -4], [3.5, -4, 4], [4.3, 0, -4],
                                            [5.1, 4, 4], [5.9, 8, -4], [7, 12, 0]]},
            ],
            "ballons": [],
        },
    },
    # ------------------------------------------------------------------ FINITION
    {
        "id": "centre-reprise",
        "nom": "Centre et reprise devant le but",
        "objectif": "FINITION",
        "duree": 20,
        "joueurs": 4,
        "materiel": "1 but, 6 ballons, 2 plots",
        "description": "Débordement de l'ailier, centre en retrait et reprise de l'attaquant au point de penalty.",
        "consignes": ["Appel croisé de l'attaquant", "Centre tendu entre gardien et défenseurs",
                      "Reprise du plat du pied, cadrée"],
        "scenario": {
            "duree": 5.4, "boucle": False, "but": True,
            "plots": [[8, -12], [14, -12]],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, 7.5, -12.4], [1.6, 14, -12.4], [2.2, 15, -12], [5.4, 15.5, -11]]},
                {"equipe": "A", "chemin": [[0, 8, 3], [1.2, 10, 2.4], [2.6, 15.6, -0.6], [3.2, 16.6, -0.4], [5.4, 17.5, 0]]},
                {"equipe": "B", "chemin": [[0, 10, 4.5], [2.6, 15, 1.2], [5.4, 15.6, 1.4]]},
                {"equipe": "GK", "chemin": [[0, 21.2, 0], [2.0, 21.2, -1.4], [2.9, 21.2, -0.6], [3.3, 21.2, 2.0], [5.4, 21.2, 2.2]]},
            ],
            "ballons": [[[0, 8.1, -12.2, 0, 0], [1.6, 14.6, -12.2, 0, 3.2], [2.8, 16.2, -0.6, 0.4, 0],
                         [3.4, 22.4, 2.7, 1.6, 0], [3.7, 23.0, 2.9, 0.6, 0], [5.4, 23.0, 2.9, 0, 0]]],
        },
    },
    {
        "id": "une-deux-frappe",
        "nom": "Une-deux et frappe",
        "objectif": "FINITION",
        "duree": 15,
        "joueurs": 3,
        "materiel": "1 but, 8 ballons, 1 mannequin ou plot",
        "description": "Passe dans les pieds du pivot, remise en une touche dans la course et frappe rapide.",
        "consignes": ["Accélérer après la passe", "Remise en une touche dans la course",
                      "Frappe en 2 touches maximum"],
        "scenario": {
            "duree": 5.0, "boucle": False, "but": True,
            "plots": [[13, -4]],
            "acteurs": [
                {"equipe": "A", "chemin": [[0, 6, -6], [0.4, 6.4, -6], [2.2, 13.6, -6.8], [2.8, 15.4, -4.2], [5, 16.4, -3.4]]},
                {"equipe": "A", "chemin": [[0, 12.6, -1.4], [5, 12.6, -1.4]]},
                {"equipe": "GK", "chemin": [[0, 21.2, 0], [2.4, 21.1, -1.2], [3.2, 21.1, -2.4], [5, 21.1, -2.6]]},
            ],
            "ballons": [[[0, 6.6, -5.8, 0, 0], [0.5, 6.6, -5.8, 0, 0], [1.3, 12.2, -1.6, 0, 0], [1.5, 12.2, -1.6, 0, 0],
                         [2.6, 15.0, -4.2, 0, 0], [2.9, 15.6, -4.0, 0, 0], [3.3, 22.4, -2.8, 0.5, 0],
                         [3.6, 23.0, -2.9, 0.2, 0], [5, 23.0, -2.9, 0, 0]]],
        },
    },
    # -------------------------------------------------------------- RÉCUPÉRATION
    {
        "id": "footing-leger",
        "nom": "Footing de récupération",
        "objectif": "RECUPERATION",
        "duree": 15,
        "joueurs": 6,
        "materiel": "4 plots",
        "description": "Footing lent en groupe autour d'une zone de 24 × 14 m, respiration contrôlée.",
        "consignes": ["Allure conversationnelle", "Relâchement des épaules", "10 à 15 minutes"],
        "scenario": {
            "duree": 12.0, "boucle": True, "but": False,
            "plots": [[-12, -7], [12, -7], [12, 7], [-12, 7]],
            "acteurs": [{"equipe": "A", "chemin": _cercle(0, 0, 12.8 - (i % 2) * 1.4, 7.8 - (i % 2) * 1.4, 12.0,
                                                          depart=i * 0.55, pas=24)} for i in range(6)],
            "ballons": [],
        },
    },
    {
        "id": "passes-recup",
        "nom": "Passes courtes de récupération",
        "objectif": "RECUPERATION",
        "duree": 10,
        "joueurs": 4,
        "materiel": "2 ballons",
        "description": "Par deux à 8 m, passes tranquilles et contrôle, intensité très basse.",
        "consignes": ["Passe douce, contrôle amorti", "Changer de pied toutes les 10 passes", "Aucune course"],
        "scenario": {
            "duree": 4.8, "boucle": True, "but": False,
            "plots": [],
            "acteurs": [
                {"equipe": "A", "chemin": _immobile(-4.6, -4, 4.8)},
                {"equipe": "A", "chemin": _immobile(4.6, -4, 4.8)},
                {"equipe": "A", "chemin": _immobile(-4.6, 4, 4.8)},
                {"equipe": "A", "chemin": _immobile(4.6, 4, 4.8)},
            ],
            "ballons": [
                [[0, -4, -4, 0, 0], [0.6, -4, -4, 0, 0], [2.4, 4, -4, 0, 0], [3.0, 4, -4, 0, 0], [4.8, -4, -4, 0, 0]],
                [[0, 4, 4, 0, 0], [0.6, 4, 4, 0, 0], [2.4, -4, 4, 0, 0], [3.0, -4, 4, 0, 0], [4.8, 4, 4, 0, 0]],
            ],
        },
    },
]

PAR_ID = {e["id"]: e for e in EXERCICES}


def exercices_pour(objectif):
    return [e for e in EXERCICES if e["objectif"] == objectif]


# Matériel nécessaire à chaque exercice, déduit du texte "materiel"
# ("4 plots, 1 ballon, 2 chasubles" -> {"plot": 4, "ballon": 1, "chasuble": 2}).
# Sert à vérifier que le matériel choisi pour la séance suffit.
_MOTS_MATERIEL = {"plot": "plot", "ballon": "ballon", "chasuble": "chasuble", "coupelle": "coupelle",
                  "piquet": "piquet", "mini-but": "mini_but", "but": "grand_but", "mannequin": "mannequin",
                  "échelle": "echelle", "haie": "haie", "cerceau": "cerceau"}


def _besoins(texte):
    import re
    besoins = {}
    for qte, mot in re.findall(r"(\d+)\s+([\wéè-]+)", texte or ""):
        mot = mot.lower().rstrip("sx") if mot.lower() not in ("mini-buts",) else "mini-but"
        cle = _MOTS_MATERIEL.get(mot)
        if cle:
            besoins[cle] = max(besoins.get(cle, 0), int(qte))
    return besoins


for _e in EXERCICES:
    _e["besoins"] = _besoins(_e["materiel"])
