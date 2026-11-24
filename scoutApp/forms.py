from django import forms
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone

from equipeApp.outils import erreurs_image, telephone_international
from utilisateurApp.models import Utilisateur

from .models import RapportScouting, Recommandation, Scout


class ScoutForm(forms.ModelForm):
    password = forms.CharField(
        label="Mot de passe",
        required=False,
        widget=forms.PasswordInput(
            attrs={"autocomplete": "new-password", "placeholder": "8 caractères minimum"}
        ),
        help_text="Obligatoire à la création. Laissez vide en modification pour le conserver.",
    )
    password_confirmation = forms.CharField(
        label="Confirmer le mot de passe",
        required=False,
        widget=forms.PasswordInput(
            attrs={"autocomplete": "new-password", "placeholder": "Confirmez le mot de passe"}
        ),
    )

    class Meta:
        model = Scout
        fields = [
            "nom",
            "prenom",
            "date_naissance",
            "email",
            "telephone",
            "photo",
            "type",
            "specialite_scout",
            "is_active",
        ]
        labels = {
            "nom": "Nom",
            "prenom": "Prénom",
            "date_naissance": "Date de naissance",
            "email": "Adresse e-mail",
            "telephone": "Téléphone",
            "photo": "Photo de profil",
            "type": "Type de scout",
            "specialite_scout": "Spécialité",
            "is_active": "Compte actif",
        }
        widgets = {
            "nom": forms.TextInput(attrs={"autocomplete": "family-name", "maxlength": 100}),
            "prenom": forms.TextInput(attrs={"autocomplete": "given-name", "maxlength": 100}),
            "date_naissance": forms.DateInput(
                attrs={"type": "date"}, format="%Y-%m-%d"
            ),
            "email": forms.EmailInput(
                attrs={"autocomplete": "email", "placeholder": "scout@club.tn"}
            ),
            "telephone": forms.TextInput(
                attrs={"autocomplete": "tel", "placeholder": "+216 20 123 456", "maxlength": 20}
            ),
            "photo": forms.FileInput(attrs={"accept": "image/jpeg,image/png"}),
            "type": forms.TextInput(attrs={"placeholder": "ex. Professionnel", "maxlength": 50}),
            "specialite_scout": forms.TextInput(
                attrs={"placeholder": "ex. Détection des jeunes talents", "maxlength": 100}
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk is None:
            self.fields["password"].required = True
            self.fields["password_confirmation"].required = True
        else:
            self.fields["password"].help_text = (
                "Laissez les deux champs vides pour conserver le mot de passe actuel."
            )
        self.fields["date_naissance"].widget.attrs["max"] = timezone.localdate().isoformat()

    def clean_nom(self):
        return self._clean_name("nom", "Le nom")

    def clean_prenom(self):
        return self._clean_name("prenom", "Le prénom")

    def _clean_name(self, field_name, label):
        value = " ".join(self.cleaned_data[field_name].split())
        if len(value) < 2:
            raise ValidationError(f"{label} doit contenir au moins 2 caractères.")
        return value

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        queryset = Utilisateur.objects.filter(email__iexact=email)
        if self.instance.pk:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise ValidationError("Cette adresse e-mail est déjà utilisée par un autre compte.")
        return email

    def clean_telephone(self):
        return telephone_international(self.cleaned_data.get("telephone", ""))

    def clean_date_naissance(self):
        date_naissance = self.cleaned_data.get("date_naissance")
        if date_naissance and date_naissance > timezone.localdate():
            raise ValidationError("La date de naissance ne peut pas être dans le futur.")
        return date_naissance

    def clean_photo(self):
        photo = self.cleaned_data.get("photo")
        upload = self.files.get(self.add_prefix("photo"))
        if upload:
            errors = erreurs_image(upload)
            if errors:
                raise ValidationError(errors)
        return photo

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirmation = cleaned_data.get("password_confirmation")
        is_creation = self.instance.pk is None

        if is_creation and not password:
            self.add_error("password", "Le mot de passe est obligatoire à la création.")
        if password or confirmation:
            if password != confirmation:
                self.add_error("password_confirmation", "Les mots de passe ne correspondent pas.")
            elif password:
                try:
                    validate_password(password, self.instance)
                except ValidationError as error:
                    self.add_error("password", error)
        return cleaned_data

    def save(self, commit=True):
        scout = super().save(commit=False)
        password = self.cleaned_data.get("password")
        if password:
            scout.set_password(password)
        if commit:
            scout.save()
        return scout


class RapportScoutingForm(forms.ModelForm):
    class Meta:
        model = RapportScouting
        fields = [
            "scout",
            "joueur",
            "evaluation_technique",
            "evaluation_physique",
            "evaluation_tactique",
            "evaluation_mentale",
            "observations",
        ]
        labels = {
            "scout": "Scout",
            "joueur": "Joueur évalué",
            "evaluation_technique": "Évaluation technique /10",
            "evaluation_physique": "Évaluation physique /10",
            "evaluation_tactique": "Évaluation tactique /10",
            "evaluation_mentale": "Évaluation mentale /10",
            "observations": "Observations",
        }
        widgets = {
            "evaluation_technique": forms.NumberInput(attrs={"min": 0, "max": 10, "step": "0.1"}),
            "evaluation_physique": forms.NumberInput(attrs={"min": 0, "max": 10, "step": "0.1"}),
            "evaluation_tactique": forms.NumberInput(attrs={"min": 0, "max": 10, "step": "0.1"}),
            "evaluation_mentale": forms.NumberInput(attrs={"min": 0, "max": 10, "step": "0.1"}),
            "observations": forms.Textarea(attrs={"rows": 5}),
        }


class RecommandationForm(forms.ModelForm):
    class Meta:
        model = Recommandation
        fields = ["joueur", "score_compatibilite", "justification", "statut"]
        labels = {
            "joueur": "Joueur recommandé",
            "score_compatibilite": "Compatibilité (%)",
            "justification": "Justification",
            "statut": "Statut",
        }
        widgets = {
            "score_compatibilite": forms.NumberInput(
                attrs={"min": 0, "max": 100, "step": "0.1"}
            ),
            "justification": forms.Textarea(attrs={"rows": 5}),
        }
