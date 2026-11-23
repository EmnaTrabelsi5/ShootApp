"""Comptes de test : un par rôle + admin. Identifiant = mot de passe.

Connexion avec l'identifiant court (president1) ou l'e-mail (president1@yalla.tn).
"""
import datetime

from django.contrib.auth.hashers import make_password
from django.db import migrations

COMPTES = [
    # (identifiant, app, modèle, rôle, prénom, nom, champs en plus)
    ("president1", "presidentApp", "President", "PRESIDENT", "Hédi", "Ben Salah", {}),
    ("entraineur1", "entraineurApp", "Entraineur", "ENTRAINEUR", "Mehdi", "Gharbi", {"fonction": "principal"}),
    ("staff1", "staffApp", "Staff", "STAFF", "Ines", "Khelifi", {}),
    ("scout1", "scoutApp", "Scout", "SCOUT", "Youssef", "Amri", {}),
    ("joueur1", "joueurApp", "Joueur", "JOUEUR", "Amine", "Dridi",
     {"poste": "MIL", "statut": "DISPONIBLE", "nationalite": "Tunisienne", "date_naissance": datetime.date(2004, 5, 12)}),
]


def creer(apps, schema_editor):
    Utilisateur = apps.get_model("utilisateurApp", "Utilisateur")
    for ident, app, modele, role, prenom, nom, extra in COMPTES:
        email = f"{ident}@yalla.tn"
        if Utilisateur.objects.filter(email=email).exists():
            continue
        apps.get_model(app, modele).objects.create(
            email=email, password=make_password(ident), role=role, prenom=prenom, nom=nom, **extra
        )
    if not Utilisateur.objects.filter(email="admin@yalla.tn").exists():
        Utilisateur.objects.create(
            email="admin@yalla.tn", password=make_password("admin"), role="ADMIN",
            prenom="Admin", nom="YALLA", is_staff=True, is_superuser=True,
        )


def supprimer(apps, schema_editor):
    Utilisateur = apps.get_model("utilisateurApp", "Utilisateur")
    emails = [f"{c[0]}@yalla.tn" for c in COMPTES] + ["admin@yalla.tn"]
    for u in Utilisateur.objects.filter(email__in=emails):
        u.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("utilisateurApp", "0001_initial"),
        ("presidentApp", "0001_initial"),
        ("entraineurApp", "0002_initial"),
        ("staffApp", "0001_initial"),
        ("scoutApp", "0002_initial"),
        ("joueurApp", "0002_joueur_statut"),
    ]
    operations = [migrations.RunPython(creer, supprimer)]
