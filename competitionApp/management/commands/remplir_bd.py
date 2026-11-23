"""
Commande pour remplir la base de données avec des données de test.

Utilisation (dans le dossier qui contient manage.py) :
    python manage.py remplir_bd           -> remplit la base
    python manage.py remplir_bd --vider   -> supprime d'abord les matchs, compétitions
                                             et événements existants, puis remplit

Les dates sont calculées à partir d'aujourd'hui : il y a toujours des matchs
passés, un match en cours et des matchs à venir, quel que soit le jour du test.
"""
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from competitionApp.models import Competition, EvenementMatch, Match
from entraineurApp.models import Entraineur
from equipeApp.models import Equipe
from joueurApp.models import Joueur
from presidentApp.models import President
from staffApp.models import Staff
from utilisateurApp.models import Utilisateur

MOT_DE_PASSE = "devai2026"

EQUIPES = [
    # (nom, ville)
    ("Espérance ST", "Tunis"),
    ("Club Africain", "Tunis"),
    ("Étoile du Sahel", "Sousse"),
    ("CS Sfaxien", "Sfax"),
    ("US Monastir", "Monastir"),
    ("Stade Tunisien", "Tunis"),
]

PRENOMS = ["Amine", "Bilel", "Chedi", "Dali", "Elyes", "Fedi", "Ghassen", "Hamza", "Iheb",
           "Karim", "Louay", "Mehdi", "Nader", "Oussema", "Rayen", "Seif", "Taha", "Wassim"]
NOMS = ["Ben Ali", "Trabelsi", "Jebali", "Gharbi", "Mejri", "Ayari", "Haddad", "Saidi",
        "Bouazizi", "Khelifi", "Ferchichi", "Hamdi", "Zouari", "Chaabane", "Mansouri"]

# Effectif de chaque équipe : (poste, numéro de maillot, pied fort)
# indice 0 = gardien, 1-2 = défenseurs, 3 = milieu, 4 = attaquant, 5 = attaquant remplaçant
EFFECTIF = [
    (Joueur.Poste.GARDIEN, 1, Joueur.PiedFort.DROIT),
    (Joueur.Poste.DEFENSEUR, 4, Joueur.PiedFort.DROIT),
    (Joueur.Poste.DEFENSEUR, 5, Joueur.PiedFort.GAUCHE),
    (Joueur.Poste.MILIEU, 8, Joueur.PiedFort.DROIT),
    (Joueur.Poste.ATTAQUANT, 9, Joueur.PiedFort.GAUCHE),
    (Joueur.Poste.ATTAQUANT, 11, Joueur.PiedFort.AMBIDEXTRE),
]
GB, DEF1, DEF2, MIL, ATT, REMPLACANT = range(6)

BUT = EvenementMatch.TypeEvenement.BUT
PENALTY = EvenementMatch.TypeEvenement.PENALTY
CARTON_JAUNE = EvenementMatch.TypeEvenement.CARTON_JAUNE
CARTON_ROUGE = EvenementMatch.TypeEvenement.CARTON_ROUGE
REMPLACEMENT = EvenementMatch.TypeEvenement.REMPLACEMENT


class Command(BaseCommand):
    help = "Remplit la base de données avec des équipes, joueurs, compétitions, matchs et événements de test."

    def add_arguments(self, parser):
        parser.add_argument(
            "--vider", action="store_true",
            help="Supprime d'abord les matchs, compétitions et événements existants.",
        )

    # transaction.atomic : si une erreur arrive au milieu, rien n'est enregistré
    @transaction.atomic
    def handle(self, *args, **options):
        if Match.objects.exists() or Competition.objects.exists():
            if not options["vider"]:
                raise CommandError(
                    "La base contient déjà des matchs ou des compétitions. "
                    "Relancez avec : python manage.py remplir_bd --vider"
                )
            EvenementMatch.objects.all().delete()
            Match.objects.all().delete()
            Competition.objects.all().delete()
            self.stdout.write("Anciens matchs, compétitions et événements supprimés.")

        self.aujourd_hui = timezone.localdate()

        # 1. Comptes utilisateurs ------------------------------------------------
        # is_staff=True : nécessaire TEMPORAIREMENT pour se connecter via /admin/login/
        staff = self.creer_compte(Staff, "staff@devai.tn", nom="Jouini", prenom="Rayen", is_staff=True)
        president = self.creer_compte(President, "president@devai.tn", nom="Mabrouk", prenom="Sami", is_staff=True)

        # 2. Équipes ----------------------------------------------------------------
        equipes = []
        for nom, ville in EQUIPES:
            equipe, _ = Equipe.objects.get_or_create(
                nom=nom, defaults={"ville": ville, "niveau": "Ligue 1", "president": president}
            )
            equipes.append(equipe)
        est, ca, ess, css, usm, st = equipes

        self.creer_compte(
            Entraineur, "entraineur@devai.tn", nom="Kasmi", prenom="Nabil",
            fonction="principal", equipe=est, is_staff=True,
        )

        # 3. Joueurs (6 par équipe) -------------------------------------------------
        # joueurs[equipe] = liste de 6 joueurs, dans l'ordre de EFFECTIF
        joueurs = {}
        for i, equipe in enumerate(equipes):
            joueurs[equipe] = []
            for j, (poste, numero, pied) in enumerate(EFFECTIF):
                k = i * len(EFFECTIF) + j
                joueur = self.creer_compte(
                    Joueur, f"joueur{i + 1}{j + 1}@devai.tn",
                    prenom=PRENOMS[k % len(PRENOMS)],
                    nom=NOMS[(k * 7) % len(NOMS)],
                    date_naissance=date(1995 + k % 10, 1 + k % 12, 1 + k % 28),
                    nationalite="Tunisienne",
                    poste=poste, numero_maillot=numero, pied_fort=pied,
                    taille_cm=170 + k % 20, poids_kg=65 + k % 15,
                    equipe=equipe,
                )
                joueurs[equipe].append(joueur)

        # Un joueur peut se connecter pour tester la consultation (lecture seule)
        joueur_demo = joueurs[est][ATT]
        joueur_demo.is_staff = True
        joueur_demo.save()

        # 4. Compétitions -----------------------------------------------------------
        ligue = self.creer_competition(
            "Ligue 1 Pro", "Championnat", debut=-120, fin=200,
            description="Championnat national de première division.", equipes=equipes,
        )
        coupe = self.creer_competition(
            "Coupe de Tunisie", "Coupe", debut=-60, fin=150,
            description="Coupe nationale à élimination directe.", equipes=[est, ca, ess, css],
        )

        # 5. Matchs + événements -------------------------------------------------------
        # (jours = décalage par rapport à aujourd'hui : -21 = il y a 3 semaines)

        # Matchs terminés ET validés
        m = self.creer_match(ligue, est, ca, jours=-21, heure=16, statut=Match.Statut.TERMINE)
        self.evenement(m, BUT, 23, joueurs[est][ATT], description="Frappe du gauche")
        self.evenement(m, CARTON_JAUNE, 38, joueurs[ca][DEF1])
        self.evenement(m, BUT, 55, joueurs[ca][MIL], description="Tête sur corner")
        self.evenement(m, REMPLACEMENT, 70, joueurs[est][ATT], entrant=joueurs[est][REMPLACANT])
        self.evenement(m, BUT, 88, joueurs[est][MIL])
        self.valider(m, 2, 1, staff)

        m = self.creer_match(ligue, ess, css, jours=-14, heure=18, statut=Match.Statut.TERMINE)
        self.evenement(m, BUT, 12, joueurs[ess][ATT])
        self.evenement(m, PENALTY, 67, joueurs[css][ATT], description="Penalty transformé")
        self.evenement(m, CARTON_ROUGE, 90, joueurs[ess][DEF2], additionnelle=2)
        self.valider(m, 1, 1, staff)

        m = self.creer_match(coupe, ca, css, jours=-10, heure=15, statut=Match.Statut.TERMINE)
        self.evenement(m, BUT, 9, joueurs[ca][ATT])
        self.evenement(m, BUT, 41, joueurs[ca][MIL])
        self.evenement(m, CARTON_JAUNE, 60, joueurs[css][DEF1])
        self.evenement(m, BUT, 76, joueurs[ca][ATT])
        self.valider(m, 3, 0, staff)

        # Match terminé mais PAS encore validé (on peut encore le modifier)
        m = self.creer_match(ligue, usm, st, jours=-7, heure=16, statut=Match.Statut.TERMINE)
        self.evenement(m, BUT, 30, joueurs[st][ATT])
        self.evenement(m, CARTON_JAUNE, 44, joueurs[usm][MIL])
        self.evenement(m, BUT, 81, joueurs[st][MIL])

        # Match en cours aujourd'hui
        m = self.creer_match(ligue, ca, ess, jours=0, heure=15, statut=Match.Statut.EN_COURS)
        self.evenement(m, BUT, 17, joueurs[ca][ATT])
        self.evenement(m, CARTON_JAUNE, 29, joueurs[ess][DEF1])

        # Matchs à venir, reportés, annulés
        self.creer_match(ligue, css, est, jours=3, heure=17)
        self.creer_match(ligue, st, ess, jours=3, heure=19)
        self.creer_match(coupe, est, ess, jours=6, heure=16)
        self.creer_match(ligue, est, usm, jours=10, heure=18)
        self.creer_match(ligue, ca, st, jours=17, heure=16, statut=Match.Statut.REPORTE)
        self.creer_match(ligue, ess, est, jours=24, heure=17, statut=Match.Statut.ANNULE)

        # Résumé ---------------------------------------------------------------------
        self.stdout.write(self.style.SUCCESS(
            f"Base remplie : {Equipe.objects.count()} équipes, {Joueur.objects.count()} joueurs, "
            f"{Competition.objects.count()} compétitions, {Match.objects.count()} matchs, "
            f"{EvenementMatch.objects.count()} événements."
        ))
        self.stdout.write(f"Comptes de test (mot de passe : {MOT_DE_PASSE}) :")
        self.stdout.write("  staff@devai.tn       -> Staff (peut tout gérer)")
        self.stdout.write("  entraineur@devai.tn  -> Entraîneur (consultation)")
        self.stdout.write("  president@devai.tn   -> Président (consultation)")
        self.stdout.write(f"  {joueur_demo.email}  -> Joueur (consultation)")

    # ------------------------------------------------------------------
    # Méthodes utilitaires
    # ------------------------------------------------------------------

    def creer_compte(self, modele, email, **champs):
        """Crée un compte (Staff, Joueur, ...) s'il n'existe pas déjà."""
        compte = modele.objects.filter(email=email).first()
        if compte is None:
            # create_user enregistre le mot de passe sous forme hachée (cryptée)
            compte = modele.objects.create_user(email=email, password=MOT_DE_PASSE, **champs)
        return compte

    def date_heure(self, jours, heure):
        """Date/heure à 'jours' jours d'aujourd'hui, à l'heure indiquée (heure de Tunis)."""
        jour = self.aujourd_hui + timedelta(days=jours)
        return timezone.make_aware(datetime.combine(jour, time(heure, 0)))

    def creer_competition(self, nom, type, debut, fin, description, equipes):
        competition = Competition(
            nom=nom, type=type, description=description,
            date_debut=self.aujourd_hui + timedelta(days=debut),
            date_fin=self.aujourd_hui + timedelta(days=fin),
        )
        competition.full_clean()  # vérifie les règles métier (clean() du modèle)
        competition.save()
        competition.equipes.set(equipes)  # relation ManyToMany : après save()
        return competition

    def creer_match(self, competition, domicile, exterieur, jours, heure, statut=Match.Statut.PROGRAMME):
        match = Match(
            competition=competition, equipe_domicile=domicile, equipe_exterieur=exterieur,
            date_heure=self.date_heure(jours, heure), lieu=f"Stade de {domicile.ville}", statut=statut,
        )
        match.full_clean()  # mêmes règles que dans les formulaires
        match.save()
        return match

    def evenement(self, match, type_evenement, minute, joueur, entrant=None, additionnelle=0, description=""):
        evenement = EvenementMatch(
            match=match, equipe=joueur.equipe, joueur=joueur, joueur_entrant=entrant,
            type_evenement=type_evenement, minute=minute,
            minute_additionnelle=additionnelle, description=description,
        )
        evenement.full_clean()
        evenement.save()

    def valider(self, match, score_domicile, score_exterieur, utilisateur):
        """Valide le résultat (à faire APRÈS les événements : un match validé n'en accepte plus)."""
        match.score_domicile = score_domicile
        match.score_exterieur = score_exterieur
        match.valide_par = utilisateur
        match.save()
