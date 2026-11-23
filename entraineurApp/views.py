from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from utilisateurApp.permissions import (
    gestion_entraineurs_required,
    lecture_entraineurs_required,
)
from utilisateurApp.roles import peut_gerer_entraineurs
from .forms import EntraineurForm
from .models import Entraineur


@lecture_entraineurs_required
def liste(request):
    """
    Tableau de bord et annuaire du staff technique.
    Accessible au Président, à l'Administrateur et aux Entraîneurs.
    """
    q = request.GET.get("q", "").strip()
    specialite_filter = request.GET.get("specialite", "").strip()
    type_filter = request.GET.get("type", "").strip()

    qs = Entraineur.objects.select_related("equipe").all().order_by("nom", "prenom")

    if q:
        qs = qs.filter(
            Q(nom__icontains=q)
            | Q(prenom__icontains=q)
            | Q(email__icontains=q)
            | Q(specialite__icontains=q)
            | Q(type__icontains=q)
        )

    if specialite_filter:
        qs = qs.filter(specialite=specialite_filter)

    if type_filter:
        qs = qs.filter(type=type_filter)

    # Indicateurs statistiques globaux
    total = Entraineur.objects.count()
    avec_equipe = Entraineur.objects.filter(equipe__isnull=False).count()
    libres = Entraineur.objects.filter(equipe__isnull=True).count()
    principaux = Entraineur.objects.filter(type=Entraineur.TypeEntraineur.PRINCIPAL).count()

    stats = {
        "total": total,
        "avec_equipe": avec_equipe,
        "libres": libres,
        "principaux": principaux,
    }

    context = {
        "entraineurs": qs,
        "stats": stats,
        "q": q,
        "specialite_filter": specialite_filter,
        "type_filter": type_filter,
        "specialites": Entraineur.Specialite.choices,
        "types": Entraineur.TypeEntraineur.choices,
        "peut_gerer": peut_gerer_entraineurs(request.user),
    }
    return render(request, "entraineurApp/liste.html", context)


@lecture_entraineurs_required
def detail(request, pk):
    """
    Fiche profil complète de l'entraîneur.
    Accessible au Président, Admin et aux Entraîneurs.
    """
    coach = get_object_or_404(Entraineur.objects.select_related("equipe"), pk=pk)
    seances = coach.entrainements.all()[:6]

    peut_modifier = peut_gerer_entraineurs(request.user) or (request.user.pk == coach.pk)
    peut_supprimer = peut_gerer_entraineurs(request.user) and (request.user.pk != coach.pk)

    context = {
        "entraineur": coach,
        "seances": seances,
        "peut_modifier": peut_modifier,
        "peut_supprimer": peut_supprimer,
    }
    return render(request, "entraineurApp/detail.html", context)


@gestion_entraineurs_required
def creer(request):
    """Création conjointe compte/profil (Président et Administrateur uniquement)."""
    if request.method == "POST":
        form = EntraineurForm(request.POST, request.FILES)
        if form.is_valid():
            coach = form.save()
            messages.success(
                request,
                f"L'entraîneur {coach.prenom} {coach.nom} a été créé avec succès."
            )
            return redirect("entraineur:detail", pk=coach.pk)
        else:
            messages.error(request, "Veuillez vérifier les informations saisies.")
    else:
        form = EntraineurForm()

    context = {
        "form": form,
        "mode": "creer",
    }
    return render(request, "entraineurApp/formulaire.html", context)


@login_required
def editer(request, pk):
    """
    Mise à jour d'un entraîneur.
    Autorisé au Président, à l'Admin, ou à l'entraîneur lui-même pour son propre profil.
    """
    coach = get_object_or_404(Entraineur, pk=pk)

    if not (peut_gerer_entraineurs(request.user) or request.user.pk == coach.pk):
        messages.error(request, "Vous n'avez pas l'autorisation de modifier ce profil.")
        return redirect("entraineur:liste")

    if request.method == "POST":
        form = EntraineurForm(request.POST, request.FILES, instance=coach)
        if form.is_valid():
            coach = form.save()
            messages.success(
                request,
                f"Le profil de {coach.prenom} {coach.nom} a été mis à jour."
            )
            return redirect("entraineur:detail", pk=coach.pk)
        else:
            messages.error(request, "Veuillez corriger les erreurs du formulaire.")
    else:
        form = EntraineurForm(instance=coach)

    context = {
        "form": form,
        "mode": "editer",
        "entraineur": coach,
    }
    return render(request, "entraineurApp/formulaire.html", context)


@gestion_entraineurs_required
@require_http_methods(["GET", "POST"])
def supprimer_entraineur(request, pk):
    """
    Suppression d'un entraîneur (Président et Administrateur uniquement).
    Sécurité : interdiction de supprimer son propre compte.
    """
    coach = get_object_or_404(Entraineur, pk=pk)

    if request.user.pk == coach.pk:
        messages.error(
            request,
            "Sécurité : vous ne pouvez pas supprimer votre propre compte."
        )
        return redirect("entraineur:liste")

    if request.method == "POST":
        nom_complet = f"{coach.prenom} {coach.nom}"
        coach.delete()
        messages.success(
            request,
            f"L'entraîneur {nom_complet} et son compte ont été supprimés avec succès."
        )
        return redirect("entraineur:liste")

    context = {
        "entraineur": coach,
    }
    return render(request, "entraineurApp/confirmer_suppression.html", context)
