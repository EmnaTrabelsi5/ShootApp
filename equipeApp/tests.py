from django.test import TestCase

<<<<<<< Updated upstream
# Create your tests here.
=======
from entraineurApp.models import Entraineur
from joueurApp.models import Joueur
from presidentApp.models import President
from scoutApp.models import Scout
from staffApp.models import Staff
from utilisateurApp.models import Utilisateur

from .models import Equipe
from .outils import normalize_text, PAYS_VILLES_MONDE


def creer_image(nom="test.png"):
    img = Image.new("RGB", (50, 50), color=(31, 122, 58))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(nom, buf.read(), content_type="image/png")


def compte(modele, email, **extra):
    return modele.objects.create(email=email, password="x", nom="Test", prenom="Compte", **extra)


class EquipesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Utilisateur.objects.create_superuser("adm@t.tn", "Adm1n!pass", nom="A", prenom="B")
        cls.pres = compte(President, "p@t.tn", nationalite="Tunisienne", date_debut_presidence=date(2020, 1, 1),
                          date_naissance=date(1980, 1, 1))
        cls.pres2 = compte(President, "p2@t.tn", nationalite="Française", date_debut_presidence=date(2021, 1, 1),
                           date_naissance=date(1985, 1, 1))
        cls.equipe = Equipe.objects.create(
            nom="Étoile Test", ville="Sousse", pays="Tunisie", president=cls.pres,
            niveau="Pro", date_creation=date(1990, 5, 1),
        )
        cls.autre = Equipe.objects.create(
            nom="Autre", ville="Tunis", pays="Tunisie", president=cls.pres2,
        )
        cls.joueur = compte(Joueur, "j@t.tn", poste="MIL", equipe=cls.equipe)
        cls.joueur2 = compte(Joueur, "j2@t.tn", poste="ATT")
        cls.coach = compte(Entraineur, "c@t.tn", equipe=cls.equipe)
        cls.coach_libre = compte(Entraineur, "c_libre@t.tn")
        cls.staff = compte(Staff, "s@t.tn")
        cls.scout = compte(Scout, "sc@t.tn")
        cls.equipe.staff.add(cls.staff)
        cls.equipe.scouts.add(cls.scout)

    def donnees(self, **kw):
        d = {
            "nom": "Nouveau FC",
            "ville": "Tunis",
            "pays": "Tunisie",
            "niveau": "Pro",
            "date_creation": "2000-01-01",
            "president": self.pres.pk,
            "entraineur": self.coach_libre.pk,
            "description": "Club de test",
            "site_web": "https://www.club.tn",
            "logo": creer_image("logo_equipe.png"),
            "joueurs": [self.joueur2.pk],
        }
        d.update(kw)
        return d

    def test_ock_kerkennah_avec_effectif_demo(self):
        ock = Equipe.objects.get(nom="Océano Club de Kerkennah")

        self.assertEqual(ock.ville, "Kerkennah")
        self.assertEqual(ock.pays, "Tunisie")
        self.assertGreaterEqual(ock.joueurs.count(), 11)
        self.assertTrue(ock.joueurs.filter(poste=Joueur.Poste.GARDIEN).exists())

    def test_recherche_par_nom(self):
        self.assertEqual(normalize_text("Étoile"), "etoile")
        self.client.force_login(self.admin)
        r = self.client.get(reverse("equipes:liste"), {"q": "etoile"}, headers={"x-requested-with": "XMLHttpRequest"})
        self.assertContains(r, "Étoile Test")
        self.assertNotContains(r, "Autre")

    def test_pages_admin(self):
        self.client.force_login(self.admin)
        for nom, args in [("liste", []), ("creer", []), ("detail", [self.equipe.pk]),
                          ("modifier", [self.equipe.pk]), ("supprimer", [self.equipe.pk])]:
            self.assertEqual(self.client.get(reverse(f"equipes:{nom}", args=args)).status_code, 200, nom)
        for nom, args in [("liste", []), ("creer", []), ("detail", [self.pres.pk]),
                          ("modifier", [self.pres.pk]), ("supprimer", [self.pres.pk])]:
            self.assertEqual(self.client.get(reverse(f"presidents:{nom}", args=args)).status_code, 200, nom)

    def test_creation_modification_suppression(self):
        self.client.force_login(self.admin)
        r = self.client.post(reverse("equipes:creer"), self.donnees())
        e = Equipe.objects.get(nom="Nouveau FC")
        self.assertRedirects(r, reverse("equipes:detail", args=[e.pk]))
        # Vérifier l'affectation de l'entraîneur et du joueur
        self.coach_libre.refresh_from_db()
        self.assertEqual(self.coach_libre.equipe, e)
        self.joueur2.refresh_from_db()
        self.assertEqual(self.joueur2.equipe, e)

        # Modification
        self.client.post(reverse("equipes:modifier", args=[e.pk]), self.donnees(ville="Sfax", entraineur=self.coach_libre.pk))
        e.refresh_from_db()
        self.assertEqual(e.ville, "Sfax")

        # Suppression
        self.client.post(reverse("equipes:supprimer", args=[e.pk]))
        self.assertFalse(Equipe.objects.filter(pk=e.pk).exists())

    def test_validations_pays_et_villes_reels(self):
        self.client.force_login(self.admin)
        # Pays inexistant
        r = self.client.post(reverse("equipes:creer"), self.donnees(pays="PaysInvente", ville="Paris"))
        self.assertContains(r, "n&#x27;existe pas")
        # Ville n'appartenant pas au pays
        r = self.client.post(reverse("equipes:creer"), self.donnees(pays="Tunisie", ville="Marseille"))
        self.assertContains(r, "n&#x27;appartient pas")
        # Nom trop court
        r = self.client.post(reverse("equipes:creer"), self.donnees(nom="A"))
        self.assertContains(r, "au moins 2 caractères")
        # Entraîneur obligatoire
        r = self.client.post(reverse("equipes:creer"), self.donnees(entraineur=""))
        self.assertContains(r, "obligatoire")

    def test_president_crud_et_calcul_duree(self):
        self.client.force_login(self.admin)
        r = self.client.post(reverse("presidents:creer"), {
            "prenom": "Sami",
            "nom": "Mabrouk",
            "adresse": "Avenue Habib Bourguiba, Tunis",
            "email": "sami@club.tn",
            "telephone": "20123456",
            "photo": creer_image("photo_pres.png"),
            "date_naissance": "1980-05-10",
            "nationalite": "Tunisienne",
            "date_debut_presidence": "2020-01-01",
            "password1": "Abcd!234",
            "password2": "Abcd!234",
        })
        p = President.objects.get(email="sami@club.tn")
        self.assertEqual(p.role, "PRESIDENT")
        self.assertEqual(p.adresse, "Avenue Habib Bourguiba, Tunis")
        self.assertTrue(p.check_password("Abcd!234"))
        self.assertTrue(p.telephone.startswith("+216"))
        self.assertIn("an", p.duree_presidence)

        # Test contrainte 18 ans
        r = self.client.post(reverse("presidents:creer"), {
            "prenom": "Jeune",
            "nom": "Mineur",
            "email": "j@c.tn",
            "photo": creer_image("p.png"),
            "date_naissance": str(date.today().replace(year=date.today().year - 15)),
            "nationalite": "Tunisienne",
            "date_debut_presidence": "2024-01-01",
            "password1": "Abcd!234",
            "password2": "Abcd!234",
        })
        self.assertContains(r, "18 ans")

        # Test nationalité inventée
        r = self.client.post(reverse("presidents:creer"), {
            "prenom": "Alien",
            "nom": "Test",
            "email": "alien@c.tn",
            "photo": creer_image("p.png"),
            "date_naissance": "1980-01-01",
            "nationalite": "MartienneFictive",
            "date_debut_presidence": "2024-01-01",
            "password1": "Abcd!234",
            "password2": "Abcd!234",
        })
        self.assertContains(r, "n&#x27;existe pas")

        # Fiche du président
        r = self.client.get(reverse("presidents:detail", args=[p.pk]))
        self.assertContains(r, p.duree_presidence)
        self.assertContains(r, "Avenue Habib Bourguiba")
        self.assertNotContains(r, "Inscrit le : 23/11/2026")
>>>>>>> Stashed changes
