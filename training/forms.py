from django import forms

from .matchs import match_le
from .joueurs import get_joueurs
from .models import Seance
from .exercices import EXERCICES, PAR_ID
from . import materiel as catalogue
import json
import re
from datetime import date, timedelta

from . import regles as R


class SeanceForm(forms.ModelForm):
    # Joueurs convoqués : identifiants venant du module Joueurs (training/joueurs.py)
    joueurs = forms.MultipleChoiceField(required=False, label="Joueurs convoqués")
    # Exercices 3D : identifiants de la bibliothèque (training/exercices.py)
    exercices = forms.MultipleChoiceField(required=False, label="Exercices",
                                          choices=[(e["id"], e["nom"]) for e in EXERCICES])
    # Matériel : JSON {"ballon": 12, ...} envoyé par le sélecteur 3D
    materiel = forms.CharField(required=False, widget=forms.HiddenInput)

    class Meta:
        model = Seance
        fields = ["type_seance", "objectif", "titre", "date", "heure_debut", "heure_fin",
                  "description", "rpe", "terrain"]
        widgets = {
            "date": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "heure_debut": forms.TimeInput(attrs={"type": "time"}, format="%H:%M"),
            "heure_fin": forms.TimeInput(attrs={"type": "time"}, format="%H:%M"),
            "description": forms.Textarea(attrs={"rows": 3, "placeholder": "Consignes, contenu, points clés…"}),
            "titre": forms.TextInput(attrs={"placeholder": "Ex : Pressing haut & transitions"}),
            "rpe": forms.NumberInput(attrs={"min": 1, "max": 10, "step": 0.5}),
            "nb_joueurs": forms.NumberInput(attrs={"min": 1, "max": 50}),
            "terrain": forms.TextInput(attrs={"placeholder": "Honneur, Synth. T2…"}),
        }
        labels = {
            "type_seance": "Type de séance",
            "objectif": "Objectif de la séance",
            "titre": "Titre",
            "date": "Date",
            "heure_debut": "Début",
            "heure_fin": "Fin",
            "description": "Description",
            "rpe": "RPE prévu (1-10)",
            "nb_joueurs": "Joueurs convoqués",
            "terrain": "Terrain",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["joueurs"].choices = [(str(j.id), f"#{j.numero} {j.prenom} {j.nom}") for j in get_joueurs()]
        if self.instance.pk and not self.is_bound:
            self.initial["joueurs"] = [str(i) for i in self.instance.joueurs_ids or []]
            self.initial["exercices"] = list(self.instance.exercices or [])
            self.initial["materiel"] = json.dumps(self.instance.materiel or {})
        # Les matchs sont gérés par le module Match : pas de type "Match" ici
        self.fields["type_seance"].choices = [
            c for c in self.fields["type_seance"].choices if c[0] != "MATCH"
        ]

    def clean_joueurs(self):
        ids = self.cleaned_data.get("joueurs") or []
        blesses = [j for j in get_joueurs() if str(j.id) in ids and j.statut == "BLESSE"]
        if blesses:
            noms = ", ".join(f"{j.prenom} {j.nom}" for j in blesses)
            raise forms.ValidationError(f"Joueur(s) blessé(s), impossible de les convoquer : {noms}.")
        return ids


    # ------------------------------------------------------------------ champs simples
    def clean_titre(self):
        titre = " ".join((self.cleaned_data.get("titre") or "").split())
        if len(titre) < R.TITRE_MIN:
            raise forms.ValidationError(f"Le titre doit faire au moins {R.TITRE_MIN} caractères.")
        if len(titre) > R.TITRE_MAX:
            raise forms.ValidationError(f"Le titre ne doit pas dépasser {R.TITRE_MAX} caractères.")
        if len(re.findall(r"[A-Za-zÀ-ÿ]", titre)) < 3:
            raise forms.ValidationError("Le titre doit contenir au moins 3 lettres (pas seulement des chiffres ou symboles).")
        return titre

    def clean_terrain(self):
        terrain = " ".join((self.cleaned_data.get("terrain") or "").split())
        if not terrain:
            raise forms.ValidationError("Indique le terrain.")
        if not (R.TERRAIN_MIN <= len(terrain) <= R.TERRAIN_MAX):
            raise forms.ValidationError(f"Le terrain doit faire entre {R.TERRAIN_MIN} et {R.TERRAIN_MAX} caractères.")
        return terrain

    def clean_description(self):
        desc = (self.cleaned_data.get("description") or "").strip()
        if len(desc) > R.DESCRIPTION_MAX:
            raise forms.ValidationError(f"Description trop longue ({len(desc)}/{R.DESCRIPTION_MAX} caractères).")
        return desc

    # ------------------------------------------------------------------ règles croisées
    def _regles_avancees(self, data):
        type_seance, objectif = data.get("type_seance"), data.get("objectif")
        jour, debut, fin = data.get("date"), data.get("heure_debut"), data.get("heure_fin")
        rpe, titre = data.get("rpe"), data.get("titre")
        joueurs = data.get("joueurs") or []
        exos = [PAR_ID[i] for i in data.get("exercices") or [] if i in PAR_ID]
        materiel = data.get("materiel") or {}

        # Date : pas plus d'un an à l'avance
        if jour and jour > date.today() + timedelta(days=R.JOURS_MAX_AVANCE):
            self.add_error("date", "On ne peut pas planifier plus d'un an à l'avance.")

        def err_h(msg):
            # erreur d'horaire affichée sur le bloc Horaire ; on garde les heures pour la suite
            self.add_error("heure_debut", msg)
            data["heure_debut"], data["heure_fin"] = debut, fin

        # Horaires
        duree = None
        if not debut or not fin:
            err_h("Indique l'heure de début et l'heure de fin.")
        else:
            if debut < R.HEURE_MIN or fin > R.HEURE_MAX:
                err_h(f"Les séances se font entre {R.HEURE_MIN:%H:%M} et {R.HEURE_MAX:%H:%M}.")
            duree = (fin.hour * 60 + fin.minute) - (debut.hour * 60 + debut.minute)
            if duree <= 0:
                err_h("L'heure de fin doit être après l'heure de début.")
                duree = None
            elif not (R.DUREE_MIN <= duree <= R.DUREE_MAX):
                err_h(f"Durée de {duree} min : elle doit être entre {R.DUREE_MIN} et {R.DUREE_MAX} min.")

        # Doublons et chevauchements le même jour
        if jour:
            autres = Seance.objects.filter(date=jour).exclude(type_seance="MATCH")
            if self.instance.pk:
                autres = autres.exclude(pk=self.instance.pk)
            if titre and any(a.titre.strip().lower() == titre.lower() for a in autres):
                self.add_error("titre", "Une séance porte déjà ce titre ce jour-là.")
            if debut and fin and duree:
                for a in autres:
                    if a.heure_debut and a.heure_fin and debut < a.heure_fin and a.heure_debut < fin:
                        err_h(f"Chevauche « {a.titre} » ({a.heure_debut:%H:%M}-{a.heure_fin:%H:%M}).")
                        break

        # RPE cohérent avec l'objectif
        lim = R.RPE_OBJECTIF.get(objectif, {})
        if rpe is not None and "max" in lim and rpe > lim["max"]:
            self.add_error("rpe", f"Objectif récupération : RPE maximum {lim['max']}.")
        if rpe is not None and "min" in lim and type_seance == "ENTRAINEMENT" and rpe < lim["min"]:
            self.add_error("rpe", f"Objectif physique : RPE minimum {lim['min']}.")

        # Joueurs
        mini = R.JOUEURS_MIN.get(type_seance, 0)
        if len(joueurs) < mini:
            self.add_error("joueurs", f"Convoque au moins {mini} joueur{'s' if mini > 1 else ''} (actuellement {len(joueurs)}).")
        if len(joueurs) > R.JOUEURS_MAX:
            self.add_error("joueurs", f"Maximum {R.JOUEURS_MAX} joueurs par séance.")

        # Exercices
        if type_seance in R.EXERCICE_OBLIGATOIRE and not exos:
            self.add_error("exercices", "Choisis au moins un exercice pour un entraînement.")
        total = sum(e["duree"] for e in exos)
        if duree and total > duree:
            self.add_error("exercices", f"Les exercices durent {total} min, plus que la séance ({duree} min).")
        trop = [e["nom"] for e in exos if joueurs and e["joueurs"] > len(joueurs)]
        if trop:
            self.add_error("exercices", "Pas assez de joueurs convoqués pour : " + ", ".join(trop) + ".")

        # Matériel nécessaire aux exercices
        manque = []
        for e in exos:
            for cle, qte in e["besoins"].items():
                if materiel.get(cle, 0) < qte:
                    manque.append(f"{qte} {catalogue.PAR_ID[cle]['nom'].lower()} ({e['nom']})")
        if manque:
            self.add_error("materiel", "Matériel insuffisant : " + ", ".join(dict.fromkeys(manque)) + ".")

    def clean(self):
        data = super().clean()
        type_seance, objectif, rpe = data.get("type_seance"), data.get("objectif"), data.get("rpe")
        autorises = Seance.OBJECTIFS_PAR_TYPE.get(type_seance)
        if autorises and objectif and objectif not in autorises:
            noms = dict(Seance.OBJECTIF_CHOICES)
            self.add_error("objectif", "Pour ce type de séance, choisis : "
                           + ", ".join(noms[o] for o in autorises) + ".")
        limites = Seance.RPE_PAR_TYPE.get(type_seance)
        if limites and rpe is not None and rpe > limites["max"]:
            self.add_error("rpe", f"RPE maximum {limites['max']} pour ce type de séance.")
        hors_objectif = [PAR_ID[i]["nom"] for i in data.get("exercices") or []
                         if objectif and PAR_ID[i]["objectif"] != objectif]
        if hors_objectif:
            self.add_error("exercices", "Ces exercices ne correspondent pas à l'objectif choisi : "
                           + ", ".join(hors_objectif) + ".")
        self._regles_avancees(data)
        return data

    def clean_materiel(self):
        brut = self.cleaned_data.get("materiel") or "{}"
        try:
            valeur = json.loads(brut)
        except ValueError:
            raise forms.ValidationError("Matériel invalide.")
        if not isinstance(valeur, dict):
            raise forms.ValidationError("Matériel invalide.")
        propre = {}
        for cle, qte in valeur.items():
            item = catalogue.PAR_ID.get(cle)
            if not item:
                raise forms.ValidationError(f"Matériel inconnu : {cle}.")
            try:
                qte = int(qte)
            except (TypeError, ValueError):
                raise forms.ValidationError(f"Quantité invalide pour {item['nom']}.")
            if qte < 0 or qte > item["max"]:
                raise forms.ValidationError(f"{item['nom']} : entre 1 et {item['max']}.")
            if qte:
                propre[cle] = qte
        return propre

    def clean_date(self):
        jour = self.cleaned_data.get("date")
        if jour:
            match = match_le(jour)
            if match:
                heure = f" à {match.heure.strftime('%H:%M')}" if match.heure else ""
                raise forms.ValidationError(
                    f"Jour de match ({match.adversaire}{heure}) : "
                    "impossible de programmer une séance à cette date."
                )
        return jour

    def save(self, commit=True):
        seance = super().save(commit=False)
        selection = [int(i) for i in self.cleaned_data.get("joueurs") or []]
        seance.joueurs_ids = selection
        seance.exercices = list(self.cleaned_data.get("exercices") or [])
        seance.materiel = self.cleaned_data.get("materiel") or {}
        if selection:
            seance.nb_joueurs = len(selection)   # le nombre suit la sélection
        if commit:
            seance.save()
        return seance
