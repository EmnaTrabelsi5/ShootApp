from django.urls import path

from . import views

app_name = "scoutApp"

urlpatterns = [
    path("", views.ScoutListView.as_view(), name="scout-list"),
    path("scouts/add/", views.ScoutCreateView.as_view(), name="scout-create"),
    path("scouts/<int:pk>/", views.ScoutDetailView.as_view(), name="scout-detail"),
    path("scouts/<int:pk>/edit/", views.ScoutUpdateView.as_view(), name="scout-update"),
    path("scouts/<int:pk>/delete/", views.ScoutDeleteView.as_view(), name="scout-delete"),
    path("rapports/", views.RapportScoutingListView.as_view(), name="rapport-list"),
    path("rapports/add/", views.RapportScoutingCreateView.as_view(), name="rapport-create"),
    path("rapports/<int:pk>/", views.RapportScoutingDetailView.as_view(), name="rapport-detail"),
    path("rapports/<int:pk>/edit/", views.RapportScoutingUpdateView.as_view(), name="rapport-update"),
    path("rapports/<int:pk>/delete/", views.RapportScoutingDeleteView.as_view(), name="rapport-delete"),
    path("recommandations/", views.RecommandationListView.as_view(), name="recommandation-list"),
    path("recommandations/add/", views.RecommandationCreateView.as_view(), name="recommandation-create"),
    path("recommandations/<int:pk>/", views.RecommandationDetailView.as_view(), name="recommandation-detail"),
    path("recommandations/<int:pk>/edit/", views.RecommandationUpdateView.as_view(), name="recommandation-update"),
    path("recommandations/<int:pk>/delete/", views.RecommandationDeleteView.as_view(), name="recommandation-delete"),
]
