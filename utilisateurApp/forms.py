from django import forms
from django.contrib.auth.forms import AuthenticationForm


class ConnexionForm(AuthenticationForm):
    username = forms.CharField(
        label="Identifiant",
        widget=forms.TextInput(attrs={"autofocus": True, "autocomplete": "username", "autocapitalize": "none",
                                      "spellcheck": "false", "placeholder": "ex. president1"}),
    )
    password = forms.CharField(
        label="Mot de passe", strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password", "placeholder": "••••••••"}),
    )
    error_messages = {
        "invalid_login": "Identifiant ou mot de passe incorrect.",
        "inactive": "Ce compte est désactivé.",
    }
