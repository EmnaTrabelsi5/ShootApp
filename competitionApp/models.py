from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.urls import reverse
from django.utils import timezone


class Competition(models.Model):
    nom = models.CharField(max_length=150)
    type = models.CharField(max_length=50, help_text="ex : championnat, coupe, amical")
    date_debut = models.DateField()
    date_fin = models.DateField()
    description = models.TextField(blank=True)
    photo = models.ImageField(upload_to="competitions/", null=True, blank=True, verbose_name="Photo")
    # Equipe 1..N --participer-- 1..N Competition
    equipes = models.ManyToManyField("equipeApp.Equipe", related_name="competitions", blank=True)

    class Meta:
        verbose_name = "compétition"
        ordering = ["-date_debut"]

    def __str__(self):
        return self.nom

    def get_absolute_url(self):
        # Utilisée par CreateView / UpdateView pour rediriger après l'enregistrement
        return reverse("competitionApp:competition_detail", args=[self.pk])

    def clean(self):
        """Règle métier : la date de fin ne peut pas être avant la date de début."""
        if self.date_debut and self.date_fin and self.date_fin < self.date_debut:
            raise ValidationError(
                {"date_fin": "La date de fin doit être après la date de début (ou le même jour)."}
            )


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

    def get_absolute_url(self):
        return reverse("competitionApp:match_detail", args=[self.pk])

    @property
    def est_valide(self):
        """Un match est validé quand un utilisateur a validé son résultat final."""
        return self.valide_par_id is not None

    @property
    def accepte_evenements(self):
        """On enregistre des événements seulement pendant ou après le match, avant la validation."""
        return (
            self.statut in [self.Statut.EN_COURS, self.Statut.TERMINE]
            and not self.est_valide
        )

    def clean(self):
        """Règles métier vérifiées avant chaque création / modification d'un match."""
        erreurs = {}

        # On travaille avec les "_id" : si un champ n'a pas été choisi dans le
        # formulaire, accéder à self.competition provoquerait une erreur.
        if not (self.competition_id and self.equipe_domicile_id and self.equipe_exterieur_id):
            return

        # Règle 1 : les deux équipes doivent être différentes
        if self.equipe_domicile_id == self.equipe_exterieur_id:
            raise ValidationError(
                {"equipe_exterieur": "L'équipe extérieure doit être différente de l'équipe à domicile."}
            )

        # Règle 2 : les deux équipes doivent participer à la compétition
        equipes_competition = self.competition.equipes.all()
        if self.equipe_domicile not in equipes_competition:
            erreurs["equipe_domicile"] = (
                f"L'équipe {self.equipe_domicile} ne participe pas à la compétition {self.competition}."
            )
        if self.equipe_exterieur not in equipes_competition:
            erreurs["equipe_exterieur"] = (
                f"L'équipe {self.equipe_exterieur} ne participe pas à la compétition {self.competition}."
            )

        if self.date_heure:
            # La date est stockée en UTC : on la convertit à l'heure locale (Africa/Tunis)
            jour = timezone.localtime(self.date_heure).date()

            # Règle 3 : la date doit être comprise dans la période de la compétition
            if not (self.competition.date_debut <= jour <= self.competition.date_fin):
                erreurs["date_heure"] = (
                    f"La date doit être entre le {self.competition.date_debut:%d/%m/%Y} "
                    f"et le {self.competition.date_fin:%d/%m/%Y} (période de la compétition)."
                )

            # Règle 4 : une équipe ne peut pas jouer deux matchs le même jour
            matchs_du_jour = (
                Match.objects.filter(date_heure__date=jour)
                .exclude(pk=self.pk)  # en modification, on ignore le match lui-même
                .exclude(statut=Match.Statut.ANNULE)
            )
            for equipe in [self.equipe_domicile, self.equipe_exterieur]:
                conflit = matchs_du_jour.filter(
                    models.Q(equipe_domicile=equipe) | models.Q(equipe_exterieur=equipe)
                ).exists()
                if conflit:
                    erreurs.setdefault(
                        "date_heure",
                        f"L'équipe {equipe} a déjà un match prévu le {jour:%d/%m/%Y}.",
                    )

        if erreurs:
            raise ValidationError(erreurs)


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

    def clean(self):
        """Règles métier vérifiées avant chaque création / modification d'un événement."""
        erreurs = {}

        # Le match est choisi par la vue (pas par le formulaire)
        if not self.match_id:
            return

        # Règle 1 : le match doit être en cours ou terminé, et pas encore validé
        if not self.match.accepte_evenements:
            # Erreur générale (sans champ) car "match" n'est pas dans le formulaire
            raise ValidationError(
                "On ne peut enregistrer un événement que pour un match « En cours » "
                "ou « Terminé » dont le résultat n'est pas encore validé."
            )

        # Règle 2 : la minute doit être entre 0 et 120
        if self.minute is not None and self.minute > 120:
            erreurs["minute"] = "La minute doit être comprise entre 0 et 120."

        if self.equipe_id:
            # Règle 3 : l'équipe doit être l'une des deux équipes du match
            if self.equipe_id not in [self.match.equipe_domicile_id, self.match.equipe_exterieur_id]:
                erreurs["equipe"] = "Cette équipe ne joue pas ce match."

            # Règle 4 : le joueur doit appartenir à l'équipe choisie
            if self.joueur_id and self.joueur.equipe_id != self.equipe_id:
                erreurs["joueur"] = f"{self.joueur} ne fait pas partie de l'équipe {self.equipe}."

        # Règle 5 : un joueur est obligatoire, sauf pour le type « Autre »
        if not self.joueur_id and self.type_evenement != self.TypeEvenement.AUTRE:
            erreurs.setdefault("joueur", "Choisissez le joueur concerné par cet événement.")

        # Règle 6 : le joueur entrant concerne uniquement les remplacements
        if self.type_evenement == self.TypeEvenement.REMPLACEMENT:
            if not self.joueur_entrant_id:
                erreurs["joueur_entrant"] = "Un remplacement nécessite un joueur entrant."
            elif self.joueur_entrant_id == self.joueur_id:
                erreurs["joueur_entrant"] = "Le joueur entrant doit être différent du joueur sortant."
            elif self.equipe_id and self.joueur_entrant.equipe_id != self.equipe_id:
                erreurs["joueur_entrant"] = (
                    f"{self.joueur_entrant} ne fait pas partie de l'équipe {self.equipe}."
                )
        elif self.joueur_entrant_id:
            erreurs["joueur_entrant"] = "Le joueur entrant est réservé aux remplacements."

        if erreurs:
            raise ValidationError(erreurs)
