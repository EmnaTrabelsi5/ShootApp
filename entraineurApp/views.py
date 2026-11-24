import json

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST

from competitionApp.models import Match
from equipeApp.models import Equipe
from joueurApp.models import Joueur
from utilisateurApp.permissions import (
    composition_required,
    gestion_entraineurs_required,
    lecture_entraineurs_required,
)
from utilisateurApp.roles import (
    est_admin,
    est_entraineur_principal,
    est_president,
    peut_gerer_composition,
    peut_gerer_entraineurs,
)
from .forms import EntraineurForm
from .models import Composition, Entrainement, Entraineur, JoueurComposition


@lecture_entraineurs_required
def liste(request):
    """
    Tableau de bord et annuaire du staff technique.
    Accessible au Président, à l'Administrateur et aux Entraîneurs.
    """
    q = request.GET.get("q", "").strip()
    specialite_filter = request.GET.get("specialite", "").strip()
    type_filter = request.GET.get("type", "").strip()

    qs = Entraineur.objects.select_related("equipe").all().order_by("nom", "prenom")

    if q:
        qs = qs.filter(
            Q(nom__icontains=q)
            | Q(prenom__icontains=q)
            | Q(email__icontains=q)
            | Q(specialite__icontains=q)
            | Q(type__icontains=q)
        )

    if specialite_filter:
        qs = qs.filter(specialite=specialite_filter)

    if type_filter:
        qs = qs.filter(type=type_filter)

    # Indicateurs statistiques globaux
    total = Entraineur.objects.count()
    avec_equipe = Entraineur.objects.filter(equipe__isnull=False).count()
    libres = Entraineur.objects.filter(equipe__isnull=True).count()
    principaux = Entraineur.objects.filter(type=Entraineur.TypeEntraineur.PRINCIPAL).count()

    stats = {
        "total": total,
        "avec_equipe": avec_equipe,
        "libres": libres,
        "principaux": principaux,
    }

    context = {
        "entraineurs": qs,
        "stats": stats,
        "q": q,
        "specialite_filter": specialite_filter,
        "type_filter": type_filter,
        "specialites": Entraineur.Specialite.choices,
        "types": Entraineur.TypeEntraineur.choices,
        "peut_gerer": peut_gerer_entraineurs(request.user),
    }
    return render(request, "entraineurApp/liste.html", context)


@lecture_entraineurs_required
def detail(request, pk):
    """
    Fiche profil complète de l'entraîneur.
    Accessible au Président, Admin et aux Entraîneurs.
    """
    coach = get_object_or_404(Entraineur.objects.select_related("equipe"), pk=pk)
    seances = coach.entrainements.all()[:6]

    peut_modifier = peut_gerer_entraineurs(request.user) or (request.user.pk == coach.pk)
    peut_supprimer = peut_gerer_entraineurs(request.user) and (request.user.pk != coach.pk)

    context = {
        "entraineur": coach,
        "seances": seances,
        "peut_modifier": peut_modifier,
        "peut_supprimer": peut_supprimer,
    }
    return render(request, "entraineurApp/detail.html", context)


@gestion_entraineurs_required
def creer(request):
    """Création conjointe compte/profil (Président et Administrateur uniquement)."""
    if request.method == "POST":
        form = EntraineurForm(request.POST, request.FILES)
        if form.is_valid():
            coach = form.save()
            messages.success(
                request,
                f"L'entraîneur {coach.prenom} {coach.nom} a été créé avec succès."
            )
            return redirect("entraineur:detail", pk=coach.pk)
        else:
            messages.error(request, "Veuillez vérifier les informations saisies.")
    else:
        form = EntraineurForm()

    context = {
        "form": form,
        "mode": "creer",
    }
    return render(request, "entraineurApp/formulaire.html", context)


@login_required
def editer(request, pk):
    """
    Mise à jour d'un entraîneur.
    Autorisé au Président, à l'Admin, ou à l'entraîneur lui-même pour son propre profil.
    """
    coach = get_object_or_404(Entraineur, pk=pk)

    if not (peut_gerer_entraineurs(request.user) or request.user.pk == coach.pk):
        messages.error(request, "Vous n'avez pas l'autorisation de modifier ce profil.")
        return redirect("entraineur:liste")

    if request.method == "POST":
        form = EntraineurForm(request.POST, request.FILES, instance=coach)
        if form.is_valid():
            coach = form.save()
            messages.success(
                request,
                f"Le profil de {coach.prenom} {coach.nom} a été mis à jour."
            )
            return redirect("entraineur:detail", pk=coach.pk)
        else:
            messages.error(request, "Veuillez corriger les erreurs du formulaire.")
    else:
        form = EntraineurForm(instance=coach)

    context = {
        "form": form,
        "mode": "editer",
        "entraineur": coach,
    }
    return render(request, "entraineurApp/formulaire.html", context)


@gestion_entraineurs_required
@require_http_methods(["GET", "POST"])
def supprimer_entraineur(request, pk):
    """
    Suppression d'un entraîneur (Président et Administrateur uniquement).
    Sécurité : interdiction de supprimer son propre compte.
    """
    coach = get_object_or_404(Entraineur, pk=pk)

    if request.user.pk == coach.pk:
        messages.error(
            request,
            "Sécurité : vous ne pouvez pas supprimer votre propre compte."
        )
        return redirect("entraineur:liste")

    if request.method == "POST":
        nom_complet = f"{coach.prenom} {coach.nom}"
        coach.delete()
        messages.success(
            request,
            f"L'entraîneur {nom_complet} et son compte ont été supprimés avec succès."
        )
        return redirect("entraineur:liste")

    context = {
        "entraineur": coach,
    }
    return render(request, "entraineurApp/confirmer_suppression.html", context)


# ---------------------------------------------------------------------------
# Composition d'équipe : réservée à l'entraîneur principal
# ---------------------------------------------------------------------------
NB_TITULAIRES = 11
NB_REMPLACANTS_MAX = 9

# Ordre d'affichage du vestiaire : gardien -> attaquant
ORDRE_POSTES = {"GB": 0, "DEF": 1, "MIL": 2, "ATT": 3}


def _entraineur_connecte(request):
    """Profil Entraineur de l'utilisateur connecté (None si ce n'est pas un entraîneur)."""
    return Entraineur.objects.select_related("equipe").filter(pk=request.user.pk).first()


def _fiche_joueur(j):
    """Données d'un joueur du vestiaire, consommées par composition.js."""
    return {
        "id": j.pk,
        "prenom": j.prenom,
        "nom": j.nom,
        "numero": j.numero_maillot,
        "poste": j.poste,
        "poste_label": j.get_poste_display(),
        "statut": j.statut,
        "statut_label": j.get_statut_display(),
        "age": j.age,
        "pied": j.get_pied_fort_display() if j.pied_fort else "",
    }


@composition_required
def composition(request, pk=None):
    """
    Éditeur de composition : 11 titulaires choisis dans le vestiaire de l'équipe
    de l'entraîneur principal, des remplaçants, un capitaine et les tireurs.
    Sans pk : la dernière composition de l'équipe (ou une feuille vierge).
    """
    coach = _entraineur_connecte(request)
    if coach is None or coach.equipe is None:
        messages.error(
            request,
            "Aucune équipe ne vous est affectée : demandez au président de vous en attribuer une.",
        )
        return redirect("joueurs:liste")

    equipe = coach.equipe
    base = Composition.objects.filter(equipe=equipe).select_related("match")
    compositions = list(base)

    if pk is not None:
        active = get_object_or_404(base, pk=pk)
    elif request.GET.get("nouvelle") == "1" or not compositions:
        active = None
    else:
        active = compositions[0]  # la plus récemment modifiée

    joueurs = sorted(
        Joueur.objects.filter(equipe=equipe),
        key=lambda j: (ORDRE_POSTES.get(j.poste, 9), j.numero_maillot or 100, j.nom),
    )

    etat = None
    if active is not None:
        lignes = list(active.joueurs_compo.all())
        etat = {
            "id": active.pk,
            "nom": active.nom,
            "dispositif": active.dispositif,
            "match": active.match_id,
            "capitaine": active.capitaine_id,
            "penalty": active.tireur_penalty_id,
            "coup_franc": active.tireur_coup_franc_id,
            "notes": active.notes_tactiques,
            "maj": timezone.localtime(active.date_mise_a_jour).strftime("%d/%m à %H:%M"),
            "titulaires": [
                {"joueur": l.joueur_id, "slot": l.slot_index} for l in lignes if l.est_titulaire
            ],
            "remplacants": [
                {"joueur": l.joueur_id, "slot": l.slot_index} for l in lignes if not l.est_titulaire
            ],
        }

    # Matchs à venir de l'équipe (+ celui déjà lié à la composition éditée)
    matchs = list(
        Match.objects.filter(
            Q(equipe_domicile=equipe) | Q(equipe_exterieur=equipe),
            statut=Match.Statut.PROGRAMME,
            date_heure__gte=timezone.now(),
        )
        .select_related("equipe_domicile", "equipe_exterieur")
        .order_by("date_heure")
    )
    if active is not None and active.match_id and active.match not in matchs:
        matchs.insert(0, active.match)

    donnees = {
        "equipe": equipe.nom,
        "joueurs": [_fiche_joueur(j) for j in joueurs],
        "etat": etat,
        "dispositifs": [
            {"value": valeur, "nom": libelle.split(" ", 1)[1] if " " in libelle else ""}
            for valeur, libelle in Composition.Dispositif.choices
        ],
        "nbTitulaires": NB_TITULAIRES,
        "nbRemplacants": NB_REMPLACANTS_MAX,
        "urlSauvegarde": reverse("entraineur:sauvegarder_composition"),
    }

    context = {
        "equipe": equipe,
        "coach": coach,
        "compositions": compositions,
        "composition_active": active,
        "matchs": matchs,
        "nb_joueurs": len(joueurs),
        "donnees": donnees,
    }
    return render(request, "entraineurApp/composition.html", context)


@composition_required
@require_POST
def supprimer_composition(request, pk):
    """Supprime une composition uniquement si elle appartient à l'équipe du principal."""
    coach = _entraineur_connecte(request)
    if coach is None or coach.equipe is None:
        messages.error(request, "Aucune équipe ne vous est affectée.")
        return redirect("joueurs:liste")

    compo = get_object_or_404(Composition, pk=pk, equipe=coach.equipe)
    nom = compo.nom
    compo.delete()
    messages.success(request, f"La composition « {nom} » a été supprimée.")
    return redirect("entraineur:composition")


def _reponse_erreurs(erreurs, status=400):
    return JsonResponse({"ok": False, "erreurs": erreurs}, status=status)


def _entier(valeur):
    if isinstance(valeur, bool):
        return None
    try:
        return int(valeur)
    except (TypeError, ValueError):
        return None


def _pourcentage(valeur, defaut=50.0):
    try:
        v = float(valeur)
    except (TypeError, ValueError):
        return defaut
    if v != v:  # NaN
        return defaut
    return min(100.0, max(0.0, v))


@composition_required
@require_POST
def sauvegarder_composition(request):
    """
    Enregistre (création ou mise à jour) une composition envoyée en JSON.
    Toutes les règles sont revérifiées ici : le navigateur n'est jamais cru sur parole.
    """
    coach = _entraineur_connecte(request)
    if coach is None or coach.equipe is None:
        return _reponse_erreurs(["Aucune équipe ne vous est affectée."], status=403)
    equipe = coach.equipe

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return _reponse_erreurs(["Données illisibles."])
    if not isinstance(data, dict):
        return _reponse_erreurs(["Données illisibles."])

    brut_titulaires = data.get("titulaires")
    brut_remplacants = data.get("remplacants")
    if not isinstance(brut_titulaires, list) or not isinstance(brut_remplacants, list):
        return _reponse_erreurs(["Données illisibles."])

    # --- 1. Structure ---------------------------------------------------
    erreurs = []

    dispositif = data.get("dispositif")
    if dispositif not in Composition.Dispositif.values:
        erreurs.append("Dispositif tactique inconnu.")

    titulaires = {}  # slot (1..11) -> infos
    for ligne in brut_titulaires:
        if not isinstance(ligne, dict):
            erreurs.append("Ligne de titulaire invalide.")
            break
        slot = _entier(ligne.get("slot_index"))
        joueur_id = _entier(ligne.get("joueur_id"))
        if slot is None or not 1 <= slot <= NB_TITULAIRES or joueur_id is None or slot in titulaires:
            erreurs.append("Position de titulaire invalide.")
            break
        titulaires[slot] = {
            "joueur_id": joueur_id,
            "poste_tactique": str(ligne.get("poste_tactique") or "")[:10],
            "x": _pourcentage(ligne.get("x")),
            "y": _pourcentage(ligne.get("y")),
        }
    if not erreurs and len(titulaires) != NB_TITULAIRES:
        erreurs.append(f"Il faut exactement {NB_TITULAIRES} titulaires.")

    remplacants = []  # (ordre, joueur_id)
    for ligne in brut_remplacants:
        if not isinstance(ligne, dict) or _entier(ligne.get("joueur_id")) is None:
            erreurs.append("Ligne de remplaçant invalide.")
            break
        ordre = _entier(ligne.get("slot_index"))
        remplacants.append((ordre if ordre is not None else 999, _entier(ligne.get("joueur_id"))))
    remplacants.sort()
    if len(remplacants) > NB_REMPLACANTS_MAX:
        erreurs.append(f"Pas plus de {NB_REMPLACANTS_MAX} remplaçants.")

    if erreurs:
        return _reponse_erreurs(erreurs)

    ids_titulaires = [titulaires[s]["joueur_id"] for s in sorted(titulaires)]
    ids_remplacants = [joueur_id for _, joueur_id in remplacants]
    tous = ids_titulaires + ids_remplacants
    if len(set(tous)) != len(tous):
        return _reponse_erreurs(["Un joueur ne peut apparaître qu'une seule fois dans la composition."])

    # --- 2. Règles métier -------------------------------------------------
    joueurs = {j.pk: j for j in Joueur.objects.filter(pk__in=tous, equipe=equipe)}
    if any(i not in joueurs for i in tous):
        erreurs.append("Certains joueurs ne font pas partie de votre effectif.")
    else:
        indisponibles = [str(joueurs[i]) for i in tous if joueurs[i].statut != Joueur.Statut.DISPONIBLE]
        if indisponibles:
            erreurs.append("Joueur(s) indisponible(s) : " + ", ".join(indisponibles) + ".")
        if joueurs[titulaires[1]["joueur_id"]].poste != Joueur.Poste.GARDIEN:
            erreurs.append("Le poste n°1 doit être tenu par un gardien.")

    roles = {}
    for cle, champ in (
        ("capitaine", "capitaine_id"),
        ("tireur_penalty", "penalty_id"),
        ("tireur_coup_franc", "coup_franc_id"),
    ):
        valeur = data.get(champ)
        if valeur in (None, ""):
            roles[cle] = None
            continue
        joueur_id = _entier(valeur)
        if joueur_id is None or joueur_id not in ids_titulaires:
            erreurs.append("Le capitaine et les tireurs doivent faire partie des titulaires.")
            break
        roles[cle] = joueur_id

    match = None
    match_id = data.get("match_id")
    if match_id not in (None, ""):
        mid = _entier(match_id)
        if mid is not None:
            match = Match.objects.filter(
                Q(equipe_domicile=equipe) | Q(equipe_exterieur=equipe), pk=mid
            ).first()
        if match is None:
            erreurs.append("Le match sélectionné ne concerne pas votre équipe.")

    if erreurs:
        return _reponse_erreurs(erreurs)

    nom = str(data.get("nom") or "").strip()[:120] or "Feuille de Match Principale"
    notes = str(data.get("notes") or "").strip()[:2000]

    # --- 3. Enregistrement atomique ----------------------------------------
    with transaction.atomic():
        compo_id = _entier(data.get("id"))
        if compo_id:
            compo = Composition.objects.filter(pk=compo_id, equipe=equipe).first()
            if compo is None:
                return _reponse_erreurs(["Composition introuvable."], status=404)
        else:
            compo = Composition(equipe=equipe, entraineur=coach)

        compo.nom = nom
        compo.dispositif = dispositif
        compo.match = match
        compo.capitaine_id = roles["capitaine"]
        compo.tireur_penalty_id = roles["tireur_penalty"]
        compo.tireur_coup_franc_id = roles["tireur_coup_franc"]
        compo.notes_tactiques = notes
        compo.save()

        compo.joueurs_compo.all().delete()
        lignes = [
            JoueurComposition(
                composition=compo,
                joueur_id=infos["joueur_id"],
                est_titulaire=True,
                slot_index=slot,
                poste_tactique=infos["poste_tactique"],
                position_x=infos["x"],
                position_y=infos["y"],
            )
            for slot, infos in sorted(titulaires.items())
        ]
        lignes += [
            JoueurComposition(
                composition=compo,
                joueur_id=joueur_id,
                est_titulaire=False,
                slot_index=ordre,
            )
            for ordre, joueur_id in enumerate(ids_remplacants, start=1)
        ]
        JoueurComposition.objects.bulk_create(lignes)

    return JsonResponse(
        {
            "ok": True,
            "id": compo.pk,
            "url": reverse("entraineur:composition_detail", args=[compo.pk]),
            "nom": compo.nom,
            "dispositif": compo.dispositif,
            "maj": timezone.localtime(compo.date_mise_a_jour).strftime("%d/%m à %H:%M"),
            "message": "Composition enregistrée.",
        }
    )
