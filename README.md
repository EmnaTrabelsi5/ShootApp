# ShootApp — Projet Final Intégré

Ce dossier contient l'ensemble du projet Django **ShootApp** entièrement intégré avec toutes les améliorations et fonctionnalités demandées :

## Contenu du projet
- `equipeApp/` : Module de gestion complète des équipes (CRUD, validations pays/villes réels, logo obligatoire en haut, encadrement avec entraîneur obligatoire, affectation multiple des joueurs, statistiques dynamiques).
- `presidentApp/` : Module de gestion des présidents (CRUD, photo en haut, adresse, indicatif +216, nationalité réelle, contrainte d'âge 18 ans, calcul automatique de la durée de présidence).
- `competitionApp/` : Calendrier, matchs et compétitions.
- `joueurApp/` : Gestion du vestiaire et effectif des joueurs.
- `entraineurApp/` : Gestion des entraîneurs.
- `staffApp/` : Membres du staff technique.
- `scoutApp/` : Recrutement et rapports de scouting.
- `training/` : Planification des séances d'entraînement.
- `utilisateurApp/` : Authentification et comptes utilisateurs.
- `static/` : Feuilles de style (`css/equipes.css`, `css/yalla.css`, `css/footlab.css`) et scripts dynamiques (`js/equipes.js`).
- `templates/` : Templates globaux (`base.html`, `accueil.html`).
- `db.sqlite3` : Base de données SQLite configurée et migrée.
- `manage.py` : Script d'administration Django.

## Commandes utiles
- Lancer le serveur de développement :
  ```bash
  python manage.py runserver 8004
  ```
- Exécuter les tests :
  ```bash
  python manage.py test equipeApp presidentApp
  ```
- Vérifier l'état du système :
  ```bash
  python manage.py check
  ```
