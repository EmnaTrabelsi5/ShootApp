from django.db import models

from .outils import normalize_text, validate_not_future, validate_url_scheme


class Equipe(models.Model):
    # Attributs d'origine (utilisés par les modules Joueurs, Entraîneurs et Matchs : ne pas renommer)
    nom = models.CharField(max_length=100, unique=True)
    ville = models.CharField(max_length=100)
    niveau = models.CharField(max_length=50, blank=True)
    logo = models.ImageField(upload_to="equipes/logos/", null=True, blank=True)
    date_creation = models.DateField(null=True, blank=True)
    president = models.ForeignKey(
        "presidentApp.President",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="equipes",
    )

    # Module Équipes (CRUD) : attributs ajoutés
    pays = models.CharField(max_length=100, blank=True)
    description = models.TextField(max_length=500, blank=True)
    site_web = models.URLField(blank=True, validators=[validate_url_scheme])
    # Équipe 1 --> 0..* Staff   et   Scout --> Équipe 1..n (consultation « mon équipe »)
    staff = models.ManyToManyField("staffApp.Staff", blank=True, related_name="equipes")
    scouts = models.ManyToManyField("scoutApp.Scout", blank=True, related_name="equipes")
    # Champ technique : nom sans accents ni majuscules, pour la recherche dynamique
    nom_recherche = models.CharField(max_length=120, editable=False, default="", db_index=True)

    class Meta:
        verbose_name = "équipe"
        ordering = ["nom"]

    def save(self, *args, **kwargs):
        self.nom_recherche = normalize_text(self.nom)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nom

    @property
    def initiales(self):
        return (self.nom or "?")[:2].upper()
