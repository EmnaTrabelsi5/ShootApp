"""Module Présidents : CRUD réservé à l'administrateur.
Recherche simplifiée par nom/prénom, statistiques réelles, calcul automatique de la durée de présidence.
"""
from urllib.parse import urlencode

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render

from equipeApp.acces import admin_requis
from equipeApp.outils import NATIONALITES_SUGGESTIONS, normalize_text

from .forms import PresidentForm
from .models import President

PAR_PAGE = 12


def _est_ajax(request):
    return request.headers.get("x-requested-with") == "XMLHttpRequest"


@admin_requis
def liste(request):
    """Liste des présidents : recherche simple par nom ou prénom, sans filtres superflus."""
    q = request.GET.get("q", "").strip()

    presidents = President.objects.annotate(nb_equipes=Count("equipes", distinct=True))
    if q:
        presidents = presidents.filter(nom_recherche__icontains=normalize_text(q))
    presidents = presidents.order_by("nom", "prenom")

    page = Paginator(presidents, PAR_PAGE).get_page(request.GET.get("page", 1))
    qs = urlencode({"q": q}) if q else ""

    contexte = {
        "page": page,
        "total": page.paginator.count,
        "q": q,
        "qs": qs,
        "filtre_actif": bool(q),
        "stats": {
            "total": President.objects.count(),
            "actifs": President.objects.filter(is_active=True).count(),
            "sans_equipe": President.objects.filter(equipes__isnull=True).count(),
        },
    }
    if _est_ajax(request):
        return render(request, "presidentApp/_grille.html", contexte)

    return render(request, "presidentApp/liste.html", contexte)


@admin_requis
def detail(request, pk):
    """Fiche détaillée du président :
    Cadre 1 : Informations personnelles complètes (avec adresse, date début présidence et durée calculée).
    Cadre 2 : Équipes associées (logo, nom, nombre de joueurs).
    """
    president = get_object_or_404(President, pk=pk)
    equipes = president.equipes.annotate(nb_joueurs=Count("joueurs", distinct=True)).order_by("nom")

    return render(request, "presidentApp/detail.html", {
        "president": president,
        "equipes": equipes,
        "duree_presidence": president.duree_presidence,
    })


@admin_requis
def creer(request):
    """Création conjointe du compte utilisateur et du profil président."""
    form = PresidentForm(request.POST or None, request.FILES or None)
    if request.method == "POST":
        if form.is_valid():
            president = form.save()
            messages.success(request, f"Le président {president.nom_complet} a été créé avec succès.")
            return redirect("presidents:detail", pk=president.pk)
        messages.error(request, "Veuillez corriger les erreurs indiquées dans le formulaire.")

    return render(request, "presidentApp/formulaire.html", {
        "form": form,
        "mode": "creer",
        "nationalites": NATIONALITES_SUGGESTIONS,
    })


@admin_requis
def modifier(request, pk):
    """Modification d'un président existant (mêmes règles et disposition)."""
    president = get_object_or_404(President, pk=pk)
    form = PresidentForm(request.POST or None, request.FILES or None, instance=president)

    if request.method == "POST":
        if form.is_valid():
            president = form.save()
            messages.success(request, f"Le président {president.nom_complet} a été modifié avec succès.")
            return redirect("presidents:detail", pk=president.pk)
        messages.error(request, "Veuillez corriger les erreurs indiquées dans le formulaire.")

    return render(request, "presidentApp/formulaire.html", {
        "form": form,
        "mode": "editer",
        "president": president,
        "nationalites": NATIONALITES_SUGGESTIONS,
    })


@admin_requis
def supprimer(request, pk):
    president = get_object_or_404(President, pk=pk)
    equipes = list(president.equipes.order_by("nom"))

    if request.user.pk == president.pk:
        messages.error(request, "Sécurité : vous ne pouvez pas supprimer votre propre compte.")
        return redirect("presidents:detail", pk=pk)

    if request.method == "POST":
        if equipes:
            messages.error(
                request,
                f"Impossible de supprimer {president.nom_complet} : il préside encore "
                f"{len(equipes)} équipe(s). Réassignez d'abord ses équipes à un autre président.",
            )
            return redirect("presidents:detail", pk=pk)
        nom = president.nom_complet
        president.delete()
        messages.success(request, f"Le président {nom} a été supprimé avec succès.")
        return redirect("presidents:liste")

    return render(request, "presidentApp/confirmer_suppression.html", {
        "president": president,
        "equipes": equipes,
    })
