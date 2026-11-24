from django.contrib import admin

from .models import Atelier, Seance


class AtelierInline(admin.TabularInline):
    model = Atelier
    extra = 1
    fields = ("numero", "titre", "description", "duree_minutes", "materiel")


@admin.register(Seance)
class SeanceAdmin(admin.ModelAdmin):
    list_display = ("date", "heure_debut", "heure_fin", "type_seance", "titre", "rpe", "nb_joueurs", "terrain")
    list_filter = ("type_seance", "terrain")
    search_fields = ("titre", "description")
    date_hierarchy = "date"
    inlines = [AtelierInline]


@admin.register(Atelier)
class AtelierAdmin(admin.ModelAdmin):
    list_display = ("seance", "numero", "titre", "duree_minutes")
    list_filter = ("seance",)
