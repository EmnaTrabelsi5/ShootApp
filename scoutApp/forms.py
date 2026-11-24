from django import forms

from .models import RapportScouting, Recommandation, Scout


class ScoutForm(forms.ModelForm):
    password = forms.CharField(
        label="Mot de passe",
        required=False,
        widget=forms.PasswordInput,
        help_text="Obligatoire à la création. Laissez vide pour conserver le mot de passe actuel.",
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk is None:
            self.fields["password"].required = True

    def clean_email(self):
        email = self.cleaned_data["email"]
        queryset = Scout.objects.filter(email=email)
        if self.instance.pk:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise forms.ValidationError("Un utilisateur utilise déjà cette adresse email.")
        return email

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


class RecommandationForm(forms.ModelForm):
    class Meta:
        model = Recommandation
        fields = ["joueur", "score_compatibilite", "justification", "statut"]
