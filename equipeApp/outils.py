"""Outils partagés par les modules Équipes et Présidents (recherche, validateurs, images).

Repris du CRUD de Souha ; ils ne dépendent d'aucun autre module du projet.
"""
import os
import re
import unicodedata
from datetime import date, datetime

from django.core.exceptions import ValidationError


# ─────────────────────────── Données Géographiques Réelles ───────────────────────────
PAYS_VILLES_MONDE = {
    "Tunisie": [
        "Tunis", "Sfax", "Sousse", "Kairouan", "Bizerte", "Gabès", "Ariana", "Gafsa",
        "Monastir", "Ben Arous", "Kasserine", "Médenine", "Nabeul", "Tataouine", "Béja",
        "Le Kef", "Mahdia", "Sidi Bouzid", "Jendouba", "Tozeur", "La Manouba", "Siliana",
        "Zaghouan", "Kébili", "La Marsa", "Le Bardo", "Carthage", "Hammamet", "Djerba", "Zarzis", "Mornag", "Radès"
    ],
    "France": [
        "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg",
        "Bordeaux", "Lille", "Rennes", "Reims", "Saint-Étienne", "Toulon", "Le Havre", "Grenoble",
        "Dijon", "Angers", "Villeurbanne", "Saint-Denis", "Nîmes", "Clermont-Ferrand", "Le Mans",
        "Aix-en-Provence", "Brest", "Tours", "Amiens", "Limoges", "Annecy", "Perpignan", "Metz", "Besançon", "Orléans", "Rouen", "Caen", "Nancy"
    ],
    "Algérie": [
        "Alger", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Djelfa", "Sétif",
        "Sidi Bel Abbès", "Biskra", "Tébessa", "El Oued", "Skikda", "Tiaret", "Béjaïa",
        "Tlemcen", "Ouargla", "Mostaganem", "Bordj Bou Arréridj", "Chlef", "Souk Ahras", "Médéa", "Béchar"
    ],
    "Maroc": [
        "Casablanca", "Rabat", "Fès", "Tanger", "Marrakech", "Salé", "Meknès", "Oujda",
        "Kénitra", "Agadir", "Tétouan", "Témara", "Safi", "Mohammédia", "Khouribga", "El Jadida",
        "Béni Mellal", "Nador", "Taza", "Settat", "Berrechid", "Khémisset", "Guelmim", "Laâyoune"
    ],
    "Égypte": [
        "Le Caire", "Alexandrie", "Gizeh", "Choubra El-Kheïma", "Port-Saïd", "Suez", "Louxor",
        "Mansourah", "El-Mahalla El-Koubra", "Tanta", "Assiout", "Ismaïlia", "Fayoum", "Zagazig", "Assouan", "Damiette"
    ],
    "Libye": [
        "Tripoli", "Benghazi", "Misrata", "Al Bayda", "Az Zawiyah", "Zliten", "Tobrouk", "Syrte", "Sabha", "Derna"
    ],
    "Espagne": [
        "Madrid", "Barcelone", "Valence", "Séville", "Saragosse", "Malaga", "Murcie", "Palma de Majorque",
        "Las Palmas", "Bilbao", "Alicante", "Cordoue", "Valladolid", "Vigo", "Gijón", "La Corogne", "Grenade", "Elche", "Oviedo", "Badalone", "Carthagène", "Terrassa", "Jerez de la Frontera", "Sabadell", "Santa Cruz de Tenerife", "Pampelune", "Almería"
    ],
    "Italie": [
        "Rome", "Milan", "Naples", "Turin", "Palerme", "Gênes", "Bologne", "Florence", "Bari",
        "Catane", "Venise", "Vérone", "Messine", "Padoue", "Trieste", "Brescia", "Tarente", "Prato",
        "Parme", "Modène", "Reggio de Calabre", "Pérouse", "Livourne", "Ravenne", "Cagliari", "Foggia", "Rimini", "Salerne", "Ferrare", "Monza"
    ],
    "Allemagne": [
        "Berlin", "Hambourg", "Munich", "Cologne", "Francfort-sur-le-Main", "Stuttgart", "Düsseldorf",
        "Leipzig", "Dortmund", "Essen", "Brême", "Dresde", "Hanovre", "Nuremberg", "Duisbourg",
        "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsbourg", "Wiesbaden", "Gelsenkirchen", "Mönchengladbach", "Kiel", "Aix-la-Chapelle"
    ],
    "Angleterre": [
        "Londres", "Manchester", "Birmingham", "Liverpool", "Leeds", "Sheffield", "Bristol",
        "Newcastle", "Nottingham", "Leicester", "Southampton", "Portsmouth", "Coventry", "Bradford",
        "Stoke-on-Trent", "Wolverhampton", "Derby", "Plymouth", "Reading", "Brighton"
    ],
    "Royaume-Uni": [
        "Londres", "Manchester", "Birmingham", "Liverpool", "Leeds", "Édimbourg", "Glasgow", "Cardiff", "Belfast", "Bristol", "Newcastle"
    ],
    "Portugal": [
        "Lisbonne", "Porto", "Vila Nova de Gaia", "Amadora", "Braga", "Funchal", "Coimbra", "Setúbal",
        "Almada", "Queluz", "Agualva-Cacém", "Barreiro", "Aveiro", "Guimarães", "Cascais", "Leiria", "Faro"
    ],
    "Belgique": [
        "Bruxelles", "Anvers", "Gand", "Charleroi", "Liège", "Bruges", "Namur", "Louvain", "Mons", "Alost", "Malines", "Ostende", "Tournai", "Genk"
    ],
    "Pays-Bas": [
        "Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Eindhoven", "Tilbourg", "Groningue", "Almere", "Breda", "Nimègue", "Enschede", "Haarlem", "Arnhem", "Maastricht"
    ],
    "Suisse": [
        "Zurich", "Genève", "Bâle", "Lausanne", "Berne", "Winterthour", "Lucerne", "Saint-Gall", "Lugano", "Bienne", "Thoune", "Fribourg", "Sion", "Neuchâtel"
    ],
    "Arabie saoudite": [
        "Riyad", "Djeddah", "La Mecque", "Médine", "Dammam", "Taëf", "Tabouk", "Buraidah", "Khamis Mushait", "Al-Hufuf", "Al-Khobar", "Abha", "Najran", "Yanbu"
    ],
    "Qatar": [
        "Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Umm Salal", "Al Daayen", "Madinat ash Shamal", "Mesaieed", "Dukhan", "Lusail"
    ],
    "Émirats arabes unis": [
        "Dubaï", "Abou Dabi", "Sharjah", "Al Ain", "Ajman", "Ras el Khaïmah", "Fujaïrah", "Umm al Qaïwain", "Khor Fakkan"
    ],
    "Turquie": [
        "Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Sanliurfa", "Kocaeli", "Mersin", "Diyarbakir", "Hatay", "Kayseri", "Samsun", "Trabzon"
    ],
    "Brésil": [
        "São Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus",
        "Curitiba", "Recife", "Porto Alegre", "Belém", "Goiânia", "Guarulhos", "Campinas", "Santos"
    ],
    "Argentine": [
        "Buenos Aires", "Córdoba", "Rosario", "Mendoza", "San Miguel de Tucumán", "La Plata", "Mar del Plata", "Salta", "Santa Fe", "San Juan"
    ],
    "Sénégal": [
        "Dakar", "Touba", "Thiès", "Rufisque", "Kaolack", "M'bour", "Ziguinchor", "Saint-Louis", "Diourbel", "Louga", "Tambacounda"
    ],
    "Côte d'Ivoire": [
        "Abidjan", "Bouaké", "Daloa", "Korhogo", "Yamoussoukro", "San-Pédro", "Gagnoa", "Man", "Divo", "Grand-Bassam"
    ],
    "Cameroun": [
        "Douala", "Yaoundé", "Garoua", "Bamenda", "Maroua", "Bafoussam", "Ngaoundéré", "Bertoua", "Kumba"
    ],
    "Nigéria": [
        "Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt", "Benin City", "Maiduguri", "Zaria", "Aba", "Jos", "Enugu"
    ],
    "États-Unis": [
        "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphie", "San Antonio", "San Diego",
        "Dallas", "San Jose", "Austin", "Jacksonville", "San Francisco", "Seattle", "Denver", "Washington", "Boston", "Miami", "Atlanta"
    ],
    "Canada": [
        "Toronto", "Montréal", "Calgary", "Ottawa", "Edmonton", "Winnipeg", "Vancouver", "Québec", "Laval", "Halifax"
    ],
    "Japon": [
        "Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Kobe", "Kyoto", "Fukuoka", "Kawasaki", "Hiroshima"
    ],
    "Grèce": ["Athènes", "Thessalonique", "Patras", "Héraklion", "Larissa", "Volos"],
    "Russie": ["Moscou", "Saint-Pétersbourg", "Novossibirsk", "Iekaterinbourg", "Kazan", "Nijni Novgorod"],
    "Croatie": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Dubrovnik"],
    "Serbie": ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Subotica"],
    "Pologne": ["Varsovie", "Cracovie", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin"],
    "Autriche": ["Vienne", "Graz", "Linz", "Salzbourg", "Innsbruck", "Klagenfurt"],
    "Suède": ["Stockholm", "Göteborg", "Malmö", "Uppsala", "Västerås", "Örebro"],
    "Norvège": ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Tromsø"],
    "Danemark": ["Copenhague", "Aarhus", "Odense", "Aalborg", "Esbjerg"],
    "Colombie": ["Bogota", "Medellín", "Cali", "Barranquilla", "Carthagène des Indes", "Bucaramanga"],
    "Chili": ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta"],
    "Uruguay": ["Montevideo", "Salto", "Ciudad de la Costa", "Paysandú", "Maldonado"],
    "Mexique": ["Mexico", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Juárez"],
    "Afrique du Sud": ["Johannesbourg", "Le Cap", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein"],
    "Ghana": ["Accra", "Kumasi", "Tamale", "Sekondi-Takoradi", "Sunyani", "Cape Coast"],
    "Mali": ["Bamako", "Sikasso", "Mopti", "Koutiala", "Kayes", "Ségou"],
    "Koweït": ["Koweït", "Al Ahmadi", "Hawalli", "Salmiya", "Sabah Al Salem"],
    "Bahreïn": ["Manama", "Riffa", "Muharraq", "Hamad Town"],
    "Oman": ["Mascate", "Seeb", "Salalah", "Bawshar", "Sohar"],
    "Jordanie": ["Amman", "Zarqa", "Irbid", "Russeifa", "Aqaba"],
    "Liban": ["Beyrouth", "Tripoli", "Sidon", "Tyr", "Nabatieh", "Jounieh", "Zahlé"],
}

# Tous les pays reconnus dans le monde
PAYS_LISTE = sorted(list(PAYS_VILLES_MONDE.keys()))

# Nationalités reconnues (adjectif et pays)
NATIONALITES_MAP = {
    "tunisienne": "Tunisienne", "tunisie": "Tunisienne",
    "française": "Française", "francais": "Française", "francaise": "Française", "france": "Française",
    "algérienne": "Algérienne", "algerienne": "Algérienne", "algérie": "Algérienne", "algerie": "Algérienne",
    "marocaine": "Marocaine", "maroc": "Marocaine",
    "égyptienne": "Égyptienne", "egyptienne": "Égyptienne", "égypte": "Égyptienne", "egypte": "Égyptienne",
    "libyenne": "Libyenne", "libye": "Libyenne",
    "espagnole": "Espagnole", "espagne": "Espagnole",
    "italienne": "Italienne", "italie": "Italienne",
    "allemande": "Allemande", "allemagne": "Allemande",
    "anglaise": "Anglaise", "britannique": "Britannique", "angleterre": "Anglaise", "royaume-uni": "Britannique",
    "portugaise": "Portugaise", "portugal": "Portugaise",
    "brésilienne": "Brésilienne", "bresilienne": "Brésilienne", "brésil": "Brésilienne", "bresil": "Brésilienne",
    "argentine": "Argentine",
    "qatarienne": "Qatarienne", "qatar": "Qatarienne",
    "saoudienne": "Saoudienne", "arabie saoudite": "Saoudienne",
    "émiratie": "Émiratie", "emiratie": "Émiratie", "émirats arabes unis": "Émiratie",
    "américaine": "Américaine", "americaine": "Américaine", "états-unis": "Américaine", "etats-unis": "Américaine",
    "belge": "Belge", "belgique": "Belge",
    "néerlandaise": "Néerlandaise", "neerlandaise": "Néerlandaise", "pays-bas": "Néerlandaise", "hollandaise": "Néerlandaise",
    "suisse": "Suisse",
    "turque": "Turque", "turquie": "Turque",
    "sénégalaise": "Sénégalaise", "senegalaise": "Sénégalaise", "sénégal": "Sénégalaise", "senegal": "Sénégalaise",
    "ivoirienne": "Ivoirienne", "côte d'ivoire": "Ivoirienne", "cote d'ivoire": "Ivoirienne",
    "camerounaise": "Camerounaise", "cameroun": "Camerounaise",
    "nigériane": "Nigériane", "nigeriane": "Nigériane", "nigéria": "Nigériane", "nigeria": "Nigériane",
    "canadienne": "Canadienne", "canada": "Canadienne",
    "japonaise": "Japonaise", "japon": "Japonaise",
    "grecque": "Grecque", "grèce": "Grecque", "grece": "Grecque",
    "croate": "Croate", "croatie": "Croate",
    "serbe": "Serbe", "serbie": "Serbe",
    "polonaise": "Polonaise", "pologne": "Polonaise",
    "autrichienne": "Autrichienne", "autriche": "Autrichienne",
    "suédoise": "Suédoise", "suedoise": "Suédoise", "suède": "Suédoise", "suede": "Suédoise",
    "norvégienne": "Norvégienne", "norvegienne": "Norvégienne", "norvège": "Norvégienne", "norvege": "Norvégienne",
    "danoise": "Danoise", "danemark": "Danoise",
    "colombienne": "Colombienne", "colombie": "Colombienne",
    "chilienne": "Chilienne", "chili": "Chilienne",
    "uruguayenne": "Uruguayenne", "uruguay": "Uruguayenne",
    "mexicaine": "Mexicaine", "mexique": "Mexicaine",
    "sud-africaine": "Sud-Africaine", "afrique du sud": "Sud-Africaine",
    "ghanéenne": "Ghanéenne", "ghaneenne": "Ghanéenne", "ghana": "Ghanéenne",
    "malienne": "Malienne", "mali": "Malienne",
    "koweïtienne": "Koweïtienne", "koweït": "Koweïtienne", "koweit": "Koweïtienne",
    "bahreïnienne": "Bahreïnienne", "bahreïn": "Bahreïnienne", "bahrein": "Bahreïnienne",
    "omanaise": "Omanaise", "oman": "Omanaise",
    "jordanienne": "Jordanienne", "jordanie": "Jordanienne",
    "libanaise": "Libanaise", "liban": "Libanaise",
    "russe": "Russe", "russie": "Russe",
}

NATIONALITES_SUGGESTIONS = sorted(list(set(NATIONALITES_MAP.values())))


def valider_pays(valeur):
    """Vérifie que le pays existe réellement dans le monde."""
    valeur = " ".join((valeur or "").strip().split())
    if not valeur:
        raise ValidationError("Le pays est obligatoire.")
    norm = normalize_text(valeur)
    for p in PAYS_VILLES_MONDE.keys():
        if normalize_text(p) == norm:
            return p
    raise ValidationError(f"Le pays « {valeur} » n'existe pas ou n'est pas reconnu dans le monde.")


def valider_ville(pays_nom, ville_nom):
    """Vérifie que la ville existe et appartient obligatoirement au pays choisi."""
    ville_nom = " ".join((ville_nom or "").strip().split())
    if not ville_nom:
        raise ValidationError("La ville est obligatoire.")
    pays_canonique = valider_pays(pays_nom)
    villes_connues = PAYS_VILLES_MONDE.get(pays_canonique, [])
    norm_v = normalize_text(ville_nom)
    for v in villes_connues:
        if normalize_text(v) == norm_v:
            return v
    raise ValidationError(
        f"La ville « {ville_nom} » n'appartient pas au pays sélectionné ({pays_canonique}) ou n'est pas reconnue."
    )


def valider_nationalite(valeur):
    """Vérifie que la nationalité correspond à un pays réel existant dans le monde."""
    valeur = " ".join((valeur or "").strip().split())
    if not valeur:
        raise ValidationError("La nationalité est obligatoire.")
    norm = normalize_text(valeur)
    for cle, canonique in NATIONALITES_MAP.items():
        if normalize_text(cle) == norm or normalize_text(canonique) == norm:
            return canonique
    raise ValidationError(
        f"La nationalité « {valeur} » n'existe pas ou ne correspond à aucun pays reconnu."
    )


# ─────────────────────────── Recherche ───────────────────────────
def normalize_text(text):
    """Minuscules et sans accents : sert au champ technique ``nom_recherche``."""
    if not text:
        return ""
    decompose = unicodedata.normalize("NFD", text)
    return "".join(c for c in decompose if unicodedata.category(c) != "Mn").lower()


def parse_date_input(value):
    """Date saisie au calendrier (AAAA-MM-JJ) ou à la main (JJ/MM/AAAA). None si invalide."""
    value = (value or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


# ─────────────────────────── Validateurs ───────────────────────────
def validate_letters_only(value):
    if len(value) < 2:
        raise ValidationError("Ce champ doit contenir au moins 2 caractères.")
    if not re.match(r"^[a-zA-ZÀ-ÿœŒæÆ\s\-']+$", value):
        raise ValidationError("Ce champ ne doit contenir que des lettres, espaces et tirets.")


def validate_not_future(value):
    if value > date.today():
        raise ValidationError("La date ne peut pas être dans le futur.")


def age_a_la_date(naissance, ref=None):
    ref = ref or date.today()
    return ref.year - naissance.year - ((ref.month, ref.day) < (naissance.month, naissance.day))


def validate_min_age_18(value):
    if age_a_la_date(value) < 18:
        raise ValidationError("Le président doit avoir au moins 18 ans.")


def validate_password_strength(value):
    """8 caractères minimum, 1 majuscule, 1 chiffre et 1 caractère spécial."""
    manque = []
    if len(value) < 8:
        manque.append("8 caractères minimum")
    if not re.search(r"[A-Z]", value):
        manque.append("1 majuscule")
    if not re.search(r"\d", value):
        manque.append("1 chiffre")
    if not re.search(r"[^A-Za-z0-9\s]", value):
        manque.append("1 caractère spécial")
    if manque:
        raise ValidationError("Mot de passe requis : " + " • ".join(manque))


def validate_url_scheme(value):
    if value and not value.startswith(("http://", "https://")):
        raise ValidationError("L'URL doit commencer par http:// ou https://.")


def erreurs_image(fichier, taille_max_mo=2):
    """Contrôle d'un fichier envoyé : extension JPG/PNG, contenu réel (Pillow), taille."""
    erreurs = []
    if fichier is None:
        return erreurs
    if fichier.size > taille_max_mo * 1024 * 1024:
        erreurs.append(f"Le fichier est trop volumineux (max {taille_max_mo} Mo).")
    if os.path.splitext(fichier.name)[1].lower() not in {".jpg", ".jpeg", ".png"}:
        erreurs.append("Format non autorisé. Utilisez JPG ou PNG.")
    try:
        from PIL import Image

        fichier.seek(0)
        if Image.open(fichier).format not in ("JPEG", "PNG"):
            erreurs.append("Le contenu du fichier n'est pas une image JPG ou PNG valide.")
        fichier.seek(0)
    except Exception:
        erreurs.append("Le fichier n'est pas une image valide.")
    return erreurs


def telephone_international(valeur, region="TN"):
    """Normalise un numéro au format international (+216…).
    Si aucun indicatif n'est renseigné, le numéro est considéré comme tunisien (+216).
    L'indicatif est modifiable et les numéros étrangers avec leur propre indicatif sont acceptés.
    """
    valeur = (valeur or "").strip()
    if not valeur:
        return ""
    # Si aucun indicatif (+ ou 00), considérer comme tunisien (+216)
    chiffres_propres = re.sub(r"[\s().-]", "", valeur)
    if not chiffres_propres.startswith("+"):
        if chiffres_propres.startswith("00"):
            valeur = "+" + chiffres_propres[2:]
        else:
            valeur = "+216" + chiffres_propres
    try:
        import phonenumbers
        num = phonenumbers.parse(valeur, None)
        if not phonenumbers.is_valid_number(num):
            raise ValidationError("Numéro de téléphone invalide.")
        return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    except Exception:
        chiffres = re.sub(r"[\s().-]", "", valeur)
        if not re.fullmatch(r"\+\d{8,15}", chiffres):
            raise ValidationError("Numéro de téléphone invalide (ex : +216 20 123 456 ou +33 6 12 34 56 78).")
        return chiffres
