from django.contrib import admin
from .models import Entraineur, Entrainement


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
