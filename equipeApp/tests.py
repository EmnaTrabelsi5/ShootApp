import io
from datetime import date, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from PIL import Image

from competitionApp.models import Competition, Match
from entraineurApp.models import Entraineur
from joueurApp.models import Joueur
from presidentApp.models import President
from scoutApp.models import Scout
from staffApp.models import Staff
from utilisateurApp.models import Utilisateur

from .models import Equipe
from .outils import normalize_text


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
        cls.pres = compte(
            President, "p@t.tn", nationalite="Tunisienne",
            date_debut_presidence=date(2020, 1, 1), date_naissance=date(1980, 1, 1),
        )
        cls.pres2 = compte(
            President, "p2@t.tn", nationalite="Française",
            date_debut_presidence=date(2021, 1, 1), date_naissance=date(1985, 1, 1),
        )
        cls.equipe = Equipe.objects.create(
            nom="Étoile Test", ville="Sousse", pays="Tunisie", president=cls.pres,
            niveau="Pro", date_creation=date(1990, 5, 1),
        )
        cls.autre = Equipe.objects.create(
            nom="Autre", ville="Tunis", pays="Tunisie", president=cls.pres2,
            niveau="Pro", date_creation=date(1995, 1, 1),
        )
        cls.joueur = compte(Joueur, "j@t.tn", poste="MIL", numero_maillot=7, equipe=cls.equipe)
        cls.joueur2 = compte(Joueur, "j2@t.tn", poste="ATT", numero_maillot=7)
        cls.joueur3 = compte(Joueur, "j3@t.tn", poste="DEF", numero_maillot=7, equipe=cls.autre)
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
            "logo": creer_image("logo_equipe.png"),
            "staff": [self.staff.pk],
            "scouts": [self.scout.pk],
            "joueurs": [self.joueur2.pk],
        }
        d.update(kw)
        return d

    def test_recherche_par_nom(self):
        self.assertEqual(normalize_text("Étoile"), "etoile")
        self.client.force_login(self.admin)
        r = self.client.get(reverse("equipes:liste"), {"q": "etoile"}, headers={"x-requested-with": "XMLHttpRequest"})
        self.assertContains(r, "Étoile Test")
        self.assertNotContains(r, "Autre")

    def test_pages_admin_et_navigation_retour(self):
        self.client.force_login(self.admin)
        for nom, args in [("liste", []), ("creer", []), ("detail", [self.equipe.pk]),
                          ("modifier", [self.equipe.pk]), ("supprimer", [self.equipe.pk])]:
            self.assertEqual(self.client.get(reverse(f"equipes:{nom}", args=args)).status_code, 200, nom)
        for nom, args in [("liste", []), ("creer", []), ("detail", [self.pres.pk]),
                          ("modifier", [self.pres.pk]), ("supprimer", [self.pres.pk])]:
            self.assertEqual(self.client.get(reverse(f"presidents:{nom}", args=args)).status_code, 200, nom)

        # Vérifier que site_web, * (Obligatoire) sur entraîneur, (Principal) et () ne sont plus présents
        url_eq_creer = reverse("equipes:creer")
        r_create = self.client.get(url_eq_creer)
        self.assertNotContains(r_create, "id_site_web")
        self.assertNotContains(r_create, "Entraîneur principal")
        self.assertNotContains(r_create, "(Principal)")
        self.assertNotContains(r_create, "Mehdi Gharbi ()")
        self.assertContains(r_create, "2. Encadrement de l'équipe")
        self.assertContains(r_create, f"retour={url_eq_creer}")

        # Ajouter un président depuis Ajouter une équipe -> Retour revient vers Ajouter une équipe
        r_pres_create = self.client.get(reverse("presidents:creer"), {"retour": url_eq_creer})
        self.assertContains(r_pres_create, f'href="{url_eq_creer}"')
        self.assertContains(r_pres_create, "Retour à l&#x27;ajout d&#x27;équipe")

        # Navigation Fiche Président -> Fiche Équipe -> Retour vers Fiche Président
        url_pres = reverse("presidents:detail", args=[self.pres.pk])
        r_pres = self.client.get(url_pres)
        self.assertContains(r_pres, f"retour={url_pres}")
        r_eq_from_pres = self.client.get(reverse("equipes:detail", args=[self.equipe.pk]), {"retour": url_pres})
        self.assertContains(r_eq_from_pres, f'href="{url_pres}"')

    def test_creation_modification_collision_maillot_et_suppression_matchs(self):
        self.client.force_login(self.admin)
        # Sélectionner deux joueurs qui ont tous les deux le n°7 (aucune IntegrityError)
        r = self.client.post(reverse("equipes:creer"), self.donnees(joueurs=[self.joueur2.pk, self.joueur3.pk]))
        e = Equipe.objects.get(nom="Nouveau FC")
        self.assertRedirects(r, reverse("equipes:detail", args=[e.pk]))
        self.coach_libre.refresh_from_db()
        self.assertEqual(self.coach_libre.equipe, e)
        self.joueur2.refresh_from_db()
        self.joueur3.refresh_from_db()
        self.assertEqual(self.joueur2.equipe, e)
        self.assertEqual(self.joueur3.equipe, e)
        self.assertNotEqual(self.joueur2.numero_maillot, self.joueur3.numero_maillot)

        # Modification
        self.client.post(reverse("equipes:modifier", args=[e.pk]), self.donnees(ville="Sfax", entraineur=self.coach_libre.pk))
        e.refresh_from_db()
        self.assertEqual(e.ville, "Sfax")

        # Créer un match impliquant cette équipe et vérifier la suppression en cascade du match
        comp = Competition.objects.create(
            nom="Coupe Test", type="Coupe",
            date_debut=date.today() - timedelta(days=5),
            date_fin=date.today() + timedelta(days=30),
        )
        comp.equipes.add(e, self.autre)
        match = Match.objects.create(
            competition=comp, equipe_domicile=e, equipe_exterieur=self.autre,
            date_heure=timezone.now() + timedelta(days=2),
        )
        self.client.post(reverse("equipes:supprimer", args=[e.pk]))
        self.assertFalse(Equipe.objects.filter(pk=e.pk).exists())
        self.assertFalse(Match.objects.filter(pk=match.pk).exists())

    def test_validations_obligatoires_et_geo(self):
        self.client.force_login(self.admin)
        # Pays inexistant
        r = self.client.post(reverse("equipes:creer"), self.donnees(pays="PaysInvente", ville="Paris"))
        self.assertContains(r, "n&#x27;existe pas")
        # Ville n'appartenant pas au pays
        r = self.client.post(reverse("equipes:creer"), self.donnees(pays="Tunisie", ville="Marseille"))
        self.assertContains(r, "n&#x27;appartient pas")
        # Entraîneur obligatoire
        r = self.client.post(reverse("equipes:creer"), self.donnees(entraineur=""))
        self.assertContains(r, "obligatoire")
        # Staff, Scout et Joueurs obligatoires (au moins 1 chacun)
        r = self.client.post(reverse("equipes:creer"), self.donnees(staff=[]))
        self.assertContains(r, "au moins un membre du staff")
        r = self.client.post(reverse("equipes:creer"), self.donnees(scouts=[]))
        self.assertContains(r, "au moins un scout")
        r = self.client.post(reverse("equipes:creer"), self.donnees(joueurs=[]))
        self.assertContains(r, "au moins un joueur")

    def test_mon_equipe_tous_acteurs_sans_boutons(self):
        for acteur in (self.pres, self.coach, self.staff, self.scout, self.joueur):
            self.client.force_login(acteur)
            r = self.client.get(reverse("equipes:mon_equipe"))
            self.assertEqual(r.status_code, 200)
            self.assertContains(r, "Étoile Test")
            self.assertNotContains(r, "Voir la fiche complète")
            self.assertNotContains(r, ">Fiche<")
            self.assertNotContains(r, "Cette action est réservée")

    def test_president_crud_et_calcul_duree(self):
        self.client.force_login(self.admin)
        r = self.client.post(reverse("presidents:creer"), {
            "prenom": "Sami",
            "nom": "Mabrouk",
            "email": "sami@club.tn",
            "indicatif": "+216",
            "telephone_numero": "20123456",
            "photo": creer_image("photo_pres.png"),
            "date_naissance": "1980-05-10",
            "nationalite": "Tunisienne",
            "date_debut_presidence": "2020-01-01",
            "password1": "Abcd!234",
            "password2": "Abcd!234",
            "equipes": [self.autre.pk],
        })
        p = President.objects.get(email="sami@club.tn")
        self.assertRedirects(r, reverse("presidents:detail", args=[p.pk]))
        self.assertEqual(p.role, "PRESIDENT")
        self.assertTrue(p.check_password("Abcd!234"))
        self.assertTrue(p.telephone.startswith("+216"))
        self.assertIn("an", p.duree_presidence)
        self.autre.refresh_from_db()
        self.assertEqual(self.autre.president_id, p.pk)

        # Suppression du président : l'équipe reste conservée sans président
        self.client.post(reverse("presidents:supprimer", args=[p.pk]))
        self.assertFalse(President.objects.filter(pk=p.pk).exists())
        self.autre.refresh_from_db()
        self.assertIsNone(self.autre.president)

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

        # Fiche du président
        r = self.client.get(reverse("presidents:detail", args=[self.pres.pk]))
        self.assertContains(r, self.pres.duree_presidence)
        self.assertNotContains(r, "Adresse")
