from django.urls import path
from . import views

app_name = "entraineur"

urlpatterns = [
    path("", views.liste, name="liste"),
    path("<int:pk>/", views.detail, name="detail"),
    path("creer/", views.creer, name="creer"),
    path("<int:pk>/editer/", views.editer, name="editer"),
    path("<int:pk>/supprimer/", views.supprimer_entraineur, name="supprimer"),
    path("composition/", views.composition, name="composition"),
    path("composition/<int:pk>/", views.composition, name="composition_detail"),
    path("composition/sauvegarder/", views.sauvegarder_composition, name="sauvegarder_composition"),
    path("composition/<int:pk>/supprimer/", views.supprimer_composition, name="supprimer_composition"),
]
