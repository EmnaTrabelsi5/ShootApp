from utilisateurApp.models import Utilisateur


class Staff(Utilisateur):
    # id_staff -> "utilisateur_ptr" (héritage multi-table)
    # Attributs et fonctionnalités à compléter

    class Meta:
        verbose_name = "staff"
        verbose_name_plural = "staff"

    def save(self, *args, **kwargs):
        self.role = Utilisateur.Role.STAFF
        super().save(*args, **kwargs)
