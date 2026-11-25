"""Module Présidents : CRUD réservé à l'administrateur.
Recherche simplifiée par nom/prénom, statistiques réelles, calcul automatique de la durée de présidence.
"""
from urllib.parse import urlencode

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme

from equipeApp.acces import admin_requis
from equipeApp.outils import NATIONALITES_SUGGESTIONS, normalize_text, prochain_id_modele
from utilisateurApp.models import Utilisateur

from .forms import PresidentForm
from .models import President

PAR_PAGE = 12


def _est_ajax(request):
    return request.headers.get("x-requested-with") == "XMLHttpRequest"


def _contexte_liste(request):
    q = request.GET.get("q", "").strip()

    presidents = President.objects.annotate(nb_equipes=Count("equipes", distinct=True))
    if q:
        presidents = presidents.filter(nom_recherche__icontains=normalize_text(q))
    presidents = presidents.order_by("nom", "prenom")

    page = Paginator(presidents, PAR_PAGE).get_page(request.GET.get("page", 1))
    qs = urlencode({"q": q}) if q else ""

    return {
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


@admin_requis
def liste(request):
    """Liste des présidents : recherche simple par nom ou prénom, sans filtres superflus."""
    contexte = _contexte_liste(request)
    if _est_ajax(request):
        return render(request, "presidentApp/_grille.html", contexte)

    return render(request, "presidentApp/liste.html", contexte)


@admin_requis
def detail(request, pk):
    """Fiche détaillée du président :
    Cadre 1 : Informations personnelles complètes (e-mail, téléphone, date début présidence et durée calculée).
    Cadre 2 : Équipes associées (logo, nom, nombre de joueurs).
    """
    president = get_object_or_404(President, pk=pk)
    equipes = president.equipes.annotate(nb_joueurs=Count("joueurs", distinct=True)).order_by("nom")

    retour = (request.GET.get("retour") or "").strip()
    if retour and url_has_allowed_host_and_scheme(
        retour, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        retour_url = retour
        if "/equipes/creer/" in retour:
            retour_label = "Retour à l'ajout d'équipe"
        elif "/equipes/" in retour and "/modifier/" in retour:
            retour_label = "Retour à la modification d'équipe"
        elif "/equipes/" in retour:
            retour_label = "Retour à la fiche équipe"
        else:
            retour_label = "Retour"
    else:
        retour_url = reverse("presidents:liste")
        retour_label = "Retour aux présidents"

    return render(request, "presidentApp/detail.html", {
        "president": president,
        "equipes": equipes,
        "duree_presidence": president.duree_presidence,
        "retour_url": retour_url,
        "retour_label": retour_label,
    })


@admin_requis
def creer(request):
    """Création conjointe du compte utilisateur et du profil président."""
    prochain_id = prochain_id_modele(Utilisateur)
    form = PresidentForm(request.POST or None, request.FILES or None)

    retour = (request.POST.get("retour") or request.GET.get("retour") or "").strip()
    if retour and url_has_allowed_host_and_scheme(
        retour, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        retour_url = retour
        if "/equipes/creer/" in retour:
            retour_label = "Retour à l'ajout d'équipe"
        elif "/equipes/" in retour and "/modifier/" in retour:
            retour_label = "Retour à la modification d'équipe"
        else:
            retour_label = "Retour"
    else:
        retour = ""
        retour_url = reverse("presidents:liste")
        retour_label = "Retour aux présidents"

    if request.method == "POST":
        if form.is_valid():
            president = form.save()
            messages.success(request, f"Le président {president.nom_complet} (ID #{president.pk}) a été créé avec succès.")
            detail_url = reverse("presidents:detail", kwargs={"pk": president.pk})
            if retour:
                return redirect(f"{detail_url}?{urlencode({'retour': retour})}")
            return redirect(detail_url)
        messages.error(request, "Veuillez corriger les erreurs indiquées dans le formulaire.")

    return render(request, "presidentApp/formulaire.html", {
        "form": form,
        "mode": "creer",
        "prochain_id": prochain_id,
        "id_president": prochain_id,
        "nationalites": NATIONALITES_SUGGESTIONS,
        "retour_url": retour_url,
        "retour_label": retour_label,
        "retour_param": retour,
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
        "id_president": president.pk,
        "prochain_id": president.pk,
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
        nom = president.nom_complet
        # Equipe.president a on_delete=SET_NULL : les équipes restent sans président
        president.delete()
        messages.success(request, f"Le président {nom} a été supprimé avec succès.")
        return redirect("presidents:liste")

    contexte = _contexte_liste(request)
    contexte["president"] = president
    contexte["equipes"] = equipes
    return render(request, "presidentApp/confirmer_suppression.html", contexte)
