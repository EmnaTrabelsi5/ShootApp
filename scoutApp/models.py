from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from utilisateurApp.models import Utilisateur

NOTE_VALIDATORS = [MinValueValidator(0), MaxValueValidator(10)]


class Scout(Utilisateur):
    type = models.CharField(max_length=50, blank=True)
    specialite_scout = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = "scout"

    def save(self, *args, **kwargs):
        self.role = Utilisateur.Role.SCOUT
        super().save(*args, **kwargs)


class RapportScouting(models.Model):
    # Scout 1 --rédige-- 0..* RapportScouting
    scout = models.ForeignKey(Scout, on_delete=models.CASCADE, related_name="rapports")
    # Joueur 1 --est évalué dans-- 0..* RapportScouting
    joueur = models.ForeignKey(
        "joueurApp.Joueur", on_delete=models.CASCADE, related_name="rapports_scouting"
    )
    date_rapport = models.DateField(auto_now_add=True)
    evaluation_technique = models.FloatField(validators=NOTE_VALIDATORS)
    evaluation_physique = models.FloatField(validators=NOTE_VALIDATORS)
    evaluation_tactique = models.FloatField(validators=NOTE_VALIDATORS)
    evaluation_mentale = models.FloatField(validators=NOTE_VALIDATORS)
    observations = models.TextField(blank=True)

    class Meta:
        verbose_name = "rapport de scouting"
        verbose_name_plural = "rapports de scouting"
        ordering = ["-date_rapport"]

    def __str__(self):
        return f"Rapport {self.scout} sur {self.joueur} ({self.date_rapport})"


class Recommandation(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "EN_ATTENTE", "En attente"
        ACCEPTEE = "ACCEPTEE", "Acceptée"
        REJETEE = "REJETEE", "Rejetée"

    # Joueur 1 --fait l'objet de-- 0..* Recommandation
    joueur = models.ForeignKey(
        "joueurApp.Joueur", on_delete=models.CASCADE, related_name="recommandations"
    )
    score_compatibilite = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    justification = models.TextField(blank=True)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "recommandation"
        ordering = ["-score_compatibilite"]

    def __str__(self):
        return f"Recommandation {self.joueur} ({self.score_compatibilite})"
