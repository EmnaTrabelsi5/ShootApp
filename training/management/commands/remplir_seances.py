"""
Crée un planning d'entraînement réaliste pour la démonstration du module Séances.

    python manage.py remplir_seances            # ajoute 3 semaines de séances à partir d'aujourd'hui
    python manage.py remplir_seances --vider    # supprime d'abord TOUTES les séances existantes
    python manage.py remplir_seances --semaines 4

- Joueurs convoqués : les vrais joueurs du module Joueurs (les blessés ne sont jamais convoqués).
- Matchs : les vrais matchs du module Matchs ; pas de séance un jour de match, décrassage le lendemain.
- Rien n'est modifié dans les autres modules (lecture seule).
"""
from datetime import date, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from training.exercices import PAR_ID as EXOS
from training.joueurs import get_joueurs
from training.matchs import get_matchs
from training.models import Atelier, Seance
from training.regles import JOUEURS_MAX

# Micro-cycle type, du lundi (0) au dimanche (6)
# (type, objectif, titre, description, rpe, début, fin, terrain, exercices, nb convoqués)
SEMAINE = {
    0: ("DECRASSAGE", "RECUPERATION", "Décrassage et soins",
        "Footing léger, mobilité et étirements. Bilan médical avec le staff.", 3,
        time(10, 0), time(11, 0), "Annexe 1", ["footing-leger", "passes-recup"], 16),
    1: ("ENTRAINEMENT", "PHYSIQUE", "Puissance et vitesse",
        "Séance athlétique : accélérations, changements de direction, puis jeu réduit à haute intensité.", 8,
        time(9, 30), time(11, 15), "Honneur", ["sprints-navette", "circuit-agilite"], 22),
    2: ("ENTRAINEMENT", "TACTIQUE", "Pressing haut et transitions",
        "Déclencheurs du pressing sur passe latérale, récupération haute et projection rapide.", 7,
        time(10, 0), time(11, 45), "Honneur", ["rondo-4v2", "pressing-3v3"], 22),
    3: ("ENTRAINEMENT", "TECHNIQUE", "Jeu court et conservation",
        "Qualité de passe, orientation du corps et conduite de balle sous pression.", 6,
        time(10, 0), time(11, 30), "Synthétique", ["passes-triangle", "conduite-slalom"], 22),
    4: ("ENTRAINEMENT", "FINITION", "Finition et coups de pied arrêtés",
        "Centres, reprises et combinaisons dans les 30 derniers mètres. Travail des CPA offensifs.", 6,
        time(10, 0), time(11, 30), "Honneur", ["centre-reprise", "une-deux-frappe"], 20),
    5: ("ENTRAINEMENT", "TACTIQUE", "Mise en place tactique",
        "Rappel du plan de jeu, placement sur coups de pied arrêtés, activation courte.", 5,
        time(10, 30), time(11, 30), "Honneur", ["rondo-4v2", "passes-triangle"], 20),
    6: ("REPOS", "RECUPERATION", "Repos actif",
        "Récupération libre : marche, vélo ou piscine. Hydratation et sommeil.", 2,
        None, None, "", [], 0),
}
LENDEMAIN_DE_MATCH = SEMAINE[0]
VEILLE_DE_MATCH = ("ENTRAINEMENT", "TACTIQUE", "Veille de match : mise en place",
                   "Rappel du plan de jeu, placement sur coups de pied arrêtés, activation courte.", 5,
                   time(10, 30), time(11, 30), "Honneur", ["rondo-4v2", "passes-triangle"], 20)

# Ateliers des séances de travail (titre, consignes, durée en minutes)
ATELIERS = {
    "PHYSIQUE": [("Échauffement dynamique", "Gammes athlétiques et mobilité articulaire", 15),
                 ("Sprints navette 20 m", "6 x 20 m, récupération 30 s, 2 séries", 20),
                 ("Circuit d'agilité", "Zigzag entre plots, appuis courts", 20),
                 ("Jeu réduit 4v4", "Terrain 30 x 20 m, 4 x 3 min intenses", 25)],
    "TACTIQUE": [("Rondo 4v2 d'activation", "Espace 12 x 12 m, 2 touches max", 15),
                 ("Pressing sur passe latérale", "Déclencheur sur la passe du latéral, bloc qui coulisse", 25),
                 ("Opposition 8v8 à thème", "But valant double après récupération haute", 30),
                 ("Retour au calme", "Étirements et débrief vidéo", 10)],
    "TECHNIQUE": [("Passes en triangle", "Passe et suis, pied faible imposé", 20),
                  ("Conduite en slalom", "12 plots, relais par équipes", 15),
                  ("Conservation 5v5 + 2 jokers", "Terrain 35 x 25 m, 10 passes = 1 point", 25),
                  ("Retour au calme", "Étirements", 10)],
    "FINITION": [("Une-deux et frappe", "Enchaînement remise-frappe, 2 colonnes", 20),
                 ("Centre et reprise", "Centres des deux côtés, 3 attaquants dans la surface", 25),
                 ("Coups de pied arrêtés", "Corners offensifs : 3 combinaisons", 20),
                 ("Retour au calme", "Étirements", 10)],
    "RECUPERATION": [("Footing léger", "20 min en aisance respiratoire", 20),
                     ("Passes courtes", "Toucher de balle, sans opposition", 15),
                     ("Étirements et soins", "Avec le kiné", 20)],
}


def _materiel(exercices):
    """Matériel suffisant pour tous les exercices de la séance, arrondi pour le groupe."""
    besoins = {}
    for e in exercices:
        for cle, qte in EXOS[e].get("besoins", {}).items():
            besoins[cle] = max(besoins.get(cle, 0), qte)
    if exercices:
        besoins["ballon"] = max(besoins.get("ballon", 0), 12)
        besoins["coupelle"] = max(besoins.get("coupelle", 0), 20)
        besoins["chasuble"] = max(besoins.get("chasuble", 0), 10)
    return besoins


def _convoques(joueurs, nombre):
    """Les gardiens d'abord (3 max), puis les joueurs de champ ; jamais les blessés."""
    aptes = [j for j in joueurs if j.statut != "BLESSE"]
    gardiens = [j for j in aptes if j.poste == "GARDIEN"][:3]
    champ = [j for j in aptes if j.poste != "GARDIEN"]
    # alternance des postes pour un groupe équilibré
    par_poste = {p: [j for j in champ if j.poste == p] for p in ("DEFENSE", "MILIEU", "ATTAQUE")}
    ordre = []
    while any(par_poste.values()):
        for p in ("DEFENSE", "MILIEU", "ATTAQUE"):
            if par_poste[p]:
                ordre.append(par_poste[p].pop(0))
    choisis = (gardiens + ordre)[:min(nombre, JOUEURS_MAX)]
    return [j.id for j in choisis]


class Command(BaseCommand):
    help = "Crée des séances d'entraînement réalistes (vrais joueurs, vrais matchs) pour la démonstration."

    def add_arguments(self, parser):
        parser.add_argument("--semaines", type=int, default=3, help="Nombre de semaines à remplir (défaut : 3).")
        parser.add_argument("--vider", action="store_true", help="Supprime d'abord toutes les séances existantes.")

    @transaction.atomic
    def handle(self, *args, semaines, vider, **options):
        if vider:
            n = Seance.objects.count()
            Seance.objects.all().delete()
            self.stdout.write(f"{n} séance(s) supprimée(s).")

        aujourdhui = date.today()
        fin = aujourdhui + timedelta(days=7 * semaines - 1)
        joueurs = get_joueurs()
        jours_match = {m.date for m in get_matchs(aujourdhui - timedelta(days=1), fin + timedelta(days=1))}
        crees = ignores = 0

        jour = aujourdhui
        while jour <= fin:
            if jour in jours_match:
                ignores += 1
                jour += timedelta(days=1)
                continue
            if (jour - timedelta(days=1)) in jours_match:
                modele = LENDEMAIN_DE_MATCH
            elif (jour + timedelta(days=1)) in jours_match:
                modele = VEILLE_DE_MATCH
            else:
                modele = SEMAINE[jour.weekday()]
            type_s, objectif, titre, desc, rpe, debut, fin_h, terrain, exos, nb = modele
            if Seance.objects.filter(date=jour, titre=titre).exists():   # relancer la commande ne crée pas de doublon
                jour += timedelta(days=1)
                continue
            ids = _convoques(joueurs, nb) if nb else []
            seance = Seance.objects.create(
                date=jour, heure_debut=debut, heure_fin=fin_h, type_seance=type_s, objectif=objectif,
                titre=titre, description=desc, rpe=rpe, nb_joueurs=max(len(ids), 1), terrain=terrain,
                joueurs_ids=ids, exercices=exos, materiel=_materiel(exos),
            )
            if type_s != "REPOS":
                ateliers = ATELIERS[objectif]
                total = sum(a[2] for a in ateliers)
                dispo = seance.duree_minutes() or total
                echelle = min(1, dispo / total)            # les ateliers tiennent dans la durée de la séance
                for numero, (t, d, duree) in enumerate(ateliers, start=1):
                    Atelier.objects.create(seance=seance, numero=numero, titre=t, description=d,
                                           duree_minutes=max(5, int(duree * echelle) // 5 * 5))
            crees += 1
            jour += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(
            f"{crees} séance(s) créée(s) du {aujourdhui:%d/%m} au {fin:%d/%m} "
            f"({ignores} jour(s) de match laissé(s) libres)."))
