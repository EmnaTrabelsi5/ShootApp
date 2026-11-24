from django.db import models
from django.db.models import Q, F
from datetime import date
from django.core.exceptions import ValidationError
from django.core.validators import (
    MinValueValidator,
    MaxValueValidator,
    MinLengthValidator,
    MaxLengthValidator,
)
def valider_date_future(valeur):
    if valeur < date.today():
        raise ValidationError("La date ne peut pas être dans le passé.")

class Seance(models.Model):
    TYPE_CHOICES = [
        ('REPOS', 'Repos Actif'),
        ('ENTRAINEMENT', 'Entraînement'),
        ('MATCH', 'Match'),
        ('DECRASSAGE', 'Décrassage'),
    ]
    OBJECTIF_CHOICES = [
        ('TACTIQUE', 'Tactique'),
        ('TECHNIQUE', 'Technique'),
        ('PHYSIQUE', 'Physique'),
        ('FINITION', 'Finition'),
        ('RECUPERATION', 'Récupération'),
    ]
    # Objectifs autorisés selon le type de séance (le 1er est celui par défaut)
    OBJECTIFS_PAR_TYPE = {
        'ENTRAINEMENT': ['TACTIQUE', 'TECHNIQUE', 'PHYSIQUE', 'FINITION'],
        'DECRASSAGE': ['RECUPERATION', 'PHYSIQUE'],
        'REPOS': ['RECUPERATION'],
    }
    # RPE proposé par défaut et RPE maximum selon le type
    RPE_PAR_TYPE = {
        'ENTRAINEMENT': {'defaut': 7, 'max': 10},
        'DECRASSAGE': {'defaut': 3, 'max': 5},
        'REPOS': {'defaut': 2, 'max': 4},
    }

    date = models.DateField(validators=[valider_date_future])
    heure_debut = models.TimeField(blank=True, null=True)
    heure_fin = models.TimeField(blank=True, null=True)

    type_seance = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default='ENTRAINEMENT',
    )
    objectif = models.CharField(
        max_length=15,
        choices=OBJECTIF_CHOICES,
        default='TACTIQUE',
        verbose_name="Objectif de la séance",
    )
    titre = models.CharField(
        max_length=150,
        validators=[MinLengthValidator(3, "Le titre doit contenir au moins 3 caractères.")],
    )
    description = models.TextField(
        blank=True,
        validators=[MaxLengthValidator(2000, "La description ne doit pas dépasser 2000 caractères.")],
    )

    rpe = models.FloatField(
        default=7.0,
        validators=[
            MinValueValidator(1, "Le RPE doit être au minimum 1."),
            MaxValueValidator(10, "Le RPE doit être au maximum 10."),
        ],
    )
    nb_joueurs = models.PositiveIntegerField(
        default=20,
        validators=[
            MinValueValidator(1, "Il faut au moins 1 joueur."),
            MaxValueValidator(50, "Maximum 50 joueurs."),
        ],
    )
    terrain = models.CharField(max_length=50, blank=True, default="Honneur")
    # Identifiants des joueurs convoqués (les joueurs viennent du module Joueurs, cf. training/joueurs.py)
    joueurs_ids = models.JSONField(default=list, blank=True, verbose_name="Joueurs convoqués")
    # Identifiants des exercices 3D choisis (bibliothèque dans training/exercices.py)
    exercices = models.JSONField(default=list, blank=True, verbose_name="Exercices 3D")
    # Matériel préparé : {"ballon": 12, "plot": 20, ...} (catalogue dans training/materiel.py)
    materiel = models.JSONField(default=dict, blank=True, verbose_name="Matériel")

    class Meta:
        ordering = ['-date', 'heure_debut']
        verbose_name = "Séance"
        verbose_name_plural = "Séances"
        constraints = [
            models.CheckConstraint(
                condition=Q(rpe__gte=1) & Q(rpe__lte=10),
                name="seance_rpe_entre_1_et_10",
            ),
            models.CheckConstraint(
                condition=Q(nb_joueurs__gte=1) & Q(nb_joueurs__lte=50),
                name="seance_nb_joueurs_valide",
            ),
            models.CheckConstraint(
                condition=(
                    Q(heure_debut__isnull=True)
                    | Q(heure_fin__isnull=True)
                    | Q(heure_fin__gt=F("heure_debut"))
                ),
                name="seance_fin_apres_debut",
            ),
        ]

    def clean(self):
        # Si on met une heure, il faut mettre les deux
        if self.heure_debut and not self.heure_fin:
            raise ValidationError({'heure_fin': "Indique aussi l'heure de fin."})
        if self.heure_fin and not self.heure_debut:
            raise ValidationError({'heure_debut': "Indique aussi l'heure de début."})

        # L'heure de fin doit être après l'heure de début
        if self.heure_debut and self.heure_fin and self.heure_fin <= self.heure_debut:
            raise ValidationError({'heure_fin': "L'heure de fin doit être après l'heure de début."})
        if self.type_seance == 'REPOS' and self.rpe == 7.0:
            self.rpe = 2.0

        # Un jour de repos a une intensité faible
        if self.type_seance == 'REPOS' and self.rpe > 4:
            raise ValidationError({'rpe': "Pour un repos actif, le RPE ne doit pas dépasser 4."})

        # Nettoyage simple du texte
        if self.titre:
            self.titre = self.titre.strip()
        if self.terrain:
            self.terrain = self.terrain.strip()

    def save(self, *args, **kwargs):
        self.full_clean()  # lance les validations même hors formulaire
        super().save(*args, **kwargs)

    def duree_minutes(self):
        """Durée de la séance en minutes (ou None)."""
        if self.heure_debut and self.heure_fin:
            debut = self.heure_debut.hour * 60 + self.heure_debut.minute
            fin = self.heure_fin.hour * 60 + self.heure_fin.minute
            return fin - debut
        return None

    def __str__(self):
        return f"{self.date} - {self.titre}"
class TableauTactique(models.Model):
    """Positions des joueurs et repères du tableau tactique (glisser-déposer).

    positions = {"p1": [6, 50], "tag": [30, 12], ...}  (pourcentages left / top du terrain)
    """
    nom = models.CharField(max_length=50, unique=True, default="defaut")
    positions = models.JSONField(default=dict, blank=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tableau tactique"
        verbose_name_plural = "Tableaux tactiques"

    def __str__(self):
        return f"Tableau {self.nom}"


class Atelier(models.Model):
    # Lien avec la séance : si la séance est supprimée, ses ateliers le sont aussi
    seance = models.ForeignKey(
        Seance,
        on_delete=models.CASCADE,
        related_name='ateliers',
        verbose_name="Séance associée",
    )

    # Numéro d'ordre : 1, 2, 3, 4...
    numero = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1, "Le numéro doit être au moins 1.")],
        verbose_name="Numéro de l'atelier",
    )

    # Titre de l'atelier (ex: "Rondo de Conservation 4v4+3")
    titre = models.CharField(
        max_length=150,
        validators=[MinLengthValidator(3, "Le titre doit contenir au moins 3 caractères.")],
        verbose_name="Titre de l'atelier",
    )

    # Description (ex: "Espace réduit (20x20m), 2 touches max")
    description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Description / Consignes",
    )

    # Durée en minutes (ex: 15, 25, 35)
    duree_minutes = models.PositiveIntegerField(
        default=15,
        validators=[
            MinValueValidator(1, "La durée minimale est de 1 minute."),
            MaxValueValidator(180, "Un atelier ne peut pas dépasser 180 minutes."),
        ],
        verbose_name="Durée (minutes)",
    )

    # Matériel nécessaire (ex: "24 Ballons, 30 Coupelles, 12 Chasubles")
    materiel = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Matériel préparé",
    )

    class Meta:
        ordering = ['seance', 'numero']
        verbose_name = "Atelier"
        verbose_name_plural = "Ateliers"
        constraints = [
            # Pas deux ateliers avec le même numéro dans une même séance
            models.UniqueConstraint(
                fields=['seance', 'numero'],
                name='unique_numero_par_seance',
            ),
            # Sécurité en base : numéro au moins 1
            models.CheckConstraint(
                condition=Q(numero__gte=1),
                name='atelier_numero_min_1',
            ),
            # Sécurité en base : durée entre 1 et 180 minutes
            models.CheckConstraint(
                condition=Q(duree_minutes__gte=1) & Q(duree_minutes__lte=180),
                name='atelier_duree_entre_1_et_180',
            ),
        ]

    def clean(self):
        # Nettoyage simple du texte
        if self.titre:
            self.titre = self.titre.strip()
        if self.description:
            self.description = self.description.strip()
        if self.materiel:
            self.materiel = self.materiel.strip()

        # Le total des ateliers ne doit pas dépasser la durée de la séance
        if self.seance_id and self.duree_minutes:
            duree_seance = self.seance.duree_minutes()
            if duree_seance:
                autres = self.seance.ateliers.exclude(pk=self.pk)
                total = sum(a.duree_minutes for a in autres) + self.duree_minutes
                if total > duree_seance:
                    raise ValidationError({
                        'duree_minutes': (
                            f"Le total des ateliers ({total} min) dépasse "
                            f"la durée de la séance ({duree_seance} min)."
                        )
                    })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.seance.titre}] Atelier {self.numero} : {self.titre} ({self.duree_minutes} min)"