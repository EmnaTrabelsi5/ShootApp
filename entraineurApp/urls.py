from django.urls import path
from . import views

app_name = "entraineur"

urlpatterns = [
    path("", views.liste, name="liste"),
    path("<int:pk>/", views.detail, name="detail"),
    path("creer/", views.creer, name="creer"),
    path("<int:pk>/editer/", views.editer, name="editer"),
    path("<int:pk>/supprimer/", views.supprimer_entraineur, name="supprimer"),
]
