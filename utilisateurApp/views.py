from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from .forms import ConnexionForm
from .roles import accueil_du_role, est_admin

# Comptes de démonstration (créés par la migration 0002), affichés en mode DEBUG
COMPTES_TEST = [
    ("president1", "Président"),
    ("entraineur1", "Entraîneur"),
    ("staff1", "Staff"),
    ("scout1", "Scout"),
    ("joueur1", "Joueur"),
    ("admin", "Admin"),
]


def connexion(request):
    suivant = request.POST.get("next") or request.GET.get("next") or ""
    if not url_has_allowed_host_and_scheme(suivant, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        suivant = ""
    if request.user.is_authenticated and request.method == "GET":
        return redirect(suivant or accueil_du_role(request.user))

    form = ConnexionForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.get_user()
        login(request, user)
        messages.success(request, f"Bienvenue {user.prenom or user.email} !")
        return redirect(suivant or accueil_du_role(user))
    return render(request, "utilisateurApp/connexion.html", {
        "form": form,
        "next": suivant,
        "comptes_test": COMPTES_TEST if settings.DEBUG else [],
    }, status=400 if form.errors else 200)


@require_POST
def deconnexion(request):
    logout(request)
    return redirect("accueil")


@login_required
def dashboard(request):
    if not est_admin(request.user):
        raise PermissionDenied
    return render(request, "utilisateurApp/dashboard.html")
