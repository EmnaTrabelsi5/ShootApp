from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UtilisateurManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # stocke le hash (motDePasseHash)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Utilisateur.Role.ADMIN)
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("Un superuser doit avoir is_staff=True et is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    """Classe mère : Joueur, Scout, President, Staff et Entraineur en héritent."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrateur"
        JOUEUR = "JOUEUR", "Joueur"
        SCOUT = "SCOUT", "Scout"
        PRESIDENT = "PRESIDENT", "Président"
        STAFF = "STAFF", "Staff"
        ENTRAINEUR = "ENTRAINEUR", "Entraîneur"

    # idUtilisateur -> clé primaire "id" auto
    # motDePasseHash -> champ "password" hérité de AbstractBaseUser (hashé)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField(null=True, blank=True)
    email = models.EmailField(unique=True)
    telephone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    photo = models.ImageField(upload_to="utilisateurs/", null=True, blank=True)
    is_active = models.BooleanField("actif", default=True)
    is_staff = models.BooleanField(default=False)  # accès à l'admin Django
    date_inscription = models.DateTimeField(default=timezone.now)

    objects = UtilisateurManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nom", "prenom"]

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self):
        return f"{self.prenom} {self.nom}"
