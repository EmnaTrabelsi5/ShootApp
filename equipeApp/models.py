from django.db import models


class Equipe(models.Model):
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

    class Meta:
        verbose_name = "équipe"
        ordering = ["nom"]

    def __str__(self):
        return self.nom
