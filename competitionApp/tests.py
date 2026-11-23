from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from equipeApp.models import Equipe
from joueurApp.models import Joueur
from utilisateurApp.models import Utilisateur

from .models import Competition, EvenementMatch, Match


def date_heure(annee, mois, jour, heure=17):
    """Crée une date/heure avec le fuseau horaire du projet (Africa/Tunis)."""
    return timezone.make_aware(datetime(annee, mois, jour, heure, 0))


class DonneesDeTest(TestCase):
    """Données communes à tous les tests (créées avant chaque test)."""

    def setUp(self):
        self.est = Equipe.objects.create(nom="Espérance ST", ville="Tunis")
        self.ca = Equipe.objects.create(nom="Club Africain", ville="Tunis")
        self.ess = Equipe.objects.create(nom="Étoile du Sahel", ville="Sousse")

        self.ligue = Competition.objects.create(
            nom="Ligue 1", type="Championnat",
            date_debut=date(2026, 8, 1), date_fin=date(2027, 5, 31),
        )
        self.ligue.equipes.add(self.est, self.ca)  # ESS ne participe pas

        self.match = Match.objects.create(
            competition=self.ligue, equipe_domicile=self.est, equipe_exterieur=self.ca,
            date_heure=date_heure(2026, 11, 22), lieu="Radès",
        )

        self.staff = Utilisateur.objects.create_user(
            email="staff@devai.tn", password="motdepasse123", nom="Jouini", prenom="Rayen",
            role=Utilisateur.Role.STAFF,
        )
        self.utilisateur_joueur = Utilisateur.objects.create_user(
            email="joueur@devai.tn", password="motdepasse123", nom="Msakni", prenom="Youssef",
            role=Utilisateur.Role.JOUEUR,
        )


# ---------------------------------------------------------------------------
# Règles métier des modèles
# ---------------------------------------------------------------------------

class CompetitionReglesTest(DonneesDeTest):

    def test_date_fin_avant_date_debut_refusee(self):
        competition = Competition(nom="Coupe", type="Coupe",
                                  date_debut=date(2026, 12, 1), date_fin=date(2026, 11, 1))
        with self.assertRaises(ValidationError):
            competition.full_clean()


class MatchReglesTest(DonneesDeTest):

    def nouveau_match(self, **valeurs):
        donnees = dict(competition=self.ligue, equipe_domicile=self.est,
                       equipe_exterieur=self.ca, date_heure=date_heure(2026, 12, 6))
        donnees.update(valeurs)
        return Match(**donnees)

    def test_match_valide_accepte(self):
        self.nouveau_match().full_clean()  # ne doit pas lever d'erreur

    def test_meme_equipe_refusee(self):
        with self.assertRaises(ValidationError):
            self.nouveau_match(equipe_exterieur=self.est).full_clean()

    def test_equipe_hors_competition_refusee(self):
        with self.assertRaises(ValidationError):
            self.nouveau_match(equipe_exterieur=self.ess).full_clean()

    def test_date_hors_competition_refusee(self):
        with self.assertRaises(ValidationError):
            self.nouveau_match(date_heure=date_heure(2027, 7, 1)).full_clean()

    def test_deux_matchs_le_meme_jour_refuses(self):
        # self.match a déjà lieu le 22/11 avec les mêmes équipes
        with self.assertRaises(ValidationError):
            self.nouveau_match(date_heure=date_heure(2026, 11, 22, heure=20)).full_clean()

    def test_modifier_un_match_ne_cree_pas_de_conflit_avec_lui_meme(self):
        self.match.lieu = "Stade Chedly Zouiten"
        self.match.full_clean()  # ne doit pas lever d'erreur


class EvenementReglesTest(DonneesDeTest):

    def setUp(self):
        super().setUp()
        self.joueur_est = Joueur.objects.create(email="j1@devai.tn", nom="A", prenom="Ali",
                                                poste="ATT", equipe=self.est)
        self.joueur_est_2 = Joueur.objects.create(email="j2@devai.tn", nom="B", prenom="Bilel",
                                                  poste="MIL", equipe=self.est)
        self.joueur_ca = Joueur.objects.create(email="j3@devai.tn", nom="C", prenom="Chedi",
                                               poste="DEF", equipe=self.ca)

    def evenement(self, **valeurs):
        donnees = dict(match=self.match, equipe=self.est, joueur=self.joueur_est,
                       type_evenement=EvenementMatch.TypeEvenement.BUT, minute=30)
        donnees.update(valeurs)
        return EvenementMatch(**donnees)

    def test_match_programme_refuse_les_evenements(self):
        with self.assertRaises(ValidationError):
            self.evenement().full_clean()

    def test_but_accepte_pendant_le_match(self):
        self.match.statut = Match.Statut.EN_COURS
        self.match.save()
        self.evenement().full_clean()

    def test_joueur_d_une_autre_equipe_refuse(self):
        self.match.statut = Match.Statut.EN_COURS
        self.match.save()
        with self.assertRaises(ValidationError):
            self.evenement(joueur=self.joueur_ca).full_clean()

    def test_remplacement_sans_joueur_entrant_refuse(self):
        self.match.statut = Match.Statut.EN_COURS
        self.match.save()
        with self.assertRaises(ValidationError):
            self.evenement(type_evenement=EvenementMatch.TypeEvenement.REMPLACEMENT).full_clean()

    def test_remplacement_complet_accepte(self):
        self.match.statut = Match.Statut.EN_COURS
        self.match.save()
        self.evenement(type_evenement=EvenementMatch.TypeEvenement.REMPLACEMENT,
                       joueur_entrant=self.joueur_est_2).full_clean()

    def test_minute_superieure_a_120_refusee(self):
        self.match.statut = Match.Statut.EN_COURS
        self.match.save()
        with self.assertRaises(ValidationError):
            self.evenement(minute=130).full_clean()


# ---------------------------------------------------------------------------
# Vues : droits d'accès et CRUD
# ---------------------------------------------------------------------------

class VuesMatchTest(DonneesDeTest):

    def test_visiteur_non_connecte_redirige_vers_connexion(self):
        reponse = self.client.get(reverse("competitionApp:match_list"))
        self.assertEqual(reponse.status_code, 302)

    def test_joueur_peut_consulter_le_calendrier(self):
        self.client.force_login(self.utilisateur_joueur)
        reponse = self.client.get(reverse("competitionApp:match_list"))
        self.assertEqual(reponse.status_code, 200)
        self.assertContains(reponse, "Espérance ST")

    def test_joueur_ne_peut_pas_creer_de_match(self):
        self.client.force_login(self.utilisateur_joueur)
        reponse = self.client.get(reverse("competitionApp:match_create"))
        self.assertEqual(reponse.status_code, 403)

    def test_staff_cree_un_match(self):
        self.client.force_login(self.staff)
        reponse = self.client.post(reverse("competitionApp:match_create"), {
            "competition": self.ligue.pk,
            "equipe_domicile": self.ca.pk,
            "equipe_exterieur": self.est.pk,
            "date_heure": "2026-12-13T16:00",
            "lieu": "Radès",
        })
        self.assertEqual(reponse.status_code, 302)  # redirection vers le détail
        nouveau = Match.objects.get(date_heure__date=date(2026, 12, 13))
        self.assertEqual(nouveau.statut, Match.Statut.PROGRAMME)  # statut automatique

    def test_match_valide_ne_peut_plus_etre_modifie(self):
        self.match.valide_par = self.staff
        self.match.save()
        self.client.force_login(self.staff)
        reponse = self.client.get(reverse("competitionApp:match_update", args=[self.match.pk]))
        self.assertEqual(reponse.status_code, 404)

    def test_staff_supprime_un_match(self):
        self.client.force_login(self.staff)
        self.client.post(reverse("competitionApp:match_delete", args=[self.match.pk]))
        self.assertFalse(Match.objects.filter(pk=self.match.pk).exists())

    def test_staff_ajoute_un_evenement(self):
        self.match.statut = Match.Statut.EN_COURS
        self.match.save()
        joueur = Joueur.objects.create(email="j9@devai.tn", nom="D", prenom="Dali",
                                       poste="ATT", equipe=self.est)
        self.client.force_login(self.staff)
        reponse = self.client.post(
            reverse("competitionApp:evenement_create", args=[self.match.pk]),
            {"type_evenement": "BUT", "equipe": self.est.pk, "joueur": joueur.pk,
             "minute": 12, "minute_additionnelle": 0, "description": ""},
        )
        self.assertRedirects(reponse, self.match.get_absolute_url())
        self.assertEqual(self.match.evenements.count(), 1)


class VuesCompetitionTest(DonneesDeTest):

    def test_suppression_refusee_si_la_competition_a_des_matchs(self):
        self.client.force_login(self.staff)
        self.client.post(reverse("competitionApp:competition_delete", args=[self.ligue.pk]))
        self.assertTrue(Competition.objects.filter(pk=self.ligue.pk).exists())

    def test_suppression_acceptee_sans_match(self):
        coupe = Competition.objects.create(nom="Coupe", type="Coupe",
                                           date_debut=date(2026, 9, 1), date_fin=date(2027, 6, 1))
        self.client.force_login(self.staff)
        self.client.post(reverse("competitionApp:competition_delete", args=[coupe.pk]))
        self.assertFalse(Competition.objects.filter(pk=coupe.pk).exists())
