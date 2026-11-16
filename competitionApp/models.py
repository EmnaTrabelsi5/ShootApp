from django.conf import settings
from django.db import models


class Competition(models.Model):
    nom = models.CharField(max_length=150)
    type = models.CharField(max_length=50, help_text="ex : championnat, coupe, amical")
    date_debut = models.DateField()
    date_fin = models.DateField()
    description = models.TextField(blank=True)
    # Equipe 1..N --participer-- 1..N Competition
    equipes = models.ManyToManyField("equipeApp.Equipe", related_name="competitions", blank=True)

    class Meta:
        verbose_name = "compétition"
        ordering = ["-date_debut"]

    def __str__(self):
        return self.nom


class Match(models.Model):
    class Statut(models.TextChoices):
        PROGRAMME = "PROGRAMME", "Programmé"
        EN_COURS = "EN_COURS", "En cours"
        TERMINE = "TERMINE", "Terminé"
        REPORTE = "REPORTE", "Reporté"
        ANNULE = "ANNULE", "Annulé"

    # Competition --organiser-- 1..1 Match
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name="matchs")
    # Equipe 0..N --jouer-- 2..2 Match
    equipe_domicile = models.ForeignKey(
        "equipeApp.Equipe", on_delete=models.PROTECT, related_name="matchs_domicile"
    )
    equipe_exterieur = models.ForeignKey(
        "equipeApp.Equipe", on_delete=models.PROTECT, related_name="matchs_exterieur"
    )
    date_heure = models.DateTimeField()
    lieu = models.CharField(max_length=150, blank=True)
    score_domicile = models.PositiveSmallIntegerField(null=True, blank=True)
    score_exterieur = models.PositiveSmallIntegerField(null=True, blank=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.PROGRAMME)
    valide_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matchs_valides",
    )

    class Meta:
        verbose_name = "match"
        verbose_name_plural = "matchs"
        ordering = ["-date_heure"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(equipe_domicile=models.F("equipe_exterieur")),
                name="match_equipes_differentes",
            )
        ]

    def __str__(self):
        return f"{self.equipe_domicile} vs {self.equipe_exterieur} ({self.date_heure:%d/%m/%Y})"


class EvenementMatch(models.Model):
    class TypeEvenement(models.TextChoices):
        BUT = "BUT", "But"
        CARTON_JAUNE = "CJ", "Carton jaune"
        CARTON_ROUGE = "CR", "Carton rouge"
        REMPLACEMENT = "REMP", "Remplacement"
        PENALTY = "PEN", "Penalty"
        AUTRE = "AUTRE", "Autre"

    # Match 0..N --se derouler-- Evenement_Match
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="evenements")
    equipe = models.ForeignKey("equipeApp.Equipe", on_delete=models.CASCADE, related_name="evenements")
    joueur = models.ForeignKey(
        "joueurApp.Joueur", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="evenements",
    )
    joueur_entrant = models.ForeignKey(
        "joueurApp.Joueur", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="entrees_en_jeu", help_text="Uniquement pour un remplacement",
    )
    type_evenement = models.CharField(max_length=10, choices=TypeEvenement.choices)
    minute = models.PositiveSmallIntegerField()
    minute_additionnelle = models.PositiveSmallIntegerField(default=0)
    description = models.TextField(blank=True)
    date_enregistrement = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "événement de match"
        verbose_name_plural = "événements de match"
        ordering = ["match", "minute", "minute_additionnelle"]

    def __str__(self):
        return f"{self.get_type_evenement_display()} {self.minute}' - {self.match}"
