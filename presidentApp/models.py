from utilisateurApp.models import Utilisateur


class President(Utilisateur):
    # id_president -> "utilisateur_ptr" (héritage multi-table)
    # Attributs et fonctionnalités à compléter

    class Meta:
        verbose_name = "président"

    def save(self, *args, **kwargs):
        self.role = Utilisateur.Role.PRESIDENT
        super().save(*args, **kwargs)
