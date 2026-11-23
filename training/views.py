import re
from datetime import date, datetime, timedelta

from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_POST
from django.urls import reverse

from .forms import SeanceForm
from .matchs import get_matchs
from .joueurs import POSTES, get_joueurs
from .models import Atelier, Seance, TableauTactique
import json
from .exercices import EXERCICES, PAR_ID
from .materiel import MATERIEL, materiel_affiche
from . import regles

# Taille de l'effectif pro (sert au calcul de la disponibilité)
EFFECTIF_TOTAL = 24   # valeur de secours si le module Joueurs est vide
# Objectif hebdomadaire de temps de terrain, en minutes (16h)
OBJECTIF_TERRAIN_MIN = 16 * 60

JOURS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"]
JOURS_LONGS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]
MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil",
               "Août", "Sep", "Oct", "Nov", "Déc"]
COULEURS_ATELIER = ["green", "blue", "orange", "slate"]
TYPES_TRAVAIL = ("ENTRAINEMENT", "DECRASSAGE")
OBJECTIFS = dict(Seance.OBJECTIF_CHOICES)
OBJECTIFS_COURTS = {"TACTIQUE": "Tactique", "TECHNIQUE": "Technique", "PHYSIQUE": "Physique",
                    "FINITION": "Finition", "RECUPERATION": "Récup."}


def _lundi(jour):
    return jour - timedelta(days=jour.weekday())


def _semaine_demandee(request):
    """Lundi de la semaine affichée (?semaine=AAAA-MM-JJ, sinon semaine en cours)."""
    valeur = request.GET.get("semaine")
    if valeur:
        try:
            return _lundi(datetime.strptime(valeur, "%Y-%m-%d").date())
        except ValueError:
            pass
    return _lundi(date.today())


def _libelle_semaine(lundi):
    dimanche = lundi + timedelta(days=6)
    if lundi.month == dimanche.month:
        debut = f"{lundi.day}"
    elif lundi.year == dimanche.year:
        debut = f"{lundi.day} {MOIS[lundi.month - 1].upper()}"
    else:
        debut = f"{lundi.day} {MOIS[lundi.month - 1].upper()} {lundi.year}"
    return f"SEMAINE DU {debut} AU {dimanche.day} {MOIS[dimanche.month - 1].upper()} {dimanche.year}"


def _debut_saison(jour):
    """Une saison commence en juillet."""
    return jour.year if jour.month >= 7 else jour.year - 1


def _hm(minutes):
    h, m = divmod(int(minutes), 60)
    return f"{h}h {m:02d}m" if m else f"{h}h"


def _heure(t):
    return t.strftime("%H:%M") if t else ""


def _url_ajout(jour, type_seance=None):
    url = reverse("admin:training_seance_add") + f"?date={jour.isoformat()}"
    if type_seance:
        url += f"&type_seance={type_seance}"
    return url


def _carte_match(carte, jour, match):
    """Carte d'un jour de match (lecture seule : géré par le module Match)."""
    carte.update({
        "type": "match",
        "jour": f"{JOURS[jour.weekday()]} • MATCH",
        "titre": match.adversaire.upper(),
        "description": match.description,
        "horaire": _heure(match.heure) or "Horaire à venir",
        "tag": "Match",
        "lieu": match.lieu or "—",
        "competition": match.competition,
        "logo": match.adversaire_logo,
    })
    return carte


def _carte_jour(jour, seances, aujourdhui, match=None):
    """Construit la carte d'un jour du calendrier (match prioritaire sur les séances)."""
    carte = {
        "jour": JOURS[jour.weekday()],
        "date": f"{jour.day} {MOIS_COURTS[jour.month - 1]}",
        "iso": jour.isoformat(),
        "url_ajout": _url_ajout(jour),
        "url_ajout_repos": _url_ajout(jour, "REPOS"),
        "autres": max(len(seances) - 1, 0),
    }
    if jour == aujourdhui:
        carte["jour"] = f"AUJOURD'HUI • {JOURS[jour.weekday()]}"

    if match:
        return _carte_match(carte, jour, match)

    if not seances:
        carte["type"] = "libre"
        return carte

    seance = seances[0]
    carte.update({
        "titre": seance.titre.upper(),
        "description": seance.description,
        "horaire": (f"{_heure(seance.heure_debut)}-{_heure(seance.heure_fin)}"
                    if seance.heure_debut else "Horaire libre"),
        "joueurs": f"{seance.nb_joueurs} Joueurs",
        "lieu": seance.terrain or "—",
        "pk": seance.pk,
        "objectif": seance.objectif,
        "objectif_label": OBJECTIFS_COURTS.get(seance.objectif, ""),
        "exercices": [i for i in seance.exercices or [] if i in PAR_ID],
        "url_modif": reverse("admin:training_seance_change", args=[seance.pk]),
        "url_suppr": reverse("admin:training_seance_delete", args=[seance.pk]),
    })

    if seance.type_seance == "REPOS":
        carte["type"] = "repos"
    else:
        carte["type"] = "aujourdhui" if jour == aujourdhui else "seance"
        if seance.type_seance == "DECRASSAGE":
            carte["tag"], carte["tag_couleur"] = "Décrassage", "green"
        else:
            carte["tag"] = f"RPE {seance.rpe:g}"
            carte["tag_couleur"] = "orange" if seance.rpe >= 7 else "blue"
        carte["lieu_couleur"] = "yellow"
    return carte


def _minutes(seances):
    return sum(s.duree_minutes() or 0 for s in seances if s.type_seance != "MATCH")


def _kpi(seances_semaine, seances_prec):
    minutes = _minutes(seances_semaine)
    delta = minutes - _minutes(seances_prec)

    travail = [s for s in seances_semaine if s.type_seance in TYPES_TRAVAIL]
    travail_prec = [s for s in seances_prec if s.type_seance in TYPES_TRAVAIL]
    rpe = sum(s.rpe for s in travail) / len(travail) if travail else None
    rpe_prec = sum(s.rpe for s in travail_prec) / len(travail_prec) if travail_prec else None
    effectif = len(get_joueurs()) or EFFECTIF_TOTAL   # effectif réel du module Joueurs
    dispo = min(max((s.nb_joueurs for s in travail), default=0), effectif)

    if rpe is None:
        charge = "Aucune séance"
    elif rpe >= 7:
        charge = "Charge Haute"
    elif rpe >= 5:
        charge = "Charge Modérée"
    else:
        charge = "Charge Faible"

    return {
        "terrain": _hm(minutes),
        "terrain_delta": ("+" if delta >= 0 else "−") + _hm(abs(delta)) + " vs S-1",
        "terrain_pct": min(100, round(minutes * 100 / OBJECTIF_TERRAIN_MIN)),
        "objectif": _hm(OBJECTIF_TERRAIN_MIN),
        "dispo_pct": f"{dispo * 100 / effectif:.1f}",
        "dispo": dispo,
        "effectif": effectif,
        "absents": effectif - dispo,
        "rpe": f"{rpe:.1f}" if rpe is not None else "–",
        "rpe_pct": round(rpe * 10) if rpe is not None else 0,
        "rpe_prec": f"{rpe_prec:.1f}" if rpe_prec is not None else "–",
        "charge": charge,
    }


def _prochain_match(aujourdhui):
    matchs = get_matchs(date_debut=aujourdhui)
    if not matchs:
        return None
    match = matchs[0]
    adversaire = re.sub(r"^(vs\.?|contre)\s+", "", match.adversaire.strip(), flags=re.I) or match.adversaire
    j = (match.date - aujourdhui).days
    heure = _heure(match.heure)
    return {
        "titre": match.adversaire,
        "j": "Jour J" if j == 0 else f"J-{j}",
        "heure": heure,
        "quand": f"{JOURS_LONGS[match.date.weekday()]} {match.date.day} {MOIS_COURTS[match.date.month - 1]}"
                 + (f" {heure}" if heure else ""),
        "terrain": match.lieu,
        "description": match.description,
        "competition": match.competition,
        "jour_court": f"{JOURS[match.date.weekday()]} {match.date.day} {MOIS_COURTS[match.date.month - 1]}",
        "adversaire": adversaire,
        "logo": match.adversaire_logo,
        "initiales": "".join(m[0] for m in adversaire.split()[:2]).upper() or "?",
    }


def _ateliers(aujourdhui):
    """Ateliers de la prochaine séance qui en a (sinon de la dernière)."""
    avec_ateliers = Seance.objects.exclude(type_seance="MATCH").filter(ateliers__isnull=False).distinct()
    seance = (avec_ateliers.filter(date__gte=aujourdhui).order_by("date", "heure_debut").first()
              or avec_ateliers.order_by("-date", "-heure_debut").first())
    ateliers, materiel = [], ""
    if seance:
        for i, a in enumerate(Atelier.objects.filter(seance=seance).order_by("numero")):
            ateliers.append({
                "numero": a.numero, "titre": a.titre, "description": a.description,
                "duree_minutes": a.duree_minutes, "couleur": COULEURS_ATELIER[i % len(COULEURS_ATELIER)],
            })
            materiel = materiel or a.materiel
    return seance, ateliers, materiel


def _joueurs_data():
    """Effectif pour le sélecteur visuel (envoyé en JSON au navigateur)."""
    return [j.__dict__ for j in get_joueurs()]


def _validation_data(aujourdhui):
    """Données pour la validation en direct dans la popup (le serveur revérifie tout)."""
    fin = aujourdhui + timedelta(days=regles.JOURS_MAX_AVANCE)
    seances = Seance.objects.exclude(type_seance="MATCH").filter(date__gte=aujourdhui)
    return {
        "regles": regles.pour_js(),
        "aujourdhui": aujourdhui.isoformat(),
        "matchs": {m.date.isoformat(): m.adversaire for m in get_matchs(aujourdhui, fin)},
        "seances": [{"id": x.pk, "date": x.date.isoformat(), "titre": x.titre,
                     "debut": _heure(x.heure_debut), "fin": _heure(x.heure_fin)} for x in seances],
    }



# ---------------------------------------------------------------- tableau : joueurs de la prochaine séance
# Pions du tableau (identifiant, position par défaut en %, poste attendu, classe CSS) : 4-3-3 classique
PIONS = [
    ("p1", 6, 50, "GARDIEN", "gk"), ("p2", 20, 84, "DEFENSE", ""), ("p4", 17, 62, "DEFENSE", ""),
    ("p5", 17, 38, "DEFENSE", ""), ("p3", 20, 16, "DEFENSE", ""), ("p6", 32, 50, "MILIEU", ""),
    ("p8", 40, 30, "MILIEU", ""), ("p10", 40, 70, "MILIEU", ""), ("p7", 60, 18, "ATTAQUE", ""),
    ("p9", 66, 50, "ATTAQUE", "p-red"), ("p11", 60, 82, "ATTAQUE", "p-green"),
]


def _seance_tableau(aujourdhui):
    """Prochain entraînement (pas décrassage, repos ou match) qui a des joueurs convoqués, et ses joueurs."""
    par_id = {j.id: j for j in get_joueurs()}
    prochaines = (Seance.objects.filter(date__gte=aujourdhui, type_seance="ENTRAINEMENT")
                  .order_by("date", "heure_debut"))
    for seance in prochaines:
        joueurs = [par_id[i] for i in (seance.joueurs_ids or []) if i in par_id]
        if joueurs:
            return seance, joueurs
    return None, []


def _pions(joueurs):
    """Place les convoqués sur les 11 pions selon leur poste ; le reste va sur le banc."""
    libres = sorted(joueurs, key=lambda j: (j.statut == "BLESSE", j.numero))
    libres = [j for j in libres if j.statut != "BLESSE"]
    choix = {}
    for pid, _x, _y, poste, _c in PIONS:                       # 1er passage : le bon poste
        j = next((j for j in libres if j.poste == poste), None)
        if j:
            choix[pid] = j
            libres.remove(j)
    for pid, *_ in PIONS:                                      # 2e passage : on complète
        if pid not in choix and libres and pid != "p1":
            choix[pid] = libres.pop(0)
    pions = []
    for pid, x, y, _poste, classe in PIONS:
        j = choix.get(pid)
        pions.append({
            "id": pid, "x": x, "y": y, "classe": classe,
            "numero": (j.numero or "") if j else pid[1:],
            "nom": f"{j.prenom[:1]}. {j.nom}" if j else "",
            "photo": j.photo if j else "",
            "complet": f"{j.prenom} {j.nom}" if j else "",
        })
    return pions, libres


def planning(request):
    aujourdhui = date.today()
    lundi = _semaine_demandee(request)
    dimanche = lundi + timedelta(days=6)

    seances = Seance.objects.exclude(type_seance="MATCH")   # les matchs viennent du module Match
    # Filtre par objectif de séance
    objectif = request.GET.get("objectif", "")
    if objectif in OBJECTIFS:
        seances = seances.filter(objectif=objectif)
    else:
        objectif = ""
    seances_semaine = list(seances.filter(date__range=(lundi, dimanche)).order_by("date", "heure_debut"))
    seances_prec = list(seances.filter(
        date__range=(lundi - timedelta(days=7), lundi - timedelta(days=1))))
    matchs = {m.date: m for m in get_matchs(lundi, dimanche)}

    semaine = []
    for i in range(7):
        jour = lundi + timedelta(days=i)
        semaine.append(_carte_jour(jour, [s for s in seances_semaine if s.date == jour],
                                   aujourdhui, matchs.get(jour)))

    seance_ateliers, ateliers, materiel = _ateliers(aujourdhui)
    # Matériel de la prochaine séance (choisi dans la popup)
    prochaine = (Seance.objects.exclude(type_seance="MATCH").filter(date__gte=aujourdhui)
                 .order_by("date", "heure_debut"))
    seance_materiel = next((x for x in prochaine if x.materiel), None)
    saison = _debut_saison(lundi)
    seance_tableau, convoques = _seance_tableau(aujourdhui)
    pions, banc = _pions(convoques)

    context = {
        "semaine": semaine,
        "objectif_actif": objectif,
        "filtres_objectif": [("", "Tous les objectifs")] + list(Seance.OBJECTIF_CHOICES),
        "joueurs_data": _joueurs_data(),
        "exercices_data": EXERCICES,
        "poste_choices": POSTES,
        "regles_type": {"objectifs": Seance.OBJECTIFS_PAR_TYPE, "rpe": Seance.RPE_PAR_TYPE},
        "lundi_iso": lundi.isoformat(),
        "libelle_semaine": _libelle_semaine(lundi),
        "semaine_prec": (lundi - timedelta(days=7)).isoformat(),
        "semaine_suiv": (lundi + timedelta(days=7)).isoformat(),
        "num_semaine": lundi.isocalendar()[1],
        "date_du_jour": f"{JOURS_LONGS[aujourdhui.weekday()]} {aujourdhui.day} {MOIS[aujourdhui.month - 1]}",
        "semaine_du_jour": aujourdhui.isocalendar()[1],
        "semaine_en_cours": lundi == _lundi(aujourdhui),
        "saison_courte": f"{saison % 100:02d}/{(saison + 1) % 100:02d}",
        "saison_longue": f"{saison}-{saison + 1}",
        "kpi": _kpi(seances_semaine, seances_prec),
        "match": _prochain_match(aujourdhui),
        "seance_ateliers": seance_ateliers,
        "ateliers": ateliers,
        "ateliers_total": sum(a["duree_minutes"] for a in ateliers),
        "materiel": materiel,
        "materiel_items": materiel_affiche(seance_materiel.materiel) if seance_materiel else [],
        "seance_materiel": seance_materiel,
        "materiel_data": MATERIEL,
        "validation_data": _validation_data(aujourdhui),
        "tableau_data": _tableau().positions,
        "pions": pions,
        "banc": banc,
        "seance_tableau": seance_tableau,
        "url_ajout": _url_ajout(max(aujourdhui, lundi)),
        "url_ajout_atelier": reverse("admin:training_atelier_add"),
        "form": SeanceForm(initial={"date": max(aujourdhui, lundi)}),
    }
    return render(request, "training/planning.html", context)


@require_POST
def planifier(request):
    """Enregistre une séance depuis la popup de planification (réponse JSON)."""
    form = SeanceForm(request.POST)
    if form.is_valid():
        seance = form.save()
        return JsonResponse({"ok": True, "semaine": _lundi(seance.date).isoformat()})
    return JsonResponse({"ok": False, "errors": form.errors.get_json_data()}, status=400)


def _seance_dict(seance):
    return {
        "id": seance.pk,
        "type_seance": seance.type_seance,
        "objectif": seance.objectif,
        "titre": seance.titre,
        "date": seance.date.isoformat(),
        "heure_debut": _heure(seance.heure_debut),
        "heure_fin": _heure(seance.heure_fin),
        "description": seance.description,
        "rpe": seance.rpe,
        "nb_joueurs": seance.nb_joueurs,
        "joueurs": seance.joueurs_ids or [],
        "exercices": seance.exercices or [],
        "materiel": seance.materiel or {},
        "terrain": seance.terrain,
    }


def seance_detail(request, pk):
    """GET : données de la séance (pour pré-remplir la popup). POST : modification."""
    seance = get_object_or_404(Seance, pk=pk)
    if request.method == "POST":
        form = SeanceForm(request.POST, instance=seance)
        if form.is_valid():
            seance = form.save()
            return JsonResponse({"ok": True, "semaine": _lundi(seance.date).isoformat()})
        return JsonResponse({"ok": False, "errors": form.errors.get_json_data()}, status=400)
    return JsonResponse(_seance_dict(seance))


@require_POST
def seance_supprimer(request, pk):
    seance = get_object_or_404(Seance, pk=pk)
    semaine = _lundi(seance.date).isoformat()
    seance.delete()
    return JsonResponse({"ok": True, "semaine": semaine})


# ---------------------------------------------------------------- tableau tactique
ELEMENTS_TABLEAU = {f"p{i}" for i in range(1, 12)} | {"zone"}


def _tableau():
    return TableauTactique.objects.get_or_create(nom="equipe-433")[0]   # nouveau tableau : 11 joueurs, 4-3-3 par défaut


def tableau(request):
    """GET : positions du tableau tactique. POST (JSON) : enregistre les positions."""
    tab = _tableau()
    if request.method == "POST":
        try:
            positions = json.loads(request.body or b"{}").get("positions", {})
        except (ValueError, AttributeError):
            return JsonResponse({"ok": False, "erreur": "Données invalides."}, status=400)
        propre = {}
        if not isinstance(positions, dict):
            return JsonResponse({"ok": False, "erreur": "Données invalides."}, status=400)
        for cle, valeur in positions.items():
            if cle not in ELEMENTS_TABLEAU:
                return JsonResponse({"ok": False, "erreur": f"Élément inconnu : {cle}."}, status=400)
            try:
                x, y = (round(min(100.0, max(0.0, float(v))), 2) for v in valeur)
            except (TypeError, ValueError):
                return JsonResponse({"ok": False, "erreur": f"Position invalide : {cle}."}, status=400)
            propre[cle] = [x, y]
        tab.positions = propre
        tab.save()
        return JsonResponse({"ok": True, "positions": propre})
    return JsonResponse({"positions": tab.positions})
