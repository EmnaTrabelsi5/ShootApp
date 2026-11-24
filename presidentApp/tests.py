import io
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image

from utilisateurApp.models import Utilisateur
from .forms import PresidentForm
from .models import President


def creer_image(nom="photo.png"):
    img = Image.new("RGB", (50, 50), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(nom, buf.read(), content_type="image/png")


class PresidentAppTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Utilisateur.objects.create_superuser("adm@club.tn", "SuperPass!1", nom="Admin", prenom="Club")
        cls.pres = President.objects.create(
            email="pres@club.tn", nom="Ben Ahmed", prenom="Mohamed", adresse="Tunis Centre",
            nationalite="Tunisienne", date_naissance=date(1975, 4, 15),
            date_debut_presidence=date(2018, 6, 1),
        )

    def test_duree_presidence(self):
        duree = self.pres.duree_presidence
        self.assertTrue(len(duree) > 0)
        self.assertIn("an", duree)

    def test_formulaire_validation_strict(self):
        # Valide
        form = PresidentForm(data={
            "prenom": "Ali", "nom": "Trabelsi", "adresse": "Sfax", "email": "ali@club.tn",
            "telephone": "22334455", "nationalite": "Tunisienne", "date_naissance": "1980-01-01",
            "date_debut_presidence": "2020-01-01", "password1": "Secur!123", "password2": "Secur!123",
        }, files={"photo": creer_image()})
        self.assertTrue(form.is_valid(), form.errors)

        # Invalide : âge < 18 ans
        form_jeune = PresidentForm(data={
            "prenom": "A", "nom": "B", "email": "j@club.tn", "telephone": "22334455",
            "nationalite": "Tunisienne", "date_naissance": str(date.today().replace(year=date.today().year - 16)),
            "date_debut_presidence": "2024-01-01", "password1": "Secur!123", "password2": "Secur!123",
        }, files={"photo": creer_image()})
        self.assertFalse(form_jeune.is_valid())
        self.assertIn("date_naissance", form_jeune.errors)

        # Invalide : nationalité inventée
        form_nat = PresidentForm(data={
            "prenom": "Ali", "nom": "Test", "email": "t@club.tn", "telephone": "22334455",
            "nationalite": "Inventee123", "date_naissance": "1980-01-01",
            "date_debut_presidence": "2020-01-01", "password1": "Secur!123", "password2": "Secur!123",
        }, files={"photo": creer_image()})
        self.assertFalse(form_nat.is_valid())
        self.assertIn("nationalite", form_nat.errors)

    def test_vues_president(self):
        self.client.force_login(self.admin)
        r = self.client.get(reverse("presidents:liste"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Ben Ahmed")
        self.assertNotContains(r, "Gérer les équipes")

        r_detail = self.client.get(reverse("presidents:detail", args=[self.pres.pk]))
        self.assertEqual(r_detail.status_code, 200)
        self.assertContains(r_detail, "Tunis Centre")
        self.assertContains(r_detail, "Durée de présidence calculée")
