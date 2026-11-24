from django.db import migrations


JOUEURS_DEMO = [
    ("Sami", "Ben Salem", "GB", 1),
    ("Fares", "Kammoun", "DEF", 2),
    ("Nizar", "Jlassi", "DEF", 3),
    ("Wassim", "Mabrouk", "DEF", 4),
    ("Moez", "Haddad", "DEF", 5),
    ("Anis", "Baccar", "MIL", 6),
    ("Marwen", "Gharbi", "MIL", 8),
    ("Seif", "Trabelsi", "MIL", 10),
    ("Bilel", "Kefi", "ATT", 7),
    ("Yassine", "Saidi", "ATT", 9),
    ("Omar", "Jaziri", "ATT", 11),
    ("Ala", "Mansour", "GB", 12),
    ("Tarek", "Hachicha", "DEF", 13),
    ("Fathi", "Bouaziz", "DEF", 14),
    ("Maher", "Dhouib", "MIL", 15),
    ("Rayan", "Khalfallah", "MIL", 16),
    ("Hatem", "Ben Amor", "ATT", 18),
]


def ajouter_ock_et_effectif(apps, schema_editor):
    Equipe = apps.get_model("equipeApp", "Equipe")
    Joueur = apps.get_model("joueurApp", "Joueur")
    db_alias = schema_editor.connection.alias

    equipe, _ = Equipe.objects.using(db_alias).get_or_create(
        nom="Océano Club de Kerkennah",
        defaults={
            "ville": "Kerkennah",
            "niveau": "Senior",
        },
    )

    joueurs_existants = Joueur.objects.using(db_alias).filter(equipe_id=equipe.pk)
    if joueurs_existants.count() >= 11 and joueurs_existants.filter(poste="GB").exists():
        return

    numeros_utilises = set(
        joueurs_existants.exclude(numero_maillot__isnull=True).values_list("numero_maillot", flat=True)
    )
    emails_existants = set(
        Joueur.objects.using(db_alias).values_list("email", flat=True)
    )
    for prenom, nom, poste, numero in JOUEURS_DEMO:
        email = f"ock.demo.{numero}@example.invalid"
        if email in emails_existants or numero in numeros_utilises:
            continue
        Joueur.objects.using(db_alias).create(
            email=email,
            password="!",
            nom=nom,
            prenom=prenom,
            role="JOUEUR",
            is_active=False,
            poste=poste,
            statut="DISPONIBLE",
            pied_fort="DROIT",
            numero_maillot=numero,
            nationalite="Tunisienne",
            equipe_id=equipe.pk,
        )
        numeros_utilises.add(numero)
        emails_existants.add(email)


class Migration(migrations.Migration):

    dependencies = [
        ("equipeApp", "0002_initial"),
        ("joueurApp", "0002_joueur_statut"),
    ]

    operations = [
        migrations.RunPython(ajouter_ock_et_effectif, migrations.RunPython.noop),
    ]
