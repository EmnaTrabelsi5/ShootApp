from django.contrib import admin
from .models import Entraineur, Entrainement, Composition, JoueurComposition


class JoueurCompositionInline(admin.TabularInline):
    model = JoueurComposition
    extra = 0


@admin.register(Composition)
class CompositionAdmin(admin.ModelAdmin):
    list_display = ("nom", "equipe", "entraineur", "dispositif", "capitaine", "date_mise_a_jour")
    list_filter = ("dispositif", "equipe")
    search_fields = ("nom", "equipe__nom", "entraineur__nom")
    inlines = [JoueurCompositionInline]


@admin.register(Entraineur)
class EntraineurAdmin(admin.ModelAdmin):
    list_display = ("prenom", "nom", "email", "type", "specialite", "equipe", "is_active")
    list_filter = ("type", "specialite", "is_active")
    search_fields = ("nom", "prenom", "email")


@admin.register(Entrainement)
class EntrainementAdmin(admin.ModelAdmin):
    list_display = ("titre", "entraineur", "date", "heure_debut", "heure_fin", "type", "statut")
    list_filter = ("type", "statut", "date")
    search_fields = ("titre", "entraineur__nom", "entraineur__prenom")
