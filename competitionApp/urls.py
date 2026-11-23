from django.urls import path

from . import views

# Namespace : dans les templates on écrit {% url 'competitionApp:match_list' %}
app_name = "competitionApp"

urlpatterns = [
    # Matchs
    path("matchs/", views.MatchListView.as_view(), name="match_list"),
    path("matchs/ajouter/", views.MatchCreateView.as_view(), name="match_create"),
    path("matchs/<int:pk>/", views.MatchDetailView.as_view(), name="match_detail"),
    path("matchs/<int:pk>/modifier/", views.MatchUpdateView.as_view(), name="match_update"),
    path("matchs/<int:pk>/supprimer/", views.MatchDeleteView.as_view(), name="match_delete"),

    # Événements d'un match
    path(
        "matchs/<int:match_pk>/evenements/ajouter/",
        views.EvenementCreateView.as_view(),
        name="evenement_create",
    ),
    path("evenements/<int:pk>/modifier/", views.EvenementUpdateView.as_view(), name="evenement_update"),
    path("evenements/<int:pk>/supprimer/", views.EvenementDeleteView.as_view(), name="evenement_delete"),

    # Compétitions
    path("competitions/", views.CompetitionListView.as_view(), name="competition_list"),
    path("competitions/ajouter/", views.CompetitionCreateView.as_view(), name="competition_create"),
    path("competitions/<int:pk>/", views.CompetitionDetailView.as_view(), name="competition_detail"),
    path(
        "competitions/<int:pk>/modifier/",
        views.CompetitionUpdateView.as_view(),
        name="competition_update",
    ),
    path(
        "competitions/<int:pk>/supprimer/",
        views.CompetitionDeleteView.as_view(),
        name="competition_delete",
    ),
]
