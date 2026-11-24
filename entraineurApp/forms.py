from django import forms
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from equipeApp.models import Equipe
from utilisateurApp.models import Utilisateur
from .models import Entraineur


class EntraineurForm(forms.ModelForm):
    """
    Formulaire de création et mise à jour d'un entraîneur.
    Gère conjointement le compte Utilisateur et le profil Entraineur.
    """
    password1 = forms.CharField(
        label="Mot de passe",
        widget=forms.PasswordInput(attrs={
            "placeholder": "••••••••",
            "autocomplete": "new-password",
        }),
        required=False,
        help_text="Au moins 8 caractères, non trivial.",
    )
    password2 = forms.CharField(
        label="Confirmer le mot de passe",
        widget=forms.PasswordInput(attrs={
            "placeholder": "••••••••",
            "autocomplete": "new-password",
        }),
        required=False,
    )

    class Meta:
        model = Entraineur
        fields = [
            "prenom",
            "nom",
            "email",
            "telephone",
            "date_naissance",
            "photo",
            "type",
            "fonction",
            "specialite",
            "equipe",
        ]
        labels = {
            "prenom": "Prénom",
            "nom": "Nom",
            "email": "Adresse e-mail",
            "telephone": "Téléphone",
            "date_naissance": "Date de naissance",
            "photo": "Photo de profil",
            "type": "Type d'entraîneur",
            "fonction": "Fonction",
            "specialite": "Spécialité",
            "equipe": "Équipe assignée",
        }
        widgets = {
            "prenom": forms.TextInput(attrs={"placeholder": "ex : Ali", "autocomplete": "off"}),
            "nom": forms.TextInput(attrs={"placeholder": "ex : Boumnijel", "autocomplete": "off"}),
            "email": forms.EmailInput(attrs={"placeholder": "coach@club.tn"}),
            "telephone": forms.TextInput(attrs={"placeholder": "+216 20 123 456"}),
            "date_naissance": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "type": forms.Select(),
            "fonction": forms.Select(),
            "specialite": forms.Select(),
            "equipe": forms.Select(),
            "photo": forms.FileInput(attrs={"accept": "image/*"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        is_creation = not (self.instance and self.instance.pk)

        # Mots de passe obligatoires à la création, optionnels en modification
        if is_creation:
            self.fields["password1"].required = True
            self.fields["password2"].required = True
        else:
            self.fields["password1"].help_text = "Laissez vide pour conserver le mot de passe actuel."

        # Menus déroulants avec libellés par défaut explicites
        self.fields["type"].choices = [("", "— Choisir un type —")] + list(Entraineur.TypeEntraineur.choices)
        self.fields["fonction"].choices = [("", "— Choisir une fonction —")] + list(Entraineur.Fonction.choices)
        self.fields["specialite"].choices = [("", "— Choisir une spécialité —")] + list(Entraineur.Specialite.choices)

        # Filtre intelligent d'équipe : libres (sans coach) ou l'équipe déjà affectée à ce coach
        equipes_qs = Equipe.objects.all().order_by("nom")
        if is_creation:
            equipes_qs = equipes_qs.filter(entraineur__isnull=True)
        else:
            equipes_qs = equipes_qs.filter(
                models.Q(entraineur__isnull=True) | models.Q(entraineur=self.instance)
            )
        self.fields["equipe"].queryset = equipes_qs
        self.fields["equipe"].empty_label = "— Aucune (entraîneur libre) —"

        # Borne max côté client HTML5 : minimum 18 ans obligatoire
        today = timezone.localdate()
        date_18_ans = today.replace(year=today.year - 18)
        self.fields["date_naissance"].widget.attrs["max"] = date_18_ans.isoformat()

    def clean_email(self):
        email = self.cleaned_data.get("email", "").strip().lower()
        if not email:
            raise ValidationError("L'adresse e-mail est obligatoire.")
        qs = Utilisateur.objects.filter(email=email)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError("Cette adresse e-mail est déjà utilisée par un autre compte.")
        return email

    def clean_telephone(self):
        tel = self.cleaned_data.get("telephone", "")
        return tel.strip()

    def clean_date_naissance(self):
        dob = self.cleaned_data.get("date_naissance")
        if dob:
            today = timezone.localdate()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 18:
                raise ValidationError("L'entraîneur doit être âgé d'au moins 18 ans.")
        return dob

    def clean(self):
        cleaned_data = super().clean()
        p1 = cleaned_data.get("password1")
        p2 = cleaned_data.get("password2")

        is_creation = not (self.instance and self.instance.pk)

        if is_creation and not p1:
            self.add_error("password1", "Le mot de passe est obligatoire pour créer un compte.")

        if p1 or p2:
            if p1 != p2:
                self.add_error("password2", "Les mots de passe saisis ne correspondent pas.")
            else:
                try:
                    validate_password(p1, self.instance)
                except ValidationError as error:
                    self.add_error("password1", error)

        return cleaned_data

    def save(self, commit=True):
        coach = super().save(commit=False)
        coach.role = Utilisateur.Role.ENTRAINEUR

        p1 = self.cleaned_data.get("password1")
        if p1:
            coach.set_password(p1)

        if commit:
            coach.save()
            self.save_m2m()
        return coach
