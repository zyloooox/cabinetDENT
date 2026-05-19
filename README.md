# Cabinet Dentaire Bougatef

Site web pour un cabinet dentaire avec gestion des patients, rendez-vous et services.

## 👥 Équipe
* **Bougatef Azza** - Backend (PHP, MySQL)
* **Ajroud Oussema** - Frontend (JavaScript)

## 🛠️ Technologies
* HTML / CSS
* JavaScript
* PHP / MySQL

## 🚀 Installation
1. Copier le dossier du projet dans le répertoire `htdocs` (XAMPP).
2. Importer le fichier `backend/database.sql` dans **phpMyAdmin**.
3. Copier le fichier `backend/db-config.example.php` et le renommer en `backend/db-config.php`.
4. Configurer vos identifiants de base de données dans `backend/db-config.php`.
5. Accéder à l'application via : `http://localhost/Cabinet_Dentaire/`

## ⚙️ Fonctionnalités

### Patients
* S'inscrire / se connecter
* Réserver une prestation
* Voir l'historique des soins
* Modifier son profil

### Médecins / Admin
* Gérer les patients
* Gérer les rendez-vous
* Gérer les services
* Gérer les comptes médecins (2 max)
* Voir les statistiques

## 📁 Structure du Projet

```text
Cabinet_Dentaire/
│
├── 📁 backend/                    # PHP (Bougatef Azza)
│   ├── auth.php                  # Authentification
│   ├── database.php              # Connexion BDD
│   ├── patients.php              # CRUD patients
│   ├── rdv-api.php               # Gestion rendez-vous
│   ├── services-api.php          # Gestion services
│   ├── admin-medecins-api.php    # Gestion médecins
│   ├── compte-api.php            # Espace patient
│   ├── stats.php                 # Statistiques
│   ├── database.sql              # Structure BDD
│   └── db-config.example.php     # Configuration exemple
│
├── 📁 frontend/                   # JavaScript (Ajroud Oussema)
│   ├── api-base.js               # URL base API
│   ├── nav-auth.js               # Menu dynamique
│   ├── gestion-patient.js        # CRUD patients
│   ├── gestion-rdv.js            # Gestion RDV
│   ├── gestion-services.js       # Gestion services
│   ├── gestion-medecins.js       # Gestion médecins
│   ├── mon-compte.js             # Espace patient
│   ├── inscription-connexion.js  # Auth
│   ├── reserver-rdv.js           # Réservation
│   ├── services-catalog.js       # Catalogue
│   └── index.js                  # Page d'accueil
│
├── 📁 html-css/                   # Pages statiques
│   ├── index.html
│   ├── medecins.html
│   ├── services.html
│   └── style.css
└── README.md
```

***

### ⚠️ Crucial Step Before You Drag and Drop
Since you are using PHP and database configs, **do not upload your actual database password!** 

1. Create a file named **`.gitignore`** in your root folder.
2. Write this single line inside it:
   ```text
   backend/db-config.php
   ```
3. This ensures that only `db-config.example.php` gets uploaded to GitHub, keeping your local database passwords private and safe.

Would you like help writing the **`db-config.example.php`** file structure or the connection code for **`database.php`** next?
