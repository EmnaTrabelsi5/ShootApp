"""Commande pour nettoyer et remplir la base avec des données réalistes et conformes
pour Équipes et Présidents (sans affecter les matchs, compétitions ni séances existants).
"""
import io
from datetime import date

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from PIL import Image, ImageDraw

from competitionApp.models import Match
from entraineurApp.models import Entraineur
from equipeApp.models import Equipe
from joueurApp.models import Joueur
from presidentApp.models import President
from scoutApp.models import Scout
from staffApp.models import Staff


def _generer_avatar_png(nom_fichier, couleur_fond, couleur_accent, texte):
    img = Image.new("RGB", (240, 240), color=couleur_fond)
    draw = ImageDraw.Draw(img)
    draw.ellipse([16, 16, 224, 224], outline=couleur_accent, width=10)
    draw.rectangle([50, 96, 190, 144], fill=couleur_accent)
    draw.text((120, 120), texte, fill=couleur_fond, anchor="mm")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return ContentFile(buf.getvalue(), name=nom_fichier)


EQUIPES_CONFIG = [
    {
        "nom": "Espérance ST",
        "ville": "Tunis",
        "pays": "Tunisie",
        "niveau": "Pro",
        "date_creation": date(1919, 1, 15),
        "description": "Espérance Sportive de Tunis, club omnisports historique basé à Bab Souika.",
        "couleur": (180, 25, 25),
        "accent": (250, 204, 21),
        "code": "EST",
        "president_email": "president@devai.tn",
        "entraineur_email": "entraineur@devai.tn",
        "staff_emails": ["staff@devai.tn", "staff1@yalla.tn"],
        "scout_emails": ["scout1@yalla.tn", "scout.nord@yalla.tn"],
    },
    {
        "nom": "Club Africain",
        "ville": "Tunis",
        "pays": "Tunisie",
        "niveau": "Pro",
        "date_creation": date(1920, 10, 4),
        "description": "Club Africain de Tunis, club emblématique évoluant au stade de Radès.",
        "couleur": (190, 20, 35),
        "accent": (255, 255, 255),
        "code": "CA",
        "president_email": "president1@yalla.tn",
        "entraineur_email": "entraineur1@yalla.tn",
        "staff_emails": ["staff1@yalla.tn"],
        "scout_emails": ["scout1@yalla.tn"],
    },
    {
        "nom": "Étoile du Sahel",
        "ville": "Sousse",
        "pays": "Tunisie",
        "niveau": "Pro",
        "date_creation": date(1925, 5, 11),
        "description": "Étoile Sportive du Sahel, grand club du Sahel tunisien basé à Sousse.",
        "couleur": (185, 28, 28),
        "accent": (255, 255, 255),
        "code": "ESS",
        "president_email": "president.sahel@yalla.tn",
        "entraineur_email": "coach.sahel@yalla.tn",
        "staff_emails": ["staff.sahel@yalla.tn"],
        "scout_emails": ["scout.sahel@yalla.tn"],
    },
    {
        "nom": "CS Sfaxien",
        "ville": "Sfax",
        "pays": "Tunisie",
        "niveau": "Pro",
        "date_creation": date(1928, 5, 28),
        "description": "Club Sportif Sfaxien, institution phare du football du sud tunisien.",
        "couleur": (20, 24, 28),
        "accent": (212, 255, 58),
        "code": "CSS",
        "president_email": "president.sfax@yalla.tn",
        "entraineur_email": "coach.sfax@yalla.tn",
        "staff_emails": ["staff.sfax@yalla.tn"],
        "scout_emails": ["scout.sfax@yalla.tn"],
    },
    {
        "nom": "US Monastir",
        "ville": "Monastir",
        "pays": "Tunisie",
        "niveau": "Pro",
        "date_creation": date(1923, 3, 17),
        "description": "Union Sportive Monastirienne, club historique du littoral tunisien.",
        "couleur": (21, 94, 180),
        "accent": (255, 255, 255),
        "code": "USM",
        "president_email": "president1@yalla.tn",
        "entraineur_email": "coach.monastir@yalla.tn",
        "staff_emails": ["staff@devai.tn"],
        "scout_emails": ["scout.sahel@yalla.tn"],
    },
    {
        "nom": "Stade Tunisien",
        "ville": "Tunis",
        "pays": "Tunisie",
        "niveau": "Pro",
        "date_creation": date(1948, 7, 7),
        "description": "Stade Tunisien du Bardo, club formateur de la capitale.",
        "couleur": (16, 110, 56),
        "accent": (220, 38, 38),
        "code": "ST",
        "president_email": "president.stade@yalla.tn",
        "entraineur_email": "coach.stade@yalla.tn",
        "staff_emails": ["staff.sfax@yalla.tn"],
        "scout_emails": ["scout.nord@yalla.tn"],
    },
]

PRESIDENTS_DATA = [
    {
        "email": "president@devai.tn",
        "prenom": "Sami",
        "nom": "Mabrouk",
        "telephone": "+216 20 450 110",
        "nationalite": "Tunisienne",
        "date_naissance": date(1974, 3, 18),
        "date_debut_presidence": date(2020, 7, 1),
        "code": "SM",
        "couleur": (15, 75, 45),
    },
    {
        "email": "president1@yalla.tn",
        "prenom": "Hédi",
        "nom": "Ben Salah",
        "telephone": "+216 22 310 440",
        "nationalite": "Tunisienne",
        "date_naissance": date(1972, 9, 12),
        "date_debut_presidence": date(2021, 9, 15),
        "code": "HB",
        "couleur": (140, 28, 38),
    },
    {
        "email": "president.sahel@yalla.tn",
        "prenom": "Zied",
        "nom": "Jaziri",
        "telephone": "+216 24 880 550",
        "nationalite": "Tunisienne",
        "date_naissance": date(1978, 7, 12),
        "date_debut_presidence": date(2022, 6, 1),
        "code": "ZJ",
        "couleur": (170, 30, 30),
    },
    {
        "email": "president.sfax@yalla.tn",
        "prenom": "Nizar",
        "nom": "Khemiri",
        "telephone": "+216 29 612 730",
        "nationalite": "Tunisienne",
        "date_naissance": date(1970, 11, 25),
        "date_debut_presidence": date(2023, 1, 10),
        "code": "NK",
        "couleur": (30, 41, 59),
    },
    {
        "email": "president.stade@yalla.tn",
        "prenom": "Lotfi",
        "nom": "Chabbi",
        "telephone": "+216 55 901 220",
        "nationalite": "Tunisienne",
        "date_naissance": date(1976, 4, 3),
        "date_debut_presidence": date(2021, 2, 1),
        "code": "LC",
        "couleur": (21, 101, 52),
    },
]

ENTRAINEURS_EXTRA = [
    ("coach.sahel@yalla.tn", "Faouzi", "Benzarti", Entraineur.TypeEntraineur.PRINCIPAL),
    ("coach.sfax@yalla.tn", "Anis", "Boujelbene", Entraineur.TypeEntraineur.PRINCIPAL),
    ("coach.monastir@yalla.tn", "Lassaad", "Jarda", Entraineur.TypeEntraineur.PRINCIPAL),
    ("coach.stade@yalla.tn", "Maher", "Kanzari", Entraineur.TypeEntraineur.PRINCIPAL),
    ("coach.libre@yalla.tn", "Khaled", "Ben Yahia", Entraineur.TypeEntraineur.PRINCIPAL),
]

STAFF_EXTRA = [
    ("staff.sahel@yalla.tn", "Walid", "Baccouche"),
    ("staff.sfax@yalla.tn", "Amira", "Trigui"),
]

SCOUTS_EXTRA = [
    ("scout.nord@yalla.tn", "Kais", "Riahi", "Régional", "Défenseurs et milieux"),
    ("scout.sahel@yalla.tn", "Rim", "Masmoudi", "Professionnel", "Jeunes talents"),
    ("scout.sfax@yalla.tn", "Tarek", "Sellami", "National", "Attaquants"),
]


class Command(BaseCommand):
    help = "Nettoie les données de test invalides et remplit les équipes et présidents avec des données propres."

    @transaction.atomic
    def handle(self, *args, **options):
        # 1. Supprimer les données de test incohérentes (ff, cc, mm, Souha Gmati, kk cc)
        noms_invalides = ["ff", "cc", "mm", "Souha Gmati"]
        equipes_invalides = Equipe.objects.filter(nom__in=noms_invalides)
        if equipes_invalides.exists():
            Match.objects.filter(
                Q(equipe_domicile__in=equipes_invalides) | Q(equipe_exterieur__in=equipes_invalides)
            ).delete()
            equipes_invalides.delete()
        President.objects.filter(email="sasougmati@gmail.com").delete()

        # 2. Mettre à jour / créer les présidents
        presidents_map = {}
        for pdata in PRESIDENTS_DATA:
            pres = President.objects.filter(email=pdata["email"]).first()
            if pres is None:
                pres = President.objects.create_user(
                    email=pdata["email"],
                    password="Yalla!2026",
                    prenom=pdata["prenom"],
                    nom=pdata["nom"],
                    telephone=pdata["telephone"],
                    nationalite=pdata["nationalite"],
                    date_naissance=pdata["date_naissance"],
                    date_debut_presidence=pdata["date_debut_presidence"],
                )
            else:
                pres.prenom = pdata["prenom"]
                pres.nom = pdata["nom"]
                pres.telephone = pdata["telephone"]
                pres.nationalite = pdata["nationalite"]
                pres.date_naissance = pdata["date_naissance"]
                pres.date_debut_presidence = pdata["date_debut_presidence"]
            if not pres.photo or "Capture_" in pres.photo.name:
                pres.photo = _generer_avatar_png(
                    f"pres_{pdata['code'].lower()}.png",
                    pdata["couleur"],
                    (250, 204, 21),
                    pdata["code"],
                )
            pres.save()
            presidents_map[pdata["email"]] = pres

        # 3. Créer les entraîneurs, staff et scouts complémentaires
        entraineurs_map = {e.email: e for e in Entraineur.objects.all()}
        for email, prenom, nom, typ in ENTRAINEURS_EXTRA:
            if email not in entraineurs_map:
                entraineurs_map[email] = Entraineur.objects.create_user(
                    email=email, password="Yalla!2026", prenom=prenom, nom=nom, type=typ, fonction="PRINCIPAL"
                )

        staff_map = {s.email: s for s in Staff.objects.all()}
        for email, prenom, nom in STAFF_EXTRA:
            if email not in staff_map:
                staff_map[email] = Staff.objects.create_user(
                    email=email, password="Yalla!2026", prenom=prenom, nom=nom
                )

        scouts_map = {sc.email: sc for sc in Scout.objects.all()}
        for email, prenom, nom, typ, spec in SCOUTS_EXTRA:
            if email not in scouts_map:
                scouts_map[email] = Scout.objects.create_user(
                    email=email, password="Yalla!2026", prenom=prenom, nom=nom, type=typ, specialite_scout=spec
                )

        # 4. Mettre à jour les 6 équipes principales avec encadrement complet et logos propres
        equipes_map = {}
        for cfg in EQUIPES_CONFIG:
            eq, _ = Equipe.objects.get_or_create(
                nom=cfg["nom"],
                defaults={"ville": cfg["ville"], "pays": cfg["pays"]},
            )
            eq.ville = cfg["ville"]
            eq.pays = cfg["pays"]
            eq.niveau = cfg["niveau"]
            eq.date_creation = cfg["date_creation"]
            eq.description = cfg["description"]
            eq.president = presidents_map[cfg["president_email"]]
            if not eq.logo or "burndown" in eq.logo.name or "Capture_" in eq.logo.name:
                eq.logo = _generer_avatar_png(
                    f"logo_{cfg['code'].lower()}.png",
                    cfg["couleur"],
                    cfg["accent"],
                    cfg["code"],
                )
            eq.save()
            eq.staff.set([staff_map[e] for e in cfg["staff_emails"] if e in staff_map])
            eq.scouts.set([scouts_map[e] for e in cfg["scout_emails"] if e in scouts_map])

            coach = entraineurs_map.get(cfg["entraineur_email"])
            if coach:
                ancien = getattr(eq, "entraineur", None)
                if ancien and ancien.pk != coach.pk:
                    ancien.equipe = None
                    ancien.save()
                coach.equipe = eq
                coach.save()

            equipes_map[cfg["nom"]] = eq

        # 5. Affecter joueur1@yalla.tn à l'Espérance ST avec un numéro libre (#10)
        joueur1 = Joueur.objects.filter(email="joueur1@yalla.tn").first()
        est = equipes_map.get("Espérance ST")
        if joueur1 and est:
            pris = set(est.joueurs.exclude(pk=joueur1.pk).values_list("numero_maillot", flat=True))
            if joueur1.numero_maillot in pris or not joueur1.numero_maillot:
                joueur1.numero_maillot = 10 if 10 not in pris else next(n for n in range(1, 100) if n not in pris)
            joueur1.equipe = est
            joueur1.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Données mises à jour : {Equipe.objects.count()} équipes, "
                f"{President.objects.count()} présidents, {Entraineur.objects.count()} entraîneurs, "
                f"{Staff.objects.count()} staff, {Scout.objects.count()} scouts, {Joueur.objects.count()} joueurs."
            )
        )
