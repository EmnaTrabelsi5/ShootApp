from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect

from .roles import a_acces_dashboard, est_admin, peut_gerer_entraineurs, peut_voir_entraineurs


def admin_required(vue):
    """Accès réservé aux administrateurs du club."""
    @login_required
    @wraps(vue)
    def verifie(request, *args, **kwargs):
        if not est_admin(request.user):
            messages.error(request, "Accès réservé aux administrateurs.")
            return redirect("comptes:dashboard" if request.user.is_authenticated else "comptes:connexion")
        return vue(request, *args, **kwargs)
    return verifie


def dashboard_required(vue):
    """Accès réservé à la direction (Président et Administrateurs)."""
    @login_required
    @wraps(vue)
    def verifie(request, *args, **kwargs):
        if not a_acces_dashboard(request.user):
            messages.error(request, "Le tableau de bord est réservé aux présidents et administrateurs.")
            return redirect("joueurs:liste")
        return vue(request, *args, **kwargs)
    return verifie


def lecture_entraineurs_required(vue):
    """Consultation de l'effectif des entraîneurs : Admin, Président ou Entraîneur."""
    @login_required
    @wraps(vue)
    def verifie(request, *args, **kwargs):
        if not peut_voir_entraineurs(request.user):
            messages.error(request, "Accès réservé aux entraîneurs et à la direction du club.")
            return redirect("joueurs:liste")
        return vue(request, *args, **kwargs)
    return verifie


def gestion_entraineurs_required(vue):
    """Création, modification et suppression : réservé à la direction (Admin et Président)."""
    @login_required
    @wraps(vue)
    def verifie(request, *args, **kwargs):
        if not peut_gerer_entraineurs(request.user):
            messages.error(request, "Seuls le président et l'administrateur peuvent gérer les entraîneurs.")
            return redirect("entraineur:liste")
        return vue(request, *args, **kwargs)
    return verifie
