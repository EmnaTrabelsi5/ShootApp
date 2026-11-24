import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


class IntegrationShootAppTests(TestCase):
    """Le module Séances est bien branché dans ShootApp."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="coach@yalla.tn", password="motdepasse123", nom="Test", prenom="Coach", role="ENTRAINEUR")

    def test_connexion_obligatoire(self):
        r = self.client.get(reverse("seances:planning"))
        self.assertEqual(r.status_code, 302)
        self.assertIn(reverse("comptes:connexion"), r["Location"])

    def test_page_dans_le_gabarit_shootapp(self):
        self.client.force_login(self.user)
        r = self.client.get(reverse("seances:planning"))
        self.assertEqual(r.status_code, 200)
        self.assertTemplateUsed(r, "base.html")
        html = r.content.decode()
        self.assertIn('class="seances"', html)
        # l'entrée « Séances » du rail est un vrai lien, active, sans badge « Bientôt »
        self.assertIn(f'href="{reverse("seances:planning")}" class="rail-link active"', html)
        self.assertNotIn("<span>Séances</span><em>Bientôt</em>", html)
        self.assertRegex(
            html,
            rf'<a\b(?=[^>]*href="{reverse("scoutApp:scout-list")}")(?=[^>]*class="rail-link(?: active)?\s*")[^>]*>',
        )
        self.assertNotIn('data-tip="Scouts : bientôt"', html)

    def test_tableau_tactique_enregistre(self):
        self.client.force_login(self.user)
        r = self.client.post(reverse("seances:tableau"), json.dumps({"positions": {"p1": [10, 50]}}),
                             content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["positions"], {"p1": [10.0, 50.0]})

    def test_planifier_refuse_donnees_invalides(self):
        self.client.force_login(self.user)
        r = self.client.post(reverse("seances:planifier"), {})
        self.assertEqual(r.status_code, 400)
        self.assertFalse(r.json()["ok"])


class JoueursReelsTests(TestCase):
    """La convocation lit les joueurs du module joueurApp (lecture seule)."""

    def test_get_joueurs_lit_joueurApp(self):
        from joueurApp.models import Joueur as JoueurModel
        from .joueurs import get_joueurs

        avant = JoueurModel.objects.count()
        JoueurModel.objects.create(email="g@yalla.tn", nom="Haddad", prenom="Karim", poste="GB",
                                   numero_maillot=1, statut="BLESSE")
        JoueurModel.objects.create(email="a@yalla.tn", nom="Sassi", prenom="Ali", poste="ATT",
                                   numero_maillot=9, is_active=False)
        joueurs = get_joueurs()
        self.assertEqual(len(joueurs), avant + 1)          # le joueur inactif est ignoré
        self.assertNotIn("Sassi", [x.nom for x in joueurs])
        j = next(x for x in joueurs if x.nom == "Haddad")
        self.assertEqual((j.prenom, j.nom, j.numero, j.poste, j.statut), ("Karim", "Haddad", 1, "GARDIEN", "BLESSE"))
        self.assertEqual(JoueurModel.objects.count(), avant + 2)   # rien n'a été modifié


class MatchsReelsTests(TestCase):
    """Le planning lit les matchs du module competitionApp (lecture seule)."""

    def setUp(self):
        from datetime import datetime, timezone as tz
        from competitionApp.models import Competition, Match as MatchModel
        from equipeApp.models import Equipe

        self.est = Equipe.objects.create(nom="Espérance ST", ville="Tunis")
        self.ca = Equipe.objects.create(nom="Club Africain", ville="Tunis")
        self.css = Equipe.objects.create(nom="CS Sfaxien", ville="Sfax")
        ligue = Competition.objects.create(nom="Ligue 1", type="championnat",
                                           date_debut="2026-07-01", date_fin="2027-06-30")
        MatchModel.objects.create(competition=ligue, equipe_domicile=self.est, equipe_exterieur=self.ca,
                                  date_heure=datetime(2026, 11, 26, 15, tzinfo=tz.utc), lieu="Radès")
        MatchModel.objects.create(competition=ligue, equipe_domicile=self.ca, equipe_exterieur=self.css,
                                  date_heure=datetime(2026, 11, 28, 15, tzinfo=tz.utc), statut="ANNULE")

    def test_tous_les_matchs(self):
        from datetime import date
        from .matchs import get_matchs
        matchs = get_matchs(date(2026, 11, 23), date(2026, 11, 29))
        self.assertEqual([m.adversaire for m in matchs], ["Espérance ST vs Club Africain"])  # l'annulé est ignoré
        self.assertEqual((matchs[0].date, matchs[0].lieu, matchs[0].competition), (date(2026, 11, 26), "Radès", "Ligue 1"))

    def test_equipe_du_club(self):
        from unittest import mock
        from . import matchs as module
        with mock.patch.object(module, "EQUIPE_CLUB", "Club Africain"):
            self.assertEqual([m.adversaire for m in module.get_matchs()], ["Espérance ST"])


class TableauProchaineSeanceTests(TestCase):
    """Les pions du tableau tactique = joueurs convoqués au prochain entraînement."""

    def test_pions_selon_les_postes(self):
        from .joueurs import Joueur
        from .views import _pions
        convoques = [
            Joueur(id=1, prenom="Ali", nom="Gardien", numero=1, poste="GARDIEN"),
            Joueur(id=2, prenom="Bilel", nom="Def", numero=4, poste="DEFENSE"),
            Joueur(id=3, prenom="Chedi", nom="Mil", numero=8, poste="MILIEU"),
            Joueur(id=4, prenom="Dali", nom="Att", numero=9, poste="ATTAQUE"),
            Joueur(id=5, prenom="Elyes", nom="Blesse", numero=5, poste="DEFENSE", statut="BLESSE"),
        ]
        pions, banc = _pions(convoques)
        par_id = {p["id"]: p for p in pions}
        self.assertEqual(par_id["p1"]["nom"], "A. Gardien")
        self.assertEqual(par_id["p2"]["nom"], "B. Def")
        self.assertEqual(par_id["p6"]["nom"], "C. Mil")
        self.assertEqual(par_id["p7"]["nom"], "D. Att")
        self.assertNotIn("E. Blesse", [p["nom"] for p in pions])     # un blessé n'est pas placé
        self.assertEqual(banc, [])
        self.assertEqual(len(pions), 11)


class RemplirSeancesTests(TestCase):
    """La commande de démonstration crée des séances valides, sans doublon."""

    def test_commande(self):
        from io import StringIO
        from django.core.management import call_command
        from joueurApp.models import Joueur as JoueurModel
        from .models import Seance

        for i, poste in enumerate(["GB", "DEF", "DEF", "MIL", "MIL", "ATT", "ATT", "DEF"], start=1):
            JoueurModel.objects.create(email=f"j{i}@yalla.tn", nom=f"Nom{i}", prenom="Test", poste=poste,
                                       numero_maillot=i)
        call_command("remplir_seances", "--semaines", "1", stdout=StringIO())
        n = Seance.objects.count()
        self.assertGreater(n, 0)
        self.assertTrue(Seance.objects.filter(ateliers__isnull=False).exists())
        call_command("remplir_seances", "--semaines", "1", stdout=StringIO())
        self.assertEqual(Seance.objects.count(), n)            # pas de doublon
