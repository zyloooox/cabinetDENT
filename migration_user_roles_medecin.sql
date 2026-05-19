-- À exécuter une fois sur une base déjà créée (phpMyAdmin ou mysql CLI).
-- Remplace l’ancien rôle « user » par « patient » et ajoute « medecin ».

USE cabinet_dentaire;

ALTER TABLE users MODIFY COLUMN role ENUM('user', 'patient', 'medecin', 'admin') NOT NULL DEFAULT 'patient';

UPDATE users SET role = 'patient' WHERE role = 'user';

ALTER TABLE users MODIFY COLUMN role ENUM('patient', 'medecin', 'admin') NOT NULL DEFAULT 'patient';
