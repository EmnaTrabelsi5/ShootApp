"""Module Équipes : CRUD complet (administrateur) + « Mon équipe » (tous les rôles).
Recherche par nom uniquement, statistiques dynamiques, encadrement complet et joueurs.
"""
import json
from urllib.parse import urlencode

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme

from competitionApp.models import Match
from joueurApp.models import Joueur
from utilisateurApp.roles import est_admin

from .acces import admin_requis, equipes_de, peut_consulter
from .forms import EquipeForm
from .models import Equipe
from .outils import normalize_text, PAYS_LISTE, PAYS_VILLES_MONDE, prochain_id_modele

PAR_PAGE = 12


def _est_ajax(request):
    return request.headers.get("x-requested-with") == "XMLHttpRequest"


def _contexte_liste(request):
    q = request.GET.get("q", "").strip()

    equipes = (
        Equipe.objects
        .select_related("president", "entraineur")
        .prefetch_related("staff", "scouts", "joueurs")
    )
    if q:
        equipes = equipes.filter(nom_recherche__icontains=normalize_text(q))
    equipes = equipes.order_by("nom")

    page = Paginator(equipes, PAR_PAGE).get_page(request.GET.get("page", 1))
    qs = urlencode({"q": q}) if q else ""

    return {
        "page": page,
        "total": page.paginator.count,
        "q": q,
        "qs": qs,
        "filtre_actif": bool(q),
        "stats": {
            "total": Equipe.objects.count(),
            "pays": Equipe.objects.exclude(pays="").values("pays").distinct().count(),
            "joueurs": Joueur.objects.filter(equipe__isnull=False).count(),
        },
    }


# ─────────────────────────── Administrateur : CRUD ───────────────────────────
@admin_requis
def liste(request):
    """Liste des équipes : recherche dynamique uniquement par nom d'équipe."""
    contexte = _contexte_liste(request)
    if _est_ajax(request):
        return render(request, "equipeApp/_grille.html", contexte)

    return render(request, "equipeApp/liste.html", contexte)


@admin_requis
def creer(request):
    """Création d'une équipe avec consultation automatique de l'ID prévisionnel."""
    prochain_id = prochain_id_modele(Equipe)
    form = EquipeForm(request.POST or None, request.FILES or None)

    if request.method == "POST":
        if form.is_valid():
            equipe = form.save()
            messages.success(request, f"L'équipe « {equipe.nom} » (ID #{equipe.pk}) a été créée avec succès.")
            return redirect("equipes:detail", pk=equipe.pk)
        messages.error(request, "Veuillez corriger les erreurs indiquées dans le formulaire.")

    return render(request, "equipeApp/formulaire.html", {
        "form": form,
        "mode": "creer",
        "prochain_id": prochain_id,
        "id_equipe": prochain_id,
        "pays_liste": PAYS_LISTE,
        "pays_villes_json": json.dumps(PAYS_VILLES_MONDE),
    })


@admin_requis
def modifier(request, pk):
    """Modification d'une équipe : même disposition, ID visible et mêmes contrôles."""
    equipe = get_object_or_404(
        Equipe.objects.select_related("president", "entraineur").prefetch_related("staff", "scouts", "joueurs"),
        pk=pk,
    )
    form = EquipeForm(request.POST or None, request.FILES or None, instance=equipe)

    if request.method == "POST":
        if form.is_valid():
            equipe = form.save()
            messages.success(request, f"L'équipe « {equipe.nom} » a été modifiée avec succès.")
            return redirect("equipes:detail", pk=equipe.pk)
        messages.error(request, "Veuillez corriger les erreurs indiquées dans le formulaire.")

    return render(request, "equipeApp/formulaire.html", {
        "form": form,
        "mode": "editer",
        "equipe": equipe,
        "id_equipe": equipe.pk,
        "prochain_id": equipe.pk,
        "pays_liste": PAYS_LISTE,
        "pays_villes_json": json.dumps(PAYS_VILLES_MONDE),
    })


@admin_requis
def supprimer(request, pk):
    equipe = get_object_or_404(Equipe, pk=pk)
    if request.method == "POST":
        nom = equipe.nom
        with transaction.atomic():
            Match.objects.filter(Q(equipe_domicile=equipe) | Q(equipe_exterieur=equipe)).delete()
            equipe.delete()
        messages.success(request, f"L'équipe « {nom} » et ses matchs associés ont été supprimés avec succès.")
        return redirect("equipes:liste")

    contexte = _contexte_liste(request)
    contexte["equipe"] = equipe
    return render(request, "equipeApp/confirmer_suppression.html", contexte)


# ─────────────────────────── Consultation : tous les rôles ───────────────────────────
@login_required
def detail(request, pk):
    """Fiche détaillée d'une équipe :
    Cadre 1 : Informations générales (nom, niveau, pays, ville, date_création, description).
    Cadre 2 : Composition (président, entraîneur, scout, staff, joueurs, effectif total).
    """
    equipe = get_object_or_404(
        Equipe.objects
        .select_related("president", "entraineur")
        .prefetch_related("staff", "scouts", "joueurs"),
        pk=pk,
    )
    if not peut_consulter(request.user, equipe):
        messages.error(request, "Vous ne pouvez consulter que votre propre équipe.")
        return redirect("equipes:mon_equipe")

    retour = (request.GET.get("retour") or "").strip()
    if retour and url_has_allowed_host_and_scheme(
        retour, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        retour_url = retour
        retour_label = "Retour à la fiche président" if "/presidents/" in retour else "Retour"
    else:
        retour_url = reverse("equipes:liste")
        retour_label = "Retour aux équipes"

    entraineur = getattr(equipe, "entraineur", None)
    joueurs = equipe.joueurs.order_by("numero_maillot", "nom")

    return render(request, "equipeApp/detail.html", {
        "equipe": equipe,
        "entraineur": entraineur,
        "president": equipe.president,
        "staff_membres": equipe.staff.all(),
        "scouts_membres": equipe.scouts.all(),
        "joueurs": joueurs,
        "nb_joueurs": joueurs.count(),
        "peut_gerer": est_admin(request.user),
        "retour_url": retour_url,
        "retour_label": retour_label,
    })


@login_required
def mon_equipe(request):
    """« Consulter mon équipe » pour les autres utilisateurs avec toutes les informations requises."""
    if est_admin(request.user):
        return redirect("equipes:liste")
    equipes = list(
        equipes_de(request.user)
        .select_related("president", "entraineur")
        .prefetch_related("staff", "scouts", "joueurs")
    )
    for eq in equipes:
        eq.joueurs_tries = eq.joueurs.order_by("numero_maillot", "nom")
    return render(request, "equipeApp/mes_equipes.html", {"equipes": equipes})


# ─────────────────────────── API Villes selon le Pays ───────────────────────────
@login_required
def api_villes(request):
    """Retourne la liste des villes réelles pour un pays donné."""
    pays = request.GET.get("pays", "").strip()
    if not pays:
        return JsonResponse({"villes": []})
    norm = normalize_text(pays)
    for p, villes in PAYS_VILLES_MONDE.items():
        if normalize_text(p) == norm:
            return JsonResponse({"pays": p, "villes": sorted(villes)})
    return JsonResponse({"villes": []})
