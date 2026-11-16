from datetime import date

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from utilisateurApp.models import Utilisateur


class Joueur(Utilisateur):
    """Hérite de Utilisateur (nom, prenom, date_naissance... déjà présents)."""

    class Poste(models.TextChoices):
        GARDIEN = "GB", "Gardien"
        DEFENSEUR = "DEF", "Défenseur"
        MILIEU = "MIL", "Milieu"
        ATTAQUANT = "ATT", "Attaquant"

    class PiedFort(models.TextChoices):
        DROIT = "DROIT", "Droit"
        GAUCHE = "GAUCHE", "Gauche"
        AMBIDEXTRE = "AMBI", "Ambidextre"

    nationalite = models.CharField(max_length=60, blank=True)
    poste = models.CharField(max_length=3, choices=Poste.choices)
    pied_fort = models.CharField(max_length=6, choices=PiedFort.choices, blank=True)
    taille_cm = models.PositiveSmallIntegerField(null=True, blank=True)
    poids_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    numero_maillot = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(99)]
    )
    # Joueur 1..1 --avoir-- 1..N Equipe
    equipe = models.ForeignKey(
        "equipeApp.Equipe",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="joueurs",
    )

    class Meta:
        verbose_name = "joueur"
        constraints = [
            models.UniqueConstraint(
                fields=["equipe", "numero_maillot"], name="numero_maillot_unique_par_equipe"
            )
        ]

    def save(self, *args, **kwargs):
        self.role = Utilisateur.Role.JOUEUR
        super().save(*args, **kwargs)

    @property
    def age(self):
        """L'âge est calculé depuis date_naissance plutôt que stocké."""
        if not self.date_naissance:
            return None
        today = date.today()
        d = self.date_naissance
        return today.year - d.year - ((today.month, today.day) < (d.month, d.day))


class Performance(models.Model):
    # Joueur 1 --avoir-- 0..N Performance
    joueur = models.ForeignKey(Joueur, on_delete=models.CASCADE, related_name="performances")
    match = models.ForeignKey(
        "competitionApp.Match",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="performances",
    )
    titulaire = models.BooleanField(default=False)
    minutes_jouees = models.PositiveSmallIntegerField(default=0)
    buts = models.PositiveSmallIntegerField(default=0)
    passes_decisives = models.PositiveSmallIntegerField(default=0)
    tirs = models.PositiveSmallIntegerField(default=0)
    cartons_jaunes = models.PositiveSmallIntegerField(default=0)
    cartons_rouges = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "performance"

    def __str__(self):
        return f"Performance de {self.joueur} ({self.match or 'hors match'})"
