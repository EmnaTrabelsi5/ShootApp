from django.contrib import admin

from .models import Joueur, Performance


@admin.register(Joueur)
class JoueurAdmin(admin.ModelAdmin):
    list_display = ("numero_maillot", "prenom", "nom", "poste", "statut", "equipe")
    list_filter = ("poste", "statut", "equipe")
    search_fields = ("nom", "prenom", "email")
    exclude = ("password", "last_login", "groups", "user_permissions", "is_superuser")


admin.site.register(Performance)
