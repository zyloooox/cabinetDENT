-- Création de la base de données
CREATE DATABASE IF NOT EXISTS cabinet_dentaire;
USE cabinet_dentaire;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    civilite ENUM('M', 'Mme', 'Mlle') DEFAULT 'M',
    date_naissance DATE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telephone VARCHAR(20) NOT NULL,
    adresse TEXT,
    password VARCHAR(255) NOT NULL,
    newsletter TINYINT DEFAULT 0,
    photo_url VARCHAR(500) NULL,
    role ENUM('patient', 'medecin', 'admin') DEFAULT 'patient',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_telephone (telephone)
);

-- Table des patients (dossier médical)
CREATE TABLE IF NOT EXISTS patients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    nom_complet VARCHAR(150) NOT NULL,
    genre ENUM('M', 'F') DEFAULT 'M',
    date_naissance DATE NOT NULL,
    telephone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    adresse TEXT,
    medecin_traitant ENUM('ilhem', 'chakib') DEFAULT 'ilhem',
    notes_medicales TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_nom (nom_complet),
    INDEX idx_telephone (telephone),
    INDEX idx_medecin (medecin_traitant)
);

-- Table des services
CREATE TABLE IF NOT EXISTS services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    categorie VARCHAR(50) NOT NULL,
    description TEXT,
    prix_min DECIMAL(10,2),
    prix_max DECIMAL(10,2),
    image_url VARCHAR(255),
    actif TINYINT DEFAULT 1,
    ordre_affichage INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des rendez-vous
CREATE TABLE IF NOT EXISTS appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    service_id INT NULL,
    date_consultation DATE NOT NULL,
    heure_consultation TIME,
    duree_estimee INT DEFAULT 30,
    montant_total DECIMAL(10,2) DEFAULT 0,
    montant_paye DECIMAL(10,2) DEFAULT 0,
    statut_paiement ENUM('non-payé', 'partiellement-payé', 'payé') DEFAULT 'non-payé',
    statut_rdv ENUM('planifié', 'confirmé', 'terminé', 'annulé') DEFAULT 'planifié',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    INDEX idx_date (date_consultation),
    INDEX idx_statut (statut_rdv),
    INDEX idx_patient (patient_id)
);

-- Table des paiements (traçabilité)
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    montant DECIMAL(10,2) NOT NULL,
    mode_paiement ENUM('especes', 'carte', 'cheque', 'virement') DEFAULT 'especes',
    reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- Insertion des services par défaut
INSERT INTO services (nom, categorie, description, prix_min, prix_max, ordre_affichage) VALUES
('Consultation', 'Soins Généraux', 'Examen complet et diagnostic', 70, 70, 1),
('Détartrage', 'Soins Généraux', 'Nettoyage et polissage des dents', 100, 100, 2),
('Soin carie', 'Soins Généraux', 'Obturation composite', 80, 160, 3),
('Dévitalisation', 'Soins Généraux', 'Traitement de canal', 250, 400, 4),
('Extraction', 'Soins Généraux', 'Extraction dentaire simple', 100, 100, 5),
('Blanchiment', 'Esthétique', 'Blanchiment au cabinet', 500, 500, 6),
('Facette', 'Esthétique', 'Facettes en céramique', 500, 700, 7),
('Couronne', 'Esthétique', 'Couronne céramique', 450, 450, 8),
('Bridge', 'Esthétique', 'Bridge 3 unités', 1200, 1200, 9),
('Implant', 'Implantologie', 'Pose d\'implant dentaire', 1000, 1000, 10),
('Couronne sur implant', 'Implantologie', 'Couronne sur implant', 650, 650, 11),
('Greffe osseuse', 'Implantologie', 'Greffe osseuse', 500, 850, 12),
('Radio panoramique', 'Radiologie', 'Radio panoramique dentaire', 50, 50, 13),
('Radio rétro-alvéolaire', 'Radiologie', 'Radio rétro-alvéolaire', 30, 30, 14),
('Scanner 3D', 'Radiologie', 'Scanner dentaire 3D', 200, 200, 15);

-- Admin + 2 médecins fixes du cabinet (mot de passe initial pour les 3 : password — hash bcrypt)
INSERT INTO users (nom, prenom, civilite, date_naissance, email, telephone, password, role) VALUES
('Admin', 'System', 'M', '1990-01-01', 'admin@cabinetdentaire.com', '70000000', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Trabelsi Bougatef', 'Ilhem', 'Mme', '1975-06-01', 'dr.ilhem.trabelsi@cabinetbougatef.com', '70000001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'medecin'),
('Bougatef', 'Mohamed Chakib', 'M', '1973-04-10', 'dr.chakib.bougatef@cabinetbougatef.com', '70000002', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'medecin');

-- Insertion d'un patient test
INSERT INTO patients (nom_complet, genre, date_naissance, telephone, email, medecin_traitant) VALUES
('Jean Dupont', 'M', '1985-03-15', '12345678', 'jean.dupont@email.com', 'ilhem');

INSERT INTO appointments (patient_id, date_consultation, montant_total, montant_paye, statut_paiement) VALUES
(1, CURDATE(), 70, 0, 'non-payé');