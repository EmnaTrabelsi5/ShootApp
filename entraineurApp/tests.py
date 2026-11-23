from datetime import date, timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from equipeApp.models import Equipe
from utilisateurApp.models import Utilisateur
from .forms import EntraineurForm
from .models import Entraineur


class EntraineurTests(TestCase):
    def setUp(self):
        # Admin pour tester les vues protégées
        self.admin_user = Utilisateur.objects.create_superuser(
            email="admin@shootapp.tn",
            password="AdminPassword123!",
            nom="Admin",
            prenom="Super",
        )

        # Utilisateur classique non-admin
        self.joueur_user = Utilisateur.objects.create_user(
            email="joueur@shootapp.tn",
            password="PlayerPassword123!",
            nom="Joueur",
            prenom="Simple",
            role=Utilisateur.Role.JOUEUR,
        )

        # Président du club
        self.president_user = Utilisateur.objects.create_user(
            email="president@shootapp.tn",
            password="PresidentPassword123!",
            nom="Ben Salah",
            prenom="Hédi",
            role=Utilisateur.Role.PRESIDENT,
        )

        # Équipes pour tester les affectations
        self.equipe1 = Equipe.objects.create(nom="Espérance Sportive", ville="Tunis")
        self.equipe2 = Equipe.objects.create(nom="Club Africain", ville="Tunis")

        # Entraîneur existant
        self.coach = Entraineur.objects.create(
            email="coach1@shootapp.tn",
            nom="Boumnijel",
            prenom="Ali",
            date_naissance=date(1975, 4, 13),
            type=Entraineur.TypeEntraineur.GARDIENS,
            fonction=Entraineur.Fonction.PREPARATEUR,
            specialite=Entraineur.Specialite.GARDIENS,
            equipe=self.equipe1,
        )
        self.coach.set_password("CoachPassword123!")
        self.coach.save()

    def test_modele_entraineur(self):
        """Vérifie l'assignation automatique du rôle et les propriétés."""
        self.assertEqual(self.coach.role, Utilisateur.Role.ENTRAINEUR)
        self.assertEqual(self.coach.initiales, "AB")
        self.assertGreaterEqual(self.coach.age, 45)
        self.assertEqual(self.coach.equipe, self.equipe1)

    def test_permission_admin_requise(self):
        """Vérifie que les vues sont interdites aux joueurs et accessibles aux admins."""
        url = reverse("entraineur:liste")

        # Anonyme -> redirection connexion
        r = self.client.get(url)
        self.assertEqual(r.status_code, 302)

        # Connecté en joueur -> refusé / redirigé
        self.client.force_login(self.joueur_user)
        r = self.client.get(url)
        self.assertEqual(r.status_code, 302)

        # Connecté en admin -> succès 200
        self.client.force_login(self.admin_user)
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Boumnijel")

    def test_acces_president_dashboard_et_entraineurs(self):
        """Le président a accès au dashboard et à la gestion complète des entraîneurs."""
        self.client.force_login(self.president_user)

        # Dashboard accessible sans 403
        r_dash = self.client.get(reverse("comptes:dashboard"))
        self.assertEqual(r_dash.status_code, 200)

        # Liste des entraîneurs
        r_liste = self.client.get(reverse("entraineur:liste"))
        self.assertEqual(r_liste.status_code, 200)
        self.assertTrue(r_liste.context["peut_gerer"])

        # Page de création
        r_creer = self.client.get(reverse("entraineur:creer"))
        self.assertEqual(r_creer.status_code, 200)

    def test_acces_entraineur_consultation(self):
        """Un entraîneur peut voir ses collègues mais pas créer ni supprimer."""
        self.client.force_login(self.coach)

        # Liste accessible
        r_liste = self.client.get(reverse("entraineur:liste"))
        self.assertEqual(r_liste.status_code, 200)
        self.assertFalse(r_liste.context["peut_gerer"])

        # Fiche accessible
        r_detail = self.client.get(reverse("entraineur:detail", args=[self.coach.pk]))
        self.assertEqual(r_detail.status_code, 200)

        # Tentative de création -> bloqué et redirigé
        r_creer = self.client.get(reverse("entraineur:creer"))
        self.assertEqual(r_creer.status_code, 302)

    def test_recherche_et_filtres(self):
        """Vérifie la recherche multi-critères."""
        self.client.force_login(self.admin_user)
        url = reverse("entraineur:liste")

        # Recherche par nom
        r = self.client.get(url, {"q": "Boumnijel"})
        self.assertEqual(len(r.context["entraineurs"]), 1)

        # Recherche sans résultat
        r = self.client.get(url, {"q": "Inconnu"})
        self.assertEqual(len(r.context["entraineurs"]), 0)

    def test_controle_age_minimum_18_ans(self):
        """Rejet si l'entraîneur a moins de 18 ans."""
        today = timezone.localdate()
        date_mineur = today - timedelta(days=365 * 16)  # 16 ans

        form_data = {
            "prenom": "Jeune",
            "nom": "Coach",
            "email": "jeune@shootapp.tn",
            "date_naissance": date_mineur.isoformat(),
            "type": Entraineur.TypeEntraineur.ADJOINT,
            "fonction": Entraineur.Fonction.ADJOINT,
            "specialite": Entraineur.Specialite.TACTIQUE,
            "password1": "SecurePass123!",
            "password2": "SecurePass123!",
        }
        form = EntraineurForm(data=form_data)
        self.assertFalse(form.is_valid())
        self.assertIn("date_naissance", form.errors)
        self.assertIn("18 ans", form.errors["date_naissance"][0])

    def test_filtre_intelligent_equipe(self):
        """Seules les équipes libres ou la sienne en édition sont sélectionnables."""
        # En création : equipe1 a déjà un coach, seule equipe2 est disponible
        form_creation = EntraineurForm()
        qs_creation = form_creation.fields["equipe"].queryset
        self.assertIn(self.equipe2, qs_creation)
        self.assertNotIn(self.equipe1, qs_creation)

        # En édition pour coach1 : equipe1 (son équipe) et equipe2 (libre) sont présentes
        form_edition = EntraineurForm(instance=self.coach)
        qs_edition = form_edition.fields["equipe"].queryset
        self.assertIn(self.equipe1, qs_edition)
        self.assertIn(self.equipe2, qs_edition)

    def test_creation_entraineur(self):
        """Création complète d'un entraîneur avec mot de passe haché."""
        self.client.force_login(self.admin_user)
        url = reverse("entraineur:creer")

        donnees = {
            "prenom": "Faouzi",
            "nom": "Benzarti",
            "email": "faouzi@shootapp.tn",
            "date_naissance": "1950-01-03",
            "type": Entraineur.TypeEntraineur.PRINCIPAL,
            "fonction": Entraineur.Fonction.PRINCIPAL,
            "specialite": Entraineur.Specialite.TACTIQUE,
            "equipe": self.equipe2.pk,
            "password1": "Benzarti1234!",
            "password2": "Benzarti1234!",
        }
        r = self.client.post(url, donnees)
        self.assertEqual(r.status_code, 302)

        nouveau = Entraineur.objects.get(email="faouzi@shootapp.tn")
        self.assertEqual(nouveau.role, Utilisateur.Role.ENTRAINEUR)
        self.assertTrue(nouveau.check_password("Benzarti1234!"))
        self.assertEqual(nouveau.equipe, self.equipe2)

    def test_edition_entraineur(self):
        """Modification d'un profil entraîneur existant."""
        self.client.force_login(self.admin_user)
        url = reverse("entraineur:editer", args=[self.coach.pk])

        donnees = {
            "prenom": "Ali",
            "nom": "Boumnijel (Mis à jour)",
            "email": "coach1@shootapp.tn",
            "date_naissance": "1975-04-13",
            "type": Entraineur.TypeEntraineur.GARDIENS,
            "fonction": Entraineur.Fonction.RESPONSABLE_TECHNIQUE,
            "specialite": Entraineur.Specialite.GARDIENS,
            "equipe": "",  # Libérer l'équipe
        }
        r = self.client.post(url, donnees)
        self.assertEqual(r.status_code, 302)

        self.coach.refresh_from_db()
        self.assertEqual(self.coach.nom, "Boumnijel (Mis à jour)")
        self.assertIsNone(self.coach.equipe)

    def test_securite_auto_suppression_interdite(self):
        """Un administrateur entraîneur ne peut pas supprimer son propre compte."""
        admin_coach = Entraineur.objects.create(
            email="admin_coach@shootapp.tn",
            nom="Admin",
            prenom="Coach",
            is_superuser=True,
            is_staff=True,
        )
        admin_coach.set_password("AdminPass123!")
        admin_coach.save()

        self.client.force_login(admin_coach)
        url = reverse("entraineur:supprimer", args=[admin_coach.pk])
        r = self.client.post(url)
        self.assertEqual(r.status_code, 302)
        self.assertTrue(Entraineur.objects.filter(pk=admin_coach.pk).exists())

    def test_suppression_entraineur(self):
        """Suppression effective d'un profil tiers."""
        self.client.force_login(self.admin_user)
        url = reverse("entraineur:supprimer", args=[self.coach.pk])

        r = self.client.post(url)
        self.assertEqual(r.status_code, 302)
        self.assertFalse(Entraineur.objects.filter(pk=self.coach.pk).exists())
