from django.contrib import admin

from .models import Equipe


@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ("nom", "ville", "pays", "niveau", "president", "date_creation")
    search_fields = ("nom", "ville", "pays")
    list_filter = ("niveau", "pays")
