from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from joueurApp.models import Joueur

from .forms import RapportScoutingForm, RecommandationForm, ScoutForm
from .models import RapportScouting, Recommandation, Scout
from utilisateurApp.models import Utilisateur


class ScoutCrudTests(TestCase):
    def test_scout_create_and_detail(self):
        self.assertEqual(
            self.client.get(reverse("scoutApp:scout-create")).status_code,
            200,
        )
        response = self.client.post(
            reverse("scoutApp:scout-create"),
            {
                "nom": "Dupont",
                "prenom": "Alex",
                "email": "alex.dupont@example.com",
                "telephone": "",
                "password": "secure-password",
                "password_confirmation": "secure-password",
                "type": "Professionnel",
                "specialite_scout": "Attaquants",
                "is_active": True,
            },
        )

        self.assertEqual(response.status_code, 302)
        scout = Scout.objects.get(email="alex.dupont@example.com")
        self.assertEqual(scout.role, Utilisateur.Role.SCOUT)
        self.assertTrue(scout.check_password("secure-password"))

        response = self.client.get(reverse("scoutApp:scout-detail", args=[scout.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.client.get(reverse("scoutApp:scout-delete", args=[scout.pk])).status_code,
            200,
        )

        response = self.client.post(
            reverse("scoutApp:scout-update", args=[scout.pk]),
            {
                "nom": "Dupont",
                "prenom": "Alexis",
                "email": "alex.dupont@example.com",
                "telephone": "",
                "password": "",
                "password_confirmation": "",
                "type": "Professionnel",
                "specialite_scout": "Détection régionale",
                "is_active": False,
            },
        )
        self.assertEqual(response.status_code, 302)
        scout.refresh_from_db()
        self.assertEqual(scout.prenom, "Alexis")
        self.assertFalse(scout.is_active)
        self.assertTrue(scout.check_password("secure-password"))

        response = self.client.post(reverse("scoutApp:scout-delete", args=[scout.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Scout.objects.filter(pk=scout.pk).exists())


class ScoutFormValidationTests(TestCase):
    def setUp(self):
        self.data = {
            "nom": "Ben Salah",
            "prenom": "Amina",
            "date_naissance": "1987-06-15",
            "email": "AMINA@example.com",
            "telephone": "20 123 456",
            "type": "Professionnel",
            "specialite_scout": "Détection des jeunes talents",
            "password": "ScoutSecurePass2026!",
            "password_confirmation": "ScoutSecurePass2026!",
            "is_active": "on",
        }

    def test_scout_form_normalizes_valid_contact_details(self):
        form = ScoutForm(data=self.data)
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["email"], "amina@example.com")
        self.assertTrue(form.cleaned_data["telephone"].startswith("+216"))

    def test_scout_form_rejects_invalid_fields_and_password_mismatch(self):
        data = {
            **self.data,
            "nom": "A",
            "email": "not-an-email",
            "telephone": "abc123",
            "date_naissance": (timezone.localdate() + timedelta(days=1)).isoformat(),
            "password_confirmation": "DifferentPassword2026!",
        }
        form = ScoutForm(data=data)
        self.assertFalse(form.is_valid())
        for field in ("nom", "email", "telephone", "date_naissance", "password_confirmation"):
            self.assertIn(field, form.errors)

        weak_password_data = {
            **self.data,
            "password": "short",
            "password_confirmation": "short",
        }
        form = ScoutForm(data=weak_password_data)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)

    def test_scout_form_rejects_duplicate_email_and_invalid_photo(self):
        Utilisateur.objects.create_user(
            email="existing@example.com",
            password="ExistingSecurePass2026!",
            nom="Existing",
            prenom="User",
            role=Utilisateur.Role.ADMIN,
        )
        data = {**self.data, "email": "EXISTING@example.com"}
        form = ScoutForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn("email", form.errors)

        invalid_image = SimpleUploadedFile(
            "not-an-image.jpg",
            b"not an image",
            content_type="image/jpeg",
        )
        form = ScoutForm(data=self.data, files={"photo": invalid_image})
        self.assertFalse(form.is_valid())
        self.assertIn("photo", form.errors)


class RapportCrudTests(TestCase):
    def setUp(self):
        self.scout = Scout.objects.create(
            nom="Scout",
            prenom="Sam",
            email="sam@example.com",
            password="unused",
            specialite_scout="Milieux",
        )
        self.scout.set_password("unused")
        self.scout.save()
        self.joueur = Joueur.objects.create(
            nom="Player",
            prenom="Pat",
            email="pat@example.com",
            password="unused",
            poste=Joueur.Poste.MILIEU,
        )
        self.joueur.set_password("unused")
        self.joueur.save()

    def test_rapport_create_and_list(self):
        invalid_form = RapportScoutingForm(
            data={
                "scout": self.scout.pk,
                "joueur": self.joueur.pk,
                "evaluation_technique": 10.1,
                "evaluation_physique": -0.1,
                "evaluation_tactique": 5,
                "evaluation_mentale": 5,
                "observations": "",
            }
        )
        self.assertFalse(invalid_form.is_valid())
        self.assertIn("evaluation_technique", invalid_form.errors)
        self.assertIn("evaluation_physique", invalid_form.errors)

        response = self.client.post(
            reverse("scoutApp:rapport-create"),
            {
                "scout": self.scout.pk,
                "joueur": self.joueur.pk,
                "evaluation_technique": 8,
                "evaluation_physique": 7,
                "evaluation_tactique": 9,
                "evaluation_mentale": 8,
                "observations": "Bon potentiel",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(RapportScouting.objects.filter(joueur=self.joueur).exists())
        rapport = RapportScouting.objects.get(joueur=self.joueur)
        self.assertEqual(
            self.client.get(reverse("scoutApp:rapport-list")).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(reverse("scoutApp:rapport-detail", args=[rapport.pk])).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(reverse("scoutApp:rapport-update", args=[rapport.pk])).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(reverse("scoutApp:rapport-delete", args=[rapport.pk])).status_code,
            200,
        )
        response = self.client.post(
            reverse("scoutApp:rapport-update", args=[rapport.pk]),
            {
                "scout": self.scout.pk,
                "joueur": self.joueur.pk,
                "evaluation_technique": 9,
                "evaluation_physique": 8,
                "evaluation_tactique": 9,
                "evaluation_mentale": 9,
                "observations": "Évaluation mise à jour",
            },
        )
        self.assertEqual(response.status_code, 302)
        rapport.refresh_from_db()
        self.assertEqual(rapport.evaluation_technique, 9)

        response = self.client.post(reverse("scoutApp:rapport-delete", args=[rapport.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(RapportScouting.objects.filter(pk=rapport.pk).exists())


class RecommandationCrudTests(TestCase):
    def setUp(self):
        self.joueur = Joueur.objects.create(
            nom="Player",
            prenom="Jo",
            email="jo@example.com",
            password="unused",
            poste=Joueur.Poste.ATTAQUANT,
        )

    def test_recommandation_create_update_delete(self):
        invalid_form = RecommandationForm(
            data={
                "joueur": self.joueur.pk,
                "score_compatibilite": 100.1,
                "justification": "",
                "statut": "INCONNU",
            }
        )
        self.assertFalse(invalid_form.is_valid())
        self.assertIn("score_compatibilite", invalid_form.errors)
        self.assertIn("statut", invalid_form.errors)

        create_response = self.client.post(
            reverse("scoutApp:recommandation-create"),
            {
                "joueur": self.joueur.pk,
                "score_compatibilite": 85,
                "justification": "Profil adapté",
                "statut": Recommandation.Statut.EN_ATTENTE,
            },
        )
        self.assertEqual(create_response.status_code, 302)
        recommandation = Recommandation.objects.get(joueur=self.joueur)
        self.assertEqual(
            self.client.get(reverse("scoutApp:recommandation-list")).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(
                reverse("scoutApp:recommandation-detail", args=[recommandation.pk])
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(
                reverse("scoutApp:recommandation-update", args=[recommandation.pk])
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(
                reverse("scoutApp:recommandation-delete", args=[recommandation.pk])
            ).status_code,
            200,
        )

        update_response = self.client.post(
            reverse("scoutApp:recommandation-update", args=[recommandation.pk]),
            {
                "joueur": self.joueur.pk,
                "score_compatibilite": 90,
                "justification": "Profil validé",
                "statut": Recommandation.Statut.ACCEPTEE,
            },
        )
        self.assertEqual(update_response.status_code, 302)
        recommandation.refresh_from_db()
        self.assertEqual(recommandation.score_compatibilite, 90)

        delete_response = self.client.post(
            reverse("scoutApp:recommandation-delete", args=[recommandation.pk])
        )
        self.assertEqual(delete_response.status_code, 302)
        self.assertFalse(Recommandation.objects.filter(pk=recommandation.pk).exists())
