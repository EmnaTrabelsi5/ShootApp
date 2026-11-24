"""Formulaire Équipe : contrôles stricts, validation pays/villes réels, logo obligatoire,
gestion de l'encadrement (président, entraîneur obligatoire, staff, scouts) et des joueurs.
"""
from datetime import date

from django import forms
from django.core.exceptions import ValidationError

from entraineurApp.models import Entraineur
from joueurApp.models import Joueur
from presidentApp.models import President
from scoutApp.models import Scout
from staffApp.models import Staff

from .models import Equipe
from .outils import (
    erreurs_image, normalize_text, PAYS_LISTE, PAYS_VILLES_MONDE,
    valider_pays, valider_ville,
)

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
NIVEAUX = ["Amateur", "Semi-pro", "Pro"]


class EquipeForm(forms.ModelForm):
    niveau = forms.ChoiceField(label="Niveau", choices=[])
    logo = forms.ImageField(
        label="Logo de l'équipe",
        required=False,
        widget=forms.FileInput(attrs={"accept": "image/jpeg,image/png"}),
    )
    supprimer_logo = forms.BooleanField(required=False, widget=forms.HiddenInput())

    # Cadre 1 : Encadrement (Président, Entraîneur obligatoire, Staff, Scouts)
    president = forms.ModelChoiceField(
        label="Président",
        queryset=President.objects.none(),
        empty_label="— Sélectionner un président —",
        required=True,
        error_messages={
            "required": "Veuillez sélectionner un président.",
            "invalid_choice": "Président invalide.",
        },
    )
    entraineur = forms.ModelChoiceField(
        label="Entraîneur",
        queryset=Entraineur.objects.none(),
        empty_label="— Sélectionner un entraîneur —",
        required=True,
        error_messages={
            "required": "L'entraîneur est obligatoire pour une équipe.",
            "invalid_choice": "Entraîneur invalide.",
        },
    )
    staff = forms.ModelMultipleChoiceField(
        label="Staff technique",
        queryset=Staff.objects.none(),
        required=False,
    )
    scouts = forms.ModelMultipleChoiceField(
        label="Scouts",
        queryset=Scout.objects.none(),
        required=False,
    )

    # Cadre 2 : Joueurs (affectation multiple)
    joueurs = forms.ModelMultipleChoiceField(
        label="Joueurs affectés",
        queryset=Joueur.objects.none(),
        required=False,
    )

    class Meta:
        model = Equipe
        fields = [
            "logo", "nom", "niveau", "pays", "ville", "date_creation", "site_web",
            "description", "president", "staff", "scouts",
        ]
        labels = {
            "nom": "Nom de l'équipe",
            "ville": "Ville",
            "pays": "Pays",
            "date_creation": "Date de création",
            "description": "Description",
            "site_web": "Site web",
        }
        widgets = {
            "nom": forms.TextInput(attrs={
                "placeholder": "ex : Espérance Sportive de Tunis",
                "maxlength": 50,
                "autocomplete": "off",
            }),
            "pays": forms.TextInput(attrs={
                "placeholder": "Sélectionner ou saisir un pays",
                "list": "pays_list",
                "maxlength": 100,
                "autocomplete": "off",
            }),
            "ville": forms.TextInput(attrs={
                "placeholder": "Sélectionner ou saisir une ville",
                "list": "villes_list",
                "maxlength": 100,
                "autocomplete": "off",
            }),
            "date_creation": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "description": forms.Textarea(attrs={
                "rows": 3,
                "maxlength": 500,
                "placeholder": "Présentation et historique de l'équipe (500 caractères max)",
            }),
            "site_web": forms.URLInput(attrs={"placeholder": "https://www.exemple.com"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.creation = not (self.instance and self.instance.pk)

        # Date de création
        self.fields["date_creation"].required = True
        self.fields["date_creation"].input_formats = DATE_FORMATS
        self.fields["date_creation"].widget.attrs["max"] = str(date.today())

        # Pays et ville obligatoires
        self.fields["pays"].required = True
        self.fields["ville"].required = True

        # Niveaux
        niveaux = list(NIVEAUX)
        actuel = (self.instance.niveau or "").strip() if self.instance and self.instance.pk else ""
        if actuel and actuel not in niveaux:
            niveaux.append(actuel)
        self.fields["niveau"].choices = [("", "— Choisir un niveau —")] + [(n, n) for n in niveaux]

        # Encadrement querysets
        self.fields["president"].queryset = President.objects.order_by("nom", "prenom")
        self.fields["president"].label_from_instance = lambda p: f"{p.prenom} {p.nom}"

        self.fields["entraineur"].queryset = Entraineur.objects.order_by("nom", "prenom")
        self.fields["entraineur"].label_from_instance = lambda e: f"{e.prenom} {e.nom} ({e.get_type_display() if hasattr(e, 'get_type_display') else e.type or 'Entraîneur'})"

        self.fields["staff"].queryset = Staff.objects.order_by("nom", "prenom")
        self.fields["staff"].label_from_instance = lambda s: f"{s.prenom} {s.nom}"

        self.fields["scouts"].queryset = Scout.objects.order_by("nom", "prenom")
        self.fields["scouts"].label_from_instance = lambda s: f"{s.prenom} {s.nom}"

        # Joueurs queryset
        self.fields["joueurs"].queryset = Joueur.objects.order_by("nom", "prenom")
        self.fields["joueurs"].label_from_instance = lambda j: f"{j.prenom} {j.nom} ({j.get_poste_display() if hasattr(j, 'get_poste_display') else j.poste})"

        # Valeurs initiales en modification
        if self.instance and self.instance.pk:
            actuel_entraineur = getattr(self.instance, "entraineur", None)
            if actuel_entraineur:
                self.fields["entraineur"].initial = actuel_entraineur.pk
            self.fields["joueurs"].initial = list(self.instance.joueurs.values_list("pk", flat=True))

    # ─── Validations de champs ───
    def clean_nom(self):
        nom = " ".join(self.cleaned_data.get("nom", "").split())
        if len(nom) < 2:
            raise ValidationError("Le nom de l'équipe doit contenir au moins 2 caractères.")
        doublon = Equipe.objects.filter(nom_recherche=normalize_text(nom))
        if self.instance and self.instance.pk:
            doublon = doublon.exclude(pk=self.instance.pk)
        if doublon.exists():
            raise ValidationError("Une équipe avec ce nom existe déjà.")
        return nom

    def clean_pays(self):
        pays = self.cleaned_data.get("pays", "")
        return valider_pays(pays)

    def clean_date_creation(self):
        d = self.cleaned_data.get("date_creation")
        if not d:
            raise ValidationError("La date de création est obligatoire.")
        if d > date.today():
            raise ValidationError("La date de création ne peut pas être dans le futur.")
        if d.year < 1850:
            raise ValidationError("La date de création est trop ancienne (avant 1850).")
        return d

    def clean_description(self):
        texte = (self.cleaned_data.get("description") or "").strip()
        if len(texte) > 500:
            raise ValidationError("La description ne peut pas dépasser 500 caractères.")
        return texte

    def clean_logo(self):
        logo = self.cleaned_data.get("logo")
        supprimer_logo = self.cleaned_data.get("supprimer_logo", False)

        if self.creation:
            if not logo:
                raise ValidationError("Le logo est obligatoire lors de la création d'une équipe.")
        else:
            deja_logo = bool(self.instance and self.instance.logo)
            if (supprimer_logo or not deja_logo) and not logo:
                raise ValidationError("Le logo de l'équipe est obligatoire.")

        if logo and hasattr(logo, "size"):
            erreurs = erreurs_image(logo)
            if erreurs:
                raise ValidationError(erreurs)
        return logo

    def clean_site_web(self):
        url = (self.cleaned_data.get("site_web") or "").strip()
        if url and not url.startswith(("http://", "https://")):
            raise ValidationError("L'URL doit commencer par http:// ou https://.")
        return url

    def clean(self):
        cleaned_data = super().clean()
        pays = cleaned_data.get("pays")
        ville = cleaned_data.get("ville")

        if pays and ville:
            try:
                cleaned_data["ville"] = valider_ville(pays, ville)
            except ValidationError as e:
                self.add_error("ville", e)

        return cleaned_data

    def save(self, commit=True):
        equipe = super().save(commit=commit)

        # Si le logo a été marqué comme supprimé et qu'un nouveau logo est fourni, il sera remplacé automatiquement.
        # Si supprimer_logo sans nouveau fichier, on supprime l'ancien
        supprimer_logo = self.cleaned_data.get("supprimer_logo", False)
        nouveau_logo = self.cleaned_data.get("logo")
        if supprimer_logo and not nouveau_logo and equipe.logo:
            equipe.logo.delete(save=False)
            equipe.logo = None
            if commit:
                equipe.save(update_fields=["logo"])

        if commit:
            # Gestion de l'entraîneur (OneToOne)
            nouvel_entraineur = self.cleaned_data.get("entraineur")
            if nouvel_entraineur:
                ancien_entraineur = getattr(equipe, "entraineur", None)
                if ancien_entraineur and ancien_entraineur.pk != nouvel_entraineur.pk:
                    ancien_entraineur.equipe = None
                    ancien_entraineur.save()
                nouvel_entraineur.equipe = equipe
                nouvel_entraineur.save()

            # Gestion des joueurs affectés
            joueurs_selectionnes = self.cleaned_data.get("joueurs", [])
            pks = set(j.pk for j in joueurs_selectionnes)
            # Retirer l'équipe des joueurs qui ne sont plus cochés
            equipe.joueurs.exclude(pk__in=pks).update(equipe=None)
            # Assigner l'équipe aux joueurs sélectionnés
            Joueur.objects.filter(pk__in=pks).update(equipe=equipe)

        return equipe
