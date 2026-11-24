"""Données communes au bandeau et à la sidebar (templates/base.html)."""
from django.utils import timezone


def entete(request):
    now = timezone.localtime()
    annee = now.year if now.month >= 7 else now.year - 1  # saison de juillet à juin
    coach_nom, coach_initiales = "Coach", "CO"
    role_court, role_libelle, admin = "Invité", "Non connecté", False
    user = getattr(request, "user", None)
    a_dashboard = False
    peut_voir_staff = False
    peut_gerer_staff = False
    peut_gerer_compo = False

    if user is not None and user.is_authenticated:
        from utilisateurApp.roles import (
            LIBELLES,
            a_acces_dashboard,
            est_admin,
            peut_gerer_composition,
            peut_gerer_entraineurs,
            peut_voir_entraineurs,
        )

        coach_nom = f"{user.prenom} {user.nom}".strip() or user.email
        coach_initiales = f"{(user.prenom or ' ')[0]}{(user.nom or ' ')[0]}".strip().upper() or "CO"
        admin = est_admin(user)
        a_dashboard = a_acces_dashboard(user)
        peut_voir_staff = peut_voir_entraineurs(user)
        peut_gerer_staff = peut_gerer_entraineurs(user)
        peut_gerer_compo = peut_gerer_composition(user)
        role_court = "Admin" if admin else user.get_role_display()
        role_libelle = LIBELLES.get("ADMIN" if admin else user.role, role_court)

    prochain_match = None
    try:
        from competitionApp.models import Match

        prochain_match = (
            Match.objects.select_related("equipe_domicile", "equipe_exterieur", "competition")
            .filter(date_heure__gte=now, statut=Match.Statut.PROGRAMME)
            .order_by("date_heure")
            .first()
        )
    except Exception:  # la table peut ne pas exister (migrations non appliquées)
        prochain_match = None

    compte_a_rebours = None
    if prochain_match:
        jours = (timezone.localtime(prochain_match.date_heure).date() - now.date()).days
        compte_a_rebours = "Jour J" if jours == 0 else f"J-{jours}"

    return {
        "compte_a_rebours": compte_a_rebours,
        "aujourdhui": now.date(),
        "semaine": now.isocalendar().week,
        "saison": f"{annee}-{annee + 1}",
        "saison_courte": f"{annee % 100}/{(annee + 1) % 100}",
        "coach_nom": coach_nom,
        "coach_initiales": coach_initiales,
        "role_court": role_court,
        "role_libelle": role_libelle,
        "est_admin": admin,
        "a_acces_dashboard": a_dashboard,
        "peut_voir_entraineurs": peut_voir_staff,
        "peut_gerer_entraineurs": peut_gerer_staff,
        "peut_gerer_composition": peut_gerer_compo,
        "prochain_match": prochain_match,
    }
