"""Routes du module Séances (entraînement), branché dans ShootApp sous /seances/."""
from django.contrib.auth.decorators import login_required
from django.urls import path

from . import views

app_name = "seances"

urlpatterns = [
    path("", login_required(views.planning), name="planning"),
    path("planifier/", login_required(views.planifier), name="planifier"),
    path("seance/<int:pk>/", login_required(views.seance_detail), name="seance_detail"),
    path("seance/<int:pk>/supprimer/", login_required(views.seance_supprimer), name="seance_supprimer"),
    path("tableau/", login_required(views.tableau), name="tableau"),
]
