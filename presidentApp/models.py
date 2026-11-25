from django.db import models

from equipeApp.outils import normalize_text
from utilisateurApp.models import Utilisateur


class President(Utilisateur):
    # id_president -> "utilisateur_ptr" (héritage multi-table)
    # nom, prenom, email, mot de passe (hashé), telephone, photo, date_naissance
    # et « actif » (is_active) viennent de Utilisateur.
    nationalite = models.CharField(max_length=60, blank=True)
    date_debut_presidence = models.DateField(null=True, blank=True)
    # Champ technique : « nom prénom » sans accents ni majuscules (recherche dynamique)
    nom_recherche = models.CharField(max_length=70, editable=False, default="", db_index=True)

    class Meta:
        verbose_name = "président"

    def save(self, *args, **kwargs):
        self.role = Utilisateur.Role.PRESIDENT
        self.nom_recherche = normalize_text(f"{self.nom} {self.prenom}")
        super().save(*args, **kwargs)

    @property
    def nom_complet(self):
        return f"{self.prenom} {self.nom}"

    @property
    def initiales(self):
        return f"{(self.prenom or '')[:1]}{(self.nom or '')[:1]}".upper() or "PR"

    @property
    def duree_presidence(self):
        """Calcule la durée de présidence par rapport à aujourd'hui."""
        if not self.date_debut_presidence:
            return "Non renseignée"
        from datetime import date
        today = date.today()
        debut = self.date_debut_presidence
        if debut > today:
            return "À venir"
        annees = today.year - debut.year
        mois = today.month - debut.month
        jours = today.day - debut.day
        if jours < 0:
            mois -= 1
        if mois < 0:
            annees -= 1
            mois += 12
        parties = []
        if annees > 0:
            parties.append(f"{annees} an{'s' if annees > 1 else ''}")
        if mois > 0:
            parties.append(f"{mois} mois")
        if not parties:
            jours_totaux = (today - debut).days
            if jours_totaux > 0:
                parties.append(f"{jours_totaux} jour{'s' if jours_totaux > 1 else ''}")
            else:
                return "Moins d'un mois"
        return " et ".join(parties)
