"""Formulaire Président : crée et met à jour le compte et le profil de président,
avec validations strictes (âge >= 18 ans, nationalité réelle, photo obligatoire en création,
date de début de présidence obligatoire, téléphone international avec +216 par défaut).
"""
from datetime import date

from django import forms
from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError

from equipeApp.outils import (
    age_a_la_date, erreurs_image, telephone_international,
    validate_password_strength, valider_nationalite,
    NATIONALITES_SUGGESTIONS,
)
from utilisateurApp.models import Utilisateur

from .models import President

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]


class PresidentForm(forms.ModelForm):
    photo = forms.ImageField(
        label="Photo du président",
        required=False,
        widget=forms.FileInput(attrs={"accept": "image/jpeg,image/png"}),
    )
    supprimer_photo = forms.BooleanField(required=False, widget=forms.HiddenInput())

    adresse = forms.CharField(
        label="Adresse",
        required=False,
        widget=forms.TextInput(attrs={
            "placeholder": "ex : 15 Avenue Habib Bourguiba, Tunis",
            "maxlength": 255,
            "autocomplete": "off",
        }),
    )

    nationalite = forms.CharField(
        label="Nationalité",
        required=True,
        widget=forms.TextInput(attrs={
            "list": "nationalites_list",
            "placeholder": "ex : Tunisienne",
            "autocomplete": "off",
        }),
    )

    date_naissance = forms.DateField(
        label="Date de naissance",
        required=True,
        widget=forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
    )

    date_debut_presidence = forms.DateField(
        label="Date de début de présidence",
        required=True,
        widget=forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
    )

    password1 = forms.CharField(
        label="Mot de passe",
        required=False,
        strip=False,
        widget=forms.PasswordInput(attrs={"placeholder": "••••••••", "autocomplete": "new-password"}),
        help_text="8 caractères minimum, 1 majuscule, 1 chiffre et 1 caractère spécial.",
    )
    password2 = forms.CharField(
        label="Confirmer le mot de passe",
        required=False,
        strip=False,
        widget=forms.PasswordInput(attrs={"placeholder": "••••••••", "autocomplete": "new-password"}),
    )

    class Meta:
        model = President
        fields = [
            "photo", "nom", "prenom", "adresse", "telephone", "email",
            "nationalite", "date_naissance", "date_debut_presidence",
        ]
        labels = {
            "nom": "Nom",
            "prenom": "Prénom",
            "email": "Adresse e-mail (identifiant)",
            "telephone": "Téléphone",
        }
        widgets = {
            "prenom": forms.TextInput(attrs={"placeholder": "ex : Hédi", "autocomplete": "off"}),
            "nom": forms.TextInput(attrs={"placeholder": "ex : Ben Salah", "autocomplete": "off"}),
            "email": forms.EmailInput(attrs={"placeholder": "president@club.tn"}),
            "telephone": forms.TextInput(attrs={"placeholder": "+216 20 123 456"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.creation = not (self.instance and self.instance.pk)

        # Formats de date
        for nom in ("date_naissance", "date_debut_presidence"):
            self.fields[nom].input_formats = DATE_FORMATS

        aujourdhui = date.today()
        self.fields["date_debut_presidence"].widget.attrs["max"] = str(aujourdhui)

        try:
            limite_age = aujourdhui.replace(year=aujourdhui.year - 18)
        except ValueError:
            limite_age = aujourdhui.replace(year=aujourdhui.year - 18, day=28)
        self.fields["date_naissance"].widget.attrs["max"] = str(limite_age)

        # Téléphone : +216 par défaut
        if self.creation and not self.initial.get("telephone"):
            self.initial["telephone"] = "+216 "

        # Mot de passe obligatoire uniquement à la création
        if self.creation:
            self.fields["password1"].required = True
            self.fields["password2"].required = True
        else:
            self.fields["password1"].help_text = "Laissez vide pour conserver le mot de passe actuel."

    # ─── Validations de champs ───
    def _nom(self, champ):
        valeur = " ".join(self.cleaned_data.get(champ, "").split())
        if len(valeur) < 2:
            raise ValidationError(f"Le {champ} doit contenir au moins 2 caractères.")
        return valeur

    def clean_nom(self):
        return self._nom("nom")

    def clean_prenom(self):
        return self._nom("prenom")

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if not email:
            raise ValidationError("L'adresse e-mail est obligatoire.")
        doublon = Utilisateur.objects.filter(email__iexact=email)
        if self.instance and self.instance.pk:
            doublon = doublon.exclude(pk=self.instance.pk)
        if doublon.exists():
            raise ValidationError("Cette adresse e-mail est déjà utilisée par un autre compte.")
        return email

    def clean_telephone(self):
        return telephone_international(self.cleaned_data.get("telephone"))

    def clean_nationalite(self):
        nat = self.cleaned_data.get("nationalite")
        return valider_nationalite(nat)

    def clean_date_naissance(self):
        naissance = self.cleaned_data.get("date_naissance")
        if not naissance:
            raise ValidationError("La date de naissance est obligatoire.")
        if naissance > date.today():
            raise ValidationError("La date de naissance ne peut pas être dans le futur.")
        if age_a_la_date(naissance) < 18:
            raise ValidationError("Le président doit avoir au moins 18 ans.")
        return naissance

    def clean_date_debut_presidence(self):
        debut = self.cleaned_data.get("date_debut_presidence")
        if not debut:
            raise ValidationError("La date de début de présidence est obligatoire.")
        if debut > date.today():
            raise ValidationError("La date de début de présidence ne peut pas être dans le futur.")
        return debut

    def clean_photo(self):
        photo = self.cleaned_data.get("photo")
        supprimer_photo = self.cleaned_data.get("supprimer_photo", False)

        if self.creation:
            if not photo:
                raise ValidationError("La photo est obligatoire lors de la création d'un président.")
        else:
            deja_photo = bool(self.instance and self.instance.photo)
            if (supprimer_photo or not deja_photo) and not photo:
                raise ValidationError("La photo est obligatoire. Veuillez sélectionner une image.")

        if photo and hasattr(photo, "size"):
            erreurs = erreurs_image(photo)
            if erreurs:
                raise ValidationError(erreurs)
        return photo

    def clean(self):
        data = super().clean()
        debut = data.get("date_debut_presidence")
        naissance = data.get("date_naissance")
        if debut and naissance and age_a_la_date(naissance, debut) < 18:
            self.add_error(
                "date_debut_presidence",
                "Le président devait avoir au moins 18 ans au début de sa présidence.",
            )

        p1 = data.get("password1")
        p2 = data.get("password2")
        if self.creation and not p1:
            self.add_error("password1", "Le mot de passe est obligatoire pour créer le compte.")
        if p1 or p2:
            if p1 != p2:
                self.add_error("password2", "Les mots de passe saisis ne correspondent pas.")
            else:
                try:
                    validate_password_strength(p1)
                except ValidationError as erreur:
                    self.add_error("password1", erreur)

        return data

    def save(self, commit=True):
        president = super().save(commit=False)
        president.role = Utilisateur.Role.PRESIDENT
        president.is_active = True

        # Gestion de la suppression de photo
        supprimer_photo = self.cleaned_data.get("supprimer_photo", False)
        nouvelle_photo = self.cleaned_data.get("photo")
        if supprimer_photo and not nouvelle_photo and president.photo:
            president.photo.delete(save=False)
            president.photo = None

        mot_de_passe = self.cleaned_data.get("password1")
        if mot_de_passe:
            president.password = make_password(mot_de_passe)

        if commit:
            president.save()
        return president
