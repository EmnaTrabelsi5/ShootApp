"""Connexion par identifiant court (ex. « president1 ») ou par e-mail complet."""
from django.contrib.auth.backends import ModelBackend

DOMAINE = "yalla.tn"


def email_depuis_identifiant(identifiant):
    identifiant = (identifiant or "").strip()
    if identifiant and "@" not in identifiant:
        return f"{identifiant.lower()}@{DOMAINE}"
    return identifiant


class IdentifiantBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        username = username or kwargs.get("email")
        return super().authenticate(request, username=email_depuis_identifiant(username), password=password, **kwargs)
