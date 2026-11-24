from django.urls import path

from . import views

app_name = "equipes"

urlpatterns = [
    path("", views.liste, name="liste"),
    path("mon-equipe/", views.mon_equipe, name="mon_equipe"),
    path("creer/", views.creer, name="creer"),
    path("api/villes/", views.api_villes, name="api_villes"),
    path("<int:pk>/", views.detail, name="detail"),
    path("<int:pk>/modifier/", views.modifier, name="modifier"),
    path("<int:pk>/supprimer/", views.supprimer, name="supprimer"),
]
