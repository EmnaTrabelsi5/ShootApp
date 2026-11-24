from django.test import TestCase
from django.urls import reverse

from joueurApp.models import Joueur

from .models import RapportScouting, Recommandation, Scout
from utilisateurApp.models import Utilisateur


class ScoutCrudTests(TestCase):
    def test_scout_create_and_detail(self):
        response = self.client.post(
            reverse("scoutApp:scout-create"),
            {
                "nom": "Dupont",
                "prenom": "Alex",
                "email": "alex.dupont@example.com",
                "telephone": "",
                "password": "secure-password",
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
        self.assertEqual(
            self.client.get(reverse("scoutApp:rapport-list")).status_code,
            200,
        )


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
