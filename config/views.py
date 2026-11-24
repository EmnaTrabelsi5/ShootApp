"""Page d'accueil : le stade de Radès et les composants d'une équipe."""
from django.db.models import Count, Q
from django.shortcuts import render

from competitionApp.models import Match
from entraineurApp.models import Entraineur, Entrainement
from equipeApp.models import Equipe
from joueurApp.models import Joueur, Performance
from presidentApp.models import President
from scoutApp.models import RapportScouting, Recommandation, Scout
from staffApp.models import Staff


def accueil(request):
    joueurs = Joueur.objects.aggregate(
        total=Count("pk"),
        disponibles=Count("pk", filter=Q(statut=Joueur.Statut.DISPONIBLE)),
    )
    chiffres = {
        "presidents": President.objects.count(),
        "equipes": Equipe.objects.count(),
        "entraineurs": Entraineur.objects.count(),
        "entrainements": Entrainement.objects.count(),
        "joueurs": joueurs["total"],
        "disponibles": joueurs["disponibles"],
        "performances": Performance.objects.count(),
        "scouts": Scout.objects.count(),
        "rapports": RapportScouting.objects.count(),
        "recommandations": Recommandation.objects.count(),
        "staff": Staff.objects.count(),
        "matchs": Match.objects.count(),
    }
    return render(request, "accueil.html", {"c": chiffres})
