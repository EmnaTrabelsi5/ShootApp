from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from joueurApp.models import Joueur
from utilisateurApp.models import Utilisateur

from scoutApp.models import RapportScouting, Recommandation, Scout


DEMO_MARKER = "[SCOUTAPP-DEMO]"
DEMO_SCOUTS = [
    {
        "email": "demo.scout1@example.test",
        "nom": "Ben Salah",
        "prenom": "Nour",
        "telephone": "+216 20 500 101",
        "type": "Professionnel",
        "specialite_scout": "Détection des jeunes talents",
    },
    {
        "email": "demo.scout2@example.test",
        "nom": "Trabelsi",
        "prenom": "Sami",
        "telephone": "+216 20 500 102",
        "type": "Régional",
        "specialite_scout": "Milieux de terrain",
    },
    {
        "email": "demo.scout3@example.test",
        "nom": "Jebali",
        "prenom": "Amira",
        "telephone": "+216 20 500 103",
        "type": "Professionnel",
        "specialite_scout": "Attaquants",
    },
]

REPORT_RATINGS = [
    (8.5, 7.5, 8, 8.5),
    (7, 8.5, 8, 7.5),
    (9, 8, 8.5, 8),
    (7.5, 9, 7, 8),
    (8, 7.5, 9, 8.5),
    (8.5, 8, 7.5, 9),
]
RECOMMENDATION_DATA = [
    (88, Recommandation.Statut.EN_ATTENTE),
    (76, Recommandation.Statut.ACCEPTEE),
    (64, Recommandation.Statut.REJETEE),
    (93, Recommandation.Statut.EN_ATTENTE),
    (81, Recommandation.Statut.ACCEPTEE),
    (70, Recommandation.Statut.REJETEE),
]


class Command(BaseCommand):
    help = "Ajoute des données de démonstration Scout sans supprimer ni modifier les données existantes."

    @transaction.atomic
    def handle(self, *args, **options):
        players = list(Joueur.objects.order_by("pk")[:6])
        if len(players) < 6:
            raise CommandError(
                f"Au moins 6 joueurs sont nécessaires; {len(players)} trouvé(s). "
                "Ajoutez d'abord des joueurs, puis relancez seed_scout_demo."
            )

        scouts = []
        created_scouts = 0
        for defaults in DEMO_SCOUTS:
            scout = Scout.objects.filter(email__iexact=defaults["email"]).first()
            if scout is None:
                if Utilisateur.objects.filter(email__iexact=defaults["email"]).exists():
                    raise CommandError(
                        f"L'adresse {defaults['email']} est déjà utilisée par un autre type de compte."
                    )
                scout = Scout(**defaults, is_active=True)
                scout.set_unusable_password()
                scout.save()
                created_scouts += 1
            scouts.append(scout)

        created_reports = 0
        created_recommendations = 0
        for index, player in enumerate(players):
            scout = scouts[index % len(scouts)]
            if not RapportScouting.objects.filter(
                scout=scout,
                joueur=player,
                observations__startswith=DEMO_MARKER,
            ).exists():
                technical, physical, tactical, mental = REPORT_RATINGS[index]
                RapportScouting.objects.create(
                    scout=scout,
                    joueur=player,
                    evaluation_technique=technical,
                    evaluation_physique=physical,
                    evaluation_tactique=tactical,
                    evaluation_mentale=mental,
                    observations=(
                        f"{DEMO_MARKER} Observation {index + 1}: "
                        "profil prometteur, à revoir sur une prochaine rencontre."
                    ),
                )
                created_reports += 1

            if not Recommandation.objects.filter(
                joueur=player,
                justification__startswith=DEMO_MARKER,
            ).exists():
                score, status = RECOMMENDATION_DATA[index]
                Recommandation.objects.create(
                    joueur=player,
                    score_compatibilite=score,
                    statut=status,
                    justification=(
                        f"{DEMO_MARKER} Profil évalué pour la démonstration; "
                        "les qualités observées correspondent aux besoins du club."
                    ),
                )
                created_recommendations += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Données Scout prêtes : "
                f"{len(scouts)} scouts de démonstration "
                f"({created_scouts} ajoutés), "
                f"{created_reports} rapports et "
                f"{created_recommendations} recommandations ajoutés. "
                "Relancer la commande ne crée pas de doublons."
            )
        )
