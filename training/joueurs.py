"""
Source des joueurs pour le module Entraînement.

Les joueurs viennent du module Joueurs de ShootApp (joueurApp), en LECTURE SEULE :
ce fichier ne crée, ne modifie et ne supprime jamais un joueur.
C'est le SEUL endroit qui lit les joueurs. Le sélecteur visuel (terrain + photos)
et la convocation d'une séance passent tous par `get_joueurs()`.
Une séance garde seulement les identifiants des joueurs choisis (Seance.joueurs_ids).
"""
from dataclasses import dataclass

STATUTS = [
    ("DISPONIBLE", "Disponible"),
    ("DISPENSE", "Dispensé"),
    ("BLESSE", "Blessé"),
]

POSTES = [
    ("GARDIEN", "Gardiens"),
    ("DEFENSE", "Défense"),
    ("MILIEU", "Milieu"),
    ("ATTAQUE", "Attaque"),
]


@dataclass
class Joueur:
    id: int
    prenom: str
    nom: str
    numero: int
    poste: str          # GARDIEN | DEFENSE | MILIEU | ATTAQUE
    photo: str = ""     # URL de la photo ("" = initiales affichées)
    statut: str = "DISPONIBLE"   # DISPONIBLE | BLESSE | DISPENSE
    motif: str = ""              # ex : "Entorse cheville", "Examens"


# Postes de joueurApp (GB / DEF / MIL / ATT) -> postes du sélecteur
CORRESPONDANCE_POSTES = {"GB": "GARDIEN", "DEF": "DEFENSE", "MIL": "MILIEU", "ATT": "ATTAQUE"}


def get_joueurs():
    """Joueurs actifs du module Joueurs (joueurApp), triés par poste puis numéro."""
    from joueurApp.models import Joueur as JoueurModel   # import local : lecture seule

    joueurs = []
    qs = (JoueurModel.objects.filter(is_active=True)
          .order_by("poste", "numero_maillot", "nom"))
    for j in qs:
        motif = ""
        if j.statut != "DISPONIBLE":
            motif = j.get_statut_display()
        joueurs.append(Joueur(
            id=j.pk, prenom=j.prenom, nom=j.nom, numero=j.numero_maillot or 0,
            poste=CORRESPONDANCE_POSTES.get(j.poste, "MILIEU"),
            photo=j.photo.url if j.photo else "",
            statut=j.statut if j.statut in dict(STATUTS) else "DISPONIBLE",
            motif=motif,
        ))
    return joueurs
