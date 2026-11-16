from django.db import models

from utilisateurApp.models import Utilisateur


class Entraineur(Utilisateur):
    type = models.CharField(max_length=50, blank=True)
    specialite = models.CharField(max_length=100, blank=True)
    # "role" existe déjà dans Utilisateur -> renommé pour éviter le conflit
    fonction = models.CharField(max_length=50, blank=True, help_text="ex : principal, adjoint")
    # Entraineur 1..1 --avoir-- 1..1 Equipe
    equipe = models.OneToOneField(
        "equipeApp.Equipe",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entraineur",
    )

    class Meta:
        verbose_name = "entraîneur"

    def save(self, *args, **kwargs):
        self.role = Utilisateur.Role.ENTRAINEUR
        super().save(*args, **kwargs)


class Entrainement(models.Model):
    class Type(models.TextChoices):
        ATTAQUE = "ATTAQUE", "Attaque"
        DEFENSE = "DEFENSE", "Défense"
        PHYSIQUE = "PHYSIQUE", "Physique"

    class Statut(models.TextChoices):
        PLANIFIE = "PLANIFIE", "Planifié"
        TERMINE = "TERMINE", "Terminé"
        ANNULE = "ANNULE", "Annulé"

    # Entraineur --gerer-- 1..N Entrainement
    entraineur = models.ForeignKey(
        Entraineur, on_delete=models.CASCADE, related_name="entrainements"
    )
    titre = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    date = models.DateField()
    heure_debut = models.TimeField()
    heure_fin = models.TimeField()
    lieu = models.CharField(max_length=150, blank=True)
    type = models.CharField(max_length=10, choices=Type.choices)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.PLANIFIE)

    class Meta:
        verbose_name = "entraînement"
        ordering = ["date", "heure_debut"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(heure_fin__gt=models.F("heure_debut")),
                name="entrainement_heure_fin_apres_debut",
            )
        ]

    def __str__(self):
        return f"{self.titre} - {self.date}"
