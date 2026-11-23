from django.urls import path

from . import views

app_name = "joueurs"

urlpatterns = [
    path("", views.liste_joueurs, name="liste"),
    path("casiers/", views.casiers, name="casiers"),
    path("ajouter/", views.ajouter_joueur, name="ajouter"),
    path("<int:pk>/modifier/", views.modifier_joueur, name="modifier"),
    path("<int:pk>/supprimer/", views.supprimer_joueur, name="supprimer"),
]
