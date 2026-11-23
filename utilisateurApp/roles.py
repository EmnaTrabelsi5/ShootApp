"""Ce que chaque rôle peut faire dans YALLA."""
from django.urls import reverse

from .models import Utilisateur

R = Utilisateur.Role

# Rôles qui peuvent ajouter, modifier ou supprimer des joueurs
GERENT_JOUEURS = {R.PRESIDENT, R.ENTRAINEUR, R.ADMIN}

LIBELLES = {
    R.ADMIN: "Administrateur",
    R.PRESIDENT: "Président du club",
    R.ENTRAINEUR: "Entraîneur",
    R.STAFF: "Staff technique",
    R.SCOUT: "Scout",
    R.JOUEUR: "Joueur",
}


def est_admin(user):
    return user.is_authenticated and (user.is_superuser or user.role == R.ADMIN)


def est_president(user):
    return user.is_authenticated and user.role == R.PRESIDENT


def a_acces_dashboard(user):
    """Admin et Président ont accès au tableau de bord."""
    return user.is_authenticated and (est_admin(user) or est_president(user))


def est_entraineur(user):
    return user.is_authenticated and user.role == R.ENTRAINEUR


def peut_voir_entraineurs(user):
    """Admin, Président ou Entraîneur (notamment principal) peuvent consulter les entraîneurs."""
    return user.is_authenticated and (a_acces_dashboard(user) or est_entraineur(user))


def peut_gerer_entraineurs(user):
    """Créer, réaffecter ou supprimer un entraîneur : réservé à l'Admin et au Président."""
    return user.is_authenticated and a_acces_dashboard(user)


def peut_gerer_joueurs(user):
    return user.is_authenticated and (est_admin(user) or user.role in GERENT_JOUEURS)


def accueil_du_role(user):
    """Page d'arrivée après la connexion."""
    return reverse("comptes:dashboard") if a_acces_dashboard(user) else reverse("joueurs:liste")
