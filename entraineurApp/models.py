from django.db import models
from django.utils import timezone

from utilisateurApp.models import Utilisateur


class Entraineur(Utilisateur):
    class TypeEntraineur(models.TextChoices):
        PRINCIPAL = "PRINCIPAL", "Principal"
        ADJOINT = "ADJOINT", "Adjoint"
        PREPARATEUR_PHYSIQUE = "PREPARATEUR_PHYSIQUE", "Préparateur Physique"
        GARDIENS = "GARDIENS", "Entraîneur des Gardiens"
        FORMATION = "FORMATION", "Formation / Jeunes"
        ANALYSTE = "ANALYSTE", "Analyste Vidéo & Données"
        PERFORMANCE = "PERFORMANCE", "Responsable Performance"
        SPECIFIQUE = "SPECIFIQUE", "Spécifique"

    class Fonction(models.TextChoices):
        PRINCIPAL = "PRINCIPAL", "Principal"
        ADJOINT = "ADJOINT", "Adjoint"
        RESPONSABLE_TECHNIQUE = "RESPONSABLE_TECHNIQUE", "Responsable Technique"
        COORDINATEUR = "COORDINATEUR", "Coordinateur"
        PREPARATEUR = "PREPARATEUR", "Préparateur"
        ASSISTANT_STAGIAIRE = "ASSISTANT_STAGIAIRE", "Assistant / Stagiaire"

    class Specialite(models.TextChoices):
        TACTIQUE = "TACTIQUE", "Tactique & Stratégie"
        PREPARATION_PHYSIQUE = "PREPARATION_PHYSIQUE", "Préparation Physique & Athlétique"
        GARDIENS = "GARDIENS", "Gardiens"
        DEVELOPPEMENT_TECHNIQUE = "DEVELOPPEMENT_TECHNIQUE", "Développement Technique individuel"
        ANALYSE_VIDEO = "ANALYSE_VIDEO", "Analyse Vidéo & Data"
        PREPARATION_MENTALE = "PREPARATION_MENTALE", "Préparation Mentale"
        REATHLETISATION = "REATHLETISATION", "Réathlétisation & Prévention"
        COUPS_DE_PIED_ARRETES = "COUPS_DE_PIED_ARRETES", "Coups de pied arrêtés"
        POLYVALENT = "POLYVALENT", "Polyvalent"

    type = models.CharField(
        max_length=50,
        choices=TypeEntraineur.choices,
        blank=True,
    )
    specialite = models.CharField(
        max_length=100,
        choices=Specialite.choices,
        blank=True,
    )
    fonction = models.CharField(
        max_length=50,
        choices=Fonction.choices,
        blank=True,
        help_text="ex : principal, adjoint",
    )
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

    @property
    def initiales(self):
        p = (self.prenom or "")[:1].upper()
        n = (self.nom or "")[:1].upper()
        return f"{p}{n}" or "CO"

    @property
    def age(self):
        if not self.date_naissance:
            return None
        today = timezone.localdate()
        dob = self.date_naissance
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


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


class Composition(models.Model):
    class Dispositif(models.TextChoices):
        D_433 = "4-3-3", "4-3-3 Attaque"
        D_442 = "4-4-2", "4-4-2 Équilibré"
        D_4231 = "4-2-3-1", "4-2-3-1 Moderne"
        D_352 = "3-5-2", "3-5-2 Pistons"
        D_532 = "5-3-2", "5-3-2 Bloc Bas"
        D_343 = "3-4-3", "3-4-3 Largeur"

    nom = models.CharField(max_length=120, default="Feuille de Match Principale")
    equipe = models.ForeignKey(
        "equipeApp.Equipe", on_delete=models.CASCADE, related_name="compositions"
    )
    entraineur = models.ForeignKey(
        Entraineur, on_delete=models.CASCADE, related_name="compositions"
    )
    dispositif = models.CharField(
        max_length=20, choices=Dispositif.choices, default=Dispositif.D_433
    )
    match = models.ForeignKey(
        "competitionApp.Match",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compositions",
    )
    capitaine = models.ForeignKey(
        "joueurApp.Joueur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compositions_capitaine",
    )
    tireur_penalty = models.ForeignKey(
        "joueurApp.Joueur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compositions_penalty",
    )
    tireur_coup_franc = models.ForeignKey(
        "joueurApp.Joueur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compositions_coup_franc",
    )
    notes_tactiques = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_mise_a_jour = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "composition d'équipe"
        verbose_name_plural = "compositions d'équipe"
        ordering = ["-date_mise_a_jour"]

    def __str__(self):
        return f"{self.nom} ({self.equipe.nom} - {self.dispositif})"

    @property
    def titulaires(self):
        return self.joueurs_compo.filter(est_titulaire=True).select_related("joueur").order_by("slot_index")

    @property
    def remplacants(self):
        return self.joueurs_compo.filter(est_titulaire=False).select_related("joueur").order_by("slot_index")


class JoueurComposition(models.Model):
    composition = models.ForeignKey(
        Composition, on_delete=models.CASCADE, related_name="joueurs_compo"
    )
    joueur = models.ForeignKey(
        "joueurApp.Joueur", on_delete=models.CASCADE, related_name="lignes_composition"
    )
    est_titulaire = models.BooleanField(default=True)
    slot_index = models.PositiveSmallIntegerField(default=1, help_text="1 à 11 pour titulaires, 1+ pour remplaçants")
    poste_tactique = models.CharField(max_length=10, blank=True)
    position_x = models.FloatField(default=50.0, help_text="Position X en % (0-100)")
    position_y = models.FloatField(default=50.0, help_text="Position Y en % (0-100)")

    class Meta:
        verbose_name = "joueur en composition"
        verbose_name_plural = "joueurs en composition"
        ordering = ["est_titulaire", "slot_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["composition", "joueur"], name="joueur_unique_par_composition"
            )
        ]

    def __str__(self):
        role = "Titulaire" if self.est_titulaire else "Remplaçant"
        return f"{self.joueur} ({role} - {self.poste_tactique})"
