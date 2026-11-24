"""Qui peut faire quoi dans le module Équipes.

- Administrateur : consulter, créer, modifier, supprimer les équipes (et les présidents).
- Président, staff, scout, entraîneur, joueur : consulter SON équipe uniquement.
"""
from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect

from utilisateurApp.models import Utilisateur
from utilisateurApp.roles import est_admin

from .models import Equipe

R = Utilisateur.Role


def equipes_de(user):
    """Équipes auxquelles appartient l'utilisateur connecté (selon son rôle)."""
    if est_admin(user):
        return Equipe.objects.all()
    if user.role == R.PRESIDENT:
        return Equipe.objects.filter(president_id=user.pk)
    if user.role == R.ENTRAINEUR:
        return Equipe.objects.filter(entraineur__pk=user.pk)
    if user.role == R.JOUEUR:
        return Equipe.objects.filter(joueurs__pk=user.pk).distinct()
    if user.role == R.STAFF:
        return Equipe.objects.filter(staff__pk=user.pk).distinct()
    if user.role == R.SCOUT:
        return Equipe.objects.filter(scouts__pk=user.pk).distinct()
    return Equipe.objects.none()


def peut_consulter(user, equipe):
    return est_admin(user) or equipes_de(user).filter(pk=equipe.pk).exists()


def admin_requis(vue):
    """Réservé à l'administrateur ; les autres rôles sont renvoyés vers leur équipe."""

    @login_required
    @wraps(vue)
    def verifie(request, *args, **kwargs):
        if not est_admin(request.user):
            messages.error(request, "Cette action est réservée à l'administrateur.")
            return redirect("equipes:mon_equipe")
        return vue(request, *args, **kwargs)

    return verifie
