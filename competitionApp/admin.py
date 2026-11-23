from django.contrib import admin

from .models import Competition, EvenementMatch, Match


@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = ["nom", "type", "date_debut", "date_fin"]
    filter_horizontal = ["equipes"]


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ["__str__", "competition", "date_heure", "statut", "score_domicile", "score_exterieur"]
    list_filter = ["statut", "competition"]


@admin.register(EvenementMatch)
class EvenementMatchAdmin(admin.ModelAdmin):
    list_display = ["match", "type_evenement", "minute", "equipe", "joueur"]
    list_filter = ["type_evenement"]
