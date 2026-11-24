from django import forms

from .models import Joueur


class JoueurForm(forms.ModelForm):
    """Formulaire d'ajout / modification d'un joueur (popup du Vestiaire)."""

    class Meta:
        model = Joueur
        fields = [
            "poste", "statut",
            "prenom", "nom", "email", "telephone", "date_naissance", "nationalite",
            "numero_maillot", "pied_fort", "taille_cm", "poids_kg", "equipe", "photo",
        ]
        labels = {
            "poste": "Poste",
            "statut": "Statut",
            "prenom": "Prénom",
            "nom": "Nom",
            "email": "E-mail",
            "telephone": "Téléphone",
            "date_naissance": "Date de naissance",
            "nationalite": "Nationalité",
            "numero_maillot": "N° de maillot",
            "pied_fort": "Pied fort",
            "taille_cm": "Taille (cm)",
            "poids_kg": "Poids (kg)",
            "equipe": "Équipe",
            "photo": "Photo",
        }
        widgets = {
            "poste": forms.RadioSelect,
            "statut": forms.RadioSelect,
            "prenom": forms.TextInput(attrs={"placeholder": "ex : Youssef", "autocomplete": "off"}),
            "nom": forms.TextInput(attrs={"placeholder": "ex : Msakni", "autocomplete": "off"}),
            "email": forms.EmailInput(attrs={"placeholder": "joueur@club.tn"}),
            "telephone": forms.TextInput(attrs={"placeholder": "+216 ..."}),
            "date_naissance": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "nationalite": forms.TextInput(attrs={"placeholder": "ex : Tunisienne"}),
            "numero_maillot": forms.NumberInput(attrs={"min": 1, "max": 99, "placeholder": "1 à 99"}),
            "taille_cm": forms.NumberInput(attrs={"min": 100, "max": 230, "placeholder": "ex : 180"}),
            "poids_kg": forms.NumberInput(attrs={"min": 30, "max": 150, "step": "0.1", "placeholder": "ex : 74.5"}),
            "photo": forms.FileInput(attrs={"accept": "image/*"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Pas d'option vide « --------- » pour les boutons radio
        self.fields["poste"].choices = Joueur.Poste.choices
        self.fields["statut"].choices = Joueur.Statut.choices
        self.fields["pied_fort"].choices = [("", "Non précisé")] + list(Joueur.PiedFort.choices)
        self.fields["equipe"].empty_label = "Sans équipe"
        self.fields["numero_maillot"].widget.attrs["min"] = 1

    def clean_email(self):
        return self.cleaned_data["email"].strip().lower()

    def clean(self):
        cleaned = super().clean()
        equipe = cleaned.get("equipe")
        numero = cleaned.get("numero_maillot")
        if equipe and numero:
            doublon = Joueur.objects.filter(equipe=equipe, numero_maillot=numero)
            if self.instance.pk:
                doublon = doublon.exclude(pk=self.instance.pk)
            autre = doublon.first()
            if autre:
                self.add_error(
                    "numero_maillot",
                    f"Le n°{numero} est déjà porté par {autre} dans {equipe}.",
                )
        return cleaned

    def save(self, commit=True):
        joueur = super().save(commit=False)
        if not joueur.pk:
            # Le joueur est créé par le coach : pas de mot de passe pour l'instant
            joueur.set_unusable_password()
        if commit:
            joueur.save()
        return joueur
