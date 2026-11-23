from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.utils import timezone
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from equipeApp.models import Equipe
from joueurApp.models import Joueur
from utilisateurApp.models import Utilisateur

from .forms import CompetitionForm, EvenementMatchForm, MatchForm, MatchModifierForm
from .models import Competition, EvenementMatch, Match


# ---------------------------------------------------------------------------
# Droits d'accès
# ---------------------------------------------------------------------------

# Rôles autorisés à créer / modifier / supprimer dans le module Gestion des matchs
ROLES_GESTION = [Utilisateur.Role.STAFF, Utilisateur.Role.ADMIN]


def peut_gerer(user):
    """Vrai si l'utilisateur connecté a le droit de modifier les données du module."""
    return user.is_authenticated and (user.is_superuser or user.role in ROLES_GESTION)


class ConnexionRequiseMixin(LoginRequiredMixin):
    """Consultation : il suffit d'être connecté (entraîneur, joueur, président, ...).
    Ajoute aussi au contexte :
    - peut_gerer : pour afficher ou cacher les boutons Ajouter / Modifier / Supprimer
    - menu_actif : pour surligner le bon lien dans le menu de gauche"""

    menu_actif = ""

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["peut_gerer"] = peut_gerer(self.request.user)
        context["menu_actif"] = self.menu_actif
        return context


class GestionRequiseMixin(ConnexionRequiseMixin, UserPassesTestMixin):
    """Création / modification / suppression : réservé au Staff et à l'Admin.
    Un utilisateur connecté sans le bon rôle reçoit une erreur 403 (accès refusé)."""

    def test_func(self):
        return peut_gerer(self.request.user)


# ---------------------------------------------------------------------------
# CRUD Compétition
# ---------------------------------------------------------------------------

class CompetitionListView(ConnexionRequiseMixin, ListView):
    model = Competition
    menu_actif = "competitions"


class CompetitionDetailView(ConnexionRequiseMixin, DetailView):
    model = Competition
    menu_actif = "competitions"


class CompetitionCreateView(GestionRequiseMixin, CreateView):
    model = Competition
    form_class = CompetitionForm
    menu_actif = "competitions"
    # Pas de success_url : Django utilise get_absolute_url() du modèle


class CompetitionUpdateView(GestionRequiseMixin, UpdateView):
    model = Competition
    form_class = CompetitionForm
    menu_actif = "competitions"


class CompetitionDeleteView(GestionRequiseMixin, DeleteView):
    model = Competition
    success_url = reverse_lazy("competitionApp:competition_list")
    menu_actif = "competitions"

    def form_valid(self, form):
        # Règle métier : supprimer une compétition supprimerait aussi tous ses
        # matchs (on_delete=CASCADE). On refuse donc si elle a déjà des matchs.
        if self.object.matchs.exists():
            messages.error(
                self.request,
                "Impossible de supprimer cette compétition : des matchs y sont rattachés. "
                "Supprimez d'abord ses matchs.",
            )
            return redirect(self.object)
        return super().form_valid(form)


# ---------------------------------------------------------------------------
# CRUD Match
# ---------------------------------------------------------------------------

class MatchListView(ConnexionRequiseMixin, ListView):
    """Calendrier des matchs, avec filtres par compétition et par statut."""

    model = Match
    menu_actif = "matchs"

    def get_queryset(self):
        queryset = Match.objects.select_related(
            "competition", "equipe_domicile", "equipe_exterieur"
        ).order_by("date_heure")

        # Filtres envoyés dans l'URL, ex : /matchs/?competition=2&statut=PROGRAMME
        competition = self.request.GET.get("competition", "")
        statut = self.request.GET.get("statut", "")
        if competition.isdigit():
            queryset = queryset.filter(competition_id=competition)
        if statut:
            queryset = queryset.filter(statut=statut)
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        matchs = self.object_list

        # Données des filtres
        context["competitions"] = Competition.objects.all()
        context["statuts"] = Match.Statut.choices
        context["competition_choisie"] = self.request.GET.get("competition", "")
        context["statut_choisi"] = self.request.GET.get("statut", "")

        # Indicateurs affichés en haut de la page
        context["nb_total"] = matchs.count()
        context["nb_programmes"] = matchs.filter(statut=Match.Statut.PROGRAMME).count()
        context["nb_termines"] = matchs.filter(statut=Match.Statut.TERMINE).count()
        context["nb_valides"] = matchs.filter(valide_par__isnull=False).count()
        context["prochain_match"] = (
            Match.objects.filter(statut=Match.Statut.PROGRAMME, date_heure__gte=timezone.now())
            .order_by("date_heure")
            .first()
        )
        return context


class MatchDetailView(ConnexionRequiseMixin, DetailView):
    model = Match
    menu_actif = "matchs"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["evenements"] = self.object.evenements.select_related(
            "equipe", "joueur", "joueur_entrant"
        )
        return context


class MatchCreateView(GestionRequiseMixin, CreateView):
    model = Match
    form_class = MatchForm
    menu_actif = "planifier"


class MatchUpdateView(GestionRequiseMixin, UpdateView):
    model = Match
    form_class = MatchModifierForm
    menu_actif = "matchs"

    def get_queryset(self):
        # Règle métier : un match validé ne peut plus être modifié (erreur 404)
        return Match.objects.filter(valide_par__isnull=True)


class MatchDeleteView(GestionRequiseMixin, DeleteView):
    model = Match
    success_url = reverse_lazy("competitionApp:match_list")
    menu_actif = "matchs"

    def get_queryset(self):
        # Règle métier : un match validé ne peut plus être supprimé (erreur 404)
        return Match.objects.filter(valide_par__isnull=True)


# ---------------------------------------------------------------------------
# CRUD Événement de match
# (la consultation se fait dans la page de détail du match)
# ---------------------------------------------------------------------------

def limiter_choix_evenement(form, match):
    """Dans les listes déroulantes, on ne propose que les deux équipes du match
    et leurs joueurs."""
    equipes = [match.equipe_domicile_id, match.equipe_exterieur_id]
    joueurs = Joueur.objects.filter(equipe__in=equipes)
    form.fields["equipe"].queryset = Equipe.objects.filter(pk__in=equipes)
    form.fields["joueur"].queryset = joueurs
    form.fields["joueur_entrant"].queryset = joueurs


class EvenementCreateView(GestionRequiseMixin, CreateView):
    model = EvenementMatch
    form_class = EvenementMatchForm
    menu_actif = "matchs"

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        # Le match vient de l'URL : matchs/<match_pk>/evenements/ajouter/
        # On le fixe AVANT la validation pour que clean() du modèle puisse l'utiliser.
        match = get_object_or_404(Match, pk=self.kwargs["match_pk"])
        form.instance.match = match
        limiter_choix_evenement(form, match)
        return form

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["match"] = context["form"].instance.match
        return context

    def get_success_url(self):
        return self.object.match.get_absolute_url()


class EvenementUpdateView(GestionRequiseMixin, UpdateView):
    model = EvenementMatch
    form_class = EvenementMatchForm
    menu_actif = "matchs"

    def get_queryset(self):
        # On ne modifie pas les événements d'un match déjà validé
        return EvenementMatch.objects.filter(match__valide_par__isnull=True)

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        limiter_choix_evenement(form, self.object.match)
        return form

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["match"] = self.object.match
        return context

    def get_success_url(self):
        return self.object.match.get_absolute_url()


class EvenementDeleteView(GestionRequiseMixin, DeleteView):
    model = EvenementMatch
    menu_actif = "matchs"

    def get_queryset(self):
        return EvenementMatch.objects.filter(match__valide_par__isnull=True)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["match"] = self.object.match
        return context

    def get_success_url(self):
        return self.object.match.get_absolute_url()
