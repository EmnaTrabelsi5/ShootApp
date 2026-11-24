"""
Source des matchs pour le module Entraînement.

Les matchs viennent du module Matchs de ShootApp (competitionApp), en LECTURE SEULE :
ce fichier ne crée, ne modifie et ne supprime jamais un match.
C'est le SEUL endroit qui lit les matchs. Le planning, la carte "Prochain match"
et le blocage des séances un jour de match passent tous par `get_matchs()`.

EQUIPE_CLUB : nom de l'équipe entraînée (ex : "Espérance ST").
  - renseigné : seuls les matchs de cette équipe sont repris, l'adversaire est l'autre équipe ;
  - None      : tous les matchs de ShootApp sont repris ("Domicile vs Extérieur").
"""
from dataclasses import dataclass
from datetime import date as Date, time as Time
from typing import Optional

from django.utils import timezone


@dataclass
class Match:
    date: Date
    heure: Optional[Time] = None
    adversaire: str = ""
    lieu: str = ""
    description: str = ""
    competition: str = "Championnat"
    adversaire_logo: str = ""     # URL du logo de l'adversaire (module Match), "" = écusson avec initiales



EQUIPE_CLUB = None

# Matchs qui n'auront pas lieu : ils ne bloquent pas le planning
STATUTS_IGNORES = ("ANNULE", "REPORTE")


def get_matchs(date_debut=None, date_fin=None):
    """Liste des matchs entre deux dates (incluses), triés par date et heure."""
    from django.db.models import Q
    from competitionApp.models import Match as MatchModel   # import local : lecture seule

    qs = (MatchModel.objects.exclude(statut__in=STATUTS_IGNORES)
          .select_related("competition", "equipe_domicile", "equipe_exterieur"))
    if EQUIPE_CLUB:
        qs = qs.filter(Q(equipe_domicile__nom=EQUIPE_CLUB) | Q(equipe_exterieur__nom=EQUIPE_CLUB))
    if date_debut:
        qs = qs.filter(date_heure__date__gte=date_debut)
    if date_fin:
        qs = qs.filter(date_heure__date__lte=date_fin)

    matchs = []
    for m in qs.order_by("date_heure"):
        quand = timezone.localtime(m.date_heure)
        dom, ext = m.equipe_domicile, m.equipe_exterieur
        if EQUIPE_CLUB:
            adverse = ext if dom.nom == EQUIPE_CLUB else dom
            titre = adverse.nom
        else:
            adverse = ext
            titre = f"{dom.nom} vs {ext.nom}"
        matchs.append(Match(
            date=quand.date(), heure=quand.time(), adversaire=titre,
            lieu=m.lieu, description=m.get_statut_display(),
            competition=m.competition.nom,
            adversaire_logo=adverse.logo.url if adverse.logo else "",
        ))
    return matchs


def match_le(jour):
    """Le match prévu ce jour-là, ou None."""
    matchs = get_matchs(jour, jour)
    return matchs[0] if matchs else None
