import io
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image

from equipeApp.models import Equipe
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
            email="pres@club.tn", nom="Ben Ahmed", prenom="Mohamed",
            nationalite="Tunisienne", date_naissance=date(1975, 4, 15),
            date_debut_presidence=date(2018, 6, 1), telephone="+216 20 111 222",
        )
        cls.equipe = Equipe.objects.create(
            nom="Club Test", ville="Tunis", pays="Tunisie", president=cls.pres,
        )

    def test_duree_presidence(self):
        duree = self.pres.duree_presidence
        self.assertTrue(len(duree) > 0)
        self.assertIn("an", duree)

    def test_formulaire_validation_strict(self):
        # Valide avec indicatif + numéro local et équipe associée
        form = PresidentForm(data={
            "prenom": "Ali", "nom": "Trabelsi", "email": "ali@club.tn",
            "indicatif": "+33", "telephone_numero": "612345678",
            "nationalite": "Tunisienne", "date_naissance": "1980-01-01",
            "date_debut_presidence": "2020-01-01", "password1": "Secur!123", "password2": "Secur!123",
            "equipes": [self.equipe.pk],
        }, files={"photo": creer_image()})
        self.assertTrue(form.is_valid(), form.errors)
        p = form.save()
        self.assertTrue(p.telephone.startswith("+33"))
        self.equipe.refresh_from_db()
        self.assertEqual(self.equipe.president_id, p.pk)

        # Invalide : âge < 18 ans
        form_jeune = PresidentForm(data={
            "prenom": "Ali", "nom": "Jeune", "email": "j@club.tn", "indicatif": "+216", "telephone_numero": "22334455",
            "nationalite": "Tunisienne", "date_naissance": str(date.today().replace(year=date.today().year - 16)),
            "date_debut_presidence": "2024-01-01", "password1": "Secur!123", "password2": "Secur!123",
        }, files={"photo": creer_image()})
        self.assertFalse(form_jeune.is_valid())
        self.assertIn("date_naissance", form_jeune.errors)

        # Invalide : nationalité inventée
        form_nat = PresidentForm(data={
            "prenom": "Ali", "nom": "Test", "email": "t@club.tn", "indicatif": "+216", "telephone_numero": "22334455",
            "nationalite": "Inventee123", "date_naissance": "1980-01-01",
            "date_debut_presidence": "2020-01-01", "password1": "Secur!123", "password2": "Secur!123",
        }, files={"photo": creer_image()})
        self.assertFalse(form_nat.is_valid())
        self.assertIn("nationalite", form_nat.errors)

    def test_vues_et_suppression_sans_blocage(self):
        self.client.force_login(self.admin)
        r = self.client.get(reverse("presidents:liste"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Ben Ahmed")

        r_create = self.client.get(reverse("presidents:creer"))
        self.assertContains(r_create, "ID Président")
        self.assertNotContains(r_create, "Indicatif par défaut")
        self.assertNotContains(r_create, "(18 ans minimum)")
        self.assertNotContains(r_create, "pwd-strength")
        self.assertNotContains(r_create, "id_adresse")
        self.assertContains(r_create, "3. Équipes dirigées")

        r_detail = self.client.get(reverse("presidents:detail", args=[self.pres.pk]))
        self.assertEqual(r_detail.status_code, 200)
        self.assertContains(r_detail, "Durée de présidence calculée")

        # Suppression avec arrière-plan flou et équipe conservée sans président
        r_del_get = self.client.get(reverse("presidents:supprimer", args=[self.pres.pk]))
        self.assertContains(r_del_get, "is-blurred")
        r_del_post = self.client.post(reverse("presidents:supprimer", args=[self.pres.pk]))
        self.assertRedirects(r_del_post, reverse("presidents:liste"))
        self.assertFalse(President.objects.filter(pk=self.pres.pk).exists())
        self.equipe.refresh_from_db()
        self.assertIsNone(self.equipe.president)
