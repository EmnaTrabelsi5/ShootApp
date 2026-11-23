from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods

from utilisateurApp.roles import peut_gerer_joueurs

from .forms import JoueurForm
from .models import Joueur

def gestion_joueurs(vue):
    """Ajouter / modifier / supprimer : réservé au président, à l'entraîneur et à l'admin."""
    @login_required
    @wraps(vue)
    def verifie(request, *args, **kwargs):
        if not peut_gerer_joueurs(request.user):
            messages.error(request, "Ton rôle te permet de consulter l'effectif, pas de le modifier.")
            return redirect("joueurs:liste")
        return vue(request, *args, **kwargs)
    return verifie


# Ordre d'affichage des lignes du vestiaire (gardien -> attaque)
GROUPES = [
    (Joueur.Poste.GARDIEN, "Gardiens", "gardien"),
    (Joueur.Poste.DEFENSEUR, "Défenseurs", "defense"),
    (Joueur.Poste.MILIEU, "Milieux", "milieu"),
    (Joueur.Poste.ATTAQUANT, "Attaquants", "attaque"),
]


def _stats(joueurs):
    """Indicateurs du haut de page, calculés sur tout l'effectif."""
    total = len(joueurs)
    dispo = sum(1 for j in joueurs if j.statut == Joueur.Statut.DISPONIBLE)
    blesses = sum(1 for j in joueurs if j.statut == Joueur.Statut.BLESSE)
    dispenses = sum(1 for j in joueurs if j.statut == Joueur.Statut.DISPENSE)
    ages = [j.age for j in joueurs if j.age is not None]
    return {
        "total": total,
        "dispo": dispo,
        "blesses": blesses,
        "dispenses": dispenses,
        "taux_dispo": round(dispo * 100 / total, 1) if total else 0,
        "age_moyen": round(sum(ages) / len(ages), 1) if ages else None,
        "par_poste": {code: sum(1 for j in joueurs if j.poste == code) for code, _, _ in GROUPES},
    }


def _kg(poids):
    """80.00 -> "80", 72.50 -> "72.5" (sans notation scientifique)."""
    if poids is None:
        return ""
    txt = f"{poids:f}"
    return txt.rstrip("0").rstrip(".") if "." in txt else txt


def _fiche(j):
    """Données d'un joueur pour pré-remplir le panneau de modification (JS)."""
    return {
        "id": j.pk,
        "prenom": j.prenom,
        "nom": j.nom,
        "email": j.email,
        "telephone": j.telephone,
        "date_naissance": j.date_naissance.isoformat() if j.date_naissance else "",
        "nationalite": j.nationalite,
        "poste": j.poste,
        "statut": j.statut,
        "numero_maillot": j.numero_maillot or "",
        "pied_fort": j.pied_fort,
        "taille_cm": j.taille_cm or "",
        "poids_kg": _kg(j.poids_kg),
        "equipe": j.equipe_id or "",
        "equipe_nom": str(j.equipe) if j.equipe_id else "",
        "age": j.age,
        "initiales": j.initiales,
        "poste_label": j.get_poste_display(),
        "statut_label": j.get_statut_display(),
        "pied_label": j.get_pied_fort_display() if j.pied_fort else "",
        "photo": j.photo.url if j.photo else "",
        "modifier": reverse("joueurs:modifier", args=[j.pk]),
        "supprimer": reverse("joueurs:supprimer", args=[j.pk]),
    }


def _correspond(j, q, poste, statut):
    if poste and j.poste != poste:
        return False
    if statut and j.statut != statut:
        return False
    if q:
        texte = f"{j.prenom} {j.nom} {j.nationalite} {j.numero_maillot or ''}".lower()
        return q.lower() in texte
    return True


def _render_vestiaire(request, form=None, joueur_edit=None, joueur_suppr=None, status=200):
    """Page Vestiaire : tous les joueurs sont rendus, les filtres sont appliqués
    côté navigateur (animations) ; sans JavaScript, l'attribut hidden filtre."""
    ordre = {code: i for i, (code, _, _) in enumerate(GROUPES)}
    tous = sorted(
        Joueur.objects.select_related("equipe"),
        key=lambda j: (ordre.get(j.poste, 9), j.numero_maillot or 100, j.nom),
    )

    q = request.GET.get("q", "").strip()
    poste = request.GET.get("poste", "")
    poste = poste if poste in Joueur.Poste.values else ""
    statut = request.GET.get("statut", "")
    statut = statut if statut in Joueur.Statut.values else ""
    for j in tous:
        j.visible = _correspond(j, q, poste, statut)

    stats = _stats(tous)
    css = {code: c for code, _, c in GROUPES}
    repartition = [
        (code, titre, css[code], stats["par_poste"][code],
         round(stats["par_poste"][code] * 100 / stats["total"], 1) if stats["total"] else 0)
        for code, titre, _ in GROUPES
    ]

    if form is None:
        initial = {"statut": Joueur.Statut.DISPONIBLE, "poste": Joueur.Poste.MILIEU}
        if request.GET.get("nouveau_poste") in Joueur.Poste.values:
            initial["poste"] = request.GET["nouveau_poste"]
        form = JoueurForm(initial=initial)
        form_ouvert = request.GET.get("nouveau") == "1"
    else:
        form_ouvert = True

    context = {
        "joueurs": tous,
        "fiches": {str(j.pk): _fiche(j) for j in tous},
        "nb_visibles": sum(1 for j in tous if j.visible),
        "stats": stats,
        "repartition": repartition,
        "q": q,
        "poste_actif": poste,
        "statut_actif": statut,
        "statuts": [
            ("DISPONIBLE", "Disponibles", "disponible", stats["dispo"]),
            ("DISPENSE", "Dispensés", "dispense", stats["dispenses"]),
            ("BLESSE", "Blessés", "blesse", stats["blesses"]),
        ],
        "form": form,
        "form_ouvert": form_ouvert,
        "joueur_edit": joueur_edit,
        "form_action": (
            reverse("joueurs:modifier", args=[joueur_edit.pk]) if joueur_edit else reverse("joueurs:ajouter")
        ),
        "joueur_suppr": joueur_suppr,
        "postes_css": css,
        "peut_modifier": peut_gerer_joueurs(request.user),
        # Porte-maillots : un groupe par poste, dans l'ordre gardien -> attaque
        "rail": [
            (code, titre, css[code], [j for j in tous if j.poste == code])
            for code, titre, _ in GROUPES
        ],
    }
    return render(request, "joueurApp/vestiaire.html", context, status=status)


@login_required
def liste_joueurs(request):
    return _render_vestiaire(request)


@login_required
def casiers(request):
    """Les casiers : une porte par joueur, rangés du gardien à l'attaque."""
    ordre = {code: i for i, (code, _, _) in enumerate(GROUPES)}
    tous = sorted(
        Joueur.objects.select_related("equipe"),
        key=lambda j: (ordre.get(j.poste, 9), j.numero_maillot or 100, j.nom),
    )
    css = {code: c for code, _, c in GROUPES}
    return render(request, "joueurApp/casiers.html", {
        "joueurs": tous,
        "fiches": {str(j.pk): _fiche(j) for j in tous},
        "groupes": [(code, titre, css[code], [j for j in tous if j.poste == code]) for code, titre, _ in GROUPES],
        "peut_modifier": peut_gerer_joueurs(request.user),
        "retour_label": "Retour aux casiers",
    })


@gestion_joueurs
@require_http_methods(["GET", "POST"])
def ajouter_joueur(request):
    if request.method == "GET":
        # Sans JavaScript : la page s'ouvre avec la popup d'ajout
        return _render_vestiaire(request, form=JoueurForm(initial={"statut": Joueur.Statut.DISPONIBLE}))
    form = JoueurForm(request.POST, request.FILES)
    if form.is_valid():
        joueur = form.save()
        messages.success(request, f"{joueur} a rejoint le vestiaire.")
        return redirect(f"{reverse('joueurs:liste')}#joueur-{joueur.pk}")
    return _render_vestiaire(request, form=form, status=400)


@gestion_joueurs
@require_http_methods(["GET", "POST"])
def modifier_joueur(request, pk):
    joueur = get_object_or_404(Joueur, pk=pk)
    if request.method == "POST":
        form = JoueurForm(request.POST, request.FILES, instance=joueur)
        if form.is_valid():
            joueur = form.save()
            messages.success(request, f"Fiche de {joueur} mise à jour.")
            return redirect(f"{reverse('joueurs:liste')}#joueur-{joueur.pk}")
        return _render_vestiaire(request, form=form, joueur_edit=joueur, status=400)
    return _render_vestiaire(request, form=JoueurForm(instance=joueur), joueur_edit=joueur)


@gestion_joueurs
@require_http_methods(["GET", "POST"])
def supprimer_joueur(request, pk):
    joueur = get_object_or_404(Joueur, pk=pk)
    if request.method == "POST":
        nom = str(joueur)
        joueur.delete()
        messages.success(request, f"{nom} a été retiré de l'effectif.")
        return redirect("joueurs:liste")
    # Sans JavaScript : la page s'ouvre avec la confirmation
    return _render_vestiaire(request, joueur_suppr=joueur)
