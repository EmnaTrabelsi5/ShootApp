from datetime import date

from django.test import TestCase
from django.urls import reverse

from equipeApp.models import Equipe

from .models import Joueur


class VestiaireTests(TestCase):
    def setUp(self):
        self.equipe = Equipe.objects.create(nom="YALLA FC", ville="Tunis")
        self.joueur = Joueur.objects.create(
            nom="Ben Ali", prenom="Sami", email="sami@club.tn", poste=Joueur.Poste.MILIEU,
            numero_maillot=8, equipe=self.equipe, date_naissance=date(2000, 1, 1),
        )

    def donnees(self, **extra):
        data = {
            "poste": "ATT", "statut": "DISPONIBLE", "prenom": "Youssef", "nom": "Msakni",
            "email": "youssef@club.tn", "numero_maillot": 7, "equipe": self.equipe.pk,
        }
        data.update(extra)
        return data

    def test_liste_affiche_les_joueurs(self):
        r = self.client.get(reverse("joueurs:liste"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Ben Ali")
        self.assertContains(r, "Vestiaire")

    def test_filtre_poste_et_recherche(self):
        r = self.client.get(reverse("joueurs:liste"), {"poste": "ATT"})
        self.assertFalse([j for j in r.context["joueurs"] if j.visible])
        r = self.client.get(reverse("joueurs:liste"), {"q": "sami"})
        self.assertEqual([j.pk for j in r.context["joueurs"] if j.visible], [self.joueur.pk])

    def test_ajout(self):
        r = self.client.post(reverse("joueurs:ajouter"), self.donnees())
        self.assertEqual(r.status_code, 302)
        j = Joueur.objects.get(email="youssef@club.tn")
        self.assertEqual(j.role, "JOUEUR")
        self.assertFalse(j.has_usable_password())

    def test_ajout_numero_deja_pris(self):
        r = self.client.post(reverse("joueurs:ajouter"), self.donnees(numero_maillot=8))
        self.assertEqual(r.status_code, 400)
        self.assertContains(r, "déjà porté par Sami Ben Ali", status_code=400)
        self.assertFalse(Joueur.objects.filter(email="youssef@club.tn").exists())

    def test_modification(self):
        url = reverse("joueurs:modifier", args=[self.joueur.pk])
        self.assertContains(self.client.get(url), "Modifier Sami Ben Ali")
        r = self.client.post(url, self.donnees(
            email="sami@club.tn", prenom="Sami", nom="Ben Ali", numero_maillot=8, statut="BLESSE", poste="MIL"))
        self.assertEqual(r.status_code, 302)
        self.joueur.refresh_from_db()
        self.assertEqual(self.joueur.statut, "BLESSE")

    def test_suppression(self):
        url = reverse("joueurs:supprimer", args=[self.joueur.pk])
        self.assertEqual(self.client.get(url).status_code, 200)
        r = self.client.post(url)
        self.assertEqual(r.status_code, 302)
        self.assertFalse(Joueur.objects.filter(pk=self.joueur.pk).exists())
