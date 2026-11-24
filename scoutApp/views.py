from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from .forms import RapportScoutingForm, RecommandationForm, ScoutForm
from .models import RapportScouting, Recommandation, Scout


class ScoutListView(ListView):
    model = Scout
    template_name = "scoutApp/scout_list.html"
    context_object_name = "scouts"
    ordering = ["nom", "prenom"]

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["rapport_count"] = RapportScouting.objects.count()
        context["recommendation_count"] = Recommandation.objects.count()
        context["pending_recommendation_count"] = Recommandation.objects.filter(
            statut=Recommandation.Statut.EN_ATTENTE
        ).count()
        context["recent_reports"] = RapportScouting.objects.select_related(
            "scout", "joueur"
        )[:5]
        context["top_recommendations"] = Recommandation.objects.select_related(
            "joueur"
        )[:5]
        return context


class ScoutDetailView(DetailView):
    model = Scout
    template_name = "scoutApp/scout_detail.html"


class ScoutCreateView(CreateView):
    model = Scout
    form_class = ScoutForm
    template_name = "scoutApp/scout_form.html"
    success_url = reverse_lazy("scoutApp:scout-list")


class ScoutUpdateView(UpdateView):
    model = Scout
    form_class = ScoutForm
    template_name = "scoutApp/scout_form.html"
    success_url = reverse_lazy("scoutApp:scout-list")


class ScoutDeleteView(DeleteView):
    model = Scout
    template_name = "scoutApp/scout_confirm_delete.html"
    success_url = reverse_lazy("scoutApp:scout-list")


class RapportScoutingListView(ListView):
    model = RapportScouting
    template_name = "scoutApp/rapport_list.html"
    context_object_name = "rapports"


class RapportScoutingDetailView(DetailView):
    model = RapportScouting
    template_name = "scoutApp/rapport_detail.html"


class RapportScoutingCreateView(CreateView):
    model = RapportScouting
    form_class = RapportScoutingForm
    template_name = "scoutApp/rapport_form.html"
    success_url = reverse_lazy("scoutApp:rapport-list")


class RapportScoutingUpdateView(UpdateView):
    model = RapportScouting
    form_class = RapportScoutingForm
    template_name = "scoutApp/rapport_form.html"
    success_url = reverse_lazy("scoutApp:rapport-list")


class RapportScoutingDeleteView(DeleteView):
    model = RapportScouting
    template_name = "scoutApp/rapport_confirm_delete.html"
    success_url = reverse_lazy("scoutApp:rapport-list")


class RecommandationListView(ListView):
    model = Recommandation
    template_name = "scoutApp/recommandation_list.html"
    context_object_name = "recommandations"


class RecommandationDetailView(DetailView):
    model = Recommandation
    template_name = "scoutApp/recommandation_detail.html"


class RecommandationCreateView(CreateView):
    model = Recommandation
    form_class = RecommandationForm
    template_name = "scoutApp/recommandation_form.html"
    success_url = reverse_lazy("scoutApp:recommandation-list")


class RecommandationUpdateView(UpdateView):
    model = Recommandation
    form_class = RecommandationForm
    template_name = "scoutApp/recommandation_form.html"
    success_url = reverse_lazy("scoutApp:recommandation-list")


class RecommandationDeleteView(DeleteView):
    model = Recommandation
    template_name = "scoutApp/recommandation_confirm_delete.html"
    success_url = reverse_lazy("scoutApp:recommandation-list")
