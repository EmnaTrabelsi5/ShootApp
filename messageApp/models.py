from django.conf import settings
from django.db import models


class Message(models.Model):
    class Statut(models.TextChoices):
        ENVOYE = "ENVOYE", "Envoyé"
        LU = "LU", "Lu"

    envoyeur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages_envoyes"
    )
    recepteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages_recus"
    )
    contenu = models.TextField()
    date_envoi = models.DateTimeField(auto_now_add=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.ENVOYE)

    class Meta:
        verbose_name = "message"
        ordering = ["-date_envoi"]

    def __str__(self):
        return f"{self.envoyeur} -> {self.recepteur} ({self.date_envoi:%d/%m/%Y %H:%M})"
