from django.contrib import admin

from .models import RapportScouting, Recommandation, Scout


@admin.register(Scout)
class ScoutAdmin(admin.ModelAdmin):
    list_display = ("nom", "prenom", "email", "specialite_scout", "is_active")
    list_filter = ("is_active", "specialite_scout")
    search_fields = ("nom", "prenom", "email", "specialite_scout")


@admin.register(RapportScouting)
class RapportScoutingAdmin(admin.ModelAdmin):
    list_display = (
        "scout",
        "joueur",
        "date_rapport",
        "evaluation_technique",
        "evaluation_physique",
        "evaluation_tactique",
        "evaluation_mentale",
    )
    list_filter = ("date_rapport",)
    search_fields = (
        "scout__nom",
        "scout__prenom",
        "joueur__nom",
        "joueur__prenom",
    )


@admin.register(Recommandation)
class RecommandationAdmin(admin.ModelAdmin):
    list_display = (
        "joueur",
        "score_compatibilite",
        "statut",
        "date_creation",
    )
    list_filter = ("statut", "date_creation")
    search_fields = ("joueur__nom", "joueur__prenom", "justification")
