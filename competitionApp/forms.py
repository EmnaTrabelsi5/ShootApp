from django import forms

from .models import Competition, EvenementMatch, Match


class CompetitionForm(forms.ModelForm):
    class Meta:
        model = Competition
        fields = ["nom", "type", "photo", "date_debut", "date_fin", "equipes", "description"]
        widgets = {
            # type="date" affiche un calendrier dans le navigateur
            "date_debut": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "date_fin": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "equipes": forms.CheckboxSelectMultiple(),
            "description": forms.Textarea(attrs={"rows": 3}),
        }
        # Libellés affichés dans le formulaire (avec les accents)
        labels = {
            "date_debut": "Date de début",
            "date_fin": "Date de fin",
            "equipes": "Équipes participantes",
            "photo": "Photo / Logo de la compétition",
        }


class MatchForm(forms.ModelForm):
    """Formulaire de création : les scores, le statut et valide_par ne sont pas exposés.
    Le statut prend automatiquement la valeur par défaut « Programmé »."""

    class Meta:
        model = Match
        fields = ["competition", "equipe_domicile", "equipe_exterieur", "date_heure", "lieu"]
        widgets = {
            "date_heure": forms.DateTimeInput(
                attrs={"type": "datetime-local"}, format="%Y-%m-%dT%H:%M"
            ),
        }
        labels = {
            "competition": "Compétition",
            "equipe_domicile": "Équipe à domicile",
            "equipe_exterieur": "Équipe extérieure",
            "date_heure": "Date et heure",
        }


class MatchModifierForm(MatchForm):
    """Formulaire de modification : on ajoute le statut (ex : En cours, Reporté, Annulé)."""

    class Meta(MatchForm.Meta):
        fields = MatchForm.Meta.fields + ["statut"]


class EvenementMatchForm(forms.ModelForm):
    """Le match n'est pas dans le formulaire : il est fixé par la vue (depuis l'URL)."""

    class Meta:
        model = EvenementMatch
        fields = [
            "type_evenement", "equipe", "joueur", "joueur_entrant",
            "minute", "minute_additionnelle", "description",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 2}),
        }
        labels = {
            "type_evenement": "Type d'événement",
            "equipe": "Équipe",
            "joueur": "Joueur (sortant pour un remplacement)",
            "joueur_entrant": "Joueur entrant",
            "minute_additionnelle": "Temps additionnel (minutes)",
        }
